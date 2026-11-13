// Writes docs/razorpay/sample-invoice.pdf: the sample invoice Razorpay asks for when a business
// website is reviewed. Business details match lib/site.ts. Change AMOUNT_RUPEES to a real plan price
// before uploading, and re-run: node scripts/make-sample-invoice.mjs
import { mkdir } from "node:fs/promises";
import { chromium } from "@playwright/test";

const AMOUNT_RUPEES = 1000;
const OUT = "docs/razorpay/sample-invoice.pdf";

const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(AMOUNT_RUPEES);

const html = `<!doctype html>
<html><head><meta charset="utf-8" />
<style>
  body { font-family: Arial, Helvetica, sans-serif; color: #1e1a14; margin: 0; padding: 40px 48px; font-size: 13px; }
  h1 { font-size: 26px; margin: 0 0 4px; font-weight: normal; }
  .muted { color: #5a5145; }
  .row { display: flex; justify-content: space-between; gap: 24px; }
  .block { margin-top: 26px; }
  .label { font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase; color: #8f6514; font-weight: bold; margin-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; margin-top: 10px; }
  th, td { text-align: left; padding: 10px 8px; border-bottom: 1px solid #e5dcc9; }
  th { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #5a5145; }
  td.num, th.num { text-align: right; }
  .total { font-size: 16px; font-weight: bold; }
  .notes { margin-top: 30px; font-size: 12px; color: #5a5145; line-height: 1.6; }
  .tag { display: inline-block; border: 1px solid #8f6514; color: #8f6514; padding: 2px 8px; font-size: 11px; letter-spacing: 1px; }
</style></head>
<body>
  <div class="row">
    <div>
      <div class="label">Tarot by Satakshi</div>
      <h1>Invoice</h1>
      <div class="muted">Sample invoice for the business website review</div>
    </div>
    <div style="text-align:right">
      <span class="tag">SAMPLE</span>
      <div class="block" style="margin-top:12px">
        <div><b>Invoice no.</b> SAMPLE-TBS-0001</div>
        <div><b>Invoice date</b> 11 November 2026</div>
        <div><b>Payment</b> Online, by Razorpay</div>
      </div>
    </div>
  </div>

  <div class="row block">
    <div style="flex:1">
      <div class="label">From</div>
      <div><b>Tarot by Satakshi</b></div>
      <div>Satakshi Kapoor, Founder</div>
      <div>Panchsheel Greens 2, Noida, Uttar Pradesh, India</div>
      <div>+91 92202 19801</div>
      <div>tarotwithsatakshi@gmail.com</div>
    </div>
    <div style="flex:1">
      <div class="label">Billed to</div>
      <div>Client name, as entered when booking</div>
      <div>Client email, as entered when booking</div>
    </div>
  </div>

  <table class="block">
    <thead><tr><th>Description</th><th class="num">Qty</th><th class="num">Amount</th></tr></thead>
    <tbody>
      <tr>
        <td>Tarot reading, 1 hour session by phone call<br/>
            <span class="muted">Booked for Thursday 12 November 2026, 11:00 am IST</span></td>
        <td class="num">1</td>
        <td class="num">${money}</td>
      </tr>
    </tbody>
    <tfoot>
      <tr><td></td><td class="num total">Total paid</td><td class="num total">${money}</td></tr>
    </tfoot>
  </table>

  <div class="block">
    <div><b>Payment reference</b> Razorpay payment ID pay_SAMPLE0000000000</div>
    <div><b>Status</b> Paid</div>
  </div>

  <div class="notes">
    The seller is not registered under GST, so no GST is charged on this invoice.<br/>
    Cancellation and refunds: https://guidancebysatakshi.com/refund-policy<br/>
    Terms and conditions: https://guidancebysatakshi.com/terms<br/>
    Grievance officer: Satakshi Kapoor, Founder, tarotwithsatakshi@gmail.com, +91 92202 19801. We acknowledge every complaint within 48 hours and resolve it within one month.<br/>
    This is a computer-generated invoice and needs no signature.
  </div>
</body></html>`;

await mkdir("docs/razorpay", { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "load" });
  await page.pdf({
    path: OUT,
    format: "A4",
    printBackground: true,
    margin: { top: "0", bottom: "0", left: "0", right: "0" },
  });
  console.log(`wrote ${OUT} (amount ${money})`);
} finally {
  await browser.close();
}
