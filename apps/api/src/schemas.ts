import { z } from 'zod';

const decimalString = z
  .union([z.string(), z.number()])
  .transform((v) => String(v).trim())
  .refine((v) => /^\d+(\.\d+)?$/.test(v), 'must be a non-negative number');
const optionalText = z.string().trim().optional().nullable().transform((v) => (v ? v : null));
const stateCode = z.string().regex(/^\d{2}$/, 'must be a 2-digit GST state code');
const gstin = z
  .string().trim().toUpperCase()
  .regex(/^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/, 'is not a valid GSTIN')
  .optional().nullable().or(z.literal('').transform(() => null));
const date = z.coerce.date();

export const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

export const companySchema = z.object({
  name: z.string().trim().min(1), legalName: optionalText, gstin, stateCode,
  addressLine1: z.string().trim().min(1), addressLine2: optionalText, city: z.string().trim().min(1),
  pincode: z.string().trim().min(1), phone: optionalText, email: optionalText, website: optionalText, logoUrl: optionalText,
  bankName: optionalText, bankBranch: optionalText, accountName: optionalText, accountNumber: optionalText,
  ifsc: optionalText, upiId: optionalText, defaultTerms: optionalText, jurisdiction: optionalText,
  documentDefaults: z.object({
    warranty: z.array(z.object({ component: z.string(), coverage: z.string() })),
    scopeIncluded: z.array(z.string()), scopeExcluded: z.array(z.string()), documentsRequired: z.array(z.string()),
    milestones: z.array(z.object({ label: z.string(), percent: decimalString })),
    unitsPerKwDay: decimalString, tariffPerUnit: decimalString,
  }).optional(),
});

export const siteSchema = z.object({
  label: optionalText, addressLine1: z.string().trim().min(1), addressLine2: optionalText,
  city: z.string().trim().min(1), pincode: z.string().trim().min(1), stateCode,
  discomName: optionalText, consumerNumber: optionalText,
  sanctionedLoadKw: decimalString.optional().nullable().or(z.literal('').transform(() => null)),
  phase: z.enum(['SINGLE', 'THREE']).optional().nullable(), roofType: optionalText,
});

export const customerSchema = z.object({
  name: z.string().trim().min(1), phone: z.string().trim().min(6), email: optionalText, gstin,
  addressLine1: z.string().trim().min(1), addressLine2: optionalText, city: z.string().trim().min(1),
  pincode: z.string().trim().min(1), stateCode,
  site: siteSchema.optional(),
});

export const productSchema = z.object({
  sku: optionalText, name: z.string().trim().min(1),
  category: z.enum(['MODULE', 'INVERTER', 'STRUCTURE', 'CABLE_DC', 'CABLE_AC', 'DISTRIBUTION_BOX', 'EARTHING', 'LIGHTNING_ARRESTER', 'NET_METER', 'BATTERY', 'SERVICE', 'OTHER']),
  brand: optionalText, model: optionalText, specification: optionalText,
  unit: z.enum(['NOS', 'SET', 'M', 'KW', 'JOB', 'LOT']), hsnSac: z.string().trim().min(2),
  gstRate: decimalString, price: decimalString,
  wattPeak: z.coerce.number().int().positive().optional().nullable(),
  capacityKw: decimalString.optional().nullable().or(z.literal('').transform(() => null)),
  isActive: z.boolean().optional(),
});

export const kitSchema = z.object({
  name: z.string().trim().min(1), description: optionalText,
  systemSizeKw: decimalString.optional().nullable().or(z.literal('').transform(() => null)),
  phase: z.enum(['SINGLE', 'THREE']).optional().nullable(), isActive: z.boolean().optional(),
  items: z.array(z.object({ productId: z.string(), qtyMode: z.enum(['FIXED', 'PER_PANEL', 'PER_KW']), quantity: decimalString })).min(1),
});

export const taxConfigSchema = z.object({
  effectiveFrom: date,
  epcGoodsShare: decimalString.refine((v) => Number(v) > 0 && Number(v) < 1, 'must be between 0 and 1'),
  goodsRate: decimalString, serviceRate: decimalString,
  goodsHsn: z.string().trim().min(2), serviceSac: z.string().trim().min(2), note: optionalText,
});

export const subsidySchemeSchema = z.object({
  name: z.string().trim().min(1), effectiveFrom: date,
  maxAmount: decimalString.optional().nullable(),
  slabs: z.array(z.object({ fromKw: decimalString, toKw: decimalString, amountPerKw: decimalString })).min(1),
});

export const quotationVersionSchema = z.object({
  validUntil: date.optional().nullable(),
  supplyType: z.enum(['EPC_COMPOSITE', 'SUPPLY_ONLY', 'SERVICE_ONLY']).default('EPC_COMPOSITE'),
  systemSizeKw: decimalString, panelCount: z.coerce.number().int().min(0).optional().nullable(),
  kitId: z.string().optional().nullable(),
  lines: z.array(z.object({
    productId: z.string().optional().nullable(), kind: z.enum(['GOODS', 'SERVICE']),
    name: z.string().trim().min(1), specification: optionalText, hsnSac: z.string().trim().min(2),
    unit: z.enum(['NOS', 'SET', 'M', 'KW', 'JOB', 'LOT']), quantity: decimalString, unitPrice: decimalString,
    showPrice: z.boolean().optional(),
  })).min(1),
  // Lump-sum system price. When absent, the contract value is the sum of the lines.
  contractValue: decimalString.optional().nullable().or(z.literal('').transform(() => null)),
  includeSubsidy: z.boolean().default(true),
  tariffPerUnit: decimalString.optional().nullable().or(z.literal('').transform(() => null)),
  unitsPerKwDay: decimalString.optional().nullable().or(z.literal('').transform(() => null)),
  milestones: z.array(z.object({ label: z.string().trim().min(1), percent: decimalString })).default([]),
  terms: optionalText, notes: optionalText,
});

export const quotationCreateSchema = quotationVersionSchema.extend({ customerId: z.string(), siteId: z.string().optional().nullable() });
export const quotationStatusSchema = z.object({ status: z.enum(['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED']) });

export const invoiceCreateSchema = z.object({
  quotationId: z.string(), version: z.coerce.number().int().positive().optional(),
  type: z.enum(['PROFORMA', 'TAX_INVOICE']), milestoneLabel: optionalText, dueDate: date.optional().nullable(),
});
export const invoiceUpdateSchema = z.object({
  contractValue: decimalString.optional(), milestoneLabel: optionalText, dueDate: date.optional().nullable(),
  reverseCharge: z.boolean().optional(),
});
export const paymentSchema = z.object({
  amount: decimalString.refine((v) => Number(v) > 0, 'must be more than zero'), receivedOn: date,
  mode: z.enum(['UPI', 'NEFT_RTGS', 'CHEQUE', 'CASH']), reference: optionalText, note: optionalText,
});
export const creditNoteSchema = z.object({
  reason: z.string().trim().min(3), taxableValue: decimalString.refine((v) => Number(v) > 0, 'must be more than zero'),
});

export type QuotationVersionInput = z.infer<typeof quotationVersionSchema>;
export type QuotationCreateInput = z.infer<typeof quotationCreateSchema>;
