import { useState } from "react";
import {
  useListKras,
  useListDepartments,
  useListEmployees,
  useCreateKra,
  useUpdateKra,
  useDeleteKra,
  useScoreKra,
  getListKrasQueryKey,
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { Plus, MoreHorizontal, Pencil, Trash2, Star } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";

const PERIODS = ["monthly", "quarterly", "yearly"] as const;

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
};

export default function KRAs() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: kras, isLoading } = useListKras();
  const { data: departments } = useListDepartments();
  const { data: employees } = useListEmployees();
  const createKra = useCreateKra();
  const updateKra = useUpdateKra();
  const deleteKra = useDeleteKra();
  const scoreKra = useScoreKra();

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

  function openCreate() {
    setEditTarget(null);
    form.reset({ title: "", description: "", weightage: 20, reviewPeriod: "monthly" });
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
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListKrasQueryKey() });
          setDialogOpen(false);
          toast({ title: "KRA updated" });
        },
      });
    } else {
      createKra.mutate({ data: payload }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListKrasQueryKey() });
          setDialogOpen(false);
          toast({ title: "KRA created" });
        },
      });
    }
  }

  function onScoreSubmit(values: ScoreForm) {
    if (!scoreTarget) return;
    scoreKra.mutate({ id: scoreTarget.id, data: values }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListKrasQueryKey() });
        setScoreTarget(null);
        toast({ title: "Achievement score updated" });
      },
    });
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    deleteKra.mutate({ id: deleteTarget.id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListKrasQueryKey() });
        setDeleteTarget(null);
        toast({ title: "KRA deleted" });
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
        <Button data-testid="button-add-kra" onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" /> Add KRA
        </Button>
      </div>

      <div className="flex gap-3">
        <Select value={filterDept} onValueChange={setFilterDept}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="All Departments" /></SelectTrigger>
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
                <TableHead>Title</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Assignee</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Weightage</TableHead>
                <TableHead className="w-[200px]">Achievement</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {[200, 120, 120, 80, 60, 200, 50].map((w, j) => (
                      <TableCell key={j}><Skeleton className={`h-4 w-[${w}px]`} /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : filtered?.length ? (
                filtered.map((kra) => (
                  <TableRow key={kra.id} data-testid={`row-kra-${kra.id}`}>
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
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" data-testid={`button-actions-kra-${kra.id}`}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
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
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">No KRAs found.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create / Edit */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editTarget ? "Edit KRA" : "Add KRA"}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="title" render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl><Input data-testid="input-kra-title" placeholder="e.g. Compliance Work" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl><Textarea placeholder="Describe this KRA..." {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="weightage" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Weightage (%)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                        data-testid="input-kra-weightage"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="reviewPeriod" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Review Period</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        {PERIODS.map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="departmentId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Department</FormLabel>
                    <Select value={field.value?.toString() ?? ""} onValueChange={(v) => field.onChange(Number(v))}>
                      <FormControl><SelectTrigger data-testid="select-kra-department"><SelectValue placeholder="Select dept." /></SelectTrigger></FormControl>
                      <SelectContent>
                        {departments?.map((d) => <SelectItem key={d.id} value={d.id.toString()}>{d.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="employeeId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assign to Employee</FormLabel>
                    <Select value={field.value?.toString() ?? ""} onValueChange={(v) => field.onChange(v ? Number(v) : undefined)}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Dept-wide" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="">Dept-wide</SelectItem>
                        {employees?.map((e) => <SelectItem key={e.id} value={e.id.toString()}>{e.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button type="submit" data-testid="button-submit-kra" disabled={createKra.isPending || updateKra.isPending}>
                  {editTarget ? "Save Changes" : "Create KRA"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Score dialog */}
      <Dialog open={!!scoreTarget} onOpenChange={(open) => !open && setScoreTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Update Achievement Score</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{scoreTarget?.title}</p>
          <Form {...scoreForm}>
            <form onSubmit={scoreForm.handleSubmit(onScoreSubmit)} className="space-y-4">
              <FormField control={scoreForm.control} name="achievementPct" render={({ field }) => (
                <FormItem>
                  <FormLabel>Achievement (%)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      {...field}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                      data-testid="input-kra-score"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setScoreTarget(null)}>Cancel</Button>
                <Button type="submit" disabled={scoreKra.isPending} data-testid="button-submit-score">
                  Update Score
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
