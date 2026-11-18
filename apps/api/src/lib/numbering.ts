import type { DocType } from '@prisma/client';
import { financialYear, formatDocNumber } from '@solar-epc/core';
import type { Tx } from '../db';

const DEFAULT_PREFIX: Record<DocType, string> = {
  QUOTATION: 'NSE/Q/',
  PROFORMA: 'NSE/PI/',
  TAX_INVOICE: 'NSE/',
  CREDIT_NOTE: 'NSE/CN/',
  DEBIT_NOTE: 'NSE/DN/',
};

/**
 * Next number in the FY series for a document type. Must run inside the same transaction
 * as the status change: the series row is locked (FOR UPDATE) so two issues can never
 * get the same number, and a rolled-back issue never burns one.
 */
export async function nextDocNumber(tx: Tx, companyId: string, docType: DocType, date = new Date()): Promise<string> {
  const fy = financialYear(date);
  const existing = await tx.numberSeries.findUnique({
    where: { companyId_docType_financialYear: { companyId, docType, financialYear: fy } },
  });
  if (!existing) {
    const previous = await tx.numberSeries.findFirst({ where: { companyId, docType }, orderBy: { financialYear: 'desc' } });
    await tx.numberSeries.createMany({
      data: [{ companyId, docType, financialYear: fy, prefix: previous?.prefix ?? DEFAULT_PREFIX[docType], padding: previous?.padding ?? 4 }],
      skipDuplicates: true,
    });
  }
  const rows = await tx.$queryRaw<{ id: string; prefix: string; nextNumber: number; padding: number }[]>`
    SELECT "id", "prefix", "nextNumber", "padding" FROM "NumberSeries"
    WHERE "companyId" = ${companyId} AND "docType" = ${docType}::"DocType" AND "financialYear" = ${fy}
    FOR UPDATE`;
  const series = rows[0];
  await tx.numberSeries.update({ where: { id: series.id }, data: { nextNumber: series.nextNumber + 1 } });
  return formatDocNumber(series.prefix, fy, series.nextNumber, series.padding);
}
