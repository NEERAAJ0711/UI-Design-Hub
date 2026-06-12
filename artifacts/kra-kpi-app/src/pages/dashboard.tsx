import {
  useGetDashboardSummary,
  useGetDepartmentPerformance,
  useGetTopPerformers,
  useGetRecentActivity,
  useGetEmployeeDashboardSummary,
  useGetPendingApprovals,
  useApproveKraClosure,
  getGetPendingApprovalsQueryKey,
  getListKrasQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";
import { Users, Star, Target, Bell, CheckCircle2, XCircle } from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";

const ratingColors: Record<string, string> = {
  "Outstanding": "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  "Very Good": "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  "Good": "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300",
  "Average": "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  "Improvement Required": "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

export default function Dashboard() {
  const { user } = useAuth();
  if (!user) return null;
  if (user.role === "employee") return <EmployeeDashboard userId={user.id} />;
  if (user.role === "manager" || user.role === "hod") return <ManagerHodDashboard />;
  // admin and management both get the full company view
  return <ManagementDashboard />;
}

// ── Management Dashboard ───────────────────────────────────────────────────────
function ManagementDashboard() {
  const { data: summary, isLoading: loadingSummary } = useGetDashboardSummary();
  const { data: deptPerformance, isLoading: loadingDept } = useGetDepartmentPerformance();
  const { data: topPerformers, isLoading: loadingTop } = useGetTopPerformers({ limit: 5 });
  const { data: recentActivity, isLoading: loadingActivity } = useGetRecentActivity({ limit: 10 });

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6 overflow-y-auto">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Management Dashboard</h2>
          <p className="text-muted-foreground">Company-wide overview across all departments.</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
        <StatCard title="Total Employees" icon={<Users className="h-4 w-4 text-muted-foreground" />} loading={loadingSummary} value={summary?.totalEmployees} />
        <StatCard title="Avg KPI Score" icon={<Star className="h-4 w-4 text-muted-foreground" />} loading={loadingSummary} value={summary?.avgKpiScore?.toFixed(1)} />
      </div>

      {summary && summary.pendingApprovals > 0 && (
        <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-900">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-orange-800 dark:text-orange-300 flex items-center gap-2">
              <Bell className="h-4 w-4" /> {summary.pendingApprovals} Pending Approval{summary.pendingApprovals > 1 ? "s" : ""} company-wide
            </CardTitle>
          </CardHeader>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Department Performance</CardTitle>
            <CardDescription>Average KPI scores by department</CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            {loadingDept ? <Skeleton className="h-[300px] w-full" /> : deptPerformance?.length ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={deptPerformance}>
                  <XAxis dataKey="departmentName" stroke="#888888" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid hsl(var(--border))" }} />
                  <Bar dataKey="avgKpiScore" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <EmptyChart />}
          </CardContent>
        </Card>

      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Top Performers</CardTitle></CardHeader>
          <CardContent>
            {loadingTop ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full mb-2" />) :
              topPerformers?.map((emp) => (
                <div key={emp.employeeId} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div><p className="text-sm font-medium">{emp.employeeName}</p><p className="text-xs text-muted-foreground">{emp.departmentName}</p></div>
                  <Badge variant="secondary">{emp.kpiScore.toFixed(1)}</Badge>
                </div>
              ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Recent Activity</CardTitle></CardHeader>
          <CardContent>
            {loadingActivity ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full mb-2" />) :
              recentActivity?.map((a) => (
                <div key={a.id} className="py-2 border-b last:border-0">
                  <p className="text-sm font-medium leading-tight">{a.description}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{a.actorName} · {format(new Date(a.createdAt), "MMM d, h:mm a")}</p>
                </div>
              ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ── Manager / HOD Dashboard ────────────────────────────────────────────────────
function ManagerHodDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const approvalParams = { departmentId: user?.departmentId ?? undefined, role: user?.role };
  const { data: summary } = useGetDashboardSummary();
  const { data: pendingData, isLoading: loadingPending } = useGetPendingApprovals(approvalParams);
  const { data: topPerformers } = useGetTopPerformers({ limit: 5 });
  const { data: recentActivity } = useGetRecentActivity({ limit: 8 });

  const approveKra = useApproveKraClosure();

  const totalPending = (pendingData?.kras?.length ?? 0);

  function handleKraApproval(id: number, approved: boolean) {
    approveKra.mutate({ id, data: { approved } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetPendingApprovalsQueryKey(approvalParams) });
        queryClient.invalidateQueries({ queryKey: getListKrasQueryKey() });
        toast({ title: approved ? "KRA closure approved" : "KRA closure rejected" });
      },
    });
  }

  const roleLabel = user?.role === "hod" ? "HOD" : "Manager";

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6 overflow-y-auto">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">{roleLabel} Dashboard</h2>
        <p className="text-muted-foreground">{user?.departmentName ? `${user.departmentName} · ` : ""}Approvals and team overview.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <StatCard title="Pending Approvals" icon={<Bell className={`h-4 w-4 ${totalPending > 0 ? "text-orange-500" : "text-muted-foreground"}`} />} loading={loadingPending} value={totalPending} valueClass={totalPending > 0 ? "text-orange-600" : undefined} />
        <StatCard title="Total Employees" icon={<Users className="h-4 w-4 text-muted-foreground" />} loading={false} value={summary?.totalEmployees} />
      </div>

      {/* Pending Approvals */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-orange-500" /> Pending Approvals
            {totalPending > 0 && <Badge className="bg-orange-500 text-white ml-1">{totalPending}</Badge>}
          </CardTitle>
          <CardDescription>Review and action employee requests below.</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingPending ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
          ) : totalPending === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle2 className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">All caught up — no pending approvals.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {(pendingData?.kras?.length ?? 0) > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">KRA Closure Requests</h4>
                  {pendingData!.kras.map((kra) => (
                    <div key={kra.id} className="flex items-center justify-between p-3 rounded-lg border mb-2 bg-card">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{kra.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <p className="text-xs text-muted-foreground">{kra.employeeName} · {kra.departmentName}</p>
                          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${kraStatusColors[kra.kraStatus] ?? ""}`}>{kra.kraStatus.replace("_", " ")}</span>
                        </div>
                        {kra.achievementPct != null && <p className="text-xs text-muted-foreground">Achievement: {kra.achievementPct}%</p>}
                      </div>
                      <div className="flex gap-2 ml-4 shrink-0">
                        <Button size="sm" variant="outline" className="text-green-600 border-green-200 hover:bg-green-50" onClick={() => handleKraApproval(kra.id, true)}>
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Approve
                        </Button>
                        <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => handleKraApproval(kra.id, false)}>
                          <XCircle className="h-3.5 w-3.5 mr-1" /> Reject
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top Performers</CardTitle>
            <CardDescription>Employees ranked by KPI score</CardDescription>
          </CardHeader>
          <CardContent>
            {topPerformers?.length ? topPerformers.map((emp) => (
              <div key={emp.employeeId} className="flex items-center justify-between py-2 border-b last:border-0">
                <div>
                  <p className="text-sm font-medium">{emp.employeeName}</p>
                  <p className="text-xs text-muted-foreground">{emp.departmentName}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ratingColors[emp.rating] ?? ""}`}>{emp.rating}</span>
                  <Badge variant="secondary" className="font-bold">{emp.kpiScore.toFixed(1)}</Badge>
                </div>
              </div>
            )) : <p className="text-sm text-muted-foreground">No KPI data yet</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Recent Activity</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentActivity?.map((a) => (
                <div key={a.id} className="flex justify-between items-start border-b pb-2 last:border-0">
                  <p className="text-sm">{a.description}</p>
                  <p className="text-xs text-muted-foreground whitespace-nowrap ml-4">{format(new Date(a.createdAt), "MMM d, h:mm a")}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

    </div>
  );
}

// ── Employee Dashboard ─────────────────────────────────────────────────────────
function EmployeeDashboard({ userId }: { userId: number }) {
  const { user } = useAuth();
  const { data: summary, isLoading } = useGetEmployeeDashboardSummary(
    { employeeId: userId },
    { query: { queryKey: ["employee-dashboard", userId] } }
  );

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6 overflow-y-auto">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">My Dashboard</h2>
        <p className="text-muted-foreground">Welcome back, {user?.name?.split(" ")[0]}. Here's your performance overview.</p>
      </div>

      

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Star className="h-5 w-5 text-yellow-500" /> My KPI Score</CardTitle>
            <CardDescription>Latest performance evaluation</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-20 w-full" /> : summary?.myKpiScore != null ? (
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-4xl font-bold text-primary">{summary.myKpiScore.toFixed(1)}</div>
                  <div className="text-sm text-muted-foreground mt-1">out of 100</div>
                </div>
                {summary.myKpiRating && (
                  <span className={`text-sm px-3 py-1.5 rounded-full font-medium ${ratingColors[summary.myKpiRating] ?? ""}`}>
                    {summary.myKpiRating}
                  </span>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No KPI evaluation on record yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Target className="h-5 w-5 text-blue-500" /> My KRA Achievement</CardTitle>
            <CardDescription>Average achievement across all assigned KRAs</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-20 w-full" /> : summary?.myKraAvg != null ? (
              <div>
                <div className="text-4xl font-bold text-primary">{summary.myKraAvg.toFixed(1)}%</div>
                <div className="text-sm text-muted-foreground mt-1">average achievement</div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No KRAs assigned yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>My Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full mb-2" />) :
            summary?.recentActivity?.length ? summary.recentActivity.map((a) => (
              <div key={a.id} className="py-2 border-b last:border-0">
                <p className="text-sm">{a.description}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{format(new Date(a.createdAt), "MMM d, h:mm a")}</p>
              </div>
            )) : <p className="text-sm text-muted-foreground">No recent activity found.</p>}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────
const kraStatusColors: Record<string, string> = {
  active: "bg-blue-100 text-blue-800",
  submitted: "bg-yellow-100 text-yellow-800",
  manager_approved: "bg-orange-100 text-orange-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
};

function StatCard({ title, icon, loading, value, valueClass }: {
  title: string; icon: React.ReactNode; loading: boolean; value: number | string | undefined | null; valueClass?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        {loading ? <Skeleton className="h-8 w-20" /> : (
          <div className={`text-2xl font-bold ${valueClass ?? ""}`}>{value ?? 0}</div>
        )}
      </CardContent>
    </Card>
  );
}

function EmptyChart() {
  return <div className="h-[300px] flex items-center justify-center text-muted-foreground text-sm">No data available</div>;
}
