import { useState } from "react";
import {
  useListKpis,
  useListEmployees,
  useListDepartments,
  useCreateKpi,
  useDeleteKpi,
  getListKpisQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Plus, MoreHorizontal, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

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
  "Outstanding":          { label: "Outstanding",          className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300" },
  "Very Good":            { label: "Very Good",            className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" },
  "Good":                 { label: "Good",                 className: "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300" },
  "Average":              { label: "Average",              className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300" },
  "Improvement Required": { label: "Needs Improvement",    className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" },
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
            <Input
              type="number"
              min={0}
              max={100}
              {...field}
              onChange={(e) => field.onChange(Number(e.target.value))}
              className="w-20"
              data-testid={`input-kpi-${name}`}
            />
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
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: kpis, isLoading } = useListKpis();
  const { data: employees } = useListEmployees();
  const { data: departments } = useListDepartments();
  const createKpi = useCreateKpi();
  const deleteKpi = useDeleteKpi();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<KpiRow | null>(null);
  const [filterEmp, setFilterEmp] = useState("all");
  const [filterDept, setFilterDept] = useState("all");

  const form = useForm<KpiFormData>({
    resolver: zodResolver(kpiSchema),
    defaultValues: {
      month: new Date().getMonth() + 1,
      year: currentYear,
      kraAchievement: 0,
      taskCompletion: 0,
      productivity: 0,
      punctuality: 0,
      discipline: 0,
    },
  });

  function onSubmit(values: KpiFormData) {
    createKpi.mutate({ data: values }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListKpisQueryKey() });
        setDialogOpen(false);
        toast({ title: "KPI record saved" });
      },
    });
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    deleteKpi.mutate({ id: deleteTarget.id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListKpisQueryKey() });
        setDeleteTarget(null);
        toast({ title: "KPI record deleted" });
      },
    });
  }

  const filtered = kpis?.filter((k) => {
    if (filterEmp !== "all" && k.employeeId !== Number(filterEmp)) return false;
    if (filterDept !== "all" && k.departmentId !== Number(filterDept)) return false;
    return true;
  });

  // Preview score calculation
  const watched = form.watch();
  const previewScore =
    watched.kraAchievement * 0.4 +
    watched.taskCompletion * 0.3 +
    watched.productivity * 0.15 +
    watched.punctuality * 0.1 +
    watched.discipline * 0.05;

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6 overflow-y-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">KPI Records</h2>
          <p className="text-muted-foreground">Monthly performance evaluations and composite scores.</p>
        </div>
        <Button data-testid="button-evaluate-kpi" onClick={() => { form.reset(); setDialogOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" /> Evaluate KPI
        </Button>
      </div>

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

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Period</TableHead>
                <TableHead className="text-right">KRA (40%)</TableHead>
                <TableHead className="text-right">Tasks (30%)</TableHead>
                <TableHead className="text-right">Prod (15%)</TableHead>
                <TableHead className="text-right">Punct (10%)</TableHead>
                <TableHead className="text-right">Disc (5%)</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 10 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : filtered?.length ? (
                filtered.map((kpi) => {
                  const rc = ratingConfig[kpi.rating];
                  return (
                    <TableRow key={kpi.id} data-testid={`row-kpi-${kpi.id}`}>
                      <TableCell className="font-medium">
                        <div>
                          <div>{kpi.employeeName}</div>
                          <div className="text-xs text-muted-foreground">{kpi.departmentName}</div>
                        </div>
                      </TableCell>
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
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" data-testid={`button-actions-kpi-${kpi.id}`}>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem className="text-destructive" onClick={() => setDeleteTarget(kpi)}>
                              <Trash2 className="mr-2 h-4 w-4" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={10} className="h-24 text-center text-muted-foreground">
                    No KPI records found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Evaluate Employee KPI</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <FormField control={form.control} name="employeeId" render={({ field }) => (
                  <FormItem className="col-span-3">
                    <FormLabel>Employee</FormLabel>
                    <Select value={field.value?.toString() ?? ""} onValueChange={(v) => field.onChange(Number(v))}>
                      <FormControl>
                        <SelectTrigger data-testid="select-kpi-employee">
                          <SelectValue placeholder="Select employee" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {employees?.map((e) => <SelectItem key={e.id} value={e.id.toString()}>{e.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="month" render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Month</FormLabel>
                    <Select value={field.value?.toString() ?? ""} onValueChange={(v) => field.onChange(Number(v))}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        {MONTHS.map((m) => <SelectItem key={m.value} value={m.value.toString()}>{m.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="year" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Year</FormLabel>
                    <Select value={field.value?.toString() ?? ""} onValueChange={(v) => field.onChange(Number(v))}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        {YEARS.map((y) => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <div className="rounded-lg border p-4 space-y-3">
                <div className="text-sm font-medium text-muted-foreground mb-1">Score Components</div>
                <div className="grid grid-cols-2 gap-3">
                  <ScoreInput label="KRA Achievement (40%)" name="kraAchievement" form={form} />
                  <ScoreInput label="Task Completion (30%)" name="taskCompletion" form={form} />
                  <ScoreInput label="Productivity (15%)" name="productivity" form={form} />
                  <ScoreInput label="Punctuality (10%)" name="punctuality" form={form} />
                  <ScoreInput label="Discipline (5%)" name="discipline" form={form} />
                </div>
              </div>

              <div className="rounded-lg bg-muted p-3 flex items-center justify-between">
                <span className="text-sm font-medium">Calculated Total Score</span>
                <span className="text-lg font-bold text-primary">{previewScore.toFixed(1)}</span>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button type="submit" data-testid="button-submit-kpi" disabled={createKpi.isPending}>
                  Save KPI Record
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete KPI record?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete the KPI record for <strong>{deleteTarget?.employeeName}</strong>.
            </AlertDialogDescription>
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
