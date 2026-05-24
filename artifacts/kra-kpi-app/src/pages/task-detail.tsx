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
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import {
  ArrowLeft, CheckCircle2, Clock, Send, User, Building2,
  Calendar, Flag, MessageSquare, UserCheck, AlertCircle,
  Pencil, Trash2, RefreshCw, Repeat, ChevronRight,
  CircleDot, Lock,
} from "lucide-react";

// ── Constants ──────────────────────────────────────────────────────────────────

const STATUS_META: Record<string, { label: string; dot: string; badge: string }> = {
  pending:               { label: "Pending",              dot: "bg-yellow-400",  badge: "bg-yellow-100 text-yellow-800 ring-yellow-200" },
  in_progress:           { label: "In Progress",          dot: "bg-blue-500",    badge: "bg-blue-100 text-blue-800 ring-blue-200" },
  completed:             { label: "Completed",            dot: "bg-green-500",   badge: "bg-green-100 text-green-800 ring-green-200" },
  delayed:               { label: "Delayed",              dot: "bg-red-500",     badge: "bg-red-100 text-red-800 ring-red-200" },
  approved:              { label: "Approved",             dot: "bg-emerald-500", badge: "bg-emerald-100 text-emerald-800 ring-emerald-200" },
  rejected:              { label: "Rejected",             dot: "bg-gray-400",    badge: "bg-gray-100 text-gray-700 ring-gray-200" },
  awaiting_hod_approval: { label: "Awaiting HOD",         dot: "bg-purple-500",  badge: "bg-purple-100 text-purple-800 ring-purple-200" },
  closed:                { label: "Closed",               dot: "bg-slate-400",   badge: "bg-slate-100 text-slate-700 ring-slate-200" },
};

const PRIORITY_META: Record<string, { label: string; cls: string }> = {
  high:   { label: "High",   cls: "bg-red-100 text-red-700 ring-red-200" },
  medium: { label: "Medium", cls: "bg-amber-100 text-amber-700 ring-amber-200" },
  low:    { label: "Low",    cls: "bg-emerald-100 text-emerald-700 ring-emerald-200" },
};

const PRIORITIES  = ["high", "medium", "low"] as const;
const FREQS       = ["daily", "weekly", "monthly", "quarterly", "yearly"] as const;
const ASSIGNEE_STATUSES = ["in_progress", "completed", "delayed", "rejected"] as const;

const QUICK_STATUSES = [
  { status: "pending",     label: "Mark Pending",     cls: "border-yellow-300 text-yellow-700 hover:bg-yellow-50 dark:hover:bg-yellow-950/30" },
  { status: "in_progress", label: "Mark In Progress", cls: "border-blue-300 text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/30" },
  { status: "delayed",     label: "Mark Delayed",     cls: "border-red-300 text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30" },
  { status: "completed",   label: "Mark Completed",   cls: "border-green-300 text-green-700 hover:bg-green-50 dark:hover:bg-green-950/30" },
  { status: "rejected",    label: "Mark Rejected",    cls: "border-gray-300 text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-950/30" },
];

// ── Form schemas ───────────────────────────────────────────────────────────────

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

const commentSchema = z.object({
  content:  z.string().min(1, "Cannot be empty"),
  authorId: z.number(),
});
type CommentForm = z.infer<typeof commentSchema>;

