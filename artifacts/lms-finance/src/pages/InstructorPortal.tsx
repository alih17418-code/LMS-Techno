import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiFetch } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import {
  LogIn, LogOut, BookOpen, Users, ClipboardCheck, CheckCircle2,
  Clock, BookMarked, TrendingUp, CalendarCheck, School,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL;

type AttendanceRecord = {
  id: number; instructorId: number; instructorName: string;
  classId?: number; className?: string; shift?: string;
  attendanceDate: string; checkInTime: string; checkOutTime?: string;
  lectureCount: number; status: string; remarks?: string;
};
type ClassRecord = { id: number; className: string; courseName: string; batch?: string; };
type InstructorData = {
  id: number; name: string; instructorCode: string; specialization?: string;
  paymentModel: string; lectureRate: number; monthlySalary: number;
  totalLectures: number; totalEarned: number; totalPaid: number; pendingEarnings: number;
  assignedClasses: Array<{ classId: number; className: string; courseName: string }>;
  attendance: AttendanceRecord[];
  monthlyLectures: Array<{ id: number; month: number; year: number; lecturesCount: number; monthName: string }>;
};

const TODAY = new Date().toISOString().split("T")[0];
const NOW_TIME = new Date().toTimeString().slice(0, 5);

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

export default function InstructorPortal() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const instructorId = (user as any)?.instructorId as number | undefined;

  const [checkInOpen, setCheckInOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState<string>("none");
  const [checkOutTarget, setCheckOutTarget] = useState<AttendanceRecord | null>(null);

  const { data: instructor, isLoading } = useQuery<InstructorData>({
    queryKey: ["instructor-portal", instructorId],
    queryFn: () => apiFetch(`/instructors/${instructorId}`),
    enabled: !!instructorId,
  });

  const { data: attendance = [], refetch: refetchAttendance } = useQuery<AttendanceRecord[]>({
    queryKey: ["instructor-attendance", instructorId],
    queryFn: () => apiFetch(`/attendance?instructorId=${instructorId}`),
    enabled: !!instructorId,
  });

  // Today's records
  const todayRecords = attendance.filter(a => a.attendanceDate === TODAY);
  const todayCheckedIn = todayRecords.length > 0;
  const todayCheckedOut = todayRecords.every(a => a.checkOutTime);
  const latestToday = todayRecords[0];

  // This month
  const now = new Date();
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();
  const monthRecords = attendance.filter(a => {
    const d = new Date(a.attendanceDate);
    return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
  });
  const monthLectures = monthRecords.reduce((s, a) => s + (a.lectureCount ?? 1), 0);

  // Monthly lectures from log
  const monthLogLectures = instructor?.monthlyLectures?.find(
    l => l.month === thisMonth + 1 && l.year === thisYear
  )?.lecturesCount ?? 0;
  const totalMonthLectures = monthLectures + monthLogLectures;

  // Class-wise lecture breakdown from attendance
  const classBreakdown = (instructor?.assignedClasses ?? []).map(cls => {
    const records = attendance.filter(a => a.classId === cls.classId);
    const lectures = records.reduce((s, a) => s + (a.lectureCount ?? 1), 0);
    const earnings = lectures * (instructor?.lectureRate ?? 0);
    return { ...cls, lectures, earnings, daysPresent: records.filter(a => a.status === "present").length };
  });

  const checkIn = useMutation({
    mutationFn: () => apiFetch("/attendance/checkin", {
      method: "POST",
      body: JSON.stringify({
        instructorId,
        classId: selectedClass !== "none" ? Number(selectedClass) : null,
        attendanceDate: TODAY,
        checkInTime: NOW_TIME,
      }),
    }),
    onSuccess: () => {
      refetchAttendance();
      setCheckInOpen(false);
      setSelectedClass("none");
      toast({ title: "✅ Check-in recorded", description: `Checked in at ${NOW_TIME}` });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const checkOut = useMutation({
    mutationFn: (id: number) => apiFetch(`/attendance/${id}/checkout`, {
      method: "PUT",
      body: JSON.stringify({ checkOutTime: new Date().toTimeString().slice(0, 5) }),
    }),
    onSuccess: () => {
      refetchAttendance();
      toast({ title: "✅ Checked out", description: `Checked out at ${new Date().toTimeString().slice(0, 5)}` });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (!instructorId) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <School className="w-12 h-12 text-muted-foreground/30" />
        <p className="text-muted-foreground">Instructor profile not linked to your account.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Instructor Portal</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {isLoading ? "Loading…" : instructor ? `Welcome, ${instructor.name} · ${instructor.instructorCode}` : ""}
        </p>
      </div>

      {/* Check-in / Check-out card */}
      <Card className="border-2 border-primary/20 bg-primary/5">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="flex-1">
              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-1">Today — {new Date().toLocaleDateString("en-PK", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
              {!todayCheckedIn ? (
                <p className="text-lg font-medium text-muted-foreground">You haven't checked in yet.</p>
              ) : (
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <span className="flex items-center gap-1.5 text-green-700 font-semibold">
                    <LogIn className="w-4 h-4" /> Checked in: <span className="font-mono">{latestToday?.checkInTime}</span>
                  </span>
                  {latestToday?.checkOutTime ? (
                    <span className="flex items-center gap-1.5 text-orange-600 font-semibold">
                      <LogOut className="w-4 h-4" /> Checked out: <span className="font-mono">{latestToday?.checkOutTime}</span>
                    </span>
                  ) : (
                    <span className="text-amber-600">Not yet checked out</span>
                  )}
                  {latestToday?.className && <span className="text-muted-foreground">· Class: <strong className="text-foreground">{latestToday?.className}</strong></span>}
                </div>
              )}
            </div>
            <div className="flex gap-3 shrink-0">
              {!todayCheckedIn ? (
                checkInOpen ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    <Select value={selectedClass} onValueChange={setSelectedClass}>
                      <SelectTrigger className="w-44 h-9 text-sm"><SelectValue placeholder="Select class…" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— No specific class —</SelectItem>
                        {(instructor?.assignedClasses ?? []).map(c => (
                          <SelectItem key={c.classId} value={String(c.classId)}>{c.className}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button onClick={() => checkIn.mutate()} disabled={checkIn.isPending} className="gap-2 bg-green-600 hover:bg-green-700 h-9">
                      <LogIn className="w-4 h-4" /> {checkIn.isPending ? "Recording…" : "Confirm Check-in"}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setCheckInOpen(false)}>Cancel</Button>
                  </div>
                ) : (
                  <Button onClick={() => setCheckInOpen(true)} size="lg" className="gap-2 bg-green-600 hover:bg-green-700 text-white px-8">
                    <LogIn className="w-5 h-5" /> Check In
                  </Button>
                )
              ) : latestToday && !latestToday.checkOutTime ? (
                <Button
                  onClick={() => checkOut.mutate(latestToday.id)}
                  disabled={checkOut.isPending}
                  size="lg"
                  variant="outline"
                  className="gap-2 border-orange-300 text-orange-700 hover:bg-orange-50 px-8"
                >
                  <LogOut className="w-5 h-5" /> {checkOut.isPending ? "Recording…" : "Check Out"}
                </Button>
              ) : (
                <div className="flex items-center gap-2 text-green-600 font-medium">
                  <CheckCircle2 className="w-5 h-5" /> Day complete
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-5 text-center">
            <div className="text-2xl font-bold text-blue-600">{instructor?.totalLectures ?? 0}</div>
            <div className="text-xs text-muted-foreground mt-1 font-medium uppercase tracking-wide">Total Lectures</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 text-center">
            <div className="text-2xl font-bold text-purple-600">{totalMonthLectures}</div>
            <div className="text-xs text-muted-foreground mt-1 font-medium uppercase tracking-wide">{MONTHS[thisMonth]} Lectures</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 text-center">
            <div className="text-2xl font-bold text-green-600">{formatCurrency(instructor?.totalEarned ?? 0)}</div>
            <div className="text-xs text-muted-foreground mt-1 font-medium uppercase tracking-wide">Total Earned</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 text-center">
            <div className="text-2xl font-bold text-red-500">{formatCurrency(instructor?.pendingEarnings ?? 0)}</div>
            <div className="text-xs text-muted-foreground mt-1 font-medium uppercase tracking-wide">Pending</div>
          </CardContent>
        </Card>
      </div>

      {/* Class-wise earnings */}
      {classBreakdown.length > 0 && instructor?.paymentModel === "per_lecture" && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <School className="w-4 h-4 text-primary" /> Class-wise Earnings
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Class</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Course</th>
                    <th className="text-center px-4 py-2.5 font-medium text-muted-foreground">Days</th>
                    <th className="text-center px-4 py-2.5 font-medium text-muted-foreground">Lectures</th>
                    <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Earnings</th>
                  </tr>
                </thead>
                <tbody>
                  {classBreakdown.map(cls => (
                    <tr key={cls.classId} className="border-b last:border-0 hover:bg-muted/10">
                      <td className="px-4 py-3 font-medium">{cls.className}</td>
                      <td className="px-4 py-3 text-muted-foreground">{cls.courseName}</td>
                      <td className="px-4 py-3 text-center">{cls.daysPresent}</td>
                      <td className="px-4 py-3 text-center font-semibold text-purple-600">{cls.lectures}</td>
                      <td className="px-4 py-3 text-right font-mono text-green-600 font-semibold">{formatCurrency(cls.earnings)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* My Classes */}
      {(instructor?.assignedClasses?.length ?? 0) > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <BookOpen className="w-4 h-4 text-primary" /> My Classes
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {instructor!.assignedClasses.map(cls => (
                <div key={cls.classId} className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium">{cls.className}</p>
                    <p className="text-xs text-muted-foreground">{cls.courseName}</p>
                  </div>
                  <Link href="/student-attendance">
                    <Button size="sm" variant="outline" className="gap-1.5 text-xs">
                      <ClipboardCheck className="w-3.5 h-3.5" /> Mark Attendance
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent attendance */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarCheck className="w-4 h-4 text-primary" /> Recent Attendance
          </CardTitle>
          <Link href="/attendance">
            <Button size="sm" variant="ghost" className="text-xs text-muted-foreground">View All →</Button>
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          {attendance.length === 0 ? (
            <p className="text-center py-8 text-sm text-muted-foreground">No attendance records yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Date</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Class</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Check-in</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Check-out</th>
                    <th className="text-center px-4 py-2.5 font-medium text-muted-foreground">Lectures</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {attendance.slice(0, 15).map(a => (
                    <tr key={a.id} className="border-b last:border-0 hover:bg-muted/10">
                      <td className="px-4 py-3 whitespace-nowrap font-medium">{a.attendanceDate}</td>
                      <td className="px-4 py-3 text-muted-foreground">{a.className ?? "—"}</td>
                      <td className="px-4 py-3 font-mono text-green-700">{a.checkInTime}</td>
                      <td className="px-4 py-3 font-mono text-orange-600">{a.checkOutTime ?? "—"}</td>
                      <td className="px-4 py-3 text-center font-semibold">{a.lectureCount}</td>
                      <td className="px-4 py-3">
                        <Badge variant={a.status === "present" ? "default" : "secondary"} className="capitalize text-xs">
                          {a.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
