import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import { LogIn, LogOut, Clock, ClipboardList, Briefcase, CheckSquare, Timer, AlertCircle, CalendarDays, FileText } from "lucide-react";

type AuthUser = { id: number; username: string; role: string; displayName: string; interneeId?: number };
type Internee = {
  id: number; interneeCode: string; name: string; department: string | null; position: string | null;
  attendanceMode: string; requiredHours: string; fixedStartTime: string | null; fixedEndTime: string | null;
  startDate: string; endDate: string | null; status: string;
};
type AttendanceRecord = {
  id: number; attendanceDate: string; checkInTime: string | null; checkOutTime: string | null;
  totalHours: string | null; dailyReportSubmitted: boolean; status: string;
};
type DailyReport = { id: number; reportDate: string; tasksCompleted: string; workSummary: string; problemsFaced: string | null; learnings: string | null; hoursWorked: string | null; status: string };
type Task = { id: number; title: string; description: string | null; priority: string; assignedDate: string; dueDate: string | null; status: string; comments: string | null };
type Project = { id: number; name: string; description: string | null; startDate: string; deadline: string | null; status: string; assignedBy: string | null };

function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function parseTimeToSeconds(t: string): number {
  const m = t.match(/(\d+):(\d+):(\d+)\s*(AM|PM)/i);
  if (!m) return 0;
  let h = Number(m[1]); const min = Number(m[2]); const sec = Number(m[3]);
  if (m[4].toUpperCase() === "PM" && h !== 12) h += 12;
  if (m[4].toUpperCase() === "AM" && h === 12) h = 0;
  return h * 3600 + min * 60 + sec;
}

const TABS = ["dashboard", "attendance", "daily-reports", "tasks", "projects"] as const;
type Tab = (typeof TABS)[number];

