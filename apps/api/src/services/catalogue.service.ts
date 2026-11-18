import type { z } from 'zod';
import { prisma } from '../db';
import { audit } from '../lib/audit';
import { badRequest, notFound, type Ctx } from '../lib/http';
import type { kitSchema, productSchema } from '../schemas';

export const listProducts = (ctx: Ctx, includeInactive = false) =>
  prisma.product.findMany({
    where: { companyId: ctx.companyId, ...(includeInactive ? {} : { isActive: true }) },
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
  });

export function createProduct(ctx: Ctx, data: z.infer<typeof productSchema>) {
  return prisma.$transaction(async (tx) => {
    const p = await tx.product.create({ data: { ...data, companyId: ctx.companyId } });
    await audit(tx, ctx, 'Product', p.id, 'CREATE');
    return p;
  });
}

export async function updateProduct(ctx: Ctx, id: string, data: z.infer<typeof productSchema>) {
  const existing = await prisma.product.findFirst({ where: { id, companyId: ctx.companyId } });
  if (!existing) throw notFound('Product');
  return prisma.$transaction(async (tx) => {
    const p = await tx.product.update({ where: { id }, data });
    await audit(tx, ctx, 'Product', id, 'UPDATE', data);
    return p;
  });
}

const kitInclude = { items: { orderBy: { sortOrder: 'asc' as const }, include: { product: true } } };

export const listKits = (ctx: Ctx) =>
  prisma.kit.findMany({ where: { companyId: ctx.companyId, isActive: true }, orderBy: { name: 'asc' }, include: kitInclude });

async function checkProducts(ctx: Ctx, ids: string[]) {
  const count = await prisma.product.count({ where: { companyId: ctx.companyId, id: { in: ids } } });
  if (count !== new Set(ids).size) throw badRequest('A kit item refers to a product that does not exist');
}

export async function createKit(ctx: Ctx, input: z.infer<typeof kitSchema>) {
  const { items, ...data } = input;
  await checkProducts(ctx, items.map((i) => i.productId));
  return prisma.$transaction(async (tx) => {
    const kit = await tx.kit.create({
      data: { ...data, companyId: ctx.companyId, items: { create: items.map((it, i) => ({ ...it, sortOrder: i })) } },
      include: kitInclude,
    });
    await audit(tx, ctx, 'Kit', kit.id, 'CREATE');
    return kit;
  });
}

export async function updateKit(ctx: Ctx, id: string, input: z.infer<typeof kitSchema>) {
  const existing = await prisma.kit.findFirst({ where: { id, companyId: ctx.companyId } });
  if (!existing) throw notFound('Kit');
  const { items, ...data } = input;
  await checkProducts(ctx, items.map((i) => i.productId));
  return prisma.$transaction(async (tx) => {
    await tx.kitItem.deleteMany({ where: { kitId: id } });
    const kit = await tx.kit.update({
      where: { id },
      data: { ...data, items: { create: items.map((it, i) => ({ ...it, sortOrder: i })) } },
      include: kitInclude,
    });
    await audit(tx, ctx, 'Kit', id, 'UPDATE');
    return kit;
  });
}
