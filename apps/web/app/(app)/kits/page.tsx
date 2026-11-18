'use client';
import { useState } from 'react';
import { Button, Card, ErrorText, Field, Input, Modal, PageHeader, Select } from '@/components/ui';
import { api } from '@/lib/api';
import { useCan } from '@/lib/auth';
import { UNIT_LABEL } from '@/lib/format';
import { useAction, useApi } from '@/lib/useApi';

const MODES: Record<string, string> = { FIXED: 'Fixed', PER_PANEL: 'Per panel', PER_KW: 'Per kW' };

function KitModal({ kit, products, onClose, onDone }: { kit: any | null; products: any[]; onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState(kit?.name ?? '');
  const [description, setDescription] = useState(kit?.description ?? '');
  const [items, setItems] = useState<any[]>(kit?.items.map((i: any) => ({ productId: i.productId, qtyMode: i.qtyMode, quantity: String(Number(i.quantity)) })) ?? []);
  const { busy, error, run } = useAction();
  const options = products.filter((p) => p.category !== 'MODULE' && p.category !== 'INVERTER');
  const patch = (i: number, p: any) => setItems(items.map((it, k) => (k === i ? { ...it, ...p } : it)));
  const save = () => run(async () => {
    const body = { name, description, items };
    await (kit ? api.put(`/kits/${kit.id}`, body) : api.post('/kits', body));
    onDone();
  });
  return (
    <Modal wide title={kit ? 'Edit kit' : 'New kit'} onClose={onClose}>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Kit name"><Input required value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Description"><Input value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
        </div>
        <p className="text-xs text-muted">The module and inverter are picked in the quote builder. A kit holds everything else: fixed quantities, or quantities that scale per panel or per kW.</p>
        <div className="space-y-2">
          {items.map((it, i) => (
            <div key={i} className="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[1fr_8rem_6rem_auto]">
              <Select aria-label="Product" className="col-span-2 sm:col-span-1" value={it.productId} onChange={(e) => patch(i, { productId: e.target.value })}>
                {options.map((p) => <option key={p.id} value={p.id}>{p.name} — {p.specification} ({UNIT_LABEL[p.unit]})</option>)}
              </Select>
              <Select aria-label="Quantity mode" value={it.qtyMode} onChange={(e) => patch(i, { qtyMode: e.target.value })}>{Object.entries(MODES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>
              <Input aria-label="Quantity" inputMode="decimal" value={it.quantity} onChange={(e) => patch(i, { quantity: e.target.value })} />
              <Button type="button" variant="ghost" size="sm" className="h-10" onClick={() => setItems(items.filter((_, k) => k !== i))} aria-label="Remove item">✕</Button>
            </div>
          ))}
        </div>
        <Button type="button" variant="outline" size="sm" disabled={options.length === 0} onClick={() => setItems([...items, { productId: options[0].id, qtyMode: 'FIXED', quantity: '1' }])}>Add item</Button>
        <ErrorText>{error}</ErrorText>
        <div className="flex justify-end"><Button type="submit" disabled={busy || items.length === 0}>Save kit</Button></div>
      </form>
    </Modal>
  );
}

export default function KitsPage() {
  const { data: kits, error, reload } = useApi<any[]>('/kits');
  const { data: products } = useApi<any[]>('/products');
  const [modal, setModal] = useState<{ kit: any | null } | null>(null);
  const can = useCan();
  return (
    <>
      <PageHeader title="Kits" sub="Reusable bills of materials for the quote builder">{can.admin && <Button onClick={() => setModal({ kit: null })}>New kit</Button>}</PageHeader>
      <ErrorText>{error}</ErrorText>
      <div className="grid gap-4 lg:grid-cols-2">
        {kits?.map((k) => (
          <Card key={k.id} title={k.name} action={can.admin && <Button size="sm" variant="outline" onClick={() => setModal({ kit: k })}>Edit</Button>}>
            {k.description && <p className="mb-2 text-sm text-muted">{k.description}</p>}
            <ul className="divide-y divide-line/60 text-sm">
              {k.items.map((it: any) => (
                <li key={it.id} className="flex justify-between gap-3 py-1.5">
                  <span>{it.product.name} <span className="text-muted">— {it.product.specification}</span></span>
                  <span className="whitespace-nowrap text-muted">{Number(it.quantity)} {UNIT_LABEL[it.product.unit]}{it.qtyMode !== 'FIXED' && ` ${MODES[it.qtyMode].toLowerCase()}`}</span>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
      {kits?.length === 0 && <p className="py-8 text-center text-sm text-muted">No kits yet.</p>}
      {modal && products && <KitModal kit={modal.kit} products={products} onClose={() => setModal(null)} onDone={() => { setModal(null); reload(); }} />}
    </>
  );
}