export default function InterneePortal() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("dashboard");
  const [elapsed, setElapsed] = useState(0);
  const [reportForm, setReportForm] = useState({ tasksCompleted: "", workSummary: "", problemsFaced: "", learnings: "", hoursWorked: "" });
  const [showReportForm, setShowReportForm] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: user } = useQuery<AuthUser>({ queryKey: ["auth-me"] });
  const interneeId = user?.interneeId;

  const { data: internee } = useQuery<Internee>({
    queryKey: ["internee", interneeId],
    queryFn: () => apiFetch(`/internees/${interneeId}`),
    enabled: !!interneeId,
  });

  const { data: attendance = [] } = useQuery<AttendanceRecord[]>({
    queryKey: ["internee-attendance", interneeId],
    queryFn: () => apiFetch(`/internees/${interneeId}/attendance`),
    enabled: !!interneeId,
    refetchInterval: 30000,
  });

  const { data: reports = [] } = useQuery<DailyReport[]>({
    queryKey: ["internee-daily-reports", interneeId],
    queryFn: () => apiFetch(`/internees/${interneeId}/daily-reports`),
    enabled: !!interneeId,
  });

  const { data: tasks = [] } = useQuery<Task[]>({
    queryKey: ["internee-tasks", interneeId],
    queryFn: () => apiFetch(`/internees/${interneeId}/tasks`),
    enabled: !!interneeId,
  });

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["internee-projects", interneeId],
    queryFn: () => apiFetch(`/internees/${interneeId}/projects`),
    enabled: !!interneeId,
  });

  const today = new Date().toISOString().slice(0, 10);
  const todayRecord = attendance.find(a => a.attendanceDate === today);
  const isCheckedIn = !!todayRecord?.checkInTime && !todayRecord?.checkOutTime;
  const todayReport = reports.find(r => r.reportDate === today);

  useEffect(() => {
    if (isCheckedIn && todayRecord?.checkInTime) {
      const inSec = parseTimeToSeconds(todayRecord.checkInTime);
      const nowSec = Math.floor(Date.now() / 1000) % 86400;
      const diff = Math.max(0, nowSec - inSec);
      setElapsed(diff);
      timerRef.current = setInterval(() => setElapsed(p => p + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isCheckedIn, todayRecord?.checkInTime]);

  const checkinMutation = useMutation({
    mutationFn: () => apiFetch(`/internees/${interneeId}/checkin`, { method: "POST" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["internee-attendance"] }); toast({ title: "Checked in successfully!" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const checkoutMutation = useMutation({
    mutationFn: () => apiFetch(`/internees/${interneeId}/checkout`, { method: "POST" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["internee-attendance"] }); toast({ title: "Checked out successfully!" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const submitReportMutation = useMutation({
    mutationFn: (data: object) => apiFetch(`/internees/${interneeId}/daily-reports`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["internee-daily-reports"] });
      toast({ title: "Daily report submitted!" });
      setShowReportForm(false);
      setReportForm({ tasksCompleted: "", workSummary: "", problemsFaced: "", learnings: "", hoursWorked: "" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => apiFetch(`/tasks/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["internee-tasks"] }); toast({ title: "Task updated" }); },
  });

  const requiredSec = Number(internee?.requiredHours ?? 5) * 3600;
  const progressPct = Math.min(100, Math.round((elapsed / requiredSec) * 100));

  const totalDays = attendance.filter(a => a.status === "present").length;
  const totalHours = attendance.reduce((s, a) => s + Number(a.totalHours ?? 0), 0);

  const priorityColor = (p: string) =>
    p === "urgent" ? "bg-red-100 text-red-700 border-red-200" :
    p === "high" ? "bg-orange-100 text-orange-700 border-orange-200" :
    p === "medium" ? "bg-yellow-100 text-yellow-700 border-yellow-200" :
    "bg-gray-100 text-gray-600 border-gray-200";

  const statusBadge = (s: string) =>
    s === "completed" ? "bg-green-100 text-green-700" :
    s === "in_progress" ? "bg-blue-100 text-blue-700" :
    s === "cancelled" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600";

  if (!interneeId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <AlertCircle className="w-10 h-10 text-destructive" />
        <p className="font-medium">No internee profile linked to your account.</p>
        <p className="text-sm text-muted-foreground">Please contact admin to link your internee profile.</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Internee Portal</h1>
          <p className="text-muted-foreground text-sm">Welcome, {internee?.name ?? user?.displayName} · {internee?.interneeCode}</p>
        </div>
        <div className="flex gap-2 text-sm text-muted-foreground">
          <span className="bg-muted px-3 py-1 rounded-full">{internee?.department ?? "—"}</span>
          <span className="bg-muted px-3 py-1 rounded-full">{internee?.position ?? "—"}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border gap-0 overflow-x-auto">
        {[
          { id: "dashboard", label: "Dashboard", icon: <Timer className="w-4 h-4" /> },
          { id: "attendance", label: "Attendance", icon: <CalendarDays className="w-4 h-4" /> },
          { id: "daily-reports", label: "Daily Reports", icon: <FileText className="w-4 h-4" /> },
          { id: "tasks", label: "Tasks", icon: <CheckSquare className="w-4 h-4" /> },
          { id: "projects", label: "Projects", icon: <Briefcase className="w-4 h-4" /> },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as Tab)}
            className={cn("px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-2",
              tab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* Dashboard Tab */}
      {tab === "dashboard" && (
        <div className="space-y-6">
          {/* Check In / Out Card */}
          <Card className={cn("border-2", isCheckedIn ? "border-green-300 bg-green-50/30" : todayRecord?.checkOutTime ? "border-blue-300 bg-blue-50/30" : "border-border")}>
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row md:items-center gap-6">
                <div className="flex-1 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className={cn("w-3 h-3 rounded-full", isCheckedIn ? "bg-green-500 animate-pulse" : todayRecord?.checkOutTime ? "bg-blue-500" : "bg-muted-foreground")} />
                    <span className="font-semibold text-lg">
                      {isCheckedIn ? "Currently Working" : todayRecord?.checkOutTime ? "Checked Out" : "Not Checked In"}
                    </span>
                  </div>
                  {todayRecord?.checkInTime && (
                    <div className="text-sm text-muted-foreground">
                      <span>Check In: <strong className="text-foreground">{todayRecord.checkInTime}</strong></span>
                      {todayRecord.checkOutTime && <span className="ml-4">Check Out: <strong className="text-foreground">{todayRecord.checkOutTime}</strong></span>}
                    </div>
                  )}
                  {isCheckedIn && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <Clock className="w-5 h-5 text-green-600" />
                        <span className="font-mono text-2xl font-bold text-green-700">{formatDuration(elapsed)}</span>
                      </div>
                      {internee?.attendanceMode === "hourly" && (
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Progress</span>
                            <span>{progressPct}% of {internee.requiredHours}h required</span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-2">
                            <div className={cn("h-2 rounded-full transition-all", progressPct >= 100 ? "bg-green-500" : "bg-primary")} style={{ width: `${progressPct}%` }} />
                          </div>
                        </div>
                      )}
                      {internee?.attendanceMode === "fixed" && internee.fixedStartTime && (
                        <p className="text-xs text-muted-foreground">Scheduled: {internee.fixedStartTime} – {internee.fixedEndTime}</p>
                      )}
                    </div>
                  )}
                  {todayRecord?.checkOutTime && (
                    <p className="text-sm text-muted-foreground">Total worked: <strong>{Number(todayRecord.totalHours ?? 0).toFixed(2)} hours</strong></p>
                  )}
                </div>
                <div className="flex flex-col gap-3 min-w-[180px]">
                  {!todayRecord && (
                    <Button size="lg" className="gap-2" onClick={() => checkinMutation.mutate()} disabled={checkinMutation.isPending}>
                      <LogIn className="w-5 h-5" /> Check In
                    </Button>
                  )}
                  {isCheckedIn && (
                    <>
                      {!todayReport && (
                        <Button variant="outline" className="gap-2" onClick={() => { setTab("daily-reports"); setShowReportForm(true); }}>
                          <FileText className="w-4 h-4" /> Submit Report First
                        </Button>
                      )}
                      <Button size="lg" variant="destructive" className="gap-2" onClick={() => checkoutMutation.mutate()}
                        disabled={checkoutMutation.isPending || !todayReport}>
                        <LogOut className="w-5 h-5" /> Check Out
                      </Button>
                      {!todayReport && <p className="text-xs text-destructive text-center">Submit today's daily report to enable checkout</p>}
                    </>
                  )}
                  {todayRecord?.checkOutTime && (
                    <div className="text-center text-sm text-muted-foreground p-3 bg-muted rounded-lg">Attendance complete for today</div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card><CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">{totalDays}</div>
              <div className="text-xs text-muted-foreground mt-1">Days Present</div>
            </CardContent></Card>
            <Card><CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-green-600">{totalHours.toFixed(1)}</div>
              <div className="text-xs text-muted-foreground mt-1">Hours Worked</div>
            </CardContent></Card>
            <Card><CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-purple-600">{tasks.filter(t => t.status !== "completed" && t.status !== "cancelled").length}</div>
              <div className="text-xs text-muted-foreground mt-1">Pending Tasks</div>
            </CardContent></Card>
            <Card><CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-orange-600">{projects.filter(p => p.status === "active").length}</div>
              <div className="text-xs text-muted-foreground mt-1">Active Projects</div>
            </CardContent></Card>
          </div>

          {/* Recent Tasks */}
          {tasks.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><CheckSquare className="w-4 h-4" />Recent Tasks</CardTitle></CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {tasks.slice(0, 5).map(t => (
                    <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                      <span className={cn("text-xs px-2 py-0.5 rounded border font-medium", priorityColor(t.priority))}>{t.priority}</span>
                      <span className="flex-1 text-sm font-medium">{t.title}</span>
                      <span className={cn("text-xs px-2 py-0.5 rounded font-medium", statusBadge(t.status))}>{t.status.replace("_", " ")}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Attendance Tab */}
      {tab === "attendance" && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><CalendarDays className="w-4 h-4" />Attendance History</CardTitle>
            <CardDescription>Your check-in/check-out records</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {attendance.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <CalendarDays className="w-8 h-8 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">No attendance records yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b bg-muted/30">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Check In</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Check Out</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground">Hours</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground">Report</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground">Status</th>
                  </tr></thead>
                  <tbody>
                    {attendance.map(a => (
                      <tr key={a.id} className="border-b last:border-0 hover:bg-muted/20">
                        <td className="px-4 py-3 font-medium">{new Date(a.attendanceDate).toLocaleDateString("en-PK")}</td>
                        <td className="px-4 py-3 font-mono text-xs">{a.checkInTime ?? "—"}</td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{a.checkOutTime ?? "—"}</td>
                        <td className="px-4 py-3 text-center font-semibold">{a.totalHours ? Number(a.totalHours).toFixed(2) : "—"}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={cn("text-xs px-2 py-0.5 rounded font-medium", a.dailyReportSubmitted ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700")}>
                            {a.dailyReportSubmitted ? "Submitted" : "Pending"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={cn("text-xs px-2 py-0.5 rounded border font-medium",
                            a.status === "present" ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200")}>
                            {a.status}
                          </span>
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

      {/* Daily Reports Tab */}
      {tab === "daily-reports" && (
        <div className="space-y-4">
          {showReportForm ? (
            <Card>
              <CardHeader><CardTitle>Submit Daily Report — {new Date().toLocaleDateString("en-PK", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1">
                  <Label>Tasks Completed <span className="text-destructive">*</span></Label>
                  <Textarea rows={3} placeholder="List the tasks you completed today..." value={reportForm.tasksCompleted}
                    onChange={e => setReportForm(p => ({ ...p, tasksCompleted: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label>Work Summary <span className="text-destructive">*</span></Label>
                  <Textarea rows={3} placeholder="Brief summary of your work today..." value={reportForm.workSummary}
                    onChange={e => setReportForm(p => ({ ...p, workSummary: e.target.value }))} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label>Problems Faced</Label>
                    <Textarea rows={2} placeholder="Any obstacles or issues..." value={reportForm.problemsFaced}
                      onChange={e => setReportForm(p => ({ ...p, problemsFaced: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label>Learnings</Label>
                    <Textarea rows={2} placeholder="What did you learn today..." value={reportForm.learnings}
                      onChange={e => setReportForm(p => ({ ...p, learnings: e.target.value }))} />
                  </div>
                </div>
                <div className="space-y-1 max-w-xs">
                  <Label>Hours Worked</Label>
                  <Input type="number" step="0.5" min="0" max="24" placeholder="e.g. 5.5" value={reportForm.hoursWorked}
                    onChange={e => setReportForm(p => ({ ...p, hoursWorked: e.target.value }))} />
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => submitReportMutation.mutate({ reportDate: today, ...reportForm })} disabled={submitReportMutation.isPending || !reportForm.tasksCompleted || !reportForm.workSummary}>
                    Submit Report
                  </Button>
                  <Button variant="outline" onClick={() => setShowReportForm(false)}>Cancel</Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="flex justify-between items-center">
              <h2 className="font-semibold text-lg">Daily Reports</h2>
              {!todayReport && todayRecord && (
                <Button onClick={() => setShowReportForm(true)} className="gap-2"><FileText className="w-4 h-4" />Submit Today's Report</Button>
              )}
            </div>
          )}
          <Card>
            <CardContent className="p-0">
              {reports.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2">
                  <FileText className="w-8 h-8 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">No daily reports submitted yet.</p>
                </div>
              ) : (
                <div className="divide-y">
                  {reports.map(r => (
                    <div key={r.id} className="p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{new Date(r.reportDate).toLocaleDateString("en-PK", { weekday: "long", year: "numeric", month: "short", day: "numeric" })}</span>
                        <div className="flex items-center gap-2">
                          {r.hoursWorked && <span className="text-xs text-muted-foreground">{r.hoursWorked}h worked</span>}
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">Submitted</Badge>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground"><strong>Tasks:</strong> {r.tasksCompleted}</p>
                      <p className="text-sm text-muted-foreground"><strong>Summary:</strong> {r.workSummary}</p>
                      {r.problemsFaced && <p className="text-sm text-muted-foreground"><strong>Problems:</strong> {r.problemsFaced}</p>}
                      {r.learnings && <p className="text-sm text-muted-foreground"><strong>Learnings:</strong> {r.learnings}</p>}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tasks Tab */}
      {tab === "tasks" && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><CheckSquare className="w-4 h-4" />My Tasks</CardTitle>
            <CardDescription>{tasks.filter(t => t.status !== "completed").length} pending · {tasks.filter(t => t.status === "completed").length} completed</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {tasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <CheckSquare className="w-8 h-8 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">No tasks assigned yet.</p>
              </div>
            ) : (
              <div className="divide-y">
                {tasks.map(t => (
                  <div key={t.id} className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">{t.title}</span>
                          <span className={cn("text-xs px-2 py-0.5 rounded border font-medium", priorityColor(t.priority))}>{t.priority}</span>
                        </div>
                        {t.description && <p className="text-sm text-muted-foreground mt-1">{t.description}</p>}
                        {t.dueDate && <p className="text-xs text-muted-foreground mt-1">Due: {new Date(t.dueDate).toLocaleDateString("en-PK")}</p>}
                        {t.comments && <p className="text-xs text-muted-foreground mt-1 italic">"{t.comments}"</p>}
                      </div>
                      <div className="flex flex-col gap-1 min-w-[120px]">
                        <select value={t.status} onChange={e => updateTaskMutation.mutate({ id: t.id, status: e.target.value })}
                          className="text-xs border border-border rounded px-2 py-1 bg-background text-foreground cursor-pointer">
                          <option value="todo">To Do</option>
                          <option value="in_progress">In Progress</option>
                          <option value="completed">Completed</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Projects Tab */}
      {tab === "projects" && (
        <div className="space-y-4">
          {projects.length === 0 ? (
            <Card><CardContent className="flex flex-col items-center justify-center py-12 gap-2">
              <Briefcase className="w-8 h-8 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">No projects assigned yet.</p>
            </CardContent></Card>
          ) : projects.map(p => (
            <Card key={p.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{p.name}</CardTitle>
                    {p.description && <CardDescription className="mt-1">{p.description}</CardDescription>}
                  </div>
                  <span className={cn("text-xs px-2 py-1 rounded font-medium border",
                    p.status === "completed" ? "bg-green-50 text-green-700 border-green-200" :
                    p.status === "active" ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-muted text-muted-foreground border-border")}>
                    {p.status}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                  <span>Start: <strong className="text-foreground">{new Date(p.startDate).toLocaleDateString("en-PK")}</strong></span>
                  {p.deadline && <span>Deadline: <strong className="text-foreground">{new Date(p.deadline).toLocaleDateString("en-PK")}</strong></span>}
                  {p.assignedBy && <span>Assigned by: <strong className="text-foreground">{p.assignedBy}</strong></span>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
