import { useQuery } from "@tanstack/react-query";
import {
  useGetDashboardSummary,
  useGetDepartmentPerformance,
  useGetTaskStatusBreakdown,
  useGetTopPerformers,
  useGetOverdueTasks,
  useGetRecentActivity,
} from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from "recharts";
import { Users, Building2, CheckSquare, Clock, AlertTriangle, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

const COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

export default function Dashboard() {
  const { data: summary, isLoading: loadingSummary } = useGetDashboardSummary();
  const { data: deptPerformance, isLoading: loadingDept } = useGetDepartmentPerformance();
  const { data: taskBreakdown, isLoading: loadingTasks } = useGetTaskStatusBreakdown();
  const { data: topPerformers, isLoading: loadingTop } = useGetTopPerformers({ limit: 5 });
  const { data: overdueTasks, isLoading: loadingOverdue } = useGetOverdueTasks();
  const { data: recentActivity, isLoading: loadingActivity } = useGetRecentActivity({ limit: 10 });

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6 overflow-y-auto">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loadingSummary ? <Skeleton className="h-8 w-20" /> : (
              <div className="text-2xl font-bold">{summary?.totalEmployees || 0}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg KPI Score</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loadingSummary ? <Skeleton className="h-8 w-20" /> : (
              <div className="text-2xl font-bold">{summary?.avgKpiScore?.toFixed(1) || 0}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Tasks</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loadingSummary ? <Skeleton className="h-8 w-20" /> : (
              <div className="text-2xl font-bold">{summary?.pendingTasks || 0}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Delayed Tasks</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            {loadingSummary ? <Skeleton className="h-8 w-20" /> : (
              <div className="text-2xl font-bold text-destructive">{summary?.delayedTasks || 0}</div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        {/* Department Performance Chart */}
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Department Performance</CardTitle>
            <CardDescription>Average KPI scores by department</CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            {loadingDept ? (
              <Skeleton className="h-[300px] w-full" />
            ) : deptPerformance?.length ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={deptPerformance}>
                  <XAxis dataKey="departmentName" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}`} />
                  <Tooltip cursor={{fill: 'transparent'}} contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))' }} />
                  <Bar dataKey="avgKpiScore" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">No data available</div>
            )}
          </CardContent>
        </Card>

        {/* Task Status Breakdown */}
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Task Status</CardTitle>
            <CardDescription>Current breakdown of all tasks</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingTasks ? (
              <Skeleton className="h-[300px] w-full" />
            ) : taskBreakdown?.length ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={taskBreakdown}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="count"
                    nameKey="status"
                  >
                    {taskBreakdown.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))' }} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">No data available</div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Top Performers */}
        <Card className="col-span-1 lg:col-span-1">
          <CardHeader>
            <CardTitle>Top Performers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {loadingTop ? (
                Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)
              ) : topPerformers?.length ? (
                topPerformers.map((employee) => (
                  <div key={employee.employeeId} className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium leading-none">{employee.employeeName}</p>
                      <p className="text-xs text-muted-foreground">{employee.departmentName}</p>
                    </div>
                    <Badge variant="secondary" className="font-bold">{employee.kpiScore.toFixed(1)}</Badge>
                  </div>
                ))
              ) : (
                <div className="text-sm text-muted-foreground">No top performers found</div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Overdue Tasks */}
        <Card className="col-span-1 lg:col-span-1">
          <CardHeader>
            <CardTitle>Overdue Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {loadingOverdue ? (
                Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)
              ) : overdueTasks?.length ? (
                overdueTasks.map((task) => (
                  <div key={task.id} className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium leading-none line-clamp-1" title={task.title}>{task.title}</p>
                      <p className="text-xs text-muted-foreground">{task.assignedToName}</p>
                    </div>
                    <Badge variant="destructive">Overdue</Badge>
                  </div>
                ))
              ) : (
                <div className="text-sm text-muted-foreground">No overdue tasks</div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="col-span-1 lg:col-span-1">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {loadingActivity ? (
                Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)
              ) : recentActivity?.length ? (
                recentActivity.map((activity) => (
                  <div key={activity.id} className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{activity.description}</p>
                    <div className="flex items-center text-xs text-muted-foreground">
                      <span className="font-medium mr-1">{activity.actorName}</span> • 
                      <span className="ml-1">{format(new Date(activity.createdAt), 'MMM d, h:mm a')}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-muted-foreground">No recent activity</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
