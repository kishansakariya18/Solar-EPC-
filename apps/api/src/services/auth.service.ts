import bcrypt from 'bcryptjs';
import { prisma } from '../db';
import { HttpError, type Ctx } from '../lib/http';
import { signToken } from '../middleware/auth';

export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() }, include: { memberships: { include: { company: true } } } });
  const ok = user?.passwordHash ? await bcrypt.compare(password, user.passwordHash) : false;
  if (!user || !ok || !user.isActive || user.memberships.length === 0) throw new HttpError(401, 'Wrong email or password');
  const m = user.memberships[0];
  return {
    token: signToken({ userId: user.id, companyId: m.companyId }),
    user: { id: user.id, name: user.name, email: user.email, role: m.role, companyName: m.company.name },
  };
}

export async function me(ctx: Ctx) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: ctx.userId } });
  const company = await prisma.company.findUniqueOrThrow({ where: { id: ctx.companyId } });
  return { id: user.id, name: user.name, email: user.email, role: ctx.role, companyName: company.name, companyStateCode: company.stateCode };
}
