'use client';
import { stateLabel } from '@solar-epc/core';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { CustomerForm, SiteFields } from '@/components/CustomerForm';
import { Badge, Button, Card, ErrorText, Loading, Modal, PageHeader, Table } from '@/components/ui';
import { api } from '@/lib/api';
import { useCan } from '@/lib/auth';
import { inr } from '@/lib/format';
import { useAction, useApi } from '@/lib/useApi';

function SiteModal({ customerId, site, onDone, onClose }: { customerId: string; site: any | null; onDone: () => void; onClose: () => void }) {
  const [v, setV] = useState<any>(site ?? { stateCode: '24', phase: 'SINGLE' });
  const { busy, error, run } = useAction();
  const save = () => run(async () => {
    const body = { label: v.label, addressLine1: v.addressLine1, addressLine2: v.addressLine2, city: v.city, pincode: v.pincode, stateCode: v.stateCode, discomName: v.discomName, consumerNumber: v.consumerNumber, sanctionedLoadKw: v.sanctionedLoadKw || null, phase: v.phase, roofType: v.roofType };
    await (site ? api.put(`/sites/${site.id}`, body) : api.post(`/customers/${customerId}/sites`, body));
    onDone();
  });
  return (
    <Modal title={site ? 'Edit site' : 'Add site'} onClose={onClose}>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <SiteFields v={v} set={(p) => setV({ ...v, ...p })} />
        <ErrorText>{error}</ErrorText>
        <div className="flex justify-end"><Button type="submit" disabled={busy}>Save site</Button></div>
      </form>
    </Modal>
  );
}

export default function CustomerPage() {
  const { id } = useParams<{ id: string }>();
  const { data: c, error, loading, reload } = useApi(`/customers/${id}`);
  const [editing, setEditing] = useState(false);
  const [siteModal, setSiteModal] = useState<{ site: any | null } | null>(null);
  const can = useCan();
  if (loading) return <Loading />;
  if (!c) return <ErrorText>{error}</ErrorText>;
  return (
    <>
      <PageHeader title={c.name} sub={`${c.phone}${c.email ? ` · ${c.email}` : ''}`}>
        {can.sales && <Button variant="outline" onClick={() => setEditing(true)}>Edit</Button>}
        {can.sales && <Link href={`/quotations/new?customerId=${c.id}`}><Button>New quotation</Button></Link>}
      </PageHeader>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Billing details">
          <p className="text-sm leading-relaxed">{c.addressLine1}{c.addressLine2 ? `, ${c.addressLine2}` : ''}<br />{c.city} – {c.pincode}<br />{stateLabel(c.stateCode)}<br />GSTIN: {c.gstin ?? 'Unregistered'}</p>
        </Card>
        <Card title="Sites" action={can.sales && <Button size="sm" variant="outline" onClick={() => setSiteModal({ site: null })}>Add site</Button>}>
          {c.sites.length === 0 && <p className="text-sm text-muted">No sites yet.</p>}
          <ul className="space-y-3">
            {c.sites.map((s: any) => (
              <li key={s.id} className="flex items-start justify-between gap-3 text-sm">
                <div>
                  <div className="font-medium">{s.label ?? 'Site'}</div>
                  <div className="text-muted">{s.addressLine1}, {s.city} – {s.pincode}</div>
                  <div className="text-muted">{[s.discomName, s.consumerNumber && `Consumer ${s.consumerNumber}`, s.sanctionedLoadKw && `${Number(s.sanctionedLoadKw)} kW`, s.phase === 'THREE' ? 'Three phase' : 'Single phase', s.roofType].filter(Boolean).join(' · ')}</div>
                </div>
                {can.sales && <Button size="sm" variant="ghost" onClick={() => setSiteModal({ site: s })}>Edit</Button>}
              </li>
            ))}
          </ul>
        </Card>
      </div>
      <Card title="Quotations" className="mt-4">
        <Table head={['Number', 'System', { label: 'Total', num: true }, 'Status']} empty={c.quotations.length === 0}>
          {c.quotations.map((q: any) => (
            <tr key={q.id}>
              <td><Link className="font-medium text-navy underline" href={`/quotations/${q.id}`}>{q.number}</Link> <span className="text-muted">v{q.versions[0]?.version}</span></td>
              <td>{Number(q.versions[0]?.systemSizeKw)} kW</td><td className="num">{inr(q.versions[0]?.total, 0)}</td><td><Badge status={q.status} /></td>
            </tr>
          ))}
        </Table>
      </Card>
      {editing && <Modal title="Edit customer" onClose={() => setEditing(false)}><CustomerForm initial={c} onSaved={() => { setEditing(false); reload(); }} /></Modal>}
      {siteModal && <SiteModal customerId={c.id} site={siteModal.site} onClose={() => setSiteModal(null)} onDone={() => { setSiteModal(null); reload(); }} />}
    </>
  );
}
