import {
  useGetDashboardSummary,
  useGetDepartmentPerformance,
  useGetTopPerformers,
  useGetTaskStatusBreakdown,
  useListEmployees,
  useListDepartments,
  useListKpis,
  useListTasks,
  useListKras,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import {
  Users, CheckSquare, Target, TrendingUp, Building2, Award, AlertTriangle, BarChart2,
  FileText, Download, LayoutDashboard, Loader2, CalendarRange, Lock,
} from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import {
  generateCompanyOverviewPDF,
  generateDepartmentReportPDF,
  generateKpiReportPDF,
  generateTaskReportPDF,
  generateEmployeeDatewiseReportPDF,
} from "@/lib/pdf-reports";

const COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];
const STATUS_COLORS: Record<string, string> = {
  todo: "#94a3b8", in_progress: "#6366f1", completed: "#22c55e", delayed: "#ef4444", blocked: "#f59e0b",
};

type Role = "admin" | "management" | "hod" | "manager" | "employee";

const REPORT_CARDS = [
  {
    id: "overview",
    title: "Company Overview Report",
    description: "Summary metrics, department performance table, and top 10 performers — all on one printable page.",
    icon: LayoutDashboard,
    color: "bg-indigo-50 text-indigo-600 border-indigo-100",
    badge: "PDF · A4 Portrait",
    allowedRoles: ["admin", "management"] as Role[],
  },
  {
    id: "department",
    title: "Department Performance Report",
    description: "Per-department breakdown showing headcount, average KPI score, task completion rate, and delayed tasks.",
    icon: Building2,
    color: "bg-blue-50 text-blue-600 border-blue-100",
    badge: "PDF · A4 Portrait",
    allowedRoles: ["admin", "management", "hod", "manager"] as Role[],
  },
  {
    id: "kpi",
    title: "Employee KPI Report",
    description: "Monthly KPI scores for all employees with performance ratings — colour-coded by rating tier.",
    icon: Target,
    color: "bg-emerald-50 text-emerald-600 border-emerald-100",
    badge: "PDF · A4 Portrait",
    allowedRoles: ["admin", "management", "hod", "manager", "employee"] as Role[],
  },
  {
    id: "tasks",
    title: "Task Status Report",
    description: "Full task list grouped by status (To Do, In Progress, Completed, Delayed, Blocked) with assignee and due date.",
    icon: CheckSquare,
    color: "bg-amber-50 text-amber-600 border-amber-100",
    badge: "PDF · A4 Landscape",
    allowedRoles: ["admin", "management", "hod", "manager"] as Role[],
  },
];

