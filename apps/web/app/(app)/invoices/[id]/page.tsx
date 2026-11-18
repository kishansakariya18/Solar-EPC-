'use client';
import { stateLabel } from '@solar-epc/core';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { Badge, Button, Card, ErrorText, Field, Input, Loading, Modal, PageHeader, Select, Table } from '@/components/ui';
import { api, openDocument } from '@/lib/api';
import { useCan } from '@/lib/auth';
import { fmtDate, inr, today } from '@/lib/format';
import { useAction, useApi } from '@/lib/useApi';

function PaymentModal({ invoice, balance, onClose, onDone }: { invoice: any; balance: number; onClose: () => void; onDone: () => void }) {
  const [p, setP] = useState({ amount: balance.toFixed(2), receivedOn: today(), mode: 'UPI', reference: '' });
  const { busy, error, run } = useAction();
  return (
    <Modal title="Record payment" onClose={onClose}>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); run(async () => { await api.post(`/invoices/${invoice.id}/payments`, p); onDone(); }); }}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Amount (₹)" hint={`Balance due ${inr(balance)}`}><Input required inputMode="decimal" value={p.amount} onChange={(e) => setP({ ...p, amount: e.target.value })} /></Field>
          <Field label="Received on"><Input required type="date" value={p.receivedOn} onChange={(e) => setP({ ...p, receivedOn: e.target.value })} /></Field>
          <Field label="Mode"><Select value={p.mode} onChange={(e) => setP({ ...p, mode: e.target.value })}><option value="UPI">UPI</option><option value="NEFT_RTGS">NEFT / RTGS</option><option value="CHEQUE">Cheque</option><option value="CASH">Cash</option></Select></Field>
          <Field label="Reference (UTR / cheque no.)"><Input value={p.reference} onChange={(e) => setP({ ...p, reference: e.target.value })} /></Field>
        </div>
        <ErrorText>{error}</ErrorText>
        <div className="flex justify-end"><Button type="submit" disabled={busy}>Record payment</Button></div>
      </form>
    </Modal>
  );
}

function CreditNoteModal({ invoice, remaining, onClose, onDone }: { invoice: any; remaining: number; onClose: () => void; onDone: () => void }) {
  const [full, setFull] = useState(true);
  const [taxableValue, setTaxableValue] = useState(remaining.toFixed(2));
  const [reason, setReason] = useState('');
  const { busy, error, run } = useAction();
  return (
    <Modal title="Issue credit note" onClose={onClose}>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); run(async () => { await api.post(`/invoices/${invoice.id}/credit-notes`, { reason, taxableValue: full ? remaining.toFixed(2) : taxableValue }); onDone(); }); }}>
        <p className="text-sm text-muted">An issued invoice cannot be edited. A credit note reduces it, with GST credited in the same proportion. It gets its own number and cannot be undone.</p>
        <div className="space-y-2 text-sm">
          <label className="flex items-center gap-2"><input type="radio" checked={full} onChange={() => setFull(true)} /> Cancel the whole invoice ({inr(remaining)} taxable value left)</label>
          <label className="flex items-center gap-2"><input type="radio" checked={!full} onChange={() => setFull(false)} /> Credit part of it</label>
        </div>
        {!full && <Field label="Taxable value to credit (₹, before GST)"><Input required inputMode="decimal" value={taxableValue} onChange={(e) => setTaxableValue(e.target.value)} /></Field>}
        <Field label="Reason"><Input required minLength={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Price correction, order cancelled" /></Field>
        <ErrorText>{error}</ErrorText>
        <div className="flex justify-end"><Button type="submit" variant="danger" disabled={busy}>{full ? 'Cancel invoice with credit note' : 'Issue credit note'}</Button></div>
      </form>
    </Modal>
  );
}

function IssueModal({ invoice, onClose, onDone }: { invoice: any; onClose: () => void; onDone: () => void }) {
  const { busy, error, run } = useAction();
  const kind = invoice.type === 'PROFORMA' ? 'proforma invoice' : 'tax invoice';
  return (
    <Modal title={`Issue ${kind}`} onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm">Issuing gives this {kind} for <b>{inr(invoice.total)}</b> the next number in the series and locks it. After that it cannot be edited or deleted{invoice.type === 'TAX_INVOICE' ? '; corrections go through a credit note' : ''}.</p>
        <ErrorText>{error}</ErrorText>
        <div className="flex justify-end gap-2"><Button variant="outline" onClick={onClose}>Not yet</Button><Button disabled={busy} onClick={() => run(async () => { await api.post(`/invoices/${invoice.id}/issue`); onDone(); })}>{busy ? 'Issuing…' : 'Issue and lock'}</Button></div>
      </div>
    </Modal>
  );
}

