import { formatINR } from '@solar-epc/core';
import { UNIT_LABEL, esc, fmtDate, page } from './styles';
import type { QuotationDoc, SellerDoc } from './types';

const CSS = `
.savings { display: grid; grid-template-columns: 1fr 1fr; gap: 9px; }
.stat { border: 1px solid var(--line); border-radius: 6px; padding: 6px 10px; }
.stat small { color: var(--muted); font-size: 8.5pt; display: block; }
.stat b { font-size: 10.5pt; }
.pagehead { display: flex; justify-content: space-between; align-items: baseline; }
.pagehead .brand { font-size: 13pt; margin: 0; }
ul.plain { list-style: none; }
ul.plain li { padding: 1.5px 0; }
.chips { display: flex; flex-wrap: wrap; gap: 7px; }
.chip { border: 1px solid var(--line); background: #f7f9fb; border-radius: 999px; padding: 3px 11px; }
ol.terms { padding-left: 18px; }
ol.terms li { padding: 1.5px 0; }
.bank { display: flex; justify-content: space-between; gap: 10px; }
.qr { width: 78px; height: 78px; border: 1px dashed #aab3bf; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 7.5pt; color: var(--muted); flex: none; }
.qr img { width: 100%; height: 100%; }
.sign { display: flex; gap: 16px; margin-top: 46px; }
.sign > div { flex: 1; border-top: 1.5px solid var(--ink); padding-top: 5px; font-weight: 600; }
.sign small { display: block; font-weight: 400; color: var(--muted); }
`;

const inr = (v: string, decimals = 0) => (Number(v) < 0 ? `–₹${formatINR(v, { decimals }).slice(1)}` : `₹${formatINR(v, { decimals })}`);
const qty = (v: string) => String(Number(v));

export function sellerHeader(s: SellerDoc, extraLine?: string): string {
  const address = [s.addressLine1, s.addressLine2, `${s.city} – ${s.pincode}`].filter(Boolean).join(', ');
  const line2 = [s.gstin ? `GSTIN: <b>${esc(s.gstin)}</b>` : '', extraLine ?? '', !extraLine && s.phone ? esc(s.phone) : ''].filter(Boolean).join(' · ');
  const line3 = [extraLine && s.phone ? s.phone : '', s.email, s.website].filter(Boolean).map(esc).join(' · ');
  return `<div class="seller">
    <div class="logo">${s.logoUrl ? `<img src="${esc(s.logoUrl)}" alt="">` : 'LOGO'}</div>
    <div><div class="brand">${esc(s.name)}</div><p>${esc(address)}<br>${line2}${line3 ? `<br>${line3}` : ''}</p></div>
  </div>`;
}

