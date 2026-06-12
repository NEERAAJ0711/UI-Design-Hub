import { useState, useEffect, useRef } from "react";
import {
  useListKpis,
  useListEmployees,
  useListDepartments,
  useCreateKpi,
  useDeleteKpi,
  useCalculateKpiBatch,
  useGetScoreWeights,
  getListKpisQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Trash2, Star, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useAuth } from "@/contexts/auth-context";

const ratingConfig: Record<string, { label: string; className: string }> = {
  "Outstanding":          { label: "Outstanding",       className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300" },
  "Very Good":            { label: "Very Good",          className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" },
  "Good":                 { label: "Good",               className: "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300" },
  "Average":              { label: "Average",            className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300" },
  "Improvement Required": { label: "Needs Improvement",  className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" },
};

const currentYear = new Date().getFullYear();

type KpiRow = {
  id: number; employeeId: number; employeeName?: string | null; departmentId?: number; departmentName?: string | null;
  month: number; year: number; kraAchievement: number; taskCompletion: number;
  productivity: number; punctuality: number; discipline: number; totalScore: number; rating: string;
};

export default function KPIs() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const isEmployee = user?.role === "employee";
  const isHR = user?.departmentName?.toLowerCase().includes("hr") ?? false;
  const isHod = user?.role === "hod";
  const canSeeAll = user?.role === "admin" || isHR || user?.role === "management";
  // HODs who are not HR/admin/management are locked to their own department
  const forcedDeptId: number | null = isHod && !canSeeAll ? (user?.departmentId ?? null) : null;

  const kpiParams = isEmployee
    ? { employeeId: user!.id }
    : forcedDeptId != null
      ? { departmentId: forcedDeptId }
      : {};
  const { data: kpis, isLoading } = useListKpis(kpiParams, { query: { queryKey: getListKpisQueryKey(kpiParams), staleTime: 0, refetchOnMount: "always" } });
  const { data: employees } = useListEmployees();
  const { data: departments } = useListDepartments();
  const { data: scoreWeights } = useGetScoreWeights();
  const deleteKpi = useDeleteKpi();
  const { mutateAsync: calculateKpiBatchAsync } = useCalculateKpiBatch();

  const [deleteTarget, setDeleteTarget] = useState<KpiRow | null>(null);
  const [filterEmp, setFilterEmp] = useState("all");
  const [filterDept, setFilterDept] = useState("all");

  // Employees visible to this user (HOD = own dept only)
  const visibleEmployees = forcedDeptId != null
    ? employees?.filter((e) => e.departmentId === forcedDeptId)
    : employees;
  const hasAutoCalced = useRef(false);

  const w = scoreWeights ?? { kraWeight: 40, taskCompletionWeight: 30, productivityWeight: 15, punctualityWeight: 10, disciplineWeight: 5 };

  const [isRecalculating, setIsRecalculating] = useState(false);

  async function runBatchCalculate(silent = false) {
    const month = new Date().getMonth() + 1;
    const year = new Date().getFullYear();
    try {
      setIsRecalculating(true);
      const { saved } = await calculateKpiBatchAsync({ data: { month, year } });
      queryClient.invalidateQueries({ queryKey: getListKpisQueryKey(kpiParams) });
      if (!silent) toast({ title: `KPI scores recalculated for ${saved} employee(s)` });
    } catch {
      if (!silent) toast({ title: "Score recalculation failed", variant: "destructive" });
    } finally {
      setIsRecalculating(false);
    }
  }

  // Auto-calculate KPI scores on every page visit (batch is idempotent — uses upsert).
  useEffect(() => {
    if (isEmployee || hasAutoCalced.current) return;
    hasAutoCalced.current = true;
    runBatchCalculate(true);
  }, [isEmployee]);

  function confirmDelete() {
    if (!deleteTarget) return;
    deleteKpi.mutate({ id: deleteTarget.id }, {
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListKpisQueryKey(kpiParams) }); setDeleteTarget(null); toast({ title: "KPI record deleted" }); },
    });
  }

  const filtered = kpis?.filter((k) => {
    if (!isEmployee && filterEmp !== "all" && k.employeeId !== Number(filterEmp)) return false;
    if (!isEmployee && filterDept !== "all" && k.departmentId !== Number(filterDept)) return false;
    return true;
  });

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6 overflow-y-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{isEmployee ? "My Performance (KPIs)" : "KPI Records"}</h2>
          <p className="text-muted-foreground">
            {isEmployee ? "Your monthly performance evaluations and composite scores." : "Monthly performance evaluations and composite scores."}
          </p>
        </div>
        {!isEmployee && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => runBatchCalculate(false)}
            disabled={isRecalculating}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isRecalculating ? "animate-spin" : ""}`} />
            {isRecalculating ? "Recalculating…" : "Recalculate Scores"}
          </Button>
        )}
      </div>

      {/* Employee performance summary cards */}
      {isEmployee && kpis && kpis.length > 0 && (() => {
        const latest = [...kpis].sort((a, b) => b.year - a.year || b.month - a.month)[0];
        const rc = ratingConfig[latest.rating];
        return (
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><Star className="h-4 w-4 text-yellow-500" /> Latest KPI Score</CardTitle></CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-primary">{latest.totalScore.toFixed(1)}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{format(new Date(latest.year, latest.month - 1), "MMMM yyyy")}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Performance Rating</CardTitle></CardHeader>
              <CardContent>
                <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium ${rc?.className ?? ""}`}>{rc?.label ?? latest.rating}</span>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total Evaluations</CardTitle></CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{kpis.length}</div>
                <div className="text-xs text-muted-foreground mt-0.5">records on file</div>
              </CardContent>
            </Card>
          </div>
        );
      })()}

      {!isEmployee && (
        <div className="flex flex-wrap gap-3 items-center">
          {/* Dept filter — locked for HOD, otherwise free */}
          {forcedDeptId != null ? (
            <div className="flex items-center gap-1.5 rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground select-none">
              <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              {departments?.find((d) => d.id === forcedDeptId)?.name ?? "Your Department"}
            </div>
          ) : (
            <Select value={filterDept} onValueChange={(v) => { setFilterDept(v); setFilterEmp("all"); }}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="All Departments" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {departments?.map((d) => <SelectItem key={d.id} value={d.id.toString()}>{d.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}

          {/* Employee filter — scoped to selected department */}
          <Select value={filterEmp} onValueChange={setFilterEmp}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="All Employees" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Employees</SelectItem>
              {(forcedDeptId != null
                ? visibleEmployees
                : filterDept === "all"
                  ? employees
                  : employees?.filter((e) => e.departmentId === Number(filterDept))
              )?.map((e) => <SelectItem key={e.id} value={e.id.toString()}>{e.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                {!isEmployee && <TableHead>Employee</TableHead>}
                <TableHead>Period</TableHead>
                <TableHead className="text-right">KRA ({w.kraWeight}%)</TableHead>
                <TableHead className="text-right">Tasks ({w.taskCompletionWeight}%)</TableHead>
                <TableHead className="text-right">Prod ({w.productivityWeight}%)</TableHead>
                <TableHead className="text-right">Punct ({w.punctualityWeight}%)</TableHead>
                <TableHead className="text-right">Disc ({w.disciplineWeight}%)</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Rating</TableHead>
                {!isEmployee && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: isEmployee ? 8 : 10 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}
                  </TableRow>
                ))
              ) : filtered?.length ? (
                filtered.map((kpi) => {
                  const rc = ratingConfig[kpi.rating];
                  return (
                    <TableRow key={kpi.id}>
                      {!isEmployee && (
                        <TableCell className="font-medium">
                          <div><div>{kpi.employeeName}</div><div className="text-xs text-muted-foreground">{kpi.departmentName}</div></div>
                        </TableCell>
                      )}
                      <TableCell>{format(new Date(kpi.year, kpi.month - 1), "MMM yyyy")}</TableCell>
                      <TableCell className="text-right">{kpi.kraAchievement}%</TableCell>
                      <TableCell className="text-right">{kpi.taskCompletion}%</TableCell>
                      <TableCell className="text-right">{kpi.productivity}%</TableCell>
                      <TableCell className="text-right">{kpi.punctuality}%</TableCell>
                      <TableCell className="text-right">{kpi.discipline}%</TableCell>
                      <TableCell className="text-right font-bold text-primary">{kpi.totalScore.toFixed(1)}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${rc?.className ?? ""}`}>
                          {rc?.label ?? kpi.rating}
                        </span>
                      </TableCell>
                      {!isEmployee && (
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem className="text-destructive" onClick={() => setDeleteTarget(kpi)}>
                                <Trash2 className="mr-2 h-4 w-4" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={isEmployee ? 8 : 10} className="h-24 text-center text-muted-foreground">
                    {isEmployee ? "No KPI evaluations on record yet." : "No KPI records found."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete KPI record?</AlertDialogTitle>
            <AlertDialogDescription>Delete the KPI record for <strong>{deleteTarget?.employeeName}</strong>?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
