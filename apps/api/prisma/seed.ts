// Development seed. Prices, kits and company details below are SAMPLE values so the app
// can be tried end to end — replace them with the real Phase 0 data (price list, kits, GSTIN, bank).
import { PrismaClient, type ProductCategory, type Unit } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  if (await prisma.company.findFirst({ where: { name: 'Nayara Solar Energy' } })) {
    console.log('Seed skipped: company already exists.');
    return;
  }
  const password = process.env.SEED_PASSWORD;
  if (!password) throw new Error('Set SEED_PASSWORD in apps/api/.env before seeding');
  const passwordHash = await bcrypt.hash(password, 10);

  const company = await prisma.company.create({
    data: {
      name: 'Nayara Solar Energy', stateCode: '24',
      addressLine1: 'Address (update in Settings)', city: 'City', pincode: '000000',
      phone: '+91 99099 12827', accountName: 'Nayara Solar Energy',
      defaultTerms: [
        'This quotation is valid until the date shown on page 1.',
        'Prices include GST as shown; any change in GST rates at the time of invoicing will apply.',
        'Subsidy is subject to scheme guidelines and approval; the customer remains liable for the full system price.',
        'Installation within 15 working days of advance payment and site readiness.',
        'Generation figures are estimates and not a guarantee of output.',
      ].join('\n'),
      documentDefaults: {
        warranty: [
          { component: 'PV modules', coverage: '12 yrs product, 25 yrs performance' },
          { component: 'Inverter', coverage: '8 yrs (manufacturer)' },
          { component: 'Structure', coverage: '5 yrs against corrosion' },
          { component: 'Workmanship', coverage: '5 yrs from commissioning' },
        ],
        scopeIncluded: [
          'Design, supply and installation of the complete system', 'DISCOM application and net-meter liaisoning',
          'Subsidy portal registration and documentation', 'Testing, commissioning and handover training', 'Online generation monitoring setup',
        ],
        scopeExcluded: [
          'Civil work beyond standard structure foundation', 'Extra cable beyond quoted length (charged at actuals)',
          'Load extension or meter-shifting fees by DISCOM', 'Roof repair or waterproofing',
        ],
        documentsRequired: ['Latest electricity bill', 'Aadhaar card', 'PAN card', 'Cancelled cheque / passbook', 'Property ownership proof', 'Passport-size photo'],
        milestones: [
          { label: 'On order confirmation', percent: '30' }, { label: 'On material delivery', percent: '60' }, { label: 'On commissioning', percent: '10' },
        ],
        unitsPerKwDay: '4', tariffPerUnit: '7',
      },
    },
  });
  const companyId = company.id;

  for (const [name, email, role] of [
    ['Admin', 'admin@nayarasolar.test', 'ADMIN'], ['Sales', 'sales@nayarasolar.test', 'SALES'], ['Accounts', 'accounts@nayarasolar.test', 'ACCOUNTS'],
  ] as const) {
    await prisma.user.create({ data: { name, email, passwordHash, memberships: { create: { companyId, role } } } });
  }

  // Rates and codes to be confirmed by the CA before go-live.
  await prisma.taxConfig.create({
    data: {
      companyId, effectiveFrom: new Date('2025-09-22T00:00:00+05:30'), epcGoodsShare: '0.7000', goodsRate: '5.00', serviceRate: '18.00',
      goodsHsn: '8541', serviceSac: '9954', note: '70:30 composite valuation. SAC code pending CA confirmation.',
    },
  });
  await prisma.subsidyScheme.create({
    data: {
      companyId, name: 'PM Surya Ghar subsidy', effectiveFrom: new Date('2024-02-13T00:00:00+05:30'), maxAmount: '78000.00',
      slabs: { create: [{ fromKw: '0', toKw: '2', amountPerKw: '30000.00' }, { fromKw: '2', toKw: '3', amountPerKw: '18000.00' }] },
    },
  });
  await prisma.numberSeries.createMany({
    data: [
      { companyId, docType: 'QUOTATION', financialYear: '26-27', prefix: 'NSE/Q/' },
      { companyId, docType: 'TAX_INVOICE', financialYear: '26-27', prefix: 'NSE/' },
      { companyId, docType: 'PROFORMA', financialYear: '26-27', prefix: 'NSE/PI/' },
      { companyId, docType: 'CREDIT_NOTE', financialYear: '26-27', prefix: 'NSE/CN/' },
    ],
  });

  type P = [sku: string, name: string, category: ProductCategory, brand: string | null, specification: string, unit: Unit, hsnSac: string, gstRate: string, price: string, extra?: { wattPeak?: number; capacityKw?: string }];
  const products: P[] = [
    ['MOD-550-TOPCON', 'Solar PV modules', 'MODULE', 'Waaree', '550 Wp, Waaree, TOPCon, DCR, ALMM listed', 'NOS', '8541', '5', '14300.00', { wattPeak: 550 }],
    ['MOD-540-PERC', 'Solar PV modules', 'MODULE', 'Adani', '540 Wp, Adani, Mono PERC, DCR, ALMM listed', 'NOS', '8541', '5', '13000.00', { wattPeak: 540 }],
    ['INV-2K-1P', 'Grid-tie inverter', 'INVERTER', 'Growatt', '2 kW, Growatt, single phase, with Wi-Fi monitoring', 'NOS', '8504', '5', '17500.00', { capacityKw: '2' }],
    ['INV-3K-1P', 'Grid-tie inverter', 'INVERTER', 'Growatt', '3 kW, Growatt, single phase, with Wi-Fi monitoring', 'NOS', '8504', '5', '22000.00', { capacityKw: '3' }],
    ['INV-5K-1P', 'Grid-tie inverter', 'INVERTER', 'Growatt', '5 kW, Growatt, single phase, with Wi-Fi monitoring', 'NOS', '8504', '5', '34000.00', { capacityKw: '5' }],
    ['STR-STD', 'Mounting structure', 'STRUCTURE', null, 'Hot-dip galvanised, standard height', 'KW', '7308', '18', '5500.00'],
    ['STR-ELV', 'Mounting structure', 'STRUCTURE', null, 'Hot-dip galvanised, 8 ft elevated', 'KW', '7308', '18', '8000.00'],
    ['CAB-DC-4', 'DC cable', 'CABLE_DC', 'Polycab', '4 sq mm Cu, solar grade, Polycab', 'M', '8544', '18', '65.00'],
    ['CAB-AC-4', 'AC cable', 'CABLE_AC', 'Polycab', '4 sq mm Cu, Polycab', 'M', '8544', '18', '110.00'],
    ['DB-ACDC', 'ACDB / DCDB', 'DISTRIBUTION_BOX', null, 'With SPD, MCB and fuse protection', 'SET', '8537', '18', '6500.00'],
    ['EARTH-3', 'Earthing', 'EARTHING', null, 'Chemical earthing, 3 pits', 'SET', '8538', '18', '7500.00'],
    ['LA-CU', 'Lightning arrester', 'LIGHTNING_ARRESTER', null, 'Copper conventional type', 'NOS', '8535', '18', '2500.00'],
    ['NET-METER', 'Net meter', 'NET_METER', null, 'Bi-directional meter, DISCOM charges', 'NOS', '9028', '18', '6000.00'],
    ['SVC-INSTALL', 'Installation & commissioning', 'SERVICE', null, 'Transport, installation, testing, liaisoning', 'JOB', '9954', '18', '18000.00'],
  ];
  const ids: Record<string, string> = {};
  for (const [sku, name, category, brand, specification, unit, hsnSac, gstRate, price, extra] of products) {
    const p = await prisma.product.create({ data: { companyId, sku, name, category, brand, specification, unit, hsnSac, gstRate, price, ...extra } });
    ids[sku] = p.id;
  }

  const kit = (name: string, description: string, structure: string) =>
    prisma.kit.create({
      data: {
        companyId, name, description, phase: 'SINGLE',
        items: {
          create: [
            { productId: ids[structure], qtyMode: 'PER_KW', quantity: '1' },
            { productId: ids['CAB-DC-4'], qtyMode: 'PER_PANEL', quantity: '5' },
            { productId: ids['CAB-AC-4'], qtyMode: 'FIXED', quantity: '20' },
            { productId: ids['DB-ACDC'], qtyMode: 'FIXED', quantity: '1' },
            { productId: ids['EARTH-3'], qtyMode: 'FIXED', quantity: '1' },
            { productId: ids['LA-CU'], qtyMode: 'FIXED', quantity: '1' },
            { productId: ids['NET-METER'], qtyMode: 'FIXED', quantity: '1' },
            { productId: ids['SVC-INSTALL'], qtyMode: 'FIXED', quantity: '1' },
          ].map((it, i) => ({ ...it, sortOrder: i })) as never,
        },
      },
    });
  await kit('On-Grid Residential – Standard', 'Single phase, standard-height structure', 'STR-STD');
  await kit('On-Grid Residential – Elevated', 'Single phase, 8 ft elevated structure', 'STR-ELV');

  await prisma.customer.create({
    data: {
      companyId, name: 'Sample Customer', phone: '9000000001', addressLine1: '12 Sample Society, Demo Road', city: 'Surat', pincode: '395007', stateCode: '24',
      sites: { create: { label: 'Home', addressLine1: '12 Sample Society, Demo Road', city: 'Surat', pincode: '395007', stateCode: '24', discomName: 'DGVCL', consumerNumber: '00000000000', sanctionedLoadKw: '4', phase: 'SINGLE', roofType: 'RCC' } },
    },
  });
  console.log('Seeded: company, 3 users, tax config, subsidy scheme, number series, 14 products, 2 kits, 1 sample customer.');
}

main().finally(() => prisma.$disconnect());
