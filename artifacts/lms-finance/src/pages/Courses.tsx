import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListCourses, getListCoursesQueryKey,
  useCreateCourse, useUpdateCourse, useDeleteCourse,
} from "@workspace/api-client-react";
import type { Course, CreateCourseInput, UpdateCourseInput } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";
import { Plus, Pencil, Trash2, BookOpen, AlertCircle, Clock, Info, Star } from "lucide-react";
import { useForm } from "react-hook-form";
import { useAuth } from "@/hooks/use-auth";

export default function Courses() {
  const qc = useQueryClient();
  const { canDelete } = useAuth();
  const [showDialog, setShowDialog] = useState(false);
  const [editItem, setEditItem] = useState<Course | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Course | null>(null);
  const [filterCategory, setFilterCategory] = useState<"all" | "major" | "other">("all");

  const { data: courses, isLoading, error } = useListCourses({
    query: { queryKey: getListCoursesQueryKey() },
  });

  const createMutation = useCreateCourse();
  const updateMutation = useUpdateCourse();
  const deleteMutation = useDeleteCourse();

  const filtered = filterCategory === "all" ? courses : courses?.filter(c => (c as any).category === filterCategory);

  function openAdd() { setEditItem(null); setShowDialog(true); }
  function openEdit(c: Course) { setEditItem(c); setShowDialog(true); }

  function handleDelete() {
    if (!deleteConfirm) return;
    deleteMutation.mutate({ id: deleteConfirm.id }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListCoursesQueryKey() });
        setDeleteConfirm(null);
      },
      onError: (e: any) => {
        alert(e?.data?.message ?? "Failed to delete course");
        setDeleteConfirm(null);
      },
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Courses</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage all courses. Fee and duration defined here drive voucher generation and student enrollment.
          </p>
        </div>
        <Button onClick={openAdd} className="gap-2">
          <Plus className="w-4 h-4" /> Add Course
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex gap-1 p-1 bg-muted/50 rounded-lg">
          {(["all", "major", "other"] as const).map(cat => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors capitalize ${
                filterCategory === cat ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {cat === "all" ? "All Courses" : cat === "major" ? "⭐ Major" : "Other"}
            </button>
          ))}
        </div>
        <span className="text-sm text-muted-foreground">{filtered?.length ?? 0} course{filtered?.length !== 1 ? "s" : ""}</span>
      </div>

      <div className="p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg flex gap-3 text-sm text-blue-800 dark:text-blue-300">
        <Info className="w-4 h-4 mt-0.5 shrink-0" />
        <div>
          <strong>Major</strong> courses (DIT, IICT, CIT, etc.) are flagged separately from other courses.
          <strong className="ml-1">Duration</strong> controls the auto-calculated end date.
          <strong className="ml-1">Monthly Fee</strong> drives voucher generation (minus per-student discount).
          Changes do not retroactively update existing vouchers.
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => <Skeleton key={i} className="h-48 w-full" />)}
        </div>
      ) : error ? (
        <div className="p-6 text-center text-destructive flex items-center justify-center gap-2">
          <AlertCircle className="w-4 h-4" /> Failed to load courses.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered?.map((course) => (
            <Card key={course.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                      <BookOpen className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-base">{course.name}</CardTitle>
                        {(course as any).category === "major" && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800">
                            <Star className="w-2.5 h-2.5" />MAJOR
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-mono text-muted-foreground mt-0.5">CODE: {course.code}</p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(course)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    {canDelete && (
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => setDeleteConfirm(course)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-muted/30 rounded-lg">
                    <div className="text-lg font-bold text-foreground">{formatCurrency(course.monthlyFee)}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">Monthly Fee</div>
                  </div>
                  <div className="p-3 bg-muted/30 rounded-lg">
                    <div className="text-lg font-bold text-foreground">{formatCurrency(course.totalFee)}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">Total Fee</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{course.durationMonths} month{course.durationMonths !== 1 ? "s" : ""} duration</span>
                </div>
                {course.description && (
                  <p className="text-xs text-muted-foreground border-t border-border pt-2">{course.description}</p>
                )}
              </CardContent>
            </Card>
          ))}

          {filtered?.length === 0 && (
            <div className="col-span-3 text-center py-16 text-muted-foreground">
              <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No courses found</p>
              <p className="text-sm mt-1">Add your first course to start enrolling students.</p>
              <Button className="mt-4 gap-2" onClick={openAdd}>
                <Plus className="w-4 h-4" /> Add First Course
              </Button>
            </div>
          )}
        </div>
      )}

      <CourseFormDialog
        open={showDialog}
        onClose={() => setShowDialog(false)}
        course={editItem}
        onSuccess={() => {
          qc.invalidateQueries({ queryKey: getListCoursesQueryKey() });
          setShowDialog(false);
        }}
        createMutation={createMutation}
        updateMutation={updateMutation}
      />

      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Course</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Delete <strong>{deleteConfirm?.name}</strong>? This will fail if any students are enrolled in this course.
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

