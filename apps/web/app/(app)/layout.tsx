'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loading } from '@/components/ui';
import { useAuth } from '@/lib/auth';

const NAV = [
  { href: '/', label: 'Dashboard' }, { href: '/quotations', label: 'Quotations' }, { href: '/invoices', label: 'Invoices' },
  { href: '/customers', label: 'Customers' }, { href: '/products', label: 'Products' }, { href: '/kits', label: 'Kits' },
  { href: '/settings', label: 'Settings', adminOnly: true },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { me, loading, logout } = useAuth();
  const router = useRouter();
  const path = usePathname();
  useEffect(() => { if (!loading && !me) router.replace('/login'); }, [loading, me, router]);
  if (loading || !me) return <Loading />;

  const links = NAV.filter((n) => !n.adminOnly || me.role === 'ADMIN').map((n) => {
    const active = n.href === '/' ? path === '/' : path.startsWith(n.href);
    return (
      <Link key={n.href} href={n.href} aria-current={active ? 'page' : undefined}
        className={`whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium ${active ? 'bg-white/15 text-white' : 'text-white/75 hover:bg-white/10 hover:text-white'}`}>
        {n.label}
      </Link>
    );
  });

  return (
    <div className="min-h-screen md:flex">
      <aside className="bg-navy text-white md:sticky md:top-0 md:flex md:h-screen md:w-56 md:flex-none md:flex-col">
        <div className="flex items-center justify-between px-4 pt-3 md:block md:pt-5">
          <div>
            <div className="font-display text-lg font-bold leading-tight">{me.companyName}</div>
            <div className="hidden h-1 w-10 rounded bg-amber md:mt-2 md:block" />
          </div>
          <button onClick={logout} className="text-xs text-white/75 underline md:hidden">Sign out</button>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-2 py-2 md:mt-4 md:flex-col md:overflow-visible md:px-3">{links}</nav>
        <div className="mt-auto hidden border-t border-white/15 p-4 text-sm md:block">
          <div className="font-medium">{me.name}</div>
          <div className="text-xs text-white/70">{me.role.toLowerCase()} · {me.email}</div>
          <button onClick={logout} className="mt-2 text-xs text-white/80 underline">Sign out</button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-4 md:p-6 lg:p-8"><div className="mx-auto max-w-6xl">{children}</div></main>
    </div>
  );
}
