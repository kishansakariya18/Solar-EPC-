'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button, ErrorText, Field, Input } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useAction } from '@/lib/useApi';

export default function LoginPage() {
  const { me, login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { busy, error, run } = useAction();
  useEffect(() => { if (me) router.replace('/'); }, [me, router]);

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <form
        className="w-full max-w-sm space-y-4 rounded-xl border border-line bg-white p-6"
        onSubmit={(e) => { e.preventDefault(); run(() => login(email, password)); }}
      >
        <div>
          <div className="mb-3 h-1 w-12 rounded bg-amber" />
          <h1 className="font-display text-2xl font-bold text-navy">Solar EPC</h1>
          <p className="text-sm text-muted">Quotations and invoices</p>
        </div>
        <Field label="Email"><Input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <Field label="Password"><Input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
        <ErrorText>{error}</ErrorText>
        <Button type="submit" disabled={busy} className="w-full">{busy ? 'Signing in…' : 'Sign in'}</Button>
      </form>
    </main>
  );
}
