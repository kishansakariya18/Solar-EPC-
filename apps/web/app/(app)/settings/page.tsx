'use client';
import { useEffect, useState } from 'react';
import { StateSelect } from '@/components/CustomerForm';
import { Button, Card, ErrorText, Field, Input, Loading, PageHeader, Table, Textarea } from '@/components/ui';
import { api } from '@/lib/api';
import { fmtDate, inr, today } from '@/lib/format';
import { useAction, useApi } from '@/lib/useApi';

const toLines = (a: string[] | undefined) => (a ?? []).join('\n');
const fromLines = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean);
const pairsToText = (rows: any[] | undefined, a: string, b: string) => (rows ?? []).map((r) => `${r[a]}: ${r[b]}`).join('\n');
const textToPairs = (s: string, a: string, b: string) => fromLines(s).map((l) => { const i = l.lastIndexOf(':'); return { [a]: (i < 0 ? l : l.slice(0, i)).trim(), [b]: i < 0 ? '' : l.slice(i + 1).trim() }; });

function CompanyForm({ company, onSaved }: { company: any; onSaved: () => void }) {
  const d = company.documentDefaults ?? {};
  const [c, setC] = useState<any>(company);
  const [doc, setDoc] = useState({
    warranty: pairsToText(d.warranty, 'component', 'coverage'), milestones: pairsToText(d.milestones, 'label', 'percent'),
    scopeIncluded: toLines(d.scopeIncluded), scopeExcluded: toLines(d.scopeExcluded), documentsRequired: toLines(d.documentsRequired),
    unitsPerKwDay: String(d.unitsPerKwDay ?? '4'), tariffPerUnit: String(d.tariffPerUnit ?? '0'),
  });
  const [saved, setSaved] = useState(false);
  const { busy, error, run } = useAction();
  const set = (patch: any) => { setSaved(false); setC((x: any) => ({ ...x, ...patch })); };
  const setD = (patch: any) => { setSaved(false); setDoc((x) => ({ ...x, ...patch })); };
  const text = (key: string, lbl: string, extra?: any) => <Field label={lbl} {...extra}><Input value={c[key] ?? ''} onChange={(e) => set({ [key]: e.target.value })} /></Field>;

  const save = () => run(async () => {
    const keys = ['name', 'legalName', 'gstin', 'stateCode', 'addressLine1', 'addressLine2', 'city', 'pincode', 'phone', 'email', 'website', 'logoUrl', 'bankName', 'bankBranch', 'accountName', 'accountNumber', 'ifsc', 'upiId', 'defaultTerms', 'jurisdiction'];
    await api.put('/company', {
      ...Object.fromEntries(keys.map((k) => [k, c[k] ?? null])),
      documentDefaults: {
        warranty: textToPairs(doc.warranty, 'component', 'coverage'), milestones: textToPairs(doc.milestones, 'label', 'percent'),
        scopeIncluded: fromLines(doc.scopeIncluded), scopeExcluded: fromLines(doc.scopeExcluded), documentsRequired: fromLines(doc.documentsRequired),
        unitsPerKwDay: doc.unitsPerKwDay || '0', tariffPerUnit: doc.tariffPerUnit || '0',
      },
    });
    setSaved(true); onSaved();
  });

  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save(); }}>
      <Card title="Company profile">
        <div className="grid gap-3 sm:grid-cols-2">
          {text('name', 'Company name')}{text('legalName', 'Legal name (optional)')}
          <Field label="GSTIN" hint="Needed before a tax invoice can be issued"><Input value={c.gstin ?? ''} onChange={(e) => set({ gstin: e.target.value.toUpperCase() })} /></Field>
          <Field label="State"><StateSelect value={c.stateCode} onChange={(e) => set({ stateCode: e.target.value })} /></Field>
          {text('addressLine1', 'Address line 1', { className: 'sm:col-span-2' })}{text('addressLine2', 'Address line 2', { className: 'sm:col-span-2' })}
          {text('city', 'City')}{text('pincode', 'PIN code')}{text('phone', 'Phone')}{text('email', 'Email')}{text('website', 'Website')}
          {text('logoUrl', 'Logo image URL', { hint: 'Printed on PDFs. Upload to storage comes later.' })}
          {text('jurisdiction', 'Jurisdiction city')}
        </div>
      </Card>
      <Card title="Bank and UPI (printed on documents)">
        <div className="grid gap-3 sm:grid-cols-2">{text('accountName', 'Account name')}{text('bankName', 'Bank')}{text('bankBranch', 'Branch')}{text('accountNumber', 'Account number')}{text('ifsc', 'IFSC')}{text('upiId', 'UPI ID', { hint: 'Also makes the UPI QR on quotations' })}</div>
      </Card>
      <Card title="Quotation defaults">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Terms and conditions (one per line)" className="sm:col-span-2"><Textarea rows={6} value={c.defaultTerms ?? ''} onChange={(e) => set({ defaultTerms: e.target.value })} /></Field>
          <Field label="Payment milestones" hint="One per line as Label: percent"><Textarea rows={4} value={doc.milestones} onChange={(e) => setD({ milestones: e.target.value })} /></Field>
          <Field label="Warranty" hint="One per line as Component: coverage"><Textarea rows={4} value={doc.warranty} onChange={(e) => setD({ warranty: e.target.value })} /></Field>
          <Field label="Included in scope (one per line)"><Textarea rows={5} value={doc.scopeIncluded} onChange={(e) => setD({ scopeIncluded: e.target.value })} /></Field>
          <Field label="Not included (one per line)"><Textarea rows={5} value={doc.scopeExcluded} onChange={(e) => setD({ scopeExcluded: e.target.value })} /></Field>
          <Field label="Documents required from customer (one per line)" className="sm:col-span-2"><Textarea rows={4} value={doc.documentsRequired} onChange={(e) => setD({ documentsRequired: e.target.value })} /></Field>
          <Field label="Generation estimate (units per kW per day)"><Input inputMode="decimal" value={doc.unitsPerKwDay} onChange={(e) => setD({ unitsPerKwDay: e.target.value })} /></Field>
          <Field label="Default tariff (₹ per unit)"><Input inputMode="decimal" value={doc.tariffPerUnit} onChange={(e) => setD({ tariffPerUnit: e.target.value })} /></Field>
        </div>
      </Card>
      <ErrorText>{error}</ErrorText>
      <div className="flex items-center justify-end gap-3">{saved && <span className="text-sm text-emerald-700">Saved</span>}<Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save settings'}</Button></div>
    </form>
  );
}

