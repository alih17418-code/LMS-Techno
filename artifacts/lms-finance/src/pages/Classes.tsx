import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";
import { PlusCircle, Pencil, Trash2, School, Plus, Users, X } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useAuth } from "@/hooks/use-auth";
import { Badge } from "@/components/ui/badge";

type ClassRecord = {
  id: number; className: string; courseId: number; courseName: string;
  instructorId?: number; instructorName?: string; batch?: string;
  year: number; section?: string; semester?: number; createdAt: string;
};
type Course = { id: number; name: string; };
type Instructor = { id: number; name: string; };
type ClassInstructor = { id: number; instructorId: number; instructorName: string; subject: string | null; };

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - 2 + i);

function emptyForm() {
  return { className: "", courseId: "", instructorId: "none", batch: "", year: String(CURRENT_YEAR), section: "", semester: "" };
}

function emptyCourseForm() {
  return { name: "", feeType: "monthly", monthlyFee: "", totalFee: "", durationMonths: "12", category: "Major" };
}

export default function Classes() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { canEdit, canDelete, canAdd } = useAuth();
  const { user } = useAuth();
  const isInstructor = user?.role === "instructor";
  const myInstructorId = (user as any)?.instructorId as number | undefined;

  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [search, setSearch] = useState("");

  const [quickCourseOpen, setQuickCourseOpen] = useState(false);
  const [courseForm, setCourseForm] = useState(emptyCourseForm());

  // Manage instructors dialog state
  const [managingClass, setManagingClass] = useState<ClassRecord | null>(null);
  const [addInstructorId, setAddInstructorId] = useState("none");
  const [addSubject, setAddSubject] = useState("");

  const { data: classes = [], isLoading } = useQuery<ClassRecord[]>({
    queryKey: ["classes"],
    queryFn: () => apiFetch("/classes"),
  });
  const { data: courses = [] } = useQuery<Course[]>({
    queryKey: ["courses"],
    queryFn: () => apiFetch("/courses"),
  });
  const { data: instructors = [] } = useQuery<Instructor[]>({
    queryKey: ["instructors"],
    queryFn: () => apiFetch("/instructors"),
  });

  // Load instructors for the currently managed class
  const { data: classInstructors = [], isLoading: loadingCI } = useQuery<ClassInstructor[]>({
    queryKey: ["class-instructors", managingClass?.id],
    queryFn: () => apiFetch(`/classes/${managingClass!.id}/instructors`),
    enabled: !!managingClass,
  });

  const upsert = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      editId
        ? apiFetch(`/classes/${editId}`, { method: "PUT", body: JSON.stringify(body) })
        : apiFetch("/classes", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["classes"] });
      setOpen(false); setEditId(null); setForm(emptyForm());
      toast({ title: editId ? "Class updated" : "Class added" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const del = useMutation({
    mutationFn: (id: number) => apiFetch(`/classes/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["classes"] }); toast({ title: "Class deleted" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const addCourse = useMutation({
    mutationFn: (body: Record<string, unknown>) => apiFetch("/courses", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: (newCourse: Course) => {
      qc.invalidateQueries({ queryKey: ["courses"] });
      setForm((f) => ({ ...f, courseId: String(newCourse.id) }));
      setQuickCourseOpen(false);
      setCourseForm(emptyCourseForm());
      toast({ title: "Course added", description: `${newCourse.name} has been added and selected.` });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const assignInstructor = useMutation({
    mutationFn: ({ classId, instructorId, subject }: { classId: number; instructorId: number; subject: string }) =>
      apiFetch(`/classes/${classId}/instructors`, { method: "POST", body: JSON.stringify({ instructorId, subject }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["class-instructors", managingClass?.id] });
      qc.invalidateQueries({ queryKey: ["classes"] });
      setAddInstructorId("none");
      setAddSubject("");
      toast({ title: "Instructor assigned" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const removeInstructor = useMutation({
    mutationFn: ({ classId, instructorId }: { classId: number; instructorId: number }) =>
      apiFetch(`/classes/${classId}/instructors/${instructorId}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["class-instructors", managingClass?.id] });
      qc.invalidateQueries({ queryKey: ["classes"] });
      toast({ title: "Instructor removed" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handleEdit = (c: ClassRecord) => {
    setEditId(c.id);
    setForm({
      className: c.className, courseId: String(c.courseId),
      instructorId: c.instructorId ? String(c.instructorId) : "none",
      batch: c.batch ?? "", year: String(c.year),
      section: c.section ?? "", semester: c.semester ? String(c.semester) : "",
    });
    setOpen(true);
  };

  const handleSubmit = () => {
    const body: Record<string, unknown> = {
      className: form.className.trim(),
      courseId: Number(form.courseId),
      instructorId: form.instructorId !== "none" ? Number(form.instructorId) : null,
      batch: form.batch.trim() || null,
      year: Number(form.year),
      section: form.section.trim() || null,
      semester: form.semester ? Number(form.semester) : null,
    };
    upsert.mutate(body);
  };

  const handleAddCourse = () => {
    const body: Record<string, unknown> = {
      name: courseForm.name.trim(),
      feeType: courseForm.feeType,
      monthlyFee: courseForm.feeType === "monthly" ? Number(courseForm.monthlyFee) : null,
      totalFee: courseForm.feeType === "total" ? Number(courseForm.totalFee) : null,
      durationMonths: Number(courseForm.durationMonths),
      category: courseForm.category,
    };
    addCourse.mutate(body);
  };

  const handleAssignInstructor = () => {
    if (!managingClass || addInstructorId === "none") return;
    assignInstructor.mutate({ classId: managingClass.id, instructorId: Number(addInstructorId), subject: addSubject.trim() });
  };

  // Instructors only see their own classes
  const filtered = classes
    .filter((c) => !isInstructor || !myInstructorId || c.instructorId === myInstructorId)
    .filter((c) =>
      !search || c.className.toLowerCase().includes(search.toLowerCase()) ||
      c.courseName.toLowerCase().includes(search.toLowerCase()) ||
      (c.instructorName ?? "").toLowerCase().includes(search.toLowerCase())
    );

  // Which instructors can still be added to the managing class?
  const assignedIds = new Set(classInstructors.map(ci => ci.instructorId));
  const availableInstructors = instructors.filter(i => !assignedIds.has(i.id));

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Class Management</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {isInstructor ? "Your assigned class batches." : "Manage class batches, instructors, and sections."}
          </p>
        </div>
        {canAdd && (
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditId(null); setForm(emptyForm()); } }}>
            <DialogTrigger asChild>
              <Button className="gap-2"><PlusCircle className="w-4 h-4" /> Add Class</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>{editId ? "Edit Class" : "Add New Class"}</DialogTitle>
                <DialogDescription>Fill in class details. Course is required.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <Label>Class Name *</Label>
                  <Input placeholder="e.g. Morning Batch A" value={form.className}
                    onChange={(e) => setForm((f) => ({ ...f, className: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <Label>Course *</Label>
                      <button
                        type="button"
                        onClick={() => setQuickCourseOpen(true)}
                        className="text-xs text-primary hover:underline flex items-center gap-0.5"
                        title="Quick-add a new course"
                      >
                        <Plus className="w-3 h-3" /> New
                      </button>
                    </div>
                    <Select value={form.courseId} onValueChange={(v) => setForm((f) => ({ ...f, courseId: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select course" /></SelectTrigger>
                      <SelectContent>
                        {courses.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Primary Instructor</Label>
                    <Select value={form.instructorId} onValueChange={(v) => setForm((f) => ({ ...f, instructorId: v }))}>
                      <SelectTrigger><SelectValue placeholder="Assign instructor" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— None —</SelectItem>
                        {instructors.map((i) => <SelectItem key={i.id} value={String(i.id)}>{i.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>Year *</Label>
                    <Select value={form.year} onValueChange={(v) => setForm((f) => ({ ...f, year: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{YEARS.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Batch</Label>
                    <Input placeholder="e.g. Fall 2024" value={form.batch}
                      onChange={(e) => setForm((f) => ({ ...f, batch: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Section</Label>
                    <Input placeholder="e.g. A" value={form.section}
                      onChange={(e) => setForm((f) => ({ ...f, section: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <Label>Semester (DIT only)</Label>
                  <Select value={form.semester || "none"} onValueChange={(v) => setForm((f) => ({ ...f, semester: v === "none" ? "" : v }))}>
                    <SelectTrigger><SelectValue placeholder="N/A" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">N/A</SelectItem>
                      {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => <SelectItem key={s} value={String(s)}>Semester {s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Button className="w-full" disabled={upsert.isPending || !form.className || !form.courseId} onClick={handleSubmit}>
                  {upsert.isPending ? "Saving…" : editId ? "Update Class" : "Add Class"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="flex items-center gap-3">
        <Input placeholder="Search classes, courses, instructors…" value={search}
          onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
        <span className="text-sm text-muted-foreground">{filtered.length} classes</span>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              {["Class Name", "Course", "Instructors", "Batch / Section", "Year", "Semester", ...(canEdit || canDelete ? [""] : [])].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">
                <School className="w-8 h-8 mx-auto mb-2 opacity-30" />
                {isInstructor ? "No classes assigned to you yet." : "No classes found. Add your first class."}
              </td></tr>
            ) : filtered.map((c) => (
              <tr key={c.id} className="border-t hover:bg-muted/30">
                <td className="px-4 py-3 font-medium">{c.className}</td>
                <td className="px-4 py-3 text-muted-foreground">{c.courseName}</td>
                <td className="px-4 py-3">
                  <ClassInstructorCell classId={c.id} primaryName={c.instructorName} />
                </td>
                <td className="px-4 py-3 text-muted-foreground">{[c.batch, c.section ? `Sec ${c.section}` : ""].filter(Boolean).join(" / ") || "—"}</td>
                <td className="px-4 py-3">{c.year}</td>
                <td className="px-4 py-3 text-muted-foreground">{c.semester ? `Sem ${c.semester}` : "—"}</td>
                {(canEdit || canDelete) && (
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {canEdit && (
                        <>
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleEdit(c)} title="Edit class">
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-blue-600 hover:text-blue-800 hover:bg-blue-50" onClick={() => { setManagingClass(c); setAddInstructorId("none"); setAddSubject(""); }} title="Manage instructors">
                            <Users className="w-3.5 h-3.5" />
                          </Button>
                        </>
                      )}
                      {canDelete && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50">
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Class?</AlertDialogTitle>
                              <AlertDialogDescription>Delete "{c.className}"? Attendance records linked to it will lose the class reference.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => del.mutate(c.id)} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Manage Instructors Dialog */}
      <Dialog open={!!managingClass} onOpenChange={(o) => { if (!o) setManagingClass(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Manage Instructors — {managingClass?.className}</DialogTitle>
            <DialogDescription>Assign multiple instructors with their subjects to this class.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {/* Current instructors */}
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Assigned Instructors</Label>
              <div className="mt-2 space-y-2">
                {loadingCI ? (
                  <p className="text-sm text-muted-foreground">Loading…</p>
                ) : classInstructors.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">No instructors assigned yet.</p>
                ) : classInstructors.map((ci) => (
                  <div key={ci.id} className="flex items-center justify-between rounded-lg border px-3 py-2 bg-muted/30">
                    <div>
                      <span className="font-medium text-sm">{ci.instructorName}</span>
                      {ci.subject && <span className="ml-2 text-xs text-muted-foreground">— {ci.subject}</span>}
                    </div>
                    {canEdit && (
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50"
                        onClick={() => removeInstructor.mutate({ classId: managingClass!.id, instructorId: ci.instructorId })}
                        disabled={removeInstructor.isPending}
                      >
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Add new instructor */}
            {canEdit && (
              <div className="border-t pt-4">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">Add Instructor</Label>
                <div className="mt-2 space-y-3">
                  <div>
                    <Label>Instructor</Label>
                    <Select value={addInstructorId} onValueChange={setAddInstructorId}>
                      <SelectTrigger><SelectValue placeholder="Select instructor" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— Select —</SelectItem>
                        {availableInstructors.map((i) => (
                          <SelectItem key={i.id} value={String(i.id)}>{i.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {availableInstructors.length === 0 && instructors.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">All instructors already assigned.</p>
                    )}
                  </div>
                  <div>
                    <Label>Subject (optional)</Label>
                    <Input placeholder="e.g. Mathematics, English, MS Office…" value={addSubject}
                      onChange={(e) => setAddSubject(e.target.value)} />
                  </div>
                  <Button className="w-full" disabled={assignInstructor.isPending || addInstructorId === "none"}
                    onClick={handleAssignInstructor}>
                    {assignInstructor.isPending ? "Assigning…" : "Assign Instructor"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Quick-add Course Dialog — opened from within the class form */}
      <Dialog open={quickCourseOpen} onOpenChange={setQuickCourseOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Quick Add Course</DialogTitle>
            <DialogDescription>Add a new course without leaving this page. It will be selected automatically.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div>
              <Label>Course Name *</Label>
              <Input placeholder="e.g. DIT, BCS, IELTS…" value={courseForm.name}
                onChange={(e) => setCourseForm((f) => ({ ...f, name: e.target.value }))} autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Fee Type</Label>
                <Select value={courseForm.feeType} onValueChange={(v) => setCourseForm((f) => ({ ...f, feeType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="total">Total (split)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Category</Label>
                <Select value={courseForm.category} onValueChange={(v) => setCourseForm((f) => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Major">Major</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {courseForm.feeType === "monthly" ? (
              <div>
                <Label>Monthly Fee (PKR)</Label>
                <Input type="number" placeholder="e.g. 3000" value={courseForm.monthlyFee}
                  onChange={(e) => setCourseForm((f) => ({ ...f, monthlyFee: e.target.value }))} />
              </div>
            ) : (
              <div>
                <Label>Total Fee (PKR)</Label>
                <Input type="number" placeholder="e.g. 30000" value={courseForm.totalFee}
                  onChange={(e) => setCourseForm((f) => ({ ...f, totalFee: e.target.value }))} />
              </div>
            )}
            <div>
              <Label>Duration (months)</Label>
              <Input type="number" min="1" value={courseForm.durationMonths}
                onChange={(e) => setCourseForm((f) => ({ ...f, durationMonths: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuickCourseOpen(false)}>Cancel</Button>
            <Button
              disabled={addCourse.isPending || !courseForm.name.trim()}
              onClick={handleAddCourse}
            >
              {addCourse.isPending ? "Adding…" : "Add Course"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Small inline component to show instructor badges per class row
function ClassInstructorCell({ classId, primaryName }: { classId: number; primaryName?: string }) {
  const { data: cis = [], isLoading } = useQuery<ClassInstructor[]>({
    queryKey: ["class-instructors", classId],
    queryFn: () => apiFetch(`/classes/${classId}/instructors`),
    staleTime: 60_000,
  });

  if (isLoading) return <span className="text-muted-foreground text-xs">…</span>;
  if (cis.length === 0) return <span className="text-muted-foreground">—</span>;

  return (
    <div className="flex flex-wrap gap-1">
      {cis.map((ci) => (
        <Badge key={ci.id} variant="secondary" className="text-xs font-normal">
          {ci.instructorName}{ci.subject ? ` (${ci.subject})` : ""}
        </Badge>
      ))}
    </div>
  );
}
