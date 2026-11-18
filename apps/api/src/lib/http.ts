import type { Role } from '@prisma/client';

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}
export const notFound = (what: string) => new HttpError(404, `${what} not found`);
export const badRequest = (msg: string) => new HttpError(400, msg);
export const conflict = (msg: string) => new HttpError(409, msg);

/** Who is calling: every service takes this and scopes queries by companyId. */
export interface Ctx {
  userId: string;
  companyId: string;
  role: Role;
}
