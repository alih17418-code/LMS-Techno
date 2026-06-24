import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";
import { Award, PlusCircle, Printer, ShieldX, Search } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

type Certificate = {
  id: number; certificateNumber: string; studentId: number;
  studentName: string; studentCode: string; courseName: string;
  issuedDate: string; isValid: boolean; createdAt: string;
};
type Student = { id: number; name: string; studentCode: string; course: string; status: string; };

export default function Certificates() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [issuedDate, setIssuedDate] = useState(new Date().toISOString().slice(0, 10));
  const [verifyNum, setVerifyNum] = useState("");
  const [verifyResult, setVerifyResult] = useState<(Certificate & { verified: boolean }) | "not_found" | null>(null);

  const { data: certs = [], isLoading } = useQuery<Certificate[]>({
    queryKey: ["certificates"],
    queryFn: () => apiFetch("/certificates"),
  });
  const { data: students = [] } = useQuery<Student[]>({
    queryKey: ["students"],
    queryFn: () => apiFetch("/students"),
  });

  const issue = useMutation({
    mutationFn: (body: { studentId: number; issuedDate: string }) =>
      apiFetch("/certificates", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["certificates"] });
      setOpen(false); setSelectedStudentId(""); setIssuedDate(new Date().toISOString().slice(0, 10));
      toast({ title: "Certificate issued successfully" });
    },
    onError: (e: Error) => toast({ title: "Cannot issue certificate", description: e.message, variant: "destructive" }),
  });

  const revoke = useMutation({
    mutationFn: (id: number) => apiFetch(`/certificates/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["certificates"] });
      toast({ title: "Certificate revoked" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handleVerify = async () => {
    if (!verifyNum.trim()) return;
    try {
      const result = await apiFetch<Certificate & { verified: boolean }>(`/certificates/verify/${verifyNum.trim()}`);
      setVerifyResult(result);
    } catch {
      setVerifyResult("not_found");
    }
  };

  const printCert = (cert: Certificate) => {
    const student = students.find((s) => s.id === cert.studentId);
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
<!DOCTYPE html><html><head><title>Certificate - ${cert.certificateNumber}</title>
<style>
  body { font-family: "Georgia", serif; margin: 0; background: #fff; }
  .page { width: 297mm; min-height: 210mm; margin: 0 auto; padding: 20mm; box-sizing: border-box; position: relative; border: 8px double #1a4b8c; }
  .header { text-align: center; margin-bottom: 20px; }
  .logo { font-size: 22px; font-weight: bold; color: #1a4b8c; letter-spacing: 3px; }
  .sub { font-size: 11px; color: #666; letter-spacing: 2px; margin-top: 4px; }
  h1 { text-align: center; font-size: 36px; color: #1a4b8c; margin: 30px 0 8px; letter-spacing: 4px; text-transform: uppercase; }
  .subtitle { text-align: center; font-size: 14px; color: #888; margin-bottom: 30px; }
  .body { text-align: center; font-size: 16px; color: #333; line-height: 2; }
  .name { font-size: 28px; color: #1a4b8c; font-style: italic; border-bottom: 2px solid #1a4b8c; display: inline-block; padding: 0 30px; margin: 8px 0; }
  .course { font-size: 20px; color: #333; font-weight: bold; }
  .footer { display: flex; justify-content: space-between; margin-top: 50px; font-size: 12px; }
  .sig { text-align: center; }
  .sig-line { border-top: 1px solid #333; width: 160px; margin: 30px auto 4px; }
  .cert-num { position: absolute; bottom: 15mm; right: 20mm; font-size: 10px; color: #aaa; }
  @media print { body { -webkit-print-color-adjust: exact; } }
</style></head><body>
<div class="page">
  <div class="header">
    <div class="logo">TIPS</div>
    <div class="sub">TECHNOSPYRE INSTITUTE OF PROFESSIONAL STUDIES</div>
  </div>
  <h1>Certificate of Completion</h1>
  <p class="subtitle">This is to certify that</p>
  <div class="body">
    <div class="name">${cert.studentName}</div>
    ${student?.studentCode ? `<p style="font-size:12px;color:#888">Student Code: ${student.studentCode}</p>` : ""}
    <p>has successfully completed the course</p>
    <div class="course">${cert.courseName}</div>
    <p>with satisfactory performance and cleared all dues.</p>
    <p style="margin-top:16px">Date of Issue: <strong>${new Date(cert.issuedDate).toLocaleDateString("en-PK", { year: "numeric", month: "long", day: "numeric" })}</strong></p>
  </div>
  <div class="footer">
    <div class="sig"><div class="sig-line"></div><p>Finance Officer</p></div>
    <div style="text-align:center;font-size:11px;color:#999">
      <img src="/tips-logo.png" style="height:48px;opacity:0.4" alt="" /><br/>
      Issued by TIPS
    </div>
    <div class="sig"><div class="sig-line"></div><p>Director</p></div>
  </div>
  <div class="cert-num">Certificate No: ${cert.certificateNumber}</div>
</div>
<script>window.onload=()=>{ window.print(); }</script>
</body></html>`);
    win.document.close();
  };

  const activeSentStudents = students.filter((s) => s.status === "active" || s.status === "completed");
  const filtered = certs.filter((c) =>
    !search ||
    c.studentName.toLowerCase().includes(search.toLowerCase()) ||
    c.studentCode.toLowerCase().includes(search.toLowerCase()) ||
    c.certificateNumber.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Certificates</h1>
          <p className="text-muted-foreground text-sm mt-1">Issue and manage course completion certificates.</p>
        </div>
        <div className="flex gap-2">
          {/* Verify dialog */}
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2"><Search className="w-4 h-4" /> Verify Certificate</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader><DialogTitle>Verify Certificate</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <Label>Certificate Number</Label>
                  <div className="flex gap-2">
                    <Input placeholder="TIPS-CERT-XXXX-XXXXX" value={verifyNum}
                      onChange={(e) => { setVerifyNum(e.target.value); setVerifyResult(null); }} />
                    <Button onClick={handleVerify} disabled={!verifyNum.trim()}>Check</Button>
                  </div>
                </div>
                {verifyResult === "not_found" && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
                    Certificate not found. It may be invalid or never issued.
                  </div>
                )}
                {verifyResult && verifyResult !== "not_found" && (
                  <div className={`border rounded-lg p-4 text-sm ${verifyResult.isValid ? "bg-green-50 border-green-200 text-green-800" : "bg-orange-50 border-orange-200 text-orange-800"}`}>
                    <div className="flex items-center gap-2 font-bold mb-2">
                      {verifyResult.isValid ? "✅ Valid Certificate" : "⚠️ Revoked Certificate"}
                    </div>
                    <p><strong>Student:</strong> {verifyResult.studentName} ({verifyResult.studentCode})</p>
                    <p><strong>Course:</strong> {verifyResult.courseName}</p>
                    <p><strong>Issued:</strong> {new Date(verifyResult.issuedDate).toLocaleDateString("en-PK", { year: "numeric", month: "long", day: "numeric" })}</p>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
          {/* Issue certificate */}
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2"><PlusCircle className="w-4 h-4" /> Issue Certificate</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader><DialogTitle>Issue Certificate</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-blue-800 text-xs">
                  Certificate will only be issued if the student has no outstanding fee balance.
                </div>
                <div>
                  <Label>Student *</Label>
                  <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
                    <SelectTrigger><SelectValue placeholder="Select student" /></SelectTrigger>
                    <SelectContent>
                      {activeSentStudents.map((s) => (
                        <SelectItem key={s.id} value={String(s.id)}>{s.name} ({s.studentCode}) — {s.course}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Issue Date</Label>
                  <Input type="date" value={issuedDate}
                    onChange={(e) => setIssuedDate(e.target.value)} />
                </div>
                <Button className="w-full" disabled={issue.isPending || !selectedStudentId}
                  onClick={() => issue.mutate({ studentId: Number(selectedStudentId), issuedDate })}>
                  {issue.isPending ? "Checking fees & issuing…" : "Issue Certificate"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Input placeholder="Search by name, code, or certificate number…" value={search}
          onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
        <span className="text-sm text-muted-foreground">{filtered.length} certificates</span>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              {["Certificate No.", "Student", "Course", "Issued Date", "Status", ""].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">
                <Award className="w-8 h-8 mx-auto mb-2 opacity-30" />
                No certificates issued yet.
              </td></tr>
            ) : filtered.map((c) => (
              <tr key={c.id} className="border-t hover:bg-muted/30">
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{c.certificateNumber}</td>
                <td className="px-4 py-3">
                  <div className="font-medium">{c.studentName}</div>
                  <div className="text-xs text-muted-foreground">{c.studentCode}</div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{c.courseName}</td>
                <td className="px-4 py-3">{new Date(c.issuedDate).toLocaleDateString("en-PK")}</td>
                <td className="px-4 py-3">
                  <Badge variant={c.isValid ? "default" : "secondary"}>
                    {c.isValid ? "Valid" : "Revoked"}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={() => printCert(c)}>
                      <Printer className="w-3 h-3" /> Print
                    </Button>
                    {c.isValid && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50">
                            <ShieldX className="w-3.5 h-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Revoke Certificate?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Revoke certificate {c.certificateNumber} for {c.studentName}? This cannot be undone easily.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => revoke.mutate(c.id)} className="bg-red-600 hover:bg-red-700">Revoke</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
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
