// Renders the two synthetic sample documents to public/samples/*.png (900×1200).
// Usage: npm run make-samples
// No real logos or branding. Numbers are chosen so the deliberate errors are known:
//  - postpaid: energy charge is ₦2,000 higher than kWh × rate; read type Estimated.
//  - token:    units are ~5% lower than the amount paid implies.
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const RATE = 209.5;

// Postpaid numbers
const KWH = 450;
const ENERGY_CORRECT = KWH * RATE; // 94,275.00
const ENERGY_PRINTED = ENERGY_CORRECT + 2000; // deliberate error
const VAT_POST = Math.round(ENERGY_PRINTED * 0.075 * 100) / 100;
const BBF = 12500;
const PAID = 10000;
const TOTAL = Math.round((BBF + ENERGY_PRINTED + VAT_POST - PAID) * 100) / 100;

// Prepaid numbers
const AMOUNT = 20000;
const DEBT = 1000;
const ENERGY_VALUE = (AMOUNT - DEBT) / 1.075;
const VAT_PRE = Math.round(ENERGY_VALUE * 0.075 * 100) / 100;
const UNITS_CORRECT = (AMOUNT - DEBT - VAT_PRE) / RATE;
const UNITS_PRINTED = Math.round(UNITS_CORRECT * 0.95 * 100) / 100; // ~5% short

const n = (v: number) => v.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const STAMP = `<div class="stamp">SAMPLE — SYNTHETIC TEST DATA</div>`;

const postpaidHtml = `<!doctype html><html><head><style>
  * { box-sizing: border-box; }
  body { margin: 0; width: 900px; height: 1200px; background: #f4f1ea; font-family: Arial, Helvetica, sans-serif; color: #1a1a1a; }
  .page { margin: 30px; height: 1140px; background: #fff; border: 1px solid #bbb; padding: 36px 44px; position: relative; }
  .stamp { background: #c00; color: #fff; font-weight: 800; letter-spacing: 2px; text-align: center; padding: 8px; font-size: 18px; margin: -36px -44px 24px; }
  h1 { font-size: 26px; margin: 0; }
  .sub { color: #555; font-size: 14px; margin-top: 4px; }
  .title { margin-top: 18px; font-size: 22px; font-weight: 800; border-top: 3px solid #1a1a1a; border-bottom: 3px solid #1a1a1a; padding: 8px 0; letter-spacing: 3px; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 16px; }
  td, th { padding: 7px 8px; border-bottom: 1px solid #ddd; text-align: left; }
  th { background: #eee; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; }
  .r { text-align: right; font-family: "Courier New", monospace; font-size: 17px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 30px; margin-top: 16px; font-size: 16px; }
  .k { color: #666; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; }
  .v { font-weight: 700; }
  .total td { font-weight: 800; font-size: 20px; border-top: 3px solid #1a1a1a; }
  .est { display: inline-block; border: 2px solid #c00; color: #c00; padding: 1px 8px; font-weight: 800; }
  .foot { position: absolute; bottom: 30px; left: 44px; right: 44px; font-size: 12px; color: #777; border-top: 1px dashed #aaa; padding-top: 10px; }
</style></head><body><div class="page">
  ${STAMP}
  <h1>Port Harcourt Electricity Distribution (sample)</h1>
  <div class="sub">Customer Service Centre · Not a real bill · For testing CrazyBill only</div>
  <div class="title">ELECTRICITY BILL</div>
  <div class="grid">
    <div><div class="k">Customer name</div><div class="v">SAMPLE CUSTOMER</div></div>
    <div><div class="k">Account number</div><div class="v">8104 2235 9917</div></div>
    <div><div class="k">Service address</div><div class="v">12 Sample Street, D-Line, Port Harcourt (sample)</div></div>
    <div><div class="k">Tariff class</div><div class="v">A-NMD</div></div>
    <div><div class="k">Service band</div><div class="v">Band A</div></div>
    <div><div class="k">Billing period</div><div class="v">September 2026</div></div>
    <div><div class="k">Bill date</div><div class="v">05-Oct-2026</div></div>
    <div><div class="k">Read type</div><div class="v"><span class="est">E — ESTIMATED</span></div></div>
  </div>
  <table>
    <tr><th>Meter readings</th><th class="r">Value</th></tr>
    <tr><td>Previous reading</td><td class="r">18,240</td></tr>
    <tr><td>Present reading (E)</td><td class="r">18,690</td></tr>
    <tr><td>Multiplier</td><td class="r">1</td></tr>
    <tr><td>Consumption (kWh)</td><td class="r">${KWH}</td></tr>
  </table>
  <table>
    <tr><th>Charges</th><th class="r">Amount (₦)</th></tr>
    <tr><td>Balance brought forward</td><td class="r">${n(BBF)}</td></tr>
    <tr><td>Rate (₦/kWh)</td><td class="r">${n(RATE)}</td></tr>
    <tr><td>Energy charge</td><td class="r">${n(ENERGY_PRINTED)}</td></tr>
    <tr><td>VAT (7.5%)</td><td class="r">${n(VAT_POST)}</td></tr>
    <tr><td>Payments received</td><td class="r">(${n(PAID)})</td></tr>
    <tr><td>Adjustments</td><td class="r">0.00</td></tr>
    <tr class="total"><td>TOTAL AMOUNT DUE</td><td class="r">₦${n(TOTAL)}</td></tr>
  </table>
  <div class="foot">SAMPLE — SYNTHETIC TEST DATA. This document was generated for software testing. It is not issued by any electricity company.</div>
</div></body></html>`;

