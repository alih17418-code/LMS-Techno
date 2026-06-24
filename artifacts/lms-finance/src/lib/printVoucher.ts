import type { Voucher } from "@workspace/api-client-react";

const PKR = (n: number) =>
  "Rs " + n.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const statusColors: Record<string, string> = {
  paid: "#16a34a",
  partial: "#d97706",
  unpaid: "#dc2626",
};

function slip(v: Voucher, copyLabel: string, logoUrl: string): string {
  const receipts = v.receipts ?? [];
  const receiptRows = receipts.length
    ? receipts
        .map(
          (r) => `
          <tr>
            <td>${r.receiptNumber}</td>
            <td>${new Date(r.paymentDate).toLocaleDateString("en-PK")}</td>
            <td style="text-transform:capitalize">${r.paymentMethod.replace("_", " ")}</td>
            <td style="text-align:right;font-weight:600;color:#16a34a">${PKR(r.amountReceived)}</td>
          </tr>`
        )
        .join("")
    : `<tr><td colspan="4" style="text-align:center;color:#888;padding:8px 0">No payments recorded</td></tr>`;

  return `
    <div class="slip">
      <div class="copy-label">${copyLabel}</div>

      <div class="header">
        <div class="header-left">
          <img src="${logoUrl}" alt="TIPS" class="logo" />
        </div>
        <div class="header-right">
          <div class="voucher-title">FEE VOUCHER</div>
          <div class="voucher-meta">${v.monthName} ${v.year}</div>
        </div>
      </div>

      <div class="divider"></div>

      <div class="student-grid">
        <div class="field">
          <span class="field-label">Student Name</span>
          <span class="field-value bold">${v.studentName}</span>
        </div>
        <div class="field">
          <span class="field-label">Student Code</span>
          <span class="field-value mono">${v.studentCode}</span>
        </div>
        <div class="field">
          <span class="field-label">Course</span>
          <span class="field-value">${v.course}</span>
        </div>
        <div class="field">
          <span class="field-label">Period</span>
          <span class="field-value">${v.monthName} ${v.year}</span>
        </div>
      </div>

      <div class="divider"></div>

      <div class="fee-row">
        <div class="fee-box">
          <div class="fee-label">Fee Amount</div>
          <div class="fee-amount">${PKR(v.totalFee)}</div>
        </div>
        <div class="fee-box green">
          <div class="fee-label">Amount Received</div>
          <div class="fee-amount">${PKR(v.totalReceived)}</div>
        </div>
        <div class="fee-box ${v.pendingAmount > 0 ? "red" : "green"}">
          <div class="fee-label">Balance Due</div>
          <div class="fee-amount">${PKR(v.pendingAmount)}</div>
        </div>
        <div class="fee-box status-box" style="border-color:${statusColors[v.status] ?? "#888"}">
          <div class="fee-label">Status</div>
          <div class="status-badge" style="color:${statusColors[v.status] ?? "#888"}">${v.status.toUpperCase()}</div>
        </div>
      </div>

      <div class="receipts-section">
        <div class="section-title">Payment History</div>
        <table class="receipts-table">
          <thead>
            <tr>
              <th>Receipt No</th><th>Date</th><th>Method</th><th style="text-align:right">Amount</th>
            </tr>
          </thead>
          <tbody>${receiptRows}</tbody>
        </table>
      </div>

      <div class="footer">
        <div>Printed: ${new Date().toLocaleString("en-PK")}</div>
        <div>Authorized Signature: _______________________</div>
      </div>
    </div>`;
}

