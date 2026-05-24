import { useState } from "react";
import { useParams, useLocation } from "wouter";
import {
  useGetTask, useListTaskComments, useAddTaskComment,
  useUpdateTaskStatus, useUpdateTask, useDeleteTask,
  useListEmployees, useListDepartments,
  getGetTaskQueryKey, getListTaskCommentsQueryKey,
  getListTasksQueryKey, getGetPendingApprovalsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ArrowLeft, CheckCircle2, Clock, Send, User, Building2,
  Calendar, Flag, MessageSquare, UserCheck,
  Pencil, Trash2, MoreHorizontal, RefreshCw, Repeat,
} from "lucide-react";

// ── Constants ──────────────────────────────────────────────────────────────────

const statusColors: Record<string, string> = {
  pending:               "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  in_progress:           "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  completed:             "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  delayed:               "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  approved:              "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  rejected:              "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
  awaiting_hod_approval: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  closed:                "bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-300",
};
const priorityColors: Record<string, string> = {
  high:   "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  medium: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  low:    "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
};

const PRIORITIES  = ["high", "medium", "low"] as const;
const FREQS       = ["daily", "weekly", "monthly", "quarterly", "yearly"] as const;
const ASSIGNEE_STATUSES = ["in_progress", "completed", "delayed", "rejected"] as const;

const QUICK_STATUSES: { status: string; label: string; color: string }[] = [
  { status: "pending",     label: "Mark Pending",     color: "text-yellow-700 border-yellow-300 hover:bg-yellow-50 dark:hover:bg-yellow-950/30" },
  { status: "in_progress", label: "Mark In Progress", color: "text-blue-700 border-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/30" },
  { status: "delayed",     label: "Mark Delayed",     color: "text-red-700 border-red-300 hover:bg-red-50 dark:hover:bg-red-950/30" },
  { status: "completed",   label: "Mark Completed",   color: "text-green-700 border-green-300 hover:bg-green-50 dark:hover:bg-green-950/30" },
  { status: "rejected",    label: "Mark Rejected",    color: "text-gray-700 border-gray-300 hover:bg-gray-50 dark:hover:bg-gray-950/30" },
];

// ── Task edit schema ───────────────────────────────────────────────────────────

const taskSchema = z.object({
  title:         z.string().min(1, "Title required"),
  description:   z.string().optional(),
  priority:      z.enum(PRIORITIES),
  dueDate:       z.string().optional(),
  createdById:   z.number({ required_error: "Creator required" }),
  assignedToId:  z.number({ required_error: "Assignee required" }),
  departmentId:  z.number({ required_error: "Department required" }),
  isRecurring:   z.boolean().default(false),
  recurringFreq: z.enum(FREQS).optional(),
});
type TaskFormData = z.infer<typeof taskSchema>;

const commentSchema = z.object({ content: z.string().min(1, "Comment cannot be empty"), authorId: z.number() });
type CommentForm = z.infer<typeof commentSchema>;

// ── Step helpers ───────────────────────────────────────────────────────────────

type StepState = "done" | "active" | "waiting";

function StepIndicator({ n, state, label, sublabel }: { n: number; state: StepState; label: string; sublabel: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5 shrink-0">
      {state === "done" ? (
        <div className="w-9 h-9 rounded-full bg-emerald-500 flex items-center justify-center shadow ring-4 ring-emerald-100 dark:ring-emerald-900/40">
          <CheckCircle2 className="h-5 w-5 text-white" />
        </div>
      ) : state === "active" ? (
        <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center shadow ring-4 ring-primary/20">
          <span className="text-sm font-bold text-primary-foreground">{n}</span>
        </div>
      ) : (
        <div className="w-9 h-9 rounded-full bg-muted border-2 border-border flex items-center justify-center">
          <span className="text-sm font-semibold text-muted-foreground">{n}</span>
        </div>
      )}
      <div className="text-center min-w-0">
        <p className={`text-xs font-semibold leading-tight ${state === "done" ? "text-emerald-600 dark:text-emerald-400" : state === "active" ? "text-primary" : "text-muted-foreground"}`}>
          {label}
        </p>
        <p className="text-[10px] text-muted-foreground mt-0.5">{sublabel}</p>
      </div>
    </div>
  );
}

