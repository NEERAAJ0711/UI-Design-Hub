import { useState } from "react";
import {
  useListTasks,
  useListEmployees,
  useListDepartments,
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
  useUpdateTaskStatus,
  useGetTask,
  useListTaskComments,
  useAddTaskComment,
  getListTasksQueryKey,
  getGetTaskQueryKey,
  getListTaskCommentsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
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
import { Plus, MoreHorizontal, Pencil, Trash2, MessageSquare, CheckCircle, RefreshCw, Repeat } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

const STATUSES = ["pending", "in_progress", "completed", "delayed", "approved", "rejected"] as const;
const PRIORITIES = ["high", "medium", "low"] as const;
const FREQS = ["daily", "weekly", "monthly", "quarterly", "yearly"] as const;

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  in_progress: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  completed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  delayed: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  approved: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  rejected: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
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

const commentSchema = z.object({ authorId: z.number({ required_error: "Author required" }), content: z.string().min(1) });
type CommentForm = z.infer<typeof commentSchema>;

type TaskRow = {
  id: number; title: string; description?: string | null; status: string; priority: string; dueDate?: string | null;
  assignedToId: number; assignedToName?: string | null; createdById: number; createdByName?: string | null;
  departmentId: number; departmentName?: string | null; isRecurring?: boolean | null; recurringFreq?: string | null; progressPct?: number | null; createdAt: string;
};

export default function Tasks() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: tasks, isLoading } = useListTasks();
  const { data: employees } = useListEmployees();
  const { data: departments } = useListDepartments();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const updateStatus = useUpdateTaskStatus();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<TaskRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TaskRow | null>(null);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [filterDept, setFilterDept] = useState("all");

  const form = useForm<TaskFormData>({
    resolver: zodResolver(taskSchema),
    defaultValues: { title: "", description: "", priority: "medium", dueDate: "", isRecurring: false },
  });
  const isRecurring = form.watch("isRecurring");

  function openCreate() {
    setEditTarget(null);
    form.reset({ title: "", description: "", priority: "medium", dueDate: "", isRecurring: false });
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
    const payload = {
      ...values,
      description: values.description || undefined,
      dueDate: values.dueDate || undefined,
      recurringFreq: values.isRecurring ? values.recurringFreq : undefined,
    };
    if (editTarget) {
      updateTask.mutate({ id: editTarget.id, data: payload }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
          setDialogOpen(false);
          toast({ title: "Task updated" });
        },
      });
    } else {
      createTask.mutate({ data: payload }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
          setDialogOpen(false);
          toast({ title: "Task created" });
        },
      });
    }
  }

  function changeStatus(taskId: number, status: string) {
    updateStatus.mutate({ id: taskId, data: { status: status as typeof STATUSES[number] } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
        if (detailId === taskId) queryClient.invalidateQueries({ queryKey: getGetTaskQueryKey(taskId) });
        toast({ title: `Status updated to ${status.replace("_", " ")}` });
      },
    });
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    deleteTask.mutate({ id: deleteTarget.id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
        setDeleteTarget(null);
        toast({ title: "Task deleted" });
      },
    });
  }

  const filtered = tasks?.filter((t) => {
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
        <Button data-testid="button-create-task" onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" /> Create Task
        </Button>
      </div>

      {/* Filters */}
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
                <TableHead>Task</TableHead>
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
                    {[250, 120, 80, 80, 120, 100, 50].map((w, j) => (
                      <TableCell key={j}><Skeleton className={`h-4 w-[${w}px]`} /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : filtered?.length ? (
                filtered.map((task) => (
                  <TableRow
                    key={task.id}
                    className="cursor-pointer"
                    data-testid={`row-task-${task.id}`}
                    onClick={() => setDetailId(task.id)}
                  >
                    <TableCell className="font-medium" onClick={(e) => e.stopPropagation()}>
                      <div>
                        <div className="flex items-center gap-1.5">
                          {task.isRecurring && <Repeat className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                          <button
                            className="text-left hover:underline font-medium"
                            onClick={() => setDetailId(task.id)}
                            data-testid={`link-task-${task.id}`}
                          >
                            {task.title}
                          </button>
                        </div>
                        <div className="text-xs text-muted-foreground">{task.departmentName}</div>
                      </div>
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
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" data-testid={`button-actions-task-${task.id}`}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setDetailId(task.id)}>
                            <MessageSquare className="mr-2 h-4 w-4" /> View & Comments
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {STATUSES.filter((s) => s !== task.status).slice(0, 3).map((s) => (
                            <DropdownMenuItem key={s} onClick={() => changeStatus(task.id, s)}>
                              <RefreshCw className="mr-2 h-3.5 w-3.5" /> Mark {s.replace("_", " ")}
                            </DropdownMenuItem>
                          ))}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => openEdit(task)}>
                            <Pencil className="mr-2 h-4 w-4" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => setDeleteTarget(task)}>
                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    No tasks found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Task Detail Sheet */}
      {detailId && (
        <TaskDetailSheet
          taskId={detailId}
          employees={employees ?? []}
          onClose={() => setDetailId(null)}
          onStatusChange={changeStatus}
        />
      )}

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editTarget ? "Edit Task" : "Create Task"}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="title" render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl><Input data-testid="input-task-title" placeholder="Task title" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl><Textarea placeholder="Describe the task..." rows={3} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="priority" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priority</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger data-testid="select-task-priority"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        {PRIORITIES.map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="dueDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Due Date</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="assignedToId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assign To</FormLabel>
                    <Select value={field.value?.toString() ?? ""} onValueChange={(v) => field.onChange(Number(v))}>
                      <FormControl><SelectTrigger data-testid="select-task-assignee"><SelectValue placeholder="Select employee" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {employees?.map((e) => <SelectItem key={e.id} value={e.id.toString()}>{e.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="createdById" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Created By</FormLabel>
                    <Select value={field.value?.toString() ?? ""} onValueChange={(v) => field.onChange(Number(v))}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select creator" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {employees?.map((e) => <SelectItem key={e.id} value={e.id.toString()}>{e.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="departmentId" render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Department</FormLabel>
                    <Select value={field.value?.toString() ?? ""} onValueChange={(v) => field.onChange(Number(v))}>
                      <FormControl><SelectTrigger data-testid="select-task-department"><SelectValue placeholder="Select department" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {departments?.map((d) => <SelectItem key={d.id} value={d.id.toString()}>{d.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="isRecurring" render={({ field }) => (
                <FormItem className="flex items-center gap-3 rounded-lg border p-3">
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} id="is-recurring" />
                  </FormControl>
                  <Label htmlFor="is-recurring" className="cursor-pointer">Recurring Task</Label>
                </FormItem>
              )} />
              {isRecurring && (
                <FormField control={form.control} name="recurringFreq" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Frequency</FormLabel>
                    <Select value={field.value ?? ""} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select frequency" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {FREQS.map((f) => <SelectItem key={f} value={f} className="capitalize">{f}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              )}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button type="submit" data-testid="button-submit-task" disabled={createTask.isPending || updateTask.isPending}>
                  {editTarget ? "Save Changes" : "Create Task"}
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
            <AlertDialogTitle>Delete task?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{deleteTarget?.title}</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Task Detail Sheet ─────────────────────────────────────────────────────────
function TaskDetailSheet({
  taskId,
  employees,
  onClose,
  onStatusChange,
}: {
  taskId: number;
  employees: { id: number; name: string }[];
  onClose: () => void;
  onStatusChange: (id: number, status: string) => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: task, isLoading } = useGetTask(taskId, { query: { queryKey: getGetTaskQueryKey(taskId) } });
  const { data: comments } = useListTaskComments(taskId, { query: { queryKey: getListTaskCommentsQueryKey(taskId) } });
  const addComment = useAddTaskComment();

  const commentForm = useForm<CommentForm>({
    resolver: zodResolver(commentSchema),
    defaultValues: { content: "" },
  });

  function submitComment(values: CommentForm) {
    addComment.mutate({ id: taskId, data: values }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListTaskCommentsQueryKey(taskId) });
        commentForm.reset({ content: "", authorId: values.authorId });
        toast({ title: "Comment added" });
      },
    });
  }

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Task Detail</SheetTitle>
        </SheetHeader>
        {isLoading ? (
          <div className="space-y-4 mt-4">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : task ? (
          <div className="mt-4 space-y-5">
            <div>
              <h3 className="text-lg font-semibold">{task.title}</h3>
              {task.description && <p className="text-sm text-muted-foreground mt-1">{task.description}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-muted-foreground">Assignee:</span> <span className="font-medium">{task.assignedToName}</span></div>
              <div><span className="text-muted-foreground">Department:</span> <span className="font-medium">{task.departmentName}</span></div>
              <div><span className="text-muted-foreground">Priority:</span>
                <span className={`ml-1.5 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${priorityColors[task.priority] ?? ""}`}>{task.priority}</span>
              </div>
              <div><span className="text-muted-foreground">Due:</span> <span className="font-medium">{task.dueDate ? format(new Date(task.dueDate), "MMM d, yyyy") : "—"}</span></div>
              <div><span className="text-muted-foreground">Progress:</span> <span className="font-medium">{task.progressPct}%</span></div>
              {task.isRecurring && <div><span className="text-muted-foreground">Recurring:</span> <span className="font-medium capitalize">{task.recurringFreq}</span></div>}
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-1">Progress</div>
              <Progress value={task.progressPct} className="h-2" />
            </div>
            <div>
              <div className="text-sm font-medium mb-2">Update Status</div>
              <div className="flex flex-wrap gap-2">
                {STATUSES.map((s) => (
                  <Button
                    key={s}
                    size="sm"
                    variant={task.status === s ? "default" : "outline"}
                    className="capitalize text-xs"
                    onClick={() => onStatusChange(taskId, s)}
                    data-testid={`button-status-${s}`}
                  >
                    {s.replace("_", " ")}
                  </Button>
                ))}
              </div>
            </div>

            {/* Comments */}
            <div className="border-t pt-4">
              <h4 className="text-sm font-semibold mb-3">Comments ({comments?.length ?? 0})</h4>
              <div className="space-y-3 mb-4 max-h-48 overflow-y-auto">
                {comments?.map((c) => (
                  <div key={c.id} className="bg-muted rounded-lg p-3 text-sm" data-testid={`comment-${c.id}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium">{c.authorName}</span>
                      <span className="text-xs text-muted-foreground">{format(new Date(c.createdAt), "MMM d, h:mm a")}</span>
                    </div>
                    <p>{c.content}</p>
                  </div>
                ))}
                {!comments?.length && <p className="text-sm text-muted-foreground">No comments yet.</p>}
              </div>
              <Form {...commentForm}>
                <form onSubmit={commentForm.handleSubmit(submitComment)} className="space-y-2">
                  <FormField control={commentForm.control} name="authorId" render={({ field }) => (
                    <FormItem>
                      <Select value={field.value?.toString() ?? ""} onValueChange={(v) => field.onChange(Number(v))}>
                        <FormControl><SelectTrigger className="text-sm" data-testid="select-comment-author"><SelectValue placeholder="Your name" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {employees.map((e) => <SelectItem key={e.id} value={e.id.toString()}>{e.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={commentForm.control} name="content" render={({ field }) => (
                    <FormItem>
                      <FormControl><Textarea placeholder="Write a comment..." rows={2} data-testid="input-comment-content" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <Button type="submit" size="sm" disabled={addComment.isPending} data-testid="button-submit-comment">
                    Add Comment
                  </Button>
                </form>
              </Form>
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