export function printVoucher(v: Voucher): void {
  const logoUrl = `${window.location.origin}/tips-logo.png`;
  const win = window.open("", "_blank", "width=900,height=750");
  if (!win) {
    alert("Please allow popups for this site to print vouchers.");
    return;
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Fee Voucher — ${v.studentName} — ${v.monthName} ${v.year}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 12px;
      color: #1a1a1a;
      background: #f5f5f5;
    }
    .page {
      max-width: 780px;
      margin: 0 auto;
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 0;
    }
    .slip {
      background: #fff;
      padding: 20px 24px;
      border: 1px solid #ddd;
      position: relative;
    }
    .copy-label {
      position: absolute;
      top: 10px;
      right: 14px;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 1px;
      text-transform: uppercase;
      color: #999;
      border: 1px solid #ddd;
      padding: 2px 8px;
      border-radius: 3px;
    }
    .tear {
      border: none;
      border-top: 2px dashed #bbb;
      margin: 0;
      height: 0;
      position: relative;
    }
    .tear::before {
      content: "✂  Cut here";
      position: absolute;
      top: -9px;
      left: 50%;
      transform: translateX(-50%);
      background: #f5f5f5;
      padding: 0 8px;
      font-size: 10px;
      color: #aaa;
      letter-spacing: 1px;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 14px;
    }
    .logo {
      height: 52px;
      width: auto;
      object-fit: contain;
    }
    .header-right { text-align: right; }
    .voucher-title {
      font-size: 15px;
      font-weight: 700;
      color: #1e3a5f;
      letter-spacing: 1px;
    }
    .voucher-meta {
      font-size: 11px;
      color: #666;
      margin-top: 2px;
    }
    .divider {
      border-top: 1px solid #e5e5e5;
      margin: 10px 0;
    }
    .student-grid {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr 1fr;
      gap: 8px 16px;
      margin: 10px 0;
    }
    .field {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .field-label {
      font-size: 9.5px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #888;
      font-weight: 600;
    }
    .field-value {
      font-size: 12px;
      color: #1a1a1a;
    }
    .field-value.bold { font-weight: 700; }
    .field-value.mono { font-family: 'Courier New', monospace; font-weight: 700; color: #1e3a5f; }
    .fee-row {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      margin: 12px 0;
    }
    .fee-box {
      border: 1px solid #e5e5e5;
      border-radius: 6px;
      padding: 8px 10px;
      text-align: center;
    }
    .fee-box.green { border-color: #86efac; background: #f0fdf4; }
    .fee-box.red { border-color: #fca5a5; background: #fff1f2; }
    .fee-box.status-box { display: flex; flex-direction: column; align-items: center; justify-content: center; }
    .fee-label { font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.5px; color: #888; font-weight: 600; margin-bottom: 4px; }
    .fee-amount { font-size: 14px; font-weight: 700; font-family: 'Courier New', monospace; }
    .status-badge { font-size: 14px; font-weight: 800; letter-spacing: 1px; }
    .receipts-section { margin-top: 10px; }
    .section-title { font-size: 10px; text-transform: uppercase; letter-spacing: 0.8px; font-weight: 700; color: #555; margin-bottom: 6px; }
    .receipts-table { width: 100%; border-collapse: collapse; font-size: 11px; }
    .receipts-table th { background: #f5f5f5; padding: 5px 8px; text-align: left; font-weight: 600; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #666; border-bottom: 1px solid #e5e5e5; }
    .receipts-table td { padding: 5px 8px; border-bottom: 1px solid #f0f0f0; }
    .footer { display: flex; justify-content: space-between; margin-top: 14px; font-size: 10px; color: #aaa; padding-top: 10px; border-top: 1px solid #eee; }

    @media print {
      body { background: #fff; }
      .page { padding: 0; max-width: 100%; }
      .slip { border: none; padding: 16px; page-break-inside: avoid; }
      .tear { border-top: 1px dashed #999; }
      @page { size: A4; margin: 10mm; }
    }
  </style>
</head>
<body>
  <div class="page">
    ${slip(v, "Student Copy", logoUrl)}
    <hr class="tear" />
    ${slip(v, "Office Copy", logoUrl)}
  </div>
  <script>
    window.addEventListener('load', function() {
      setTimeout(function() { window.print(); }, 400);
    });
  </script>
</body>
</html>`;

  win.document.write(html);
  win.document.close();
}