export function renderQuotationHtml(d: QuotationDoc): string {
  const b = d.buyer;
  const buyerLines = [
    ...b.addressLines.map(esc),
    `Mobile: ${esc(b.phone)}`,
    b.discomName || b.consumerNumber ? `DISCOM: ${esc(b.discomName ?? '—')} · Consumer No: ${esc(b.consumerNumber ?? '—')}` : '',
    b.sanctionedLoadKw || b.phase ? `Sanctioned load: ${esc(b.sanctionedLoadKw ? `${Number(b.sanctionedLoadKw)} kW` : '—')} · Connection: ${b.phase === 'THREE' ? 'Three' : 'Single'} phase` : '',
  ].filter(Boolean);

  const bom = d.lines.map((l, i) => `<tr><td>${i + 1}</td><td>${esc(l.name)}</td><td>${esc(l.specification ?? '')}</td>
    <td class="num">${qty(l.quantity)}</td><td>${esc(UNIT_LABEL[l.unit] ?? l.unit)}</td>
    ${d.showLinePrices ? `<td class="num">${l.amount ? formatINR(l.amount) : ''}</td>` : ''}</tr>`).join('');

  const s = d.savings;
  const savings = s ? `<h2>Your Savings</h2>
    <div class="savings">
      <div class="stat"><small>Expected generation</small><b>${formatINR(s.annualGenerationKwh, { decimals: 0 })} units/yr</b></div>
      <div class="stat"><small>Bill savings</small><b>${inr(s.annualSavings)}/yr</b></div>
      <div class="stat"><small>Payback period</small><b>${s.paybackYears ? `${Number(s.paybackYears)} years` : '—'}</b></div>
      <div class="stat"><small>25-year savings</small><b>${inr(s.savings25Years)}</b></div>
    </div>
    <p class="muted small" style="margin-top:8px">Estimates based on ${esc(s.unitsPerKwDay ? Number(s.unitsPerKwDay) : '—')} units/kW/day; actual generation varies with weather, shading and orientation.</p>` : '';

  const hasSubsidy = Number(d.subsidyAmount) > 0;
  const summary = `<div class="sum">
      <div class="row"><span>${esc(d.priceLabel)}</span><span>${inr(d.contractValue, 2)}</span></div>
      ${d.taxRows.map((r) => `<div class="row"><span>${esc(r.label)}</span><span>${inr(r.amount, 2)}</span></div>`).join('')}
      ${Number(d.roundOff) !== 0 ? `<div class="row"><span>Round off</span><span>${inr(d.roundOff, 2)}</span></div>` : ''}
      <div class="row ${hasSubsidy ? 'strong' : 'final'}"><span>Total incl. GST</span><span>${inr(d.total, 2)}</span></div>
      ${hasSubsidy ? `<div class="row"><span>Less: ${esc(d.subsidyName ?? 'Subsidy')}*</span><span>– ${inr(d.subsidyAmount)}</span></div>
      <div class="row final"><span>Effective cost to you</span><span>${inr(d.netCost)}</span></div>` : ''}
    </div>`;

  const page1 = `<section class="page">
    <div class="head">
      ${sellerHeader(d.seller)}
      <div><div class="doc-title">QUOTATION</div>
        <table class="meta">
          <tr><td>Quote No.</td><td>${esc(d.number)} · v${d.version}</td></tr>
          <tr><td>Date</td><td>${fmtDate(d.date)}</td></tr>
          <tr><td>Valid till</td><td>${fmtDate(d.validUntil)}</td></tr>
        </table></div>
    </div>
    <div class="rule"></div>
    <div class="cols">
      <div class="box"><div class="label">Quotation for</div><div class="title">${esc(b.name)}</div>${buyerLines.map((l) => `<div>${l}</div>`).join('')}</div>
      <div class="box tint"><div class="label">Proposed system</div><div class="title">${esc(d.system.title)}</div>${d.system.details.map((l) => `<div>${esc(l)}</div>`).join('')}</div>
    </div>
    <h2>Bill of Materials</h2>
    <table class="grid">
      <thead><tr><th style="width:6%">#</th><th style="width:${d.showLinePrices ? 26 : 31}%">Item</th><th>Specification / Make</th><th class="num" style="width:9%">Qty</th><th style="width:9%">Unit</th>${d.showLinePrices ? '<th class="num" style="width:15%">Amount (₹)</th>' : ''}</tr></thead>
      <tbody>${bom}</tbody>
    </table>
    <div class="cols" style="margin-top:6px; align-items:flex-start">
      <div>${savings}</div>
      <div style="margin-top:14px">${summary}</div>
    </div>
    <div class="foot"><span>${hasSubsidy ? "*Subsidy is credited by the government directly to the customer's bank account after commissioning, subject to approval." : ''}</span><span style="white-space:nowrap">Page 1 of 2</span></div>
  </section>`;

  const list = (items: string[]) => `<ul class="plain">${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`;
  const se = d.seller;
  const milestoneTotal = d.milestones.reduce((a, x) => a + Number(x.percent), 0);
  const page2 = `<section class="page">
    <div class="pagehead"><div class="brand">${esc(se.name)}</div><div class="small">Quotation <b>${esc(d.number)} · v${d.version}</b> · ${esc(b.name)}</div></div>
    <div class="rule" style="margin-top:8px"></div>
    <div class="cols">
      <div>${d.milestones.length ? `<h2 style="margin-top:0">Payment Schedule</h2>
        <table class="grid"><thead><tr><th>Milestone</th><th class="num">Share</th><th class="num">Amount</th></tr></thead><tbody>
        ${d.milestones.map((x) => `<tr><td>${esc(x.label)}</td><td class="num">${Number(x.percent)}%</td><td class="num">${inr(x.amount)}</td></tr>`).join('')}
        <tr class="total"><td>Total</td><td class="num">${milestoneTotal}%</td><td class="num">${inr(d.total)}</td></tr></tbody></table>` : ''}</div>
      <div>${d.warranty.length ? `<h2 style="margin-top:0">Warranty</h2>
        <table class="grid"><thead><tr><th>Component</th><th>Coverage</th></tr></thead><tbody>
        ${d.warranty.map((w) => `<tr><td>${esc(w.component)}</td><td>${esc(w.coverage)}</td></tr>`).join('')}</tbody></table>` : ''}</div>
    </div>
    <div class="cols" style="margin-top:16px">
      <div class="box"><div class="label">Included in scope</div>${list(d.scopeIncluded)}</div>
      <div class="box"><div class="label">Not included</div>${list(d.scopeExcluded)}</div>
    </div>
    ${d.documentsRequired.length ? `<h2>Documents Required from Customer</h2><div class="chips">${d.documentsRequired.map((x) => `<span class="chip">${esc(x)}</span>`).join('')}</div>` : ''}
    ${d.terms.length ? `<h2>Terms &amp; Conditions</h2><ol class="terms">${d.terms.map((t) => `<li>${esc(t)}</li>`).join('')}</ol>` : ''}
    ${d.notes ? `<p class="small" style="margin-top:8px"><b>Note:</b> ${esc(d.notes)}</p>` : ''}
    <div class="cols" style="margin-top:16px">
      <div class="box bank"><div><div class="label">Bank details</div>
        <div>Account name: ${esc(se.accountName ?? se.name)}</div>
        <div>Bank: ${esc([se.bankName, se.bankBranch].filter(Boolean).join(', ') || '—')}</div>
        <div>A/c No: ${esc(se.accountNumber ?? '—')}</div><div>IFSC: ${esc(se.ifsc ?? '—')}</div><div>UPI: ${esc(se.upiId ?? '—')}</div></div>
        <div class="qr">${d.upiQrDataUrl ? `<img src="${d.upiQrDataUrl}" alt="UPI QR">` : 'UPI QR'}</div></div>
      <div class="box"><div class="label">Acceptance</div>
        <div class="sign"><div>Customer signature<small>Date: ________</small></div><div>Authorised signatory<small>For ${esc(se.name)}</small></div></div></div>
    </div>
    <div class="foot"><span>${[se.name, se.phone, se.email].filter(Boolean).map(esc).join(' · ')}</span><span>Page 2 of 2</span></div>
  </section>`;

  return page(`Quotation ${d.number} v${d.version}`, CSS, page1 + page2);
}
