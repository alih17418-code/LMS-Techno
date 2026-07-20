import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import { ArrowLeft, CalendarDays, FileText, CheckSquare, Briefcase, Printer, Plus, Trash2, QrCode } from "lucide-react";
import { printInterneeIDCard, printExperienceCertificate } from "@/lib/printInternee";

type Internee = {
  id: number; interneeCode: string; name: string; fatherName: string | null; email: string | null;
  phone: string | null; department: string | null; position: string | null;
  startDate: string; endDate: string | null; status: string;
  attendanceMode: string; requiredHours: string; notes: string | null;
};
type AttendanceRecord = { id: number; attendanceDate: string; checkInTime: string | null; checkOutTime: string | null; totalHours: string | null; dailyReportSubmitted: boolean; status: string };
type DailyReport = { id: number; reportDate: string; tasksCompleted: string; workSummary: string; problemsFaced: string | null; learnings: string | null; hoursWorked: string | null; status: string };
type Task = { id: number; title: string; description: string | null; priority: string; assignedDate: string; dueDate: string | null; status: string; comments: string | null };
type Project = { id: number; name: string; description: string | null; startDate: string; deadline: string | null; status: string; assignedBy: string | null };

type Tab = "attendance" | "reports" | "tasks" | "projects";

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "bg-red-100 text-red-700 border-red-200",
  high: "bg-orange-100 text-orange-700 border-orange-200",
  medium: "bg-yellow-100 text-yellow-700 border-yellow-200",
  low: "bg-gray-100 text-gray-600 border-gray-200",
};

