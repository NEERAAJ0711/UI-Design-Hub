import { useRef, useState } from "react";
import {
  useListEmployees,
  useListDepartments,
  useCreateEmployee,
  useUpdateEmployee,
  useDeleteEmployee,
  useListDesignations,
  useListCompanies,
  useBulkUploadEmployees,
  getListEmployeesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Plus, MoreHorizontal, Pencil, Trash2, Lock,
  Upload, Download, FileSpreadsheet, CheckCircle2, XCircle, AlertCircle, ChevronRight,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";

const ROLES = ["management", "hod", "manager", "employee"] as const;

const empSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email required"),
  role: z.enum(ROLES),
  designation: z.string().optional(),
  company: z.string().optional(),
  departmentId: z.number({ required_error: "Department required" }),
  managerId: z.number().optional(),
  phone: z.string().optional(),
  joiningDate: z.string().optional(),
});
type EmpForm = z.infer<typeof empSchema>;

type Employee = {
  id: number; name: string; email: string; role: string; designation?: string | null;
  company?: string | null; departmentId: number; departmentName: string;
  managerId?: number | null; managerName?: string | null; phone?: string | null; joiningDate?: string | null;
};

const roleColors: Record<string, string> = {
  management: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  hod: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  manager: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  employee: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
};

// ── CSV helpers ──────────────────────────────────────────────────────────────

const CSV_HEADERS = ["name", "email", "role", "department", "designation", "company", "phone", "joiningDate"] as const;
type CsvRow = { name: string; email: string; role: string; department: string; designation: string; company: string; phone: string; joiningDate: string };

function parseCsv(text: string): CsvRow[] {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/\s+/g, ""));
  return lines.slice(1).map((line) => {
    const cells = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = cells[i] ?? ""; });
    return {
      name: row["name"] ?? "",
      email: row["email"] ?? "",
      role: row["role"] ?? "employee",
      department: row["department"] ?? "",
      designation: row["designation"] ?? "",
      company: row["company"] ?? "",
      phone: row["phone"] ?? "",
      joiningDate: row["joiningdate"] ?? row["joining_date"] ?? row["joiningDate"] ?? "",
    };
  });
}

function validateRow(row: CsvRow, deptNames: Set<string>): string[] {
  const errs: string[] = [];
  if (!row.name.trim()) errs.push("Name required");
  if (!row.email.trim() || !/\S+@\S+\.\S+/.test(row.email)) errs.push("Valid email required");
  if (!row.department.trim()) errs.push("Department required");
  else if (!deptNames.has(row.department.toLowerCase().trim())) errs.push(`Unknown dept: "${row.department}"`);
  if (row.role && !["management", "hod", "manager", "employee"].includes(row.role.toLowerCase()))
    errs.push("Role must be management/hod/manager/employee");
  return errs;
}

function downloadTemplate(deptNames: string[]) {
  const header = CSV_HEADERS.join(",");
  const sample = [
    "Rahul Sharma",
    "rahul.sharma@rpsgroup.com",
    "employee",
    deptNames[0] ?? "HR",
    "Executive",
    "RPS Infrastructure Limited",
    "+91-9876543210",
    "2025-01-15",
  ].join(",");
  const csv = [header, sample].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "employee_bulk_upload_template.csv"; a.click();
  URL.revokeObjectURL(url);
}

// ── BulkUploadDialog ─────────────────────────────────────────────────────────

type BulkStep = "upload" | "preview" | "result";

interface BulkResult {
  total: number; created: number; failed: number;
  errors: Array<{ row: number; name?: string; email?: string; error: string }>;
}

function BulkUploadDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: departments } = useListDepartments();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const bulkUpload = useBulkUploadEmployees();

  const [step, setStep] = useState<BulkStep>("upload");
  const [fileName, setFileName] = useState<string>("");
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [result, setResult] = useState<BulkResult | null>(null);

  const deptNames = new Set((departments ?? []).map((d) => d.name.toLowerCase().trim()));
  const deptNamesList = (departments ?? []).map((d) => d.name);

  const rowValidations = rows.map((r) => validateRow(r, deptNames));
  const validCount = rowValidations.filter((e) => e.length === 0).length;
  const invalidCount = rowValidations.filter((e) => e.length > 0).length;

  function handleFile(file: File) {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parseCsv(text);
      setRows(parsed);
      setStep("preview");
    };
    reader.readAsText(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith(".csv")) handleFile(file);
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  function doUpload() {
    bulkUpload.mutate(
      { data: { rows: rows.map((r) => ({ ...r, role: r.role || "employee" })) } },
      {
        onSuccess: (data) => {
          setResult(data as BulkResult);
          setStep("result");
          queryClient.invalidateQueries({ queryKey: getListEmployeesQueryKey() });
          if ((data as BulkResult).created > 0)
            toast({ title: `${(data as BulkResult).created} employee(s) added successfully` });
        },
        onError: () => toast({ title: "Upload failed", variant: "destructive" }),
      }
    );
  }

  function reset() {
    setStep("upload");
    setFileName("");
    setRows([]);
    setResult(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function handleClose() {
    reset();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-blue-600" />
            Bulk Employee Upload
          </DialogTitle>
          <DialogDescription>
            Upload a CSV file to add multiple employees at once. Each employee gets a default password of{" "}
            <code className="bg-muted px-1 rounded text-xs font-mono">Password@123</code>.
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-1 text-sm">
          {(["upload", "preview", "result"] as BulkStep[]).map((s, i) => (
            <div key={s} className="flex items-center gap-1">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors ${
                step === s ? "border-blue-600 bg-blue-600 text-white"
                  : (step === "preview" && s === "upload") || step === "result"
                    ? "border-green-500 bg-green-500 text-white" : "border-muted-foreground/30 text-muted-foreground"
              }`}>{i + 1}</div>
              <span className={`text-xs capitalize ${step === s ? "text-blue-600 font-semibold" : "text-muted-foreground"}`}>
                {s === "upload" ? "Upload" : s === "preview" ? "Preview" : "Results"}
              </span>
              {i < 2 && <ChevronRight className="h-3 w-3 text-muted-foreground/40 mx-0.5" />}
            </div>
          ))}
        </div>

        <div className="flex-1 overflow-hidden">

          {/* STEP 1: Upload */}
          {step === "upload" && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-sm text-muted-foreground">
                  Download the template, fill it in, then upload the CSV.
                </p>
                <Button variant="outline" size="sm" onClick={() => downloadTemplate(deptNamesList)}>
                  <Download className="mr-1.5 h-3.5 w-3.5" /> Download Template
                </Button>
              </div>

              {/* Department hint */}
              <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-3 text-xs text-blue-800 dark:text-blue-300">
                <p className="font-semibold mb-1">Available Departments:</p>
                <p className="flex flex-wrap gap-1">
                  {deptNamesList.map((d) => (
                    <span key={d} className="bg-blue-100 dark:bg-blue-900 px-1.5 py-0.5 rounded font-mono">{d}</span>
                  ))}
                </p>
              </div>

              {/* CSV columns hint */}
              <div className="rounded-lg border border-dashed border-muted-foreground/30 p-3">
                <p className="text-xs text-muted-foreground font-medium mb-1">Required CSV Columns:</p>
                <div className="flex flex-wrap gap-1.5">
                  {CSV_HEADERS.map((h) => (
                    <span key={h} className={`text-[11px] px-2 py-0.5 rounded font-mono ${
                      ["name", "email", "role", "department"].includes(h)
                        ? "bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-700"
                        : "bg-muted text-muted-foreground"
                    }`}>
                      {h}{["name", "email", "role", "department"].includes(h) ? " *" : ""}
                    </span>
                  ))}
                </div>
              </div>

              {/* Drop zone */}
              <div
                className="border-2 border-dashed border-muted-foreground/25 rounded-xl p-10 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 transition-colors"
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-sm font-medium text-muted-foreground">
                  Drag & drop your CSV file here
                </p>
                <p className="text-xs text-muted-foreground/60 mt-1">or click to browse</p>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleFileInput}
                />
              </div>
            </div>
          )}

          {/* STEP 2: Preview */}
          {step === "preview" && (
            <div className="space-y-3 flex flex-col h-full">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-muted-foreground">File: <strong>{fileName}</strong></span>
                  <span className="flex items-center gap-1 text-green-600 font-medium">
                    <CheckCircle2 className="h-3.5 w-3.5" /> {validCount} valid
                  </span>
                  {invalidCount > 0 && (
                    <span className="flex items-center gap-1 text-red-500 font-medium">
                      <XCircle className="h-3.5 w-3.5" /> {invalidCount} invalid
                    </span>
                  )}
                </div>
                <Button variant="ghost" size="sm" onClick={reset}>Change file</Button>
              </div>

              {invalidCount > 0 && (
                <div className="flex items-start gap-2 rounded-lg bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 px-3 py-2 text-xs text-yellow-800 dark:text-yellow-300">
                  <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <span>Invalid rows will be skipped. Only valid rows will be uploaded. Fix the CSV and re-upload to include them.</span>
                </div>
              )}

              <ScrollArea className="flex-1 rounded-lg border max-h-[360px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">#</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          No data rows found in CSV.
                        </TableCell>
                      </TableRow>
                    ) : rows.map((row, i) => {
                      const errs = rowValidations[i];
                      const isValid = errs.length === 0;
                      return (
                        <TableRow key={i} className={isValid ? "" : "bg-red-50/50 dark:bg-red-950/20"}>
                          <TableCell className="text-muted-foreground text-xs">{i + 1}</TableCell>
                          <TableCell className="font-medium text-sm">{row.name || <span className="text-red-400">—</span>}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{row.email || <span className="text-red-400">—</span>}</TableCell>
                          <TableCell>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${roleColors[row.role.toLowerCase()] ?? "bg-gray-100 text-gray-700"}`}>
                              {row.role || "employee"}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm">{row.department}</TableCell>
                          <TableCell>
                            {isValid ? (
                              <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                                <CheckCircle2 className="h-3 w-3" /> Ready
                              </span>
                            ) : (
                              <span className="flex items-start gap-1 text-xs text-red-500" title={errs.join("; ")}>
                                <XCircle className="h-3 w-3 mt-0.5 shrink-0" />
                                <span className="line-clamp-2">{errs[0]}{errs.length > 1 ? ` +${errs.length - 1} more` : ""}</span>
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          )}

          {/* STEP 3: Results */}
          {step === "result" && result && (
            <div className="space-y-4">
              {/* Summary cards */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl border bg-muted/30 p-4 text-center">
                  <p className="text-2xl font-bold text-foreground">{result.total}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Total Rows</p>
                </div>
                <div className="rounded-xl border bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800 p-4 text-center">
                  <p className="text-2xl font-bold text-green-600">{result.created}</p>
                  <p className="text-xs text-green-700 dark:text-green-400 mt-0.5">Created</p>
                </div>
                <div className={`rounded-xl border p-4 text-center ${result.failed > 0 ? "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800" : "bg-muted/30"}`}>
                  <p className={`text-2xl font-bold ${result.failed > 0 ? "text-red-500" : "text-muted-foreground"}`}>{result.failed}</p>
                  <p className={`text-xs mt-0.5 ${result.failed > 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`}>Failed</p>
                </div>
              </div>

              {result.created > 0 && (
                <div className="flex items-center gap-2 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 px-3 py-2 text-sm text-green-700 dark:text-green-300">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>{result.created} employee(s) added. They can log in with password <code className="font-mono text-xs bg-green-100 dark:bg-green-900 px-1 rounded">Password@123</code>.</span>
                </div>
              )}

              {result.errors.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-red-600">Failed rows:</p>
                  <ScrollArea className="max-h-[220px] rounded-lg border border-red-200 dark:border-red-800">
                    <div className="divide-y divide-red-100 dark:divide-red-900">
                      {result.errors.map((err) => (
                        <div key={err.row} className="flex items-start gap-3 px-3 py-2.5 hover:bg-red-50/50 dark:hover:bg-red-950/20">
                          <span className="text-xs text-muted-foreground w-8 shrink-0 pt-0.5">Row {err.row}</span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{err.name || err.email || "Unknown"}</p>
                            {err.email && err.name && <p className="text-xs text-muted-foreground truncate">{err.email}</p>}
                          </div>
                          <p className="text-xs text-red-500 text-right shrink-0 max-w-[200px]">{err.error}</p>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="mt-2 pt-3 border-t">
          {step === "upload" && (
            <Button variant="outline" onClick={handleClose}>Cancel</Button>
          )}
          {step === "preview" && (
            <>
              <Button variant="outline" onClick={reset}>Back</Button>
              <Button
                onClick={doUpload}
                disabled={validCount === 0 || bulkUpload.isPending}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {bulkUpload.isPending ? "Uploading..." : `Upload ${validCount} Employee${validCount !== 1 ? "s" : ""}`}
              </Button>
            </>
          )}
          {step === "result" && (
            <>
              <Button variant="outline" onClick={reset}>Upload More</Button>
              <Button onClick={handleClose}>Done</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function Employees() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  const { data: employees, isLoading } = useListEmployees();
  const { data: departments } = useListDepartments();
  const { data: designations } = useListDesignations();
  const { data: companies } = useListCompanies();

  const createEmp = useCreateEmployee();
  const updateEmp = useUpdateEmployee();
  const deleteEmp = useDeleteEmployee();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Employee | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null);
  const [filterDept, setFilterDept] = useState<string>("all");
  const [filterRole, setFilterRole] = useState<string>("all");

  const isHR = user?.departmentName?.toLowerCase().includes("hr") ?? false;
  const canManage = user?.role === "admin" || isHR;

  const form = useForm<EmpForm>({
    resolver: zodResolver(empSchema),
    defaultValues: { name: "", email: "", role: "employee", designation: "", company: "", phone: "", joiningDate: "" },
  });

  function openCreate() {
    setEditTarget(null);
    form.reset({ name: "", email: "", role: "employee", designation: "", company: "", phone: "", joiningDate: "" });
    setDialogOpen(true);
  }

  function openEdit(emp: Employee) {
    setEditTarget(emp);
    form.reset({
      name: emp.name,
      email: emp.email,
      role: emp.role as typeof ROLES[number],
      designation: emp.designation ?? "",
      company: emp.company ?? "",
      departmentId: emp.departmentId,
      managerId: emp.managerId ?? undefined,
      phone: emp.phone ?? "",
      joiningDate: emp.joiningDate ?? "",
    });
    setDialogOpen(true);
  }

  function onSubmit(values: EmpForm) {
    const payload = {
      ...values,
      designation: values.designation || undefined,
      company: values.company || undefined,
      managerId: values.managerId || undefined,
      phone: values.phone || undefined,
      joiningDate: values.joiningDate || undefined,
    };
    if (editTarget) {
      updateEmp.mutate({ id: editTarget.id, data: payload }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListEmployeesQueryKey() });
          setDialogOpen(false);
          toast({ title: "Employee updated" });
        },
      });
    } else {
      createEmp.mutate({ data: payload }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListEmployeesQueryKey() });
          setDialogOpen(false);
          toast({ title: "Employee added" });
        },
      });
    }
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    deleteEmp.mutate({ id: deleteTarget.id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListEmployeesQueryKey() });
        setDeleteTarget(null);
        toast({ title: "Employee deleted" });
      },
    });
  }

  const filtered = employees?.filter((e) => {
    if (filterDept !== "all" && e.departmentId !== Number(filterDept)) return false;
    if (filterRole !== "all" && e.role !== filterRole) return false;
    return true;
  });

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6 overflow-y-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Employees</h2>
          <p className="text-muted-foreground">
            {canManage
              ? "Manage employee directory, roles, and assignments."
              : "View employee directory. Contact HR to make changes."}
          </p>
        </div>
        {canManage ? (
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setBulkOpen(true)} data-testid="button-bulk-upload">
              <Upload className="mr-2 h-4 w-4" /> Bulk Upload
            </Button>
            <Button data-testid="button-add-employee" onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" /> Add Employee
            </Button>
          </div>
        ) : (
          <Badge variant="outline" className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground">
            <Lock className="h-3 w-3" /> HR managed
          </Badge>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <Select value={filterDept} onValueChange={setFilterDept}>
          <SelectTrigger className="w-[180px]" data-testid="select-filter-department">
            <SelectValue placeholder="All Departments" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Departments</SelectItem>
            {departments?.map((d) => <SelectItem key={d.id} value={d.id.toString()}>{d.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterRole} onValueChange={setFilterRole}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="All Roles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            {ROLES.map((r) => <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Designation</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Manager</TableHead>
                {canManage && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {[150, 120, 80, 120, 100, 100, canManage ? 50 : 0].filter(Boolean).map((w, j) => (
                      <TableCell key={j}><Skeleton className={`h-4 w-[${w}px]`} /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : filtered?.length ? (
                filtered.map((emp) => (
                  <TableRow key={emp.id} data-testid={`row-employee-${emp.id}`}>
                    <TableCell className="font-medium">
                      <div>
                        <div>{emp.name}</div>
                        <div className="text-xs text-muted-foreground">{emp.email}</div>
                      </div>
                    </TableCell>
                    <TableCell>{emp.departmentName}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${roleColors[emp.role] ?? ""}`}>
                        {emp.role}
                      </span>
                    </TableCell>
                    <TableCell>{(emp as Employee).designation || "—"}</TableCell>
                    <TableCell>{(emp as Employee).company || <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell>{emp.managerName || <span className="text-muted-foreground">—</span>}</TableCell>
                    {canManage && (
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" data-testid={`button-actions-employee-${emp.id}`}>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEdit(emp as Employee)}>
                              <Pencil className="mr-2 h-4 w-4" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onClick={() => setDeleteTarget(emp as Employee)}>
                              <Trash2 className="mr-2 h-4 w-4" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={canManage ? 7 : 6} className="h-24 text-center text-muted-foreground">
                    No employees found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Bulk Upload dialog */}
      {canManage && <BulkUploadDialog open={bulkOpen} onClose={() => setBulkOpen(false)} />}

      {/* Create / Edit dialog */}
      {canManage && (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editTarget ? "Edit Employee" : "Add Employee"}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Full Name</FormLabel>
                      <FormControl><Input data-testid="input-employee-name" placeholder="John Doe" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="email" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl><Input type="email" placeholder="john@company.com" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="phone" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl><Input placeholder="+91-..." {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="role" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger data-testid="select-employee-role">
                            <SelectValue placeholder="Select role" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {ROLES.map((r) => <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="designation" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Designation</FormLabel>
                      <Select value={field.value || "none"} onValueChange={(v) => field.onChange(v === "none" ? "" : v)}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select designation" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">— None —</SelectItem>
                          {designations?.map((d) => <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="company" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company</FormLabel>
                      <Select value={field.value || "none"} onValueChange={(v) => field.onChange(v === "none" ? "" : v)}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select company" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">— None —</SelectItem>
                          {companies?.map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="departmentId" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Department</FormLabel>
                      <Select value={field.value?.toString() ?? ""} onValueChange={(v) => field.onChange(Number(v))}>
                        <FormControl>
                          <SelectTrigger data-testid="select-employee-department">
                            <SelectValue placeholder="Select dept." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {departments?.map((d) => <SelectItem key={d.id} value={d.id.toString()}>{d.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="managerId" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Manager</FormLabel>
                      <Select value={field.value?.toString() ?? "none"} onValueChange={(v) => field.onChange(v === "none" ? undefined : Number(v))}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="No manager" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">No manager</SelectItem>
                          {employees?.filter((e) => e.id !== editTarget?.id).map((e) => (
                            <SelectItem key={e.id} value={e.id.toString()}>{e.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="joiningDate" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Joining Date</FormLabel>
                      <FormControl><Input type="date" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                  <Button type="submit" data-testid="button-submit-employee" disabled={createEmp.isPending || updateEmp.isPending}>
                    {editTarget ? "Save Changes" : "Add Employee"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete employee?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{deleteTarget?.name}</strong>.
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