type CourseFormData = {
  name: string;
  code: string;
  durationMonths: number;
  monthlyFee: number;
  description?: string;
};

const MAJOR_NAMES = ["DIT", "IICT", "CIT"];

function CourseFormDialog({
  open, onClose, course, onSuccess, createMutation, updateMutation,
}: {
  open: boolean;
  onClose: () => void;
  course: Course | null;
  onSuccess: () => void;
  createMutation: ReturnType<typeof useCreateCourse>;
  updateMutation: ReturnType<typeof useUpdateCourse>;
}) {
  const [category, setCategory] = useState<"major" | "other">((course as any)?.category ?? "other");

  const { register, handleSubmit, watch, formState: { errors }, reset } = useForm<CourseFormData>({
    defaultValues: course
      ? { name: course.name, code: course.code, durationMonths: course.durationMonths, monthlyFee: course.monthlyFee, description: course.description ?? "" }
      : { durationMonths: 1 },
  });

  const monthlyFee = watch("monthlyFee");
  const durationMonths = watch("durationMonths");
  const totalFee = (Number(monthlyFee) || 0) * (Number(durationMonths) || 0);

  function onSubmit(data: CourseFormData) {
    const payload = {
      name: data.name.trim(),
      code: data.code.toUpperCase().trim(),
      category,
      durationMonths: Number(data.durationMonths),
      monthlyFee: Number(data.monthlyFee),
      description: data.description || undefined,
    };
    if (course) {
      updateMutation.mutate({ id: course.id, data: payload as UpdateCourseInput }, {
        onSuccess: () => { onSuccess(); reset(); }
      });
    } else {
      createMutation.mutate({ data: payload as CreateCourseInput }, {
        onSuccess: () => { onSuccess(); reset(); setCategory("other"); }
      });
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending;
  const apiError = (createMutation.error as any)?.data?.message || (updateMutation.error as any)?.data?.message;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { onClose(); reset(); setCategory("other"); } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{course ? "Edit Course" : "Add Course"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {apiError && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded text-destructive text-sm">{apiError}</div>
          )}

          <div className="space-y-1.5">
            <Label>Category *</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as "major" | "other")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="major">⭐ Major (DIT, IICT, CIT, etc.)</SelectItem>
                <SelectItem value="other">Other / Short Course</SelectItem>
              </SelectContent>
            </Select>
            {category === "major" && (
              <p className="text-xs text-muted-foreground">Common major names: {MAJOR_NAMES.join(", ")}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Course Name *</Label>
              <Input {...register("name", { required: "Name is required" })} placeholder="e.g. DIT" />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Course Code *</Label>
              <Input {...register("code", { required: "Code is required" })} placeholder="e.g. DIT" className="uppercase" />
              {errors.code && <p className="text-xs text-destructive">{errors.code.message}</p>}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Duration (Months) *</Label>
            <Input
              type="number" min={1} max={60}
              {...register("durationMonths", { required: true, min: 1, valueAsNumber: true })}
              placeholder="e.g. 12"
            />
            {errors.durationMonths && <p className="text-xs text-destructive">Duration must be at least 1 month</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Monthly Fee (PKR) *</Label>
            <Input
              type="number" step="0.01" min="1"
              {...register("monthlyFee", { required: "Fee is required", min: 1, valueAsNumber: true })}
              placeholder="e.g. 18000"
            />
            {errors.monthlyFee && <p className="text-xs text-destructive">{errors.monthlyFee.message}</p>}
          </div>
          {totalFee > 0 && (
            <div className="p-3 bg-muted/30 rounded-lg flex justify-between text-sm">
              <span className="text-muted-foreground">Calculated Total Fee:</span>
              <span className="font-bold">{formatCurrency(totalFee)}</span>
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Input {...register("description")} placeholder="Optional description..." />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { onClose(); reset(); setCategory("other"); }}>Cancel</Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving..." : course ? "Save Changes" : "Add Course"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