// ── Small helpers ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const m = STATUS_META[status];
  if (!m) return null;
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ring-1 ${m.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const m = PRIORITY_META[priority];
  if (!m) return null;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ring-1 ${m.cls}`}>
      <Flag className="h-2.5 w-2.5" />{m.label}
    </span>
  );
}

function MetaRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-3">
      <div className="mt-0.5 text-muted-foreground shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-0.5">{label}</p>
        <div className="text-sm font-medium leading-snug">{value}</div>
      </div>
    </div>
  );
}

type StepState = "done" | "active" | "waiting";

function TimelineStep({
  n, state, title, subtitle, isLast, children,
}: {
  n: number; state: StepState; title: string; subtitle: string; isLast?: boolean; children: React.ReactNode;
}) {
  return (
    <div className="flex gap-4">
      {/* Spine */}
      <div className="flex flex-col items-center shrink-0">
        <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 shadow-sm
          ${state === "done"   ? "bg-emerald-500 ring-4 ring-emerald-100 dark:ring-emerald-900/30"
          : state === "active" ? "bg-primary ring-4 ring-primary/15"
          :                      "bg-muted border-2 border-border"}`}>
          {state === "done" ? (
            <CheckCircle2 className="h-4.5 w-4.5 text-white h-5 w-5" />
          ) : state === "active" ? (
            <CircleDot className="h-4.5 w-4.5 text-white h-5 w-5" />
          ) : (
            <Lock className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
        {!isLast && (
          <div className={`w-0.5 flex-1 mt-2 min-h-[24px] ${state === "done" ? "bg-emerald-300 dark:bg-emerald-700" : "bg-border"}`} />
        )}
      </div>

      {/* Content */}
      <div className={`flex-1 pb-6 ${isLast ? "pb-0" : ""}`}>
        <div className={`rounded-xl border overflow-hidden
          ${state === "done"   ? "border-emerald-200 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-950/20"
          : state === "active" ? "border-primary/30 bg-primary/3 dark:bg-primary/5 shadow-sm"
          :                      "border-dashed border-border bg-muted/20 opacity-60"}`}>
          <div className={`px-4 py-2.5 flex items-center justify-between border-b
            ${state === "done"   ? "border-emerald-200 dark:border-emerald-800 bg-emerald-100/50 dark:bg-emerald-900/20"
            : state === "active" ? "border-primary/20 bg-primary/5"
            :                      "border-border/60 bg-muted/30"}`}>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-bold uppercase tracking-widest
                ${state === "done" ? "text-emerald-600 dark:text-emerald-400"
                : state === "active" ? "text-primary"
                : "text-muted-foreground"}`}>
                Step {n}
              </span>
              <ChevronRight className="h-3 w-3 text-muted-foreground/40" />
              <span className={`text-xs font-semibold
                ${state === "done" ? "text-emerald-700 dark:text-emerald-300"
                : state === "active" ? "text-foreground"
                : "text-muted-foreground"}`}>
                {title}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-muted-foreground">{subtitle}</span>
              {state === "done" && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
              {state === "active" && <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />}
            </div>
          </div>
          <div className="px-4 py-4">{children}</div>
        </div>
      </div>
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
  const { data: comments }    = useListTaskComments(taskId, { query: { queryKey: getListTaskCommentsQueryKey(taskId) } });
  const { data: employees }   = useListEmployees();
  const { data: departments } = useListDepartments();

  const updateStatus = useUpdateTaskStatus();
  const updateTask   = useUpdateTask();
  const deleteTask   = useDeleteTask();
  const addComment   = useAddTaskComment();

  const [remarksInput, setRemarksInput] = useState("");
  const [editOpen,     setEditOpen]     = useState(false);
  const [deleteOpen,   setDeleteOpen]   = useState(false);

  const editForm = useForm<TaskFormData>({ resolver: zodResolver(taskSchema), defaultValues: { isRecurring: false } });
  const isRecurring    = editForm.watch("isRecurring");
  const selectedDeptId = editForm.watch("departmentId");
  const deptEmployees  = employees?.filter((e) => selectedDeptId ? e.departmentId === selectedDeptId : true);

  const commentForm = useForm<CommentForm>({
    resolver: zodResolver(commentSchema),
    defaultValues: { content: "", authorId: user?.id },
  });

  // ── Derived permissions ───────────────────────────────────────────────────
  const step1Done = true;
  const step2Done = !!task?.approvedByName;
  const step3Done = step2Done && ["completed","in_progress","delayed","rejected"].includes(task?.status ?? "");
  const step4Done = !!task?.closedByName;
  const currentStep = !step2Done ? 2 : !step3Done ? 3 : !step4Done ? 4 : 5;

  const isCreator  = task?.createdById  === user?.id;
  const isAssignee = task?.assignedToId === user?.id;
  const isHOD      = ["hod","manager","management","admin"].includes(user?.role ?? "");
  const canManage  = user?.role !== "employee";

  const canApprove      = !step2Done && (
    user?.role === "admin" ||
    user?.role === "management" ||
    ((user?.role === "hod" || user?.role === "manager") && user?.departmentId === task?.departmentId)
  );
  const canUpdateStatus = step2Done && !step4Done && (isAssignee || isHOD);
  const canCreatorClose = step2Done && !step4Done && isCreator;

  // ── Actions ───────────────────────────────────────────────────────────────
  function invalidate() {
    queryClient.invalidateQueries({ queryKey: getGetTaskQueryKey(taskId) });
    queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetPendingApprovalsQueryKey() });
  }

  function changeStatus(status: string, opts?: { approverId?: number; approvalRemarks?: string }) {
    updateStatus.mutate(
      { id: taskId, data: { status: status as "approved"|"closed"|"pending"|"in_progress"|"completed"|"delayed"|"rejected"|"awaiting_hod_approval", ...opts } },
      { onSuccess: () => { invalidate(); toast({ title: `Status changed to ${status.replace(/_/g," ")}` }); } }
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
    updateTask.mutate(
      { id: taskId, data: { ...values, description: values.description||undefined, dueDate: values.dueDate||undefined, recurringFreq: values.isRecurring ? values.recurringFreq : undefined } },
      { onSuccess: () => { invalidate(); setEditOpen(false); toast({ title: "Task updated" }); } }
    );
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
        toast({ title: "Comment posted" });
      },
    });
  }

  // ── Loading / error states ────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex-1 p-6 space-y-5 overflow-y-auto">
        <Skeleton className="h-9 w-52 rounded-lg" />
        <Skeleton className="h-40 w-full rounded-2xl" />
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="col-span-2 h-72 rounded-2xl" />
          <Skeleton className="h-72 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-2 p-8 text-muted-foreground">
        <AlertCircle className="h-8 w-8" />
        <p className="font-medium">Task not found</p>
      </div>
    );
  }

  const quickStatusBtns = QUICK_STATUSES.filter((q) => q.status !== task.status && !step4Done);

  return (
    <div className="flex-1 flex flex-col overflow-y-auto bg-muted/20 dark:bg-muted/10 min-h-0">

      {/* ─────────────────────────────────────────────────────────────────────
          TOP NAV BAR
      ──────────────────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-background border-b px-6 py-3 flex items-center gap-3 shadow-sm">
        <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground shrink-0 -ml-2"
          onClick={() => navigate("/tasks")}>
          <ArrowLeft className="h-4 w-4" /> Back to Tasks
        </Button>
        <Separator orientation="vertical" className="h-4" />
        <span className="text-xs text-muted-foreground truncate flex-1 hidden sm:block">{task.title}</span>
        <div className="flex items-center gap-2 ml-auto shrink-0">
          <StatusBadge status={task.status} />
          {canManage && (
            <>
              <Button variant="outline" size="sm" className="gap-1.5 h-8" onClick={openEdit}>
                <Pencil className="h-3.5 w-3.5" /> Edit
              </Button>
              <Button variant="outline" size="sm"
                className="gap-1.5 h-8 text-destructive border-destructive/30 hover:bg-destructive/5 hover:text-destructive"
                onClick={() => setDeleteOpen(true)}>
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 px-6 py-6 space-y-5 max-w-screen-xl mx-auto w-full">

        {/* ───────────────────────────────────────────────────────────────────
            HERO CARD
        ────────────────────────────────────────────────────────────────── */}
        <div className="rounded-2xl bg-white dark:bg-card border shadow-sm overflow-hidden">
          {/* Accent stripe */}
          <div className={`h-1.5 w-full
            ${task.priority === "high" ? "bg-gradient-to-r from-red-400 to-orange-400"
            : task.priority === "medium" ? "bg-gradient-to-r from-amber-400 to-yellow-400"
            : "bg-gradient-to-r from-emerald-400 to-teal-400"}`} />

          <div className="px-6 py-5">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <PriorityBadge priority={task.priority} />
                  {task.isRecurring && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted px-2.5 py-0.5 rounded-full ring-1 ring-border">
                      <Repeat className="h-2.5 w-2.5" /> Recurring
                    </span>
                  )}
                </div>
                <h1 className="text-xl font-bold tracking-tight text-foreground leading-snug">
                  {task.title}
                </h1>
                {task.description && (
                  <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">{task.description}</p>
                )}
              </div>

              <div className="text-right shrink-0">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Progress</p>
                <p className="text-2xl font-bold text-primary">{task.progressPct ?? 0}%</p>
                <Progress value={task.progressPct ?? 0} className="h-1.5 w-28 mt-1" />
              </div>
            </div>

            {/* Metadata chips row */}
            <div className="flex flex-wrap items-center gap-4 mt-5 pt-4 border-t">
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Building2 className="h-3.5 w-3.5 shrink-0" />
                <span className="font-medium text-foreground">{task.departmentName || "—"}</span>
              </div>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <User className="h-3.5 w-3.5 shrink-0" />
                <span>Assigned to</span>
                <span className="font-semibold text-foreground">{task.assignedToName || "—"}</span>
              </div>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <UserCheck className="h-3.5 w-3.5 shrink-0" />
                <span>Created by</span>
                <span className="font-semibold text-foreground">{task.createdByName || "—"}</span>
              </div>
              {task.dueDate && (
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5 shrink-0" />
                  <span>Due</span>
                  <span className="font-semibold text-foreground">{format(new Date(task.dueDate), "dd MMM yyyy")}</span>
                </div>
              )}
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground ml-auto">
                <Clock className="h-3.5 w-3.5 shrink-0" />
                <span>Created {format(new Date(task.createdAt), "dd MMM yyyy")}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ───────────────────────────────────────────────────────────────────
            QUICK STATUS CHANGE (managers / HOD only)
        ────────────────────────────────────────────────────────────────── */}
        {canManage && !step4Done && quickStatusBtns.length > 0 && (
          <div className="rounded-xl bg-white dark:bg-card border shadow-sm px-5 py-3.5 flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground shrink-0">
              <RefreshCw className="h-3.5 w-3.5" /> Quick Status:
            </div>
            <div className="flex flex-wrap gap-2">
              {quickStatusBtns.map((q) => (
                <Button key={q.status} variant="outline" size="sm"
                  className={`h-7 text-xs font-medium px-3 ${q.cls}`}
                  disabled={updateStatus.isPending}
                  onClick={() => changeStatus(q.status)}>
                  {q.label}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* ───────────────────────────────────────────────────────────────────
            MAIN BODY — two-column
        ────────────────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-5 items-start">

          {/* LEFT — Workflow Timeline */}
          <div className="space-y-0 bg-white dark:bg-card rounded-2xl border shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b bg-muted/30 flex items-center justify-between">
              <p className="text-sm font-semibold">Workflow</p>
              <span className="text-xs text-muted-foreground">Step {Math.min(currentStep - 1, 4)} of 4 complete</span>
            </div>
            <div className="p-5">

              {/* ── Step 1: Task Created ── */}
              <TimelineStep n={1} state="done" title="Task Created" subtitle="by Creator">
                <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Created By</p>
                    <p className="font-semibold">{task.createdByName || "—"}</p>
                    {task.createdByDesignation && <p className="text-xs text-muted-foreground">{task.createdByDesignation}</p>}
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Assigned To</p>
                    <p className="font-semibold">{task.assignedToName || "—"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Created</p>
                    <p className="font-medium text-xs text-muted-foreground">{format(new Date(task.createdAt), "dd MMM yyyy, h:mm a")}</p>
                  </div>
                </div>
              </TimelineStep>

              {/* ── Step 2: HOD Approval ── */}
              <TimelineStep n={2} state={step2Done ? "done" : currentStep === 2 ? "active" : "waiting"}
                title="HOD Approval" subtitle="Assignee's HOD / Manager">
                {step2Done ? (
                  <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Approved By</p>
                      <p className="font-semibold text-emerald-700 dark:text-emerald-400">{task.approvedByName}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Approved At</p>
                      <p className="text-xs font-medium text-muted-foreground">{task.approvedAt ? format(new Date(task.approvedAt), "dd MMM yyyy, h:mm a") : "—"}</p>
                    </div>
                    {task.approvalRemarks && (
                      <div className="col-span-2">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Remarks</p>
                        <p className="text-sm bg-muted/50 rounded-lg px-3 py-2">{task.approvalRemarks}</p>
                      </div>
                    )}
                  </div>
                ) : canApprove ? (
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-primary">You can approve this task as HOD / Manager.</p>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground block mb-1">
                        Approval Remarks <span className="opacity-60">(optional)</span>
                      </label>
                      <Textarea placeholder="Add remarks…" rows={3} className="resize-none text-sm"
                        value={remarksInput} onChange={(e) => setRemarksInput(e.target.value)} />
                    </div>
                    <Button className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2" disabled={updateStatus.isPending} onClick={handleApprove}>
                      <CheckCircle2 className="h-4 w-4" /> Approve Task
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-4 w-4 shrink-0" />
                    <p className="text-sm italic">Awaiting approval from the Assignee's HOD / Manager.</p>
                  </div>
                )}
              </TimelineStep>

              {/* ── Step 3: Status Update ── */}
              <TimelineStep n={3} state={step3Done ? "done" : currentStep === 3 ? "active" : "waiting"}
                title="Status Update" subtitle="by Assignee">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-muted-foreground">Current status:</span>
                    <StatusBadge status={task.status} />
                    {task.requestedStatus && (
                      <span className="inline-flex items-center gap-1.5 text-xs text-orange-700 bg-orange-50 dark:bg-orange-950/30 px-2.5 py-1 rounded-full ring-1 ring-orange-200 dark:ring-orange-800">
                        <Clock className="h-3 w-3" />
                        Requested: <strong className="capitalize">{task.requestedStatus.replace(/_/g," ")}</strong>
                      </span>
                    )}
                  </div>

                  {canUpdateStatus ? (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground font-medium">
                        {isAssignee ? "Update your progress status:" : "Manage assignee status:"}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {ASSIGNEE_STATUSES.map((s) => (
                          <Button key={s} size="sm" variant={task.status === s ? "default" : "outline"}
                            className={`capitalize text-xs ${task.status === s ? "ring-2 ring-offset-1 ring-primary/40" : ""}`}
                            disabled={updateStatus.isPending}
                            onClick={() => changeStatus(s)}>
                            {s.replace(/_/g," ")}
                          </Button>
                        ))}
                      </div>
                    </div>
                  ) : !step2Done ? (
                    <p className="text-sm text-muted-foreground italic">Available after HOD approval.</p>
                  ) : step4Done ? null : (
                    <p className="text-sm text-muted-foreground italic">Only the assignee or manager can update status.</p>
                  )}
                </div>
              </TimelineStep>

              {/* ── Step 4: Closed ── */}
              <TimelineStep n={4} state={step4Done ? "done" : currentStep === 4 ? "active" : "waiting"}
                title="Task Closed" subtitle="Accepted by Creator" isLast>
                {step4Done ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Closed By</p>
                        <p className="font-semibold text-emerald-700 dark:text-emerald-400">{task.closedByName}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Closed At</p>
                        <p className="text-xs font-medium text-muted-foreground">
                          {task.closedAt ? format(new Date(task.closedAt), "dd MMM yyyy, h:mm a") : "—"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-4 py-2.5 rounded-xl border border-emerald-200 dark:border-emerald-800 w-fit">
                      <CheckCircle2 className="h-4 w-4" /> Task fully completed &amp; accepted
                    </div>
                  </div>
                ) : canCreatorClose ? (
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-primary">
                      Review the assignee's progress above, then close this task to accept it.
                    </p>
                    <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-2 py-5"
                      disabled={updateStatus.isPending}
                      onClick={() => changeStatus("closed", { approverId: user?.id })}>
                      <CheckCircle2 className="h-4 w-4" /> Accept &amp; Close Task
                    </Button>
                    <p className="text-[11px] text-muted-foreground text-center">Closing confirms you accept the assignee's work.</p>
                  </div>
                ) : !step3Done ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-4 w-4 shrink-0" />
                    <p className="text-sm italic">Available after the assignee updates their status.</p>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-4 w-4 shrink-0" />
                    <p className="text-sm italic">Awaiting acceptance from the task creator.</p>
                  </div>
                )}
              </TimelineStep>

            </div>
          </div>

          {/* RIGHT — Info Sidebar */}
          <div className="space-y-4">

            {/* Task Details */}
            <div className="bg-white dark:bg-card rounded-2xl border shadow-sm overflow-hidden">
              <div className="px-5 py-3.5 border-b bg-muted/30">
                <p className="text-sm font-semibold">Task Details</p>
              </div>
              <div className="px-5 divide-y">
                <MetaRow
                  icon={<Flag className="h-3.5 w-3.5" />}
                  label="Priority"
                  value={<PriorityBadge priority={task.priority} />}
                />
                <MetaRow
                  icon={<Building2 className="h-3.5 w-3.5" />}
                  label="Department"
                  value={task.departmentName || "—"}
                />
                <MetaRow
                  icon={<User className="h-3.5 w-3.5" />}
                  label="Assigned To"
                  value={
                    <div>
                      <p>{task.assignedToName || "—"}</p>
                    </div>
                  }
                />
                <MetaRow
                  icon={<UserCheck className="h-3.5 w-3.5" />}
                  label="Created By"
                  value={
                    <div>
                      <p>{task.createdByName || "—"}</p>
                      {task.createdByDesignation && <p className="text-xs text-muted-foreground">{task.createdByDesignation}</p>}
                    </div>
                  }
                />
                <MetaRow
                  icon={<Calendar className="h-3.5 w-3.5" />}
                  label="Due Date"
                  value={task.dueDate ? format(new Date(task.dueDate), "dd MMM yyyy") : <span className="text-muted-foreground">Not set</span>}
                />
                <MetaRow
                  icon={<Clock className="h-3.5 w-3.5" />}
                  label="Created At"
                  value={format(new Date(task.createdAt), "dd MMM yyyy")}
                />
                {task.isRecurring && (
                  <MetaRow
                    icon={<Repeat className="h-3.5 w-3.5" />}
                    label="Recurrence"
                    value={<span className="capitalize">{task.recurringFreq || "—"}</span>}
                  />
                )}
                <div className="py-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2">Progress</p>
                  <div className="flex items-center gap-3">
                    <Progress value={task.progressPct ?? 0} className="flex-1 h-2" />
                    <span className="text-sm font-bold text-primary tabular-nums w-10 text-right">
                      {task.progressPct ?? 0}%
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Status */}
            <div className="bg-white dark:bg-card rounded-2xl border shadow-sm overflow-hidden">
              <div className="px-5 py-3.5 border-b bg-muted/30">
                <p className="text-sm font-semibold">Status</p>
              </div>
              <div className="px-5 py-4 space-y-2">
                <StatusBadge status={task.status} />
                {task.requestedStatus && (
                  <div className="flex items-center gap-1.5 text-xs text-orange-700 bg-orange-50 dark:bg-orange-950/30 px-3 py-2 rounded-lg ring-1 ring-orange-200 dark:ring-orange-800">
                    <Clock className="h-3 w-3 shrink-0" />
                    Pending: <strong className="capitalize ml-1">{task.requestedStatus.replace(/_/g," ")}</strong>
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>

        {/* ───────────────────────────────────────────────────────────────────
            COMMENTS
        ────────────────────────────────────────────────────────────────── */}
        <div className="bg-white dark:bg-card rounded-2xl border shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b bg-muted/30 flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-semibold">Comments</p>
            <span className="ml-1 text-xs bg-muted border px-2 py-0.5 rounded-full font-medium tabular-nums">
              {comments?.length ?? 0}
            </span>
          </div>

          <div className="p-5 space-y-4">
            {comments?.length ? (
              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {comments.map((c) => (
                  <div key={c.id} className="flex gap-3">
                    <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                      {(c.authorName ?? "?")[0].toUpperCase()}
                    </div>
                    <div className="flex-1 bg-muted/40 rounded-xl px-3.5 py-3 text-sm border">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-xs">{c.authorName}</span>
                        <span className="text-[10px] text-muted-foreground">{format(new Date(c.createdAt), "dd MMM, h:mm a")}</span>
                      </div>
                      <p className="leading-relaxed">{c.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground italic py-2">
                <MessageSquare className="h-4 w-4 shrink-0" />
                No comments yet — be the first to add one.
              </div>
            )}

            <Form {...commentForm}>
              <form onSubmit={commentForm.handleSubmit(submitComment)} className="flex gap-2 pt-3 border-t items-end">
                <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                  {(user?.name ?? "U")[0].toUpperCase()}
                </div>
                <FormField control={commentForm.control} name="content" render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormControl>
                      <Textarea placeholder="Write a comment…" rows={2} className="resize-none text-sm" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <Button type="submit" size="sm" className="gap-1.5 shrink-0" disabled={addComment.isPending}>
                  <Send className="h-3.5 w-3.5" /> Post
                </Button>
              </form>
            </Form>
          </div>
        </div>

        <div className="h-2" />
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
                    <Select value={field.value?.toString() ?? ""} onValueChange={(v) => { field.onChange(Number(v)); editForm.setValue("assignedToId", undefined as unknown as number); }}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger></FormControl>
                      <SelectContent>{departments?.map((d) => <SelectItem key={d.id} value={d.id.toString()}>{d.name}</SelectItem>)}</SelectContent>
                    </Select><FormMessage /></FormItem>
                )} />
                <FormField control={editForm.control} name="assignedToId" render={({ field }) => (
                  <FormItem className="col-span-2"><FormLabel>Assign To</FormLabel>
                    <Select value={field.value?.toString() ?? ""} onValueChange={(v) => field.onChange(Number(v))}>
                      <FormControl><SelectTrigger><SelectValue placeholder={selectedDeptId ? "Select employee" : "Select a department first"} /></SelectTrigger></FormControl>
                      <SelectContent>
                        {deptEmployees?.length
                          ? deptEmployees.map((e) => <SelectItem key={e.id} value={e.id.toString()}>{e.name}</SelectItem>)
                          : <SelectItem value="none" disabled>No employees in this department</SelectItem>}
                      </SelectContent>
                    </Select><FormMessage /></FormItem>
                )} />
                <FormField control={editForm.control} name="priority" render={({ field }) => (
                  <FormItem><FormLabel>Priority</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>{PRIORITIES.map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}</SelectContent>
                    </Select><FormMessage /></FormItem>
                )} />
                <FormField control={editForm.control} name="dueDate" render={({ field }) => (
                  <FormItem><FormLabel>Due Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <FormField control={editForm.control} name="isRecurring" render={({ field }) => (
                <FormItem className="flex items-center gap-3 rounded-lg border p-3">
                  <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} id="edit-recurring" /></FormControl>
                  <Label htmlFor="edit-recurring" className="cursor-pointer">Recurring Task</Label>
                </FormItem>
              )} />
              {isRecurring && (
                <FormField control={editForm.control} name="recurringFreq" render={({ field }) => (
                  <FormItem><FormLabel>Frequency</FormLabel>
                    <Select value={field.value ?? ""} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select frequency" /></SelectTrigger></FormControl>
                      <SelectContent>{FREQS.map((f) => <SelectItem key={f} value={f} className="capitalize">{f}</SelectItem>)}</SelectContent>
                    </Select><FormMessage /></FormItem>
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
              Permanently delete <strong>{task.title}</strong>? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmDelete} disabled={deleteTask.isPending}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