const tokenHtml = `<!doctype html><html><head><style>
  * { box-sizing: border-box; }
  body { margin: 0; width: 900px; height: 1200px; background: #d9d4c7; display: flex; justify-content: center; align-items: flex-start; font-family: "Courier New", Courier, monospace; color: #222; }
  .receipt { margin-top: 60px; width: 440px; background: #fffef9; padding: 26px 26px 40px; box-shadow: 0 6px 18px rgba(0,0,0,.25); font-size: 17px; line-height: 1.45; }
  .stamp { background: #c00; color: #fff; font-family: Arial, sans-serif; font-weight: 800; text-align: center; padding: 6px; font-size: 14px; letter-spacing: 1px; margin: -26px -26px 16px; }
  .c { text-align: center; }
  .b { font-weight: 700; }
  .row { display: flex; justify-content: space-between; gap: 10px; }
  .hr { border-top: 2px dashed #555; margin: 12px 0; }
  .big { font-size: 22px; font-weight: 700; }
</style></head><body><div class="receipt">
  ${STAMP}
  <div class="c b">PORT HARCOURT ELECTRICITY<br>DISTRIBUTION (sample)</div>
  <div class="c">PREPAID VENDING RECEIPT</div>
  <div class="hr"></div>
  <div class="row"><span>Date:</span><span>21/10/2026 14:32</span></div>
  <div class="row"><span>Receipt No:</span><span>SMP-000184</span></div>
  <div class="row"><span>Customer:</span><span>SAMPLE CUSTOMER</span></div>
  <div class="row"><span>Meter No:</span><span>0451****3317</span></div>
  <div class="row"><span>Tariff:</span><span>A-NMD</span></div>
  <div class="row"><span>Band:</span><span>A</span></div>
  <div class="hr"></div>
  <div class="row"><span>Amount Paid:</span><span>N${n(AMOUNT)}</span></div>
  <div class="row"><span>VAT (7.5%):</span><span>N${n(VAT_PRE)}</span></div>
  <div class="row"><span>Debt Recovered:</span><span>N${n(DEBT)}</span></div>
  <div class="row"><span>Rate:</span><span>N${n(RATE)}/kWh</span></div>
  <div class="hr"></div>
  <div class="row big"><span>UNITS:</span><span>${n(UNITS_PRINTED)} kWh</span></div>
  <div class="hr"></div>
  <div class="c b">TOKEN</div>
  <div class="c big">XXXX-XXXX-XXXX-XXXX-XXXX</div>
  <div class="c" style="font-size:13px;margin-top:8px">(token hidden in sample)</div>
  <div class="hr"></div>
  <div class="c" style="font-size:13px">SAMPLE — SYNTHETIC TEST DATA<br>Not issued by any electricity company.</div>
</div></body></html>`;

async function main() {
  mkdirSync("public/samples", { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 900, height: 1200 } });
  for (const [name, html] of [
    ["postpaid-estimated", postpaidHtml],
    ["token-receipt", tokenHtml],
  ] as const) {
    await page.setContent(html, { waitUntil: "load" });
    await page.screenshot({ path: `public/samples/${name}.png`, type: "png" });
    console.log(`wrote public/samples/${name}.png`);
  }
  await browser.close();
  console.log(
    JSON.stringify(
      {
        postpaid: { kWh: KWH, rate: RATE, energyPrinted: ENERGY_PRINTED, energyCorrect: ENERGY_CORRECT, vat: VAT_POST, total: TOTAL },
        token: { amount: AMOUNT, vat: VAT_PRE, debt: DEBT, rate: RATE, unitsPrinted: UNITS_PRINTED, unitsCorrect: Math.round(UNITS_CORRECT * 100) / 100 },
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
