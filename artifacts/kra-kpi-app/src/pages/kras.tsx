import { useState } from "react";
import {
  useListKras,
  useListDepartments,
  useListEmployees,
  useCreateKra,
  useUpdateKra,
  useDeleteKra,
  useScoreKra,
  useSubmitKraForClosure,
  useApproveKraClosure,
  useGetPendingApprovals,
  getListKrasQueryKey,
  getGetPendingApprovalsQueryKey,
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
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { Plus, MoreHorizontal, Pencil, Trash2, Star, Send, CheckCircle2, XCircle, Bell } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";

const PERIODS = ["monthly", "quarterly", "yearly"] as const;

const kraStatusColors: Record<string, string> = {
  active: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  submitted: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  manager_approved: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  approved: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

const kraSchema = z.object({
  title: z.string().min(1, "Title required"),
  description: z.string().optional(),
  weightage: z.number({ required_error: "Weightage required" }).min(0).max(100),
  departmentId: z.number({ required_error: "Department required" }),
  employeeId: z.number().optional(),
  reviewPeriod: z.enum(PERIODS),
});
type KraForm = z.infer<typeof kraSchema>;

const scoreSchema = z.object({ achievementPct: z.number().min(0).max(100) });
type ScoreForm = z.infer<typeof scoreSchema>;

type KraRow = {
  id: number; title: string; description?: string | null; weightage: number; achievementPct?: number | null;
  departmentId: number; departmentName?: string | null; employeeId?: number | null; employeeName?: string | null; reviewPeriod?: string | null;
  kraStatus: string; submittedAt?: string | null; closedAt?: string | null;
};

export default function KRAs() {
  const { user } = useAuth();
  if (user?.role === "employee") return <EmployeeKras />;
  return <FullKras />;
}

// ── Employee KRA View ──────────────────────────────────────────────────────────
function EmployeeKras() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: kras, isLoading } = useListKras(
    { employeeId: user!.id },
    { query: { queryKey: getListKrasQueryKey({ employeeId: user!.id }) } }
  );
  const submitKra = useSubmitKraForClosure();
  const [confirmSubmitId, setConfirmSubmitId] = useState<number | null>(null);

  function handleSubmit() {
    if (!confirmSubmitId) return;
    submitKra.mutate({ id: confirmSubmitId }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListKrasQueryKey({ employeeId: user!.id }) });
        setConfirmSubmitId(null);
        toast({ title: "KRA submitted for closure — awaiting manager approval." });
      },
    });
  }

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6 overflow-y-auto">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">My Key Result Areas</h2>
        <p className="text-muted-foreground">Your assigned KRAs. Submit for closure once achieved — requires manager and HOD approval.</p>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>KRA Title</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Weightage</TableHead>
                <TableHead className="w-[200px]">Achievement</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    {[200, 80, 60, 200, 100, 80].map((w, j) => <TableCell key={j}><Skeleton className={`h-4 w-[${w}px]`} /></TableCell>)}
                  </TableRow>
                ))
              ) : kras?.length ? (
                kras.map((kra) => (
                  <TableRow key={kra.id}>
                    <TableCell className="font-medium">
                      <div>
                        <div>{kra.title}</div>
                        {kra.description && <div className="text-xs text-muted-foreground truncate max-w-[200px]">{kra.description}</div>}
                        <div className="text-xs text-muted-foreground">{kra.departmentName}</div>
                      </div>
                    </TableCell>
                    <TableCell className="capitalize">{kra.reviewPeriod}</TableCell>
                    <TableCell>{kra.weightage}%</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={kra.achievementPct ?? 0} className="flex-1 h-1.5" />
                        <span className="text-xs font-medium w-9 text-right">{kra.achievementPct ?? 0}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${kraStatusColors[kra.kraStatus] ?? ""}`}>
                        {kra.kraStatus.replace("_", " ")}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {kra.kraStatus === "active" && (
                        <Button size="sm" variant="outline" onClick={() => setConfirmSubmitId(kra.id)}>
                          <Send className="mr-1.5 h-3.5 w-3.5" /> Submit for Closure
                        </Button>
                      )}
                      {kra.kraStatus === "submitted" && (
                        <span className="text-xs text-yellow-600 font-medium">Awaiting Manager</span>
                      )}
                      {kra.kraStatus === "manager_approved" && (
                        <span className="text-xs text-orange-600 font-medium">Awaiting HOD</span>
                      )}
                      {kra.kraStatus === "approved" && (
                        <span className="text-xs text-green-600 font-medium">✓ Closed</span>
                      )}
                      {kra.kraStatus === "rejected" && (
                        <Button size="sm" variant="outline" onClick={() => setConfirmSubmitId(kra.id)}>
                          <Send className="mr-1.5 h-3.5 w-3.5" /> Resubmit
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">No KRAs assigned to you yet.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AlertDialog open={!!confirmSubmitId} onOpenChange={(open) => !open && setConfirmSubmitId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit KRA for Closure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will send a closure request to your manager for review. Once approved by both Manager and HOD, the KRA will be marked as closed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSubmit} disabled={submitKra.isPending}>Submit for Closure</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Full KRA View (Manager/HOD/Management) ─────────────────────────────────────
function FullKras() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const deptFilter = user?.role === "hod" ? { departmentId: user.departmentId ?? undefined } : {};
  const approvalParams = { departmentId: user?.departmentId ?? undefined, role: user?.role };

  const { data: kras, isLoading } = useListKras(deptFilter, { query: { queryKey: getListKrasQueryKey(deptFilter) } });
  const { data: pendingData } = useGetPendingApprovals(approvalParams);
  const { data: departments } = useListDepartments();
  const { data: employees } = useListEmployees();

  const createKra = useCreateKra();
  const updateKra = useUpdateKra();
  const deleteKra = useDeleteKra();
  const scoreKra = useScoreKra();
  const approveKra = useApproveKraClosure();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<KraRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<KraRow | null>(null);
  const [scoreTarget, setScoreTarget] = useState<KraRow | null>(null);
  const [filterDept, setFilterDept] = useState("all");

  const form = useForm<KraForm>({
    resolver: zodResolver(kraSchema),
    defaultValues: { title: "", description: "", weightage: 20, reviewPeriod: "monthly" },
  });
  const scoreForm = useForm<ScoreForm>({ resolver: zodResolver(scoreSchema), defaultValues: { achievementPct: 0 } });

  const selectedDeptId = form.watch("departmentId");
  const deptEmployees = employees?.filter((e) => selectedDeptId ? e.departmentId === selectedDeptId : true);

  const pendingKraApprovals = pendingData?.kras ?? [];

  function openCreate() {
    setEditTarget(null);
    form.reset({
      title: "", description: "", weightage: 20, reviewPeriod: "monthly",
      departmentId: user?.role === "hod" ? (user.departmentId ?? undefined) : undefined,
    });
    setDialogOpen(true);
  }

  function openEdit(kra: KraRow) {
    setEditTarget(kra);
    form.reset({
      title: kra.title,
      description: kra.description ?? "",
      weightage: kra.weightage,
      departmentId: kra.departmentId,
      employeeId: kra.employeeId ?? undefined,
      reviewPeriod: kra.reviewPeriod as typeof PERIODS[number],
    });
    setDialogOpen(true);
  }

  function onSubmit(values: KraForm) {
    const payload = { ...values, description: values.description || undefined, employeeId: values.employeeId || undefined };
    if (editTarget) {
      updateKra.mutate({ id: editTarget.id, data: payload }, {
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListKrasQueryKey(deptFilter) }); setDialogOpen(false); toast({ title: "KRA updated" }); },
      });
    } else {
      createKra.mutate({ data: payload }, {
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListKrasQueryKey(deptFilter) }); setDialogOpen(false); toast({ title: "KRA created" }); },
      });
    }
  }

  function onScoreSubmit(values: ScoreForm) {
    if (!scoreTarget) return;
    scoreKra.mutate({ id: scoreTarget.id, data: values }, {
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListKrasQueryKey(deptFilter) }); setScoreTarget(null); toast({ title: "Achievement score updated" }); },
    });
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    deleteKra.mutate({ id: deleteTarget.id }, {
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListKrasQueryKey(deptFilter) }); setDeleteTarget(null); toast({ title: "KRA deleted" }); },
    });
  }

  function handleKraApproval(id: number, approved: boolean) {
    approveKra.mutate({ id, data: { approved } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListKrasQueryKey(deptFilter) });
        queryClient.invalidateQueries({ queryKey: getGetPendingApprovalsQueryKey(approvalParams) });
        toast({ title: approved ? "KRA closure approved" : "KRA closure rejected" });
      },
    });
  }

  const filtered = kras?.filter((k) => filterDept === "all" || k.departmentId === Number(filterDept));

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6 overflow-y-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Key Result Areas (KRAs)</h2>
          <p className="text-muted-foreground">Define responsibilities and measure achievement progress.</p>
        </div>
        <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> Add KRA</Button>
      </div>

      {/* Pending KRA Approvals */}
      {pendingKraApprovals.length > 0 && (
        <Card className="border-orange-200 bg-orange-50/50 dark:bg-orange-950/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Bell className="h-4 w-4 text-orange-500" /> {pendingKraApprovals.length} KRA Closure Request{pendingKraApprovals.length > 1 ? "s" : ""} Pending
            </CardTitle>
            <CardDescription className="text-xs">
              {user?.role === "hod" ? "Review submissions and manager-approved KRAs for final closure." : "Review and forward these to HOD for final approval."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pendingKraApprovals.map((kra) => (
                <div key={kra.id} className="flex items-center justify-between p-2.5 rounded-lg border bg-card">
                  <div>
                    <p className="text-sm font-medium">{kra.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-xs text-muted-foreground">{kra.employeeName} · {kra.departmentName}</p>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${kraStatusColors[kra.kraStatus] ?? ""}`}>
                        {kra.kraStatus.replace("_", " ")}
                      </span>
                    </div>
                    {kra.achievementPct != null && <p className="text-xs text-muted-foreground">Achievement: {kra.achievementPct}%</p>}
                  </div>
                  <div className="flex gap-2 ml-3">
                    <Button size="sm" variant="outline" className="text-green-600 border-green-200 h-7 px-2" onClick={() => handleKraApproval(kra.id, true)}>
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> {user?.role === "hod" && kra.kraStatus === "manager_approved" ? "Final Approve" : "Approve"}
                    </Button>
                    <Button size="sm" variant="outline" className="text-red-600 border-red-200 h-7 px-2" onClick={() => handleKraApproval(kra.id, false)}>
                      <XCircle className="h-3.5 w-3.5 mr-1" /> Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {user?.role !== "hod" && (
        <div className="flex gap-3">
          <Select value={filterDept} onValueChange={setFilterDept}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="All Departments" /></SelectTrigger>
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
                <TableHead>Title</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Assignee</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Weightage</TableHead>
                <TableHead className="w-[180px]">Achievement</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {[200, 120, 120, 80, 60, 180, 100, 50].map((w, j) => <TableCell key={j}><Skeleton className={`h-4 w-[${w}px]`} /></TableCell>)}
                  </TableRow>
                ))
              ) : filtered?.length ? (
                filtered.map((kra) => (
                  <TableRow key={kra.id}>
                    <TableCell className="font-medium">
                      <div>
                        <div>{kra.title}</div>
                        {kra.description && <div className="text-xs text-muted-foreground truncate max-w-[200px]">{kra.description}</div>}
                      </div>
                    </TableCell>
                    <TableCell>{kra.departmentName}</TableCell>
                    <TableCell>{kra.employeeName || <span className="text-muted-foreground text-sm">Dept-wide</span>}</TableCell>
                    <TableCell className="capitalize">{kra.reviewPeriod}</TableCell>
                    <TableCell>{kra.weightage}%</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={kra.achievementPct ?? 0} className="flex-1 h-1.5" />
                        <span className="text-xs font-medium w-9 text-right">{kra.achievementPct ?? 0}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${kraStatusColors[kra.kraStatus] ?? ""}`}>
                        {kra.kraStatus.replace("_", " ")}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => { setScoreTarget(kra); scoreForm.reset({ achievementPct: kra.achievementPct ?? 0 }); }}>
                            <Star className="mr-2 h-4 w-4" /> Update Score
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => openEdit(kra)}>
                            <Pencil className="mr-2 h-4 w-4" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => setDeleteTarget(kra)}>
                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">No KRAs found.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editTarget ? "Edit KRA" : "Add KRA"}</DialogTitle></DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="title" render={({ field }) => (
                <FormItem><FormLabel>Title</FormLabel><FormControl><Input placeholder="e.g. Compliance Work" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea placeholder="Describe this KRA..." {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="weightage" render={({ field }) => (
                  <FormItem><FormLabel>Weightage (%)</FormLabel>
                    <FormControl><Input type="number" min={0} max={100} {...field} onChange={(e) => field.onChange(Number(e.target.value))} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="reviewPeriod" render={({ field }) => (
                  <FormItem><FormLabel>Review Period</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>{PERIODS.map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}</SelectContent>
                    </Select><FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="departmentId" render={({ field }) => (
                  <FormItem><FormLabel>Department</FormLabel>
                    <Select
                      value={field.value?.toString() ?? ""}
                      onValueChange={(v) => {
                        field.onChange(Number(v));
                        form.setValue("employeeId", undefined);
                      }}
                    >
                      <FormControl><SelectTrigger><SelectValue placeholder="Select dept." /></SelectTrigger></FormControl>
                      <SelectContent>{departments?.map((d) => <SelectItem key={d.id} value={d.id.toString()}>{d.name}</SelectItem>)}</SelectContent>
                    </Select><FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="employeeId" render={({ field }) => (
                  <FormItem><FormLabel>Assign to Employee</FormLabel>
                    <Select value={field.value?.toString() ?? ""} onValueChange={(v) => field.onChange(v === "dept-wide" ? undefined : Number(v))}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={selectedDeptId ? "Dept-wide" : "Select a department first"} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="dept-wide">Dept-wide</SelectItem>
                        {deptEmployees?.map((e) => <SelectItem key={e.id} value={e.id.toString()}>{e.name}</SelectItem>)}
                      </SelectContent>
                    </Select><FormMessage />
                  </FormItem>
                )} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createKra.isPending || updateKra.isPending}>{editTarget ? "Save Changes" : "Create KRA"}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!scoreTarget} onOpenChange={(open) => !open && setScoreTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Update Achievement Score</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{scoreTarget?.title}</p>
          <Form {...scoreForm}>
            <form onSubmit={scoreForm.handleSubmit(onScoreSubmit)} className="space-y-4">
              <FormField control={scoreForm.control} name="achievementPct" render={({ field }) => (
                <FormItem><FormLabel>Achievement (%)</FormLabel>
                  <FormControl><Input type="number" min={0} max={100} {...field} onChange={(e) => field.onChange(Number(e.target.value))} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setScoreTarget(null)}>Cancel</Button>
                <Button type="submit" disabled={scoreKra.isPending}>Update Score</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete KRA?</AlertDialogTitle>
            <AlertDialogDescription>Permanently delete <strong>{deleteTarget?.title}</strong>?</AlertDialogDescription>
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
