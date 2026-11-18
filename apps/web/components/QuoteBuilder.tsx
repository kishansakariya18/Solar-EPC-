'use client';
import { D, computeSubsidy, computeTax, estimateSavings, expandKit, lineAmount, stateLabel } from '@solar-epc/core';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { UNITS, UNIT_LABEL, dateInput, inr, plusDays } from '@/lib/format';
import { useAction, useApi } from '@/lib/useApi';
import { CustomerForm } from './CustomerForm';
import { Button, Card, ErrorText, Field, Input, Loading, Modal, PageHeader, Select, Textarea } from './ui';

interface Line { productId: string | null; kind: 'GOODS' | 'SERVICE'; name: string; specification: string; hsnSac: string; unit: string; quantity: string; unitPrice: string }
const isNum = (v: string) => /^\d+(\.\d+)?$/.test(v.trim());

function CustomerPicker({ onPick }: { onPick: (c: any) => void }) {
  const [q, setQ] = useState('');
  const [term, setTerm] = useState('');
  const [adding, setAdding] = useState(false);
  useEffect(() => { const t = setTimeout(() => setTerm(q), 250); return () => clearTimeout(t); }, [q]);
  const { data } = useApi<any[]>(`/customers?q=${encodeURIComponent(term)}`);
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input autoFocus placeholder="Search by mobile or name" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search customer" />
        <Button type="button" variant="outline" onClick={() => setAdding(true)}>New</Button>
      </div>
      <ul className="max-h-56 divide-y divide-line/60 overflow-y-auto rounded-md border border-line">
        {data?.map((c) => (
          <li key={c.id}><button type="button" className="flex w-full justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-tint" onClick={() => onPick(c)}>
            <span className="font-medium">{c.name}</span><span className="text-muted">{c.phone} · {c.city}</span></button></li>
        ))}
        {data?.length === 0 && <li className="px-3 py-3 text-sm text-muted">No customer found. Use New to add one.</li>}
      </ul>
      {adding && <Modal title="Add customer" onClose={() => setAdding(false)}><CustomerForm onSaved={(c) => { setAdding(false); onPick(c); }} /></Modal>}
    </div>
  );
}

