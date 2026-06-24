import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListStudents, getListStudentsQueryKey,
  useCreateStudent, useUpdateStudent, useDeleteStudent,
  useListCourses, getListCoursesQueryKey,
} from "@workspace/api-client-react";
import type { Student, CreateStudentInput, UpdateStudentInput, Course } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatCurrency, getStatusColor } from "@/lib/utils";
import { Plus, Search, Pencil, Trash2, BookOpen, AlertCircle, Eye, Tag, CreditCard } from "lucide-react";
import { useForm, Controller } from "react-hook-form";
import { Link } from "wouter";

export default function Students() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [courseFilter, setCourseFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showDialog, setShowDialog] = useState(false);
  const [editStudent, setEditStudent] = useState<Student | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Student | null>(null);

  const { data: courses } = useListCourses({ query: { queryKey: getListCoursesQueryKey() } });

  const params: Record<string, any> = {};
  if (courseFilter !== "all") params.courseId = Number(courseFilter);
  if (statusFilter !== "all") params.status = statusFilter;
  if (search.trim()) params.search = search.trim();

  const { data: students, isLoading, error } = useListStudents(params, {
    query: { queryKey: getListStudentsQueryKey(params) },
  });

  const createMutation = useCreateStudent();
  const updateMutation = useUpdateStudent();
  const deleteMutation = useDeleteStudent();

  function handleDelete() {
    if (!deleteConfirm) return;
    deleteMutation.mutate({ id: deleteConfirm.id }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListStudentsQueryKey() });
        setDeleteConfirm(null);
      },
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Students</h1>
          <p className="text-sm text-muted-foreground mt-1">Student codes auto-generated. Search by name, code, or phone.</p>
        </div>
        <Button onClick={() => { setEditStudent(null); setShowDialog(true); }} className="gap-2">
          <Plus className="w-4 h-4" /> Enroll Student
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, code, or phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={courseFilter} onValueChange={setCourseFilter}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="All Courses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Courses</SelectItem>
                {courses?.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {error && (
            <div className="p-6 text-center text-destructive flex items-center justify-center gap-2">
              <AlertCircle className="w-4 h-4" /> Failed to load students.
            </div>
          )}
          {isLoading ? (
            <div className="p-4 space-y-3">
              {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Code</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Name</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Course</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Father Name</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Phone</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Effective Fee</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">End Date</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {students?.length === 0 && (
                    <tr><td colSpan={9} className="text-center py-12 text-muted-foreground">
                      <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      No students found.
                    </td></tr>
                  )}
                  {students?.map((s) => (
                    <tr key={s.id} className="border-b border-border hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs font-bold text-primary">{s.studentCode}</td>
                      <td className="px-4 py-3 font-medium">{s.name}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                          {s.course}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{s.fatherName ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{s.phone ?? "—"}</td>
                      <td className="px-4 py-3 text-right font-mono text-sm">
                        {formatCurrency(s.effectiveFee ?? 0)}
                        {(s.discountAmount ?? 0) > 0 && (
                          <span className="ml-1 text-xs text-amber-600 dark:text-amber-400">
                            (-{formatCurrency(s.discountAmount ?? 0)})
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{s.endDate ?? "—"}</td>
                      <td className="px-4 py-3">
                        <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border", getStatusColor(s.status))}>
                          {s.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Link href={`/students/${s.id}/ledger`}>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="View Ledger">
                              <Eye className="w-3.5 h-3.5" />
                            </Button>
                          </Link>
                          <Link href={`/students/${s.id}/idcard`}>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Print ID Card">
                              <CreditCard className="w-3.5 h-3.5" />
                            </Button>
                          </Link>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => { setEditStudent(s); setShowDialog(true); }}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => setDeleteConfirm(s)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
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

      <StudentFormDialog
        open={showDialog}
        onClose={() => setShowDialog(false)}
        student={editStudent}
        courses={courses ?? []}
        onSuccess={() => {
          qc.invalidateQueries({ queryKey: getListStudentsQueryKey() });
          setShowDialog(false);
        }}
        createMutation={createMutation}
        updateMutation={updateMutation}
      />

      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Student</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Delete <strong>{deleteConfirm?.name}</strong> ({deleteConfirm?.studentCode})? All their vouchers and receipts will also be deleted.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StudentFormDialog({
  open, onClose, student, courses, onSuccess, createMutation, updateMutation,
}: {
  open: boolean;
  onClose: () => void;
  student: Student | null;
  courses: Course[];
  onSuccess: () => void;
  createMutation: ReturnType<typeof useCreateStudent>;
  updateMutation: ReturnType<typeof useUpdateStudent>;
}) {
  const { register, handleSubmit, control, watch, setValue, formState: { errors }, reset } = useForm<CreateStudentInput & { courseId: number }>({
    defaultValues: student
      ? { name: student.name, courseId: student.courseId, fatherName: student.fatherName ?? "", phone: student.phone ?? "", address: student.address ?? "", status: student.status as any, enrollmentDate: student.enrollmentDate, discountAmount: student.discountAmount ?? 0 }
      : { status: "active", enrollmentDate: new Date().toISOString().slice(0, 10), discountAmount: 0 },
  });

  useEffect(() => {
    if (open) {
      reset(student
        ? { name: student.name, courseId: student.courseId, fatherName: student.fatherName ?? "", phone: student.phone ?? "", address: student.address ?? "", status: student.status as any, enrollmentDate: student.enrollmentDate, discountAmount: student.discountAmount ?? 0 }
        : { status: "active", enrollmentDate: new Date().toISOString().slice(0, 10), discountAmount: 0 }
      );
    }
  }, [open, student]);

  const selectedCourseId = watch("courseId");
  const enrollmentDate = watch("enrollmentDate");
  const discountAmount = watch("discountAmount") ?? 0;
  const selectedCourse = courses.find((c) => c.id === Number(selectedCourseId));

  const endDate = selectedCourse && enrollmentDate
    ? (() => {
        const d = new Date(enrollmentDate);
        d.setMonth(d.getMonth() + selectedCourse.durationMonths);
        return d.toISOString().slice(0, 10);
      })()
    : null;

  const totalCourseFee = selectedCourse ? selectedCourse.monthlyFee * selectedCourse.durationMonths : 0;
  const effectiveFee = selectedCourse
    ? Math.max(0, (totalCourseFee - Number(discountAmount || 0)) / selectedCourse.durationMonths)
    : 0;

  function onSubmit(data: CreateStudentInput & { courseId: number }) {
    const payload = {
      name: data.name,
      courseId: Number(data.courseId),
      fatherName: data.fatherName || undefined,
      phone: data.phone || undefined,
      address: data.address || undefined,
      status: data.status ?? "active",
      enrollmentDate: data.enrollmentDate,
      discountAmount: Number(data.discountAmount ?? 0),
    };
    if (student) {
      updateMutation.mutate({ id: student.id, data: payload as UpdateStudentInput }, { onSuccess });
    } else {
      createMutation.mutate({ data: payload as CreateStudentInput }, { onSuccess });
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending;
  const apiError = (createMutation.error as any)?.data?.message || (updateMutation.error as any)?.data?.message;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
          <DialogTitle>{student ? "Edit Student" : "Enroll Student"}</DialogTitle>
          {!student && <p className="text-sm text-muted-foreground">Student code will be auto-generated on save.</p>}
        </DialogHeader>

        <div className="overflow-y-auto max-h-[calc(90vh-130px)]">
          <form onSubmit={handleSubmit(onSubmit)} id="student-form" className="px-6 py-4 space-y-4">
            {apiError && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded text-destructive text-sm">{apiError}</div>
            )}

            {student && (
              <div className="flex items-center gap-2 p-2 bg-primary/5 rounded border border-primary/20">
                <Tag className="w-4 h-4 text-primary" />
                <span className="text-sm">Student Code: <strong className="font-mono">{student.studentCode}</strong></span>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Full Name *</Label>
              <Input {...register("name", { required: "Name is required" })} placeholder="Ali Khan" />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Course *</Label>
                <Controller name="courseId" control={control} rules={{ required: true }} render={({ field }) => (
                  <Select value={String(field.value ?? "")} onValueChange={(v) => field.onChange(Number(v))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select course..." />
                    </SelectTrigger>
                    <SelectContent>
                      {courses.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name} ({c.durationMonths}m)</SelectItem>)}
                    </SelectContent>
                  </Select>
                )} />
                {errors.courseId && <p className="text-xs text-destructive">Course is required</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Controller name="status" control={control} render={({ field }) => (
                  <Select value={field.value ?? "active"} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                )} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Enrollment Date *</Label>
                <Input type="date" {...register("enrollmentDate", { required: true })} />
              </div>
              <div className="space-y-1.5">
                <Label>End Date (auto)</Label>
                <Input value={endDate ?? ""} readOnly className="bg-muted/30 cursor-not-allowed" placeholder="Select course + date" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Father Name</Label>
              <Input {...register("fatherName")} placeholder="Muhammad Khan" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input {...register("phone")} placeholder="03xx-xxxxxxx" />
              </div>
              <div className="space-y-1.5">
                <Label>Address</Label>
                <Input {...register("address")} placeholder="Street, City" />
              </div>
            </div>

            {selectedCourse && (
              <div className="space-y-1.5">
                <Label>Discount on Total Course Fee (PKR)</Label>
                <Input
                  type="number"
                  min={0}
                  max={totalCourseFee}
                  step="1"
                  {...register("discountAmount", { min: 0, max: totalCourseFee, valueAsNumber: true })}
                  placeholder="0 — enter total discount, not per-month"
                />
                <div className="rounded-md border border-border bg-muted/20 divide-y divide-border text-xs">
                  <div className="flex justify-between px-3 py-1.5 text-muted-foreground">
                    <span>{selectedCourse.durationMonths} months × {formatCurrency(Number(selectedCourse.monthlyFee))}</span>
                    <span className="font-mono">{formatCurrency(totalCourseFee)}</span>
                  </div>
                  <div className="flex justify-between px-3 py-1.5 text-amber-700 dark:text-amber-400">
                    <span>Discount</span>
                    <span className="font-mono">− {formatCurrency(Number(discountAmount) || 0)}</span>
                  </div>
                  <div className="flex justify-between px-3 py-1.5 font-semibold text-foreground">
                    <span>Final total payable</span>
                    <span className="font-mono">{formatCurrency(Math.max(0, totalCourseFee - (Number(discountAmount) || 0)))}</span>
                  </div>
                  <div className="flex justify-between px-3 py-1.5 text-primary font-semibold">
                    <span>Monthly (÷ {selectedCourse.durationMonths})</span>
                    <span className="font-mono">{formatCurrency(effectiveFee)} / mo</span>
                  </div>
                </div>
              </div>
            )}
          </form>
        </div>

        <div className="px-6 py-4 border-t border-border bg-muted/20 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="student-form" disabled={isPending}>
            {isPending ? "Saving..." : student ? "Save Changes" : "Enroll Student"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
