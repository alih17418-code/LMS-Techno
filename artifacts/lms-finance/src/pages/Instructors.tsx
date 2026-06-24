import { useState } from "react";
import { Link } from "wouter";
import {
  useListInstructors,
  useCreateInstructor,
  useUpdateInstructor,
  useDeleteInstructor,
  useListCourses,
} from "@workspace/api-client-react";
import type { Instructor } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { cn, formatCurrency } from "@/lib/utils";
import { Plus, Search, Eye, Pencil, Trash2, AlertCircle, UserCheck, Phone } from "lucide-react";

type PaymentModel = "salary" | "per_lecture" | "commission";

const EMPTY_FORM = {
  name: "",
  fatherName: "",
  phone: "",
  address: "",
  specialization: "",
  courseId: "" as string | number,
  paymentModel: "salary" as PaymentModel,
  monthlySalary: "",
  lectureRate: "",
  commissionPercent: "",
  joinDate: new Date().toISOString().split("T")[0],
  status: "active" as "active" | "inactive",
};

type FormState = typeof EMPTY_FORM;

const PAYMENT_MODEL_LABELS: Record<PaymentModel, string> = {
  salary: "Monthly Salary",
  per_lecture: "Per Lecture",
  commission: "Commission (%)",
};

export default function Instructors() {
  const [search, setSearch] = useState("");
  const [filterCourse, setFilterCourse] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterModel, setFilterModel] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Instructor | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Instructor | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const qc = useQueryClient();
  const { toast } = useToast();

  const params = {
    ...(filterCourse !== "all" ? { courseId: Number(filterCourse) } : {}),
    ...(filterStatus !== "all" ? { status: filterStatus } : {}),
    ...(search ? { search } : {}),
  };

  const { data: instructors, isLoading, error } = useListInstructors(params);
  const { data: courses } = useListCourses();
  const createMutation = useCreateInstructor();
  const updateMutation = useUpdateInstructor();
  const deleteMutation = useDeleteInstructor();

  const filtered = filterModel === "all"
    ? instructors
    : instructors?.filter((i) => (i as any).paymentModel === filterModel);

  const totalSalaryPayroll = filtered?.filter((i) => i.status === "active" && (i as any).paymentModel === "salary")
    .reduce((s, i) => s + i.monthlySalary, 0) ?? 0;

  function openCreate() {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(i: Instructor) {
    setEditTarget(i);
    setForm({
      name: i.name,
      fatherName: i.fatherName ?? "",
      phone: i.phone ?? "",
      address: i.address ?? "",
      specialization: i.specialization ?? "",
      courseId: i.courseId ?? "",
      paymentModel: ((i as any).paymentModel ?? "salary") as PaymentModel,
      monthlySalary: String(i.monthlySalary),
      lectureRate: String((i as any).lectureRate ?? "0"),
      commissionPercent: String((i as any).commissionPercent ?? "0"),
      joinDate: i.joinDate,
      status: i.status as "active" | "inactive",
    });
    setDialogOpen(true);
  }

  function setField<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  async function handleSubmit() {
    if (!form.name.trim() || !form.joinDate) {
      toast({ title: "Validation Error", description: "Name and join date are required.", variant: "destructive" });
      return;
    }
    if (form.paymentModel === "salary" && !form.monthlySalary) {
      toast({ title: "Validation Error", description: "Monthly salary is required.", variant: "destructive" });
      return;
    }
    if (form.paymentModel === "per_lecture" && !form.lectureRate) {
      toast({ title: "Validation Error", description: "Lecture rate is required.", variant: "destructive" });
      return;
    }
    if (form.paymentModel === "commission" && !form.commissionPercent) {
      toast({ title: "Validation Error", description: "Commission % is required.", variant: "destructive" });
      return;
    }

    const payload: Record<string, any> = {
      name: form.name.trim(),
      fatherName: form.fatherName || undefined,
      phone: form.phone || undefined,
      address: form.address || undefined,
      specialization: form.specialization || undefined,
      courseId: form.courseId ? Number(form.courseId) : undefined,
      paymentModel: form.paymentModel,
      monthlySalary: form.paymentModel === "salary" ? Number(form.monthlySalary) : 0,
      lectureRate: form.paymentModel === "per_lecture" ? Number(form.lectureRate) : 0,
      commissionPercent: form.paymentModel === "commission" ? Number(form.commissionPercent) : 0,
      joinDate: form.joinDate,
      status: form.status,
    };
    try {
      if (editTarget) {
        await updateMutation.mutateAsync({ id: editTarget.id, data: payload as any });
        toast({ title: "Instructor updated" });
      } else {
        await createMutation.mutateAsync({ data: payload as any });
        toast({ title: "Instructor added" });
      }
      qc.invalidateQueries({ queryKey: ["listInstructors"] });
      setDialogOpen(false);
    } catch {
      toast({ title: "Error", description: "Failed to save instructor.", variant: "destructive" });
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync({ id: deleteTarget.id });
      toast({ title: "Instructor deleted" });
      qc.invalidateQueries({ queryKey: ["listInstructors"] });
      setDeleteTarget(null);
    } catch {
      toast({ title: "Error", description: "Failed to delete instructor.", variant: "destructive" });
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  function renderModelBadge(model: string) {
    const colors: Record<string, string> = {
      salary: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800",
      per_lecture: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-800",
      commission: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800",
    };
    const labels: Record<string, string> = {
      salary: "Salary",
      per_lecture: "Per Lecture",
      commission: "Commission",
    };
    return (
      <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border", colors[model] ?? colors.salary)}>
        {labels[model] ?? model}
      </span>
    );
  }

  function renderRateInfo(i: Instructor) {
    const model = (i as any).paymentModel ?? "salary";
    if (model === "salary") return formatCurrency(i.monthlySalary) + "/mo";
    if (model === "per_lecture") return formatCurrency((i as any).lectureRate ?? 0) + "/lec";
    if (model === "commission") return ((i as any).commissionPercent ?? 0) + "% comm";
    return "—";
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Instructors</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage teaching staff — salary, per-lecture, or commission models.</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="w-4 h-4" /> Add Instructor
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="text-2xl font-bold">{filtered?.length ?? "—"}</div>
            <div className="text-sm text-muted-foreground mt-1">Total Instructors</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="text-2xl font-bold text-green-600">{filtered?.filter((i) => i.status === "active").length ?? "—"}</div>
            <div className="text-sm text-muted-foreground mt-1">Active</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="text-2xl font-bold text-purple-600">
              {filtered?.filter((i) => (i as any).paymentModel === "per_lecture").length ?? 0}
            </div>
            <div className="text-sm text-muted-foreground mt-1">Per-Lecture</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="text-2xl font-bold">{formatCurrency(totalSalaryPayroll)}</div>
            <div className="text-sm text-muted-foreground mt-1">Fixed Payroll</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search by name, code, phone…" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={filterCourse} onValueChange={setFilterCourse}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="All Courses" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Courses</SelectItem>
                {courses?.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterModel} onValueChange={setFilterModel}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder="All Models" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Models</SelectItem>
                <SelectItem value="salary">Monthly Salary</SelectItem>
                <SelectItem value="per_lecture">Per Lecture</SelectItem>
                <SelectItem value="commission">Commission</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="All Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="p-6 text-center text-destructive flex items-center justify-center gap-2">
          <AlertCircle className="w-4 h-4" /> Failed to load instructors.
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
      ) : (
        <Card>
          <CardContent className="p-0">
            {!filtered?.length ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <UserCheck className="w-10 h-10 text-muted-foreground/40" />
                <p className="text-muted-foreground text-sm">No instructors found.</p>
                <Button variant="outline" onClick={openCreate} className="gap-2"><Plus className="w-4 h-4" /> Add First Instructor</Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Code</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Name</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Specialization</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Course</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Model</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground">Rate</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Join Date</th>
                      <th className="text-center px-4 py-3 font-medium text-muted-foreground">Status</th>
                      <th className="text-center px-4 py-3 font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered!.map((i) => (
                      <tr key={i.id} className="border-b border-border hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3 font-mono text-primary font-semibold">{i.instructorCode}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium">{i.name}</div>
                          {i.phone && <div className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="w-3 h-3" />{i.phone}</div>}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{i.specialization ?? "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground">{i.courseName ?? "—"}</td>
                        <td className="px-4 py-3">{renderModelBadge((i as any).paymentModel ?? "salary")}</td>
                        <td className="px-4 py-3 text-right font-mono font-semibold">{renderRateInfo(i)}</td>
                        <td className="px-4 py-3 text-muted-foreground">{new Date(i.joinDate).toLocaleDateString("en-PK")}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border",
                            i.status === "active" ? "text-green-700 bg-green-50 border-green-200 dark:text-green-400 dark:bg-green-950/40 dark:border-green-800" : "text-slate-500 bg-slate-50 border-slate-200 dark:bg-slate-900/40 dark:border-slate-700")}>
                            {i.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1">
                            <Link href={`/instructors/${i.id}`}>
                              <Button variant="ghost" size="icon" className="w-8 h-8"><Eye className="w-4 h-4" /></Button>
                            </Link>
                            <Button variant="ghost" size="icon" className="w-8 h-8" onClick={() => openEdit(i)}><Pencil className="w-4 h-4" /></Button>
                            <Button variant="ghost" size="icon" className="w-8 h-8 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(i)}><Trash2 className="w-4 h-4" /></Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle>{editTarget ? "Edit Instructor" : "Add Instructor"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2 overflow-y-auto flex-1 pr-1">
            <div className="col-span-2 space-y-1">
              <Label>Name <span className="text-destructive">*</span></Label>
              <Input value={form.name} onChange={(e) => setField("name", e.target.value)} placeholder="Full name" />
            </div>
            <div className="space-y-1">
              <Label>Father Name</Label>
              <Input value={form.fatherName} onChange={(e) => setField("fatherName", e.target.value)} placeholder="Optional" />
            </div>
            <div className="space-y-1">
              <Label>Phone</Label>
              <Input value={form.phone} onChange={(e) => setField("phone", e.target.value)} placeholder="Optional" />
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Address</Label>
              <Input value={form.address} onChange={(e) => setField("address", e.target.value)} placeholder="Optional" />
            </div>
            <div className="space-y-1">
              <Label>Specialization</Label>
              <Input value={form.specialization} onChange={(e) => setField("specialization", e.target.value)} placeholder="e.g. Web Development" />
            </div>
            <div className="space-y-1">
              <Label>Course</Label>
              <Select value={form.courseId ? String(form.courseId) : "none"} onValueChange={(v) => setField("courseId", v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {courses?.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-2 space-y-1">
              <Label>Payment Model <span className="text-destructive">*</span></Label>
              <Select value={form.paymentModel} onValueChange={(v) => setField("paymentModel", v as PaymentModel)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="salary">Monthly Salary (fixed amount per month)</SelectItem>
                  <SelectItem value="per_lecture">Per Lecture (rate × lectures delivered)</SelectItem>
                  <SelectItem value="commission">Commission (% of course revenue)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.paymentModel === "salary" && (
              <div className="col-span-2 space-y-1">
                <Label>Monthly Salary (PKR) <span className="text-destructive">*</span></Label>
                <Input type="number" min="0" value={form.monthlySalary} onChange={(e) => setField("monthlySalary", e.target.value)} placeholder="0" />
              </div>
            )}
            {form.paymentModel === "per_lecture" && (
              <div className="col-span-2 space-y-1">
                <Label>Rate per Lecture (PKR) <span className="text-destructive">*</span></Label>
                <Input type="number" min="0" step="0.01" value={form.lectureRate} onChange={(e) => setField("lectureRate", e.target.value)} placeholder="e.g. 500" />
                <p className="text-xs text-muted-foreground">Earnings = rate × total lectures delivered (tracked via attendance log)</p>
              </div>
            )}
            {form.paymentModel === "commission" && (
              <div className="col-span-2 space-y-1">
                <Label>Commission % <span className="text-destructive">*</span></Label>
                <Input type="number" min="0" max="100" step="0.1" value={form.commissionPercent} onChange={(e) => setField("commissionPercent", e.target.value)} placeholder="e.g. 10" />
                <p className="text-xs text-muted-foreground">Earnings = % of total fees collected from students of the assigned course</p>
              </div>
            )}

            <div className="space-y-1">
              <Label>Join Date <span className="text-destructive">*</span></Label>
              <Input type="date" value={form.joinDate} onChange={(e) => setField("joinDate", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setField("status", v as "active" | "inactive")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="shrink-0 pt-2 border-t border-border">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={isPending}>{isPending ? "Saving…" : editTarget ? "Save Changes" : "Add Instructor"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Instructor?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{deleteTarget?.name}</strong> ({deleteTarget?.instructorCode}) and all their salary and attendance records. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
