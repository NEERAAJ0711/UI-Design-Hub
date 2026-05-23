import {
  useGetDashboardSummary,
  useGetDepartmentPerformance,
  useGetTopPerformers,
  useGetTaskStatusBreakdown,
  useListEmployees,
  useListDepartments,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import {
  Users, CheckSquare, Target, TrendingUp, Building2, Award, AlertTriangle, BarChart2,
} from "lucide-react";

const COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

const STATUS_COLORS: Record<string, string> = {
  todo: "#94a3b8",
  in_progress: "#6366f1",
  completed: "#22c55e",
  delayed: "#ef4444",
  blocked: "#f59e0b",
};

function StatCard({ title, value, icon: Icon, sub, color = "text-primary" }: {
  title: string; value?: string | number; icon: React.ElementType; sub?: string; color?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            {value !== undefined
              ? <p className={`text-3xl font-bold mt-1 ${color}`}>{value}</p>
              : <Skeleton className="h-8 w-16 mt-1" />}
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

export default function Reports() {
  const { data: summary, isLoading: sumLoading } = useGetDashboardSummary();
  const { data: deptPerf, isLoading: deptLoading } = useGetDepartmentPerformance();
  const { data: topPerformers, isLoading: topLoading } = useGetTopPerformers();
  const { data: taskBreakdown, isLoading: taskLoading } = useGetTaskStatusBreakdown();
  const { data: employees } = useListEmployees();
  const { data: departments } = useListDepartments();

  const taskPieData = taskBreakdown?.map((t) => ({
    name: t.status?.replace(/_/g, " ") ?? "Unknown",
    value: t.count ?? 0,
    color: STATUS_COLORS[t.status ?? ""] ?? "#94a3b8",
  })) ?? [];

  const deptBarData = deptPerf?.map((d) => ({
    name: d.departmentName && d.departmentName.length > 10
      ? d.departmentName.slice(0, 10) + "…"
      : (d.departmentName ?? ""),
    fullName: d.departmentName,
    avgKpi: Math.round((d.avgKpiScore ?? 0) * 10) / 10,
    completion: Math.round(d.taskCompletionRate ?? 0),
    employees: d.employeeCount ?? 0,
  })) ?? [];

  const roleBreakdown = employees ? (() => {
    const counts: Record<string, number> = {};
    for (const e of employees) counts[e.role] = (counts[e.role] ?? 0) + 1;
    return Object.entries(counts).map(([role, count]) => ({ name: role, value: count }));
  })() : [];

  const completionRate = summary
    ? Math.round(((summary.completedTasks ?? 0) / Math.max(summary.totalTasks ?? 1, 1)) * 100)
    : 0;

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6 overflow-y-auto">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Reports</h2>
        <p className="text-muted-foreground">Company-wide performance analytics and summaries.</p>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Employees"
          value={sumLoading ? undefined : (summary?.totalEmployees ?? employees?.length ?? "—")}
          icon={Users}
          sub={`Across ${departments?.length ?? "—"} departments`}
        />
        <StatCard
          title="Task Completion Rate"
          value={sumLoading ? undefined : `${completionRate}%`}
          icon={CheckSquare}
          sub={`${summary?.completedTasks ?? "—"} of ${summary?.totalTasks ?? "—"} tasks`}
          color={completionRate >= 70 ? "text-green-500" : completionRate >= 40 ? "text-amber-500" : "text-red-500"}
        />
        <StatCard
          title="Avg KPI Score"
          value={sumLoading ? undefined : Math.round((summary?.avgKpiScore ?? 0) * 10) / 10}
          icon={Target}
          sub="Company-wide average"
          color={(summary?.avgKpiScore ?? 0) >= 75 ? "text-green-500" : (summary?.avgKpiScore ?? 0) >= 50 ? "text-amber-500" : "text-red-500"}
        />
        <StatCard
          title="Delayed Tasks"
          value={sumLoading ? undefined : (summary?.delayedTasks ?? "—")}
          icon={AlertTriangle}
          color={(summary?.delayedTasks ?? 0) > 0 ? "text-red-500" : "text-green-500"}
          sub={(summary?.delayedTasks ?? 0) === 0 ? "All on track" : "Need attention"}
        />
      </div>

      {/* Department Performance Bar Chart */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-4 w-4" /> Department Performance
            </CardTitle>
            <CardDescription>Avg KPI score and task completion % per department</CardDescription>
          </CardHeader>
          <CardContent>
            {deptLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={deptBarData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(val, name) => [val, name === "avgKpi" ? "Avg KPI Score" : "Task Completion %"]}
                    labelFormatter={(label, payload) => payload?.[0]?.payload?.fullName ?? label}
                    contentStyle={{ fontSize: 12 }}
                  />
                  <Legend formatter={(val) => val === "avgKpi" ? "Avg KPI" : "Completion %"} />
                  <Bar dataKey="avgKpi" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="completion" fill="#22c55e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Task Status Breakdown Pie */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckSquare className="h-4 w-4" /> Task Status Breakdown
            </CardTitle>
            <CardDescription>Distribution of all tasks by current status</CardDescription>
          </CardHeader>
          <CardContent>
            {taskLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={taskPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {taskPieData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(val, name) => [val, String(name).replace(/_/g, " ")]} contentStyle={{ fontSize: 12 }} />
                  <Legend formatter={(val) => String(val).replace(/_/g, " ")} iconSize={10} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Performers + Role Breakdown */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-4 w-4 text-amber-500" /> Top Performers
            </CardTitle>
            <CardDescription>Employees ranked by KPI score and task completion</CardDescription>
          </CardHeader>
          <CardContent>
            {topLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : topPerformers?.length ? (
              <div className="space-y-3">
                {topPerformers.slice(0, 8).map((p, i) => (
                  <div key={p.employeeId} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={`text-sm font-bold w-5 text-center ${i < 3 ? "text-amber-500" : "text-muted-foreground"}`}>
                        {i + 1}
                      </span>
                      <div>
                        <p className="text-sm font-medium">{p.employeeName}</p>
                        <p className="text-xs text-muted-foreground">{p.departmentName}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {Math.round((p.kpiScore ?? 0) * 10) / 10} pts
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {p.tasksCompleted ?? 0} done
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm text-center py-8">No performance data yet.</p>
            )}
          </CardContent>
        </Card>

        {/* Role Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart2 className="h-4 w-4" /> Workforce by Role
            </CardTitle>
            <CardDescription>Headcount breakdown across roles</CardDescription>
          </CardHeader>
          <CardContent>
            {!employees ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={roleBreakdown} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={70} />
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                  <Bar dataKey="value" name="Employees" radius={[0, 4, 4, 0]}>
                    {roleBreakdown.map((_, index) => (
                      <Cell key={index} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Department summary table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" /> Department Summary Table
          </CardTitle>
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
                      {Array.from({ length: 5 }).map((_, j) => (
                        <td key={j} className="px-6 py-3"><Skeleton className="h-4 w-full" /></td>
                      ))}
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
                          <span className={
                            (d.avgKpiScore ?? 0) >= 75 ? "text-green-600 font-medium" :
                            (d.avgKpiScore ?? 0) >= 50 ? "text-amber-600 font-medium" :
                            "text-red-600 font-medium"
                          }>
                            {Math.round((d.avgKpiScore ?? 0) * 10) / 10}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-right">
                          <span className={
                            completion >= 70 ? "text-green-600 font-medium" :
                            completion >= 40 ? "text-amber-600 font-medium" :
                            "text-red-600 font-medium"
                          }>
                            {completion}%
                          </span>
                        </td>
                        <td className="px-6 py-3 text-right">
                          <span className={(d.delayedTaskCount ?? 0) > 0 ? "text-red-600 font-medium" : "text-green-600"}>
                            {d.delayedTaskCount ?? 0}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">No department data available.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
