'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Badge, Card, ErrorText, PageHeader, Select, Table } from '@/components/ui';
import { fmtDate, inr, label } from '@/lib/format';
import { useApi } from '@/lib/useApi';

const STATUSES = ['DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'CANCELLED'];

export default function InvoicesPage() {
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const { data, error } = useApi<any[]>(`/invoices?status=${status}&type=${type}`);
  return (
    <>
      <PageHeader title="Invoices" sub="Create an invoice from an accepted quotation" />
      <Card>
        <div className="mb-3 flex flex-wrap gap-2">
          <Select className="w-44" value={type} onChange={(e) => setType(e.target.value)} aria-label="Type"><option value="">All types</option><option value="TAX_INVOICE">Tax invoices</option><option value="PROFORMA">Proforma invoices</option></Select>
          <Select className="w-44" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status"><option value="">All statuses</option>{STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}</Select>
        </div>
        <ErrorText>{error}</ErrorText>
        <Table head={['Number', 'Type', 'Customer', 'Date', { label: 'Total', num: true }, { label: 'Balance due', num: true }, 'Status']} empty={data?.length === 0}>
          {data?.map((i) => {
            const credited = i.creditNotes.reduce((a: number, c: any) => a + Number(c.total), 0);
            const balance = i.status === 'DRAFT' ? null : Number(i.total) - Number(i.amountPaid) - credited;
            return (
              <tr key={i.id}>
                <td><Link className="font-medium text-navy underline" href={`/invoices/${i.id}`}>{i.number ?? 'Draft'}</Link></td>
                <td>{i.type === 'PROFORMA' ? 'Proforma' : 'Tax invoice'}</td><td>{i.customer.name}</td><td>{fmtDate(i.issueDate)}</td>
                <td className="num">{inr(i.total)}</td><td className="num">{balance == null ? '—' : inr(balance)}</td><td><Badge status={i.status} /></td>
              </tr>
            );
          })}
        </Table>
      </Card>
    </>
  );
}
