import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";
import { PlusCircle, Pencil, Trash2, ShieldCheck, KeyRound } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

type UserRow = { id: number; username: string; role: string; displayName: string; isActive: string; createdAt: string };

const ROLES = [
  { value: "admin", label: "Admin", desc: "Full access — manage all data, users, and settings" },
  { value: "staff", label: "Staff", desc: "Can manage students, vouchers, receipts" },
  { value: "instructor", label: "Instructor", desc: "Can view own attendance and class schedule" },
];

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-red-100 text-red-700 border-red-200",
  staff: "bg-blue-100 text-blue-700 border-blue-200",
  instructor: "bg-green-100 text-green-700 border-green-200",
};

function emptyForm() {
  return { username: "", password: "", displayName: "", role: "staff", isActive: "true" };
}

export default function Roles() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [resetPwOpen, setResetPwOpen] = useState(false);
  const [resetPw, setResetPw] = useState("");
  const [resetId, setResetId] = useState<number | null>(null);

  const { data: users = [], isLoading } = useQuery<UserRow[]>({
    queryKey: ["auth-users"],
    queryFn: () => apiFetch("/auth/users"),
  });

  const create = useMutation({
    mutationFn: (body: typeof form) => apiFetch("/auth/users", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["auth-users"] });
      setOpen(false); setForm(emptyForm());
      toast({ title: "User created" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const update = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<typeof form> }) =>
      apiFetch(`/auth/users/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["auth-users"] });
      setOpen(false); setEditId(null); setForm(emptyForm());
      setResetPwOpen(false); setResetPw(""); setResetId(null);
      toast({ title: "User updated" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const del = useMutation({
    mutationFn: (id: number) => apiFetch(`/auth/users/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["auth-users"] }); toast({ title: "User deleted" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handleEdit = (u: UserRow) => {
    setEditId(u.id);
    setForm({ username: u.username, password: "", displayName: u.displayName, role: u.role, isActive: u.isActive });
    setOpen(true);
  };

  const handleSave = () => {
    if (editId) {
      const patch: Record<string, string> = { displayName: form.displayName, role: form.role, isActive: form.isActive };
      update.mutate({ id: editId, data: patch });
    } else {
      create.mutate(form);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Role Management</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage system users and their access roles.</p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditId(null); setForm(emptyForm()); } }}>
          <DialogTrigger asChild>
            <Button className="gap-2"><PlusCircle className="w-4 h-4" /> Add User</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>{editId ? "Edit User" : "Add New User"}</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <Label>Display Name *</Label>
                <Input placeholder="Full name" value={form.displayName}
                  onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))} />
              </div>
              {!editId && (
                <div>
                  <Label>Username *</Label>
                  <Input placeholder="Lowercase, no spaces" value={form.username}
                    onChange={(e) => setForm((f) => ({ ...f, username: e.target.value.toLowerCase().replace(/\s/g, "") }))} />
                </div>
              )}
              {!editId && (
                <div>
                  <Label>Password *</Label>
                  <Input type="password" placeholder="Choose a password" value={form.password}
                    onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
                </div>
              )}
              <div>
                <Label>Role *</Label>
                <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        <div>
                          <p className="font-medium">{r.label}</p>
                          <p className="text-xs text-muted-foreground">{r.desc}</p>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {editId && (
                <div>
                  <Label>Status</Label>
                  <Select value={form.isActive} onValueChange={(v) => setForm((f) => ({ ...f, isActive: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">Active</SelectItem>
                      <SelectItem value="false">Disabled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <Button className="w-full"
                disabled={create.isPending || update.isPending || !form.displayName || (!editId && (!form.username || !form.password))}
                onClick={handleSave}>
                {create.isPending || update.isPending ? "Saving…" : editId ? "Update User" : "Create User"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Role cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {ROLES.map((r) => (
          <div key={r.value} className={`rounded-xl border p-4 ${ROLE_COLORS[r.value]}`}>
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck className="w-4 h-4" />
              <span className="font-semibold">{r.label}</span>
              <span className="ml-auto text-xs font-mono bg-white/60 rounded px-1.5 py-0.5">
                {users.filter((u) => u.role === r.value).length}
              </span>
            </div>
            <p className="text-xs opacity-80">{r.desc}</p>
          </div>
        ))}
      </div>

      {/* Reset PW dialog */}
      <Dialog open={resetPwOpen} onOpenChange={(o) => { setResetPwOpen(o); if (!o) { setResetPw(""); setResetId(null); } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Reset Password</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>New Password</Label>
              <Input type="password" placeholder="New password" value={resetPw}
                onChange={(e) => setResetPw(e.target.value)} />
            </div>
            <Button className="w-full" disabled={update.isPending || !resetPw}
              onClick={() => resetId && update.mutate({ id: resetId, data: { password: resetPw } })}>
              {update.isPending ? "Resetting…" : "Reset Password"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Users Table */}
      <div className="bg-card border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              {["Display Name", "Username", "Role", "Status", "Created", ""].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">Loading…</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">No users found.</td></tr>
            ) : users.map((u) => (
              <tr key={u.id} className="border-t hover:bg-muted/30">
                <td className="px-4 py-3 font-medium">{u.displayName}</td>
                <td className="px-4 py-3 font-mono text-muted-foreground">{u.username}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${ROLE_COLORS[u.role] ?? "bg-gray-100 text-gray-700"}`}>
                    {u.role}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <Badge variant={u.isActive === "true" ? "default" : "secondary"}>
                    {u.isActive === "true" ? "Active" : "Disabled"}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{new Date(u.createdAt).toLocaleDateString("en-PK")}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" className="h-8 w-8" title="Edit user" onClick={() => handleEdit(u)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" title="Reset password"
                      onClick={() => { setResetId(u.id); setResetPwOpen(true); }}>
                      <KeyRound className="w-3.5 h-3.5" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                          disabled={u.username === "admin"}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete User?</AlertDialogTitle>
                          <AlertDialogDescription>Delete user "{u.displayName}" ({u.username})? This cannot be undone.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => del.mutate(u.id)} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
