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
  useHrApproveKra,
  useGetPendingApprovals,
  useListKraDailyLogs,
  useKraDailyCheckIn,
  getListKrasQueryKey,
  getListKraDailyLogsQueryKey,
  getGetPendingApprovalsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus, MoreHorizontal, Pencil, Trash2, Star, Send, CheckCircle2, XCircle,
  Bell, User, Users, ShieldCheck, AlertTriangle, CalendarCheck, Circle,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";

const PERIODS = ["monthly", "quarterly", "yearly"] as const;
const FREQUENCIES = ["daily", "weekly", "bi_weekly", "monthly", "quarterly", "yearly"] as const;
const FREQUENCY_LABELS: Record<string, string> = {
  daily: "Daily", weekly: "Weekly", bi_weekly: "Bi-Weekly",
  monthly: "Monthly", quarterly: "Quarterly", yearly: "Yearly",
};

const kraStatusColors: Record<string, string> = {
  active: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  submitted: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  manager_approved: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  approved: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

const hrStatusColors: Record<string, string> = {
  pending_hr: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  hr_approved: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300",
  hr_rejected: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

const hrStatusLabel: Record<string, string> = {
  pending_hr: "Pending HR",
  hr_approved: "HR Approved",
  hr_rejected: "HR Rejected",
};

const FREQ_NEEDS_DATE = ["monthly", "quarterly", "yearly"] as const;
const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function ordinalSuffix(n: number) {
  const v = n % 100;
  if (v >= 11 && v <= 13) return "th";
  return (["th","st","nd","rd"] as const)[n % 10] ?? "th";
}

function formatDueDateCell(dueDate: string | null | undefined, frequency: string | null | undefined) {
  if (!dueDate || !frequency) return <span className="text-muted-foreground text-sm">—</span>;
  if (frequency === "monthly") {
    const day = parseInt(dueDate, 10);
    return <span className="text-sm">{isNaN(day) ? dueDate : `${day}${ordinalSuffix(day)} of every month`}</span>;
  }
  if (frequency === "yearly") {
    const [dd, mm] = dueDate.split("/");
    const monthName = mm ? (MONTHS_SHORT[parseInt(mm, 10) - 1] ?? mm) : "";
    return <span className="text-sm">{dd} {monthName} every year</span>;
  }
  if (frequency === "quarterly") {
    const parts = dueDate.split(",").map(s => s.trim()).filter(Boolean);
    if (parts.length === 0) return <span className="text-muted-foreground text-sm">—</span>;
    return (
      <div className="text-xs space-y-0.5">
        {parts.map((p, i) => <div key={i}><span className="font-medium">Q{i + 1}:</span> {p}</div>)}
      </div>
    );
  }
  return <span className="text-muted-foreground text-sm">—</span>;
}

function autoFormatDDMM(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

function isValidDDMM(s: string): boolean {
  if (!/^\d{2}\/\d{2}$/.test(s)) return false;
  const [dd, mm] = s.split("/").map(Number);
  return mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31;
}

const kraSchema = z.object({
  title: z.string().min(1, "Title required"),
  description: z.string().optional(),
  weightage: z.number({ required_error: "Weightage required" }).min(0).max(100),
  departmentId: z.number({ required_error: "Department required" }),
  employeeId: z.number().optional(),
  frequency: z.enum(FREQUENCIES),
  dueDate: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.frequency === "monthly") {
    const day = parseInt(data.dueDate ?? "", 10);
    if (!data.dueDate || isNaN(day) || day < 1 || day > 31)
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Enter a valid day between 1 and 31", path: ["dueDate"] });
  }
  if (data.frequency === "yearly") {
    if (!data.dueDate || !isValidDDMM(data.dueDate))
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Enter a valid date as DD/MM — e.g. 31/03", path: ["dueDate"] });
  }
});
type KraForm = z.infer<typeof kraSchema>;

const scoreSchema = z.object({ achievementPct: z.number().min(0).max(100) });
type ScoreForm = z.infer<typeof scoreSchema>;

type KraRow = {
  id: number; title: string; description?: string | null; weightage: number; achievementPct?: number | null;
  departmentId: number; departmentName?: string | null; employeeId?: number | null; employeeName?: string | null;
  reviewPeriod?: string | null; frequency?: string | null; dueDate?: string | null;
  kraStatus: string; hrApprovalStatus?: string | null; submittedAt?: string | null; closedAt?: string | null;
};

// ── Router ──────────────────────────────────────────────────────────────────────
export default function KRAs() {
  const { user } = useAuth();
  if (user?.role === "employee") return <EmployeeKras />;
  const isHR = !!(user?.departmentName?.toLowerCase().includes("hr"));
  if (user?.role === "hod" && isHR) return <HrKras />;
  if (user?.role === "hod") return <HodKras />;
  return <FullKras />;
}

// ── Daily check-in strip for one KRA ─────────────────────────────────────────
function DailyKraCard({ kra, employeeId }: { kra: KraRow; employeeId: number }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const checkIn = useKraDailyCheckIn();

  const todayStr = new Date().toISOString().slice(0, 10);

  // Build last-14-calendar-days window (Mon–Fri shown, weekends skipped visually)
  const days: { date: string; label: string; isWeekend: boolean; isToday: boolean }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    const dow = d.getDay(); // 0=Sun 6=Sat
    days.push({
      date: iso,
      label: ["Su","Mo","Tu","We","Th","Fr","Sa"][dow]!,
      isWeekend: dow === 0 || dow === 6,
      isToday: iso === todayStr,
    });
  }

  const startDate = days[0]!.date;
  const { data: logs } = useListKraDailyLogs(
    { kraId: kra.id, employeeId, startDate, endDate: todayStr },
    { query: { queryKey: getListKraDailyLogsQueryKey({ kraId: kra.id, employeeId, startDate, endDate: todayStr }) } }
  );

  const logMap = new Map((logs ?? []).map((l) => [l.logDate, l.isDone]));
  const todayDone = logMap.get(todayStr) ?? false;

  // Streak: consecutive working days from today backwards where isDone=true
  let streak = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    const d = days[i]!;
    if (d.isWeekend) continue;
    if (logMap.get(d.date) === true) streak++;
    else break;
  }

  function handleToggleToday() {
    checkIn.mutate(
      { data: { kraId: kra.id, employeeId, logDate: todayStr, isDone: !todayDone } },
      {
        onSuccess: (result) => {
          queryClient.invalidateQueries({ queryKey: getListKraDailyLogsQueryKey({ kraId: kra.id, employeeId, startDate, endDate: todayStr }) });
          queryClient.invalidateQueries({ queryKey: getListKrasQueryKey({ employeeId }) });
          toast({
            title: result.isDone ? "✓ Checked in!" : "Check-in removed",
            description: `Achievement: ${result.achievementPct.toFixed(1)}%`,
          });
        },
        onError: () => toast({ title: "Failed to check in", variant: "destructive" }),
      }
    );
  }

  const achievement = kra.achievementPct ?? 0;
  const achievementColor =
    achievement >= 80 ? "text-green-600" :
    achievement >= 60 ? "text-blue-600" :
    achievement >= 40 ? "text-amber-600" :
    achievement > 0   ? "text-red-600"  : "text-muted-foreground";

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm leading-tight truncate">{kra.title}</div>
            {kra.description && <div className="text-xs text-muted-foreground truncate mt-0.5">{kra.description}</div>}
          </div>
          <div className="text-right shrink-0">
            <div className={`text-xl font-bold tabular-nums ${achievementColor}`}>{achievement.toFixed(1)}%</div>
            <div className="text-[10px] text-muted-foreground">Achievement</div>
          </div>
        </div>

        {/* 14-day strip — weekdays only */}
        <div className="flex gap-1.5 flex-wrap">
          {days.filter((d) => !d.isWeekend).map((d) => {
            const done = logMap.get(d.date);
            const isFuture = d.date > todayStr;
            return (
              <div key={d.date} className="flex flex-col items-center gap-0.5">
                <div className="text-[9px] text-muted-foreground">{d.label}</div>
                <div
                  title={d.date}
                  className={`
                    w-6 h-6 rounded-full flex items-center justify-center border-2 transition-colors
                    ${isFuture ? "border-dashed border-muted-foreground/30 bg-transparent" :
                      done === true ? "bg-green-500 border-green-500" :
                      done === false ? "bg-red-100 border-red-300" :
                      "border-muted-foreground/40 bg-muted/40"}
                    ${d.isToday ? "ring-2 ring-offset-1 ring-blue-400" : ""}
                  `}
                >
                  {!isFuture && done === true && <CheckCircle2 className="h-3.5 w-3.5 text-white" />}
                  {!isFuture && done === false && <XCircle className="h-3 w-3 text-red-400" />}
                </div>
                <div className="text-[8px] text-muted-foreground">{d.date.slice(8)}</div>
              </div>
            );
          })}
        </div>

        {/* Footer: streak + button */}
        <div className="flex items-center justify-between gap-2 pt-1">
          <div className="text-xs text-muted-foreground">
            {streak > 0
              ? <span className="font-medium text-green-600">🔥 {streak}-day streak</span>
              : <span>No current streak</span>}
            <span className="mx-1.5">·</span>
            <span>{kra.weightage}% weight</span>
          </div>
          <Button
            size="sm"
            variant={todayDone ? "default" : "outline"}
            className={todayDone ? "bg-green-600 hover:bg-green-700 text-white gap-1.5" : "gap-1.5"}
            disabled={checkIn.isPending || kra.kraStatus === "approved"}
            onClick={handleToggleToday}
          >
            {todayDone ? <><CheckCircle2 className="h-3.5 w-3.5" /> Done Today</> : <><CalendarCheck className="h-3.5 w-3.5" /> Check In</>}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Daily KRAs panel (shown at top of employee view) ─────────────────────────
function DailyKrasPanel({ kras, employeeId }: { kras: KraRow[]; employeeId: number }) {
  const daily = kras.filter((k) => k.frequency === "daily" && k.kraStatus !== "approved");
  if (daily.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <CalendarCheck className="h-5 w-5 text-blue-600" />
        <h3 className="font-semibold text-base">Daily Check-In</h3>
        <Badge variant="secondary" className="text-xs">{daily.length} active</Badge>
      </div>
      <p className="text-xs text-muted-foreground -mt-1">
        Mark each working day as done. Achievement % is calculated automatically: <strong>days done ÷ working days × 100</strong>.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {daily.map((k) => <DailyKraCard key={k.id} kra={k} employeeId={employeeId} />)}
      </div>
    </div>
  );
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
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6 overflow-y-auto">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">My Key Result Areas</h2>
        <p className="text-muted-foreground">Your assigned KRAs. Submit for closure once achieved — requires manager and HOD approval.</p>
      </div>

      {/* Daily check-in panel — shown only when employee has active daily KRAs */}
      {!isLoading && kras && <DailyKrasPanel kras={kras} employeeId={user!.id} />}

      <MyKraTable kras={kras} isLoading={isLoading} onSubmitClosure={setConfirmSubmitId} />
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

// ── Shared: My KRA table (used inside tabs) ────────────────────────────────────
function MyKraTable({
  kras, isLoading, onSubmitClosure,
}: {
  kras: KraRow[] | undefined;
  isLoading: boolean;
  onSubmitClosure: (id: number) => void;
}) {
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>KRA Title</TableHead>
              <TableHead>Frequency</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead>Weightage</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  {[200, 90, 90, 60, 100, 80].map((w, j) => <TableCell key={j}><Skeleton className={`h-4 w-[${w}px]`} /></TableCell>)}
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
                  <TableCell className="text-sm">{FREQUENCY_LABELS[kra.frequency ?? ""] ?? kra.frequency ?? "—"}</TableCell>
                  <TableCell>{formatDueDateCell(kra.dueDate, kra.frequency)}</TableCell>
                  <TableCell>{kra.weightage}%</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${kraStatusColors[kra.kraStatus] ?? ""}`}>
                      {kra.kraStatus.replace("_", " ")}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    {kra.kraStatus === "active" && (
                      <Button size="sm" variant="outline" onClick={() => onSubmitClosure(kra.id)}>
                        <Send className="mr-1.5 h-3.5 w-3.5" /> Submit for Closure
                      </Button>
                    )}
                    {kra.kraStatus === "submitted" && <span className="text-xs text-yellow-600 font-medium">Awaiting Manager</span>}
                    {kra.kraStatus === "manager_approved" && <span className="text-xs text-orange-600 font-medium">Awaiting HOD</span>}
                    {kra.kraStatus === "approved" && <span className="text-xs text-green-600 font-medium">✓ Closed</span>}
                    {kra.kraStatus === "rejected" && (
                      <Button size="sm" variant="outline" onClick={() => onSubmitClosure(kra.id)}>
                        <Send className="mr-1.5 h-3.5 w-3.5" /> Resubmit
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">No KRAs assigned to you yet.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ── HR KRA View (3 tabs) ───────────────────────────────────────────────────────
function HrKras() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const approvalParams = { role: user?.role };
  const { data: myKras, isLoading: loadingMyKras } = useListKras(
    { employeeId: user!.id },
    { query: { queryKey: getListKrasQueryKey({ employeeId: user!.id }) } }
  );
  const { data: allKras, isLoading: loadingAll } = useListKras(
    {},
    { query: { queryKey: getListKrasQueryKey({}) } }
  );
  const { data: pendingData } = useGetPendingApprovals(approvalParams);
  const { data: departments } = useListDepartments();
  const { data: employees } = useListEmployees();

  const submitKra = useSubmitKraForClosure();
  const createKra = useCreateKra();
  const updateKra = useUpdateKra();
  const deleteKra = useDeleteKra();
  const scoreKra = useScoreKra();
  const approveKra = useApproveKraClosure();
  const hrApproveKraMutation = useHrApproveKra();

  const [confirmSubmitId, setConfirmSubmitId] = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<KraRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<KraRow | null>(null);
  const [scoreTarget, setScoreTarget] = useState<KraRow | null>(null);
  const [filterDept, setFilterDept] = useState("all");
  const [filterEmp, setFilterEmp] = useState("all");
  const [qDates, setQDates] = useState(["", "", "", ""]);
  const [qDateErrors, setQDateErrors] = useState(["", "", "", ""]);

  // HR approval: the KRA being reviewed (shows duplicate-check panel)
  const [hrApprovalTarget, setHrApprovalTarget] = useState<typeof krasPendingHrApproval[0] | null>(null);

  const form = useForm<KraForm>({
    resolver: zodResolver(kraSchema),
    defaultValues: { title: "", description: "", weightage: 20, frequency: "monthly", dueDate: "" },
  });
  const scoreForm = useForm<ScoreForm>({ resolver: zodResolver(scoreSchema), defaultValues: { achievementPct: 0 } });

  const selectedDeptId = form.watch("departmentId");
  const watchedFrequency = form.watch("frequency");
  const deptEmployees = employees?.filter((e) => selectedDeptId ? e.departmentId === selectedDeptId : true);

  const krasPendingHrApproval = pendingData?.krasPendingHrApproval ?? [];
  const pendingKraApprovals = pendingData?.kras ?? [];

  const filteredAll = allKras?.filter((k) => {
    if (filterDept !== "all" && k.departmentId !== Number(filterDept)) return false;
    if (filterEmp !== "all" && k.employeeId !== Number(filterEmp)) return false;
    return true;
  });

  function openCreate() {
    setEditTarget(null);
    setQDates(["", "", "", ""]);
    setQDateErrors(["", "", "", ""]);
    form.reset({ title: "", description: "", weightage: 20, frequency: "monthly", dueDate: "" });
    setDialogOpen(true);
  }

  function openEdit(kra: KraRow) {
    setEditTarget(kra);
    const freq = kra.frequency ?? "monthly";
    if (freq === "quarterly" && kra.dueDate) {
      const parts = kra.dueDate.split(",").map(s => s.trim());
      setQDates([parts[0] ?? "", parts[1] ?? "", parts[2] ?? "", parts[3] ?? ""]);
    } else {
      setQDates(["", "", "", ""]);
    }
    setQDateErrors(["", "", "", ""]);
    form.reset({
      title: kra.title, description: kra.description ?? "", weightage: kra.weightage,
      departmentId: kra.departmentId, employeeId: kra.employeeId ?? undefined,
      frequency: freq as typeof FREQUENCIES[number],
      dueDate: freq !== "quarterly" ? (kra.dueDate ?? "") : "",
    });
    setDialogOpen(true);
  }

  function onSubmit(values: KraForm) {
    if (values.frequency === "quarterly") {
      const errors = qDates.map(d => isValidDDMM(d.trim()) ? "" : "Required — enter DD/MM (e.g. 31/03)");
      setQDateErrors(errors);
      if (errors.some(e => e)) return;
    }
    const needsDate = (FREQ_NEEDS_DATE as readonly string[]).includes(values.frequency);
    let dueDateVal: string | undefined;
    if (needsDate) {
      dueDateVal = values.frequency === "quarterly" ? qDates.map(d => d.trim()).join(",") : (values.dueDate || undefined);
    }
    const payload = { ...values, description: values.description || undefined, employeeId: values.employeeId || undefined, dueDate: dueDateVal };
    if (editTarget) {
      updateKra.mutate({ id: editTarget.id, data: payload }, {
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListKrasQueryKey({}) }); setDialogOpen(false); toast({ title: "KRA updated" }); },
      });
    } else {
      createKra.mutate({ data: payload }, {
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListKrasQueryKey({}) }); setDialogOpen(false); toast({ title: "KRA created" }); },
      });
    }
  }

  function onScoreSubmit(values: ScoreForm) {
    if (!scoreTarget) return;
    scoreKra.mutate({ id: scoreTarget.id, data: values }, {
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListKrasQueryKey({}) }); setScoreTarget(null); toast({ title: "Achievement score updated" }); },
    });
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    deleteKra.mutate({ id: deleteTarget.id }, {
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListKrasQueryKey({}) }); setDeleteTarget(null); toast({ title: "KRA deleted" }); },
    });
  }

  function handleMyKraClosure() {
    if (!confirmSubmitId) return;
    submitKra.mutate({ id: confirmSubmitId }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListKrasQueryKey({ employeeId: user!.id }) });
        setConfirmSubmitId(null);
        toast({ title: "KRA submitted for closure." });
      },
    });
  }

  function handleKraApproval(id: number, approved: boolean) {
    approveKra.mutate({ id, data: { approved } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListKrasQueryKey({}) });
        queryClient.invalidateQueries({ queryKey: getGetPendingApprovalsQueryKey(approvalParams) });
        toast({ title: approved ? "KRA closure approved" : "KRA closure rejected" });
      },
    });
  }

  function handleHrApproval(id: number, approved: boolean) {
    hrApproveKraMutation.mutate({ id, data: { approved } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListKrasQueryKey({}) });
        queryClient.invalidateQueries({ queryKey: getGetPendingApprovalsQueryKey(approvalParams) });
        setHrApprovalTarget(null);
        toast({ title: approved ? "KRA approved — can now be assigned to employees." : "KRA rejected by HR." });
      },
    });
  }

  // Existing approved KRAs from the same department as hrApprovalTarget (match by name)
  const existingApprovedInDept = hrApprovalTarget
    ? (allKras ?? []).filter(k => k.departmentName === hrApprovalTarget.departmentName && k.hrApprovalStatus === "hr_approved")
    : [];

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6 overflow-y-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Key Result Areas (KRAs)</h2>
          <p className="text-muted-foreground">HR management view — oversee, approve and maintain all KRAs.</p>
        </div>
        <div className="flex items-center gap-2">
          {krasPendingHrApproval.length > 0 && (
            <Badge variant="destructive" className="gap-1">
              <Bell className="h-3 w-3" /> {krasPendingHrApproval.length} pending HR approval
            </Badge>
          )}
        </div>
      </div>

      <Tabs defaultValue="my-kra" className="space-y-4">
        <TabsList className="flex h-auto flex-wrap gap-1 bg-muted p-1 rounded-lg w-fit">
          <TabsTrigger value="my-kra" className="flex items-center gap-1.5">
            <User className="h-3.5 w-3.5" /> My KRA
          </TabsTrigger>
          <TabsTrigger value="team-kra" className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" /> Team KRA
          </TabsTrigger>
          <TabsTrigger value="kra-approval" className="flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" /> KRA Approval
            {(krasPendingHrApproval.length + pendingKraApprovals.length) > 0 && (
              <Badge className="h-4 min-w-4 px-1 bg-orange-500 text-white text-[10px]">
                {krasPendingHrApproval.length + pendingKraApprovals.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── My KRA tab ── */}
        <TabsContent value="my-kra" className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold">My Key Result Areas</h3>
            <p className="text-sm text-muted-foreground">Your personally assigned KRAs. Submit for closure once achieved.</p>
          </div>
          <MyKraTable kras={myKras} isLoading={loadingMyKras} onSubmitClosure={setConfirmSubmitId} />
        </TabsContent>

        {/* ── Team KRA tab ── */}
        <TabsContent value="team-kra" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">All KRAs</h3>
              <p className="text-sm text-muted-foreground">Company-wide KRA repository. Create, edit, assign and score.</p>
            </div>
            <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> Add KRA</Button>
          </div>
          <div className="flex flex-wrap gap-3">
            <Select value={filterDept} onValueChange={(v) => { setFilterDept(v); setFilterEmp("all"); }}>
              <SelectTrigger className="w-[200px]"><SelectValue placeholder="All Departments" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {departments?.map((d) => <SelectItem key={d.id} value={d.id.toString()}>{d.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterEmp} onValueChange={setFilterEmp}>
              <SelectTrigger className="w-[200px]"><SelectValue placeholder="All Employees" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Employees</SelectItem>
                {(filterDept === "all"
                  ? employees
                  : employees?.filter(e => e.departmentId === Number(filterDept))
                )?.map((e) => <SelectItem key={e.id} value={e.id.toString()}>{e.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <TeamKraTable
            kras={filteredAll}
            isLoading={loadingAll}
            showDeptColumn
            onEdit={openEdit}
            onDelete={setDeleteTarget}
            onScore={(kra) => { setScoreTarget(kra); scoreForm.reset({ achievementPct: kra.achievementPct ?? 0 }); }}
          />
        </TabsContent>

        {/* ── KRA Approval tab ── */}
        <TabsContent value="kra-approval" className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold">KRA Approval Queue</h3>
            <p className="text-sm text-muted-foreground">
              Review new KRAs submitted by HODs for HR approval, and KRA closure requests.
            </p>
          </div>

          {/* HR new-KRA approval queue */}
          {krasPendingHrApproval.length > 0 ? (
            <Card className="border-purple-200 bg-purple-50/50 dark:bg-purple-950/10">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Bell className="h-4 w-4 text-purple-500" />
                  {krasPendingHrApproval.length} New KRA{krasPendingHrApproval.length > 1 ? "s" : ""} Awaiting HR Approval
                </CardTitle>
                <CardDescription className="text-xs">
                  Click "Review &amp; Approve" to check for duplicate KRAs in the same department before approving.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {krasPendingHrApproval.map((kra) => (
                    <div key={kra.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{kra.title}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <p className="text-xs text-muted-foreground">{kra.departmentName}</p>
                          <span className="text-xs text-muted-foreground">·</span>
                          <p className="text-xs text-muted-foreground">{FREQUENCY_LABELS[kra.reviewPeriod ?? ""] ?? kra.reviewPeriod} · {kra.weightage}% weight</p>
                        </div>
                        {kra.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[400px]">{kra.description}</p>
                        )}
                      </div>
                      <div className="flex gap-2 ml-4 shrink-0">
                        <Button
                          size="sm" variant="outline"
                          className="text-purple-600 border-purple-200 h-8"
                          onClick={() => setHrApprovalTarget(kra)}
                        >
                          <ShieldCheck className="h-3.5 w-3.5 mr-1" /> Review &amp; Approve
                        </Button>
                        <Button size="sm" variant="outline" className="text-red-600 border-red-200 h-8" onClick={() => handleHrApproval(kra.id, false)}>
                          <XCircle className="h-3.5 w-3.5 mr-1" /> Reject
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-dashed">
              <CardContent className="py-8 text-center text-muted-foreground text-sm">
                No new KRAs pending HR approval.
              </CardContent>
            </Card>
          )}

          {/* KRA closure approval queue */}
          {pendingKraApprovals.length > 0 && (
            <Card className="border-orange-200 bg-orange-50/50 dark:bg-orange-950/10">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Bell className="h-4 w-4 text-orange-500" />
                  {pendingKraApprovals.length} KRA Closure Request{pendingKraApprovals.length > 1 ? "s" : ""} Pending
                </CardTitle>
                <CardDescription className="text-xs">Review and forward these to HOD for final approval.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {pendingKraApprovals.map((kra) => (
                    <div key={kra.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
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
                      <div className="flex gap-2 ml-3 shrink-0">
                        <Button size="sm" variant="outline" className="text-green-600 border-green-200 h-7 px-2" onClick={() => handleKraApproval(kra.id, true)}>
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Approve
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

          {krasPendingHrApproval.length === 0 && pendingKraApprovals.length === 0 && (
            <Card className="border-dashed">
              <CardContent className="py-8 text-center text-muted-foreground text-sm">
                All caught up — no pending approvals.
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* ── HR Review & Approve dialog (with duplicate check) ── */}
      <Dialog open={!!hrApprovalTarget} onOpenChange={(open) => !open && setHrApprovalTarget(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-purple-500" /> HR KRA Review
            </DialogTitle>
          </DialogHeader>

          {hrApprovalTarget && (
            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {/* KRA being reviewed */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">KRA to Approve</p>
                <div className="rounded-lg border-2 border-purple-200 bg-purple-50/50 dark:bg-purple-950/10 p-4 space-y-2">
                  <p className="font-semibold text-base">{hrApprovalTarget.title}</p>
                  <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                    <span>Dept: <strong className="text-foreground">{hrApprovalTarget.departmentName}</strong></span>
                    <span>Frequency: <strong className="text-foreground">{FREQUENCY_LABELS[hrApprovalTarget.reviewPeriod ?? ""] ?? hrApprovalTarget.reviewPeriod ?? "—"}</strong></span>
                    <span>Weightage: <strong className="text-foreground">{hrApprovalTarget.weightage}%</strong></span>
                  </div>
                  {hrApprovalTarget.description && (
                    <p className="text-sm text-muted-foreground">{hrApprovalTarget.description}</p>
                  )}
                </div>
              </div>

              {/* Existing approved KRAs in same department */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Existing Approved KRAs — {hrApprovalTarget.departmentName}
                  </p>
                  <Badge variant="secondary" className="text-[10px]">{existingApprovedInDept.length} KRAs</Badge>
                </div>

                {existingApprovedInDept.length > 0 ? (
                  <div className="space-y-1.5 max-h-56 overflow-y-auto border rounded-lg p-2">
                    {existingApprovedInDept.map((k) => {
                      const titleLower = k.title.toLowerCase();
                      const newLower = hrApprovalTarget.title.toLowerCase();
                      const similarWords = newLower.split(/\s+/).filter(w => w.length > 3 && titleLower.includes(w));
                      const isPotentialDupe = similarWords.length >= 2 || titleLower === newLower;
                      return (
                        <div key={k.id} className={`flex items-start gap-2 rounded-md p-2 ${isPotentialDupe ? "bg-red-50 border border-red-200 dark:bg-red-950/20 dark:border-red-800" : "bg-muted/30"}`}>
                          {isPotentialDupe && <AlertTriangle className="h-3.5 w-3.5 text-red-500 mt-0.5 shrink-0" />}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{k.title}
                              {isPotentialDupe && <span className="ml-2 text-[10px] font-semibold text-red-600 bg-red-100 px-1.5 py-0.5 rounded-full">Possible Duplicate</span>}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {k.employeeName ? `Assigned: ${k.employeeName}` : "Dept-wide"} · {FREQUENCY_LABELS[k.frequency ?? ""] ?? k.frequency} · {k.weightage}%
                            </p>
                          </div>
                          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium shrink-0 ${kraStatusColors[k.kraStatus] ?? ""}`}>
                            {k.kraStatus.replace("_", " ")}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="border border-dashed rounded-lg p-3 text-center text-xs text-muted-foreground">
                    No existing approved KRAs in {hrApprovalTarget.departmentName} — no duplicate risk.
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="border-t pt-4 mt-2">
            <Button variant="outline" onClick={() => setHrApprovalTarget(null)}>Cancel</Button>
            <Button
              variant="outline"
              className="text-red-600 border-red-200 hover:bg-red-50"
              disabled={hrApproveKraMutation.isPending}
              onClick={() => hrApprovalTarget && handleHrApproval(hrApprovalTarget.id, false)}
            >
              <XCircle className="h-3.5 w-3.5 mr-1.5" /> Reject KRA
            </Button>
            <Button
              className="bg-purple-600 hover:bg-purple-700 text-white"
              disabled={hrApproveKraMutation.isPending}
              onClick={() => hrApprovalTarget && handleHrApproval(hrApprovalTarget.id, true)}
            >
              <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" /> Approve KRA
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Submit for closure confirmation */}
      <AlertDialog open={!!confirmSubmitId} onOpenChange={(open) => !open && setConfirmSubmitId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit KRA for Closure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will send a closure request to your manager for review.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleMyKraClosure} disabled={submitKra.isPending}>Submit for Closure</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* KRA Create/Edit dialog */}
      <KraFormDialog
        open={dialogOpen} onOpenChange={setDialogOpen}
        editTarget={editTarget} form={form} departments={departments ?? []} deptEmployees={deptEmployees ?? []}
        watchedFrequency={watchedFrequency} qDates={qDates} setQDates={setQDates}
        qDateErrors={qDateErrors} setQDateErrors={setQDateErrors}
        onSubmit={onSubmit} isPending={createKra.isPending || updateKra.isPending}
      />

      {/* Score dialog */}
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

      {/* Delete confirmation */}
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

