import type { z } from 'zod';
import { prisma } from '../db';
import { audit } from '../lib/audit';
import { badRequest, type Ctx } from '../lib/http';
import type { subsidySchemeSchema, taxConfigSchema } from '../schemas';

export const listTaxConfigs = (ctx: Ctx) =>
  prisma.taxConfig.findMany({ where: { companyId: ctx.companyId }, orderBy: { effectiveFrom: 'desc' } });

/** The tax config in force on a date: the latest one whose effectiveFrom is not in the future. */
export async function activeTaxConfig(companyId: string, on = new Date()) {
  const cfg = await prisma.taxConfig.findFirst({ where: { companyId, effectiveFrom: { lte: on } }, orderBy: { effectiveFrom: 'desc' } });
  if (!cfg) throw badRequest('No tax settings are in force. Add them in Settings first.');
  return cfg;
}

/** Tax configs are never edited: a change is a new row with its own effective date. */
export function createTaxConfig(ctx: Ctx, data: z.infer<typeof taxConfigSchema>) {
  return prisma.$transaction(async (tx) => {
    const cfg = await tx.taxConfig.create({ data: { ...data, companyId: ctx.companyId } });
    await audit(tx, ctx, 'TaxConfig', cfg.id, 'CREATE', data);
    return cfg;
  });
}

export const listSubsidySchemes = (ctx: Ctx) =>
  prisma.subsidyScheme.findMany({ where: { companyId: ctx.companyId }, orderBy: { effectiveFrom: 'desc' }, include: { slabs: { orderBy: { fromKw: 'asc' } } } });

export function activeSubsidyScheme(companyId: string, on = new Date()) {
  return prisma.subsidyScheme.findFirst({
    where: { companyId, isActive: true, effectiveFrom: { lte: on }, OR: [{ effectiveTo: null }, { effectiveTo: { gte: on } }] },
    orderBy: { effectiveFrom: 'desc' }, include: { slabs: { orderBy: { fromKw: 'asc' } } },
  });
}

/** A new scheme version supersedes earlier ones from its effective date. */
export function createSubsidyScheme(ctx: Ctx, input: z.infer<typeof subsidySchemeSchema>) {
  const { slabs, ...data } = input;
  return prisma.$transaction(async (tx) => {
    const s = await tx.subsidyScheme.create({ data: { ...data, companyId: ctx.companyId, slabs: { create: slabs } }, include: { slabs: true } });
    await audit(tx, ctx, 'SubsidyScheme', s.id, 'CREATE', input);
    return s;
  });
}
