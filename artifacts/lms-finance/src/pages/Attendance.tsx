import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";
import { PlusCircle, Clock, CheckCircle2, LogIn, LogOut, Trash2, BarChart2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useAuth } from "@/hooks/use-auth";

type Attendance = {
  id: number; instructorId: number; instructorName: string;
  classId?: number; className?: string;
  attendanceDate: string; checkInTime: string; checkOutTime?: string;
  status: string; remarks?: string;
};
type Instructor = { id: number; name: string; instructorCode: string; status?: string; };
type ClassRecord = { id: number; className: string; courseName: string; instructorId?: number; };

export default function Attendance() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { user, canDelete } = useAuth();
  const isInstructor = user?.role === "instructor";
  const myInstructorId = (user as any)?.instructorId as number | undefined;

  const [checkInOpen, setCheckInOpen] = useState(false);
  const [filterInstructor, setFilterInstructor] = useState(
    isInstructor && myInstructorId ? String(myInstructorId) : "all"
  );
  const [filterDate, setFilterDate] = useState("");
  const [form, setForm] = useState({
    instructorId: isInstructor && myInstructorId ? String(myInstructorId) : "",
    classId: "none",
    attendanceDate: new Date().toISOString().slice(0, 10),
    checkInTime: new Date().toTimeString().slice(0, 5),
    remarks: "",
  });

  const { data: attendance = [], isLoading } = useQuery<Attendance[]>({
    queryKey: ["attendance"],
    queryFn: () => apiFetch("/attendance"),
  });
  const { data: instructors = [] } = useQuery<Instructor[]>({
    queryKey: ["instructors"],
    queryFn: () => apiFetch("/instructors"),
  });
  const { data: classes = [] } = useQuery<ClassRecord[]>({
    queryKey: ["classes"],
    queryFn: () => apiFetch("/classes"),
  });

  const checkIn = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiFetch("/attendance/checkin", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance"] });
      setCheckInOpen(false);
      setForm((f) => ({ ...f, classId: "none", remarks: "", ...(!isInstructor ? { instructorId: "" } : {}) }));
      toast({ title: "Check-in recorded" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const checkOut = useMutation({
    mutationFn: ({ id, time }: { id: number; time: string }) =>
      apiFetch(`/attendance/${id}/checkout`, { method: "PUT", body: JSON.stringify({ checkOutTime: time }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance"] });
      toast({ title: "Check-out recorded" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const del = useMutation({
    mutationFn: (id: number) => apiFetch(`/attendance/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["attendance"] }); toast({ title: "Record deleted" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handleCheckIn = () => {
    checkIn.mutate({
      instructorId: Number(form.instructorId),
      classId: form.classId !== "none" ? Number(form.classId) : null,
      attendanceDate: form.attendanceDate,
      checkInTime: form.checkInTime,
      remarks: form.remarks || null,
    });
  };

  // Classes filtered for the check-in form: instructors see only their own classes
  const availableClasses = isInstructor && myInstructorId
    ? classes.filter(c => c.instructorId === myInstructorId)
    : classes;

  // Attendance records: instructors only see their own
  let displayed = isInstructor && myInstructorId
    ? attendance.filter(a => a.instructorId === myInstructorId)
    : attendance;

  if (filterInstructor !== "all") displayed = displayed.filter((a) => a.instructorId === Number(filterInstructor));
  if (filterDate) displayed = displayed.filter((a) => a.attendanceDate === filterDate);

  const allMyAttendance = isInstructor && myInstructorId
    ? attendance.filter(a => a.instructorId === myInstructorId)
    : attendance;

  const todayCount = allMyAttendance.filter((a) => a.attendanceDate === new Date().toISOString().slice(0, 10)).length;
  const presentThisMonth = allMyAttendance.filter((a) => {
    const d = new Date(a.attendanceDate);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() && a.status === "present";
  }).length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Instructor Attendance</h1>
          <p className="text-muted-foreground text-sm mt-1">Daily check-in & check-out tracking per instructor.</p>
        </div>
        <Dialog open={checkInOpen} onOpenChange={setCheckInOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><LogIn className="w-4 h-4" /> Record Check-in</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Record Check-in</DialogTitle>
              <DialogDescription>Log instructor attendance for today or any date.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <Label>Instructor *</Label>
                {isInstructor ? (
                  <Input
                    value={instructors.find(i => i.id === myInstructorId)?.name ?? ""}
                    disabled
                    className="bg-muted/40"
                  />
                ) : (
                  <Select value={form.instructorId} onValueChange={(v) => setForm((f) => ({ ...f, instructorId: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select instructor" /></SelectTrigger>
                    <SelectContent>
                      {instructors.filter((i) => i.status === "active").map((i) => (
                        <SelectItem key={i.id} value={String(i.id)}>{i.name} ({i.instructorCode})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div>
                <Label>Class (optional)</Label>
                <Select value={form.classId} onValueChange={(v) => setForm((f) => ({ ...f, classId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— No specific class —</SelectItem>
                    {availableClasses.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.className} ({c.courseName})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Date</Label>
                  <Input type="date" value={form.attendanceDate}
                    onChange={(e) => setForm((f) => ({ ...f, attendanceDate: e.target.value }))} />
                </div>
                <div>
                  <Label>Check-in Time</Label>
                  <Input type="time" value={form.checkInTime}
                    onChange={(e) => setForm((f) => ({ ...f, checkInTime: e.target.value }))} />
                </div>
              </div>
              <div>
                <Label>Remarks</Label>
                <Input placeholder="Optional notes..." value={form.remarks}
                  onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))} />
              </div>
              <Button className="w-full" disabled={checkIn.isPending || !form.instructorId} onClick={handleCheckIn}>
                {checkIn.isPending ? "Recording…" : "Record Check-in"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 flex items-center gap-4">
          <CheckCircle2 className="w-9 h-9 text-blue-600" />
          <div>
            <p className="text-xs text-blue-600 font-semibold uppercase">Today's Check-ins</p>
            <p className="text-2xl font-bold text-blue-700">{todayCount}</p>
          </div>
        </div>
        <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-xl p-4 flex items-center gap-4">
          <BarChart2 className="w-9 h-9 text-green-600" />
          <div>
            <p className="text-xs text-green-600 font-semibold uppercase">Lectures This Month</p>
            <p className="text-2xl font-bold text-green-700">{presentThisMonth}</p>
          </div>
        </div>
        <div className="bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-xl p-4 flex items-center gap-4">
          <Clock className="w-9 h-9 text-purple-600" />
          <div>
            <p className="text-xs text-purple-600 font-semibold uppercase">Total Records</p>
            <p className="text-2xl font-bold text-purple-700">{allMyAttendance.length}</p>
          </div>
        </div>
      </div>

      {/* Filters — hide instructor filter for instructor role */}
      <div className="flex flex-wrap gap-3 items-center">
        {!isInstructor && (
          <Select value={filterInstructor} onValueChange={setFilterInstructor}>
            <SelectTrigger className="w-48"><SelectValue placeholder="All Instructors" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Instructors</SelectItem>
              {instructors.map((i) => <SelectItem key={i.id} value={String(i.id)}>{i.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <Input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="w-40" />
        {filterDate && <Button variant="ghost" size="sm" onClick={() => setFilterDate("")}>Clear Date</Button>}
        <span className="ml-auto text-sm text-muted-foreground">{displayed.length} records</span>
      </div>

      {/* Table */}
      <div className="bg-card border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              {["Date", ...(!isInstructor ? ["Instructor"] : []), "Class", "Check-in", "Check-out", "Status", "Remarks", ""].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={isInstructor ? 7 : 8} className="text-center py-12 text-muted-foreground">Loading…</td></tr>
            ) : displayed.length === 0 ? (
              <tr><td colSpan={isInstructor ? 7 : 8} className="text-center py-12 text-muted-foreground">No attendance records.</td></tr>
            ) : displayed.map((a) => (
              <tr key={a.id} className="border-t hover:bg-muted/30">
                <td className="px-4 py-3 whitespace-nowrap">{a.attendanceDate}</td>
                {!isInstructor && <td className="px-4 py-3 font-medium">{a.instructorName}</td>}
                <td className="px-4 py-3 text-muted-foreground">{a.className ?? "—"}</td>
                <td className="px-4 py-3 font-mono text-green-700 dark:text-green-400">{a.checkInTime}</td>
                <td className="px-4 py-3 font-mono text-orange-600 dark:text-orange-400">
                  {a.checkOutTime ? a.checkOutTime : (
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                      onClick={() => checkOut.mutate({ id: a.id, time: new Date().toTimeString().slice(0, 5) })}>
                      <LogOut className="w-3 h-3" /> Check Out
                    </Button>
                  )}
                </td>
                <td className="px-4 py-3">
                  <Badge variant={a.status === "present" ? "default" : "secondary"} className="capitalize">
                    {a.status}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-muted-foreground text-xs">{a.remarks ?? "—"}</td>
                <td className="px-4 py-3">
                  {canDelete && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Record?</AlertDialogTitle>
                          <AlertDialogDescription>Delete check-in record for {a.instructorName} on {a.attendanceDate}?</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => del.mutate(a.id)} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
