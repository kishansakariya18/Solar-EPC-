import type { z } from 'zod';
import { prisma } from '../db';
import { audit } from '../lib/audit';
import { notFound, type Ctx } from '../lib/http';
import type { customerSchema, siteSchema } from '../schemas';

export function listCustomers(ctx: Ctx, q?: string) {
  const term = q?.trim();
  return prisma.customer.findMany({
    where: {
      companyId: ctx.companyId,
      ...(term ? { OR: [{ name: { contains: term, mode: 'insensitive' } }, { phone: { contains: term } }] } : {}),
    },
    orderBy: { createdAt: 'desc' }, take: 100,
    include: { sites: true, _count: { select: { quotations: true } } },
  });
}

export async function getCustomer(ctx: Ctx, id: string) {
  const c = await prisma.customer.findFirst({
    where: { id, companyId: ctx.companyId },
    include: { sites: true, quotations: { orderBy: { createdAt: 'desc' }, include: { versions: { orderBy: { version: 'desc' }, take: 1 } } } },
  });
  if (!c) throw notFound('Customer');
  return c;
}

export function createCustomer(ctx: Ctx, input: z.infer<typeof customerSchema>) {
  const { site, ...data } = input;
  return prisma.$transaction(async (tx) => {
    const c = await tx.customer.create({
      data: { ...data, companyId: ctx.companyId, sites: site ? { create: site } : undefined },
      include: { sites: true },
    });
    await audit(tx, ctx, 'Customer', c.id, 'CREATE');
    return c;
  });
}

export async function updateCustomer(ctx: Ctx, id: string, input: z.infer<typeof customerSchema>) {
  await getCustomer(ctx, id);
  const { site: _site, ...data } = input;
  return prisma.$transaction(async (tx) => {
    const c = await tx.customer.update({ where: { id }, data, include: { sites: true } });
    await audit(tx, ctx, 'Customer', id, 'UPDATE', data);
    return c;
  });
}

export async function addSite(ctx: Ctx, customerId: string, input: z.infer<typeof siteSchema>) {
  await getCustomer(ctx, customerId);
  return prisma.site.create({ data: { ...input, customerId } });
}

export async function updateSite(ctx: Ctx, siteId: string, input: z.infer<typeof siteSchema>) {
  const site = await prisma.site.findFirst({ where: { id: siteId, customer: { companyId: ctx.companyId } } });
  if (!site) throw notFound('Site');
  return prisma.site.update({ where: { id: siteId }, data: input });
}
