import { useState, useEffect } from "react";
import { useParams, Link } from "wouter";
import {
  useGetInstructor,
  useCreateInstructorPayment,
  useDeleteInstructorPayment,
  getGetInstructorQueryKey,
} from "@workspace/api-client-react";
import type { InstructorPayment, CreateInstructorPaymentInputPaymentMethod } from "@workspace/api-client-react";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { cn, formatCurrency } from "@/lib/utils";
import { ArrowLeft, Printer, Plus, Trash2, AlertCircle, User, Phone, MapPin, BookOpen, ClipboardList, TrendingUp, BookMarked, Filter } from "lucide-react";
import { printSalarySlip } from "@/lib/printSalarySlip";
import { apiFetch } from "@/lib/api";

const BASE = import.meta.env.BASE_URL;

const MONTHS = [
  { value: 1, label: "January" }, { value: 2, label: "February" },
  { value: 3, label: "March" }, { value: 4, label: "April" },
  { value: 5, label: "May" }, { value: 6, label: "June" },
  { value: 7, label: "July" }, { value: 8, label: "August" },
  { value: 9, label: "September" }, { value: 10, label: "October" },
  { value: 11, label: "November" }, { value: 12, label: "December" },
];

const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "cheque", label: "Cheque" },
  { value: "online", label: "Online" },
];

const SHIFTS = ["Morning", "Afternoon", "Evening", "Night"];

const NOW = new Date();

const EMPTY_PAYMENT = {
  month: NOW.getMonth() + 1,
  year: NOW.getFullYear(),
  amountPaid: "",
  paymentMethod: "cash" as CreateInstructorPaymentInputPaymentMethod,
  paymentDate: NOW.toISOString().split("T")[0],
  remarks: "",
};

const EMPTY_ATTENDANCE = {
  attendanceDate: NOW.toISOString().split("T")[0],
  checkInTime: "09:00",
  checkOutTime: "",
  shift: "",
  classId: "",
  className: "",
  lectureCount: 1,
  status: "present",
  remarks: "",
};

const EMPTY_LECTURE = {
  month: NOW.getMonth() + 1,
  year: NOW.getFullYear(),
  lecturesCount: "",
  notes: "",
};

type AttendanceRecord = {
  id: number; instructorId: number; attendanceDate: string;
  checkInTime: string; checkOutTime?: string; shift?: string;
  className?: string; lectureCount: number; status: string; remarks?: string;
};

type MonthlyLecture = {
  id: number; month: number; year: number;
  lecturesCount: number; notes: string | null; monthName: string;
};

type Tab = "payments" | "attendance" | "lectures";

// Available years for lecture selection (current + past 5)
const YEARS = Array.from({ length: 6 }, (_, i) => NOW.getFullYear() - i);

