// Imports products from a CSV file into the company. Rows are matched on `sku`: an existing
// product with the same SKU is updated, otherwise a new one is created. Nothing is deleted.
//
// Required env: DATABASE_URL
// Optional env: PRODUCTS_CSV (default: catalogue/products.csv at the repo root),
//               COMPANY_ID (only needed if the database has more than one company),
//               DRY_RUN=1 (check the file and print what would change, without saving)
//
// Columns: sku,name,category,brand,model,specification,unit,hsnSac,gstRate,price,wattPeak,capacityKw,isActive
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Prisma, PrismaClient, ProductCategory, Unit } from '@prisma/client';

const prisma = new PrismaClient();
const DEFAULT_CSV = fileURLToPath(new URL('../../../catalogue/products.csv', import.meta.url));

// Minimal CSV parser: commas, double-quoted fields, "" escapes, CRLF or LF line endings.
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((f) => f.trim() !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f.trim() !== '')) rows.push(row);
  return rows;
}

const REQUIRED = ['sku', 'name', 'category', 'unit', 'hsnSac', 'gstRate', 'price'] as const;
const CATEGORIES = Object.values(ProductCategory) as string[];
const UNITS = Object.values(Unit) as string[];

function decimal(value: string, label: string, opts: { min?: number; max?: number } = {}): string {
  const v = value.replace(/[₹,\s]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(v)) throw new Error(`${label} must be a number with up to 2 decimals (got "${value}")`);
  const n = Number(v);
  if (opts.min !== undefined && n < opts.min) throw new Error(`${label} must be at least ${opts.min}`);
  if (opts.max !== undefined && n > opts.max) throw new Error(`${label} must be at most ${opts.max}`);
  return v;
}

function toProduct(rec: Record<string, string>, line: number) {
  const at = (msg: string) => new Error(`Line ${line} (${rec.sku || 'no sku'}): ${msg}`);
  try {
    for (const k of REQUIRED) if (!rec[k]?.trim()) throw new Error(`${k} is required`);
    const category = rec.category.trim().toUpperCase();
    if (!CATEGORIES.includes(category)) throw new Error(`category must be one of ${CATEGORIES.join(', ')}`);
    const unit = rec.unit.trim().toUpperCase();
    if (!UNITS.includes(unit)) throw new Error(`unit must be one of ${UNITS.join(', ')}`);
    const hsnSac = rec.hsnSac.trim();
    if (!/^\d{4,8}$/.test(hsnSac)) throw new Error('hsnSac must be 4 to 8 digits');
    const wattPeak = rec.wattPeak?.trim() ? Number(rec.wattPeak) : null;
    if (wattPeak !== null && (!Number.isInteger(wattPeak) || wattPeak <= 0)) throw new Error('wattPeak must be a whole number');
    if (category === 'MODULE' && !wattPeak) throw new Error('wattPeak is required for modules');
    const capacityKw = rec.capacityKw?.trim() ? decimal(rec.capacityKw, 'capacityKw', { min: 0.01 }) : null;
    if (category === 'INVERTER' && !capacityKw) throw new Error('capacityKw is required for inverters');
    const active = (rec.isActive ?? '').trim().toLowerCase();
    const opt = (k: string) => rec[k]?.trim() || null;
    return {
      sku: rec.sku.trim(),
      name: rec.name.trim(),
      category: category as ProductCategory,
      brand: opt('brand'),
      model: opt('model'),
      specification: opt('specification'),
      unit: unit as Unit,
      hsnSac,
      gstRate: new Prisma.Decimal(decimal(rec.gstRate, 'gstRate', { min: 0, max: 28 })),
      price: new Prisma.Decimal(decimal(rec.price, 'price', { min: 0 })),
      wattPeak,
      capacityKw: capacityKw === null ? null : new Prisma.Decimal(capacityKw),
      isActive: !['false', 'no', '0', 'n'].includes(active),
    };
  } catch (e) {
    throw at((e as Error).message);
  }
}

async function main() {
  const file = resolve(process.env.PRODUCTS_CSV?.trim() || DEFAULT_CSV);
  const dryRun = process.env.DRY_RUN === '1';
  const rows = parseCsv(readFileSync(file, 'utf8').replace(/^﻿/, ''));
  if (rows.length < 2) throw new Error(`${file} has no product rows`);

  const header = rows[0].map((h) => h.trim());
  const missing = REQUIRED.filter((k) => !header.includes(k));
  if (missing.length) throw new Error(`CSV header is missing: ${missing.join(', ')}`);

  const errors: string[] = [];
  const products: ReturnType<typeof toProduct>[] = [];
  const seen = new Set<string>();
  rows.slice(1).forEach((cells, i) => {
    const rec = Object.fromEntries(header.map((h, j) => [h, cells[j] ?? '']));
    try {
      const p = toProduct(rec, i + 2);
      if (seen.has(p.sku)) throw new Error(`Line ${i + 2}: duplicate sku ${p.sku}`);
      seen.add(p.sku);
      products.push(p);
    } catch (e) {
      errors.push((e as Error).message);
    }
  });
  if (errors.length) throw new Error(`Fix these rows and run again (nothing was saved):\n  ${errors.join('\n  ')}`);

  const companies = await prisma.company.findMany({ select: { id: true, name: true } });
  const companyId = process.env.COMPANY_ID?.trim();
  const company = companyId ? companies.find((c) => c.id === companyId) : companies.length === 1 ? companies[0] : undefined;
  if (!company) {
    throw new Error(companies.length === 0
      ? 'No company found. Run db:seed:prod first.'
      : `Set COMPANY_ID to one of: ${companies.map((c) => `${c.id} (${c.name})`).join(', ')}`);
  }

  const existing = new Set((await prisma.product.findMany({
    where: { companyId: company.id, sku: { in: products.map((p) => p.sku) } }, select: { sku: true },
  })).map((p) => p.sku));
  const created = products.filter((p) => !existing.has(p.sku)).length;
  const updated = products.length - created;

  if (dryRun) {
    console.log(`Dry run for ${company.name}: ${created} to create, ${updated} to update. Nothing saved.`);
    return;
  }

  await prisma.$transaction(
    products.map(({ sku, ...data }) => prisma.product.upsert({
      where: { companyId_sku: { companyId: company.id, sku } },
      create: { companyId: company.id, sku, ...data },
      update: data,
    })),
  );
  console.log(`Imported into ${company.name}: ${created} created, ${updated} updated.`);
}

main()
  .catch((e) => { console.error(e.message ?? e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
