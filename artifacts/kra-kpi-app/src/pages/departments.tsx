import { useState } from "react";
import {
  useListDepartments,
  useListEmployees,
  useCreateDepartment,
  useUpdateDepartment,
  useDeleteDepartment,
  getListDepartmentsQueryKey,
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
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, Building2, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";

const deptSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  headId: z.number().optional(),
});
type DeptForm = z.infer<typeof deptSchema>;

type Department = { id: number; name: string; description?: string | null; headId?: number | null; headName?: string | null; employeeCount?: number | null };

export default function Departments() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: departments, isLoading } = useListDepartments();
  const { data: employees } = useListEmployees();
  const createDept = useCreateDepartment();
  const updateDept = useUpdateDepartment();
  const deleteDept = useDeleteDepartment();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Department | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Department | null>(null);

  const form = useForm<DeptForm>({ resolver: zodResolver(deptSchema), defaultValues: { name: "", description: "" } });

  function openCreate() {
    setEditTarget(null);
    form.reset({ name: "", description: "" });
    setDialogOpen(true);
  }

  function openEdit(dept: Department) {
    setEditTarget(dept);
    form.reset({ name: dept.name, description: dept.description ?? "", headId: dept.headId ?? undefined });
    setDialogOpen(true);
  }

  function onSubmit(values: DeptForm) {
    const payload = { ...values, headId: values.headId ?? undefined };
    if (editTarget) {
      updateDept.mutate({ id: editTarget.id, data: payload }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListDepartmentsQueryKey() });
          setDialogOpen(false);
          toast({ title: "Department updated" });
        },
      });
    } else {
      createDept.mutate({ data: payload }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListDepartmentsQueryKey() });
          setDialogOpen(false);
          toast({ title: "Department created" });
        },
      });
    }
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    deleteDept.mutate({ id: deleteTarget.id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListDepartmentsQueryKey() });
        setDeleteTarget(null);
        toast({ title: "Department deleted" });
      },
    });
  }

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6 overflow-y-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Departments</h2>
          <p className="text-muted-foreground">Manage organization structure and departmental heads.</p>
        </div>
        <Button data-testid="button-add-department" onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" /> Add Department
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Head of Department</TableHead>
                <TableHead>Employees</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {[150, 200, 120, 50, 50].map((w, j) => (
                      <TableCell key={j}><Skeleton className={`h-4 w-[${w}px]`} /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : departments?.length ? (
                departments.map((dept) => (
                  <TableRow key={dept.id} data-testid={`row-department-${dept.id}`}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        {dept.name}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">{dept.description || "—"}</TableCell>
                    <TableCell>{dept.headName || <span className="text-muted-foreground">Not assigned</span>}</TableCell>
                    <TableCell>{dept.employeeCount}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" data-testid={`button-actions-department-${dept.id}`}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(dept)}>
                            <Pencil className="mr-2 h-4 w-4" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => setDeleteTarget(dept)}>
                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    No departments found. Add your first department.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editTarget ? "Edit Department" : "Add Department"}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl><Input data-testid="input-department-name" placeholder="e.g. HR & Admin" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl><Textarea placeholder="Brief description..." {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="headId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Head of Department</FormLabel>
                  <Select
                    value={field.value?.toString() ?? ""}
                    onValueChange={(v) => field.onChange(v ? Number(v) : undefined)}
                  >
                    <FormControl>
                      <SelectTrigger data-testid="select-department-head">
                        <SelectValue placeholder="Select HOD" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {employees?.map((e) => (
                        <SelectItem key={e.id} value={e.id.toString()}>{e.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button type="submit" data-testid="button-submit-department" disabled={createDept.isPending || updateDept.isPending}>
                  {editTarget ? "Save Changes" : "Create"}
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
            <AlertDialogTitle>Delete department?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{deleteTarget?.name}</strong>. This action cannot be undone.
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
