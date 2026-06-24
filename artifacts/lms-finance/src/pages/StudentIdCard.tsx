import { useEffect } from "react";
import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft } from "lucide-react";
import { Link } from "wouter";

type Student = {
  id: number; name: string; studentCode: string; fatherName?: string;
  phone?: string; address?: string; course: string; enrollmentDate: string;
  effectiveFee: string; durationMonths: number; status: string;
};

export default function StudentIdCard() {
  const { id } = useParams<{ id: string }>();

  const { data: students = [] } = useQuery<Student[]>({
    queryKey: ["student-card", id],
    queryFn: () => apiFetch(`/students?search=`),
  });

  // fetch specific student
  const { data: allStudents = [], isLoading } = useQuery<Student[]>({
    queryKey: ["students"],
    queryFn: () => apiFetch("/students"),
  });

  const student = allStudents.find((s) => s.id === Number(id));

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen text-muted-foreground">Loading...</div>;
  }

  if (!student) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-muted-foreground">Student not found.</p>
        <Link href="/students"><Button variant="outline" className="gap-2"><ArrowLeft className="w-4 h-4" />Back to Students</Button></Link>
      </div>
    );
  }

  const printCard = () => {
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
<!DOCTYPE html><html><head><title>ID Card - ${student.studentCode}</title>
<style>
  @page { size: 85.6mm 54mm; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; background: white; }
  .card { width: 85.6mm; height: 54mm; background: linear-gradient(135deg, #0f2d6b 0%, #1e4db7 100%); color: white; padding: 4mm; display: flex; flex-direction: column; position: relative; overflow: hidden; border-radius: 4mm; }
  .watermark { position: absolute; right: -5mm; top: 50%; transform: translateY(-50%); font-size: 40mm; font-weight: bold; color: rgba(255,255,255,0.04); letter-spacing: -2mm; }
  .header { display: flex; align-items: center; gap: 2mm; margin-bottom: 2.5mm; border-bottom: 0.3mm solid rgba(255,255,255,0.3); padding-bottom: 2mm; }
  .institute { font-size: 4.5pt; color: rgba(255,255,255,0.85); line-height: 1.3; }
  .institute strong { font-size: 6pt; color: white; display: block; letter-spacing: 0.5pt; }
  .body { display: flex; gap: 3mm; flex: 1; }
  .photo { width: 14mm; height: 17mm; background: rgba(255,255,255,0.15); border: 0.5mm solid rgba(255,255,255,0.4); border-radius: 1mm; display: flex; align-items: center; justify-content: center; font-size: 18pt; flex-shrink: 0; }
  .info { flex: 1; }
  .name { font-size: 7.5pt; font-weight: bold; margin-bottom: 1mm; }
  .field { font-size: 5.5pt; color: rgba(255,255,255,0.75); margin-bottom: 0.5mm; }
  .field strong { color: white; }
  .id-strip { background: rgba(0,0,0,0.3); margin: 2mm -4mm -4mm; padding: 1.5mm 4mm; display: flex; justify-content: space-between; align-items: center; font-size: 5pt; }
  .id-code { font-family: monospace; font-size: 6.5pt; font-weight: bold; letter-spacing: 1pt; }
  .course-badge { background: rgba(255,255,255,0.2); padding: 0.5mm 2mm; border-radius: 1mm; font-size: 5pt; }
</style></head><body>
<div class="card">
  <div class="watermark">TIPS</div>
  <div class="header">
    <img src="/tips-logo.png" style="height:8mm;filter:brightness(0) invert(1);opacity:0.9" />
    <div class="institute">
      <strong>TIPS</strong>
      Technospyre Institute of Professional Studies
    </div>
    <div style="margin-left:auto;text-align:right;font-size:4.5pt;color:rgba(255,255,255,0.6)">STUDENT<br/>ID CARD</div>
  </div>
  <div class="body">
    <div class="photo">${student.name[0].toUpperCase()}</div>
    <div class="info">
      <div class="name">${student.name}</div>
      ${student.fatherName ? `<div class="field">Father: <strong>${student.fatherName}</strong></div>` : ""}
      <div class="field">Course: <strong>${student.course}</strong></div>
      <div class="field">Duration: <strong>${student.durationMonths} Months</strong></div>
      <div class="field">Enrolled: <strong>${new Date(student.enrollmentDate).toLocaleDateString("en-PK", { month: "short", year: "numeric" })}</strong></div>
      ${student.phone ? `<div class="field">Phone: <strong>${student.phone}</strong></div>` : ""}
    </div>
  </div>
  <div class="id-strip">
    <div class="id-code">${student.studentCode}</div>
    <div class="course-badge">${student.course.length > 20 ? student.course.slice(0, 18) + "…" : student.course}</div>
    <div style="color:rgba(255,255,255,0.5)">tips.edu.pk</div>
  </div>
</div>
<script>window.onload=()=>{ window.print(); }</script>
</body></html>`);
    win.document.close();
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Student ID Card</h1>
          <p className="text-muted-foreground text-sm mt-1">{student.name} · {student.studentCode}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/students">
            <Button variant="outline" className="gap-2"><ArrowLeft className="w-4 h-4" />Back</Button>
          </Link>
          <Button className="gap-2" onClick={printCard}><Printer className="w-4 h-4" />Print ID Card</Button>
        </div>
      </div>

      {/* Preview */}
      <div className="flex justify-center">
        <div
          style={{
            width: "342px", height: "216px",
            background: "linear-gradient(135deg, #0f2d6b 0%, #1e4db7 100%)",
            borderRadius: "16px", padding: "16px",
            color: "white", position: "relative", overflow: "hidden",
            boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
          }}
        >
          {/* Watermark */}
          <div style={{ position: "absolute", right: "-20px", top: "50%", transform: "translateY(-50%)", fontSize: "120px", fontWeight: "bold", color: "rgba(255,255,255,0.04)", lineHeight: 1 }}>TIPS</div>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px", borderBottom: "1px solid rgba(255,255,255,0.3)", paddingBottom: "8px" }}>
            <img src="/tips-logo.png" alt="TIPS" style={{ height: "30px", filter: "brightness(0) invert(1)", opacity: 0.9 }} />
            <div>
              <div style={{ fontWeight: "bold", fontSize: "10px", letterSpacing: "1px" }}>TIPS</div>
              <div style={{ fontSize: "8px", color: "rgba(255,255,255,0.7)" }}>Technospyre Institute of Professional Studies</div>
            </div>
            <div style={{ marginLeft: "auto", textAlign: "right", fontSize: "8px", color: "rgba(255,255,255,0.5)" }}>STUDENT<br />ID CARD</div>
          </div>
          {/* Body */}
          <div style={{ display: "flex", gap: "12px", flex: 1 }}>
            <div style={{ width: "52px", height: "64px", background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.4)", borderRadius: "4px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "28px", flexShrink: 0 }}>
              {student.name[0].toUpperCase()}
            </div>
            <div style={{ flex: 1, fontSize: "11px" }}>
              <div style={{ fontWeight: "bold", fontSize: "13px", marginBottom: "3px" }}>{student.name}</div>
              {student.fatherName && <div style={{ color: "rgba(255,255,255,0.75)", marginBottom: "2px", fontSize: "9px" }}>Father: <strong style={{ color: "white" }}>{student.fatherName}</strong></div>}
              <div style={{ color: "rgba(255,255,255,0.75)", marginBottom: "2px", fontSize: "9px" }}>Course: <strong style={{ color: "white" }}>{student.course}</strong></div>
              <div style={{ color: "rgba(255,255,255,0.75)", marginBottom: "2px", fontSize: "9px" }}>Duration: <strong style={{ color: "white" }}>{student.durationMonths} Months</strong></div>
              <div style={{ color: "rgba(255,255,255,0.75)", fontSize: "9px" }}>Enrolled: <strong style={{ color: "white" }}>{new Date(student.enrollmentDate).toLocaleDateString("en-PK", { month: "short", year: "numeric" })}</strong></div>
            </div>
          </div>
          {/* ID Strip */}
          <div style={{ background: "rgba(0,0,0,0.3)", margin: "8px -16px -16px", padding: "5px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "9px" }}>
            <div style={{ fontFamily: "monospace", fontSize: "11px", fontWeight: "bold", letterSpacing: "2px" }}>{student.studentCode}</div>
            <div style={{ background: "rgba(255,255,255,0.2)", padding: "1px 6px", borderRadius: "3px", fontSize: "8px" }}>
              {student.course.length > 20 ? student.course.slice(0, 18) + "…" : student.course}
            </div>
            <div style={{ color: "rgba(255,255,255,0.5)" }}>tips.edu.pk</div>
          </div>
        </div>
      </div>

      <div className="bg-card border rounded-xl p-6 space-y-3">
        <h2 className="font-semibold">Student Details</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><span className="text-muted-foreground">Name:</span> <strong>{student.name}</strong></div>
          <div><span className="text-muted-foreground">Code:</span> <strong className="font-mono">{student.studentCode}</strong></div>
          {student.fatherName && <div><span className="text-muted-foreground">Father:</span> <strong>{student.fatherName}</strong></div>}
          {student.phone && <div><span className="text-muted-foreground">Phone:</span> <strong>{student.phone}</strong></div>}
          <div><span className="text-muted-foreground">Course:</span> <strong>{student.course}</strong></div>
          <div><span className="text-muted-foreground">Duration:</span> <strong>{student.durationMonths} months</strong></div>
          <div><span className="text-muted-foreground">Enrolled:</span> <strong>{new Date(student.enrollmentDate).toLocaleDateString("en-PK")}</strong></div>
          <div><span className="text-muted-foreground">Status:</span> <strong className="capitalize">{student.status}</strong></div>
        </div>
      </div>
    </div>
  );
}