// ── HOD KRA View (2 tabs) ──────────────────────────────────────────────────────
function HodKras() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const deptFilter = { departmentId: user?.departmentId ?? undefined };
  const approvalParams = { departmentId: user?.departmentId ?? undefined, role: user?.role };

  const { data: myKras, isLoading: loadingMyKras } = useListKras(
    { employeeId: user!.id },
    { query: { queryKey: getListKrasQueryKey({ employeeId: user!.id }) } }
  );
  const { data: deptKras, isLoading: loadingDept } = useListKras(
    deptFilter,
    { query: { queryKey: getListKrasQueryKey(deptFilter) } }
  );
  const { data: pendingData } = useGetPendingApprovals(approvalParams);
  const { data: departments } = useListDepartments();
  const { data: employees } = useListEmployees();

  const submitKra = useSubmitKraForClosure();
  const createKra = useCreateKra();
  const updateKra = useUpdateKra();
  const deleteKra = useDeleteKra();
  const approveKra = useApproveKraClosure();

  const [confirmSubmitId, setConfirmSubmitId] = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<KraRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<KraRow | null>(null);
  const [qDates, setQDates] = useState(["", "", "", ""]);
  const [qDateErrors, setQDateErrors] = useState(["", "", "", ""]);

  const form = useForm<KraForm>({
    resolver: zodResolver(kraSchema),
    defaultValues: { title: "", description: "", weightage: 20, frequency: "monthly", dueDate: "" },
  });

  const selectedDeptId = form.watch("departmentId");
  const watchedFrequency = form.watch("frequency");
  const deptEmployees = employees?.filter((e) => selectedDeptId ? e.departmentId === selectedDeptId : true);

  const pendingKraApprovals = pendingData?.kras ?? [];

  function openCreate() {
    setEditTarget(null);
    setQDates(["", "", "", ""]);
    setQDateErrors(["", "", "", ""]);
    form.reset({
      title: "", description: "", weightage: 20, frequency: "monthly", dueDate: "",
      departmentId: user?.departmentId ?? undefined,
    });
    setDialogOpen(true);
  }

  function openEdit(kra: KraRow) {
    setEditTarget(kra);
    const freq = kra.frequency ?? "monthly";
    if (freq === "quarterly" && kra.dueDate) {
      const parts = kra.dueDate.split(",").map(s => s.trim());
      setQDates([parts[0] ?? "", parts[1] ?? "", parts[2] ?? "", parts[3] ?? ""]);
    } else {
      setQDates(["", "", "", ""]);
    }
    setQDateErrors(["", "", "", ""]);
    form.reset({
      title: kra.title, description: kra.description ?? "", weightage: kra.weightage,
      departmentId: kra.departmentId, employeeId: kra.employeeId ?? undefined,
      frequency: freq as typeof FREQUENCIES[number],
      dueDate: freq !== "quarterly" ? (kra.dueDate ?? "") : "",
    });
    setDialogOpen(true);
  }

  function onSubmit(values: KraForm) {
    if (values.frequency === "quarterly") {
      const errors = qDates.map(d => isValidDDMM(d.trim()) ? "" : "Required — enter DD/MM (e.g. 31/03)");
      setQDateErrors(errors);
      if (errors.some(e => e)) return;
    }
    const needsDate = (FREQ_NEEDS_DATE as readonly string[]).includes(values.frequency);
    let dueDateVal: string | undefined;
    if (needsDate) {
      dueDateVal = values.frequency === "quarterly" ? qDates.map(d => d.trim()).join(",") : (values.dueDate || undefined);
    }
    const payload = { ...values, description: values.description || undefined, employeeId: values.employeeId || undefined, dueDate: dueDateVal };
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

  function confirmDelete() {
    if (!deleteTarget) return;
    deleteKra.mutate({ id: deleteTarget.id }, {
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListKrasQueryKey(deptFilter) }); setDeleteTarget(null); toast({ title: "KRA deleted" }); },
    });
  }

  function handleMyKraClosure() {
    if (!confirmSubmitId) return;
    submitKra.mutate({ id: confirmSubmitId }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListKrasQueryKey({ employeeId: user!.id }) });
        setConfirmSubmitId(null);
        toast({ title: "KRA submitted for closure." });
      },
    });
  }

  function handleKraApproval(id: number, approved: boolean) {
    approveKra.mutate({ id, data: { approved } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListKrasQueryKey(deptFilter) });
        queryClient.invalidateQueries({ queryKey: getGetPendingApprovalsQueryKey(approvalParams) });
        toast({ title: approved ? "KRA closure approved (final)" : "KRA closure rejected" });
      },
    });
  }

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6 overflow-y-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Key Result Areas (KRAs)</h2>
          <p className="text-muted-foreground">Manage and monitor KRAs for your department.</p>
        </div>
        {pendingKraApprovals.length > 0 && (
          <Badge variant="destructive" className="gap-1">
            <Bell className="h-3 w-3" /> {pendingKraApprovals.length} awaiting approval
          </Badge>
        )}
      </div>

      <Tabs defaultValue="my-kra" className="space-y-4">
        <TabsList className="flex h-auto flex-wrap gap-1 bg-muted p-1 rounded-lg w-fit">
          <TabsTrigger value="my-kra" className="flex items-center gap-1.5">
            <User className="h-3.5 w-3.5" /> My KRA
          </TabsTrigger>
          <TabsTrigger value="team-kra" className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" /> Team KRA
            {pendingKraApprovals.length > 0 && (
              <Badge className="h-4 min-w-4 px-1 bg-orange-500 text-white text-[10px]">{pendingKraApprovals.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── My KRA tab ── */}
        <TabsContent value="my-kra" className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold">My Key Result Areas</h3>
            <p className="text-sm text-muted-foreground">Your personally assigned KRAs. Submit for closure once achieved.</p>
          </div>
          <MyKraTable kras={myKras} isLoading={loadingMyKras} onSubmitClosure={setConfirmSubmitId} />
        </TabsContent>

        {/* ── Team KRA tab ── */}
        <TabsContent value="team-kra" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Department KRAs</h3>
              <p className="text-sm text-muted-foreground">Create, assign, and give final approval on KRA closures.</p>
            </div>
            <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> Add KRA</Button>
          </div>

          {/* Pending closure approvals inline */}
          {pendingKraApprovals.length > 0 && (
            <Card className="border-orange-200 bg-orange-50/50 dark:bg-orange-950/10">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Bell className="h-4 w-4 text-orange-500" />
                  {pendingKraApprovals.length} KRA Closure Request{pendingKraApprovals.length > 1 ? "s" : ""} — Final HOD Approval
                </CardTitle>
                <CardDescription className="text-xs">These have been approved by the manager and need your final sign-off.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {pendingKraApprovals.map((kra) => (
                    <div key={kra.id} className="flex items-center justify-between p-2.5 rounded-lg border bg-card">
                      <div>
                        <p className="text-sm font-medium">{kra.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <p className="text-xs text-muted-foreground">{kra.employeeName}</p>
                          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${kraStatusColors[kra.kraStatus] ?? ""}`}>
                            {kra.kraStatus.replace("_", " ")}
                          </span>
                          {kra.achievementPct != null && <span className="text-xs text-muted-foreground">Achievement: {kra.achievementPct}%</span>}
                        </div>
                      </div>
                      <div className="flex gap-2 ml-3 shrink-0">
                        <Button size="sm" variant="outline" className="text-green-600 border-green-200 h-7 px-2" onClick={() => handleKraApproval(kra.id, true)}>
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Final Approve
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

          <TeamKraTable
            kras={deptKras}
            isLoading={loadingDept}
            showDeptColumn={false}
            onEdit={openEdit}
            onDelete={setDeleteTarget}
          />
        </TabsContent>
      </Tabs>

      {/* Submit for closure confirmation */}
      <AlertDialog open={!!confirmSubmitId} onOpenChange={(open) => !open && setConfirmSubmitId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit KRA for Closure?</AlertDialogTitle>
            <AlertDialogDescription>This will send a closure request to your manager for review.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleMyKraClosure} disabled={submitKra.isPending}>Submit for Closure</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <KraFormDialog
        open={dialogOpen} onOpenChange={setDialogOpen}
        editTarget={editTarget} form={form} departments={departments ?? []} deptEmployees={deptEmployees ?? []}
        watchedFrequency={watchedFrequency} qDates={qDates} setQDates={setQDates}
        qDateErrors={qDateErrors} setQDateErrors={setQDateErrors}
        onSubmit={onSubmit} isPending={createKra.isPending || updateKra.isPending}
        lockDepartment
      />

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

// ── Shared: Team KRA table ─────────────────────────────────────────────────────
function TeamKraTable({
  kras, isLoading, showDeptColumn, onEdit, onDelete, onScore,
}: {
  kras: KraRow[] | undefined;
  isLoading: boolean;
  showDeptColumn: boolean;
  onEdit: (kra: KraRow) => void;
  onDelete: (kra: KraRow) => void;
  onScore?: (kra: KraRow) => void;
}) {
  const colCount = showDeptColumn ? 8 : 7;
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              {showDeptColumn && <TableHead>Department</TableHead>}
              <TableHead>Assignee</TableHead>
              <TableHead>Frequency</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead>Weightage</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: colCount }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}
                </TableRow>
              ))
            ) : kras?.length ? (
              kras.map((kra) => (
                <TableRow key={kra.id}>
                  <TableCell className="font-medium">
                    <div>
                      <div>{kra.title}</div>
                      {kra.description && <div className="text-xs text-muted-foreground truncate max-w-[200px]">{kra.description}</div>}
                    </div>
                  </TableCell>
                  {showDeptColumn && <TableCell>{kra.departmentName}</TableCell>}
                  <TableCell>
                    {kra.hrApprovalStatus === "hr_approved"
                      ? (kra.employeeName || <span className="text-muted-foreground text-sm">Dept-wide</span>)
                      : <span className="text-muted-foreground text-sm italic">Unassigned</span>
                    }
                  </TableCell>
                  <TableCell className="text-sm">{FREQUENCY_LABELS[kra.frequency ?? ""] ?? kra.frequency ?? "—"}</TableCell>
                  <TableCell>{formatDueDateCell(kra.dueDate, kra.frequency)}</TableCell>
                  <TableCell>{kra.weightage}%</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${kraStatusColors[kra.kraStatus] ?? ""}`}>
                        {kra.kraStatus.replace(/_/g, " ")}
                      </span>
                      {kra.hrApprovalStatus && (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${hrStatusColors[kra.hrApprovalStatus] ?? ""}`}>
                          {hrStatusLabel[kra.hrApprovalStatus] ?? kra.hrApprovalStatus}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {onScore && (
                          <>
                            <DropdownMenuItem onClick={() => onScore(kra)}>
                              <Star className="mr-2 h-4 w-4" /> Update Score
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                          </>
                        )}
                        <DropdownMenuItem onClick={() => onEdit(kra)}>
                          <Pencil className="mr-2 h-4 w-4" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => onDelete(kra)}>
                          <Trash2 className="mr-2 h-4 w-4" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={colCount} className="h-24 text-center text-muted-foreground">No KRAs found.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ── Shared: KRA Form Dialog ────────────────────────────────────────────────────
type KraFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editTarget: KraRow | null;
  form: ReturnType<typeof useForm<KraForm>>;
  departments: { id: number; name: string }[];
  deptEmployees: { id: number; name: string }[];
  watchedFrequency: string;
  qDates: string[];
  setQDates: (fn: (prev: string[]) => string[]) => void;
  qDateErrors: string[];
  setQDateErrors: (fn: (prev: string[]) => string[]) => void;
  onSubmit: (values: KraForm) => void;
  isPending: boolean;
  lockDepartment?: boolean;
};

function KraFormDialog({
  open, onOpenChange, editTarget, form, departments, deptEmployees,
  watchedFrequency, qDates, setQDates, qDateErrors, setQDateErrors,
  onSubmit, isPending, lockDepartment,
}: KraFormDialogProps) {
  const selectedDeptId = form.watch("departmentId");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
              <FormField control={form.control} name="frequency" render={({ field }) => (
                <FormItem><FormLabel>Monitoring Frequency</FormLabel>
                  <Select value={field.value} onValueChange={(v) => { field.onChange(v); form.setValue("dueDate", ""); setQDates(() => ["", "", "", ""]); }}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>{FREQUENCIES.map((f) => <SelectItem key={f} value={f}>{FREQUENCY_LABELS[f]}</SelectItem>)}</SelectContent>
                  </Select><FormMessage />
                </FormItem>
              )} />
              {watchedFrequency === "monthly" && (
                <FormField control={form.control} name="dueDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Day of Month</FormLabel>
                    <FormControl>
                      <div className="flex items-center gap-2">
                        <Input type="number" min={1} max={31} placeholder="e.g. 15" {...field} className="w-24" />
                        <span className="text-sm text-muted-foreground">of every month</span>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              )}
              {watchedFrequency === "yearly" && (
                <FormField control={form.control} name="dueDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Annual Date <span className="text-xs text-muted-foreground">(DD/MM)</span></FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. 31/03" maxLength={5} {...field} onChange={(e) => field.onChange(autoFormatDDMM(e.target.value))} className="w-32" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              )}
              {watchedFrequency === "quarterly" && (
                <div className="col-span-2 space-y-2">
                  <p className="text-sm font-medium leading-none">Quarterly Dates <span className="text-xs font-normal text-muted-foreground">(DD/MM for each quarter)</span></p>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                    {(["Q1", "Q2", "Q3", "Q4"] as const).map((q, i) => (
                      <div key={q} className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium w-7 shrink-0">{q}</span>
                          <Input
                            placeholder="DD/MM" maxLength={5}
                            value={qDates[i]}
                            onChange={(e) => {
                              const v = autoFormatDDMM(e.target.value);
                              setQDates(prev => prev.map((old, idx) => idx === i ? v : old));
                              if (qDateErrors[i]) setQDateErrors(prev => prev.map((err, idx) => idx === i ? "" : err));
                            }}
                            className={qDateErrors[i] ? "border-destructive focus-visible:ring-destructive" : ""}
                          />
                        </div>
                        {qDateErrors[i] && <p className="text-xs text-destructive pl-9">{qDateErrors[i]}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {lockDepartment ? (
                <FormField control={form.control} name="departmentId" render={({ field }) => (
                  <FormItem><FormLabel>Department</FormLabel>
                    <div className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm bg-muted text-muted-foreground">
                      {departments.find(d => d.id === field.value)?.name ?? "Your department"}
                    </div>
                  </FormItem>
                )} />
              ) : (
                <FormField control={form.control} name="departmentId" render={({ field }) => (
                  <FormItem><FormLabel>Department</FormLabel>
                    <Select value={field.value?.toString() ?? ""} onValueChange={(v) => { field.onChange(Number(v)); form.setValue("employeeId", undefined); }}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select dept." /></SelectTrigger></FormControl>
                      <SelectContent>{departments.map((d) => <SelectItem key={d.id} value={d.id.toString()}>{d.name}</SelectItem>)}</SelectContent>
                    </Select><FormMessage />
                  </FormItem>
                )} />
              )}
              {editTarget && editTarget.hrApprovalStatus !== "hr_approved" ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium leading-none">Assign to Employee</p>
                  <div className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${hrStatusColors[editTarget.hrApprovalStatus ?? "pending_hr"]} opacity-80`}>
                    {editTarget.hrApprovalStatus === "hr_rejected"
                      ? "Assignment blocked — HR rejected this KRA."
                      : "Assignment locked — awaiting HR approval."}
                  </div>
                </div>
              ) : (
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
                        {deptEmployees.map((e) => <SelectItem key={e.id} value={e.id.toString()}>{e.name}</SelectItem>)}
                      </SelectContent>
                    </Select><FormMessage />
                  </FormItem>
                )} />
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={isPending}>{editTarget ? "Save Changes" : "Create KRA"}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ── Full KRA View (Manager / Management) ──────────────────────────────────────
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
  const approveKra = useApproveKraClosure();
  const hrApproveKraMutation = useHrApproveKra();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<KraRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<KraRow | null>(null);
  const [filterDept, setFilterDept] = useState("all");
  const [filterEmp, setFilterEmp] = useState("all");
  const [qDates, setQDates] = useState(["", "", "", ""]);
  const [qDateErrors, setQDateErrors] = useState(["", "", "", ""]);

  const form = useForm<KraForm>({
    resolver: zodResolver(kraSchema),
    defaultValues: { title: "", description: "", weightage: 20, frequency: "monthly", dueDate: "" },
  });

  const selectedDeptId = form.watch("departmentId");
  const watchedFrequency = form.watch("frequency");
  const deptEmployees = employees?.filter((e) => selectedDeptId ? e.departmentId === selectedDeptId : true);

  const pendingKraApprovals = pendingData?.kras ?? [];
  const krasPendingHrApproval = pendingData?.krasPendingHrApproval ?? [];

  function openCreate() {
    setEditTarget(null);
    setQDates(["", "", "", ""]);
    setQDateErrors(["", "", "", ""]);
    form.reset({
      title: "", description: "", weightage: 20, frequency: "monthly", dueDate: "",
      departmentId: user?.role === "hod" ? (user.departmentId ?? undefined) : undefined,
    });
    setDialogOpen(true);
  }

  function openEdit(kra: KraRow) {
    setEditTarget(kra);
    const freq = kra.frequency ?? "monthly";
    if (freq === "quarterly" && kra.dueDate) {
      const parts = kra.dueDate.split(",").map(s => s.trim());
      setQDates([parts[0] ?? "", parts[1] ?? "", parts[2] ?? "", parts[3] ?? ""]);
    } else {
      setQDates(["", "", "", ""]);
    }
    setQDateErrors(["", "", "", ""]);
    form.reset({
      title: kra.title, description: kra.description ?? "", weightage: kra.weightage,
      departmentId: kra.departmentId, employeeId: kra.employeeId ?? undefined,
      frequency: freq as typeof FREQUENCIES[number],
      dueDate: freq !== "quarterly" ? (kra.dueDate ?? "") : "",
    });
    setDialogOpen(true);
  }

  function onSubmit(values: KraForm) {
    if (values.frequency === "quarterly") {
      const errors = qDates.map(d => isValidDDMM(d.trim()) ? "" : "Required — enter DD/MM (e.g. 31/03)");
      setQDateErrors(errors);
      if (errors.some(e => e)) return;
    }
    const needsDate = (FREQ_NEEDS_DATE as readonly string[]).includes(values.frequency);
    let dueDateVal: string | undefined;
    if (needsDate) {
      dueDateVal = values.frequency === "quarterly" ? qDates.map(d => d.trim()).join(",") : (values.dueDate || undefined);
    }
    const payload = { ...values, description: values.description || undefined, employeeId: values.employeeId || undefined, dueDate: dueDateVal };
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

  function handleHrApproval(id: number, approved: boolean) {
    hrApproveKraMutation.mutate({ id, data: { approved } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListKrasQueryKey(deptFilter) });
        queryClient.invalidateQueries({ queryKey: getGetPendingApprovalsQueryKey(approvalParams) });
        toast({ title: approved ? "KRA approved by HR." : "KRA rejected by HR." });
      },
    });
  }

  const filtered = kras?.filter((k) => {
    if (filterDept !== "all" && k.departmentId !== Number(filterDept)) return false;
    if (filterEmp !== "all" && k.employeeId !== Number(filterEmp)) return false;
    return true;
  });

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6 overflow-y-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Key Result Areas (KRAs)</h2>
          <p className="text-muted-foreground">Define responsibilities and measure achievement progress.</p>
        </div>
        {user?.role === "hod" && (
          <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> Add KRA</Button>
        )}
      </div>

      {krasPendingHrApproval.length > 0 && (
        <Card className="border-purple-200 bg-purple-50/50 dark:bg-purple-950/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Bell className="h-4 w-4 text-purple-500" /> {krasPendingHrApproval.length} KRA{krasPendingHrApproval.length > 1 ? "s" : ""} Awaiting HR Approval
            </CardTitle>
            <CardDescription className="text-xs">New KRAs require HR approval before assignment.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {krasPendingHrApproval.map((kra) => (
                <div key={kra.id} className="flex items-center justify-between p-2.5 rounded-lg border bg-card">
                  <div>
                    <p className="text-sm font-medium">{kra.title}</p>
                    <p className="text-xs text-muted-foreground">{kra.departmentName} · {FREQUENCY_LABELS[kra.reviewPeriod ?? ""] ?? kra.reviewPeriod} · {kra.weightage}% weight</p>
                    {kra.description && <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[340px]">{kra.description}</p>}
                  </div>
                  <div className="flex gap-2 ml-3 shrink-0">
                    <Button size="sm" variant="outline" className="text-green-600 border-green-200 h-7 px-2" onClick={() => handleHrApproval(kra.id, true)}>
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Approve
                    </Button>
                    <Button size="sm" variant="outline" className="text-red-600 border-red-200 h-7 px-2" onClick={() => handleHrApproval(kra.id, false)}>
                      <XCircle className="h-3.5 w-3.5 mr-1" /> Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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
                  <div className="flex gap-2 ml-3 shrink-0">
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
        <div className="flex flex-wrap gap-3">
          <Select value={filterDept} onValueChange={(v) => { setFilterDept(v); setFilterEmp("all"); }}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="All Departments" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {departments?.map((d) => <SelectItem key={d.id} value={d.id.toString()}>{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterEmp} onValueChange={setFilterEmp}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="All Employees" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Employees</SelectItem>
              {(filterDept === "all"
                ? employees
                : employees?.filter(e => e.departmentId === Number(filterDept))
              )?.map((e) => <SelectItem key={e.id} value={e.id.toString()}>{e.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      <TeamKraTable
        kras={filtered}
        isLoading={isLoading}
        showDeptColumn={user?.role !== "hod"}
        onEdit={openEdit}
        onDelete={setDeleteTarget}
      />

      <KraFormDialog
        open={dialogOpen} onOpenChange={setDialogOpen}
        editTarget={editTarget} form={form} departments={departments ?? []} deptEmployees={deptEmployees ?? []}
        watchedFrequency={watchedFrequency} qDates={qDates} setQDates={setQDates}
        qDateErrors={qDateErrors} setQDateErrors={setQDateErrors}
        onSubmit={onSubmit} isPending={createKra.isPending || updateKra.isPending}
      />

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
