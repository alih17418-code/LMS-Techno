import type { Voucher } from "@workspace/api-client-react";

const PKR = (n: number) =>
  "Rs. " + n.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const COPY_LABELS = ["Bank Copy", "Student Copy", "Office Copy"];

function slip(v: Voucher, copyLabel: string, logoUrl: string): string {
  return `
    <div class="slip">
      <!-- Copy label chip -->
      <div class="copy-chip">${copyLabel}</div>

      <!-- Logo + Institute -->
      <div class="header">
        <img src="${logoUrl}" alt="TIPS" class="logo" onerror="this.style.display='none'" />
        <div class="inst-name">Technospyre Institute</div>
        <div class="inst-sub">of Professional Studies</div>
      </div>

      <div class="divider"></div>

      <!-- Title + Period -->
      <div class="voucher-title">FEE VOUCHER</div>
      <div class="voucher-period">${v.monthName} ${v.year}</div>

      <div class="divider"></div>

      <!-- Student details -->
      <div class="field-row">
        <span class="f-label">Name</span>
        <span class="f-value bold">${v.studentName}</span>
      </div>
      <div class="field-row">
        <span class="f-label">Student Code</span>
        <span class="f-value mono">${v.studentCode}</span>
      </div>
      <div class="field-row">
        <span class="f-label">Voucher #</span>
        <span class="f-value mono">${v.id}</span>
      </div>
      <div class="field-row">
        <span class="f-label">Course</span>
        <span class="f-value">${v.course}</span>
      </div>

      <div class="divider"></div>

      <!-- Fee breakdown -->
      <div class="fee-block">
        <div class="fee-row-item">
          <span class="fee-label">Total Fee</span>
          <span class="fee-amount">${PKR(v.totalFee)}</span>
        </div>
        ${v.totalReceived > 0 ? `
        <div class="fee-row-item received">
          <span class="fee-label">Received</span>
          <span class="fee-amount">${PKR(v.totalReceived)}</span>
        </div>` : ""}
        <div class="payable-box">
          <div class="payable-label">Payable Amount</div>
          <div class="payable-amount">${PKR(v.pendingAmount > 0 ? v.pendingAmount : v.totalFee)}</div>
        </div>
      </div>

      <div class="divider"></div>

      <!-- Stamp + Signature -->
      <div class="bottom-section">
        <div class="stamp-box">
          <span class="stamp-label">Official Stamp</span>
        </div>
        <div class="sig-area">
          <div class="sig-line"></div>
          <div class="sig-label">Cashier Sign</div>
        </div>
      </div>

      <!-- Status badge at bottom -->
      <div class="status-row status-${v.status}">${v.status.toUpperCase()}</div>
    </div>`;
}

