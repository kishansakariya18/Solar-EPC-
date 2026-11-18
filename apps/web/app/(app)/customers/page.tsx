'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { CustomerForm } from '@/components/CustomerForm';
import { Button, Card, ErrorText, Input, Modal, PageHeader, Table } from '@/components/ui';
import { useCan } from '@/lib/auth';
import { useApi } from '@/lib/useApi';

export default function CustomersPage() {
  const [q, setQ] = useState('');
  const [term, setTerm] = useState('');
  useEffect(() => { const t = setTimeout(() => setTerm(q), 250); return () => clearTimeout(t); }, [q]);
  const { data, error } = useApi<any[]>(`/customers?q=${encodeURIComponent(term)}`);
  const [adding, setAdding] = useState(false);
  const can = useCan();
  const router = useRouter();
  return (
    <>
      <PageHeader title="Customers">{can.sales && <Button onClick={() => setAdding(true)}>Add customer</Button>}</PageHeader>
      <Card>
        <Input placeholder="Search by name or mobile" value={q} onChange={(e) => setQ(e.target.value)} className="mb-3 max-w-sm" aria-label="Search customers" />
        <ErrorText>{error}</ErrorText>
        <Table head={['Name', 'Mobile', 'City', 'Sites', 'Quotations']} empty={data?.length === 0}>
          {data?.map((c) => (
            <tr key={c.id}>
              <td><Link className="font-medium text-navy underline" href={`/customers/${c.id}`}>{c.name}</Link></td>
              <td>{c.phone}</td><td>{c.city}</td><td>{c.sites.length}</td><td>{c._count.quotations}</td>
            </tr>
          ))}
        </Table>
      </Card>
      {adding && <Modal title="Add customer" onClose={() => setAdding(false)}><CustomerForm onSaved={(c) => router.push(`/customers/${c.id}`)} /></Modal>}
    </>
  );
}
