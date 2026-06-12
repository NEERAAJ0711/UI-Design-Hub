import { useState, useEffect } from "react";
import {
  useListEmployees,
  useListDepartments,
  useUpdateEmployee,
  useCreateDepartment,
  useUpdateDepartment,
  useDeleteDepartment,
  useGetDashboardSummary,
  useGetPendingApprovals,
  useGetRecentActivity,
  useApproveKraClosure,
  useListDesignations,
  useCreateDesignation,
  useUpdateDesignation,
  useDeleteDesignation,
  useListCompanies,
  useCreateCompany,
  useUpdateCompany,
  useDeleteCompany,
  useListHolidays,
  useCreateHoliday,
  useDeleteHoliday,
  useGetScoreWeights,
  useUpdateScoreWeights,
  getListEmployeesQueryKey,
  getListDepartmentsQueryKey,
  getListDesignationsQueryKey,
  getListCompaniesQueryKey,
  getGetPendingApprovalsQueryKey,
  getListHolidaysQueryKey,
  getGetScoreWeightsQueryKey,
  getListKrasQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  ShieldAlert, Users, Building2, Target, Bell, CheckCircle2, XCircle,
  Activity, RefreshCw, Plus, Pencil, Trash2, Briefcase, LayoutList,
  Settings, CalendarDays, Clock, AlertTriangle,
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

const ROLES = ["admin", "management", "hod", "manager", "employee"] as const;
type RoleType = typeof ROLES[number];

const roleColors: Record<string, string> = {
  admin: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  management: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  hod: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  manager: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  employee: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
};

const roleLabels: Record<string, string> = {
  admin: "System Admin", management: "Management", hod: "HOD", manager: "Manager", employee: "Employee",
};

const kraStatusColors: Record<string, string> = {
  submitted: "bg-yellow-100 text-yellow-800",
  manager_approved: "bg-orange-100 text-orange-800",
};

// ── Simple inline Master CRUD section (for Designations & Companies) ──────────
function MasterSection({
  title, icon: Icon, items, loading,
  onCreate, onUpdate, onDelete,
}: {
  title: string;
  icon: React.ElementType;
  items: { id: number; name: string }[] | undefined;
  loading: boolean;
  onCreate: (name: string) => void;
  onUpdate: (id: number, name: string) => void;
  onDelete: (id: number, name: string) => void;
}) {
  const [newName, setNewName] = useState("");
  const [editItem, setEditItem] = useState<{ id: number; name: string } | null>(null);
  const [editName, setEditName] = useState("");
  const [deleteItem, setDeleteItem] = useState<{ id: number; name: string } | null>(null);

  function submitCreate() {
    if (!newName.trim()) return;
    onCreate(newName.trim());
    setNewName("");
  }

  function openEdit(item: { id: number; name: string }) {
    setEditItem(item);
    setEditName(item.name);
  }

  function submitEdit() {
    if (!editItem || !editName.trim()) return;
    onUpdate(editItem.id, editName.trim());
    setEditItem(null);
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="h-4 w-4" /> {title}
          <Badge variant="secondary" className="ml-auto">{items?.length ?? 0}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Add new */}
        <div className="flex gap-2">
          <Input
            placeholder={`Add new ${title.toLowerCase().replace(/s$/, "")}…`}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitCreate()}
            className="h-8 text-sm"
          />
          <Button size="sm" onClick={submitCreate} disabled={!newName.trim()} className="h-8">
            <Plus className="h-3.5 w-3.5 mr-1" /> Add
          </Button>
        </div>

        {/* List */}
        <div className="border rounded-md divide-y max-h-60 overflow-y-auto">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="px-3 py-2"><Skeleton className="h-4 w-full" /></div>
            ))
          ) : items?.length ? (
            items.map((item) => (
              <div key={item.id} className="flex items-center justify-between px-3 py-2 hover:bg-muted/30">
                <span className="text-sm">{item.name}</span>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEdit(item)}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => setDeleteItem(item)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <p className="text-xs text-muted-foreground text-center py-4">No {title.toLowerCase()} added yet.</p>
          )}
        </div>
      </CardContent>

      {/* Edit dialog */}
      <Dialog open={!!editItem} onOpenChange={(o) => !o && setEditItem(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Edit {title.replace(/s$/, "")}</DialogTitle></DialogHeader>
          <Input value={editName} onChange={(e) => setEditName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submitEdit()} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditItem(null)}>Cancel</Button>
            <Button onClick={submitEdit} disabled={!editName.trim()}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteItem} onOpenChange={(o) => !o && setDeleteItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteItem?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently remove this {title.toLowerCase().replace(/s$/, "")}.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => { onDelete(deleteItem!.id, deleteItem!.name); setDeleteItem(null); }}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