function StepConnector({ done }: { done: boolean }) {
  return <div className={`flex-1 h-0.5 mx-2 mt-[-18px] mb-auto ${done ? "bg-emerald-400" : "bg-border"}`} />;
}

function StepCard({ state, header, children }: { state: StepState; header: React.ReactNode; children: React.ReactNode }) {
  const border =
    state === "done"   ? "border-l-4 border-l-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20" :
    state === "active" ? "border-l-4 border-l-primary bg-primary/5 dark:bg-primary/10" :
                         "border-l-4 border-l-border bg-muted/30 opacity-60";
  return (
    <div className={`rounded-xl border ${border} overflow-hidden`}>
      <div className="px-5 py-3 border-b flex items-center gap-2.5 bg-white/50 dark:bg-white/5">
        {header}
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

function InfoGrid({ items }: { items: { label: string; value: React.ReactNode }[] }) {
  return (
    <div className="grid grid-cols-2 gap-x-8 gap-y-4">
      {items.map(({ label, value }) => (
        <div key={label}>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
          <div className="text-sm font-medium">{value}</div>
        </div>
      ))}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function TaskDetail() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const taskId = Number(params.id);

  const { data: task, isLoading } = useGetTask(taskId, {
    query: { queryKey: getGetTaskQueryKey(taskId), staleTime: 0, refetchOnMount: "always" },
  });
  const { data: comments } = useListTaskComments(taskId, {
    query: { queryKey: getListTaskCommentsQueryKey(taskId) },
  });
  const { data: employees }  = useListEmployees();
  const { data: departments } = useListDepartments();

  const updateStatus = useUpdateTaskStatus();
  const updateTask   = useUpdateTask();
  const deleteTask   = useDeleteTask();
  const addComment   = useAddTaskComment();

  const [remarksInput, setRemarksInput] = useState("");
  const [editOpen,   setEditOpen]   = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const editForm = useForm<TaskFormData>({
    resolver: zodResolver(taskSchema),
    defaultValues: { isRecurring: false },
  });
  const isRecurring    = editForm.watch("isRecurring");
  const selectedDeptId = editForm.watch("departmentId");
  const deptEmployees  = employees?.filter((e) => selectedDeptId ? e.departmentId === selectedDeptId : true);

  const commentForm = useForm<CommentForm>({
    resolver: zodResolver(commentSchema),
    defaultValues: { content: "", authorId: user?.id },
  });

  // ── Derived state ────────────────────────────────────────────────────────────
  const step1Done = true;
  const step2Done = !!task?.approvedByName;
  const step3Done = step2Done && (
    task?.status === "completed" || task?.status === "in_progress" ||
    task?.status === "delayed"   || task?.status === "rejected"
  );
  const step4Done = !!task?.closedByName;
  const currentStep = !step2Done ? 2 : !step3Done ? 3 : !step4Done ? 4 : 5;

  const isCreator  = task?.createdById  === user?.id;
  const isAssignee = task?.assignedToId === user?.id;
  const isHOD      = user?.role === "hod" || user?.role === "manager" || user?.role === "management" || user?.role === "admin";
  const canManage  = user?.role !== "employee";

  const canApprove      = isHOD && !step2Done;
  const canUpdateStatus = step2Done && !step4Done && (isAssignee || isHOD);
  const canCreatorClose = step2Done && !step4Done && isCreator;

  // ── Actions ──────────────────────────────────────────────────────────────────
  function invalidate() {
    queryClient.invalidateQueries({ queryKey: getGetTaskQueryKey(taskId) });
    queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetPendingApprovalsQueryKey() });
  }

  function changeStatus(status: string, opts?: { approverId?: number; approvalRemarks?: string }) {
    updateStatus.mutate(
      { id: taskId, data: { status: status as "approved" | "closed" | "pending" | "in_progress" | "completed" | "delayed" | "rejected" | "awaiting_hod_approval", approverId: opts?.approverId, approvalRemarks: opts?.approvalRemarks } },
      { onSuccess: () => { invalidate(); toast({ title: `Status changed to ${status.replace(/_/g, " ")}` }); } }
    );
  }

  function handleApprove() {
    changeStatus("approved", { approverId: user?.id, approvalRemarks: remarksInput || undefined });
    setRemarksInput("");
  }

  function openEdit() {
    if (!task) return;
    editForm.reset({
      title:         task.title,
      description:   task.description ?? "",
      priority:      task.priority as typeof PRIORITIES[number],
      dueDate:       task.dueDate ?? "",
      createdById:   task.createdById,
      assignedToId:  task.assignedToId,
      departmentId:  task.departmentId,
      isRecurring:   task.isRecurring ?? false,
      recurringFreq: (task.recurringFreq as typeof FREQS[number] | undefined) ?? undefined,
    });
    setEditOpen(true);
  }

  function onSubmitEdit(values: TaskFormData) {
    const payload = {
      ...values,
      description:   values.description   || undefined,
      dueDate:       values.dueDate        || undefined,
      recurringFreq: values.isRecurring ? values.recurringFreq : undefined,
    };
    updateTask.mutate({ id: taskId, data: payload }, {
      onSuccess: () => { invalidate(); setEditOpen(false); toast({ title: "Task updated" }); },
    });
  }

  function confirmDelete() {
    deleteTask.mutate({ id: taskId }, {
      onSuccess: () => { toast({ title: "Task deleted" }); navigate("/tasks"); },
    });
  }

  function submitComment(values: CommentForm) {
    addComment.mutate({ id: taskId, data: values }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListTaskCommentsQueryKey(taskId) });
        commentForm.reset({ content: "", authorId: user?.id });
        toast({ title: "Comment added" });
      },
    });
  }

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex-1 p-6 md:p-8 space-y-4 overflow-y-auto">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  if (!task) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-muted-foreground">
        Task not found.
      </div>
    );
  }

  const stepDones = [step1Done, step2Done, step3Done, step4Done];
  const STEPS = [
    { n: 1, label: "Task Created",   sublabel: "by Creator",          state: (step1Done ? "done" : "active") as StepState },
    { n: 2, label: "HOD Approves",   sublabel: "Assignee's HOD",      state: (step2Done ? "done" : currentStep === 2 ? "active" : "waiting") as StepState },
    { n: 3, label: "Status Updated", sublabel: "by Assignee",         state: (step3Done ? "done" : currentStep === 3 ? "active" : "waiting") as StepState },
    { n: 4, label: "Task Closed",    sublabel: "Accepted by Creator",  state: (step4Done ? "done" : currentStep === 4 ? "active" : "waiting") as StepState },
  ];

  const quickStatusButtons = QUICK_STATUSES.filter((q) => q.status !== task.status && !step4Done);

  return (
    <div className="flex-1 overflow-y-auto">

      {/* ── Sticky top bar ──────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b px-6 py-3 flex items-center gap-3">
        <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground -ml-1 shrink-0"
          onClick={() => navigate("/tasks")}>
          <ArrowLeft className="h-4 w-4" /> Back to Tasks
        </Button>
        <div className="h-4 w-px bg-border shrink-0" />
        <span className="text-sm font-semibold truncate flex-1">{task.title}</span>
        <span className={`shrink-0 inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold capitalize ${statusColors[task.status] ?? ""}`}>
          {task.status.replace(/_/g, " ")}
        </span>
        {canManage && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={openEdit}>
                <Pencil className="mr-2 h-4 w-4" /> Edit Task
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => setDeleteOpen(true)}>
                <Trash2 className="mr-2 h-4 w-4" /> Delete Task
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <div className="max-w-3xl mx-auto px-6 py-6 space-y-6">

        {/* ── Title block ─────────────────────────────────────────────────────── */}
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight leading-snug">{task.title}</h1>
              {task.isRecurring && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                  <Repeat className="h-3 w-3" /> Recurring
                </span>
              )}
            </div>
            {task.description && (
              <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{task.description}</p>
            )}
          </div>
          {canManage && (
            <div className="flex gap-2 shrink-0">
              <Button variant="outline" size="sm" className="gap-1.5" onClick={openEdit}>
                <Pencil className="h-3.5 w-3.5" /> Edit
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/5" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </Button>
            </div>
          )}
        </div>

        {/* ── Quick status actions (managers / HOD only) ───────────────────── */}
        {canManage && !step4Done && quickStatusButtons.length > 0 && (
          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" /> Quick Status Change
            </p>
            <div className="flex flex-wrap gap-2">
              {quickStatusButtons.map((q) => (
                <Button
                  key={q.status}
                  variant="outline"
                  size="sm"
                  className={`text-xs font-medium capitalize ${q.color}`}
                  disabled={updateStatus.isPending}
                  onClick={() => changeStatus(q.status)}>
                  {q.label}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* ── 4-Step progress tracker ─────────────────────────────────────── */}
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex items-start">
            {STEPS.map((s, i) => (
              <div key={s.n} className="flex items-start flex-1 last:flex-none">
                <StepIndicator {...s} />
                {i < STEPS.length - 1 && <StepConnector done={stepDones[i]} />}
              </div>
            ))}
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════════════
            STEP 1 — Task Created
        ════════════════════════════════════════════════════════════════════ */}
        <StepCard state="done" header={
          <>
            <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
              <CheckCircle2 className="h-3 w-3 text-white" />
            </div>
            <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
              Step 1 — Task Created by Creator
            </span>
          </>
        }>
          <InfoGrid items={[
            {
              label: "Created By",
              value: (
                <div>
                  <p className="font-semibold">{task.createdByName || "—"}</p>
                  {task.createdByDesignation && <p className="text-xs text-muted-foreground mt-0.5">{task.createdByDesignation}</p>}
                </div>
              ),
            },
            {
              label: "Department",
              value: <span className="flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5 text-muted-foreground" />{task.departmentName || "—"}</span>,
            },
            {
              label: "Assigned To",
              value: <span className="flex items-center gap-1.5"><User className="h-3.5 w-3.5 text-muted-foreground" />{task.assignedToName || "—"}</span>,
            },
            {
              label: "Created At",
              value: <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5 text-muted-foreground" />{format(new Date(task.createdAt), "dd MMM yyyy, h:mm a")}</span>,
            },
            {
              label: "Priority",
              value: (
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${priorityColors[task.priority] ?? ""}`}>
                  <Flag className="h-3 w-3" />{task.priority}
                </span>
              ),
            },
            {
              label: "Due Date",
              value: task.dueDate
                ? <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5 text-muted-foreground" />{format(new Date(task.dueDate), "dd MMM yyyy")}</span>
                : <span className="text-muted-foreground">—</span>,
            },
            {
              label: "Progress",
              value: (
                <div className="flex items-center gap-3">
                  <Progress value={task.progressPct} className="flex-1 h-2 max-w-[200px]" />
                  <span className="text-sm font-bold text-primary">{task.progressPct}%</span>
                </div>
              ),
            },
          ]} />
        </StepCard>

        {/* ════════════════════════════════════════════════════════════════════
            STEP 2 — HOD Approval
        ════════════════════════════════════════════════════════════════════ */}
        <StepCard
          state={step2Done ? "done" : currentStep === 2 ? "active" : "waiting"}
          header={
            <>
              <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0
                ${step2Done ? "bg-emerald-500" : currentStep === 2 ? "bg-primary" : "bg-muted border border-border"}`}>
                {step2Done
                  ? <CheckCircle2 className="h-3 w-3 text-white" />
                  : <span className="text-[10px] font-bold text-white">2</span>}
              </div>
              <span className={`text-xs font-bold uppercase tracking-wider
                ${step2Done ? "text-emerald-700 dark:text-emerald-400" : currentStep === 2 ? "text-primary" : "text-muted-foreground"}`}>
                Step 2 — Approved by Assignee's HOD
              </span>
              {!step2Done && currentStep === 2 && (
                <Badge variant="secondary" className="ml-auto text-[10px] bg-primary/10 text-primary border-primary/20">Pending</Badge>
              )}
            </>
          }
        >
          {step2Done ? (
            <InfoGrid items={[
              { label: "Approved By", value: <span className="flex items-center gap-1.5"><UserCheck className="h-3.5 w-3.5 text-emerald-600" />{task.approvedByName}</span> },
              { label: "Approved At", value: task.approvedAt ? format(new Date(task.approvedAt), "dd MMM yyyy, h:mm a") : "—" },
              {
                label: "Remarks",
                value: task.approvalRemarks
                  ? <span className="text-sm">{task.approvalRemarks}</span>
                  : <span className="text-muted-foreground italic text-xs">No remarks provided</span>,
              },
            ]} />
          ) : canApprove ? (
            <div className="space-y-3">
              <p className="text-sm text-primary font-medium">You can approve this task as HOD / Manager.</p>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Approval Remarks <span className="text-muted-foreground/60">(optional)</span></label>
                <Textarea
                  placeholder="Add remarks before approving…"
                  rows={3}
                  className="resize-none text-sm"
                  value={remarksInput}
                  onChange={(e) => setRemarksInput(e.target.value)}
                />
              </div>
              <Button
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                disabled={updateStatus.isPending}
                onClick={handleApprove}>
                <CheckCircle2 className="h-4 w-4 mr-2" /> Approve Task
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-muted-foreground py-1">
              <Clock className="h-4 w-4 shrink-0" />
              <p className="text-sm italic">Awaiting approval from the Assignee's HOD / Manager.</p>
            </div>
          )}
        </StepCard>

        {/* ════════════════════════════════════════════════════════════════════
            STEP 3 — Status Updated
        ════════════════════════════════════════════════════════════════════ */}
        <StepCard
          state={step3Done ? "done" : currentStep === 3 ? "active" : "waiting"}
          header={
            <>
              <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0
                ${step3Done ? "bg-emerald-500" : currentStep === 3 ? "bg-primary" : "bg-muted border border-border"}`}>
                {step3Done
                  ? <CheckCircle2 className="h-3 w-3 text-white" />
                  : <span className="text-[10px] font-bold text-white">3</span>}
              </div>
              <span className={`text-xs font-bold uppercase tracking-wider
                ${step3Done ? "text-emerald-700 dark:text-emerald-400" : currentStep === 3 ? "text-primary" : "text-muted-foreground"}`}>
                Step 3 — Status Updated by Assignee
              </span>
              {currentStep === 3 && !step3Done && (
                <Badge variant="secondary" className="ml-auto text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-0">Action Required</Badge>
              )}
            </>
          }
        >
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">Current Status</span>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${statusColors[task.status] ?? ""}`}>
                {task.status.replace(/_/g, " ")}
              </span>
            </div>

            {task.requestedStatus && (
              <div className="flex items-center gap-2 text-xs text-orange-700 bg-orange-50 dark:bg-orange-950/30 rounded-lg px-3 py-2.5 border border-orange-200 dark:border-orange-900/30">
                <Clock className="h-3.5 w-3.5 shrink-0" />
                Pending request: <strong className="capitalize ml-1">{task.requestedStatus.replace(/_/g, " ")}</strong>
              </div>
            )}

            {canUpdateStatus ? (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">
                  {isAssignee ? "Update your progress status:" : "Manage assignee status:"}
                </p>
                <div className="flex flex-wrap gap-2">
                  {ASSIGNEE_STATUSES.map((s) => (
                    <Button key={s} size="sm" variant={task.status === s ? "default" : "outline"}
                      className={`capitalize text-xs font-medium ${task.status === s ? "ring-2 ring-offset-1 ring-primary" : ""}`}
                      disabled={updateStatus.isPending}
                      onClick={() => changeStatus(s)}>
                      {s.replace(/_/g, " ")}
                    </Button>
                  ))}
                </div>
              </div>
            ) : !step2Done ? (
              <p className="text-sm text-muted-foreground italic">Available after HOD approval (Step 2).</p>
            ) : step4Done ? null : (
              <p className="text-sm text-muted-foreground italic">Only the assignee or their manager can update the status.</p>
            )}
          </div>
        </StepCard>

        {/* ════════════════════════════════════════════════════════════════════
            STEP 4 — Closed by Creator
        ════════════════════════════════════════════════════════════════════ */}
        <StepCard
          state={step4Done ? "done" : currentStep === 4 ? "active" : "waiting"}
          header={
            <>
              <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0
                ${step4Done ? "bg-emerald-500" : currentStep === 4 ? "bg-primary" : "bg-muted border border-border"}`}>
                {step4Done
                  ? <CheckCircle2 className="h-3 w-3 text-white" />
                  : <span className="text-[10px] font-bold text-white">4</span>}
              </div>
              <span className={`text-xs font-bold uppercase tracking-wider
                ${step4Done ? "text-emerald-700 dark:text-emerald-400" : currentStep === 4 ? "text-primary" : "text-muted-foreground"}`}>
                Step 4 — Accepted &amp; Closed by Creator
              </span>
              {currentStep === 4 && !step4Done && isCreator && (
                <Badge variant="secondary" className="ml-auto text-[10px] bg-primary/10 text-primary border-primary/20">Your Action</Badge>
              )}
            </>
          }
        >
          {step4Done ? (
            <div className="space-y-3">
              <InfoGrid items={[
                { label: "Closed By", value: <span className="text-emerald-700 dark:text-emerald-400 font-semibold">{task.closedByName}</span> },
                { label: "Closed At", value: task.closedAt ? format(new Date(task.closedAt), "dd MMM yyyy, h:mm a") : "—" },
              ]} />
              <div className="pt-1">
                <span className="inline-flex items-center gap-2 text-xs font-bold text-emerald-700 bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-300 px-4 py-2 rounded-full">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Task fully completed &amp; accepted
                </span>
              </div>
            </div>
          ) : canCreatorClose ? (
            <div className="space-y-3">
              <p className="text-sm text-primary font-medium">
                You created this task. Review the assignee's update above and close to accept it.
              </p>
              <Button
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-5 text-sm"
                disabled={updateStatus.isPending}
                onClick={() => changeStatus("closed", { approverId: user?.id })}>
                <CheckCircle2 className="h-4 w-4 mr-2" /> Accept &amp; Close Task
              </Button>
              <p className="text-[11px] text-muted-foreground text-center">
                Closing confirms you accept the work done by the assignee.
              </p>
            </div>
          ) : !step3Done ? (
            <div className="flex items-center gap-2 text-muted-foreground py-1">
              <Clock className="h-4 w-4 shrink-0" />
              <p className="text-sm italic">Available after the assignee updates their status (Step 3).</p>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-muted-foreground py-1">
              <Clock className="h-4 w-4 shrink-0" />
              <p className="text-sm italic">Awaiting acceptance from the task creator.</p>
            </div>
          )}
        </StepCard>

        {/* ── Comments ──────────────────────────────────────────────────────── */}
        <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
          <div className="px-5 py-3 border-b bg-muted/30 flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold">Comments</span>
            <span className="ml-1 text-xs bg-muted border px-2 py-0.5 rounded-full font-medium">{comments?.length ?? 0}</span>
          </div>

          <div className="p-5 space-y-4">
            {comments?.length ? (
              <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                {comments.map((c) => (
                  <div key={c.id} className="bg-muted/40 rounded-lg px-4 py-3 text-sm border">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-semibold text-xs">{c.authorName}</span>
                      <span className="text-[10px] text-muted-foreground">{format(new Date(c.createdAt), "dd MMM, h:mm a")}</span>
                    </div>
                    <p className="leading-relaxed text-sm">{c.content}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">No comments yet. Be the first to add one.</p>
            )}

            <Form {...commentForm}>
              <form onSubmit={commentForm.handleSubmit(submitComment)} className="flex gap-2 pt-2 border-t items-end">
                <FormField control={commentForm.control} name="content" render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormControl>
                      <Textarea placeholder="Add a comment…" rows={2} className="resize-none text-sm" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <Button type="submit" size="sm" className="shrink-0" disabled={addComment.isPending}>
                  <Send className="h-3.5 w-3.5" />
                </Button>
              </form>
            </Form>
          </div>
        </div>

        <div className="h-4" />
      </div>

      {/* ── Edit Dialog ───────────────────────────────────────────────────────── */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Task</DialogTitle>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onSubmitEdit)} className="space-y-4">
              <FormField control={editForm.control} name="title" render={({ field }) => (
                <FormItem><FormLabel>Title</FormLabel><FormControl><Input placeholder="Task title" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={editForm.control} name="description" render={({ field }) => (
                <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea placeholder="Describe the task…" rows={3} {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={editForm.control} name="departmentId" render={({ field }) => (
                  <FormItem className="col-span-2"><FormLabel>Department</FormLabel>
                    <Select
                      value={field.value?.toString() ?? ""}
                      onValueChange={(v) => {
                        field.onChange(Number(v));
                        editForm.setValue("assignedToId", undefined as unknown as number);
                      }}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger></FormControl>
                      <SelectContent>{departments?.map((d) => <SelectItem key={d.id} value={d.id.toString()}>{d.name}</SelectItem>)}</SelectContent>
                    </Select><FormMessage />
                  </FormItem>
                )} />
                <FormField control={editForm.control} name="assignedToId" render={({ field }) => (
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
                <FormField control={editForm.control} name="priority" render={({ field }) => (
                  <FormItem><FormLabel>Priority</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>{PRIORITIES.map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}</SelectContent>
                    </Select><FormMessage />
                  </FormItem>
                )} />
                <FormField control={editForm.control} name="dueDate" render={({ field }) => (
                  <FormItem><FormLabel>Due Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <FormField control={editForm.control} name="isRecurring" render={({ field }) => (
                <FormItem className="flex items-center gap-3 rounded-lg border p-3">
                  <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} id="edit-is-recurring" /></FormControl>
                  <Label htmlFor="edit-is-recurring" className="cursor-pointer">Recurring Task</Label>
                </FormItem>
              )} />
              {isRecurring && (
                <FormField control={editForm.control} name="recurringFreq" render={({ field }) => (
                  <FormItem><FormLabel>Frequency</FormLabel>
                    <Select value={field.value ?? ""} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select frequency" /></SelectTrigger></FormControl>
                      <SelectContent>{FREQS.map((f) => <SelectItem key={f} value={f} className="capitalize">{f}</SelectItem>)}</SelectContent>
                    </Select><FormMessage />
                  </FormItem>
                )} />
              )}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={updateTask.isPending}>Save Changes</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation ───────────────────────────────────────────────── */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this task?</AlertDialogTitle>
            <AlertDialogDescription>
              Permanently delete <strong>{task.title}</strong>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteTask.isPending}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
