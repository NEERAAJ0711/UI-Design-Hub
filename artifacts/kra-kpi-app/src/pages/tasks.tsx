import { useState } from "react";
import { useLocation } from "wouter";
import {
  useListTasks,
  useListEmployees,
  useListDepartments,
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
  useUpdateTaskStatus,
  useRequestTaskStatus,
  useApproveTaskStatus,
  useGetPendingApprovals,
  getListTasksQueryKey,
  getGetTaskQueryKey,
  getGetPendingApprovalsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Plus, Eye, Pencil, Trash2, RefreshCw, Repeat, CheckCircle2, XCircle, Bell, Clock, Send } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useAuth } from "@/contexts/auth-context";

const STATUSES = ["pending", "in_progress", "completed", "delayed", "approved", "rejected", "closed"] as const;
const EMPLOYEE_REQUESTABLE = ["in_progress", "completed", "delayed"] as const;
const PRIORITIES = ["high", "medium", "low"] as const;
const FREQS = ["daily", "weekly", "monthly", "quarterly", "yearly"] as const;

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  in_progress: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  completed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  delayed: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  approved: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  rejected: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
  awaiting_hod_approval: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  closed: "bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-300",
};

const priorityColors: Record<string, string> = {
  high: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  medium: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  low: "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300",
};

const taskSchema = z.object({
  title: z.string().min(1, "Title required"),
  description: z.string().optional(),
  priority: z.enum(PRIORITIES),
  dueDate: z.string().optional(),
  createdById: z.number({ required_error: "Creator required" }),
  assignedToId: z.number({ required_error: "Assignee required" }),
  departmentId: z.number({ required_error: "Department required" }),
  isRecurring: z.boolean().default(false),
  recurringFreq: z.enum(FREQS).optional(),
});
type TaskFormData = z.infer<typeof taskSchema>;


type TaskRow = {
  id: number; title: string; description?: string | null; status: string; requestedStatus?: string | null; priority: string; dueDate?: string | null;
  assignedToId: number; assignedToName?: string | null; createdById: number; createdByName?: string | null;
  departmentId: number; departmentName?: string | null; isRecurring?: boolean | null; recurringFreq?: string | null; progressPct?: number | null; createdAt: string;
};

export default function Tasks() {
  const { user } = useAuth();
  if (user?.role === "employee") return <EmployeeTasks />;
  return <FullTasks />;
}

