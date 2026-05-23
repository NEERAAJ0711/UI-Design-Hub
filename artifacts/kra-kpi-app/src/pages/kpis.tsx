import { useState } from "react";
import {
  useListKpis,
  useListEmployees,
  useListDepartments,
  useCreateKpi,
  useDeleteKpi,
  useCalculateKpi,
  useGetScoreWeights,
  getListKpisQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, MoreHorizontal, Trash2, Star, Wand2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useAuth } from "@/contexts/auth-context";

const MONTHS = [
  { value: 1, label: "January" }, { value: 2, label: "February" }, { value: 3, label: "March" },
  { value: 4, label: "April" }, { value: 5, label: "May" }, { value: 6, label: "June" },
  { value: 7, label: "July" }, { value: 8, label: "August" }, { value: 9, label: "September" },
  { value: 10, label: "October" }, { value: 11, label: "November" }, { value: 12, label: "December" },
];

const scoreField = z.number().min(0).max(100);
const kpiSchema = z.object({
  employeeId: z.number({ required_error: "Employee required" }),
  month: z.number({ required_error: "Month required" }),
  year: z.number({ required_error: "Year required" }),
  kraAchievement: scoreField,
  taskCompletion: scoreField,
  productivity: scoreField,
  punctuality: scoreField,
  discipline: scoreField,
});
type KpiFormData = z.infer<typeof kpiSchema>;