export function printVoucher(v: Voucher): void {
  const logoUrl = `${window.location.origin}/tips-logo.png`;
  const win = window.open("", "_blank", "width=1050,height=680");
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
      font-size: 11px;
      color: #111;
      background: #ccc;
    }

    /* ── Page — 3 slips side by side ──────────── */
    .page {
      display: flex;
      flex-direction: row;
      align-items: stretch;
      gap: 0;
      max-width: 900px;
      margin: 20px auto;
      background: #fff;
      border: 1px solid #bbb;
    }

    /* ── Dashed cut lines between slips ─────────── */
    .cut-v {
      width: 0;
      border-left: 1.5px dashed #bbb;
      position: relative;
    }
    .cut-v::before {
      content: "✂";
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      font-size: 13px;
      color: #aaa;
      background: #fff;
      padding: 4px 0;
      writing-mode: vertical-rl;
      letter-spacing: 2px;
    }

    /* ── Single slip ──────────────────────────── */
    .slip {
      flex: 1;
      padding: 14px 12px 12px;
      display: flex;
      flex-direction: column;
      gap: 0;
      min-width: 0;
    }

    /* Copy chip */
    .copy-chip {
      font-size: 8.5px;
      font-weight: 700;
      letter-spacing: 1px;
      text-transform: uppercase;
      color: #1e3a5f;
      border: 1px solid #1e3a5f33;
      background: #f0f4ff;
      padding: 2px 7px;
      border-radius: 20px;
      width: fit-content;
      margin-bottom: 8px;
    }

    /* Header */
    .header {
      text-align: center;
      margin-bottom: 6px;
    }
    .logo {
      height: 38px;
      width: auto;
      object-fit: contain;
      display: block;
      margin: 0 auto 4px;
    }
    .inst-name {
      font-size: 10.5px;
      font-weight: 700;
      color: #1e3a5f;
      line-height: 1.2;
    }
    .inst-sub {
      font-size: 8.5px;
      color: #888;
      margin-top: 1px;
    }

    /* Divider */
    .divider {
      border-top: 1px solid #e0e0e0;
      margin: 6px 0;
    }

    /* Title */
    .voucher-title {
      text-align: center;
      font-size: 12px;
      font-weight: 900;
      letter-spacing: 2px;
      color: #1e3a5f;
      text-transform: uppercase;
    }
    .voucher-period {
      text-align: center;
      font-size: 9.5px;
      color: #666;
      margin-top: 2px;
      letter-spacing: 0.5px;
    }

    /* Field rows */
    .field-row {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 4px;
      padding: 2.5px 0;
    }
    .f-label {
      font-size: 9px;
      color: #888;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      font-weight: 600;
      white-space: nowrap;
      flex-shrink: 0;
    }
    .f-value {
      font-size: 10.5px;
      color: #111;
      text-align: right;
      word-break: break-word;
    }
    .f-value.bold { font-weight: 700; }
    .f-value.mono { font-family: 'Courier New', monospace; font-weight: 700; color: #1e3a5f; }

    /* Fee block */
    .fee-block {
      margin: 4px 0;
    }
    .fee-row-item {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      padding: 2px 0;
    }
    .fee-row-item.received .fee-amount { color: #15803d; }
    .fee-label {
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      color: #888;
      font-weight: 600;
    }
    .fee-amount {
      font-family: 'Courier New', monospace;
      font-size: 11px;
      font-weight: 700;
      color: #111;
    }

    /* Payable box — prominent */
    .payable-box {
      background: #1e3a5f;
      color: #fff;
      border-radius: 5px;
      padding: 7px 10px;
      margin-top: 6px;
      text-align: center;
    }
    .payable-label {
      font-size: 8.5px;
      letter-spacing: 1px;
      text-transform: uppercase;
      opacity: 0.8;
      margin-bottom: 3px;
    }
    .payable-amount {
      font-family: 'Courier New', monospace;
      font-size: 15px;
      font-weight: 900;
      letter-spacing: 0.5px;
    }

    /* Bottom: stamp + signature */
    .bottom-section {
      display: flex;
      gap: 6px;
      margin: 6px 0 4px;
      align-items: flex-end;
    }
    .stamp-box {
      flex: 1;
      height: 52px;
      border: 1.5px dashed #bbb;
      border-radius: 4px;
      display: flex;
      align-items: flex-end;
      justify-content: center;
      padding-bottom: 4px;
    }
    .stamp-label {
      font-size: 8px;
      color: #ccc;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .sig-area {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      gap: 3px;
    }
    .sig-line {
      border-bottom: 1px solid #aaa;
      height: 36px;
    }
    .sig-label {
      font-size: 8px;
      color: #aaa;
      text-align: center;
      letter-spacing: 0.3px;
    }

    /* Status badge */
    .status-row {
      text-align: center;
      font-size: 9px;
      font-weight: 800;
      letter-spacing: 1.5px;
      padding: 3px 0 0;
    }
    .status-paid { color: #15803d; }
    .status-partial { color: #b45309; }
    .status-unpaid { color: #b91c1c; }

    /* ── Print ──────────────────────────── */
    @media print {
      body { background: #fff; }
      .page { margin: 0; max-width: 100%; border: none; }
      .slip { padding: 10px 10px 8px; }
      .cut-v { border-left: 1.5px dashed #999; }
      .cut-v::before { background: #fff; }
      @page { size: A4 landscape; margin: 8mm; }
    }
  </style>
</head>
<body>
  <div class="page">
    ${slip(v, COPY_LABELS[0], logoUrl)}
    <div class="cut-v"></div>
    ${slip(v, COPY_LABELS[1], logoUrl)}
    <div class="cut-v"></div>
    ${slip(v, COPY_LABELS[2], logoUrl)}
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
