import { formatINR, stateLabel } from '@solar-epc/core';
import { sellerHeader } from './quotation';
import { esc, fmtDate, page } from './styles';
import type { InvoiceDoc } from './types';

const CSS = `
.copy { display: inline-block; margin-top: 7px; border: 1.5px solid var(--ink); border-radius: 4px; padding: 2px 9px; font-size: 8.5pt; font-weight: 700; }
.info { display: grid; grid-template-columns: repeat(3, 1fr); gap: 9px 16px; margin: 14px 0 12px; }
.info small { color: var(--muted); display: block; font-size: 8.5pt; }
.info b { font-size: 9.5pt; }
table.grid td b { display: block; }
table.grid td .muted { font-size: 8.5pt; }
.bottom { display: grid; grid-template-columns: 1.2fr 1fr 1fr; gap: 12px; margin-top: 14px; }
.qr { width: 62px; height: 62px; border: 1px dashed #aab3bf; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 7.5pt; color: var(--muted); flex: none; }
.qr img { width: 100%; height: 100%; }
.signline { border-top: 1.5px solid var(--ink); margin-top: 40px; padding-top: 5px; color: var(--muted); font-size: 9pt; }
`;

const n = (v: string) => formatINR(v);
const inr = (v: string) => (Number(v) < 0 ? `–₹${formatINR(v).slice(1)}` : `₹${formatINR(v)}`);
const pc = (v: string) => `${Number(v)}%`;

