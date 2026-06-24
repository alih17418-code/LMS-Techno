const PKR = (n: number) =>
  "Rs " + n.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export interface LedgerEntry {
  monthName: string;
  year: number;
  fee: number;
  received: number;
  pending: number;
  status: string;
}

export interface LedgerStudent {
  name: string;
  studentCode: string;
  rollNumber?: string;
  course: string;
  fatherName?: string;
  phone?: string;
  enrollmentDate?: string;
  endDate?: string;
  status: string;
}

export interface LedgerData {
  student: LedgerStudent;
  entries: LedgerEntry[];
  totalFee: number;
  totalReceived: number;
  totalPending: number;
}

const statusColors: Record<string, string> = {
  paid: "#16a34a",
  partial: "#d97706",
  unpaid: "#dc2626",
};

export function printLedger(ledger: LedgerData): void {
  const logoUrl = `${window.location.origin}/tips-logo.png`;
  const win = window.open("", "_blank", "width=960,height=760");
  if (!win) {
    alert("Please allow popups for this site to print the ledger.");
    return;
  }

  const rowsHtml = ledger.entries
    .map(
      (e, i) => `
      <tr style="background:${i % 2 === 0 ? "#fff" : "#f9fafb"}">
        <td>${e.monthName}</td>
        <td>${e.year}</td>
        <td class="mono right">${PKR(e.fee)}</td>
        <td class="mono right green">${PKR(e.received)}</td>
        <td class="mono right ${e.pending > 0 ? "red" : "green"}">${PKR(e.pending)}</td>
        <td style="text-align:center">
          <span class="badge" style="color:${statusColors[e.status] ?? "#888"};border-color:${statusColors[e.status] ?? "#ddd"}">${e.status.toUpperCase()}</span>
        </td>
      </tr>`
    )
    .join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Fee Statement — ${ledger.student.name}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; color: #1a1a1a; background: #f5f5f5; }
    .page { max-width: 820px; margin: 0 auto; padding: 24px; }
    .doc { background: #fff; border: 1px solid #ddd; padding: 28px 32px; }
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
    .logo { height: 56px; width: auto; object-fit: contain; }
    .doc-title { text-align: right; }
    .doc-title h1 { font-size: 18px; font-weight: 800; color: #1e3a5f; letter-spacing: 1px; }
    .doc-title p { font-size: 11px; color: #888; margin-top: 3px; }
    .divider { border-top: 1.5px solid #1e3a5f; margin: 12px 0; }
    .divider-thin { border-top: 1px solid #e5e5e5; margin: 10px 0; }
    .student-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px 20px; margin: 14px 0; }
    .field { display: flex; flex-direction: column; gap: 2px; }
    .field-label { font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.5px; color: #888; font-weight: 600; }
    .field-value { font-size: 12px; color: #1a1a1a; font-weight: 600; }
    .field-value.mono { font-family: 'Courier New', monospace; color: #1e3a5f; }
    .summary-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 14px 0; }
    .summary-box { border: 1px solid #e5e5e5; border-radius: 6px; padding: 10px 14px; text-align: center; }
    .summary-box.green { border-color: #86efac; background: #f0fdf4; }
    .summary-box.red { border-color: #fca5a5; background: #fff1f2; }
    .summary-label { font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.5px; color: #888; font-weight: 600; margin-bottom: 4px; }
    .summary-amount { font-size: 16px; font-weight: 800; font-family: 'Courier New', monospace; }
    .summary-box.green .summary-amount { color: #16a34a; }
    .summary-box.red .summary-amount { color: #dc2626; }
    .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #555; margin-bottom: 8px; margin-top: 14px; }
    table { width: 100%; border-collapse: collapse; font-size: 11.5px; }
    thead tr { background: #1e3a5f; color: #fff; }
    thead th { padding: 7px 10px; text-align: left; font-weight: 600; font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.5px; }
    tbody td { padding: 6px 10px; border-bottom: 1px solid #f0f0f0; }
    .tfoot tr { background: #1e3a5f; color: #fff; font-weight: 700; }
    .tfoot td { padding: 7px 10px; }
    .mono { font-family: 'Courier New', monospace; }
    .right { text-align: right; }
    .green { color: #16a34a; }
    .red { color: #dc2626; }
    .badge { font-size: 9px; font-weight: 700; letter-spacing: 0.8px; border: 1px solid; border-radius: 3px; padding: 1px 5px; }
    .footer { display: flex; justify-content: space-between; margin-top: 20px; font-size: 10px; color: #aaa; padding-top: 10px; border-top: 1px solid #eee; }
    @media print {
      body { background: #fff; }
      .page { padding: 0; max-width: 100%; }
      .doc { border: none; padding: 0; }
      @page { size: A4; margin: 12mm; }
    }
  </style>
</head>
<body>
<div class="page">
<div class="doc">
  <div class="header">
    <img src="${logoUrl}" alt="TIPS" class="logo" />
    <div class="doc-title">
      <h1>FEE STATEMENT</h1>
      <p>Printed: ${new Date().toLocaleString("en-PK")}</p>
    </div>
  </div>
  <div class="divider"></div>

  <div class="student-grid">
    <div class="field">
      <span class="field-label">Student Name</span>
      <span class="field-value">${ledger.student.name}</span>
    </div>
    <div class="field">
      <span class="field-label">Student Code</span>
      <span class="field-value mono">${ledger.student.studentCode}</span>
    </div>
    <div class="field">
      <span class="field-label">Course</span>
      <span class="field-value">${ledger.student.course}</span>
    </div>
    <div class="field">
      <span class="field-label">Status</span>
      <span class="field-value" style="color:${ledger.student.status === 'active' ? '#16a34a' : '#94a3b8'}">${ledger.student.status.toUpperCase()}</span>
    </div>
    ${ledger.student.fatherName ? `<div class="field"><span class="field-label">Father Name</span><span class="field-value">${ledger.student.fatherName}</span></div>` : ""}
    ${ledger.student.phone ? `<div class="field"><span class="field-label">Phone</span><span class="field-value">${ledger.student.phone}</span></div>` : ""}
    ${ledger.student.enrollmentDate ? `<div class="field"><span class="field-label">Enrollment</span><span class="field-value">${ledger.student.enrollmentDate}</span></div>` : ""}
    ${ledger.student.endDate ? `<div class="field"><span class="field-label">Course End</span><span class="field-value">${ledger.student.endDate}</span></div>` : ""}
  </div>

  <div class="divider-thin"></div>

  <div class="summary-row">
    <div class="summary-box">
      <div class="summary-label">Total Fee Generated</div>
      <div class="summary-amount">${PKR(ledger.totalFee)}</div>
    </div>
    <div class="summary-box green">
      <div class="summary-label">Total Received</div>
      <div class="summary-amount">${PKR(ledger.totalReceived)}</div>
    </div>
    <div class="summary-box ${ledger.totalPending > 0 ? "red" : "green"}">
      <div class="summary-label">Balance Pending</div>
      <div class="summary-amount">${PKR(ledger.totalPending)}</div>
    </div>
  </div>

  <div class="section-title">Month-by-Month Breakdown</div>
  ${ledger.entries.length === 0 ? `<p style="text-align:center;color:#aaa;padding:20px 0">No vouchers generated yet.</p>` : `
  <table>
    <thead>
      <tr>
        <th>Month</th><th>Year</th>
        <th style="text-align:right">Fee</th>
        <th style="text-align:right">Received</th>
        <th style="text-align:right">Pending</th>
        <th style="text-align:center">Status</th>
      </tr>
    </thead>
    <tbody>${rowsHtml}</tbody>
    <tfoot class="tfoot">
      <tr>
        <td colspan="2">TOTAL</td>
        <td class="mono right">${PKR(ledger.totalFee)}</td>
        <td class="mono right">${PKR(ledger.totalReceived)}</td>
        <td class="mono right">${PKR(ledger.totalPending)}</td>
        <td></td>
      </tr>
    </tfoot>
  </table>`}

  <div class="footer">
    <div>TechnoSpyre Institute of Professional Studies — Finance System</div>
    <div>Authorized Signature: _______________________</div>
  </div>
</div>
</div>
<script>
  window.addEventListener('load', function() { setTimeout(function() { window.print(); }, 400); });
</script>
</body>
</html>`;

  win.document.write(html);
  win.document.close();
}
