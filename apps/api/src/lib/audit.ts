import type { Tx } from '../db';
import type { Ctx } from './http';

export type AuditAction = 'CREATE' | 'UPDATE' | 'ISSUE' | 'CANCEL' | 'DELETE' | 'STATUS' | 'PAYMENT';

export function audit(tx: Tx, ctx: Ctx, entity: string, entityId: string, action: AuditAction, diff?: unknown) {
  return tx.auditLog.create({
    data: {
      companyId: ctx.companyId,
      userId: ctx.userId,
      entity,
      entityId,
      action,
      diff: diff === undefined ? undefined : JSON.parse(JSON.stringify(diff)),
    },
  });
}
