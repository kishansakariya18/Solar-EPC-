import type { Company, Customer, Site, TaxConfig } from '@prisma/client';

/** Shape of Company.documentDefaults. */
export interface DocumentDefaults {
  warranty: { component: string; coverage: string }[];
  scopeIncluded: string[];
  scopeExcluded: string[];
  documentsRequired: string[];
  milestones: { label: string; percent: string }[];
  unitsPerKwDay: string;
  tariffPerUnit: string;
}

export const EMPTY_DEFAULTS: DocumentDefaults = {
  warranty: [], scopeIncluded: [], scopeExcluded: [], documentsRequired: [], milestones: [], unitsPerKwDay: '4', tariffPerUnit: '0',
};

export function documentDefaults(company: Company): DocumentDefaults {
  return { ...EMPTY_DEFAULTS, ...((company.documentDefaults as Partial<DocumentDefaults> | null) ?? {}) };
}

export interface SellerSnapshot {
  name: string; legalName: string | null; gstin: string | null; stateCode: string;
  addressLine1: string; addressLine2: string | null; city: string; pincode: string;
  phone: string | null; email: string | null; website: string | null; logoUrl: string | null;
  bankName: string | null; bankBranch: string | null; accountName: string | null; accountNumber: string | null;
  ifsc: string | null; upiId: string | null; jurisdiction: string | null;
  warranty: DocumentDefaults['warranty']; scopeIncluded: string[]; scopeExcluded: string[]; documentsRequired: string[];
}

export function sellerSnapshot(c: Company): SellerSnapshot {
  const d = documentDefaults(c);
  return {
    name: c.name, legalName: c.legalName, gstin: c.gstin, stateCode: c.stateCode,
    addressLine1: c.addressLine1, addressLine2: c.addressLine2, city: c.city, pincode: c.pincode,
    phone: c.phone, email: c.email, website: c.website, logoUrl: c.logoUrl,
    bankName: c.bankName, bankBranch: c.bankBranch, accountName: c.accountName, accountNumber: c.accountNumber,
    ifsc: c.ifsc, upiId: c.upiId, jurisdiction: c.jurisdiction,
    warranty: d.warranty, scopeIncluded: d.scopeIncluded, scopeExcluded: d.scopeExcluded, documentsRequired: d.documentsRequired,
  };
}

export interface BuyerSnapshot {
  name: string; phone: string; email: string | null; gstin: string | null;
  addressLine1: string; addressLine2: string | null; city: string; pincode: string; stateCode: string;
  site: null | {
    label: string | null; addressLine1: string; addressLine2: string | null; city: string; pincode: string; stateCode: string;
    discomName: string | null; consumerNumber: string | null; sanctionedLoadKw: string | null; phase: string | null; roofType: string | null;
  };
}

export function buyerSnapshot(c: Customer, s: Site | null): BuyerSnapshot {
  return {
    name: c.name, phone: c.phone, email: c.email, gstin: c.gstin,
    addressLine1: c.addressLine1, addressLine2: c.addressLine2, city: c.city, pincode: c.pincode, stateCode: c.stateCode,
    site: s && {
      label: s.label, addressLine1: s.addressLine1, addressLine2: s.addressLine2, city: s.city, pincode: s.pincode, stateCode: s.stateCode,
      discomName: s.discomName, consumerNumber: s.consumerNumber, sanctionedLoadKw: s.sanctionedLoadKw?.toString() ?? null,
      phase: s.phase, roofType: s.roofType,
    },
  };
}

export interface TaxSnapshot {
  taxConfigId: string; epcGoodsShare: string; goodsRate: string; serviceRate: string; goodsHsn: string; serviceSac: string;
  // extra context frozen with the document
  supplyType?: string; systemSizeKw?: string; contractValue?: string;
  subsidySchemeName?: string | null; unitsPerKwDay?: string | null;
  quotationNumber?: string; quotationVersion?: number;
}

export function taxSnapshot(t: TaxConfig): TaxSnapshot {
  return {
    taxConfigId: t.id, epcGoodsShare: t.epcGoodsShare.toString(), goodsRate: t.goodsRate.toString(),
    serviceRate: t.serviceRate.toString(), goodsHsn: t.goodsHsn, serviceSac: t.serviceSac,
  };
}