export function renderInvoiceHtml(d: InvoiceDoc): string {
  const s = d.seller;
  const taxHead = d.isInterState ? '<th class="num" style="width:12%">IGST</th>' : '<th class="num" style="width:11%">CGST</th><th class="num" style="width:11%">SGST</th>';
  const rows = d.lines.map((l, i) => `<tr><td>${i + 1}</td>
      <td><b>${esc(l.description)}</b>${l.detail ? `<span class="muted">${esc(l.detail)}</span>` : ''}</td>
      <td>${esc(l.hsnSac)}</td><td class="num">${n(l.taxableValue)}</td><td class="num">${pc(l.gstRate)}</td>
      ${d.isInterState ? `<td class="num">${n(l.igst)}</td>` : `<td class="num">${n(l.cgst)}</td><td class="num">${n(l.sgst)}</td>`}
      <td class="num">${n(l.total)}</td></tr>`).join('');
  const gross = d.lines.reduce((a, l) => a + Number(l.total), 0).toFixed(2);
  const totalRow = `<tr class="total"><td></td><td colspan="2">Total</td><td class="num">${n(d.taxableValue)}</td><td></td>
      ${d.isInterState ? `<td class="num">${n(d.igst)}</td>` : `<td class="num">${n(d.cgst)}</td><td class="num">${n(d.sgst)}</td>`}
      <td class="num">${n(gross)}</td></tr>`;

  const body = `<section class="page">
    ${d.isDraft ? '<div class="draft">DRAFT</div>' : ''}
    <div class="head">
      ${sellerHeader(s, `State: ${esc(stateLabel(s.stateCode))}`)}
      <div style="text-align:right"><div class="doc-title">${esc(d.title)}</div>${d.copyLabel ? `<span class="copy">${esc(d.copyLabel)}</span>` : ''}</div>
    </div>
    <div class="box tint info">
      <div><small>Invoice No.</small><b>${esc(d.number ?? 'Draft – not issued')}</b></div>
      <div><small>Invoice date</small><b>${fmtDate(d.issueDate)}</b></div>
      <div><small>Place of supply</small><b>${esc(stateLabel(d.placeOfSupplyStateCode))}</b></div>
      <div><small>Against quotation</small><b>${esc(d.quotationNumber ?? '—')}</b></div>
      <div><small>${d.dueDate && !d.milestoneLabel ? 'Due date' : 'Milestone'}</small><b>${d.dueDate && !d.milestoneLabel ? fmtDate(d.dueDate) : esc(d.milestoneLabel ?? '—')}</b></div>
      <div><small>Reverse charge</small><b>${d.reverseCharge ? 'Yes' : 'No'}</b></div>
    </div>
    <div class="cols">
      <div class="box"><div class="label">Billed to</div><div class="title">${esc(d.buyer.name)}</div>
        <div>${esc(d.buyer.addressLine)}</div><div>GSTIN: ${esc(d.buyer.gstin ?? 'Unregistered')}</div>
        <div>State: ${esc(stateLabel(d.buyer.stateCode))}${d.buyer.phone ? ` · Mobile: ${esc(d.buyer.phone)}` : ''}</div></div>
      ${d.site ? `<div class="box"><div class="label">Installation site</div><div class="title">${esc(d.site.title)}</div>
        <div>${esc(d.site.addressLine)}</div>
        ${d.site.discomName || d.site.consumerNumber ? `<div>DISCOM: ${esc(d.site.discomName ?? '—')} · Consumer No: ${esc(d.site.consumerNumber ?? '—')}</div>` : ''}</div>` : '<div></div>'}
    </div>
    <table class="grid" style="margin-top:16px">
      <thead><tr><th style="width:4%">#</th><th>Description</th><th style="width:9%">HSN/SAC</th><th class="num" style="width:14%">Taxable value</th><th class="num" style="width:6%">GST</th>${taxHead}<th class="num" style="width:14%">Amount</th></tr></thead>
      <tbody>${rows}${totalRow}</tbody>
    </table>
    <div class="cols" style="margin-top:16px; align-items:flex-start">
      <div><div class="muted small">Amount in words</div><div style="font-weight:700">${esc(d.amountInWords)}</div>
        ${d.note ? `<p class="muted small" style="margin-top:9px">${esc(d.note)}</p>` : ''}</div>
      <div class="sum">
        <div class="row"><span>Taxable value</span><span>${inr(d.taxableValue)}</span></div>
        ${d.isInterState ? `<div class="row"><span>IGST</span><span>${inr(d.igst)}</span></div>`
          : `<div class="row"><span>CGST</span><span>${inr(d.cgst)}</span></div><div class="row"><span>SGST</span><span>${inr(d.sgst)}</span></div>`}
        <div class="row"><span>Round off</span><span>${inr(d.roundOff)}</span></div>
        <div class="row final"><span>Invoice total</span><span>${inr(d.total)}</span></div>
        ${d.showPayments ? `<div class="row"><span>Received to date</span><span>${inr(d.amountPaid)}</span></div>
        ${Number(d.credited) > 0 ? `<div class="row"><span>Credit notes</span><span>– ${inr(d.credited)}</span></div>` : ''}
        <div class="row" style="font-weight:700"><span>Balance due</span><span>${inr(d.balanceDue)}</span></div>` : ''}
      </div>
    </div>
    <div class="bottom">
      <div class="box"><div class="label">Bank details</div>
        <div>Bank: ${esc([s.bankName, s.bankBranch].filter(Boolean).join(', ') || '—')}</div>
        <div>A/c No: ${esc(s.accountNumber ?? '—')}</div><div>IFSC: ${esc(s.ifsc ?? '—')}</div><div>UPI: ${esc(s.upiId ?? '—')}</div></div>
      <div class="box" style="display:flex; justify-content:space-between; gap:8px"><div><div class="label">E-invoice</div><div class="muted small">IRN</div>
        <div class="small" style="word-break:break-all">${esc(d.irn ?? 'Not applicable')}</div></div>
        <div class="qr">${d.signedQrDataUrl ? `<img src="${d.signedQrDataUrl}" alt="QR">` : 'QR'}</div></div>
      <div class="box"><b>For ${esc(s.name)}</b><div class="signline">Authorised signatory</div></div>
    </div>
    <p class="muted small" style="margin-top:12px">Declaration: We declare that this invoice shows the actual price of the goods and services described and that all particulars are true and correct.${s.jurisdiction ? ` Subject to ${esc(s.jurisdiction)} jurisdiction.` : ''}</p>
    <div class="foot" style="border-top:1px solid var(--line)"><span>${[s.name, s.phone, s.email].filter(Boolean).map(esc).join(' · ')}</span><span>${d.title === 'TAX INVOICE' ? 'This is a computer-generated invoice.' : 'This is not a tax invoice.'}</span></div>
  </section>`;
  return page(`${d.title} ${d.number ?? 'draft'}`, CSS, body);
}
