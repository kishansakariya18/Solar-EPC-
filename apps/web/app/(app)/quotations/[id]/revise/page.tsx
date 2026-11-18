'use client';
import { useParams } from 'next/navigation';
import { QuoteBuilder } from '@/components/QuoteBuilder';
import { ErrorText, Loading } from '@/components/ui';
import { useApi } from '@/lib/useApi';

export default function ReviseQuotationPage() {
  const { id } = useParams<{ id: string }>();
  const { data, error, loading } = useApi(`/quotations/${id}`);
  if (loading) return <Loading />;
  if (!data) return <ErrorText>{error}</ErrorText>;
  return <QuoteBuilder quotation={data} />;
}
