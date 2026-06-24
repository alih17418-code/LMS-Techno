import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, XCircle, Clock, Save, Users, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

type ClassRecord = { id: number; className: string; courseName: string; instructorId?: number };
type Student = { id: number; name: string; studentCode: string; classId?: number; status: string };
type AttendanceRecord = { studentId: number; status: string };

const STATUS_OPTIONS = [
  { value: "present", label: "Present", icon: CheckCircle2, color: "text-green-600 bg-green-50 border-green-200" },
  { value: "absent", label: "Absent", icon: XCircle, color: "text-red-600 bg-red-50 border-red-200" },
  { value: "late", label: "Late", icon: Clock, color: "text-orange-600 bg-orange-50 border-orange-200" },
];

export default function StudentAttendance() {
  const { user, isInstructor, isAdmin, canEdit } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [selectedClass, setSelectedClass] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [attendanceMap, setAttendanceMap] = useState<Record<number, string>>({});
  const [saved, setSaved] = useState(false);

  const { data: classes = [] } = useQuery<ClassRecord[]>({
    queryKey: ["classes"],
    queryFn: () => apiFetch("/classes"),
  });

  const { data: students = [] } = useQuery<Student[]>({
    queryKey: ["students", selectedClass],
    queryFn: () => apiFetch(`/students${selectedClass ? `?classId=${selectedClass}` : ""}`),
    enabled: !!selectedClass,
  });

  const classStudents = students.filter(s => s.classId === Number(selectedClass) && s.status === "active");

  const { data: existingAttendance = [] } = useQuery<AttendanceRecord[]>({
    queryKey: ["student-attendance", selectedClass, selectedDate],
    queryFn: () => apiFetch(`/student-attendance?classId=${selectedClass}&date=${selectedDate}`),
    enabled: !!selectedClass,
    onSuccess: (data) => {
      const map: Record<number, string> = {};
      data.forEach(r => { map[r.studentId] = r.status; });
      setAttendanceMap(map);
      setSaved(false);
    },
  } as any);

  const saveMutation = useMutation({
    mutationFn: () => apiFetch("/student-attendance/bulk", {
      method: "POST",
      body: JSON.stringify({
        classId: Number(selectedClass),
        attendanceDate: selectedDate,
        records: classStudents.map(s => ({
          studentId: s.id,
          status: attendanceMap[s.id] ?? "present",
        })),
      }),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["student-attendance"] });
      setSaved(true);
      toast({ title: "Attendance saved", description: `${classStudents.length} students recorded for ${selectedDate}` });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  function markAll(status: string) {
    const map: Record<number, string> = {};
    classStudents.forEach(s => { map[s.id] = status; });
    setAttendanceMap(map);
    setSaved(false);
  }

  const presentCount = classStudents.filter(s => (attendanceMap[s.id] ?? "present") === "present").length;
  const absentCount = classStudents.filter(s => attendanceMap[s.id] === "absent").length;
  const lateCount = classStudents.filter(s => attendanceMap[s.id] === "late").length;

  const selectedClassRecord = classes.find(c => c.id === Number(selectedClass));

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Student Attendance</h1>
          <p className="text-muted-foreground text-sm mt-1">Mark daily attendance by class.</p>
        </div>
      </div>

      {/* Controls */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">Class</label>
              <Select value={selectedClass} onValueChange={(v) => { setSelectedClass(v); setAttendanceMap({}); setSaved(false); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a class…" />
                </SelectTrigger>
                <SelectContent>
                  {classes.map(c => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.className} — {c.courseName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">Date</label>
              <Input type="date" value={selectedDate} onChange={e => { setSelectedDate(e.target.value); setSaved(false); }} />
            </div>
            <div className="flex flex-col justify-end">
              {selectedClass && classStudents.length > 0 && (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => markAll("present")}>All Present</Button>
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => markAll("absent")}>All Absent</Button>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats bar */}
      {selectedClass && classStudents.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
            <div>
              <p className="text-xs text-green-700 font-semibold uppercase">Present</p>
              <p className="text-2xl font-bold text-green-800">{presentCount}</p>
            </div>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
            <XCircle className="w-8 h-8 text-red-600" />
            <div>
              <p className="text-xs text-red-700 font-semibold uppercase">Absent</p>
              <p className="text-2xl font-bold text-red-800">{absentCount}</p>
            </div>
          </div>
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-center gap-3">
            <Clock className="w-8 h-8 text-orange-600" />
            <div>
              <p className="text-xs text-orange-700 font-semibold uppercase">Late</p>
              <p className="text-2xl font-bold text-orange-800">{lateCount}</p>
            </div>
          </div>
        </div>
      )}

      {/* Student list */}
      {!selectedClass ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <Calendar className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p>Select a class to mark attendance.</p>
          </CardContent>
        </Card>
      ) : classStudents.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <Users className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p>No active students found in this class.</p>
            <p className="text-xs mt-1">Make sure students are assigned to this class.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">
                {selectedClassRecord?.className} — {selectedDate}
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-0.5">{classStudents.length} students</p>
            </div>
            {canEdit && (
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending || classStudents.length === 0}
                className="gap-2"
              >
                <Save className="w-4 h-4" />
                {saveMutation.isPending ? "Saving…" : saved ? "Saved ✓" : "Save Attendance"}
              </Button>
            )}
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {classStudents.map((student, idx) => {
                const currentStatus = attendanceMap[student.id] ?? "present";
                return (
                  <div key={student.id} className="flex items-center justify-between py-3 gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                        {idx + 1}
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-sm truncate">{student.name}</div>
                        <div className="text-xs text-muted-foreground font-mono">{student.studentCode}</div>
                      </div>
                    </div>
                    {canEdit ? (
                      <div className="flex gap-1 shrink-0">
                        {STATUS_OPTIONS.map(opt => (
                          <button
                            key={opt.value}
                            onClick={() => {
                              setAttendanceMap(m => ({ ...m, [student.id]: opt.value }));
                              setSaved(false);
                            }}
                            className={cn(
                              "px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all",
                              currentStatus === opt.value
                                ? opt.color + " ring-1 ring-current"
                                : "text-muted-foreground bg-muted/30 border-border hover:bg-muted"
                            )}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <Badge variant={currentStatus === "present" ? "default" : currentStatus === "absent" ? "destructive" : "secondary"}>
                        {currentStatus}
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
