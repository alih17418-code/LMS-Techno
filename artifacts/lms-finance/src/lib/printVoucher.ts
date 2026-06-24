import type { Voucher } from "@workspace/api-client-react";

const PKR = (n: number) =>
  "Rs " + n.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const statusColors: Record<string, string> = {
  paid: "#15803d",
  partial: "#b45309",
  unpaid: "#b91c1c",
};

const statusBg: Record<string, string> = {
  paid: "#dcfce7",
  partial: "#fef3c7",
  unpaid: "#fee2e2",
};

function slip(v: Voucher, copyLabel: string, logoUrl: string): string {
  const receipts = v.receipts ?? [];
  const receiptRows = receipts.length
    ? receipts
        .map(
          (r) => `
          <tr>
            <td style="padding:5px 8px;border-bottom:1px solid #f0f0f0;font-family:monospace;font-size:11px">${r.receiptNumber}</td>
            <td style="padding:5px 8px;border-bottom:1px solid #f0f0f0;font-size:11px">${new Date(r.paymentDate).toLocaleDateString("en-PK")}</td>
            <td style="padding:5px 8px;border-bottom:1px solid #f0f0f0;font-size:11px;text-transform:capitalize">${r.paymentMethod.replace("_", " ")}</td>
            <td style="padding:5px 8px;border-bottom:1px solid #f0f0f0;text-align:right;font-weight:700;color:#15803d;font-family:monospace;font-size:11px">${PKR(r.amountReceived)}</td>
          </tr>`
        )
        .join("")
    : `<tr><td colspan="4" style="text-align:center;color:#aaa;padding:10px 0;font-size:11px;font-style:italic">No payments recorded yet</td></tr>`;

  const statusColor = statusColors[v.status] ?? "#555";
  const statusBgColor = statusBg[v.status] ?? "#f5f5f5";

  return `
    <div class="slip">
      <!-- Header bar -->
      <div class="header-bar">
        <div class="header-left">
          <img src="${logoUrl}" alt="TIPS" class="logo" onerror="this.style.display='none'" />
          <div class="org-info">
            <div class="org-name">Technospyre Institute of Professional Studies</div>
            <div class="org-tagline">Quality Education · Professional Growth</div>
          </div>
        </div>
        <div class="header-right">
          <div class="voucher-badge">
            <div class="voucher-title">FEE VOUCHER</div>
            <div class="voucher-period">${v.monthName} ${v.year}</div>
          </div>
        </div>
      </div>

      <!-- Copy label + voucher ID -->
      <div class="meta-row">
        <div class="copy-chip">${copyLabel}</div>
        <div class="voucher-id">Voucher #${v.id}</div>
        <div class="print-date">Printed: ${new Date().toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" })}</div>
      </div>

      <!-- Student info -->
      <div class="info-grid">
        <div class="info-cell wide">
          <div class="info-label">Student Name</div>
          <div class="info-value bold">${v.studentName}</div>
        </div>
        <div class="info-cell">
          <div class="info-label">Student Code</div>
          <div class="info-value mono">${v.studentCode}</div>
        </div>
        <div class="info-cell wide">
          <div class="info-label">Course / Program</div>
          <div class="info-value">${v.course}</div>
        </div>
        <div class="info-cell">
          <div class="info-label">Fee Period</div>
          <div class="info-value">${v.monthName} ${v.year}</div>
        </div>
      </div>

      <!-- Fee summary boxes -->
      <div class="fee-row">
        <div class="fee-box neutral">
          <div class="fee-box-label">Fee Amount</div>
          <div class="fee-box-value">${PKR(v.totalFee)}</div>
        </div>
        <div class="fee-box green">
          <div class="fee-box-label">Amount Received</div>
          <div class="fee-box-value">${PKR(v.totalReceived)}</div>
        </div>
        <div class="fee-box ${v.pendingAmount > 0 ? "red" : "green"}">
          <div class="fee-box-label">Balance Due</div>
          <div class="fee-box-value">${PKR(v.pendingAmount)}</div>
        </div>
        <div class="fee-box status" style="background:${statusBgColor};border-color:${statusColor}">
          <div class="fee-box-label">Status</div>
          <div class="status-text" style="color:${statusColor}">${v.status.toUpperCase()}</div>
        </div>
      </div>

      <!-- Payment history -->
      <div class="payments-section">
        <div class="section-heading">Payment History</div>
        <table class="payments-table">
          <thead>
            <tr>
              <th style="text-align:left;padding:5px 8px;border-bottom:2px solid #e5e5e5;font-size:9.5px;text-transform:uppercase;letter-spacing:0.5px;color:#666;font-weight:700">Receipt No</th>
              <th style="text-align:left;padding:5px 8px;border-bottom:2px solid #e5e5e5;font-size:9.5px;text-transform:uppercase;letter-spacing:0.5px;color:#666;font-weight:700">Date</th>
              <th style="text-align:left;padding:5px 8px;border-bottom:2px solid #e5e5e5;font-size:9.5px;text-transform:uppercase;letter-spacing:0.5px;color:#666;font-weight:700">Method</th>
              <th style="text-align:right;padding:5px 8px;border-bottom:2px solid #e5e5e5;font-size:9.5px;text-transform:uppercase;letter-spacing:0.5px;color:#666;font-weight:700">Amount</th>
            </tr>
          </thead>
          <tbody>${receiptRows}</tbody>
        </table>
      </div>

      <!-- Footer -->
      <div class="slip-footer">
        <div class="sig-box">
          <div class="sig-line"></div>
          <div class="sig-label">Student / Parent Signature</div>
        </div>
        <div class="sig-box">
          <div class="sig-line"></div>
          <div class="sig-label">Cashier / Accounts Officer</div>
        </div>
      </div>
    </div>`;
}

