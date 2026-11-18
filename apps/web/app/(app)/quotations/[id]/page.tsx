'use client';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { Badge, Button, Card, ErrorText, Loading, Modal, PageHeader, Field, Select, Input, Table } from '@/components/ui';
import { api, openDocument } from '@/lib/api';
import { useCan } from '@/lib/auth';
import { UNIT_LABEL, fmtDate, inr } from '@/lib/format';
import { useAction, useApi } from '@/lib/useApi';

function InvoiceModal({ quotation, onClose }: { quotation: any; onClose: () => void }) {
  const router = useRouter();
  const [type, setType] = useState('TAX_INVOICE');
  const [milestoneLabel, setMilestoneLabel] = useState('');
  const { busy, error, run } = useAction();
  const v = quotation.versions[0];
  return (
    <Modal title="Create invoice" onClose={onClose}>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); run(async () => { const inv = await api.post('/invoices', { quotationId: quotation.id, version: v.version, type, milestoneLabel }); router.push(`/invoices/${inv.id}`); }); }}>
        <p className="text-sm text-muted">From {quotation.number} v{v.version}: contract value {inr(v.contractValue)}. The invoice starts as a draft; it gets its number when you issue it.</p>
        <Field label="Invoice type"><Select value={type} onChange={(e) => setType(e.target.value)}><option value="TAX_INVOICE">Tax invoice</option><option value="PROFORMA">Proforma invoice</option></Select></Field>
        <Field label="Milestone (optional)" hint="Printed on the invoice, e.g. Final / On commissioning"><Input value={milestoneLabel} onChange={(e) => setMilestoneLabel(e.target.value)} /></Field>
        {type === 'TAX_INVOICE' && quotation.status !== 'CONVERTED' && <p className="text-xs text-muted">Creating a tax invoice marks this quotation as converted; it can no longer be revised.</p>}
        <ErrorText>{error}</ErrorText>
        <div className="flex justify-end"><Button type="submit" disabled={busy}>Create draft invoice</Button></div>
      </form>
    </Modal>
  );
}