/** New quotation, or a revision (new version) of an existing one. Totals are a live preview; the server recomputes them on save. */
export function QuoteBuilder({ quotation, initialCustomerId }: { quotation?: any; initialCustomerId?: string }) {
  const router = useRouter();
  const { me } = useAuth();
  const revising = !!quotation;
  const prev = quotation?.versions[0];

  const { data: products } = useApi<any[]>('/products');
  const { data: kits } = useApi<any[]>('/kits');
  const { data: taxCfg, error: taxError } = useApi('/tax-configs/active');
  const { data: scheme } = useApi('/subsidy-schemes/active');
  const { data: company } = useApi('/company');
  const { data: preset } = useApi(initialCustomerId && !revising ? `/customers/${initialCustomerId}` : null);

  const [customer, setCustomer] = useState<any>(quotation?.customer ? { ...quotation.customer, sites: quotation.site ? [quotation.site] : [] } : null);
  const [siteId, setSiteId] = useState<string>(quotation?.siteId ?? '');
  const [size, setSize] = useState(prev ? String(Number(prev.systemSizeKw)) : '3.3');
  const [moduleId, setModuleId] = useState('');
  const [inverterId, setInverterId] = useState('');
  const [kitId, setKitId] = useState<string>(prev?.kitId ?? '');
  const [supplyType, setSupplyType] = useState<string>(prev?.supplyType ?? 'EPC_COMPOSITE');
  const [lines, setLines] = useState<Line[]>(
    prev?.lines.map((l: any) => ({ productId: l.productId, kind: l.kind, name: l.name, specification: l.specification ?? '', hsnSac: l.hsnSac, unit: l.unit, quantity: String(Number(l.quantity)), unitPrice: String(Number(l.unitPrice)) })) ?? [],
  );
  const [panels, setPanels] = useState<number>(prev?.panelCount ?? 0);
  const [lumpSum, setLumpSum] = useState(false);
  const [contract, setContract] = useState('');
  const [showPrices, setShowPrices] = useState<boolean>(prev?.lines.some((l: any) => l.showPrice) ?? false);
  const [includeSubsidy, setIncludeSubsidy] = useState(prev ? Number(prev.subsidyAmount) > 0 : true);
  const [tariff, setTariff] = useState(prev?.tariffPerUnit ? String(Number(prev.tariffPerUnit)) : '');
  const [unitsPerDay, setUnitsPerDay] = useState(prev?.taxSnapshot?.unitsPerKwDay ? String(Number(prev.taxSnapshot.unitsPerKwDay)) : '');
  const [validUntil, setValidUntil] = useState(quotation?.validUntil ? dateInput(quotation.validUntil) : plusDays(30));
  const [milestones, setMilestones] = useState<{ label: string; percent: string }[]>(prev?.milestones.map((m: any) => ({ label: m.label, percent: String(Number(m.percent)) })) ?? []);
  const [terms, setTerms] = useState<string>(prev?.terms ?? '');
  const [notes, setNotes] = useState<string>(prev?.notes ?? '');
  const { busy, error, run } = useAction();

  // Prefill from a customer link, the previous version's products, and company defaults.
  useEffect(() => { if (preset && !customer) { setCustomer(preset); setSiteId(preset.sites[0]?.id ?? ''); } }, [preset, customer]);
  const prefilled = useRef(false);
  useEffect(() => {
    if (!products || prefilled.current) return;
    prefilled.current = true;
    const byCat = (cat: string) => products.filter((p) => p.category === cat);
    const used = (cat: string) => prev?.lines.map((l: any) => products.find((p) => p.id === l.productId)).find((p: any) => p?.category === cat)?.id;
    setModuleId(used('MODULE') ?? (revising ? '' : byCat('MODULE')[0]?.id ?? ''));
    // Largest inverter that does not exceed the system size, else the smallest one.
    const inverters = byCat('INVERTER').sort((a, b) => Number(a.capacityKw ?? 0) - Number(b.capacityKw ?? 0));
    const fit = [...inverters].reverse().find((p) => Number(p.capacityKw ?? 0) <= Number(size)) ?? inverters[0];
    setInverterId(used('INVERTER') ?? (revising ? '' : fit?.id ?? ''));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, prev, revising]);
  useEffect(() => { if (!revising && kits?.length && !kitId) setKitId(kits[0].id); }, [kits, kitId, revising]);
  useEffect(() => {
    if (!company || revising) return;
    const d = company.documentDefaults ?? {};
    setMilestones((m) => (m.length ? m : d.milestones ?? []));
    setTerms((t) => t || company.defaultTerms || '');
    setTariff((t) => t || (Number(d.tariffPerUnit) > 0 ? String(d.tariffPerUnit) : ''));
    setUnitsPerDay((u) => u || String(d.unitsPerKwDay ?? ''));
  }, [company, revising]);
  useEffect(() => { if (revising && company && !unitsPerDay) setUnitsPerDay(String(company.documentDefaults?.unitsPerKwDay ?? '')); }, [company, revising, unitsPerDay]);

  // Size, module, inverter or kit changed → refill the BOM. Skipped on first load of a revision so its saved lines stay.
  const skipFill = useRef(revising);
  useEffect(() => {
    if (!products || !kits || !prefilled.current) return;
    if (skipFill.current) { if (moduleId || inverterId || !products.length) skipFill.current = false; return; }
    if (!isNum(size) || Number(size) <= 0) return;
    const kit = kits.find((k) => k.id === kitId);
    const { panelCount, lines: bom } = expandKit({
      systemSizeKw: size, module: products.find((p) => p.id === moduleId) ?? null, inverter: products.find((p) => p.id === inverterId) ?? null,
      kitItems: kit?.items.map((i: any) => ({ product: i.product, qtyMode: i.qtyMode, quantity: i.quantity, sortOrder: i.sortOrder })) ?? [],
    });
    setPanels(panelCount);
    setLines(bom.map((l) => ({ productId: l.productId, kind: l.kind, name: l.name, specification: l.specification, hsnSac: l.hsnSac, unit: l.unit, quantity: l.quantity.toString(), unitPrice: l.unitPrice.toString() })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size, moduleId, inverterId, kitId, products, kits]);

  const site = customer?.sites?.find((s: any) => s.id === siteId) ?? null;
  const buyerState: string | undefined = site?.stateCode ?? customer?.stateCode;

  const calc = useMemo(() => {
    const valid = lines.every((l) => isNum(l.quantity) && isNum(l.unitPrice)) && isNum(size);
    if (!valid || !taxCfg || !me) return null;
    const linesTotal = lines.reduce((a, l) => a.plus(lineAmount(l.quantity, l.unitPrice)), D(0));
    const contractValue = lumpSum && isNum(contract) ? D(contract) : linesTotal;
    try {
      const tax = computeTax({ contractValue, supplyType: supplyType as any, sellerStateCode: me.companyStateCode, buyerStateCode: buyerState ?? me.companyStateCode, config: taxCfg, systemSizeKw: size });
      const subsidy = includeSubsidy && scheme ? computeSubsidy(size, scheme.slabs, scheme.maxAmount) : D(0);
      const net = tax.total.minus(subsidy);
      const savings = isNum(tariff) && isNum(unitsPerDay) && Number(tariff) > 0 ? estimateSavings({ systemSizeKw: size, unitsPerKwDay: unitsPerDay, tariffPerUnit: tariff, netCost: net }) : null;
      return { linesTotal, contractValue, tax, subsidy, net, savings };
    } catch { return null; }
  }, [lines, size, taxCfg, me, lumpSum, contract, supplyType, buyerState, includeSubsidy, scheme, tariff, unitsPerDay]);

  const patch = (i: number, p: Partial<Line>) => setLines((ls) => ls.map((l, k) => (k === i ? { ...l, ...p } : l)));
  const milestoneTotal = milestones.reduce((a, m) => a + (Number(m.percent) || 0), 0);

  const save = () => run(async () => {
    if (!customer) throw new Error('Pick a customer first');
    const body: any = {
      validUntil: validUntil || null, supplyType, systemSizeKw: size, panelCount: panels || null, kitId: kitId || null,
      lines: lines.map((l) => ({ ...l, showPrice: showPrices })),
      contractValue: lumpSum && contract ? contract : null, includeSubsidy,
      tariffPerUnit: tariff || null, unitsPerKwDay: unitsPerDay || null, milestones, terms, notes,
    };
    if (revising) {
      await api.post(`/quotations/${quotation.id}/revise`, body);
      router.push(`/quotations/${quotation.id}`);
    } else {
      const q = await api.post('/quotations', { ...body, customerId: customer.id, siteId: siteId || null });
      router.push(`/quotations/${q.id}`);
    }
  });

  if (!products || !kits) return <Loading />;
  const modules = products.filter((p) => p.category === 'MODULE');
  const inverters = products.filter((p) => p.category === 'INVERTER');
  const share = taxCfg ? Number(taxCfg.epcGoodsShare) * 100 : 70;
  const taxRows = calc?.tax.lines.map((l) => ({
    label: supplyType === 'EPC_COMPOSITE' ? `GST @ ${Number(l.gstRate)}% on ${l.kind === 'GOODS' ? share : 100 - share}% (${l.kind === 'GOODS' ? 'goods' : 'services'})` : `GST @ ${Number(l.gstRate)}%`,
    amount: l.cgst.plus(l.sgst).plus(l.igst),
  })) ?? [];

  return (
    <form onSubmit={(e) => { e.preventDefault(); save(); }}>
      <PageHeader title={revising ? `Revise ${quotation.number}` : 'New quotation'} sub={revising ? `Saves as version ${prev.version + 1}. Version ${prev.version} stays as it is.` : 'Size and kit fill the bill of materials; adjust anything before saving.'} />
      <ErrorText>{taxError}</ErrorText>
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-4">
          <Card title="1. Customer and site">
            {!customer ? <CustomerPicker onPick={(c) => { setCustomer(c); setSiteId(c.sites?.[0]?.id ?? ''); }} /> : (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="text-sm">
                  <div className="font-medium">{customer.name}</div>
                  <div className="text-muted">{customer.phone} · {customer.city}</div>
                  {!revising && <button type="button" className="mt-1 text-xs text-navy underline" onClick={() => setCustomer(null)}>Change customer</button>}
                </div>
                <Field label="Installation site" hint={buyerState ? `Place of supply: ${stateLabel(buyerState)}` : undefined}>
                  <Select value={siteId} disabled={revising} onChange={(e) => setSiteId(e.target.value)}>
                    <option value="">No site (use billing address)</option>
                    {customer.sites?.map((s: any) => <option key={s.id} value={s.id}>{s.label ?? 'Site'} — {s.addressLine1}, {s.city}</option>)}
                  </Select>
                </Field>
              </div>
            )}
          </Card>

          <Card title="2. System">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="System size (kW)"><Input required inputMode="decimal" value={size} onChange={(e) => setSize(e.target.value)} /></Field>
              <Field label="Supply type">
                <Select value={supplyType} onChange={(e) => setSupplyType(e.target.value)}>
                  <option value="EPC_COMPOSITE">Supply + installation (EPC)</option><option value="SUPPLY_ONLY">Supply only</option><option value="SERVICE_ONLY">Installation only</option>
                </Select>
              </Field>
              <Field label="Module" hint={panels ? `${panels} panels for ${size} kW` : undefined}>
                <Select value={moduleId} onChange={(e) => setModuleId(e.target.value)}><option value="">None</option>{modules.map((p) => <option key={p.id} value={p.id}>{p.wattPeak} Wp — {p.brand ?? p.specification}</option>)}</Select>
              </Field>
              <Field label="Inverter">
                <Select value={inverterId} onChange={(e) => setInverterId(e.target.value)}><option value="">None</option>{inverters.map((p) => <option key={p.id} value={p.id}>{p.capacityKw ? `${Number(p.capacityKw)} kW — ` : ''}{p.brand ?? p.specification}</option>)}</Select>
              </Field>
              <Field label="Kit" className="sm:col-span-2" hint="Changing size, module, inverter or kit refills the lines below.">
                <Select value={kitId} onChange={(e) => setKitId(e.target.value)}><option value="">No kit</option>{kits.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}</Select>
              </Field>
            </div>
          </Card>

          <Card title="3. Bill of materials" action={<Button type="button" size="sm" variant="outline" onClick={() => setLines([...lines, { productId: null, kind: 'GOODS', name: '', specification: '', hsnSac: taxCfg?.goodsHsn ?? '', unit: 'NOS', quantity: '1', unitPrice: '0' }])}>Add line</Button>}>
            <div className="hidden grid-cols-12 gap-2 px-2 text-xs text-muted sm:grid"><span className="col-span-5">Item</span><span className="col-span-7">Specification / make</span></div>
            <div className="space-y-2">
              {lines.map((l, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 rounded-md border border-line/70 p-2">
                  <Input aria-label="Item" className="col-span-12 sm:col-span-5" required placeholder="Item" value={l.name} onChange={(e) => patch(i, { name: e.target.value })} />
                  <Input aria-label="Specification" className="col-span-12 sm:col-span-7" placeholder="Specification / make" value={l.specification} onChange={(e) => patch(i, { specification: e.target.value })} />
                  <Input aria-label="Quantity" className="col-span-3 text-right sm:col-span-2" inputMode="decimal" value={l.quantity} onChange={(e) => patch(i, { quantity: e.target.value })} />
                  <Select aria-label="Unit" className="col-span-4 px-2 sm:col-span-3" value={l.unit} onChange={(e) => patch(i, { unit: e.target.value })}>{UNITS.map((u) => <option key={u} value={u}>{UNIT_LABEL[u]}</option>)}</Select>
                  <Input aria-label="Unit price" className="col-span-5 text-right sm:col-span-3" inputMode="decimal" value={l.unitPrice} onChange={(e) => patch(i, { unitPrice: e.target.value })} />
                  <div className="num col-span-10 self-center text-sm sm:col-span-3">{isNum(l.quantity) && isNum(l.unitPrice) ? inr(lineAmount(l.quantity, l.unitPrice).toString()) : '—'}</div>
                  <button type="button" aria-label={`Remove ${l.name || 'line'}`} className="col-span-2 h-10 rounded text-muted hover:bg-tint sm:col-span-1" onClick={() => setLines(lines.filter((_, k) => k !== i))}>✕</button>
                </div>
              ))}
              {lines.length === 0 && <p className="text-sm text-muted">No lines yet. Pick a module, inverter and kit, or add lines by hand.</p>}
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" checked={showPrices} onChange={(e) => setShowPrices(e.target.checked)} /> Print line amounts on the quotation</label>
              <div>Lines total: <b className="tabular-nums">{calc ? inr(calc.linesTotal.toString()) : '—'}</b></div>
            </div>
          </Card>

          <Card title="4. Price, validity and terms">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={lumpSum} onChange={(e) => { setLumpSum(e.target.checked); if (e.target.checked && calc) setContract(calc.linesTotal.toString()); }} /> Quote a lump-sum system price instead of the lines total</label>
                {lumpSum && <Field label="System price before GST (₹)" className="mt-2 max-w-xs"><Input inputMode="decimal" value={contract} onChange={(e) => setContract(e.target.value)} /></Field>}
              </div>
              <Field label="Valid until"><Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} /></Field>
              <label className="flex items-center gap-2 self-end pb-2 text-sm"><input type="checkbox" checked={includeSubsidy} onChange={(e) => setIncludeSubsidy(e.target.checked)} /> Show subsidy{scheme ? ` (${scheme.name})` : ''}</label>
              <Field label="Electricity tariff (₹ per unit)" hint="Leave empty to hide the savings block"><Input inputMode="decimal" value={tariff} onChange={(e) => setTariff(e.target.value)} /></Field>
              <Field label="Generation (units per kW per day)"><Input inputMode="decimal" value={unitsPerDay} onChange={(e) => setUnitsPerDay(e.target.value)} /></Field>
            </div>
            <div className="mt-4">
              <div className="mb-1 flex items-center justify-between text-xs font-medium text-muted">
                <span>Payment milestones {milestones.length > 0 && <span className={milestoneTotal === 100 ? '' : 'text-red-700'}>(total {milestoneTotal}%{milestoneTotal === 100 ? '' : ' — must be 100%'})</span>}</span>
                <button type="button" className="text-navy underline" onClick={() => setMilestones([...milestones, { label: '', percent: '0' }])}>Add milestone</button>
              </div>
              <div className="space-y-2">
                {milestones.map((m, i) => (
                  <div key={i} className="grid grid-cols-[1fr_5rem_2rem] gap-2">
                    <Input aria-label="Milestone" value={m.label} onChange={(e) => setMilestones(milestones.map((x, k) => (k === i ? { ...x, label: e.target.value } : x)))} />
                    <Input aria-label="Percent" className="text-right" inputMode="decimal" value={m.percent} onChange={(e) => setMilestones(milestones.map((x, k) => (k === i ? { ...x, percent: e.target.value } : x)))} />
                    <button type="button" aria-label="Remove milestone" className="rounded text-muted hover:bg-tint" onClick={() => setMilestones(milestones.filter((_, k) => k !== i))}>✕</button>
                  </div>
                ))}
              </div>
            </div>
            <Field label="Terms and conditions (one per line)" className="mt-4"><Textarea rows={5} value={terms} onChange={(e) => setTerms(e.target.value)} /></Field>
            <Field label="Note to customer (optional)" className="mt-3"><Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
          </Card>
        </div>

        <aside className="space-y-3 lg:sticky lg:top-6">
          <div className="overflow-hidden rounded-lg border border-line bg-white text-sm">
            <Row label={supplyType === 'SERVICE_ONLY' ? 'Service charges' : 'System price'} value={calc ? inr(calc.contractValue.toString()) : '—'} />
            {taxRows.map((r) => <Row key={r.label} label={r.label} value={inr(r.amount.toString())} />)}
            {calc && !calc.tax.roundOff.isZero() && <Row label="Round off" value={inr(calc.tax.roundOff.toString())} />}
            <Row strong label="Total incl. GST" value={calc ? inr(calc.tax.total.toString()) : '—'} />
            {calc && calc.subsidy.gt(0) && <Row label="Less: subsidy" value={`– ${inr(calc.subsidy.toString(), 0)}`} />}
            <div className="flex justify-between bg-navy px-3 py-3 font-semibold text-white"><span>Effective cost</span><span className="tabular-nums">{calc ? inr(calc.net.toString(), 0) : '—'}</span></div>
          </div>
          {calc && <p className="text-xs text-muted">{calc.tax.isInterState ? 'Inter-state supply: IGST applies.' : 'Intra-state supply: CGST + SGST.'}{calc.savings ? ` Est. ${Number(calc.savings.annualGenerationKwh).toLocaleString('en-IN')} units/yr, payback ${calc.savings.paybackYears ?? '—'} years.` : ''}</p>}
          <ErrorText>{error}</ErrorText>
          <Button type="submit" className="w-full" disabled={busy || !customer || !calc || lines.length === 0 || (milestones.length > 0 && milestoneTotal !== 100)}>
            {busy ? 'Saving…' : revising ? `Save as version ${prev.version + 1}` : 'Save quotation'}
          </Button>
          {!customer && <p className="text-center text-xs text-muted">Pick a customer to save.</p>}
        </aside>
      </div>
    </form>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return <div className={`flex justify-between gap-3 border-b border-line/70 px-3 py-2 ${strong ? 'bg-tint font-semibold' : ''}`}><span>{label}</span><span className="tabular-nums whitespace-nowrap">{value}</span></div>;
}
