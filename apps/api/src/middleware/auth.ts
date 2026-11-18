import type { Role } from '@prisma/client';
import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../db';
import { env } from '../env';
import { HttpError, type Ctx } from '../lib/http';

declare global {
  namespace Express {
    interface Request {
      auth: Ctx;
    }
  }
}

export function signToken(ctx: { userId: string; companyId: string }): string {
  return jwt.sign(ctx, env.jwtSecret, { expiresIn: '12h' });
}

/** Verifies the token, then loads the role from the database so a removed or changed membership takes effect at once. */
export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new HttpError(401, 'Sign in required');
  let payload: { userId: string; companyId: string };
  try {
    payload = jwt.verify(token, env.jwtSecret) as typeof payload;
  } catch {
    throw new HttpError(401, 'Session expired, sign in again');
  }
  const membership = await prisma.membership.findUnique({
    where: { companyId_userId: { companyId: payload.companyId, userId: payload.userId } },
    include: { user: { select: { isActive: true } } },
  });
  if (!membership || !membership.user.isActive) throw new HttpError(401, 'Account is not active');
  req.auth = { userId: payload.userId, companyId: payload.companyId, role: membership.role };
  next();
}

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!roles.includes(req.auth.role)) throw new HttpError(403, 'Your role cannot do this');
    next();
  };
}
