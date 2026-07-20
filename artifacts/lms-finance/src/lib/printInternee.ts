type Internee = {
  interneeCode: string; name: string; fatherName: string | null;
  department: string | null; position: string | null;
  startDate: string; endDate: string | null; status: string;
  phone?: string | null; email?: string | null;
};

function durationStr(start: string, end?: string | null) {
  const s = new Date(start);
  const e = end ? new Date(end) : new Date();
  const months = (e.getFullYear() - s.getFullYear()) * 12 + e.getMonth() - s.getMonth();
  if (months < 1) return "Less than 1 month";
  if (months < 12) return `${months} Month${months > 1 ? "s" : ""}`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  return `${years} Year${years > 1 ? "s" : ""}${rem > 0 ? ` ${rem} Month${rem > 1 ? "s" : ""}` : ""}`;
}

export function printInterneeIDCard(internee: Internee) {
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Internee ID Card</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; background: #f5f5f5; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
  .card { width: 340px; border-radius: 16px; overflow: hidden; box-shadow: 0 8px 32px rgba(0,0,0,0.18); }
  .card-top { background: linear-gradient(135deg, #1a2744 0%, #2d4a8a 100%); padding: 24px 20px 16px; text-align: center; color: white; }
  .institute { font-size: 11px; letter-spacing: 1px; opacity: 0.85; text-transform: uppercase; margin-bottom: 4px; }
  .title { font-size: 18px; font-weight: 700; margin-bottom: 2px; }
  .subtitle { font-size: 10px; opacity: 0.7; }
  .badge { display: inline-block; background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.3); border-radius: 20px; padding: 3px 12px; font-size: 10px; margin-top: 10px; letter-spacing: 1px; text-transform: uppercase; }
  .card-body { background: white; padding: 20px; }
  .avatar { width: 70px; height: 70px; border-radius: 50%; background: linear-gradient(135deg, #667eea, #764ba2); display: flex; align-items: center; justify-content: center; color: white; font-size: 26px; font-weight: 700; margin: -35px auto 12px; border: 3px solid white; box-shadow: 0 2px 10px rgba(0,0,0,0.15); }
  .name { text-align: center; font-size: 16px; font-weight: 700; color: #1a2744; }
  .dept { text-align: center; font-size: 11px; color: #6b7280; margin-top: 2px; }
  .divider { border: none; border-top: 1px solid #e5e7eb; margin: 12px 0; }
  .info-row { display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 5px; }
  .info-label { color: #6b7280; }
  .info-value { color: #1a2744; font-weight: 600; }
  .code { text-align: center; margin-top: 12px; font-family: monospace; font-size: 13px; font-weight: 700; color: #2d4a8a; background: #f0f4ff; padding: 6px; border-radius: 6px; letter-spacing: 2px; }
  .card-footer { background: linear-gradient(135deg, #1a2744, #2d4a8a); padding: 10px 20px; text-align: center; color: rgba(255,255,255,0.7); font-size: 9px; letter-spacing: 0.5px; }
  @media print { body { background: white; } .card { box-shadow: none; } }
</style></head><body>
<div class="card">
  <div class="card-top">
    <div class="institute">Technospyre Institute of Professional Studies</div>
    <div class="title">TIPS</div>
    <div class="subtitle">Finance & Management System</div>
    <div class="badge">Internee ID Card</div>
  </div>
  <div class="card-body">
    <div class="avatar">${internee.name.charAt(0).toUpperCase()}</div>
    <div class="name">${internee.name}</div>
    <div class="dept">${internee.position ?? "Internee"}${internee.department ? ` · ${internee.department}` : ""}</div>
    <hr class="divider">
    ${internee.fatherName ? `<div class="info-row"><span class="info-label">Father's Name</span><span class="info-value">${internee.fatherName}</span></div>` : ""}
    <div class="info-row"><span class="info-label">Start Date</span><span class="info-value">${new Date(internee.startDate).toLocaleDateString("en-PK")}</span></div>
    ${internee.endDate ? `<div class="info-row"><span class="info-label">End Date</span><span class="info-value">${new Date(internee.endDate).toLocaleDateString("en-PK")}</span></div>` : ""}
    <div class="info-row"><span class="info-label">Duration</span><span class="info-value">${durationStr(internee.startDate, internee.endDate)}</span></div>
    <div class="info-row"><span class="info-label">Status</span><span class="info-value" style="text-transform:capitalize;">${internee.status}</span></div>
    <div class="code">${internee.interneeCode}</div>
  </div>
  <div class="card-footer">TIPS · Technospyre Institute of Professional Studies · Authorized ID</div>
</div>
<script>window.onload=()=>window.print();</script>
</body></html>`);
  w.document.close();
}

export function printExperienceCertificate(internee: Internee) {
  const certNo = `TIPS-CERT-${new Date().getFullYear()}-${internee.interneeCode.replace("INT-", "")}`;
  const issueDate = new Date().toLocaleDateString("en-PK", { year: "numeric", month: "long", day: "numeric" });
  const endDate = internee.endDate ? new Date(internee.endDate).toLocaleDateString("en-PK", { year: "numeric", month: "long", day: "numeric" }) : "Present";
  const startDateFmt = new Date(internee.startDate).toLocaleDateString("en-PK", { year: "numeric", month: "long", day: "numeric" });
  const dur = durationStr(internee.startDate, internee.endDate);

  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Experience Certificate</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Times New Roman', serif; background: white; color: #111; }
  .page { width: 800px; min-height: 1100px; margin: 0 auto; padding: 60px; border: 12px solid #1a2744; position: relative; }
  .inner-border { position: absolute; inset: 16px; border: 2px solid #2d4a8a; pointer-events: none; }
  .header { text-align: center; margin-bottom: 32px; }
  .logo-name { font-size: 28px; font-weight: 900; color: #1a2744; letter-spacing: 3px; text-transform: uppercase; }
  .tagline { font-size: 12px; color: #6b7280; letter-spacing: 1px; margin-top: 4px; }
  .cert-title { font-size: 32px; font-weight: 700; color: #1a2744; margin: 32px 0 8px; text-align: center; text-transform: uppercase; letter-spacing: 4px; }
  .cert-sub { text-align: center; font-size: 13px; color: #6b7280; letter-spacing: 1px; margin-bottom: 32px; }
  .divider { width: 80px; height: 3px; background: linear-gradient(90deg, #1a2744, #2d4a8a); margin: 0 auto 32px; border-radius: 2px; }
  .body-text { font-size: 15px; line-height: 2.2; text-align: justify; color: #222; margin-bottom: 24px; }
  .name-highlight { font-size: 22px; font-weight: 700; color: #1a2744; display: block; text-align: center; margin: 8px 0; text-decoration: underline; text-underline-offset: 6px; }
  .details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 32px; margin: 24px 0; background: #f8faff; border: 1px solid #dbeafe; border-radius: 8px; padding: 20px; }
  .detail-item { display: flex; flex-direction: column; gap: 2px; }
  .detail-label { font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; }
  .detail-value { font-size: 14px; font-weight: 700; color: #1a2744; }
  .signature-area { display: flex; justify-content: space-between; margin-top: 60px; }
  .sig-block { text-align: center; min-width: 160px; }
  .sig-line { border-top: 1.5px solid #1a2744; margin-bottom: 6px; }
  .sig-label { font-size: 12px; color: #374151; font-weight: 600; }
  .sig-sub { font-size: 10px; color: #6b7280; }
  .cert-no { text-align: center; margin-top: 28px; font-size: 11px; color: #6b7280; font-family: monospace; }
  .seal { text-align: center; margin-top: 16px; }
  .seal-text { display: inline-block; border: 3px double #1a2744; border-radius: 50%; width: 80px; height: 80px; line-height: 1.2; font-size: 8px; color: #1a2744; font-weight: 700; padding: 8px; text-align: center; text-transform: uppercase; letter-spacing: 0.5px; display: flex; align-items: center; justify-content: center; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style></head><body>
<div class="page">
  <div class="inner-border"></div>
  <div class="header">
    <div class="logo-name">TIPS</div>
    <div class="tagline">Technospyre Institute of Professional Studies</div>
  </div>
  <div class="cert-title">Experience Certificate</div>
  <div class="cert-sub">This is to certify that</div>
  <div class="divider"></div>
  <div class="body-text">
    <span class="name-highlight">${internee.name}</span>
    ${internee.fatherName ? `<br>Son/Daughter of <strong>${internee.fatherName}</strong>,` : ""}
    has successfully completed an internship program at <strong>Technospyre Institute of Professional Studies (TIPS)</strong>
    in the capacity of <strong>${internee.position ?? "Intern"}</strong> in the <strong>${internee.department ?? "IT"}</strong> Department.
  </div>
  <div class="details-grid">
    <div class="detail-item"><span class="detail-label">Internee ID</span><span class="detail-value">${internee.interneeCode}</span></div>
    <div class="detail-item"><span class="detail-label">Department</span><span class="detail-value">${internee.department ?? "—"}</span></div>
    <div class="detail-item"><span class="detail-label">Position</span><span class="detail-value">${internee.position ?? "Intern"}</span></div>
    <div class="detail-item"><span class="detail-label">Duration</span><span class="detail-value">${dur}</span></div>
    <div class="detail-item"><span class="detail-label">Start Date</span><span class="detail-value">${startDateFmt}</span></div>
    <div class="detail-item"><span class="detail-label">End Date</span><span class="detail-value">${endDate}</span></div>
  </div>
  <div class="body-text">
    During the internship period, <strong>${internee.name}</strong> demonstrated dedication, professionalism, and a keen interest in learning.
    We wish them all the best in their future endeavors.
  </div>
  <div class="signature-area">
    <div class="sig-block">
      <div style="height:48px;"></div>
      <div class="sig-line"></div>
      <div class="sig-label">Internee Signature</div>
      <div class="sig-sub">${internee.name}</div>
    </div>
    <div class="sig-block">
      <div class="seal">
        <div class="seal-text">TIPS<br>Official<br>Seal</div>
      </div>
    </div>
    <div class="sig-block">
      <div style="height:48px;"></div>
      <div class="sig-line"></div>
      <div class="sig-label">Authorized Signatory</div>
      <div class="sig-sub">Director, TIPS</div>
    </div>
  </div>
  <div class="cert-no">Certificate No: ${certNo} &nbsp;|&nbsp; Issue Date: ${issueDate}</div>
</div>
<script>window.onload=()=>window.print();</script>
</body></html>`);
  w.document.close();
}