function TaxSettings() {
  const { data, reload } = useApi<any[]>('/tax-configs');
  const [t, setT] = useState<any>(null);
  const { busy, error, run } = useAction();
  useEffect(() => {
    if (data?.[0] && !t) setT({ effectiveFrom: today(), epcGoodsShare: String(Number(data[0].epcGoodsShare)), goodsRate: String(Number(data[0].goodsRate)), serviceRate: String(Number(data[0].serviceRate)), goodsHsn: data[0].goodsHsn, serviceSac: data[0].serviceSac, note: '' });
  }, [data, t]);
  return (
    <Card title="GST settings">
      <p className="mb-3 text-sm text-muted">Rates are never edited in place. A change is added as a new row and applies to documents created from its effective date. Confirm values with your CA.</p>
      <Table head={['Effective from', { label: 'Goods share', num: true }, { label: 'Goods GST', num: true }, { label: 'Service GST', num: true }, 'HSN', 'SAC', 'Note']} empty={data?.length === 0}>
        {data?.map((r) => <tr key={r.id}><td>{fmtDate(r.effectiveFrom)}</td><td className="num">{Number(r.epcGoodsShare) * 100}%</td><td className="num">{Number(r.goodsRate)}%</td><td className="num">{Number(r.serviceRate)}%</td><td>{r.goodsHsn}</td><td>{r.serviceSac}</td><td className="min-w-40 text-muted">{r.note}</td></tr>)}
      </Table>
      {t && (
        <form className="mt-4 grid gap-3 border-t border-line pt-4 sm:grid-cols-3" onSubmit={(e) => { e.preventDefault(); run(async () => { await api.post('/tax-configs', t); await reload(); }); }}>
          <Field label="Effective from"><Input type="date" required value={t.effectiveFrom} onChange={(e) => setT({ ...t, effectiveFrom: e.target.value })} /></Field>
          <Field label="Goods share (0.70 = 70%)"><Input required inputMode="decimal" value={t.epcGoodsShare} onChange={(e) => setT({ ...t, epcGoodsShare: e.target.value })} /></Field>
          <Field label="Goods GST %"><Input required inputMode="decimal" value={t.goodsRate} onChange={(e) => setT({ ...t, goodsRate: e.target.value })} /></Field>
          <Field label="Service GST %"><Input required inputMode="decimal" value={t.serviceRate} onChange={(e) => setT({ ...t, serviceRate: e.target.value })} /></Field>
          <Field label="Goods HSN"><Input required value={t.goodsHsn} onChange={(e) => setT({ ...t, goodsHsn: e.target.value })} /></Field>
          <Field label="Service SAC"><Input required value={t.serviceSac} onChange={(e) => setT({ ...t, serviceSac: e.target.value })} /></Field>
          <Field label="Note" className="sm:col-span-2"><Input value={t.note} onChange={(e) => setT({ ...t, note: e.target.value })} /></Field>
          <div className="flex items-end justify-end"><Button type="submit" variant="outline" disabled={busy}>Add new tax settings</Button></div>
          <div className="sm:col-span-3"><ErrorText>{error}</ErrorText></div>
        </form>
      )}
    </Card>
  );
}