export default function InterneeDetail() {
  const { id } = useParams<{ id: string }>();
  const [, nav] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("attendance");
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [taskForm, setTaskForm] = useState({ title: "", description: "", priority: "medium", assignedDate: new Date().toISOString().slice(0, 10), dueDate: "", comments: "" });
  const [projectForm, setProjectForm] = useState({ name: "", description: "", startDate: new Date().toISOString().slice(0, 10), deadline: "", status: "active" });

  const nid = Number(id);

  const { data: internee, isLoading } = useQuery<Internee>({
    queryKey: ["internee", nid],
    queryFn: () => apiFetch(`/internees/${nid}`),
  });

  const { data: attendance = [] } = useQuery<AttendanceRecord[]>({
    queryKey: ["internee-attendance", nid],
    queryFn: () => apiFetch(`/internees/${nid}/attendance`),
    enabled: tab === "attendance",
  });

  const { data: reports = [] } = useQuery<DailyReport[]>({
    queryKey: ["internee-daily-reports", nid],
    queryFn: () => apiFetch(`/internees/${nid}/daily-reports`),
    enabled: tab === "reports",
  });

  const { data: tasks = [] } = useQuery<Task[]>({
    queryKey: ["internee-tasks", nid],
    queryFn: () => apiFetch(`/internees/${nid}/tasks`),
    enabled: tab === "tasks",
  });

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["internee-projects", nid],
    queryFn: () => apiFetch(`/internees/${nid}/projects`),
    enabled: tab === "projects",
  });

  const createTaskMutation = useMutation({
    mutationFn: (data: object) => apiFetch("/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["internee-tasks"] }); toast({ title: "Task assigned" }); setTaskDialogOpen(false); setTaskForm({ title: "", description: "", priority: "medium", assignedDate: new Date().toISOString().slice(0, 10), dueDate: "", comments: "" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteTaskMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/tasks/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["internee-tasks"] }); toast({ title: "Task deleted" }); },
  });

  const createProjectMutation = useMutation({
    mutationFn: (data: object) => apiFetch("/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["internee-projects"] }); toast({ title: "Project assigned" }); setProjectDialogOpen(false); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteProjectMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/projects/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["internee-projects"] }); toast({ title: "Project deleted" }); },
  });

  const deleteAttendanceMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/internee-attendance/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["internee-attendance"] }); toast({ title: "Record deleted" }); },
  });

  const deleteReportMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/daily-reports/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["internee-daily-reports"] }); toast({ title: "Report deleted" }); },
  });

  if (isLoading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  if (!internee) return <div className="text-center py-20 text-muted-foreground">Internee not found.</div>;

  const totalDays = attendance.filter(a => a.status === "present").length;
  const totalHours = attendance.reduce((s, a) => s + Number(a.totalHours ?? 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => nav("/internees")}><ArrowLeft className="w-4 h-4" /></Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">{internee.name}</h1>
          <p className="text-sm text-muted-foreground flex items-center gap-1.5"><QrCode className="w-3.5 h-3.5" />{internee.interneeCode} · {internee.department ?? "—"} · {internee.position ?? "—"}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => printInterneeIDCard(internee)}>
            <Printer className="w-4 h-4" />ID Card
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => printExperienceCertificate(internee)}>
            <Printer className="w-4 h-4" />Certificate
          </Button>
        </div>
      </div>

      {/* Info Cards */}
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
          <div className="text-2xl font-bold text-purple-600">{tasks.length}</div>
          <div className="text-xs text-muted-foreground mt-1">Tasks Assigned</div>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <div className="text-2xl font-bold text-orange-600">{projects.length}</div>
          <div className="text-xs text-muted-foreground mt-1">Projects</div>
        </CardContent></Card>
      </div>

      {/* Internee Info */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            {internee.fatherName && <div><span className="text-muted-foreground">Father: </span><strong>{internee.fatherName}</strong></div>}
            {internee.email && <div><span className="text-muted-foreground">Email: </span><strong>{internee.email}</strong></div>}
            {internee.phone && <div><span className="text-muted-foreground">Phone: </span><strong>{internee.phone}</strong></div>}
            <div><span className="text-muted-foreground">Start: </span><strong>{new Date(internee.startDate).toLocaleDateString("en-PK")}</strong></div>
            {internee.endDate && <div><span className="text-muted-foreground">End: </span><strong>{new Date(internee.endDate).toLocaleDateString("en-PK")}</strong></div>}
            <div><span className="text-muted-foreground">Mode: </span><strong>{internee.attendanceMode === "hourly" ? `${internee.requiredHours}h/day` : "Fixed Schedule"}</strong></div>
            <div><span className="text-muted-foreground">Status: </span><strong className={cn(internee.status === "active" ? "text-green-600" : "text-muted-foreground")}>{internee.status}</strong></div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <div className="flex border-b border-border gap-0">
        {[
          { id: "attendance", label: "Attendance", icon: <CalendarDays className="w-4 h-4" /> },
          { id: "reports", label: "Daily Reports", icon: <FileText className="w-4 h-4" /> },
          { id: "tasks", label: "Tasks", icon: <CheckSquare className="w-4 h-4" /> },
          { id: "projects", label: "Projects", icon: <Briefcase className="w-4 h-4" /> },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as Tab)}
            className={cn("px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2",
              tab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* Attendance Tab */}
      {tab === "attendance" && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Attendance History</CardTitle></CardHeader>
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
                    <th className="px-4 py-3"></th>
                  </tr></thead>
                  <tbody>
                    {attendance.map(a => (
                      <tr key={a.id} className="border-b last:border-0 hover:bg-muted/20">
                        <td className="px-4 py-3 font-medium">{new Date(a.attendanceDate).toLocaleDateString("en-PK")}</td>
                        <td className="px-4 py-3 font-mono text-xs">{a.checkInTime ?? "—"}</td>
                        <td className="px-4 py-3 font-mono text-xs">{a.checkOutTime ?? "—"}</td>
                        <td className="px-4 py-3 text-center font-semibold">{a.totalHours ? Number(a.totalHours).toFixed(2) : "—"}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={cn("text-xs px-2 py-0.5 rounded font-medium", a.dailyReportSubmitted ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700")}>{a.dailyReportSubmitted ? "Submitted" : "Pending"}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={cn("text-xs px-2 py-0.5 rounded border font-medium", a.status === "present" ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200")}>{a.status}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Button variant="ghost" size="icon" className="w-7 h-7 text-destructive hover:text-destructive" onClick={() => deleteAttendanceMutation.mutate(a.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
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
      {tab === "reports" && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Daily Reports ({reports.length})</CardTitle></CardHeader>
          <CardContent className="p-0">
            {reports.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <FileText className="w-8 h-8 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">No reports submitted yet.</p>
              </div>
            ) : (
              <div className="divide-y">
                {reports.map(r => (
                  <div key={r.id} className="p-4 space-y-2">
                    <div className="flex justify-between">
                      <span className="font-medium text-sm">{new Date(r.reportDate).toLocaleDateString("en-PK", { weekday: "long", year: "numeric", month: "short", day: "numeric" })}</span>
                      <div className="flex items-center gap-2">
                        {r.hoursWorked && <span className="text-xs text-muted-foreground">{r.hoursWorked}h</span>}
                        <Button variant="ghost" size="icon" className="w-7 h-7 text-destructive hover:text-destructive" onClick={() => deleteReportMutation.mutate(r.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                      </div>
                    </div>
                    <p className="text-sm"><strong>Tasks:</strong> <span className="text-muted-foreground">{r.tasksCompleted}</span></p>
                    <p className="text-sm"><strong>Summary:</strong> <span className="text-muted-foreground">{r.workSummary}</span></p>
                    {r.problemsFaced && <p className="text-sm"><strong>Problems:</strong> <span className="text-muted-foreground">{r.problemsFaced}</span></p>}
                    {r.learnings && <p className="text-sm"><strong>Learnings:</strong> <span className="text-muted-foreground">{r.learnings}</span></p>}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tasks Tab */}
      {tab === "tasks" && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Tasks ({tasks.length})</CardTitle>
              <Button size="sm" className="gap-1" onClick={() => setTaskDialogOpen(true)}><Plus className="w-3.5 h-3.5" />Assign Task</Button>
            </div>
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
                  <div key={t.id} className="p-4 flex items-start justify-between gap-3">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{t.title}</span>
                        <span className={cn("text-xs px-2 py-0.5 rounded border font-medium", PRIORITY_COLORS[t.priority] ?? "")}>{t.priority}</span>
                        <span className={cn("text-xs px-2 py-0.5 rounded font-medium",
                          t.status === "completed" ? "bg-green-100 text-green-700" : t.status === "in_progress" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600")}>
                          {t.status.replace("_", " ")}
                        </span>
                      </div>
                      {t.description && <p className="text-xs text-muted-foreground">{t.description}</p>}
                      {t.dueDate && <p className="text-xs text-muted-foreground">Due: {new Date(t.dueDate).toLocaleDateString("en-PK")}</p>}
                    </div>
                    <Button variant="ghost" size="icon" className="w-7 h-7 text-destructive hover:text-destructive shrink-0" onClick={() => deleteTaskMutation.mutate(t.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Projects Tab */}
      {tab === "projects" && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Projects ({projects.length})</CardTitle>
              <Button size="sm" className="gap-1" onClick={() => setProjectDialogOpen(true)}><Plus className="w-3.5 h-3.5" />Assign Project</Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {projects.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <Briefcase className="w-8 h-8 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">No projects assigned yet.</p>
              </div>
            ) : (
              <div className="divide-y">
                {projects.map(p => (
                  <div key={p.id} className="p-4 flex items-start justify-between gap-3">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{p.name}</span>
                        <span className={cn("text-xs px-2 py-0.5 rounded border font-medium",
                          p.status === "completed" ? "bg-green-50 text-green-700 border-green-200" : "bg-blue-50 text-blue-700 border-blue-200")}>{p.status}</span>
                      </div>
                      {p.description && <p className="text-xs text-muted-foreground">{p.description}</p>}
                      <div className="flex gap-3 text-xs text-muted-foreground">
                        <span>Start: {new Date(p.startDate).toLocaleDateString("en-PK")}</span>
                        {p.deadline && <span>Deadline: {new Date(p.deadline).toLocaleDateString("en-PK")}</span>}
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="w-7 h-7 text-destructive hover:text-destructive shrink-0" onClick={() => deleteProjectMutation.mutate(p.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Task Dialog */}
      <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Assign Task</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>Title <span className="text-destructive">*</span></Label>
              <Input value={taskForm.title} onChange={e => setTaskForm(p => ({ ...p, title: e.target.value }))} placeholder="Task title..." />
            </div>
            <div className="space-y-1">
              <Label>Description</Label>
              <Textarea rows={2} value={taskForm.description} onChange={e => setTaskForm(p => ({ ...p, description: e.target.value }))} placeholder="Task details..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Priority</Label>
                <Select value={taskForm.priority} onValueChange={v => setTaskForm(p => ({ ...p, priority: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Due Date</Label>
                <Input type="date" value={taskForm.dueDate} onChange={e => setTaskForm(p => ({ ...p, dueDate: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Assigned Date</Label>
              <Input type="date" value={taskForm.assignedDate} onChange={e => setTaskForm(p => ({ ...p, assignedDate: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTaskDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => createTaskMutation.mutate({ ...taskForm, interneeId: nid })} disabled={!taskForm.title || createTaskMutation.isPending}>Assign Task</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Project Dialog */}
      <Dialog open={projectDialogOpen} onOpenChange={setProjectDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Assign Project</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>Project Name <span className="text-destructive">*</span></Label>
              <Input value={projectForm.name} onChange={e => setProjectForm(p => ({ ...p, name: e.target.value }))} placeholder="Project name..." />
            </div>
            <div className="space-y-1">
              <Label>Description</Label>
              <Textarea rows={2} value={projectForm.description} onChange={e => setProjectForm(p => ({ ...p, description: e.target.value }))} placeholder="Project details..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Start Date <span className="text-destructive">*</span></Label>
                <Input type="date" value={projectForm.startDate} onChange={e => setProjectForm(p => ({ ...p, startDate: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Deadline</Label>
                <Input type="date" value={projectForm.deadline} onChange={e => setProjectForm(p => ({ ...p, deadline: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProjectDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => createProjectMutation.mutate({ ...projectForm, interneeId: nid })} disabled={!projectForm.name || createProjectMutation.isPending}>Assign Project</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