const ratingConfig: Record<string, { label: string; className: string }> = {
  "Outstanding":          { label: "Outstanding",       className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300" },
  "Very Good":            { label: "Very Good",          className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" },
  "Good":                 { label: "Good",               className: "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300" },
  "Average":              { label: "Average",            className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300" },
  "Improvement Required": { label: "Needs Improvement",  className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" },
};

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => currentYear - i);

function ScoreInput({ label, name, form }: { label: string; name: keyof KpiFormData; form: ReturnType<typeof useForm<KpiFormData>> }) {
  return (
    <FormField control={form.control} name={name} render={({ field }) => (
      <FormItem>
        <FormLabel className="text-xs">{label}</FormLabel>
        <FormControl>
          <div className="flex items-center gap-2">
            <Input type="number" min={0} max={100} {...field} onChange={(e) => field.onChange(Number(e.target.value))} className="w-20" />
            <span className="text-sm text-muted-foreground">/ 100</span>
          </div>
        </FormControl>
        <FormMessage />
      </FormItem>
    )} />
  );
}

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

  const kpiParams = isEmployee ? { employeeId: user!.id } : {};
  const { data: kpis, isLoading } = useListKpis(kpiParams, { query: { queryKey: getListKpisQueryKey(kpiParams) } });
  const { data: employees } = useListEmployees();
  const { data: departments } = useListDepartments();
  const { data: scoreWeights } = useGetScoreWeights();
  const createKpi = useCreateKpi();
  const deleteKpi = useDeleteKpi();
  const calculateKpi = useCalculateKpi();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<KpiRow | null>(null);
  const [filterEmp, setFilterEmp] = useState("all");
  const [filterDept, setFilterDept] = useState("all");

  const form = useForm<KpiFormData>({
    resolver: zodResolver(kpiSchema),
    defaultValues: { month: new Date().getMonth() + 1, year: currentYear, kraAchievement: 0, taskCompletion: 0, productivity: 0, punctuality: 0, discipline: 0 },
  });

  function onSubmit(values: KpiFormData) {
    createKpi.mutate({ data: values }, {
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListKpisQueryKey(kpiParams) }); setDialogOpen(false); toast({ title: "KPI record saved" }); },
    });
  }

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

  const watched = form.watch();
  const w = scoreWeights ?? { kraWeight: 40, taskCompletionWeight: 30, productivityWeight: 15, punctualityWeight: 10, disciplineWeight: 5 };
  const previewScore =
    watched.kraAchievement * (w.kraWeight / 100) +
    watched.taskCompletion * (w.taskCompletionWeight / 100) +
    watched.productivity * (w.productivityWeight / 100) +
    watched.punctuality * (w.punctualityWeight / 100) +
    watched.discipline * (w.disciplineWeight / 100);

  function handleAutoCalculate() {
    const empId = form.getValues("employeeId");
    const month = form.getValues("month");
    const year = form.getValues("year");
    if (!empId) { toast({ title: "Select an employee first", variant: "destructive" }); return; }
    calculateKpi.mutate({ data: { employeeId: empId, month, year } }, {
      onSuccess: (result) => {
        form.setValue("kraAchievement", result.kraAchievement);
        form.setValue("taskCompletion", result.taskCompletion);
        toast({ title: "Auto-calculated from KRA & Task data", description: `KRA: ${result.kraAchievement}%  ·  Tasks: ${result.taskCompletion}%` });
      },
      onError: () => toast({ title: "Could not auto-calculate", variant: "destructive" }),
    });
  }

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
          <Button onClick={() => { form.reset(); setDialogOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" /> Evaluate KPI
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
        <div className="flex flex-wrap gap-3">
          <Select value={filterEmp} onValueChange={setFilterEmp}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="All Employees" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Employees</SelectItem>
              {employees?.map((e) => <SelectItem key={e.id} value={e.id.toString()}>{e.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterDept} onValueChange={setFilterDept}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="All Departments" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {departments?.map((d) => <SelectItem key={d.id} value={d.id.toString()}>{d.name}</SelectItem>)}
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
                <TableHead className="text-right">KRA (40%)</TableHead>
                <TableHead className="text-right">Tasks (30%)</TableHead>
                <TableHead className="text-right">Prod (15%)</TableHead>
                <TableHead className="text-right">Punct (10%)</TableHead>
                <TableHead className="text-right">Disc (5%)</TableHead>
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

      {!isEmployee && (
        <>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Evaluate Employee KPI</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <FormField control={form.control} name="employeeId" render={({ field }) => (
                      <FormItem className="col-span-3"><FormLabel>Employee</FormLabel>
                        <Select value={field.value?.toString() ?? ""} onValueChange={(v) => field.onChange(Number(v))}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger></FormControl>
                          <SelectContent>{employees?.map((e) => <SelectItem key={e.id} value={e.id.toString()}>{e.name}</SelectItem>)}</SelectContent>
                        </Select><FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="month" render={({ field }) => (
                      <FormItem className="col-span-2"><FormLabel>Month</FormLabel>
                        <Select value={field.value?.toString() ?? ""} onValueChange={(v) => field.onChange(Number(v))}>
                          <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>{MONTHS.map((m) => <SelectItem key={m.value} value={m.value.toString()}>{m.label}</SelectItem>)}</SelectContent>
                        </Select><FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="year" render={({ field }) => (
                      <FormItem><FormLabel>Year</FormLabel>
                        <Select value={field.value?.toString() ?? ""} onValueChange={(v) => field.onChange(Number(v))}>
                          <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>{YEARS.map((y) => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}</SelectContent>
                        </Select><FormMessage />
                      </FormItem>
                    )} />
                  </div>

                  {/* Auto-calculate banner */}
                  <div className="flex items-center gap-3 rounded-lg border border-dashed border-blue-300 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800 px-3 py-2">
                    <Wand2 className="h-4 w-4 text-blue-500 shrink-0" />
                    <div className="flex-1 text-xs text-blue-700 dark:text-blue-300">
                      Auto-fill KRA achievement &amp; task completion from actual records
                    </div>
                    <Button
                      type="button" size="sm" variant="outline"
                      className="h-7 text-xs border-blue-300 text-blue-700 hover:bg-blue-100 dark:text-blue-300 dark:border-blue-700"
                      disabled={calculateKpi.isPending}
                      onClick={handleAutoCalculate}
                    >
                      {calculateKpi.isPending ? "Calculating…" : "Auto-Calculate"}
                    </Button>
                  </div>

                  <div className="rounded-lg border p-4 space-y-3">
                    <div className="text-sm font-medium text-muted-foreground mb-1">Score Components</div>
                    <div className="grid grid-cols-2 gap-3">
                      <ScoreInput label={`KRA Achievement (${w.kraWeight}%)`} name="kraAchievement" form={form} />
                      <ScoreInput label={`Task Completion (${w.taskCompletionWeight}%)`} name="taskCompletion" form={form} />
                      <ScoreInput label={`Productivity (${w.productivityWeight}%)`} name="productivity" form={form} />
                      <ScoreInput label={`Punctuality (${w.punctualityWeight}%)`} name="punctuality" form={form} />
                      <ScoreInput label={`Discipline (${w.disciplineWeight}%)`} name="discipline" form={form} />
                    </div>
                  </div>
                  <div className="rounded-lg bg-muted p-3 flex items-center justify-between">
                    <span className="text-sm font-medium">Calculated Total Score</span>
                    <span className="text-lg font-bold text-primary">{previewScore.toFixed(1)}</span>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                    <Button type="submit" disabled={createKpi.isPending}>Save KPI Record</Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>

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
        </>
      )}
    </div>
  );
}
