// Production first-run setup: creates the company, one admin login, the GST settings and the
// subsidy scheme. No sample products, kits or customers. Safe to run again: it does nothing
// once a company exists.
//
// Required env: DATABASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD (12+ characters)
// Optional env: ADMIN_NAME, COMPANY_NAME, COMPANY_STATE_CODE (default 24 = Gujarat), COMPANY_PHONE
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

function need(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Set ${name} before running the production seed`);
  return v;
}

async function main() {
  if (await prisma.company.findFirst()) {
    console.log('Setup skipped: a company already exists.');
    return;
  }
  const email = need('ADMIN_EMAIL').toLowerCase();
  const password = need('ADMIN_PASSWORD');
  if (password.length < 12) throw new Error('ADMIN_PASSWORD must be at least 12 characters');
  const stateCode = process.env.COMPANY_STATE_CODE?.trim() || '24';
  if (!/^\d{2}$/.test(stateCode)) throw new Error('COMPANY_STATE_CODE must be a 2-digit GST state code');

  await prisma.$transaction(async (tx) => {
    const company = await tx.company.create({
      data: {
        name: process.env.COMPANY_NAME?.trim() || 'Nayara Solar Energy',
        stateCode,
        // Placeholders; fill in the real details in Settings after the first sign-in.
        addressLine1: 'Update in Settings',
        city: 'Update in Settings',
        pincode: '000000',
        phone: process.env.COMPANY_PHONE?.trim() || null,
        defaultTerms: [
          'This quotation is valid until the date shown on page 1.',
          'Prices include GST as shown; any change in GST rates at the time of invoicing will apply.',
          'Subsidy is subject to scheme guidelines and approval; the customer remains liable for the full system price.',
          'Generation figures are estimates and not a guarantee of output.',
        ].join('\n'),
        documentDefaults: {
          // Warranty years and milestone percentages are left for you to fill in Settings.
          warranty: [],
          milestones: [],
          scopeIncluded: [
            'Design, supply and installation of the complete system', 'DISCOM application and net-meter liaisoning',
            'Subsidy portal registration and documentation', 'Testing, commissioning and handover training', 'Online generation monitoring setup',
          ],
          scopeExcluded: [
            'Civil work beyond standard structure foundation', 'Extra cable beyond quoted length (charged at actuals)',
            'Load extension or meter-shifting fees by DISCOM', 'Roof repair or waterproofing',
          ],
          documentsRequired: ['Latest electricity bill', 'Aadhaar card', 'PAN card', 'Cancelled cheque / passbook', 'Property ownership proof', 'Passport-size photo'],
          unitsPerKwDay: '4',
          tariffPerUnit: '0',
        },
      },
    });

    await tx.user.create({
      data: {
        name: process.env.ADMIN_NAME?.trim() || 'Admin', email,
        passwordHash: await bcrypt.hash(password, 12),
        memberships: { create: { companyId: company.id, role: 'ADMIN' } },
      },
    });

    // 70:30 composite valuation. The SAC code needs the CA's confirmation; change it in Settings.
    await tx.taxConfig.create({
      data: {
        companyId: company.id, effectiveFrom: new Date('2025-09-22T00:00:00+05:30'),
        epcGoodsShare: '0.7000', goodsRate: '5.00', serviceRate: '18.00', goodsHsn: '8541', serviceSac: '9954',
        note: 'Initial settings. Confirm the SAC code and rates with the CA.',
      },
    });

    await tx.subsidyScheme.create({
      data: {
        companyId: company.id, name: 'PM Surya Ghar subsidy', effectiveFrom: new Date('2024-02-13T00:00:00+05:30'), maxAmount: '78000.00',
        slabs: { create: [{ fromKw: '0', toKw: '2', amountPerKw: '30000.00' }, { fromKw: '2', toKw: '3', amountPerKw: '18000.00' }] },
      },
    });
  });
  // Number series are created automatically (NSE/Q/, NSE/, NSE/PI/, NSE/CN/) on the first document of each financial year.
  console.log(`Setup done. Sign in as ${email}, then complete the company details in Settings.`);
}

main()
  .catch((e) => { console.error(e.message ?? e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
