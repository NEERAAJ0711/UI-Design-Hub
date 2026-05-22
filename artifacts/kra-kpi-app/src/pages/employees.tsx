import { useState } from "react";
import {
  useListEmployees,
  useListDepartments,
  useCreateEmployee,
  useUpdateEmployee,
  useDeleteEmployee,
  getListEmployeesQueryKey,
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
import { Plus, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
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
  departmentId: z.number({ required_error: "Department required" }),
  managerId: z.number().optional(),
  phone: z.string().optional(),
  joiningDate: z.string().optional(),
});
type EmpForm = z.infer<typeof empSchema>;

type Employee = {
  id: number; name: string; email: string; role: string; designation?: string | null;
  departmentId: number; departmentName: string; managerId?: number | null; managerName?: string | null; phone?: string | null; joiningDate?: string | null;
};

const roleColors: Record<string, string> = {
  management: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  hod: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  manager: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  employee: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
};

export default function Employees() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: employees, isLoading } = useListEmployees();
  const { data: departments } = useListDepartments();
  const createEmp = useCreateEmployee();
  const updateEmp = useUpdateEmployee();
  const deleteEmp = useDeleteEmployee();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Employee | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null);
  const [filterDept, setFilterDept] = useState<string>("all");
  const [filterRole, setFilterRole] = useState<string>("all");

  const form = useForm<EmpForm>({
    resolver: zodResolver(empSchema),
    defaultValues: { name: "", email: "", role: "employee", designation: "", phone: "", joiningDate: "" },
  });

  function openCreate() {
    setEditTarget(null);
    form.reset({ name: "", email: "", role: "employee", designation: "", phone: "", joiningDate: "" });
    setDialogOpen(true);
  }

  function openEdit(emp: Employee) {
    setEditTarget(emp);
    form.reset({
      name: emp.name,
      email: emp.email,
      role: emp.role as typeof ROLES[number],
      designation: emp.designation ?? "",
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
          <p className="text-muted-foreground">Manage employee directory, roles, and assignments.</p>
        </div>
        <Button data-testid="button-add-employee" onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" /> Add Employee
        </Button>
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
                <TableHead>Manager</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {[150, 120, 80, 120, 100, 50].map((w, j) => (
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
                    <TableCell>{emp.designation || "—"}</TableCell>
                    <TableCell>{emp.managerName || <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" data-testid={`button-actions-employee-${emp.id}`}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(emp)}>
                            <Pencil className="mr-2 h-4 w-4" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => setDeleteTarget(emp)}>
                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    No employees found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create / Edit dialog */}
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
                    <FormControl><Input placeholder="e.g. Software Engineer" {...field} /></FormControl>
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
                    <Select value={field.value?.toString() ?? ""} onValueChange={(v) => field.onChange(v ? Number(v) : undefined)}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="No manager" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">No manager</SelectItem>
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