function DraftEditor({ invoice, onDone }: { invoice: any; onDone: () => void }) {
  const [v, setV] = useState({ contractValue: String(Number(invoice.taxableValue)), milestoneLabel: invoice.milestoneLabel ?? '', reverseCharge: invoice.reverseCharge });
  const { busy, error, run } = useAction();
  return (
    <Card title="Edit draft">
      <form className="grid gap-3 sm:grid-cols-3" onSubmit={(e) => { e.preventDefault(); run(async () => { await api.put(`/invoices/${invoice.id}`, v); onDone(); }); }}>
        <Field label="Taxable value (₹, before GST)" hint="Lines and GST are recalculated"><Input required inputMode="decimal" value={v.contractValue} onChange={(e) => setV({ ...v, contractValue: e.target.value })} /></Field>
        <Field label="Milestone"><Input value={v.milestoneLabel} onChange={(e) => setV({ ...v, milestoneLabel: e.target.value })} /></Field>
        <div className="flex items-end justify-between gap-3">
          <label className="flex items-center gap-2 pb-2.5 text-sm"><input type="checkbox" checked={v.reverseCharge} onChange={(e) => setV({ ...v, reverseCharge: e.target.checked })} /> Reverse charge</label>
          <Button type="submit" variant="outline" disabled={busy}>Save draft</Button>
        </div>
        <div className="sm:col-span-3"><ErrorText>{error}</ErrorText></div>
      </form>
    </Card>
  );
}