export function printVoucher(v: Voucher): void {
  const logoUrl = `${window.location.origin}/tips-logo.png`;
  const win = window.open("", "_blank", "width=860,height=900");
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
      background: #e8e8e8;
    }

    .page {
      max-width: 740px;
      margin: 16px auto;
      display: flex;
      flex-direction: column;
      gap: 0;
      background: #fff;
      border: 1px solid #ccc;
    }

    /* ── Single slip ────────────────────────────── */
    .slip {
      padding: 18px 22px 14px;
      background: #fff;
    }

    /* Header */
    .header-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
      padding-bottom: 10px;
      border-bottom: 2px solid #1e3a5f;
    }
    .header-left { display: flex; align-items: center; gap: 10px; }
    .logo { height: 44px; width: auto; object-fit: contain; }
    .org-name { font-size: 13px; font-weight: 700; color: #1e3a5f; line-height: 1.2; }
    .org-tagline { font-size: 9px; color: #888; margin-top: 2px; letter-spacing: 0.4px; }
    .header-right { text-align: right; }
    .voucher-badge {
      background: #1e3a5f;
      color: #fff;
      padding: 6px 14px;
      border-radius: 4px;
      text-align: center;
    }
    .voucher-title { font-size: 13px; font-weight: 800; letter-spacing: 2px; }
    .voucher-period { font-size: 10px; opacity: 0.85; margin-top: 1px; letter-spacing: 0.5px; }

    /* Meta row */
    .meta-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 8px 0;
      font-size: 10px;
      color: #888;
    }
    .copy-chip {
      background: #f0f4ff;
      color: #1e3a5f;
      border: 1px solid #c7d4f0;
      padding: 2px 10px;
      border-radius: 20px;
      font-weight: 700;
      font-size: 9.5px;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    .voucher-id { font-weight: 700; color: #444; font-family: monospace; }
    .print-date { margin-left: auto; }

    /* Student info grid */
    .info-grid {
      display: grid;
      grid-template-columns: 2fr 1fr 2fr 1fr;
      gap: 6px 14px;
      background: #f7f9fc;
      border: 1px solid #e8edf5;
      border-radius: 6px;
      padding: 10px 14px;
      margin: 8px 0;
    }
    .info-cell {}
    .info-cell.wide {}
    .info-label {
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      color: #999;
      font-weight: 700;
      margin-bottom: 2px;
    }
    .info-value { font-size: 12px; color: #1a1a1a; }
    .info-value.bold { font-weight: 700; }
    .info-value.mono { font-family: 'Courier New', monospace; font-weight: 700; color: #1e3a5f; font-size: 12px; }

    /* Fee boxes */
    .fee-row {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 7px;
      margin: 8px 0;
    }
    .fee-box {
      border: 1px solid #e5e5e5;
      border-radius: 6px;
      padding: 8px 10px;
      text-align: center;
    }
    .fee-box.neutral { background: #f9f9f9; }
    .fee-box.green { background: #f0fdf4; border-color: #86efac; }
    .fee-box.red { background: #fff1f2; border-color: #fca5a5; }
    .fee-box.status { display: flex; flex-direction: column; align-items: center; justify-content: center; }
    .fee-box-label {
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #888;
      font-weight: 700;
      margin-bottom: 4px;
    }
    .fee-box-value {
      font-size: 13px;
      font-weight: 800;
      font-family: 'Courier New', monospace;
      color: #1a1a1a;
    }
    .fee-box.green .fee-box-value { color: #15803d; }
    .fee-box.red .fee-box-value { color: #b91c1c; }
    .status-text { font-size: 13px; font-weight: 900; letter-spacing: 1.5px; }

    /* Payment history */
    .payments-section { margin: 8px 0 6px; }
    .section-heading {
      font-size: 9.5px;
      text-transform: uppercase;
      letter-spacing: 1px;
      font-weight: 700;
      color: #666;
      margin-bottom: 5px;
      padding-bottom: 4px;
      border-bottom: 1px solid #e5e5e5;
    }
    .payments-table { width: 100%; border-collapse: collapse; }

    /* Footer */
    .slip-footer {
      display: flex;
      justify-content: space-between;
      gap: 30px;
      margin-top: 10px;
      padding-top: 8px;
      border-top: 1px solid #eee;
    }
    .sig-box { flex: 1; }
    .sig-line {
      border-bottom: 1px solid #aaa;
      margin-bottom: 4px;
      height: 20px;
    }
    .sig-label { font-size: 9px; color: #999; text-align: center; letter-spacing: 0.3px; }

    /* Cut line between copies */
    .cut-line {
      border: none;
      border-top: 1.5px dashed #bbb;
      position: relative;
      margin: 0;
    }
    .cut-line::before {
      content: "✂  tear here";
      position: absolute;
      top: -8px;
      left: 50%;
      transform: translateX(-50%);
      background: #e8e8e8;
      padding: 0 10px;
      font-size: 9px;
      color: #aaa;
      letter-spacing: 1px;
      font-family: Arial, sans-serif;
    }

    @media print {
      body { background: #fff; }
      .page {
        margin: 0;
        max-width: 100%;
        border: none;
        border-radius: 0;
      }
      .slip { padding: 14px 18px 12px; }
      .cut-line { border-top: 1.5px dashed #999; }
      .cut-line::before { background: #fff; }
      @page { size: A4; margin: 10mm; }
    }
  </style>
</head>
<body>
  <div class="page">
    ${slip(v, "Student Copy", logoUrl)}
    <hr class="cut-line" />
    ${slip(v, "Office Copy", logoUrl)}
  </div>
  <script>
    window.addEventListener('load', function() {
      setTimeout(function() { window.print(); }, 500);
    });
  </script>
</body>
</html>`;

  win.document.write(html);
  win.document.close();
}
