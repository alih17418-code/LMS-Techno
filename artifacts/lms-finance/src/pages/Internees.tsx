import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Plus, Search, Trash2, Eye, UserCheck, UserX, QrCode } from "lucide-react";

type Internee = {
  id: number; interneeCode: string; name: string; fatherName: string | null; email: string | null;
  phone: string | null; department: string | null; position: string | null;
  startDate: string; endDate: string | null; status: string;
  attendanceMode: string; requiredHours: string; fixedStartTime: string | null; fixedEndTime: string | null;
  notes: string | null; createdAt: string;
};

const BLANK = {
  name: "", fatherName: "", email: "", phone: "", address: "", department: "", position: "",
  startDate: "", endDate: "", attendanceMode: "hourly", requiredHours: "5",
  fixedStartTime: "", fixedEndTime: "", notes: "", status: "active",
};

export default function Internees() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [, nav] = useLocation();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Internee | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Internee | null>(null);
  const [form, setForm] = useState({ ...BLANK });

  const { data: internees = [], isLoading } = useQuery<Internee[]>({
    queryKey: ["internees"],
    queryFn: () => apiFetch("/internees"),
  });

  const setField = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const createMutation = useMutation({
    mutationFn: (data: object) => apiFetch("/internees", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["internees"] }); toast({ title: "Internee added" }); setDialogOpen(false); setForm({ ...BLANK }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: object }) => apiFetch(`/internees/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["internees"] }); toast({ title: "Internee updated" }); setDialogOpen(false); setEditTarget(null); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/internees/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["internees"] }); toast({ title: "Internee deleted" }); setDeleteTarget(null); },
  });

  const filtered = internees.filter(i =>
    i.name.toLowerCase().includes(search.toLowerCase()) ||
    i.interneeCode.toLowerCase().includes(search.toLowerCase()) ||
    (i.department ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const openCreate = () => { setEditTarget(null); setForm({ ...BLANK }); setDialogOpen(true); };
  const openEdit = (i: Internee) => {
    setEditTarget(i);
    setForm({
      name: i.name, fatherName: i.fatherName ?? "", email: i.email ?? "", phone: i.phone ?? "",
      address: "", department: i.department ?? "", position: i.position ?? "",
      startDate: i.startDate, endDate: i.endDate ?? "", attendanceMode: i.attendanceMode,
      requiredHours: i.requiredHours, fixedStartTime: i.fixedStartTime ?? "",
      fixedEndTime: i.fixedEndTime ?? "", notes: i.notes ?? "", status: i.status,
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    const payload = {
      name: form.name.trim(), fatherName: form.fatherName || null, email: form.email || null,
      phone: form.phone || null, address: form.address || null, department: form.department || null,
      position: form.position || null, startDate: form.startDate, endDate: form.endDate || null,
      attendanceMode: form.attendanceMode, requiredHours: form.requiredHours || "5",
      fixedStartTime: form.fixedStartTime || null, fixedEndTime: form.fixedEndTime || null,
      notes: form.notes || null, status: form.status,
    };
    if (editTarget) updateMutation.mutate({ id: editTarget.id, data: payload });
    else createMutation.mutate(payload);
  };

  const statusColor = (s: string) =>
    s === "active" ? "bg-green-100 text-green-700 border-green-200" :
    s === "completed" ? "bg-blue-100 text-blue-700 border-blue-200" : "bg-gray-100 text-gray-600 border-gray-200";

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Internees</h1>
          <p className="text-sm text-muted-foreground">{internees.length} total · {internees.filter(i => i.status === "active").length} active</p>
        </div>
        <Button onClick={openCreate} className="gap-2 self-start sm:self-auto"><Plus className="w-4 h-4" />Add Internee</Button>
      </div>

      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search internees..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center justify-center py-16 gap-3">
          <UserCheck className="w-10 h-10 text-muted-foreground/30" />
          <p className="text-muted-foreground">{search ? "No internees match your search" : "No internees added yet"}</p>
          {!search && <Button onClick={openCreate} variant="outline" className="gap-2"><Plus className="w-4 h-4" />Add First Internee</Button>}
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(i => (
            <Card key={i.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base truncate">{i.name}</CardTitle>
                    <CardDescription className="flex items-center gap-1.5 mt-1">
                      <QrCode className="w-3 h-3" />{i.interneeCode}
                    </CardDescription>
                  </div>
                  <span className={cn("text-xs px-2 py-0.5 rounded border font-medium ml-2 shrink-0", statusColor(i.status))}>{i.status}</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm space-y-1 text-muted-foreground">
                  {i.department && <div>{i.department} {i.position ? `· ${i.position}` : ""}</div>}
                  {i.phone && <div>{i.phone}</div>}
                  <div>Started: {new Date(i.startDate).toLocaleDateString("en-PK")}{i.endDate ? ` → ${new Date(i.endDate).toLocaleDateString("en-PK")}` : ""}</div>
                  <div className="text-xs">Mode: <strong className="text-foreground">{i.attendanceMode === "hourly" ? `Hourly (${i.requiredHours}h/day)` : `Fixed (${i.fixedStartTime} – ${i.fixedEndTime})`}</strong></div>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button variant="outline" size="sm" className="flex-1 gap-1" onClick={() => nav(`/internees/${i.id}`)}>
                    <Eye className="w-3.5 h-3.5" />View
                  </Button>
                  <Button variant="outline" size="sm" className="gap-1" onClick={() => openEdit(i)}>Edit</Button>
                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive gap-1" onClick={() => setDeleteTarget(i)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editTarget ? "Edit Internee" : "Add Internee"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="space-y-1">
              <Label>Full Name <span className="text-destructive">*</span></Label>
              <Input value={form.name} onChange={e => setField("name", e.target.value)} placeholder="Full name" />
            </div>
            <div className="space-y-1">
              <Label>Father's Name</Label>
              <Input value={form.fatherName} onChange={e => setField("fatherName", e.target.value)} placeholder="Father's name" />
            </div>
            <div className="space-y-1">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={e => setField("email", e.target.value)} placeholder="email@example.com" />
            </div>
            <div className="space-y-1">
              <Label>Phone</Label>
              <Input value={form.phone} onChange={e => setField("phone", e.target.value)} placeholder="03xx-xxxxxxx" />
            </div>
            <div className="space-y-1">
              <Label>Department</Label>
              <Input value={form.department} onChange={e => setField("department", e.target.value)} placeholder="e.g. Software Development" />
            </div>
            <div className="space-y-1">
              <Label>Position</Label>
              <Input value={form.position} onChange={e => setField("position", e.target.value)} placeholder="e.g. Frontend Developer" />
            </div>
            <div className="space-y-1">
              <Label>Start Date <span className="text-destructive">*</span></Label>
              <Input type="date" value={form.startDate} onChange={e => setField("startDate", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>End Date</Label>
              <Input type="date" value={form.endDate} onChange={e => setField("endDate", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Attendance Mode</Label>
              <Select value={form.attendanceMode} onValueChange={v => setField("attendanceMode", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="hourly">Hourly</SelectItem>
                  <SelectItem value="fixed">Fixed Schedule</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.attendanceMode === "hourly" ? (
              <div className="space-y-1">
                <Label>Required Hours/Day</Label>
                <Input type="number" min="1" max="12" step="0.5" value={form.requiredHours} onChange={e => setField("requiredHours", e.target.value)} />
              </div>
            ) : (
              <>
                <div className="space-y-1">
                  <Label>Start Time</Label>
                  <Input type="time" value={form.fixedStartTime} onChange={e => setField("fixedStartTime", e.target.value)} />
                </div>
                <div className="space-y-1 col-span-2">
                  <Label>End Time</Label>
                  <Input type="time" value={form.fixedEndTime} onChange={e => setField("fixedEndTime", e.target.value)} />
                </div>
              </>
            )}
            {editTarget && (
              <div className="space-y-1">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setField("status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="col-span-2 space-y-1">
              <Label>Notes</Label>
              <Input value={form.notes} onChange={e => setField("notes", e.target.value)} placeholder="Any additional notes..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!form.name || !form.startDate || createMutation.isPending || updateMutation.isPending}>
              {editTarget ? "Save Changes" : "Add Internee"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Internee?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete <strong>{deleteTarget?.name}</strong> and all associated records.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