export default function SettingsPage() {
  const { data: company, error, loading, reload } = useApi('/company');
  const { data: schemes } = useApi<any[]>('/subsidy-schemes');
  const { data: logs } = useApi<any[]>('/audit-logs');
  if (loading) return <Loading />;
  if (!company) return <ErrorText>{error}</ErrorText>;
  return (
    <>
      <PageHeader title="Settings" sub="Company details, GST settings, subsidy and audit log" />
      <div className="space-y-4">
        <CompanyForm company={company} onSaved={reload} />
        <TaxSettings />
        <Card title="Subsidy schemes">
          {schemes?.map((s) => (
            <div key={s.id} className="text-sm">
              <div className="font-medium">{s.name} <span className="font-normal text-muted">· from {fmtDate(s.effectiveFrom)}{s.maxAmount ? ` · capped at ${inr(s.maxAmount, 0)}` : ''}</span></div>
              <ul className="mt-1 text-muted">{s.slabs.map((b: any) => <li key={b.id}>{Number(b.fromKw)}–{Number(b.toKw)} kW: {inr(b.amountPerKw, 0)} per kW</li>)}</ul>
            </div>
          ))}
          {schemes?.length === 0 && <p className="text-sm text-muted">No subsidy scheme set.</p>}
        </Card>
        <Card title="Audit log (latest 100)">
          <Table head={['When', 'User', 'Action', 'Record', 'Details']} empty={logs?.length === 0}>
            {logs?.map((l) => (
              <tr key={l.id}><td className="whitespace-nowrap">{new Date(l.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })}</td>
                <td>{l.user?.name ?? '—'}</td><td>{l.action}</td><td>{l.entity}</td><td className="max-w-xs truncate text-xs text-muted">{l.diff ? JSON.stringify(l.diff) : ''}</td></tr>
            ))}
          </Table>
        </Card>
      </div>
    </>
  );
}
