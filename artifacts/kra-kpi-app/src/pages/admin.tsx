import { useState } from "react";
import {
  useListEmployees,
  useListDepartments,
  useUpdateEmployee,
  useGetDashboardSummary,
  useGetPendingApprovals,
  useGetRecentActivity,
  useApproveKraClosure,
  useApproveTaskStatus,
  getListEmployeesQueryKey,
  getGetPendingApprovalsQueryKey,
  getListKrasQueryKey,
  getListTasksQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ShieldAlert, Users, Building2, CheckSquare, Target, BarChart, Bell, CheckCircle2, XCircle, Activity, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

const ROLES = ["admin", "management", "hod", "manager", "employee"] as const;
type RoleType = typeof ROLES[number];

const roleColors: Record<string, string> = {
  admin: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  management: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  hod: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  manager: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  employee: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
};

const roleLabels: Record<string, string> = {
  admin: "System Admin",
  management: "Management",
  hod: "HOD",
  manager: "Manager",
  employee: "Employee",
};

const kraStatusColors: Record<string, string> = {
  submitted: "bg-yellow-100 text-yellow-800",
  manager_approved: "bg-orange-100 text-orange-800",
};

export default function Admin() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: summary, isLoading: loadingSummary } = useGetDashboardSummary();
  const { data: employees, isLoading: loadingEmps } = useListEmployees();
  const { data: departments } = useListDepartments();
  const { data: pendingData, isLoading: loadingPending } = useGetPendingApprovals();
  const { data: recentActivity } = useGetRecentActivity({ limit: 20 });

  const updateEmployee = useUpdateEmployee();
  const approveKra = useApproveKraClosure();
  const approveTask = useApproveTaskStatus();

  const [roleChangeTarget, setRoleChangeTarget] = useState<{ id: number; name: string; newRole: RoleType } | null>(null);
  const [filterDept, setFilterDept] = useState("all");

  const deptMap = new Map((departments ?? []).map((d) => [d.id, d.name]));

  const totalPending = (pendingData?.kras?.length ?? 0) + (pendingData?.tasks?.length ?? 0);

  function confirmRoleChange() {
    if (!roleChangeTarget) return;
    updateEmployee.mutate(
      { id: roleChangeTarget.id, data: { role: roleChangeTarget.newRole } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListEmployeesQueryKey() });
          setRoleChangeTarget(null);
          toast({ title: `Role updated for ${roleChangeTarget.name}` });
        },
        onError: () => toast({ title: "Failed to update role", variant: "destructive" }),
      }
    );
  }

  function handleRoleSelect(emp: { id: number; name: string; role: string }, newRole: string) {
    if (newRole === emp.role) return;
    setRoleChangeTarget({ id: emp.id, name: emp.name, newRole: newRole as RoleType });
  }

  function handleKraApproval(id: number, approved: boolean) {
    approveKra.mutate({ id, data: { approved } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetPendingApprovalsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListKrasQueryKey() });
        toast({ title: approved ? "KRA approved" : "KRA rejected" });
      },
    });
  }

  function handleTaskApproval(id: number, approved: boolean) {
    approveTask.mutate({ id, data: { approved } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetPendingApprovalsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
        toast({ title: approved ? "Status change approved" : "Status change rejected" });
      },
    });
  }

  const filteredEmployees = employees?.filter((e) =>
    filterDept === "all" || e.departmentId === Number(filterDept)
  );

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-red-100 dark:bg-red-950/30">
          <ShieldAlert className="h-5 w-5 text-red-500" />
        </div>
        <div>
          <h2 className="text-3xl font-bold tracking-tight">System Administration</h2>
          <p className="text-muted-foreground">Full system control — user management, role assignment, and company-wide approvals.</p>
        </div>
      </div>

      <div className="rounded-lg border border-red-200 bg-red-50/70 dark:bg-red-950/20 dark:border-red-900/30 px-4 py-2.5 flex items-center gap-2">
        <ShieldAlert className="h-4 w-4 text-red-500 shrink-0" />
        <p className="text-sm text-red-700 dark:text-red-400 font-medium">Admin Mode: Changes made here affect all users and roles system-wide.</p>
      </div>

      {/* System Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <StatCard icon={<Users className="h-4 w-4" />} title="Total Users" value={summary?.totalEmployees} loading={loadingSummary} />
        <StatCard icon={<Building2 className="h-4 w-4" />} title="Departments" value={summary?.totalDepartments} loading={loadingSummary} />
        <StatCard icon={<CheckSquare className="h-4 w-4" />} title="Total Tasks" value={summary?.totalTasks} loading={loadingSummary} />
        <StatCard icon={<Target className="h-4 w-4" />} title="Avg KPI Score" value={summary?.avgKpiScore?.toFixed(1) ?? "—"} loading={loadingSummary} />
        <StatCard
          icon={<Bell className={`h-4 w-4 ${totalPending > 0 ? "text-orange-500" : ""}`} />}
          title="Pending Approvals"
          value={totalPending}
          loading={loadingPending}
          valueClass={totalPending > 0 ? "text-orange-600" : undefined}
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="users" className="space-y-4">
        <TabsList className="grid grid-cols-3 w-full max-w-lg">
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="h-4 w-4" /> Users
          </TabsTrigger>
          <TabsTrigger value="approvals" className="flex items-center gap-2">
            <Bell className="h-4 w-4" /> Approvals
            {totalPending > 0 && (
              <Badge className="h-5 min-w-5 px-1.5 bg-orange-500 text-white text-xs">{totalPending}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="logs" className="flex items-center gap-2">
            <Activity className="h-4 w-4" /> Activity Log
          </TabsTrigger>
        </TabsList>

        {/* ── Users Tab ── */}
        <TabsContent value="users">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>User Management</CardTitle>
                  <CardDescription>View all users and change their roles. Role changes take effect at next login.</CardDescription>
                </div>
                <Select value={filterDept} onValueChange={setFilterDept}>
                  <SelectTrigger className="w-[180px]"><SelectValue placeholder="All Departments" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Departments</SelectItem>
                    {departments?.map((d) => <SelectItem key={d.id} value={d.id.toString()}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Designation</TableHead>
                    <TableHead>Current Role</TableHead>
                    <TableHead>Change Role</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingEmps ? (
                    Array.from({ length: 6 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 6 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}
                      </TableRow>
                    ))
                  ) : filteredEmployees?.length ? (
                    filteredEmployees.map((emp) => (
                      <TableRow key={emp.id}>
                        <TableCell className="font-medium">{emp.name}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{emp.email}</TableCell>
                        <TableCell>{deptMap.get(emp.departmentId) ?? "—"}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{emp.designation ?? "—"}</TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${roleColors[emp.role] ?? ""}`}>
                            {roleLabels[emp.role] ?? emp.role}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={emp.role}
                            onValueChange={(newRole) => handleRoleSelect(emp, newRole)}
                          >
                            <SelectTrigger className="w-[140px] h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ROLES.map((r) => (
                                <SelectItem key={r} value={r} className="text-xs">
                                  <div className="flex items-center gap-2">
                                    <span className={`inline-block w-2 h-2 rounded-full ${r === "admin" ? "bg-red-500" : r === "management" ? "bg-purple-500" : r === "hod" ? "bg-blue-500" : r === "manager" ? "bg-green-500" : "bg-gray-400"}`} />
                                    {roleLabels[r]}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">No users found.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Approvals Tab ── */}
        <TabsContent value="approvals">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-orange-500" /> Company-wide Pending Approvals
                {totalPending > 0 && <Badge className="bg-orange-500 text-white">{totalPending}</Badge>}
              </CardTitle>
              <CardDescription>All pending KRA closure requests and task status changes across every department.</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingPending ? (
                <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
              ) : totalPending === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-3 opacity-20" />
                  <p className="text-sm font-medium">No pending approvals</p>
                  <p className="text-xs mt-1">All requests have been actioned.</p>
                </div>
              ) : (
                <div className="space-y-5">
                  {(pendingData?.kras?.length ?? 0) > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                        KRA Closure Requests ({pendingData!.kras.length})
                      </h4>
                      <div className="space-y-2">
                        {pendingData!.kras.map((kra) => (
                          <div key={kra.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{kra.title}</p>
                              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                <p className="text-xs text-muted-foreground">{kra.employeeName}</p>
                                <span className="text-xs text-muted-foreground">·</span>
                                <p className="text-xs text-muted-foreground">{kra.departmentName}</p>
                                <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${kraStatusColors[kra.kraStatus] ?? ""}`}>
                                  {kra.kraStatus.replace("_", " ")}
                                </span>
                                {kra.achievementPct != null && (
                                  <span className="text-xs text-muted-foreground">Achievement: {kra.achievementPct}%</span>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-2 ml-4 shrink-0">
                              <Button size="sm" variant="outline" className="text-green-600 border-green-200 hover:bg-green-50 h-8" onClick={() => handleKraApproval(kra.id, true)}>
                                <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Approve
                              </Button>
                              <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50 h-8" onClick={() => handleKraApproval(kra.id, false)}>
                                <XCircle className="h-3.5 w-3.5 mr-1" /> Reject
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {(pendingData?.tasks?.length ?? 0) > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                        Task Status Requests ({pendingData!.tasks.length})
                      </h4>
                      <div className="space-y-2">
                        {pendingData!.tasks.map((task) => (
                          <div key={task.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{task.title}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <p className="text-xs text-muted-foreground">{task.assignedToName} · {task.departmentName}</p>
                                <span className="text-xs font-medium">{task.status}</span>
                                <span className="text-xs text-muted-foreground">→</span>
                                <span className="text-xs font-medium text-blue-600 bg-blue-50 dark:bg-blue-950/30 px-1.5 py-0.5 rounded-full">{task.requestedStatus}</span>
                              </div>
                            </div>
                            <div className="flex gap-2 ml-4 shrink-0">
                              <Button size="sm" variant="outline" className="text-green-600 border-green-200 hover:bg-green-50 h-8" onClick={() => handleTaskApproval(task.id, true)}>
                                <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Approve
                              </Button>
                              <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50 h-8" onClick={() => handleTaskApproval(task.id, false)}>
                                <XCircle className="h-3.5 w-3.5 mr-1" /> Reject
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Activity Log Tab ── */}
        <TabsContent value="logs">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" /> System Activity Log
              </CardTitle>
              <CardDescription>Full audit trail of all actions across the system.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {recentActivity?.length ? recentActivity.map((a) => (
                  <div key={a.id} className="flex items-start justify-between py-2.5 border-b last:border-0">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">
                        <ActivityDot type={a.type} />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{a.description}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {a.actorName !== "System" && <span className="font-medium">{a.actorName} · </span>}
                          <span className="capitalize">{a.entityType}</span> #{a.entityId}
                        </p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground whitespace-nowrap ml-4">{format(new Date(a.createdAt), "MMM d, h:mm a")}</p>
                  </div>
                )) : <p className="text-sm text-muted-foreground py-4 text-center">No activity recorded yet.</p>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Role change confirmation dialog */}
      <AlertDialog open={!!roleChangeTarget} onOpenChange={(open) => !open && setRoleChangeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change User Role?</AlertDialogTitle>
            <AlertDialogDescription>
              Change <strong>{roleChangeTarget?.name}</strong>'s role to{" "}
              <strong>{roleLabels[roleChangeTarget?.newRole ?? ""] ?? roleChangeTarget?.newRole}</strong>?
              <br />
              <span className="text-orange-600 dark:text-orange-400 mt-2 inline-block text-xs">
                This takes effect immediately on their next action.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRoleChange} disabled={updateEmployee.isPending}>
              <RefreshCw className="mr-2 h-3.5 w-3.5" /> Confirm Change
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StatCard({ icon, title, value, loading, valueClass }: {
  icon: React.ReactNode; title: string; value: number | string | undefined; loading?: boolean; valueClass?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <span className="text-muted-foreground">{icon}</span>
      </CardHeader>
      <CardContent>
        {loading ? <Skeleton className="h-8 w-16" /> : (
          <div className={`text-2xl font-bold ${valueClass ?? ""}`}>{value ?? 0}</div>
        )}
      </CardContent>
    </Card>
  );
}

function ActivityDot({ type }: { type: string }) {
  const colors: Record<string, string> = {
    task_created: "bg-blue-500",
    task_completed: "bg-green-500",
    task_delayed: "bg-red-500",
    task_status_requested: "bg-yellow-500",
    task_status_approved: "bg-green-400",
    task_status_rejected: "bg-red-400",
    kra_submitted: "bg-yellow-500",
    kra_approved: "bg-green-500",
    kra_rejected: "bg-red-500",
    kra_scored: "bg-blue-400",
    kpi_created: "bg-purple-500",
    employee_created: "bg-indigo-500",
  };
  return <span className={`block h-2 w-2 mt-1.5 rounded-full shrink-0 ${colors[type] ?? "bg-gray-400"}`} />;
}
