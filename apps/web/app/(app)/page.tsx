'use client';
import Link from 'next/link';
import { Badge, Button, Card, ErrorText, Loading, PageHeader, Table } from '@/components/ui';
import { useCan } from '@/lib/auth';
import { inr } from '@/lib/format';
import { useApi } from '@/lib/useApi';

export default function Dashboard() {
  const { data, error, loading } = useApi('/dashboard');
  const can = useCan();
  if (loading) return <Loading />;
  if (!data) return <ErrorText>{error}</ErrorText>;
  const q = data.quotationsByStatus as Record<string, number>;
  const open = (q.DRAFT ?? 0) + (q.SENT ?? 0);
  const stats = [
    { label: 'Open quotations', value: String(open) },
    { label: 'Accepted, to invoice', value: String(q.ACCEPTED ?? 0) },
    { label: 'Billed (tax invoices)', value: inr(data.billed, 0) },
    { label: 'Outstanding', value: inr(data.outstanding, 0) },
  ];
  return (
    <>
      <PageHeader title="Dashboard" sub={`${data.customers} ${data.customers === 1 ? 'customer' : 'customers'}`}>
        {can.sales && <Link href="/quotations/new"><Button>New quotation</Button></Link>}
      </PageHeader>
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg border border-line bg-white p-4">
            <div className="text-xs text-muted">{s.label}</div>
            <div className="mt-1 font-display text-xl font-bold text-navy sm:text-2xl">{s.value}</div>
          </div>
        ))}
      </div>
      <Card title="Recent quotations" action={<Link href="/quotations" className="text-sm font-medium text-navy underline">View all</Link>}>
        <Table head={['Number', 'Customer', 'System', { label: 'Total', num: true }, 'Status']} empty={data.recentQuotations.length === 0}>
          {data.recentQuotations.map((r: any) => (
            <tr key={r.id}>
              <td><Link className="font-medium text-navy underline" href={`/quotations/${r.id}`}>{r.number}</Link> <span className="text-muted">v{r.versions[0]?.version}</span></td>
              <td>{r.customer.name}</td>
              <td>{Number(r.versions[0]?.systemSizeKw)} kW</td>
              <td className="num">{inr(r.versions[0]?.total, 0)}</td>
              <td><Badge status={r.status} /></td>
            </tr>
          ))}
        </Table>
      </Card>
    </>
  );
}