export default function InvoicePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: inv, error, loading, reload } = useApi(`/invoices/${id}`);
  const [modal, setModal] = useState<'issue' | 'payment' | 'credit' | null>(null);
  const act = useAction();
  const can = useCan();
  if (loading) return <Loading />;
  if (!inv) return <ErrorText>{error}</ErrorText>;

  const draft = inv.status === 'DRAFT';
  const isTax = inv.type === 'TAX_INVOICE';
  const credited = inv.creditNotes.reduce((a: number, c: any) => a + Number(c.total), 0);
  const creditedTaxable = inv.creditNotes.reduce((a: number, c: any) => a + Number(c.taxableValue), 0);
  const balance = Number(inv.total) - Number(inv.amountPaid) - credited;
  const canPay = can.accounts && (inv.status === 'ISSUED' || inv.status === 'PARTIALLY_PAID');
  const canCredit = can.accounts && isTax && ['ISSUED', 'PARTIALLY_PAID', 'PAID'].includes(inv.status);
  const quotation = inv.quotationVersion?.quotation;
  const done = () => { setModal(null); reload(); };

  return (
    <>
      <PageHeader title={inv.number ?? (isTax ? 'Draft tax invoice' : 'Draft proforma')} sub={<>{isTax ? 'Tax invoice' : 'Proforma invoice'} · <Link className="underline" href={`/customers/${inv.customerId}`}>{inv.customer.name}</Link>{quotation && <> · from <Link className="underline" href={`/quotations/${quotation.id}`}>{quotation.number}</Link></>}</>}>
        <Badge status={inv.status} />
        <Button variant="outline" disabled={act.busy} onClick={() => act.run(() => openDocument(`/invoices/${inv.id}/document`))}>PDF</Button>
        {draft && can.accounts && <Button variant="danger" disabled={act.busy} onClick={() => act.run(async () => { await api.del(`/invoices/${inv.id}`); router.push('/invoices'); })}>Delete draft</Button>}
        {draft && can.accounts && <Button onClick={() => setModal('issue')}>Issue</Button>}
        {canCredit && <Button variant="outline" onClick={() => setModal('credit')}>Credit note</Button>}
        {canPay && <Button onClick={() => setModal('payment')}>Record payment</Button>}
      </PageHeader>
      <ErrorText>{act.error}</ErrorText>
      {!draft && <p className="mb-3 rounded-md border border-line bg-tint px-3 py-2 text-sm text-muted">Issued on {fmtDate(inv.issueDate)} and locked.{isTax ? ' Corrections go through a credit note.' : ''}</p>}

      <div className="space-y-4">
        {draft && can.accounts && <DraftEditor key={inv.updatedAt} invoice={inv} onDone={reload} />}
        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <Card title="Lines">
            <Table head={['Description', 'HSN/SAC', { label: 'Taxable value', num: true }, { label: 'GST', num: true }, ...(inv.isInterState ? [{ label: 'IGST', num: true }] : [{ label: 'CGST', num: true }, { label: 'SGST', num: true }]), { label: 'Amount', num: true }]}>
              {inv.lines.map((l: any) => (
                <tr key={l.id}>
                  <td className="min-w-52"><div className="font-medium">{l.description}</div><div className="text-xs text-muted">{l.detail}</div></td>
                  <td>{l.hsnSac}</td><td className="num">{inr(l.taxableValue)}</td><td className="num">{Number(l.gstRate)}%</td>
                  {inv.isInterState ? <td className="num">{inr(l.igst)}</td> : <><td className="num">{inr(l.cgst)}</td><td className="num">{inr(l.sgst)}</td></>}
                  <td className="num">{inr(l.total)}</td>
                </tr>
              ))}
            </Table>
            <p className="mt-3 border-t border-line pt-3 text-sm"><span className="text-muted">Amount in words: </span><b>{inv.amountInWords}</b></p>
            <p className="mt-1 text-xs text-muted">Place of supply: {stateLabel(inv.placeOfSupplyStateCode)} · Reverse charge: {inv.reverseCharge ? 'Yes' : 'No'}{inv.milestoneLabel ? ` · Milestone: ${inv.milestoneLabel}` : ''}</p>
          </Card>
          <div className="overflow-hidden rounded-lg border border-line bg-white text-sm">
            {[['Taxable value', inr(inv.taxableValue)], ...(inv.isInterState ? [['IGST', inr(inv.igst)]] : [['CGST', inr(inv.cgst)], ['SGST', inr(inv.sgst)]]), ['Round off', inr(inv.roundOff)]].map(([l, val]) => (
              <div key={l} className="flex justify-between border-b border-line/70 px-3 py-2"><span>{l}</span><span className="tabular-nums">{val}</span></div>
            ))}
            <div className="flex justify-between bg-navy px-3 py-3 font-semibold text-white"><span>Invoice total</span><span className="tabular-nums">{inr(inv.total)}</span></div>
            {!draft && <>
              <div className="flex justify-between border-b border-line/70 px-3 py-2"><span>Received to date</span><span className="tabular-nums">{inr(inv.amountPaid)}</span></div>
              {credited > 0 && <div className="flex justify-between border-b border-line/70 px-3 py-2"><span>Credit notes</span><span className="tabular-nums">– {inr(credited)}</span></div>}
              <div className="flex justify-between px-3 py-2 font-semibold"><span>{balance < 0 ? 'Refund due' : 'Balance due'}</span><span className="tabular-nums">{inr(Math.abs(balance))}</span></div>
            </>}
          </div>
        </div>

        {!draft && (
          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Payments">
              <Table head={['Date', 'Mode', 'Reference', { label: 'Amount', num: true }]} empty={inv.payments.length === 0}>
                {inv.payments.map((p: any) => <tr key={p.id}><td>{fmtDate(p.receivedOn)}</td><td>{({ UPI: 'UPI', NEFT_RTGS: 'NEFT / RTGS', CHEQUE: 'Cheque', CASH: 'Cash', RAZORPAY: 'Razorpay' } as Record<string, string>)[p.mode]}</td><td>{p.reference ?? '—'}</td><td className="num">{inr(p.amount)}</td></tr>)}
              </Table>
            </Card>
            {isTax && (
              <Card title="Credit notes">
                <Table head={['Number', 'Date', 'Reason', { label: 'Total', num: true }]} empty={inv.creditNotes.length === 0}>
                  {inv.creditNotes.map((c: any) => <tr key={c.id}><td className="font-medium">{c.number}</td><td>{fmtDate(c.issueDate)}</td><td>{c.reason}</td><td className="num">{inr(c.total)}</td></tr>)}
                </Table>
              </Card>
            )}
          </div>
        )}
      </div>

      {modal === 'issue' && <IssueModal invoice={inv} onClose={() => setModal(null)} onDone={done} />}
      {modal === 'payment' && <PaymentModal invoice={inv} balance={balance} onClose={() => setModal(null)} onDone={done} />}
      {modal === 'credit' && <CreditNoteModal invoice={inv} remaining={Number(inv.taxableValue) - creditedTaxable} onClose={() => setModal(null)} onDone={done} />}
    </>
  );
}
