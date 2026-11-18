export interface SellerDoc {
  name: string; gstin?: string | null; stateCode: string;
  addressLine1: string; addressLine2?: string | null; city: string; pincode: string;
  phone?: string | null; email?: string | null; website?: string | null; logoUrl?: string | null;
  bankName?: string | null; bankBranch?: string | null; accountName?: string | null; accountNumber?: string | null;
  ifsc?: string | null; upiId?: string | null; jurisdiction?: string | null;
}

export interface QuotationDoc {
  seller: SellerDoc;
  number: string; version: number; date: string | Date; validUntil?: string | Date | null;
  buyer: {
    name: string; phone: string; addressLines: string[];
    discomName?: string | null; consumerNumber?: string | null; sanctionedLoadKw?: string | null; phase?: string | null;
  };
  system: { title: string; details: string[] };
  lines: { name: string; specification?: string | null; quantity: string; unit: string; amount?: string | null }[];
  showLinePrices: boolean;
  /** Rows between the system price and the total, e.g. "GST @ 5% on 70% (goods)". */
  priceLabel: string;
  contractValue: string;
  taxRows: { label: string; amount: string }[];
  roundOff: string; total: string;
  subsidyName?: string | null; subsidyAmount: string; netCost: string;
  savings?: { annualGenerationKwh: string; annualSavings: string; paybackYears?: string | null; savings25Years: string; unitsPerKwDay?: string | null } | null;
  milestones: { label: string; percent: string; amount: string }[];
  warranty: { component: string; coverage: string }[];
  scopeIncluded: string[]; scopeExcluded: string[]; documentsRequired: string[];
  terms: string[]; notes?: string | null;
  upiQrDataUrl?: string | null;
}

export interface InvoiceDoc {
  seller: SellerDoc;
  title: string; // "TAX INVOICE" | "PROFORMA INVOICE"
  copyLabel?: string | null; // "ORIGINAL FOR RECIPIENT"
  isDraft: boolean;
  number?: string | null; issueDate?: string | Date | null; dueDate?: string | Date | null;
  placeOfSupplyStateCode: string; quotationNumber?: string | null; milestoneLabel?: string | null; reverseCharge: boolean;
  buyer: { name: string; addressLine: string; gstin?: string | null; stateCode: string; phone?: string | null };
  site?: { title: string; addressLine: string; discomName?: string | null; consumerNumber?: string | null } | null;
  isInterState: boolean;
  lines: { description: string; detail?: string | null; hsnSac: string; taxableValue: string; gstRate: string; cgst: string; sgst: string; igst: string; total: string }[];
  taxableValue: string; cgst: string; sgst: string; igst: string; roundOff: string; total: string;
  amountInWords: string; note?: string | null;
  showPayments: boolean; amountPaid: string; credited: string; balanceDue: string;
  irn?: string | null; signedQrDataUrl?: string | null;
}