function StatCard({ title, value, icon: Icon, sub, color = "text-primary" }: {
  title: string; value?: string | number; icon: React.ElementType; sub?: string; color?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            {value !== undefined ? <p className={`text-3xl font-bold mt-1 ${color}`}>{value}</p> : <Skeleton className="h-8 w-16 mt-1" />}
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          </div>
          <div className="h-12 w-12 rounded-full flex items-center justify-center bg-primary/10">
            <Icon className={`h-6 w-6 ${color}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EmployeeDatewiseCard({ user, employees, departments }: {
  user: { id: number; name: string; role: string; departmentId: number; departmentName?: string | null; designation?: string | null };
  employees?: { id: number; name: string; departmentId: number; departmentName?: string }[];
  departments?: { id: number; name: string }[];
}) {
  const isEmployee = user.role === "employee";
  const isHodLike = user.role === "hod" || user.role === "manager";
  const isAdmin = user.role === "admin" || user.role === "management";

  const today = new Date().toISOString().slice(0, 10);
  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);

  const [selectedEmpId, setSelectedEmpId] = useState<number>(user.id);
  const [fromDate, setFromDate] = useState(firstOfMonth);
  const [toDate, setToDate] = useState(today);
  const [generating, setGenerating] = useState(false);

  const visibleEmployees = isAdmin
    ? employees
    : isHodLike
      ? employees?.filter((e) => e.departmentId === user.departmentId)
      : [{ id: user.id, name: user.name, departmentId: user.departmentId, departmentName: user.departmentName ?? "" }];

  const { data: empTasks } = useListTasks({ assignedToId: selectedEmpId });
  const { data: empKras } = useListKras({ employeeId: selectedEmpId });
  const { data: empKpis } = useListKpis({ employeeId: selectedEmpId });

  const selectedEmp = visibleEmployees?.find((e) => e.id === selectedEmpId);

  function handleGenerate() {
    if (!empTasks || !empKras || !empKpis || !selectedEmp) return;
    const from = new Date(fromDate);
    const to = new Date(toDate); to.setHours(23, 59, 59, 999);

    const filteredTasks = empTasks.filter((t) => {
      const ref = t.createdAt ? new Date(t.createdAt) : null;
      return ref && ref >= from && ref <= to;
    });
    const filteredKras = empKras.filter((k) => {
      const ref = k.createdAt ? new Date(k.createdAt) : null;
      return ref && ref >= from && ref <= to;
    });
    const filteredKpis = empKpis.filter((k) => {
      if (!k.month || !k.year) return false;
      const kpiDate = new Date(k.year, k.month - 1, 1);
      return kpiDate >= from && kpiDate <= to;
    });

    setGenerating(true);
    setTimeout(() => {
      try {
        generateEmployeeDatewiseReportPDF({
          employeeName: selectedEmp.name,
          departmentName: selectedEmp.departmentName ?? "",
          designation: user.id === selectedEmpId ? (user.designation ?? undefined) : undefined,
          fromDate: from,
          toDate: to,
          tasks: filteredTasks,
          kras: filteredKras,
          kpis: filteredKpis,
        });
      } finally {
        setGenerating(false);
      }
    }, 50);
  }

  const dataReady = !!(empTasks && empKras && empKpis);

  return (
    <Card className="col-span-full border-2 border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-start gap-4">
          <div className="h-11 w-11 rounded-xl border flex items-center justify-center shrink-0 bg-violet-50 text-violet-600 border-violet-100">
            <CalendarRange className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base leading-snug">Employee Date-wise Task &amp; KRA Report</CardTitle>
            <span className="inline-block mt-1 text-[10px] font-medium tracking-wide text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              PDF · A4 Portrait
            </span>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
          A detailed report of an employee's tasks, KRAs, and KPI scores within a selected date range — including progress, achievement scores, and performance ratings.
        </p>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        <div className={`grid gap-4 ${isEmployee ? "grid-cols-2" : "grid-cols-3"}`}>
          {!isEmployee && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Employee</Label>
              <Select value={selectedEmpId.toString()} onValueChange={(v) => setSelectedEmpId(Number(v))}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {visibleEmployees?.map((e) => (
                    <SelectItem key={e.id} value={e.id.toString()}>{e.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">From Date</Label>
            <Input type="date" className="h-9" value={fromDate} onChange={(e) => setFromDate(e.target.value)} max={toDate} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">To Date</Label>
            <Input type="date" className="h-9" value={toDate} onChange={(e) => setToDate(e.target.value)} min={fromDate} max={today} />
          </div>
        </div>

        {isEmployee && (
          <div className="flex items-center gap-2 rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
            <Lock className="h-3.5 w-3.5 shrink-0" />
            Generating report for your own profile: <strong className="ml-1 text-foreground">{user.name}</strong>
          </div>
        )}

        <Button
          className="w-full gap-2"
          disabled={!dataReady || generating || !fromDate || !toDate}
          onClick={handleGenerate}
        >
          {generating ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Generating…</>
          ) : !dataReady ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Loading data…</>
          ) : (
            <><Download className="h-4 w-4" /> Download PDF</>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

export default function Reports() {
  const { user } = useAuth();
  const role = (user?.role ?? "employee") as Role;
  const isAdmin = role === "admin" || role === "management";
  const isHodLike = role === "hod" || role === "manager";

  const { data: summary, isLoading: sumLoading } = useGetDashboardSummary();
  const { data: deptPerf, isLoading: deptLoading } = useGetDepartmentPerformance();
  const { data: topPerformers, isLoading: topLoading } = useGetTopPerformers();
  const { data: taskBreakdown, isLoading: taskLoading } = useGetTaskStatusBreakdown();
  const { data: employees } = useListEmployees();
  const { data: departments } = useListDepartments();
  const { data: kpis } = useListKpis(
    isAdmin ? {} : isHodLike ? { departmentId: user?.departmentId } : { employeeId: user?.id }
  );
  const { data: tasks } = useListTasks(
    isAdmin ? {} : isHodLike ? { departmentId: user?.departmentId } : { assignedToId: user?.id }
  );

  const [generating, setGenerating] = useState<string | null>(null);

  const visibleReports = REPORT_CARDS.filter((r) => r.allowedRoles.includes(role));

  const taskPieData = taskBreakdown?.map((t) => ({
    name: t.status?.replace(/_/g, " ") ?? "Unknown",
    value: t.count ?? 0,
    color: STATUS_COLORS[t.status ?? ""] ?? "#94a3b8",
  })) ?? [];

  const deptBarData = deptPerf?.map((d) => ({
    name: d.departmentName && d.departmentName.length > 10 ? d.departmentName.slice(0, 10) + "…" : (d.departmentName ?? ""),
    fullName: d.departmentName,
    avgKpi: Math.round((d.avgKpiScore ?? 0) * 10) / 10,
    completion: Math.round(d.taskCompletionRate ?? 0),
    employees: d.employeeCount ?? 0,
  })) ?? [];

  const roleBreakdown = employees ? (() => {
    const counts: Record<string, number> = {};
    for (const e of employees) counts[e.role] = (counts[e.role] ?? 0) + 1;
    return Object.entries(counts).map(([r, count]) => ({ name: r, value: count }));
  })() : [];

  const completionRate = summary
    ? Math.round(((summary.completedTasks ?? 0) / Math.max(summary.totalTasks ?? 1, 1)) * 100) : 0;

  const dataReady = {
    overview: !!(summary && deptPerf && topPerformers),
    department: !!deptPerf,
    kpi: !!kpis,
    tasks: !!tasks,
  };

  function handleDownload(id: string) {
    setGenerating(id);
    setTimeout(() => {
      try {
        if (id === "overview") generateCompanyOverviewPDF(summary ?? {}, deptPerf ?? [], topPerformers ?? []);
        else if (id === "department") generateDepartmentReportPDF(deptPerf ?? []);
        else if (id === "kpi") generateKpiReportPDF(kpis ?? []);
        else if (id === "tasks") generateTaskReportPDF(tasks ?? []);
      } finally {
        setGenerating(null);
      }
    }, 50);
  }

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6 overflow-y-auto">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Reports</h2>
        <p className="text-muted-foreground">Company-wide performance analytics and downloadable PDF reports.</p>
      </div>

      <Tabs defaultValue={role === "employee" ? "pdf" : "analytics"}>
        <TabsList className="mb-2">
          {(isAdmin || isHodLike) && (
            <TabsTrigger value="analytics" className="flex items-center gap-1.5">
              <BarChart2 className="h-3.5 w-3.5" /> Analytics
            </TabsTrigger>
          )}
          <TabsTrigger value="pdf" className="flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5" /> PDF Reports
          </TabsTrigger>
        </TabsList>

        {/* ── ANALYTICS TAB (admin / hod / manager only) ── */}
        {(isAdmin || isHodLike) && (
          <TabsContent value="analytics" className="space-y-6 mt-0">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <StatCard title="Total Employees" value={sumLoading ? undefined : (summary?.totalEmployees ?? employees?.length ?? "—")} icon={Users} sub={`Across ${departments?.length ?? "—"} departments`} />
              <StatCard title="Task Completion Rate" value={sumLoading ? undefined : `${completionRate}%`} icon={CheckSquare} sub={`${summary?.completedTasks ?? "—"} of ${summary?.totalTasks ?? "—"} tasks`} color={completionRate >= 70 ? "text-green-500" : completionRate >= 40 ? "text-amber-500" : "text-red-500"} />
              <StatCard title="Avg KPI Score" value={sumLoading ? undefined : Math.round((summary?.avgKpiScore ?? 0) * 10) / 10} icon={Target} sub="Company-wide average" color={(summary?.avgKpiScore ?? 0) >= 75 ? "text-green-500" : (summary?.avgKpiScore ?? 0) >= 50 ? "text-amber-500" : "text-red-500"} />
              <StatCard title="Delayed Tasks" value={sumLoading ? undefined : (summary?.delayedTasks ?? "—")} icon={AlertTriangle} color={(summary?.delayedTasks ?? 0) > 0 ? "text-red-500" : "text-green-500"} sub={(summary?.delayedTasks ?? 0) === 0 ? "All on track" : "Need attention"} />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Building2 className="h-4 w-4" /> Department Performance</CardTitle>
                  <CardDescription>Avg KPI score and task completion % per department</CardDescription>
                </CardHeader>
                <CardContent>
                  {deptLoading ? <Skeleton className="h-64 w-full" /> : (
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={deptBarData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(val, name) => [val, name === "avgKpi" ? "Avg KPI Score" : "Task Completion %"]} labelFormatter={(label, payload) => payload?.[0]?.payload?.fullName ?? label} contentStyle={{ fontSize: 12 }} />
                        <Legend formatter={(val) => val === "avgKpi" ? "Avg KPI" : "Completion %"} />
                        <Bar dataKey="avgKpi" fill="#6366f1" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="completion" fill="#22c55e" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><CheckSquare className="h-4 w-4" /> Task Status Breakdown</CardTitle>
                  <CardDescription>Distribution of all tasks by current status</CardDescription>
                </CardHeader>
                <CardContent>
                  {taskLoading ? <Skeleton className="h-64 w-full" /> : (
                    <ResponsiveContainer width="100%" height={260}>
                      <PieChart>
                        <Pie data={taskPieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3} dataKey="value">
                          {taskPieData.map((entry, index) => <Cell key={index} fill={entry.color} />)}
                        </Pie>
                        <Tooltip formatter={(val, name) => [val, String(name).replace(/_/g, " ")]} contentStyle={{ fontSize: 12 }} />
                        <Legend formatter={(val) => String(val).replace(/_/g, " ")} iconSize={10} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Award className="h-4 w-4 text-amber-500" /> Top Performers</CardTitle>
                  <CardDescription>Employees ranked by KPI score and task completion</CardDescription>
                </CardHeader>
                <CardContent>
                  {topLoading ? (
                    <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
                  ) : topPerformers?.length ? (
                    <div className="space-y-3">
                      {topPerformers.slice(0, 8).map((p, i) => (
                        <div key={p.employeeId} className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className={`text-sm font-bold w-5 text-center ${i < 3 ? "text-amber-500" : "text-muted-foreground"}`}>{i + 1}</span>
                            <div>
                              <p className="text-sm font-medium">{p.employeeName}</p>
                              <p className="text-xs text-muted-foreground">{p.departmentName}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-xs">{Math.round((p.kpiScore ?? 0) * 10) / 10} pts</Badge>
                            <Badge variant="outline" className="text-xs">{p.tasksCompleted ?? 0} done</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm text-center py-8">No performance data yet.</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><BarChart2 className="h-4 w-4" /> Workforce by Role</CardTitle>
                  <CardDescription>Headcount breakdown across roles</CardDescription>
                </CardHeader>
                <CardContent>
                  {!employees ? <Skeleton className="h-64 w-full" /> : (
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={roleBreakdown} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 11 }} />
                        <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={70} />
                        <Tooltip contentStyle={{ fontSize: 12 }} />
                        <Bar dataKey="value" name="Employees" radius={[0, 4, 4, 0]}>
                          {roleBreakdown.map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Department Summary Table</CardTitle>
                <CardDescription>Detailed metrics per department</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left px-6 py-3 font-medium text-muted-foreground">Department</th>
                        <th className="text-right px-6 py-3 font-medium text-muted-foreground">Employees</th>
                        <th className="text-right px-6 py-3 font-medium text-muted-foreground">Avg KPI Score</th>
                        <th className="text-right px-6 py-3 font-medium text-muted-foreground">Task Completion</th>
                        <th className="text-right px-6 py-3 font-medium text-muted-foreground">Delayed Tasks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {deptLoading ? (
                        Array.from({ length: 5 }).map((_, i) => (
                          <tr key={i} className="border-b">
                            {Array.from({ length: 5 }).map((_, j) => <td key={j} className="px-6 py-3"><Skeleton className="h-4 w-full" /></td>)}
                          </tr>
                        ))
                      ) : deptPerf?.length ? (
                        deptPerf.map((d) => {
                          const completion = Math.round(d.taskCompletionRate ?? 0);
                          return (
                            <tr key={d.departmentId} className="border-b hover:bg-muted/30 transition-colors">
                              <td className="px-6 py-3 font-medium">{d.departmentName}</td>
                              <td className="px-6 py-3 text-right">{d.employeeCount ?? 0}</td>
                              <td className="px-6 py-3 text-right">
                                <span className={(d.avgKpiScore ?? 0) >= 75 ? "text-green-600 font-medium" : (d.avgKpiScore ?? 0) >= 50 ? "text-amber-600 font-medium" : "text-red-600 font-medium"}>
                                  {Math.round((d.avgKpiScore ?? 0) * 10) / 10}
                                </span>
                              </td>
                              <td className="px-6 py-3 text-right">
                                <span className={completion >= 70 ? "text-green-600 font-medium" : completion >= 40 ? "text-amber-600 font-medium" : "text-red-600 font-medium"}>{completion}%</span>
                              </td>
                              <td className="px-6 py-3 text-right">
                                <span className={(d.delayedTaskCount ?? 0) > 0 ? "text-red-600 font-medium" : "text-green-600"}>{d.delayedTaskCount ?? 0}</span>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr><td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">No department data available.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* ── PDF REPORTS TAB ── */}
        <TabsContent value="pdf" className="mt-0">
          <div className="mb-5">
            <p className="text-sm text-muted-foreground">
              Generate and download professionally formatted PDF reports. Each report is built from live data and downloads instantly to your device.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            {/* Standard report cards filtered by role */}
            {visibleReports.map((r) => {
              const ready = dataReady[r.id as keyof typeof dataReady];
              const busy = generating === r.id;
              return (
                <Card key={r.id} className="flex flex-col">
                  <CardHeader className="pb-3">
                    <div className="flex items-start gap-4">
                      <div className={`h-11 w-11 rounded-xl border flex items-center justify-center shrink-0 ${r.color}`}>
                        <r.icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base leading-snug">{r.title}</CardTitle>
                        <span className="inline-block mt-1 text-[10px] font-medium tracking-wide text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{r.badge}</span>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col justify-between gap-4 pt-0">
                    <p className="text-sm text-muted-foreground leading-relaxed">{r.description}</p>
                    <Button className="w-full gap-2" disabled={!ready || busy} onClick={() => handleDownload(r.id)}>
                      {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating…</>
                        : !ready ? <><Loader2 className="h-4 w-4 animate-spin" /> Loading data…</>
                        : <><Download className="h-4 w-4" /> Download PDF</>}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}

            {/* Employee Date-wise report — accessible to all roles */}
            {user && (
              <EmployeeDatewiseCard
                user={user}
                employees={employees}
                departments={departments}
              />
            )}
          </div>

          <Card className="mt-6 border-dashed">
            <CardContent className="pt-5 pb-5">
              <div className="flex items-start gap-3">
                <FileText className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium">About these reports</p>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    All PDFs are generated entirely in your browser using live data — nothing is sent to a server.
                    Reports include RPS Infrastructure Limited branding, generation date, and page numbers.
                    For best results, open the downloaded file in Adobe Acrobat or any modern PDF viewer.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
