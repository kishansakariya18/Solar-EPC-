'use client';
import { GST_STATES } from '@solar-epc/core';
import { useState } from 'react';
import { api } from '@/lib/api';
import { useAction } from '@/lib/useApi';
import { Button, ErrorText, Field, Input, Select } from './ui';

const STATES = Object.entries(GST_STATES).sort((a, b) => a[1].localeCompare(b[1]));
export const StateSelect = (p: React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <Select {...p}>{STATES.map(([code, name]) => <option key={code} value={code}>{name} ({code})</option>)}</Select>
);
export const DISCOMS = ['DGVCL', 'UGVCL', 'MGVCL', 'PGVCL', 'Torrent Power'];

export function SiteFields({ v, set }: { v: any; set: (patch: any) => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Site label" hint="For example Home or Factory roof"><Input value={v.label ?? ''} onChange={(e) => set({ label: e.target.value })} /></Field>
      <Field label="Roof type"><Input list="roofs" value={v.roofType ?? ''} onChange={(e) => set({ roofType: e.target.value })} /><datalist id="roofs"><option>RCC</option><option>Tin shed</option></datalist></Field>
      <Field label="Site address" className="sm:col-span-2"><Input required value={v.addressLine1 ?? ''} onChange={(e) => set({ addressLine1: e.target.value })} /></Field>
      <Field label="City"><Input required value={v.city ?? ''} onChange={(e) => set({ city: e.target.value })} /></Field>
      <Field label="PIN code"><Input required inputMode="numeric" value={v.pincode ?? ''} onChange={(e) => set({ pincode: e.target.value })} /></Field>
      <Field label="State"><StateSelect value={v.stateCode ?? '24'} onChange={(e) => set({ stateCode: e.target.value })} /></Field>
      <Field label="DISCOM"><Input list="discoms" value={v.discomName ?? ''} onChange={(e) => set({ discomName: e.target.value })} /><datalist id="discoms">{DISCOMS.map((d) => <option key={d}>{d}</option>)}</datalist></Field>
      <Field label="Consumer number"><Input value={v.consumerNumber ?? ''} onChange={(e) => set({ consumerNumber: e.target.value })} /></Field>
      <Field label="Sanctioned load (kW)"><Input inputMode="decimal" value={v.sanctionedLoadKw ?? ''} onChange={(e) => set({ sanctionedLoadKw: e.target.value })} /></Field>
      <Field label="Connection">
        <Select value={v.phase ?? 'SINGLE'} onChange={(e) => set({ phase: e.target.value })}><option value="SINGLE">Single phase</option><option value="THREE">Three phase</option></Select>
      </Field>
    </div>
  );
}

/** Create or edit a customer. A new customer can get their first site in the same step. */
export function CustomerForm({ initial, onSaved }: { initial?: any; onSaved: (c: any) => void }) {
  const [c, setC] = useState<any>(initial ?? { stateCode: '24' });
  const [withSite, setWithSite] = useState(!initial);
  const [sameAddress, setSameAddress] = useState(true);
  const [site, setSite] = useState<any>({ label: 'Home', stateCode: '24', phase: 'SINGLE' });
  const { busy, error, run } = useAction();
  const set = (patch: any) => setC((x: any) => ({ ...x, ...patch }));

  const submit = () => run(async () => {
    const body: any = { name: c.name, phone: c.phone, email: c.email, gstin: c.gstin, addressLine1: c.addressLine1, addressLine2: c.addressLine2, city: c.city, pincode: c.pincode, stateCode: c.stateCode };
    if (!initial && withSite) {
      body.site = sameAddress ? { ...site, addressLine1: c.addressLine1, city: c.city, pincode: c.pincode, stateCode: c.stateCode } : site;
    }
    onSaved(initial ? await api.put(`/customers/${initial.id}`, body) : await api.post('/customers', body));
  });

  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name"><Input required value={c.name ?? ''} onChange={(e) => set({ name: e.target.value })} /></Field>
        <Field label="Mobile"><Input required inputMode="tel" value={c.phone ?? ''} onChange={(e) => set({ phone: e.target.value })} /></Field>
        <Field label="Email (optional)"><Input type="email" value={c.email ?? ''} onChange={(e) => set({ email: e.target.value })} /></Field>
        <Field label="GSTIN (optional)" hint="Leave empty for unregistered customers"><Input value={c.gstin ?? ''} onChange={(e) => set({ gstin: e.target.value.toUpperCase() })} /></Field>
        <Field label="Billing address" className="sm:col-span-2"><Input required value={c.addressLine1 ?? ''} onChange={(e) => set({ addressLine1: e.target.value })} /></Field>
        <Field label="City"><Input required value={c.city ?? ''} onChange={(e) => set({ city: e.target.value })} /></Field>
        <Field label="PIN code"><Input required inputMode="numeric" value={c.pincode ?? ''} onChange={(e) => set({ pincode: e.target.value })} /></Field>
        <Field label="State"><StateSelect value={c.stateCode ?? '24'} onChange={(e) => set({ stateCode: e.target.value })} /></Field>
      </div>
      {!initial && (
        <div className="space-y-3 rounded-md border border-line p-3">
          <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={withSite} onChange={(e) => setWithSite(e.target.checked)} /> Add the installation site now</label>
          {withSite && (
            <>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={sameAddress} onChange={(e) => setSameAddress(e.target.checked)} /> Site is at the billing address</label>
              {sameAddress ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="DISCOM"><Input list="discoms2" value={site.discomName ?? ''} onChange={(e) => setSite({ ...site, discomName: e.target.value })} /><datalist id="discoms2">{DISCOMS.map((d) => <option key={d}>{d}</option>)}</datalist></Field>
                  <Field label="Consumer number"><Input value={site.consumerNumber ?? ''} onChange={(e) => setSite({ ...site, consumerNumber: e.target.value })} /></Field>
                  <Field label="Sanctioned load (kW)"><Input inputMode="decimal" value={site.sanctionedLoadKw ?? ''} onChange={(e) => setSite({ ...site, sanctionedLoadKw: e.target.value })} /></Field>
                  <Field label="Connection"><Select value={site.phase} onChange={(e) => setSite({ ...site, phase: e.target.value })}><option value="SINGLE">Single phase</option><option value="THREE">Three phase</option></Select></Field>
                  <Field label="Roof type"><Input list="roofs2" value={site.roofType ?? ''} onChange={(e) => setSite({ ...site, roofType: e.target.value })} /><datalist id="roofs2"><option>RCC</option><option>Tin shed</option></datalist></Field>
                </div>
              ) : <SiteFields v={site} set={(p) => setSite({ ...site, ...p })} />}
            </>
          )}
        </div>
      )}
      <ErrorText>{error}</ErrorText>
      <div className="flex justify-end"><Button type="submit" disabled={busy}>{busy ? 'Saving…' : initial ? 'Save changes' : 'Add customer'}</Button></div>
    </form>
  );
}