export default function Admin() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: summary, isLoading: loadingSummary } = useGetDashboardSummary();
  const { data: employees, isLoading: loadingEmps } = useListEmployees();
  const { data: departments } = useListDepartments();
  const { data: designations, isLoading: loadingDesig } = useListDesignations();
  const { data: companies, isLoading: loadingComp } = useListCompanies();
  const { data: pendingData, isLoading: loadingPending } = useGetPendingApprovals();
  const { data: recentActivity } = useGetRecentActivity({ limit: 20 });
  const { data: holidays, isLoading: loadingHolidays } = useListHolidays();
  const { data: scoreWeights, isLoading: loadingWeights } = useGetScoreWeights();

  const updateEmployee = useUpdateEmployee();
  const approveKra = useApproveKraClosure();
  const createHolidayMut = useCreateHoliday();
  const deleteHolidayMut = useDeleteHoliday();
  const updateWeightsMut = useUpdateScoreWeights();

  // Department mutations
  const createDept = useCreateDepartment();
  const updateDept = useUpdateDepartment();
  const deleteDept = useDeleteDepartment();

  // Designation mutations
  const createDesig = useCreateDesignation();
  const updateDesig = useUpdateDesignation();
  const deleteDesig = useDeleteDesignation();

  // Company mutations
  const createComp = useCreateCompany();
  const updateComp = useUpdateCompany();
  const deleteComp = useDeleteCompany();

  const [roleChangeTarget, setRoleChangeTarget] = useState<{ id: number; name: string; newRole: RoleType } | null>(null);
  const [filterDept, setFilterDept] = useState("all");

  // Holiday state
  const [holidayDate, setHolidayDate] = useState("");
  const [holidayName, setHolidayName] = useState("");

  // Score weights form state (init from server data when loaded)
  const [wKra, setWKra] = useState<number>(70);
  const [wPunct, setWPunct] = useState<number>(20);
  const [wDisc, setWDisc] = useState<number>(10);
  const weightsTotal = wKra + wPunct + wDisc;

  // Sync weights form from server when data loads
  useEffect(() => {
    if (scoreWeights) {
      setWKra(scoreWeights.kraWeight);
      setWPunct(scoreWeights.punctualityWeight);
      setWDisc(scoreWeights.disciplineWeight);
    }
  }, [scoreWeights]);

  // Dept dialog state
  const [deptDialog, setDeptDialog] = useState(false);
  const [deptEdit, setDeptEdit] = useState<{ id: number; name: string; description?: string | null } | null>(null);
  const [deptName, setDeptName] = useState("");
  const [deptDesc, setDeptDesc] = useState("");
  const [deptDeleteTarget, setDeptDeleteTarget] = useState<{ id: number; name: string } | null>(null);

  const deptMap = new Map((departments ?? []).map((d) => [d.id, d.name]));
  const totalPending = (pendingData?.kras?.length ?? 0);

  function confirmRoleChange() {
    if (!roleChangeTarget) return;
    updateEmployee.mutate({ id: roleChangeTarget.id, data: { role: roleChangeTarget.newRole } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListEmployeesQueryKey() });
        setRoleChangeTarget(null);
        toast({ title: `Role updated for ${roleChangeTarget.name}` });
      },
      onError: () => toast({ title: "Failed to update role", variant: "destructive" }),
    });
  }

  function handleRoleSelect(emp: { id: number; name: string; role: string }, newRole: string) {
    if (newRole === emp.role) return;
    setRoleChangeTarget({ id: emp.id, name: emp.name, newRole: newRole as RoleType });
  }

  function handleKraApproval(id: number, approved: boolean) {
    approveKra.mutate({ id, data: { approved } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetPendingApprovalsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListKrasQueryKey() });
        toast({ title: approved ? "KRA approved" : "KRA rejected" });
      },
    });
  }

  // ── Department CRUD ──────────────────────────────────────────────────────────
  function openDeptCreate() {
    setDeptEdit(null); setDeptName(""); setDeptDesc(""); setDeptDialog(true);
  }
  function openDeptEdit(d: { id: number; name: string; description?: string | null }) {
    setDeptEdit(d); setDeptName(d.name); setDeptDesc(d.description ?? ""); setDeptDialog(true);
  }
  function submitDept() {
    if (!deptName.trim()) return;
    const payload = { name: deptName.trim(), description: deptDesc.trim() || undefined };
    if (deptEdit) {
      updateDept.mutate({ id: deptEdit.id, data: payload }, {
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListDepartmentsQueryKey() }); setDeptDialog(false); toast({ title: "Department updated" }); },
      });
    } else {
      createDept.mutate({ data: payload }, {
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListDepartmentsQueryKey() }); setDeptDialog(false); toast({ title: "Department created" }); },
      });
    }
  }
  function confirmDeptDelete() {
    if (!deptDeleteTarget) return;
    deleteDept.mutate({ id: deptDeleteTarget.id }, {
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListDepartmentsQueryKey() }); setDeptDeleteTarget(null); toast({ title: "Department deleted" }); },
    });
  }

  // ── Designation CRUD ─────────────────────────────────────────────────────────
  function handleCreateDesig(name: string) {
    createDesig.mutate({ data: { name } }, {
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListDesignationsQueryKey() }); toast({ title: "Designation added" }); },
      onError: () => toast({ title: "Already exists or failed", variant: "destructive" }),
    });
  }
  function handleUpdateDesig(id: number, name: string) {
    updateDesig.mutate({ id, data: { name } }, {
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListDesignationsQueryKey() }); toast({ title: "Designation updated" }); },
    });
  }
  function handleDeleteDesig(id: number) {
    deleteDesig.mutate({ id }, {
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListDesignationsQueryKey() }); toast({ title: "Designation deleted" }); },
    });
  }

  // ── Company CRUD ─────────────────────────────────────────────────────────────
  function handleCreateComp(name: string) {
    createComp.mutate({ data: { name } }, {
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListCompaniesQueryKey() }); toast({ title: "Company added" }); },
      onError: () => toast({ title: "Already exists or failed", variant: "destructive" }),
    });
  }
  function handleUpdateComp(id: number, name: string) {
    updateComp.mutate({ id, data: { name } }, {
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListCompaniesQueryKey() }); toast({ title: "Company updated" }); },
    });
  }
  function handleDeleteComp(id: number) {
    deleteComp.mutate({ id }, {
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListCompaniesQueryKey() }); toast({ title: "Company deleted" }); },
    });
  }

  const filteredEmployees = employees?.filter((e) =>
    filterDept === "all" || e.departmentId === Number(filterDept)
  );

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-red-100 dark:bg-red-950/30">
          <ShieldAlert className="h-5 w-5 text-red-500" />
        </div>
        <div>
          <h2 className="text-3xl font-bold tracking-tight">System Administration</h2>
          <p className="text-muted-foreground">Full system control — user management, master data, and company-wide approvals.</p>
        </div>
      </div>

      <div className="rounded-lg border border-red-200 bg-red-50/70 dark:bg-red-950/20 dark:border-red-900/30 px-4 py-2.5 flex items-center gap-2">
        <ShieldAlert className="h-4 w-4 text-red-500 shrink-0" />
        <p className="text-sm text-red-700 dark:text-red-400 font-medium">Admin Mode: Changes made here affect all users and data system-wide.</p>
      </div>

      {/* System Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<Users className="h-4 w-4" />} title="Total Users" value={summary?.totalEmployees} loading={loadingSummary} />
        <StatCard icon={<Building2 className="h-4 w-4" />} title="Departments" value={departments?.length ?? summary?.totalDepartments} loading={loadingSummary} />
        <StatCard icon={<Target className="h-4 w-4" />} title="Avg KPI Score" value={summary?.avgKpiScore?.toFixed(1) ?? "—"} loading={loadingSummary} />
        <StatCard
          icon={<Bell className={`h-4 w-4 ${totalPending > 0 ? "text-orange-500" : ""}`} />}
          title="Pending Approvals"
          value={totalPending}
          loading={loadingPending}
          valueClass={totalPending > 0 ? "text-orange-600" : undefined}
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="users" className="space-y-4">
        <TabsList className="flex h-auto flex-wrap gap-1 bg-muted p-1 rounded-lg">
          <TabsTrigger value="users" className="flex items-center gap-1.5 text-xs">
            <Users className="h-3.5 w-3.5" /> Users
          </TabsTrigger>
          <TabsTrigger value="masters" className="flex items-center gap-1.5 text-xs">
            <LayoutList className="h-3.5 w-3.5" /> Masters
          </TabsTrigger>
          <TabsTrigger value="approvals" className="flex items-center gap-1.5 text-xs">
            <Bell className="h-3.5 w-3.5" /> Approvals
            {totalPending > 0 && (
              <Badge className="h-4 min-w-4 px-1 bg-orange-500 text-white text-[10px]">{totalPending}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="logs" className="flex items-center gap-1.5 text-xs">
            <Activity className="h-3.5 w-3.5" /> Activity Log
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-1.5 text-xs">
            <Settings className="h-3.5 w-3.5" /> KPI Weights
          </TabsTrigger>
          <TabsTrigger value="holidays" className="flex items-center gap-1.5 text-xs">
            <CalendarDays className="h-3.5 w-3.5" /> Holidays
          </TabsTrigger>
        </TabsList>

        {/* ── Users Tab ── */}
        <TabsContent value="users">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>User Management</CardTitle>
                  <CardDescription>View all users and change their system roles.</CardDescription>
                </div>
                <Select value={filterDept} onValueChange={setFilterDept}>
                  <SelectTrigger className="w-[180px]"><SelectValue placeholder="All Departments" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Departments</SelectItem>
                    {departments?.map((d) => <SelectItem key={d.id} value={d.id.toString()}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Designation</TableHead>
                    <TableHead>Current Role</TableHead>
                    <TableHead>Change Role</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingEmps ? (
                    Array.from({ length: 6 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 6 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}
                      </TableRow>
                    ))
                  ) : filteredEmployees?.length ? (
                    filteredEmployees.map((emp) => (
                      <TableRow key={emp.id}>
                        <TableCell className="font-medium">{emp.name}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{emp.email}</TableCell>
                        <TableCell>{deptMap.get(emp.departmentId) ?? "—"}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{emp.designation ?? "—"}</TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${roleColors[emp.role] ?? ""}`}>
                            {roleLabels[emp.role] ?? emp.role}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Select value={emp.role} onValueChange={(newRole) => handleRoleSelect(emp, newRole)}>
                            <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {ROLES.map((r) => (
                                <SelectItem key={r} value={r} className="text-xs">
                                  <div className="flex items-center gap-2">
                                    <span className={`inline-block w-2 h-2 rounded-full ${r === "admin" ? "bg-red-500" : r === "management" ? "bg-purple-500" : r === "hod" ? "bg-blue-500" : r === "manager" ? "bg-green-500" : "bg-gray-400"}`} />
                                    {roleLabels[r]}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">No users found.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Masters Tab ── */}
        <TabsContent value="masters">
          <div className="space-y-4">
            {/* Departments */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Building2 className="h-4 w-4" /> Departments
                    <Badge variant="secondary" className="ml-2">{departments?.length ?? 0}</Badge>
                  </CardTitle>
                  <Button size="sm" onClick={openDeptCreate} className="h-8">
                    <Plus className="h-3.5 w-3.5 mr-1" /> Add
                  </Button>
                </div>
                <CardDescription>Manage company departments. Deleting a department may affect employees assigned to it.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Employees</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {!departments ? (
                      Array.from({ length: 4 }).map((_, i) => (
                        <TableRow key={i}>
                          {Array.from({ length: 4 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}
                        </TableRow>
                      ))
                    ) : departments.map((d) => (
                      <TableRow key={d.id}>
                        <TableCell className="font-medium">{d.name}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{d.description ?? "—"}</TableCell>
                        <TableCell className="text-right">{d.employeeCount ?? 0}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openDeptEdit(d)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeptDeleteTarget(d)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Designations + Companies side by side */}
            <div className="grid gap-4 md:grid-cols-2">
              <MasterSection
                title="Designations"
                icon={Briefcase}
                items={designations}
                loading={loadingDesig}
                onCreate={handleCreateDesig}
                onUpdate={handleUpdateDesig}
                onDelete={handleDeleteDesig}
              />
              <MasterSection
                title="Companies"
                icon={Building2}
                items={companies}
                loading={loadingComp}
                onCreate={handleCreateComp}
                onUpdate={handleUpdateComp}
                onDelete={handleDeleteComp}
              />
            </div>
          </div>
        </TabsContent>

        {/* ── Approvals Tab ── */}
        <TabsContent value="approvals">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-orange-500" /> Company-wide Pending Approvals
                {totalPending > 0 && <Badge className="bg-orange-500 text-white">{totalPending}</Badge>}
              </CardTitle>
              <CardDescription>All pending KRA closure requests across every department.</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingPending ? (
                <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
              ) : totalPending === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-3 opacity-20" />
                  <p className="text-sm font-medium">No pending approvals</p>
                </div>
              ) : (
                <div className="space-y-5">
                  {(pendingData?.kras?.length ?? 0) > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                        KRA Closure Requests ({pendingData!.kras.length})
                      </h4>
                      <div className="space-y-2">
                        {pendingData!.kras.map((kra) => (
                          <div key={kra.id} className={`flex items-center justify-between p-3 rounded-lg border bg-card ${kra.isOverdue ? "border-red-200 dark:border-red-900/50" : ""}`}>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{kra.title}</p>
                              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                <p className="text-xs text-muted-foreground">{kra.employeeName} · {kra.departmentName}</p>
                                <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${kraStatusColors[kra.kraStatus] ?? ""}`}>
                                  {kra.kraStatus.replace("_", " ")}
                                </span>
                                {kra.achievementPct != null && (
                                  <span className="text-xs text-muted-foreground">Achievement: {kra.achievementPct}%</span>
                                )}
                                {kra.workingHoursElapsed > 0 && (
                                  <span className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full font-medium ${kra.isOverdue ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" : "bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400"}`}>
                                    {kra.isOverdue ? <AlertTriangle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                                    {kra.workingHoursElapsed.toFixed(1)}h{kra.isOverdue ? " — OVERDUE" : " elapsed"}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-2 ml-4 shrink-0">
                              <Button size="sm" variant="outline" className="text-green-600 border-green-200 hover:bg-green-50 h-8" onClick={() => handleKraApproval(kra.id, true)}>
                                <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Approve
                              </Button>
                              <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50 h-8" onClick={() => handleKraApproval(kra.id, false)}>
                                <XCircle className="h-3.5 w-3.5 mr-1" /> Reject
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Activity Log Tab ── */}
        <TabsContent value="logs">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" /> System Activity Log
              </CardTitle>
              <CardDescription>Full audit trail of all actions across the system.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {recentActivity?.length ? recentActivity.map((a) => (
                  <div key={a.id} className="flex items-start justify-between py-2.5 border-b last:border-0">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5"><ActivityDot type={a.type} /></div>
                      <div>
                        <p className="text-sm font-medium">{a.description}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {a.actorName !== "System" && <span className="font-medium">{a.actorName} · </span>}
                          <span className="capitalize">{a.entityType}</span> #{a.entityId}
                        </p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground whitespace-nowrap ml-4">{format(new Date(a.createdAt), "MMM d, h:mm a")}</p>
                  </div>
                )) : <p className="text-sm text-muted-foreground py-4 text-center">No activity recorded yet.</p>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── KPI Weights Tab ── */}
        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-blue-500" /> KPI Score Component Weights
              </CardTitle>
              <CardDescription>
                Configure how each component contributes to the total KPI score. Weights must sum to exactly 100%.
                Working hours for SLA enforcement: Mon–Fri, 10 AM – 6 PM (4-hour approval SLA).
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingWeights ? (
                <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
              ) : (
                <div className="space-y-5 max-w-lg">
                  {[
                    { label: "KRA Achievement", value: wKra, setter: setWKra, hint: "Based on avg. achievement % of assigned KRAs" },
                    { label: "Punctuality", value: wPunct, setter: setWPunct, hint: "Manually assessed by manager" },
                    { label: "Discipline", value: wDisc, setter: setWDisc, hint: "Manually assessed by manager" },
                  ].map(({ label, value, setter, hint }) => (
                    <div key={label} className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium">{label}</label>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number" min={0} max={100} step={1}
                            value={value}
                            onChange={(e) => setter(Math.max(0, Math.min(100, Number(e.target.value))))}
                            className="w-20 h-8 text-center text-sm"
                          />
                          <span className="text-sm text-muted-foreground w-4">%</span>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">{hint}</p>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${Math.min(value, 100)}%` }} />
                      </div>
                    </div>
                  ))}

                  <div className={`flex items-center justify-between p-3 rounded-lg border-2 font-medium ${Math.abs(weightsTotal - 100) < 0.5 ? "border-green-300 bg-green-50 dark:bg-green-950/20" : "border-red-300 bg-red-50 dark:bg-red-950/20"}`}>
                    <span className="text-sm">Total</span>
                    <span className={`text-lg font-bold ${Math.abs(weightsTotal - 100) < 0.5 ? "text-green-700 dark:text-green-400" : "text-red-600"}`}>
                      {weightsTotal}%
                    </span>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <Button
                      onClick={() => {
                        if (scoreWeights) {
                          setWKra(scoreWeights.kraWeight);
                          setWPunct(scoreWeights.punctualityWeight);
                          setWDisc(scoreWeights.disciplineWeight);
                        }
                      }}
                      variant="outline" size="sm"
                    >
                      <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Reset
                    </Button>
                    <Button
                      size="sm"
                      disabled={Math.abs(weightsTotal - 100) >= 0.5 || updateWeightsMut.isPending}
                      onClick={() => {
                        updateWeightsMut.mutate({
                          data: {
                            kraWeight: wKra,
                            punctualityWeight: wPunct,
                            disciplineWeight: wDisc,
                          },
                        }, {
                          onSuccess: () => {
                            queryClient.invalidateQueries({ queryKey: getGetScoreWeightsQueryKey() });
                            toast({ title: "KPI weights saved successfully" });
                          },
                          onError: (e: unknown) => toast({ title: (e as { message?: string })?.message ?? "Failed to save weights", variant: "destructive" }),
                        });
                      }}
                    >
                      Save Weights
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Holidays Tab ── */}
        <TabsContent value="holidays">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-emerald-500" /> Holiday Calendar
                <Badge variant="secondary" className="ml-auto">{holidays?.length ?? 0} holidays</Badge>
              </CardTitle>
              <CardDescription>
                Public and company holidays excluded from the 4-hour approval SLA working-hours calculation.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Add holiday form */}
              <div className="flex gap-2 items-end">
                <div className="space-y-1 flex-1">
                  <label className="text-xs font-medium text-muted-foreground">Date</label>
                  <Input
                    type="date"
                    value={holidayDate}
                    onChange={(e) => setHolidayDate(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1 flex-[2]">
                  <label className="text-xs font-medium text-muted-foreground">Holiday Name</label>
                  <Input
                    placeholder="e.g. Diwali, Republic Day…"
                    value={holidayName}
                    onChange={(e) => setHolidayName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && holidayDate && holidayName.trim() && createHolidayMut.mutate({ data: { date: holidayDate, name: holidayName.trim() } }, { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListHolidaysQueryKey() }); setHolidayDate(""); setHolidayName(""); toast({ title: "Holiday added" }); } })}
                    className="h-8 text-sm"
                  />
                </div>
                <Button
                  size="sm" className="h-8"
                  disabled={!holidayDate || !holidayName.trim() || createHolidayMut.isPending}
                  onClick={() => createHolidayMut.mutate({ data: { date: holidayDate, name: holidayName.trim() } }, {
                    onSuccess: () => {
                      queryClient.invalidateQueries({ queryKey: getListHolidaysQueryKey() });
                      setHolidayDate(""); setHolidayName("");
                      toast({ title: "Holiday added" });
                    },
                    onError: () => toast({ title: "Failed to add holiday", variant: "destructive" }),
                  })}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add
                </Button>
              </div>

              {/* Holiday list */}
              <div className="border rounded-md divide-y max-h-96 overflow-y-auto">
                {loadingHolidays ? (
                  Array.from({ length: 5 }).map((_, i) => <div key={i} className="px-3 py-2"><Skeleton className="h-4 w-full" /></div>)
                ) : holidays?.length ? (
                  [...holidays].sort((a, b) => a.date.localeCompare(b.date)).map((h) => (
                    <div key={h.id} className="flex items-center justify-between px-3 py-2 hover:bg-muted/30">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-mono text-muted-foreground w-24 shrink-0">
                          {new Date(h.date + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                        </span>
                        <span className="text-sm font-medium">{h.name}</span>
                        {new Date(h.date + "T00:00:00").getDay() === 0 || new Date(h.date + "T00:00:00").getDay() === 6 ? (
                          <Badge variant="outline" className="text-[10px] h-4 px-1">Weekend</Badge>
                        ) : null}
                      </div>
                      <Button
                        variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive"
                        onClick={() => deleteHolidayMut.mutate({ id: h.id }, {
                          onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListHolidaysQueryKey() }); toast({ title: "Holiday removed" }); },
                        })}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-6">No holidays configured yet.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Role change confirmation */}
      <AlertDialog open={!!roleChangeTarget} onOpenChange={(open) => !open && setRoleChangeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change User Role?</AlertDialogTitle>
            <AlertDialogDescription>
              Change <strong>{roleChangeTarget?.name}</strong>'s role to{" "}
              <strong>{roleLabels[roleChangeTarget?.newRole ?? ""] ?? roleChangeTarget?.newRole}</strong>?
              <br />
              <span className="text-orange-600 dark:text-orange-400 mt-2 inline-block text-xs">
                This takes effect immediately on their next action.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRoleChange} disabled={updateEmployee.isPending}>
              <RefreshCw className="mr-2 h-3.5 w-3.5" /> Confirm Change
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Department create/edit dialog */}
      <Dialog open={deptDialog} onOpenChange={setDeptDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{deptEdit ? "Edit Department" : "Add Department"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Name</label>
              <Input className="mt-1" value={deptName} onChange={(e) => setDeptName(e.target.value)} placeholder="e.g. Engineering" />
            </div>
            <div>
              <label className="text-sm font-medium">Description <span className="text-muted-foreground font-normal">(optional)</span></label>
              <Input className="mt-1" value={deptDesc} onChange={(e) => setDeptDesc(e.target.value)} placeholder="Brief description…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeptDialog(false)}>Cancel</Button>
            <Button onClick={submitDept} disabled={!deptName.trim() || createDept.isPending || updateDept.isPending}>
              {deptEdit ? "Save Changes" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Department delete confirm */}
      <AlertDialog open={!!deptDeleteTarget} onOpenChange={(o) => !o && setDeptDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deptDeleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete the department. Employees in this department may be left unassigned.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={confirmDeptDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StatCard({ icon, title, value, loading, valueClass }: {
  icon: React.ReactNode; title: string; value: number | string | undefined; loading?: boolean; valueClass?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <span className="text-muted-foreground">{icon}</span>
      </CardHeader>
      <CardContent>
        {loading ? <Skeleton className="h-8 w-16" /> : (
          <div className={`text-2xl font-bold ${valueClass ?? ""}`}>{value ?? 0}</div>
        )}
      </CardContent>
    </Card>
  );
}

function ActivityDot({ type }: { type: string }) {
  const colors: Record<string, string> = {
    kra_submitted: "bg-yellow-500", kra_approved: "bg-green-500", kra_rejected: "bg-red-500",
    kra_scored: "bg-blue-400", kpi_created: "bg-purple-500", employee_created: "bg-indigo-500",
  };
  return <span className={`block h-2 w-2 mt-1.5 rounded-full shrink-0 ${colors[type] ?? "bg-gray-400"}`} />;
}