// ── Employee View ─────────────────────────────────────────────────────────────
function EmployeeTasks() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();

  const assignedParams = { assignedToId: user!.id };
  const createdParams = { createdById: user!.id };

  const { data: assignedTasks, isLoading: loadingAssigned } = useListTasks(
    assignedParams,
    { query: { queryKey: getListTasksQueryKey(assignedParams) } }
  );
  const { data: createdTasks, isLoading: loadingCreated } = useListTasks(
    createdParams,
    { query: { queryKey: getListTasksQueryKey(createdParams) } }
  );
  const isLoading = loadingAssigned || loadingCreated;

  // Merge assigned + created, deduplicate by id, tag each with viewer role
  // Exclude tasks still awaiting another dept's HOD approval — employee sees them only after approval
  const tasks = (() => {
    const map = new Map<number, NonNullable<typeof assignedTasks>[number] & { myRole: "assignee" | "creator" | "both" }>();
    for (const t of assignedTasks ?? []) {
      if (t.status === "awaiting_hod_approval") continue;
      map.set(t.id, { ...t, myRole: "assignee" });
    }
    for (const t of createdTasks ?? []) {
      const existing = map.get(t.id);
      if (existing) existing.myRole = "both";
      else map.set(t.id, { ...t, myRole: "creator" });
    }
    return [...map.values()].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  })();

  const requestStatus = useRequestTaskStatus();
  const updateStatus = useUpdateTaskStatus();

  function changeStatus(taskId: number, status: string, opts?: { approverId?: number; approvalRemarks?: string }) {
    updateStatus.mutate({ id: taskId, data: { status: status as typeof STATUSES[number], approverId: opts?.approverId, approvalRemarks: opts?.approvalRemarks } }, {
      onSuccess: () => {
        invalidateTasks();
        queryClient.invalidateQueries({ queryKey: getGetTaskQueryKey(taskId) });
        toast({ title: `Status updated to ${status.replace(/_/g, " ")}` });
      },
    });
  }

  const [filterStatus, setFilterStatus] = useState("all");
  const [filterRole, setFilterRole] = useState<"all" | "assignee" | "creator">("all");
  const [requestStatusDialog, setRequestStatusDialog] = useState<{ id: number; title: string } | null>(null);
  const [requestedNewStatus, setRequestedNewStatus] = useState<string>("in_progress");
  const [progressInput, setProgressInput] = useState(0);

  const filtered = tasks.filter((t) => {
    if (filterStatus !== "all" && t.status !== filterStatus) return false;
    if (filterRole === "assignee" && t.myRole === "creator") return false;
    if (filterRole === "creator" && t.myRole === "assignee") return false;
    return true;
  });

  function invalidateTasks() {
    queryClient.invalidateQueries({ queryKey: getListTasksQueryKey(assignedParams) });
    queryClient.invalidateQueries({ queryKey: getListTasksQueryKey(createdParams) });
  }

  function submitStatusRequest() {
    if (!requestStatusDialog) return;
    requestStatus.mutate({ id: requestStatusDialog.id, data: { status: requestedNewStatus as typeof EMPLOYEE_REQUESTABLE[number], progressPct: progressInput } }, {
      onSuccess: () => {
        invalidateTasks();
        setRequestStatusDialog(null);
        toast({ title: "Status change requested — awaiting manager approval." });
      },
    });
  }

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6 overflow-y-auto">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">My Tasks</h2>
        <p className="text-muted-foreground">Tasks assigned to you or created by you.</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="All Statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s.replace("_", " ")}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterRole} onValueChange={(v) => setFilterRole(v as typeof filterRole)}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="All Roles" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="assignee">Assigned to Me</SelectItem>
            <SelectItem value="creator">Created by Me</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Task</TableHead>
                <TableHead>My Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {[250, 90, 100, 80, 120, 100, 50].map((w, j) => <TableCell key={j}><Skeleton className={`h-4 w-[${w}px]`} /></TableCell>)}
                  </TableRow>
                ))
              ) : filtered?.length ? (
                filtered.map((task) => (
                  <TableRow key={task.id} className="cursor-pointer" onClick={() => navigate(`/tasks/${task.id}`)}>
                    <TableCell className="font-medium" onClick={(e) => e.stopPropagation()}>
                      <div>
                        <div className="flex items-center gap-1.5">
                          {task.isRecurring && <Repeat className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                          <button className="text-left hover:underline font-medium" onClick={() => navigate(`/tasks/${task.id}`)}>{task.title}</button>
                        </div>
                        <div className="text-xs text-muted-foreground">{task.departmentName}</div>
                        {task.requestedStatus && (
                          <div className="flex items-center gap-1 mt-0.5">
                            <Clock className="h-3 w-3 text-orange-500" />
                            <span className="text-xs text-orange-600 font-medium">Pending: {task.requestedStatus.replace("_", " ")}</span>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {task.myRole === "both"
                        ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300">Assignee &amp; Creator</span>
                        : task.myRole === "assignee"
                          ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">Assignee</span>
                          : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">Creator</span>
                      }
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${statusColors[task.status] ?? ""}`}>
                        {task.status.replace("_", " ")}
                      </span>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${priorityColors[task.priority] ?? ""}`}>
                        {task.priority}
                      </span>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-2">
                        <Progress value={task.progressPct} className="w-20 h-1.5" />
                        <span className="text-xs text-muted-foreground">{task.progressPct}%</span>
                      </div>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()} className="text-sm">
                      {task.dueDate ? format(new Date(task.dueDate), "MMM d, yyyy") : "—"}
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <TooltipProvider delayDuration={300}>
                        <div className="flex items-center justify-end gap-0.5">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                onClick={() => navigate(`/tasks/${task.id}`)}>
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top">View Details</TooltipContent>
                          </Tooltip>
                          {task.myRole !== "creator" && !task.requestedStatus && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-blue-600"
                                  onClick={() => { setRequestStatusDialog({ id: task.id, title: task.title }); setRequestedNewStatus("in_progress"); setProgressInput(task.progressPct ?? 0); }}>
                                  <Send className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top">Request Status Change</TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </TooltipProvider>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">No tasks found.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!requestStatusDialog} onOpenChange={(open) => !open && setRequestStatusDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Request Status Change</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground mb-3">{requestStatusDialog?.title}</p>
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium">New Status</Label>
              <Select value={requestedNewStatus} onValueChange={setRequestedNewStatus}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EMPLOYEE_REQUESTABLE.map((s) => <SelectItem key={s} value={s} className="capitalize">{s.replace("_", " ")}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm font-medium">Progress % (optional)</Label>
              <Input type="number" min={0} max={100} value={progressInput} onChange={(e) => setProgressInput(Number(e.target.value))} className="mt-1" />
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setRequestStatusDialog(null)}>Cancel</Button>
            <Button onClick={submitStatusRequest} disabled={requestStatus.isPending}>Submit Request</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Full Tasks View (Manager/HOD/Management) ────────────────────────────────
function FullTasks() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const deptFilter = user?.role === "hod" ? { departmentId: user.departmentId ?? undefined } : {};
  const createdFilter = { createdById: user?.id };
  const approvalParams = { departmentId: user?.departmentId ?? undefined, role: user?.role };

  const { data: deptTasks, isLoading: loadingDept } = useListTasks(deptFilter, { query: { queryKey: getListTasksQueryKey(deptFilter) } });
  const { data: createdByMeTasks, isLoading: loadingCreated } = useListTasks(createdFilter, { query: { queryKey: getListTasksQueryKey(createdFilter) } });
  const isLoading = loadingDept || loadingCreated;

  // HODs and managers see their dept tasks PLUS any tasks they personally created (cross-dept)
  const tasks = (() => {
    const map = new Map<number, NonNullable<typeof deptTasks>[number]>();
    for (const t of deptTasks ?? []) map.set(t.id, t);
    for (const t of createdByMeTasks ?? []) { if (!map.has(t.id)) map.set(t.id, t); }
    return [...map.values()].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  })();

  const { data: pendingData } = useGetPendingApprovals(approvalParams);
  const { data: employees } = useListEmployees();
  const { data: departments } = useListDepartments();

  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const updateStatus = useUpdateTaskStatus();
  const approveStatus = useApproveTaskStatus();

  const [, navigate] = useLocation();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<TaskRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TaskRow | null>(null);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [filterDept, setFilterDept] = useState("all");

  const form = useForm<TaskFormData>({
    resolver: zodResolver(taskSchema),
    defaultValues: { title: "", description: "", priority: "medium", dueDate: "", isRecurring: false },
  });
  const isRecurring = form.watch("isRecurring");
  const selectedDeptId = form.watch("departmentId");
  const deptEmployees = employees?.filter((e) => selectedDeptId ? e.departmentId === selectedDeptId : true);

  const pendingTaskApprovals = pendingData?.tasks ?? [];
  const crossDeptPending = pendingData?.crossDeptTasks ?? [];
  const canManage = user?.role !== "employee";

  function invalidateAllTaskQueries() {
    queryClient.invalidateQueries({ queryKey: getListTasksQueryKey(deptFilter) });
    queryClient.invalidateQueries({ queryKey: getListTasksQueryKey(createdFilter) });
  }

  function openCreate() {
    setEditTarget(null);
    form.reset({
      title: "", description: "", priority: "medium", dueDate: "", isRecurring: false,
      createdById: user!.id,
      departmentId: user?.role === "hod" ? (user.departmentId ?? undefined) : undefined,
    });
    setDialogOpen(true);
  }

  function openEdit(task: TaskRow) {
    setEditTarget(task);
    form.reset({
      title: task.title,
      description: task.description ?? "",
      priority: task.priority as typeof PRIORITIES[number],
      dueDate: task.dueDate ?? "",
      createdById: task.createdById,
      assignedToId: task.assignedToId,
      departmentId: task.departmentId,
      isRecurring: task.isRecurring ?? false,
      recurringFreq: task.recurringFreq as typeof FREQS[number] | undefined,
    });
    setDialogOpen(true);
  }

  function onSubmit(values: TaskFormData) {
    const payload = { ...values, description: values.description || undefined, dueDate: values.dueDate || undefined, recurringFreq: values.isRecurring ? values.recurringFreq : undefined };
    if (editTarget) {
      updateTask.mutate({ id: editTarget.id, data: payload }, {
        onSuccess: () => { invalidateAllTaskQueries(); setDialogOpen(false); toast({ title: "Task updated" }); },
      });
    } else {
      createTask.mutate({ data: payload }, {
        onSuccess: () => { invalidateAllTaskQueries(); setDialogOpen(false); toast({ title: "Task created" }); },
      });
    }
  }

  function changeStatus(taskId: number, status: string, opts?: { approverId?: number; approvalRemarks?: string }) {
    updateStatus.mutate({ id: taskId, data: { status: status as typeof STATUSES[number], approverId: opts?.approverId, approvalRemarks: opts?.approvalRemarks } }, {
      onSuccess: () => {
        invalidateAllTaskQueries();
        queryClient.invalidateQueries({ queryKey: getGetPendingApprovalsQueryKey(approvalParams) });
        queryClient.invalidateQueries({ queryKey: getGetTaskQueryKey(taskId) });
        toast({ title: `Status updated to ${status.replace(/_/g, " ")}` });
      },
    });
  }

  function handleTaskApproval(id: number, approved: boolean) {
    approveStatus.mutate({ id, data: { approved } }, {
      onSuccess: () => {
        invalidateAllTaskQueries();
        queryClient.invalidateQueries({ queryKey: getGetPendingApprovalsQueryKey(approvalParams) });
        toast({ title: approved ? "Status change approved" : "Status change rejected" });
      },
    });
  }

  function approveCrossDeptTask(taskId: number) {
    changeStatus(taskId, "pending");
  }

  function rejectCrossDeptTask(taskId: number) {
    changeStatus(taskId, "rejected");
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    deleteTask.mutate({ id: deleteTarget.id }, {
      onSuccess: () => { invalidateAllTaskQueries(); setDeleteTarget(null); toast({ title: "Task deleted" }); },
    });
  }

  const filtered = tasks.filter((t) => {
    if (filterStatus !== "all" && t.status !== filterStatus) return false;
    if (filterPriority !== "all" && t.priority !== filterPriority) return false;
    if (filterDept !== "all" && t.departmentId !== Number(filterDept)) return false;
    return true;
  });

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6 overflow-y-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Tasks</h2>
          <p className="text-muted-foreground">Track deliverables, assignments, and due dates.</p>
        </div>
        {canManage && (
          <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> Create Task</Button>
        )}
      </div>

      {/* Cross-Dept Tasks Awaiting HOD Approval */}
      {crossDeptPending.length > 0 && (
        <Card className="border-purple-200 bg-purple-50/50 dark:bg-purple-950/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Bell className="h-4 w-4 text-purple-500" /> {crossDeptPending.length} Cross-Department Task{crossDeptPending.length > 1 ? "s" : ""} Awaiting Your Approval
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {crossDeptPending.map((t) => (
                <div key={t.id} className="flex items-center justify-between p-2.5 rounded-lg border bg-card">
                  <div>
                    <p className="text-sm font-medium">{t.title}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-xs text-muted-foreground">Assigned to: <strong>{t.assignedToName}</strong></span>
                      <span className="text-xs text-muted-foreground">By: {t.createdByName}</span>
                      <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${t.priority === "high" ? "bg-red-50 text-red-600" : t.priority === "medium" ? "bg-yellow-50 text-yellow-600" : "bg-slate-50 text-slate-600"}`}>{t.priority}</span>
                      {t.dueDate && <span className="text-xs text-muted-foreground">Due: {t.dueDate}</span>}
                    </div>
                  </div>
                  <div className="flex gap-2 ml-3">
                    <Button size="sm" variant="outline" className="text-green-600 border-green-200 h-7 px-2" onClick={() => approveCrossDeptTask(t.id)}>
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Approve
                    </Button>
                    <Button size="sm" variant="outline" className="text-red-600 border-red-200 h-7 px-2" onClick={() => rejectCrossDeptTask(t.id)}>
                      <XCircle className="h-3.5 w-3.5 mr-1" /> Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pending Status Approvals */}
      {pendingTaskApprovals.length > 0 && (
        <Card className="border-orange-200 bg-orange-50/50 dark:bg-orange-950/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Bell className="h-4 w-4 text-orange-500" /> {pendingTaskApprovals.length} Pending Status Request{pendingTaskApprovals.length > 1 ? "s" : ""}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pendingTaskApprovals.map((t) => (
                <div key={t.id} className="flex items-center justify-between p-2.5 rounded-lg border bg-card">
                  <div>
                    <p className="text-sm font-medium">{t.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-xs text-muted-foreground">{t.assignedToName}</p>
                      <span className="text-xs text-muted-foreground">Current: <strong>{t.status}</strong></span>
                      <span className="text-xs">→</span>
                      <span className="text-xs font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full">{t.requestedStatus}</span>
                    </div>
                  </div>
                  <div className="flex gap-2 ml-3">
                    <Button size="sm" variant="outline" className="text-green-600 border-green-200 h-7 px-2" onClick={() => handleTaskApproval(t.id, true)}>
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Approve
                    </Button>
                    <Button size="sm" variant="outline" className="text-red-600 border-red-200 h-7 px-2" onClick={() => handleTaskApproval(t.id, false)}>
                      <XCircle className="h-3.5 w-3.5 mr-1" /> Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap gap-3">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="All Statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s.replace("_", " ")}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterPriority} onValueChange={setFilterPriority}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="All Priorities" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            {PRIORITIES.map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
          </SelectContent>
        </Select>
        {user?.role !== "hod" && (
          <Select value={filterDept} onValueChange={setFilterDept}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="All Departments" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {departments?.map((d) => <SelectItem key={d.id} value={d.id.toString()}>{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Task</TableHead>
                <TableHead>My Role</TableHead>
                <TableHead>Assignee</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {[250, 90, 120, 80, 80, 120, 100, 50].map((w, j) => <TableCell key={j}><Skeleton className={`h-4 w-[${w}px]`} /></TableCell>)}
                  </TableRow>
                ))
              ) : filtered?.length ? (
                filtered.map((task) => {
                  const isCreator = task.createdById === user?.id;
                  const isAssignee = task.assignedToId === user?.id;
                  const myRole = isCreator && isAssignee ? "both" : isCreator ? "creator" : isAssignee ? "assignee" : null;
                  return (
                  <TableRow key={task.id} className="cursor-pointer" onClick={() => navigate(`/tasks/${task.id}`)}>
                    <TableCell className="font-medium" onClick={(e) => e.stopPropagation()}>
                      <div>
                        <div className="flex items-center gap-1.5">
                          {task.isRecurring && <Repeat className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                          <button className="text-left hover:underline font-medium" onClick={() => navigate(`/tasks/${task.id}`)}>{task.title}</button>
                        </div>
                        <div className="text-xs text-muted-foreground">{task.departmentName}</div>
                        {task.requestedStatus && (
                          <span className="text-xs text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded-full mt-0.5 inline-block">
                            Pending: {task.requestedStatus.replace("_", " ")}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {myRole === "both"
                        ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300">Assignee &amp; Creator</span>
                        : myRole === "creator"
                          ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">Creator</span>
                          : myRole === "assignee"
                            ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">Assignee</span>
                            : <span className="text-xs text-muted-foreground">—</span>
                      }
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>{task.assignedToName}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${statusColors[task.status] ?? ""}`}>
                        {task.status.replace("_", " ")}
                      </span>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${priorityColors[task.priority] ?? ""}`}>
                        {task.priority}
                      </span>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-2">
                        <Progress value={task.progressPct} className="w-20 h-1.5" />
                        <span className="text-xs text-muted-foreground">{task.progressPct}%</span>
                      </div>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()} className="text-sm">
                      {task.dueDate ? format(new Date(task.dueDate), "MMM d, yyyy") : "—"}
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <TooltipProvider delayDuration={300}>
                        <div className="flex items-center justify-end gap-0.5">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                onClick={() => navigate(`/tasks/${task.id}`)}>
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top">View Details</TooltipContent>
                          </Tooltip>
                          <DropdownMenu>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-blue-600">
                                    <RefreshCw className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                              </TooltipTrigger>
                              <TooltipContent side="top">Change Status</TooltipContent>
                            </Tooltip>
                            <DropdownMenuContent align="end">
                              {STATUSES.filter((s) => s !== task.status).slice(0, 5).map((s) => (
                                <DropdownMenuItem key={s} onClick={() => changeStatus(task.id, s)}>
                                  <RefreshCw className="mr-2 h-3.5 w-3.5" /> Mark {s.replace(/_/g, " ")}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                onClick={() => openEdit(task)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top">Edit</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                onClick={() => setDeleteTarget(task)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top">Delete</TooltipContent>
                          </Tooltip>
                        </div>
                      </TooltipProvider>
                    </TableCell>
                  </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">No tasks found.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editTarget ? "Edit Task" : "Create Task"}</DialogTitle></DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="title" render={({ field }) => (
                <FormItem><FormLabel>Title</FormLabel><FormControl><Input placeholder="Task title" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea placeholder="Describe the task..." rows={3} {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                {/* Department first — drives employee filtering */}
                <FormField control={form.control} name="departmentId" render={({ field }) => (
                  <FormItem className="col-span-2"><FormLabel>Department</FormLabel>
                    <Select
                      value={field.value?.toString() ?? ""}
                      onValueChange={(v) => {
                        field.onChange(Number(v));
                        form.setValue("assignedToId", undefined as unknown as number);
                      }}
                    >
                      <FormControl><SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger></FormControl>
                      <SelectContent>{departments?.map((d) => <SelectItem key={d.id} value={d.id.toString()}>{d.name}</SelectItem>)}</SelectContent>
                    </Select><FormMessage />
                  </FormItem>
                )} />
                {/* Assign To — filtered by selected department */}
                <FormField control={form.control} name="assignedToId" render={({ field }) => (
                  <FormItem className="col-span-2"><FormLabel>Assign To</FormLabel>
                    <Select value={field.value?.toString() ?? ""} onValueChange={(v) => field.onChange(Number(v))}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={selectedDeptId ? "Select employee" : "Select a department first"} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {deptEmployees?.length
                          ? deptEmployees.map((e) => <SelectItem key={e.id} value={e.id.toString()}>{e.name}</SelectItem>)
                          : <SelectItem value="none" disabled>No employees in this department</SelectItem>}
                      </SelectContent>
                    </Select><FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="priority" render={({ field }) => (
                  <FormItem><FormLabel>Priority</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>{PRIORITIES.map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}</SelectContent>
                    </Select><FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="dueDate" render={({ field }) => (
                  <FormItem><FormLabel>Due Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <FormField control={form.control} name="isRecurring" render={({ field }) => (
                <FormItem className="flex items-center gap-3 rounded-lg border p-3">
                  <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} id="is-recurring" /></FormControl>
                  <Label htmlFor="is-recurring" className="cursor-pointer">Recurring Task</Label>
                </FormItem>
              )} />
              {isRecurring && (
                <FormField control={form.control} name="recurringFreq" render={({ field }) => (
                  <FormItem><FormLabel>Frequency</FormLabel>
                    <Select value={field.value ?? ""} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue placeholder="Select frequency" /></SelectTrigger></FormControl>
                      <SelectContent>{FREQS.map((f) => <SelectItem key={f} value={f} className="capitalize">{f}</SelectItem>)}</SelectContent>
                    </Select><FormMessage />
                  </FormItem>
                )} />
              )}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createTask.isPending || updateTask.isPending}>{editTarget ? "Save Changes" : "Create Task"}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete task?</AlertDialogTitle>
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
