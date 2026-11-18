'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Badge, Button, Card, ErrorText, Input, PageHeader, Select, Table } from '@/components/ui';
import { useCan } from '@/lib/auth';
import { fmtDate, inr, label } from '@/lib/format';
import { useApi } from '@/lib/useApi';

const STATUSES = ['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CONVERTED'];

export default function QuotationsPage() {
  const [q, setQ] = useState('');
  const [term, setTerm] = useState('');
  const [status, setStatus] = useState('');
  useEffect(() => { const t = setTimeout(() => setTerm(q), 250); return () => clearTimeout(t); }, [q]);
  const { data, error } = useApi<any[]>(`/quotations?q=${encodeURIComponent(term)}&status=${status}`);
  const can = useCan();
  return (
    <>
      <PageHeader title="Quotations">{can.sales && <Link href="/quotations/new"><Button>New quotation</Button></Link>}</PageHeader>
      <Card>
        <div className="mb-3 flex flex-wrap gap-2">
          <Input className="max-w-xs" placeholder="Search number, customer or mobile" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search quotations" />
          <Select className="w-40" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status"><option value="">All statuses</option>{STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}</Select>
        </div>
        <ErrorText>{error}</ErrorText>
        <Table head={['Number', 'Customer', 'System', { label: 'Total incl. GST', num: true }, 'Valid until', 'Status']} empty={data?.length === 0}>
          {data?.map((r) => (
            <tr key={r.id}>
              <td><Link className="font-medium text-navy underline" href={`/quotations/${r.id}`}>{r.number}</Link> <span className="text-muted">v{r.versions[0]?.version}</span></td>
              <td>{r.customer.name}<div className="text-xs text-muted">{r.customer.phone}</div></td>
              <td>{Number(r.versions[0]?.systemSizeKw)} kW</td><td className="num">{inr(r.versions[0]?.total, 0)}</td>
              <td>{fmtDate(r.validUntil)}</td><td><Badge status={r.status} /></td>
            </tr>
          ))}
        </Table>
      </Card>
    </>
  );
}