export default function QuotationPage() {
  const { id } = useParams<{ id: string }>();
  const { data: q, error, loading, reload } = useApi(`/quotations/${id}`);
  const [versionNo, setVersionNo] = useState<number | null>(null);
  const [invoicing, setInvoicing] = useState(false);
  const act = useAction();
  const can = useCan();
  if (loading) return <Loading />;
  if (!q) return <ErrorText>{error}</ErrorText>;
  const latest = q.versions[0];
  const v = q.versions.find((x: any) => x.version === versionNo) ?? latest;
  const isLatest = v.version === latest.version;
  const setStatus = (status: string) => act.run(async () => { await api.post(`/quotations/${q.id}/status`, { status }); await reload(); });
  const locked = q.status === 'CONVERTED';
  const invoices = q.versions.flatMap((x: any) => x.invoices.map((i: any) => ({ ...i, version: x.version })));
  const tax = Number(v.cgst) + Number(v.sgst) + Number(v.igst);

  return (
    <>
      <PageHeader title={q.number} sub={<><Link className="underline" href={`/customers/${q.customerId}`}>{q.customer.name}</Link> · {Number(v.systemSizeKw)} kW · valid until {fmtDate(q.validUntil)}</>}>
        <Badge status={q.status} />
        <Button variant="outline" disabled={act.busy} onClick={() => act.run(() => openDocument(`/quotations/${q.id}/versions/${v.version}/document`))}>PDF v{v.version}</Button>
        {can.sales && !locked && <Link href={`/quotations/${q.id}/revise`}><Button variant="outline">Revise</Button></Link>}
        {can.sales && q.status === 'DRAFT' && <Button disabled={act.busy} onClick={() => setStatus('SENT')}>Mark as sent</Button>}
        {can.sales && q.status === 'SENT' && <><Button variant="danger" disabled={act.busy} onClick={() => setStatus('REJECTED')}>Rejected</Button><Button disabled={act.busy} onClick={() => setStatus('ACCEPTED')}>Accepted</Button></>}
        {can.accounts && (q.status === 'ACCEPTED' || locked) && <Button onClick={() => setInvoicing(true)}>Create invoice</Button>}
      </PageHeader>
      <ErrorText>{act.error}</ErrorText>

      {q.versions.length > 1 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted">Versions:</span>
          {q.versions.map((x: any) => (
            <button key={x.version} onClick={() => setVersionNo(x.version)} aria-pressed={x.version === v.version}
              className={`rounded-full border px-3 py-1 ${x.version === v.version ? 'border-navy bg-navy text-white' : 'border-line bg-white hover:bg-tint'}`}>
              v{x.version} · {inr(x.total, 0)}
            </button>
          ))}
          {!isLatest && <span className="text-muted">Earlier version, read-only.</span>}
        </div>
      )}

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <Card title={`Bill of materials · v${v.version}`}>
          <Table head={['#', 'Item', 'Specification', { label: 'Qty', num: true }, 'Unit', { label: 'Amount', num: true }]}>
            {v.lines.map((l: any, i: number) => (
              <tr key={l.id}><td className="text-muted">{i + 1}</td><td className="font-medium">{l.name}</td><td className="min-w-48">{l.specification}</td>
                <td className="num">{Number(l.quantity)}</td><td>{UNIT_LABEL[l.unit]}</td><td className="num">{inr(l.amount)}</td></tr>
            ))}
          </Table>
          {v.milestones.length > 0 && (
            <div className="mt-4 border-t border-line pt-3 text-sm">
              <div className="mb-1 text-xs font-medium text-muted">Payment schedule</div>
              {v.milestones.map((m: any) => <div key={m.id} className="flex justify-between py-0.5"><span>{m.label} ({Number(m.percent)}%)</span><span className="tabular-nums">{inr(m.amount, 0)}</span></div>)}
            </div>
          )}
        </Card>
        <div className="space-y-4">
          <div className="overflow-hidden rounded-lg border border-line bg-white text-sm">
            {[['System price', inr(v.contractValue)], [v.isInterState ? 'IGST' : 'CGST + SGST', inr(tax)], ['Round off', inr(v.roundOff)]].map(([l, val]) => (
              <div key={l} className="flex justify-between border-b border-line/70 px-3 py-2"><span>{l}</span><span className="tabular-nums">{val}</span></div>
            ))}
            <div className="flex justify-between border-b border-line/70 bg-tint px-3 py-2 font-semibold"><span>Total incl. GST</span><span className="tabular-nums">{inr(v.total)}</span></div>
            {Number(v.subsidyAmount) > 0 && <div className="flex justify-between border-b border-line/70 px-3 py-2"><span>Less: subsidy</span><span className="tabular-nums">– {inr(v.subsidyAmount, 0)}</span></div>}
            <div className="flex justify-between bg-navy px-3 py-3 font-semibold text-white"><span>Effective cost</span><span className="tabular-nums">{inr(v.netCostToCustomer, 0)}</span></div>
          </div>
          <Card title="Details">
            <dl className="space-y-1 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-muted">Created</dt><dd>{fmtDate(v.createdAt)}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted">Goods / services</dt><dd className="tabular-nums">{inr(v.goodsValue, 0)} / {inr(v.serviceValue, 0)}</dd></div>
              {v.annualSavings && <div className="flex justify-between gap-3"><dt className="text-muted">Est. savings</dt><dd>{inr(v.annualSavings, 0)}/yr · {Number(v.paybackYears)} yr payback</dd></div>}
              {q.site && <div className="flex justify-between gap-3"><dt className="text-muted">Site</dt><dd className="text-right">{q.site.addressLine1}, {q.site.city}</dd></div>}
            </dl>
          </Card>
          {invoices.length > 0 && (
            <Card title="Invoices">
              <ul className="space-y-2 text-sm">
                {invoices.map((i: any) => (
                  <li key={i.id} className="flex items-center justify-between gap-2">
                    <Link className="font-medium text-navy underline" href={`/invoices/${i.id}`}>{i.number ?? (i.type === 'PROFORMA' ? 'Draft proforma' : 'Draft invoice')}</Link>
                    <span className="flex items-center gap-2"><span className="tabular-nums">{inr(i.total, 0)}</span><Badge status={i.status} /></span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
      {invoicing && <InvoiceModal quotation={q} onClose={() => setInvoicing(false)} />}
    </>
  );
}
