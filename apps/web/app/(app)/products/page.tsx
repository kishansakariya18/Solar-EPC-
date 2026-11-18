'use client';
import { useState } from 'react';
import { Button, Card, ErrorText, Field, Input, Modal, PageHeader, Select, Table } from '@/components/ui';
import { api } from '@/lib/api';
import { useCan } from '@/lib/auth';
import { CATEGORIES, UNITS, UNIT_LABEL, inr } from '@/lib/format';
import { useAction, useApi } from '@/lib/useApi';

function ProductModal({ product, onClose, onDone }: { product: any | null; onClose: () => void; onDone: () => void }) {
  const [p, setP] = useState<any>(product ?? { category: 'MODULE', unit: 'NOS', gstRate: '5', isActive: true });
  const set = (patch: any) => setP((x: any) => ({ ...x, ...patch }));
  const { busy, error, run } = useAction();
  const save = () => run(async () => {
    const body = {
      sku: p.sku, name: p.name, category: p.category, brand: p.brand, model: p.model, specification: p.specification, unit: p.unit,
      hsnSac: p.hsnSac, gstRate: p.gstRate, price: p.price, isActive: p.isActive ?? true,
      wattPeak: p.category === 'MODULE' && p.wattPeak ? Number(p.wattPeak) : null, capacityKw: p.category === 'INVERTER' && p.capacityKw ? p.capacityKw : null,
    };
    await (product ? api.put(`/products/${product.id}`, body) : api.post('/products', body));
    onDone();
  });
  return (
    <Modal title={product ? 'Edit product' : 'Add product'} onClose={onClose}>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Item name" hint="Printed in the Item column, e.g. Solar PV modules"><Input required value={p.name ?? ''} onChange={(e) => set({ name: e.target.value })} /></Field>
          <Field label="Category"><Select value={p.category} onChange={(e) => set({ category: e.target.value })}>{Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
          <Field label="Specification / make" className="sm:col-span-2" hint="Printed on the quotation"><Input value={p.specification ?? ''} onChange={(e) => set({ specification: e.target.value })} /></Field>
          <Field label="Brand"><Input value={p.brand ?? ''} onChange={(e) => set({ brand: e.target.value })} /></Field>
          <Field label="SKU (optional)"><Input value={p.sku ?? ''} onChange={(e) => set({ sku: e.target.value })} /></Field>
          <Field label="Unit"><Select value={p.unit} onChange={(e) => set({ unit: e.target.value })}>{UNITS.map((u) => <option key={u} value={u}>{UNIT_LABEL[u]}</option>)}</Select></Field>
          <Field label="Price per unit (₹, before GST)"><Input required inputMode="decimal" value={p.price ?? ''} onChange={(e) => set({ price: e.target.value })} /></Field>
          <Field label="HSN / SAC"><Input required value={p.hsnSac ?? ''} onChange={(e) => set({ hsnSac: e.target.value })} /></Field>
          <Field label="GST rate % (sold on its own)"><Input required inputMode="decimal" value={p.gstRate ?? ''} onChange={(e) => set({ gstRate: e.target.value })} /></Field>
          {p.category === 'MODULE' && <Field label="Watt peak (Wp)" hint="Used to work out the panel count"><Input required inputMode="numeric" value={p.wattPeak ?? ''} onChange={(e) => set({ wattPeak: e.target.value })} /></Field>}
          {p.category === 'INVERTER' && <Field label="Capacity (kW)"><Input inputMode="decimal" value={p.capacityKw ?? ''} onChange={(e) => set({ capacityKw: e.target.value })} /></Field>}
          <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={p.isActive ?? true} onChange={(e) => set({ isActive: e.target.checked })} /> Active (shown in the quote builder)</label>
        </div>
        <ErrorText>{error}</ErrorText>
        <div className="flex justify-end"><Button type="submit" disabled={busy}>Save product</Button></div>
      </form>
    </Modal>
  );
}

export default function ProductsPage() {
  const { data, error, reload } = useApi<any[]>('/products?all=1');
  const [modal, setModal] = useState<{ product: any | null } | null>(null);
  const can = useCan();
  return (
    <>
      <PageHeader title="Products" sub="Catalogue with HSN/SAC, GST rate and price">{can.admin && <Button onClick={() => setModal({ product: null })}>Add product</Button>}</PageHeader>
      <Card>
        <ErrorText>{error}</ErrorText>
        <Table head={['Item', 'Category', 'Specification', 'HSN/SAC', { label: 'GST', num: true }, { label: 'Price', num: true }, 'Unit', '']} empty={data?.length === 0}>
          {data?.map((p) => (
            <tr key={p.id} className={p.isActive ? '' : 'text-muted'}>
              <td className="font-medium">{p.name}{!p.isActive && ' (inactive)'}</td><td>{CATEGORIES[p.category]}</td><td className="min-w-52">{p.specification}</td>
              <td>{p.hsnSac}</td><td className="num">{Number(p.gstRate)}%</td><td className="num">{inr(p.price)}</td><td>{UNIT_LABEL[p.unit]}</td>
              <td>{can.admin && <Button size="sm" variant="ghost" onClick={() => setModal({ product: p })}>Edit</Button>}</td>
            </tr>
          ))}
        </Table>
      </Card>
      {modal && <ProductModal product={modal.product} onClose={() => setModal(null)} onDone={() => { setModal(null); reload(); }} />}
    </>
  );
}
