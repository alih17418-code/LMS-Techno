const PKR = (n: number) =>
  "Rs " + n.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

export interface SalarySlipData {
  paymentNumber: string;
  instructorName: string;
  instructorCode: string;
  specialization?: string;
  courseName?: string;
  month: number;
  year: number;
  amountPaid: number;
  paymentMethod: string;
  paymentDate: string;
  remarks?: string;
}

function slip(s: SalarySlipData, copyLabel: string, logoUrl: string): string {
  return `
    <div class="slip">
      <div class="copy-label">${copyLabel}</div>
      <div class="header">
        <img src="${logoUrl}" alt="TIPS" class="logo" />
        <div class="header-right">
          <div class="title">SALARY SLIP</div>
          <div class="sub">${s.paymentNumber}</div>
        </div>
      </div>
      <div class="divider"></div>
      <div class="grid">
        <div class="field">
          <span class="label">Instructor Name</span>
          <span class="value bold">${s.instructorName}</span>
        </div>
        <div class="field">
          <span class="label">Instructor Code</span>
          <span class="value mono">${s.instructorCode}</span>
        </div>
        <div class="field">
          <span class="label">Specialization</span>
          <span class="value">${s.specialization ?? "—"}</span>
        </div>
        <div class="field">
          <span class="label">Course</span>
          <span class="value">${s.courseName ?? "—"}</span>
        </div>
        <div class="field">
          <span class="label">Pay Period</span>
          <span class="value">${MONTH_NAMES[s.month - 1]} ${s.year}</span>
        </div>
        <div class="field">
          <span class="label">Payment Date</span>
          <span class="value">${new Date(s.paymentDate).toLocaleDateString("en-PK")}</span>
        </div>
        <div class="field">
          <span class="label">Payment Method</span>
          <span class="value" style="text-transform:capitalize">${s.paymentMethod.replace("_", " ")}</span>
        </div>
        ${s.remarks ? `<div class="field"><span class="label">Remarks</span><span class="value">${s.remarks}</span></div>` : ""}
      </div>
      <div class="divider"></div>
      <div class="amount-box">
        <div class="amount-label">Net Salary Paid</div>
        <div class="amount-value">${PKR(s.amountPaid)}</div>
      </div>
      <div class="footer">
        <div>Printed: ${new Date().toLocaleString("en-PK")}</div>
        <div>Authorized Signature: _______________________</div>
      </div>
    </div>`;
}

export function printSalarySlip(s: SalarySlipData): void {
  const logoUrl = `${window.location.origin}/tips-logo.png`;
  const win = window.open("", "_blank", "width=820,height=600");
  if (!win) {
    alert("Please allow popups to print salary slips.");
    return;
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Salary Slip — ${s.instructorName} — ${MONTH_NAMES[s.month - 1]} ${s.year}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; color: #1a1a1a; background: #f5f5f5; }
    .page { max-width: 720px; margin: 0 auto; padding: 20px; }
    .slip { background: #fff; padding: 20px 24px; border: 1px solid #ddd; position: relative; }
    .copy-label { position: absolute; top: 10px; right: 14px; font-size: 10px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: #999; border: 1px solid #ddd; padding: 2px 8px; border-radius: 3px; }
    .tear { border: none; border-top: 2px dashed #bbb; margin: 0; height: 0; position: relative; }
    .tear::before { content: "✂  Cut here"; position: absolute; top: -9px; left: 50%; transform: translateX(-50%); background: #f5f5f5; padding: 0 8px; font-size: 10px; color: #aaa; letter-spacing: 1px; }
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
    .logo { height: 52px; width: auto; object-fit: contain; }
    .header-right { text-align: right; }
    .title { font-size: 15px; font-weight: 700; color: #1e3a5f; letter-spacing: 1px; }
    .sub { font-size: 12px; font-family: 'Courier New', monospace; font-weight: 700; color: #555; margin-top: 3px; }
    .divider { border-top: 1px solid #e5e5e5; margin: 10px 0; }
    .grid { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 8px 16px; margin: 10px 0; }
    .field { display: flex; flex-direction: column; gap: 2px; }
    .label { font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.5px; color: #888; font-weight: 600; }
    .value { font-size: 12px; color: #1a1a1a; }
    .value.bold { font-weight: 700; }
    .value.mono { font-family: 'Courier New', monospace; font-weight: 700; color: #1e3a5f; }
    .amount-box { display: flex; align-items: center; justify-content: space-between; background: #f0fdf4; border: 1.5px solid #86efac; border-radius: 8px; padding: 12px 18px; margin: 14px 0; }
    .amount-label { font-size: 12px; font-weight: 600; color: #166534; text-transform: uppercase; letter-spacing: 0.5px; }
    .amount-value { font-size: 22px; font-weight: 800; font-family: 'Courier New', monospace; color: #16a34a; }
    .footer { display: flex; justify-content: space-between; margin-top: 12px; font-size: 10px; color: #aaa; padding-top: 10px; border-top: 1px solid #eee; }
    @media print {
      body { background: #fff; }
      .page { padding: 0; max-width: 100%; }
      .slip { border: none; padding: 16px; page-break-inside: avoid; }
      .tear { border-top: 1px dashed #999; }
      @page { size: A5 landscape; margin: 8mm; }
    }
  </style>
</head>
<body>
  <div class="page">
    ${slip(s, "Instructor Copy", logoUrl)}
    <hr class="tear" />
    ${slip(s, "Office Copy", logoUrl)}
  </div>
  <script>
    window.addEventListener('load', function() { setTimeout(function() { window.print(); }, 400); });
  </script>
</body>
</html>`;

  win.document.write(html);
  win.document.close();
}
