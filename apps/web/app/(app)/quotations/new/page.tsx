'use client';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { QuoteBuilder } from '@/components/QuoteBuilder';

function Inner() {
  const customerId = useSearchParams().get('customerId') ?? undefined;
  return <QuoteBuilder initialCustomerId={customerId} />;
}
export default function NewQuotationPage() {
  return <Suspense><Inner /></Suspense>;
}