export default function InstructorDetail() {
  const { id } = useParams<{ id: string }>();
  const instructorId = Number(id);
  const qc = useQueryClient();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<Tab>("payments");

  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [deletePayTarget, setDeletePayTarget] = useState<InstructorPayment | null>(null);
  const [payForm, setPayForm] = useState({ ...EMPTY_PAYMENT });

  const [attendDialogOpen, setAttendDialogOpen] = useState(false);
  const [deleteAttendTarget, setDeleteAttendTarget] = useState<AttendanceRecord | null>(null);
  const [attendForm, setAttendForm] = useState({ ...EMPTY_ATTENDANCE });
  const [attendLoading, setAttendLoading] = useState(false);
  const [attendList, setAttendList] = useState<AttendanceRecord[]>([]);
  const [attendLoaded, setAttendLoaded] = useState(false);
  const [instructorClasses, setInstructorClasses] = useState<{ id: number; className: string; courseName: string }[]>([]);

  // Lectures state
  const [lectureDialogOpen, setLectureDialogOpen] = useState(false);
  const [deleteLectureTarget, setDeleteLectureTarget] = useState<MonthlyLecture | null>(null);
  const [lectureForm, setLectureForm] = useState({ ...EMPTY_LECTURE });
  const [lectureViewMode, setLectureViewMode] = useState<"all" | "month">("all");
  const [lectureFilterMonth, setLectureFilterMonth] = useState(NOW.getMonth() + 1);
  const [lectureFilterYear, setLectureFilterYear] = useState(NOW.getFullYear());

  const { canDelete, canEdit } = useAuth();

  const { data: instructor, isLoading, error } = useGetInstructor(instructorId, {
    query: { enabled: !!instructorId, queryKey: getGetInstructorQueryKey(instructorId) },
  });

  // Monthly lectures from API
  const monthlyLectures: MonthlyLecture[] = (instructor as any)?.monthlyLectures ?? [];

  const createPayment = useCreateInstructorPayment();
  const deletePayment = useDeleteInstructorPayment();

  const addLecture = useMutation({
    mutationFn: (body: { month: number; year: number; lecturesCount: number; notes?: string }) =>
      apiFetch(`/instructors/${instructorId}/lectures`, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: getGetInstructorQueryKey(instructorId) });
      setLectureDialogOpen(false);
      setLectureForm({ ...EMPTY_LECTURE });
      toast({ title: "Lectures recorded" });
    },
    onError: () => toast({ title: "Error", description: "Failed to save lecture record.", variant: "destructive" }),
  });

  const deleteLecture = useMutation({
    mutationFn: (lectureId: number) =>
      apiFetch(`/instructors/${instructorId}/lectures/${lectureId}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: getGetInstructorQueryKey(instructorId) });
      setDeleteLectureTarget(null);
      toast({ title: "Record deleted" });
    },
    onError: () => toast({ title: "Error", description: "Failed to delete record.", variant: "destructive" }),
  });

  const totalPaid = instructor?.payments?.reduce((s, p) => s + p.amountPaid, 0) ?? 0;
  const paymentModel = (instructor as any)?.paymentModel ?? "salary";
  const lectureRate = (instructor as any)?.lectureRate ?? 0;
  const commissionPercent = (instructor as any)?.commissionPercent ?? 0;
  const totalEarned = (instructor as any)?.totalEarned ?? 0;
  const totalLectures = (instructor as any)?.totalLectures ?? 0;
  const pendingEarnings = (instructor as any)?.pendingEarnings ?? 0;
  const monthlySalary = (instructor as any)?.monthlySalary ?? 0;

  useEffect(() => {
    if (!instructorId) return;
    fetch(`${BASE}api/classes?instructorId=${instructorId}`)
      .then(r => r.json())
      .then(data => setInstructorClasses(data))
      .catch(() => {});
  }, [instructorId]);

  async function loadAttendance() {
    if (attendLoaded) return;
    setAttendLoading(true);
    try {
      const res = await fetch(`${BASE}api/instructor-attendance?instructorId=${instructorId}`);
      const data = await res.json();
      setAttendList(data);
      setAttendLoaded(true);
    } catch {
      toast({ title: "Error", description: "Failed to load attendance.", variant: "destructive" });
    } finally {
      setAttendLoading(false);
    }
  }

  function handleTabChange(tab: Tab) {
    setActiveTab(tab);
    if (tab === "attendance") loadAttendance();
  }

  function setPayField<K extends keyof typeof EMPTY_PAYMENT>(k: K, v: (typeof EMPTY_PAYMENT)[K]) {
    setPayForm((p) => ({ ...p, [k]: v }));
  }

  function setAttendField<K extends keyof typeof EMPTY_ATTENDANCE>(k: K, v: (typeof EMPTY_ATTENDANCE)[K]) {
    setAttendForm((p) => ({ ...p, [k]: v }));
  }

  async function handleRecordPayment() {
    if (!payForm.amountPaid || !payForm.paymentDate) {
      toast({ title: "Validation Error", description: "Amount and payment date are required.", variant: "destructive" });
      return;
    }
    try {
      await createPayment.mutateAsync({
        data: {
          instructorId,
          month: payForm.month,
          year: payForm.year,
          amountPaid: Number(payForm.amountPaid),
          paymentMethod: payForm.paymentMethod,
          paymentDate: payForm.paymentDate,
          remarks: payForm.remarks || undefined,
        },
      });
      toast({ title: "Payment recorded" });
      qc.invalidateQueries({ queryKey: getGetInstructorQueryKey(instructorId) });
      setPayDialogOpen(false);
      setPayForm({ ...EMPTY_PAYMENT });
    } catch {
      toast({ title: "Error", description: "Failed to record payment.", variant: "destructive" });
    }
  }

  async function handleDeletePayment() {
    if (!deletePayTarget) return;
    try {
      await deletePayment.mutateAsync({ id: deletePayTarget.id });
      toast({ title: "Payment deleted" });
      qc.invalidateQueries({ queryKey: getGetInstructorQueryKey(instructorId) });
      setDeletePayTarget(null);
    } catch {
      toast({ title: "Error", description: "Failed to delete payment.", variant: "destructive" });
    }
  }

  async function handleAddAttendance() {
    if (!attendForm.attendanceDate || !attendForm.checkInTime) {
      toast({ title: "Validation Error", description: "Date and check-in time are required.", variant: "destructive" });
      return;
    }
    try {
      const selectedClass = attendForm.classId
        ? instructorClasses.find(c => String(c.id) === attendForm.classId)
        : null;
      const res = await fetch(`${BASE}api/instructor-attendance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instructorId,
          attendanceDate: attendForm.attendanceDate,
          checkInTime: attendForm.checkInTime,
          checkOutTime: attendForm.checkOutTime || undefined,
          shift: attendForm.shift || undefined,
          classId: attendForm.classId ? Number(attendForm.classId) : undefined,
          className: selectedClass?.className || attendForm.className || undefined,
          lectureCount: Number(attendForm.lectureCount),
          status: attendForm.status,
          remarks: attendForm.remarks || undefined,
        }),
      });
      if (!res.ok) throw new Error();
      const record = await res.json();
      setAttendList((prev) => [record, ...prev]);
      toast({ title: "Attendance logged" });
      qc.invalidateQueries({ queryKey: getGetInstructorQueryKey(instructorId) });
      setAttendDialogOpen(false);
      setAttendForm({ ...EMPTY_ATTENDANCE });
    } catch {
      toast({ title: "Error", description: "Failed to log attendance.", variant: "destructive" });
    }
  }

  async function handleDeleteAttendance() {
    if (!deleteAttendTarget) return;
    try {
      const res = await fetch(`${BASE}api/instructor-attendance/${deleteAttendTarget.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setAttendList((prev) => prev.filter((a) => a.id !== deleteAttendTarget.id));
      toast({ title: "Record deleted" });
      qc.invalidateQueries({ queryKey: getGetInstructorQueryKey(instructorId) });
      setDeleteAttendTarget(null);
    } catch {
      toast({ title: "Error", description: "Failed to delete record.", variant: "destructive" });
    }
  }

  function handleAddLecture() {
    if (!lectureForm.lecturesCount) {
      toast({ title: "Validation Error", description: "Lecture count is required.", variant: "destructive" });
      return;
    }
    addLecture.mutate({
      month: lectureForm.month,
      year: lectureForm.year,
      lecturesCount: Number(lectureForm.lecturesCount),
      notes: lectureForm.notes || undefined,
    });
  }

  function handlePrint(p: InstructorPayment) {
    printSalarySlip({
      paymentNumber: p.paymentNumber,
      instructorName: p.instructorName,
      instructorCode: p.instructorCode,
      specialization: p.specialization,
      courseName: p.courseName,
      month: p.month,
      year: p.year,
      amountPaid: p.amountPaid,
      paymentMethod: p.paymentMethod,
      paymentDate: p.paymentDate,
      remarks: p.remarks,
    });
  }

  const MODEL_LABELS: Record<string, string> = {
    salary: "Monthly Salary",
    per_lecture: "Per Lecture",
    commission: "Commission",
  };

  // Filter monthly lectures for month-wise view
  const filteredLectures = lectureViewMode === "month"
    ? monthlyLectures.filter(l => l.month === lectureFilterMonth && l.year === lectureFilterYear)
    : monthlyLectures;

  const filteredTotal = filteredLectures.reduce((s, l) => s + l.lecturesCount, 0);
  const filteredEarnings = filteredTotal * Number(lectureRate);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/instructors">
          <Button variant="outline" size="sm" className="gap-2">
            <ArrowLeft className="w-4 h-4" /> Back to Instructors
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Instructor Detail</h1>
          <p className="text-sm text-muted-foreground mt-1">Lecture log, earnings, and payment history.</p>
        </div>
      </div>

      {error && (
        <div className="p-6 text-center text-destructive flex items-center justify-center gap-2">
          <AlertCircle className="w-4 h-4" /> Failed to load instructor.
        </div>
      )}

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : instructor && (
        <>
          {/* Profile card */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-start gap-5">
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <User className="w-7 h-7 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h2 className="text-xl font-bold truncate">{instructor.name}</h2>
                    <span className="font-mono text-sm text-primary font-semibold shrink-0">{instructor.instructorCode}</span>
                    <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border shrink-0",
                      instructor.status === "active" ? "text-green-700 bg-green-50 border-green-200" : "text-slate-500 bg-slate-50 border-slate-200")}>
                      {instructor.status}
                    </span>
                    <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border shrink-0",
                      paymentModel === "per_lecture" ? "text-purple-700 bg-purple-50 border-purple-200"
                      : paymentModel === "commission" ? "text-amber-700 bg-amber-50 border-amber-200"
                      : "text-blue-700 bg-blue-50 border-blue-200")}>
                      {MODEL_LABELS[paymentModel] ?? paymentModel}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-4 mt-2 text-sm text-muted-foreground">
                    {instructor.fatherName && <span>Father: <strong className="text-foreground">{instructor.fatherName}</strong></span>}
                    {instructor.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" /><strong className="text-foreground">{instructor.phone}</strong></span>}
                    {instructor.specialization && <span>Subject: <strong className="text-foreground">{instructor.specialization}</strong></span>}
                    {instructor.courseName && <span className="flex items-center gap-1"><BookOpen className="w-3 h-3" />Course: <strong className="text-foreground">{instructor.courseName}</strong></span>}
                    {instructor.address && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /><strong className="text-foreground">{instructor.address}</strong></span>}
                  </div>
                  <div className="mt-2 text-sm text-muted-foreground">
                    Join Date: <strong className="text-foreground">{new Date(instructor.joinDate).toLocaleDateString("en-PK")}</strong>
                    <span className="mx-3">·</span>
                    {paymentModel === "salary" && <>Monthly Salary: <strong className="text-foreground font-mono">{formatCurrency(monthlySalary)}</strong></>}
                    {paymentModel === "per_lecture" && <>Rate: <strong className="text-foreground font-mono">{formatCurrency(lectureRate)}/lecture</strong></>}
                    {paymentModel === "commission" && <>Commission: <strong className="text-foreground font-mono">{commissionPercent}% of revenue</strong></>}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {paymentModel === "per_lecture" && (
              <Card>
                <CardContent className="p-5 text-center">
                  <div className="text-2xl font-bold text-purple-600">{totalLectures}</div>
                  <div className="text-sm text-muted-foreground mt-1">Total Lectures</div>
                </CardContent>
              </Card>
            )}
            <Card>
              <CardContent className="p-5 text-center">
                <div className="text-2xl font-bold text-blue-600">{formatCurrency(totalEarned)}</div>
                <div className="text-sm text-muted-foreground mt-1">Total Earned</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5 text-center">
                <div className="text-2xl font-bold text-green-600">{formatCurrency(totalPaid)}</div>
                <div className="text-sm text-muted-foreground mt-1">Total Paid</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5 text-center">
                <div className={cn("text-2xl font-bold", pendingEarnings > 0 ? "text-red-600" : "text-muted-foreground")}>{formatCurrency(pendingEarnings)}</div>
                <div className="text-sm text-muted-foreground mt-1">Pending Earnings</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5 text-center">
                <div className="text-2xl font-bold">{instructor.payments?.length ?? 0}</div>
                <div className="text-sm text-muted-foreground mt-1">Payments Made</div>
              </CardContent>
            </Card>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-border gap-0">
            <button
              onClick={() => handleTabChange("payments")}
              className={cn("px-5 py-2.5 text-sm font-medium border-b-2 transition-colors",
                activeTab === "payments" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}
            >
              <span className="flex items-center gap-2"><TrendingUp className="w-4 h-4" /> Payment History</span>
            </button>
            <button
              onClick={() => handleTabChange("lectures")}
              className={cn("px-5 py-2.5 text-sm font-medium border-b-2 transition-colors",
                activeTab === "lectures" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}
            >
              <span className="flex items-center gap-2"><BookMarked className="w-4 h-4" /> Lectures Taken</span>
            </button>
            <button
              onClick={() => handleTabChange("attendance")}
              className={cn("px-5 py-2.5 text-sm font-medium border-b-2 transition-colors",
                activeTab === "attendance" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}
            >
              <span className="flex items-center gap-2"><ClipboardList className="w-4 h-4" /> Attendance Log</span>
            </button>
          </div>

          {/* ── Payment History Tab ── */}
          {activeTab === "payments" && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div>
                  <CardTitle>Salary Payments</CardTitle>
                  <CardDescription>All recorded payments for this instructor.</CardDescription>
                </div>
                {canEdit && (
                  <Button onClick={() => setPayDialogOpen(true)} className="gap-2">
                    <Plus className="w-4 h-4" /> Record Payment
                  </Button>
                )}
              </CardHeader>
              <CardContent className="p-0">
                {!instructor.payments?.length ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-3">
                    <p className="text-muted-foreground text-sm">No payments recorded yet.</p>
                    {canEdit && (
                      <Button variant="outline" onClick={() => setPayDialogOpen(true)} className="gap-2">
                        <Plus className="w-4 h-4" /> Record First Payment
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/30">
                          <th className="text-left px-4 py-3 font-medium text-muted-foreground">Ref #</th>
                          <th className="text-left px-4 py-3 font-medium text-muted-foreground">Period</th>
                          <th className="text-right px-4 py-3 font-medium text-muted-foreground">Amount Paid</th>
                          <th className="text-left px-4 py-3 font-medium text-muted-foreground">Method</th>
                          <th className="text-left px-4 py-3 font-medium text-muted-foreground">Payment Date</th>
                          <th className="text-left px-4 py-3 font-medium text-muted-foreground">Remarks</th>
                          <th className="text-center px-4 py-3 font-medium text-muted-foreground">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {instructor.payments.map((p) => (
                          <tr key={p.id} className="border-b border-border hover:bg-muted/20 transition-colors">
                            <td className="px-4 py-3 font-mono text-xs text-primary">{p.paymentNumber}</td>
                            <td className="px-4 py-3 font-medium">{p.monthName} {p.year}</td>
                            <td className="px-4 py-3 text-right font-mono font-semibold text-green-600">{formatCurrency(p.amountPaid)}</td>
                            <td className="px-4 py-3 capitalize text-muted-foreground">{p.paymentMethod.replace("_", " ")}</td>
                            <td className="px-4 py-3 text-muted-foreground">{new Date(p.paymentDate).toLocaleDateString("en-PK")}</td>
                            <td className="px-4 py-3 text-muted-foreground text-xs">{p.remarks ?? "—"}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-center gap-1">
                                <Button variant="ghost" size="icon" className="w-8 h-8" title="Print salary slip" onClick={() => handlePrint(p)}>
                                  <Printer className="w-4 h-4" />
                                </Button>
                                {canDelete && (
                                  <Button variant="ghost" size="icon" className="w-8 h-8 text-destructive hover:text-destructive" onClick={() => setDeletePayTarget(p)}>
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                        <tr className="bg-muted/20 font-semibold">
                          <td className="px-4 py-3" colSpan={2}>Total</td>
                          <td className="px-4 py-3 text-right font-mono text-green-600">{formatCurrency(totalPaid)}</td>
                          <td colSpan={4} className="px-4 py-3"></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* ── Lectures Taken Tab ── */}
          {activeTab === "lectures" && (
            <Card>
              <CardHeader>
                <div className="flex flex-row items-start justify-between gap-3 flex-wrap">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <BookMarked className="w-4 h-4 text-purple-500" />
                      Lectures Taken
                    </CardTitle>
                    <CardDescription>
                      {paymentModel === "per_lecture"
                        ? `${totalLectures} total lectures × ${formatCurrency(lectureRate)}/lecture = ${formatCurrency(totalEarned)} earned`
                        : "Monthly lecture records for this instructor."}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* All / Month toggle */}
                    <div className="flex rounded-md overflow-hidden border border-border">
                      <button
                        onClick={() => setLectureViewMode("all")}
                        className={cn("px-3 py-1.5 text-xs font-medium transition-colors",
                          lectureViewMode === "all" ? "bg-primary text-primary-foreground" : "hover:bg-muted")}
                      >
                        All Time
                      </button>
                      <button
                        onClick={() => setLectureViewMode("month")}
                        className={cn("px-3 py-1.5 text-xs font-medium transition-colors border-l",
                          lectureViewMode === "month" ? "bg-primary text-primary-foreground" : "hover:bg-muted")}
                      >
                        Month Wise
                      </button>
                    </div>
                    {lectureViewMode === "month" && (
                      <div className="flex gap-2">
                        <Select value={String(lectureFilterMonth)} onValueChange={(v) => setLectureFilterMonth(Number(v))}>
                          <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {MONTHS.map(m => <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Select value={String(lectureFilterYear)} onValueChange={(v) => setLectureFilterYear(Number(v))}>
                          <SelectTrigger className="w-24 h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {YEARS.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    {canEdit && (
                      <Button size="sm" onClick={() => setLectureDialogOpen(true)} className="gap-2 h-8">
                        <Plus className="w-3.5 h-3.5" /> Add Lectures
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {filteredLectures.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-3">
                    <BookMarked className="w-8 h-8 text-muted-foreground/30" />
                    <p className="text-muted-foreground text-sm">
                      {lectureViewMode === "month"
                        ? `No lectures recorded for ${MONTHS[lectureFilterMonth - 1].label} ${lectureFilterYear}.`
                        : "No lecture records yet."}
                    </p>
                    {canEdit && (
                      <Button variant="outline" size="sm" onClick={() => setLectureDialogOpen(true)} className="gap-2">
                        <Plus className="w-4 h-4" /> Add Previous Lectures
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/30">
                          <th className="text-left px-4 py-3 font-medium text-muted-foreground">Month</th>
                          <th className="text-left px-4 py-3 font-medium text-muted-foreground">Year</th>
                          <th className="text-center px-4 py-3 font-medium text-muted-foreground">Lectures</th>
                          {paymentModel === "per_lecture" && (
                            <th className="text-right px-4 py-3 font-medium text-muted-foreground">Earnings</th>
                          )}
                          <th className="text-left px-4 py-3 font-medium text-muted-foreground">Notes</th>
                          {canDelete && <th className="text-center px-4 py-3 font-medium text-muted-foreground">Actions</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredLectures.map((l) => (
                          <tr key={l.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                            <td className="px-4 py-3 font-medium">{l.monthName}</td>
                            <td className="px-4 py-3 text-muted-foreground">{l.year}</td>
                            <td className="px-4 py-3 text-center">
                              <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-purple-50 text-purple-700 font-bold text-sm border border-purple-200">
                                {l.lecturesCount}
                              </span>
                            </td>
                            {paymentModel === "per_lecture" && (
                              <td className="px-4 py-3 text-right font-mono text-green-600 font-semibold">
                                {formatCurrency(l.lecturesCount * Number(lectureRate))}
                              </td>
                            )}
                            <td className="px-4 py-3 text-muted-foreground text-xs">{l.notes ?? "—"}</td>
                            {canDelete && (
                              <td className="px-4 py-3 text-center">
                                <Button variant="ghost" size="icon" className="w-7 h-7 text-destructive hover:text-destructive" onClick={() => setDeleteLectureTarget(l)}>
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </td>
                            )}
                          </tr>
                        ))}
                        <tr className="bg-muted/20 font-semibold border-t">
                          <td className="px-4 py-3" colSpan={2}>
                            {lectureViewMode === "month"
                              ? `${MONTHS[lectureFilterMonth - 1].label} ${lectureFilterYear} Total`
                              : "All Time Total"}
                          </td>
                          <td className="px-4 py-3 text-center text-purple-700 font-bold">{filteredTotal}</td>
                          {paymentModel === "per_lecture" && (
                            <td className="px-4 py-3 text-right font-mono text-green-600 font-bold">{formatCurrency(filteredEarnings)}</td>
                          )}
                          <td colSpan={canDelete ? 2 : 1}></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* ── Attendance Log Tab ── */}
          {activeTab === "attendance" && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div>
                  <CardTitle>Attendance Log</CardTitle>
                  <CardDescription>Daily check-in records for this instructor.</CardDescription>
                </div>
                <Button onClick={() => setAttendDialogOpen(true)} className="gap-2">
                  <Plus className="w-4 h-4" /> Log Attendance
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                {attendLoading ? (
                  <div className="p-4 space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
                ) : attendList.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-3">
                    <p className="text-muted-foreground text-sm">No attendance records yet.</p>
                    <Button variant="outline" onClick={() => setAttendDialogOpen(true)} className="gap-2">
                      <Plus className="w-4 h-4" /> Log First Attendance
                    </Button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/30">
                          <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
                          <th className="text-left px-4 py-3 font-medium text-muted-foreground">Shift</th>
                          <th className="text-left px-4 py-3 font-medium text-muted-foreground">Class</th>
                          <th className="text-left px-4 py-3 font-medium text-muted-foreground">Check In</th>
                          <th className="text-left px-4 py-3 font-medium text-muted-foreground">Check Out</th>
                          <th className="text-center px-4 py-3 font-medium text-muted-foreground">Lectures</th>
                          <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                          <th className="text-center px-4 py-3 font-medium text-muted-foreground">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {attendList.map((a) => (
                          <tr key={a.id} className="border-b border-border hover:bg-muted/20 transition-colors">
                            <td className="px-4 py-3 font-medium">{new Date(a.attendanceDate).toLocaleDateString("en-PK")}</td>
                            <td className="px-4 py-3 text-muted-foreground">{a.shift ?? "—"}</td>
                            <td className="px-4 py-3 text-muted-foreground">{a.className ?? "—"}</td>
                            <td className="px-4 py-3 font-mono text-xs">{a.checkInTime}</td>
                            <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{a.checkOutTime ?? "—"}</td>
                            <td className="px-4 py-3 text-center font-semibold">{a.lectureCount}</td>
                            <td className="px-4 py-3">
                              <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border",
                                a.status === "present" ? "text-green-700 bg-green-50 border-green-200"
                                : a.status === "absent" ? "text-red-700 bg-red-50 border-red-200"
                                : "text-amber-700 bg-amber-50 border-amber-200")}>
                                {a.status}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex justify-center">
                                <Button variant="ghost" size="icon" className="w-8 h-8 text-destructive hover:text-destructive" onClick={() => setDeleteAttendTarget(a)}>
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        <tr className="bg-muted/20 font-semibold">
                          <td className="px-4 py-3" colSpan={5}>Total</td>
                          <td className="px-4 py-3 text-center">{attendList.reduce((s, a) => s + a.lectureCount, 0)}</td>
                          <td colSpan={2}></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* ── Dialogs ── */}

      {/* Record Payment */}
      <Dialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Record Payment</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="space-y-1">
              <Label>Month <span className="text-destructive">*</span></Label>
              <Select value={String(payForm.month)} onValueChange={(v) => setPayField("month", Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m) => <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Year <span className="text-destructive">*</span></Label>
              <Input type="number" min="2020" max="2099" value={payForm.year} onChange={(e) => setPayField("year", Number(e.target.value))} />
            </div>
            <div className="space-y-1">
              <Label>Amount Paid (PKR) <span className="text-destructive">*</span></Label>
              <Input type="number" min="0" value={payForm.amountPaid} onChange={(e) => setPayField("amountPaid", e.target.value)} placeholder="0" />
            </div>
            <div className="space-y-1">
              <Label>Payment Method</Label>
              <Select value={payForm.paymentMethod} onValueChange={(v) => setPayField("paymentMethod", v as CreateInstructorPaymentInputPaymentMethod)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Payment Date <span className="text-destructive">*</span></Label>
              <Input type="date" value={payForm.paymentDate} onChange={(e) => setPayField("paymentDate", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Remarks</Label>
              <Input value={payForm.remarks} onChange={(e) => setPayField("remarks", e.target.value)} placeholder="Optional" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleRecordPayment} disabled={createPayment.isPending}>
              {createPayment.isPending ? "Recording…" : "Record Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Lectures Dialog */}
      <Dialog open={lectureDialogOpen} onOpenChange={setLectureDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Lectures Taken</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Month <span className="text-destructive">*</span></Label>
                <Select value={String(lectureForm.month)} onValueChange={(v) => setLectureForm(f => ({ ...f, month: Number(v) }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MONTHS.map(m => <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Year <span className="text-destructive">*</span></Label>
                <Select value={String(lectureForm.year)} onValueChange={(v) => setLectureForm(f => ({ ...f, year: Number(v) }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {YEARS.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Lectures Count <span className="text-destructive">*</span></Label>
              <Input
                type="number" min="0" max="999"
                placeholder="e.g. 20"
                value={lectureForm.lecturesCount}
                onChange={(e) => setLectureForm(f => ({ ...f, lecturesCount: e.target.value }))}
              />
              {paymentModel === "per_lecture" && lectureForm.lecturesCount && (
                <p className="text-xs text-muted-foreground mt-1">
                  Earnings: <span className="font-semibold text-green-600">{formatCurrency(Number(lectureForm.lecturesCount) * Number(lectureRate))}</span>
                </p>
              )}
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Input placeholder="Optional note" value={lectureForm.notes} onChange={(e) => setLectureForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLectureDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAddLecture} disabled={addLecture.isPending || !lectureForm.lecturesCount}>
              {addLecture.isPending ? "Saving…" : "Save Lectures"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Log Attendance */}
      <Dialog open={attendDialogOpen} onOpenChange={setAttendDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Log Attendance</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="col-span-2 space-y-1">
              <Label>Date <span className="text-destructive">*</span></Label>
              <Input type="date" value={attendForm.attendanceDate} onChange={(e) => setAttendField("attendanceDate", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Shift</Label>
              <Select value={attendForm.shift || "none"} onValueChange={(v) => setAttendField("shift", v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {SHIFTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Class</Label>
              {instructorClasses.length > 0 ? (
                <Select value={attendForm.classId || "none"} onValueChange={(v) => {
                  if (v === "none") { setAttendField("classId", ""); setAttendField("className", ""); }
                  else { const cls = instructorClasses.find(c => String(c.id) === v); setAttendField("classId", v); setAttendField("className", cls?.className ?? ""); }
                }}>
                  <SelectTrigger><SelectValue placeholder="Select class…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— None —</SelectItem>
                    {instructorClasses.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.className}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <Input value={attendForm.className} onChange={(e) => setAttendField("className", e.target.value)} placeholder="e.g. DIT Batch 3" />
              )}
            </div>
            <div className="space-y-1">
              <Label>Check In Time <span className="text-destructive">*</span></Label>
              <Input type="time" value={attendForm.checkInTime} onChange={(e) => setAttendField("checkInTime", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Check Out Time</Label>
              <Input type="time" value={attendForm.checkOutTime} onChange={(e) => setAttendField("checkOutTime", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Lectures Delivered</Label>
              <Input type="number" min="1" max="10" value={attendForm.lectureCount} onChange={(e) => setAttendField("lectureCount", Number(e.target.value))} />
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <Select value={attendForm.status} onValueChange={(v) => setAttendField("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="present">Present</SelectItem>
                  <SelectItem value="absent">Absent</SelectItem>
                  <SelectItem value="late">Late</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Remarks</Label>
              <Input value={attendForm.remarks} onChange={(e) => setAttendField("remarks", e.target.value)} placeholder="Optional" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAttendDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAddAttendance}>Log Attendance</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete payment confirm */}
      <AlertDialog open={!!deletePayTarget} onOpenChange={(o) => !o && setDeletePayTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Payment?</AlertDialogTitle>
            <AlertDialogDescription>
              Delete payment <strong>{deletePayTarget?.paymentNumber}</strong> of {deletePayTarget ? formatCurrency(deletePayTarget.amountPaid) : ""} for {deletePayTarget?.monthName} {deletePayTarget?.year}? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePayment} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete lecture confirm */}
      <AlertDialog open={!!deleteLectureTarget} onOpenChange={(o) => !o && setDeleteLectureTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Lecture Record?</AlertDialogTitle>
            <AlertDialogDescription>
              Delete {deleteLectureTarget?.lecturesCount} lectures for <strong>{deleteLectureTarget?.monthName} {deleteLectureTarget?.year}</strong>?
              {paymentModel === "per_lecture" && deleteLectureTarget && (
                <> This will reduce earned income by <strong>{formatCurrency(deleteLectureTarget.lecturesCount * Number(lectureRate))}</strong>.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteLecture.mutate(deleteLectureTarget!.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete attendance confirm */}
      <AlertDialog open={!!deleteAttendTarget} onOpenChange={(o) => !o && setDeleteAttendTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Attendance Record?</AlertDialogTitle>
            <AlertDialogDescription>
              Delete attendance for <strong>{deleteAttendTarget?.attendanceDate}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAttendance} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
