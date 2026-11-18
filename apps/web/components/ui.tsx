'use client';
import { useEffect } from 'react';

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'outline' | 'ghost' | 'danger'; size?: 'sm' | 'md' };
export function Button({ variant = 'primary', size = 'md', className, ...p }: BtnProps) {
  return (
    <button
      {...p}
      className={cx(
        'inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy',
        size === 'sm' ? 'h-8 px-3 text-sm' : 'h-10 px-4 text-sm',
        variant === 'primary' && 'bg-navy text-white hover:bg-navy-soft',
        variant === 'outline' && 'border border-line bg-white text-ink hover:bg-tint',
        variant === 'ghost' && 'text-navy hover:bg-tint',
        variant === 'danger' && 'border border-red-200 bg-white text-red-700 hover:bg-red-50',
        className,
      )}
    />
  );
}

const field = 'w-full h-10 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-navy focus:ring-2 focus:ring-navy/15 disabled:bg-tint disabled:text-muted';
export const Input = ({ className, ...p }: React.InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={cx(field, className)} />;
export const Select = ({ className, ...p }: React.SelectHTMLAttributes<HTMLSelectElement>) => <select {...p} className={cx(field, 'pr-8', className)} />;
export const Textarea = ({ className, ...p }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea {...p} className={cx(field, 'h-auto py-2 leading-relaxed', className)} />
);

export function Field({ label, hint, children, className }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cx('block', className)}>
      <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function Card({ title, action, children, className }: { title?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cx('rounded-lg border border-line bg-white', className)}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <h2 className="font-display text-base font-semibold text-navy">{title}</h2>
          {action}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

const TONES: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-700', SENT: 'bg-blue-50 text-blue-800', ACCEPTED: 'bg-emerald-50 text-emerald-800', REJECTED: 'bg-red-50 text-red-800',
  EXPIRED: 'bg-orange-50 text-orange-800', CONVERTED: 'bg-violet-50 text-violet-800', ISSUED: 'bg-blue-50 text-blue-800',
  PARTIALLY_PAID: 'bg-amber-50 text-amber-800', PAID: 'bg-emerald-50 text-emerald-800', CANCELLED: 'bg-red-50 text-red-800',
};
export function Badge({ status }: { status: string }) {
  return (
    <span className={cx('inline-block rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap', TONES[status] ?? 'bg-slate-100 text-slate-700')}>
      {status.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}
    </span>
  );
}

export function Table({ head, children, empty }: { head: (string | { label: string; num?: boolean })[]; children: React.ReactNode; empty?: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs text-muted">
            {head.map((h, i) => {
              const c = typeof h === 'string' ? { label: h } : h;
              return <th key={i} className={cx('px-3 py-2 font-medium whitespace-nowrap', c.num && 'text-right')}>{c.label}</th>;
            })}
          </tr>
        </thead>
        <tbody className="[&_td]:px-3 [&_td]:py-2.5 [&_tr]:border-b [&_tr]:border-line/60 [&_tr:last-child]:border-0">{children}</tbody>
      </table>
      {empty && <p className="px-3 py-8 text-center text-sm text-muted">Nothing here yet.</p>}
    </div>
  );
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title} className={cx('max-h-[92vh] w-full overflow-y-auto rounded-t-xl bg-white sm:rounded-xl', wide ? 'sm:max-w-3xl' : 'sm:max-w-xl')}>
        <header className="sticky top-0 flex items-center justify-between border-b border-line bg-white px-4 py-3">
          <h2 className="font-display text-base font-semibold text-navy">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="rounded p-1 text-muted hover:bg-tint">✕</button>
        </header>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

export const ErrorText = ({ children }: { children?: string | null }) =>
  children ? <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{children}</p> : null;

export function PageHeader({ title, sub, children }: { title: string; sub?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="font-display text-xl font-bold text-navy sm:text-2xl">{title}</h1>
        {sub && <div className="mt-0.5 text-sm text-muted">{sub}</div>}
      </div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

export const Loading = () => <p className="py-10 text-center text-sm text-muted">Loading…</p>;
