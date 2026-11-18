import type { InvoiceStatus, InvoiceType, QuotationStatus } from '@prisma/client';
import type { Request, Response } from 'express';
import * as s from '../schemas';
import * as auth from '../services/auth.service';
import * as catalogue from '../services/catalogue.service';
import * as company from '../services/company.service';
import * as customers from '../services/customer.service';
import * as invoices from '../services/invoice.service';
import * as pdf from '../services/pdf.service';
import * as quotations from '../services/quotation.service';
import * as settings from '../services/settings.service';

type H = (req: Request, res: Response) => Promise<unknown>;
const id = (req: Request, key = 'id') => String(req.params[key]);
const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined);

async function sendDocument(req: Request, res: Response, html: string, filename: string) {
  if (req.query.format === 'html') return res.type('html').send(html);
  const buf = await pdf.htmlToPdf(html);
  res.type('application/pdf').setHeader('Content-Disposition', `inline; filename="${filename.replace(/[^\w.-]+/g, '-')}.pdf"`);
  res.send(buf);
}

export const authCtl = {
  login: (async (req, res) => {
    const { email, password } = s.loginSchema.parse(req.body);
    res.json(await auth.login(email, password));
  }) as H,
  me: (async (req, res) => res.json(await auth.me(req.auth))) as H,
};

export const companyCtl = {
  get: (async (req, res) => res.json(await company.getCompany(req.auth))) as H,
  update: (async (req, res) => res.json(await company.updateCompany(req.auth, s.companySchema.parse(req.body)))) as H,
  dashboard: (async (req, res) => res.json(await company.dashboard(req.auth))) as H,
  auditLogs: (async (req, res) => res.json(await company.auditLogs(req.auth))) as H,
};

export const customerCtl = {
  list: (async (req, res) => res.json(await customers.listCustomers(req.auth, str(req.query.q)))) as H,
  get: (async (req, res) => res.json(await customers.getCustomer(req.auth, id(req)))) as H,
  create: (async (req, res) => res.status(201).json(await customers.createCustomer(req.auth, s.customerSchema.parse(req.body)))) as H,
  update: (async (req, res) => res.json(await customers.updateCustomer(req.auth, id(req), s.customerSchema.parse(req.body)))) as H,
  addSite: (async (req, res) => res.status(201).json(await customers.addSite(req.auth, id(req), s.siteSchema.parse(req.body)))) as H,
  updateSite: (async (req, res) => res.json(await customers.updateSite(req.auth, id(req), s.siteSchema.parse(req.body)))) as H,
};

export const catalogueCtl = {
  listProducts: (async (req, res) => res.json(await catalogue.listProducts(req.auth, req.query.all === '1'))) as H,
  createProduct: (async (req, res) => res.status(201).json(await catalogue.createProduct(req.auth, s.productSchema.parse(req.body)))) as H,
  updateProduct: (async (req, res) => res.json(await catalogue.updateProduct(req.auth, id(req), s.productSchema.parse(req.body)))) as H,
  listKits: (async (req, res) => res.json(await catalogue.listKits(req.auth))) as H,
  createKit: (async (req, res) => res.status(201).json(await catalogue.createKit(req.auth, s.kitSchema.parse(req.body)))) as H,
  updateKit: (async (req, res) => res.json(await catalogue.updateKit(req.auth, id(req), s.kitSchema.parse(req.body)))) as H,
};

export const settingsCtl = {
  listTax: (async (req, res) => res.json(await settings.listTaxConfigs(req.auth))) as H,
  activeTax: (async (req, res) => res.json(await settings.activeTaxConfig(req.auth.companyId))) as H,
  createTax: (async (req, res) => res.status(201).json(await settings.createTaxConfig(req.auth, s.taxConfigSchema.parse(req.body)))) as H,
  listSubsidy: (async (req, res) => res.json(await settings.listSubsidySchemes(req.auth))) as H,
  activeSubsidy: (async (req, res) => res.json(await settings.activeSubsidyScheme(req.auth.companyId))) as H,
  createSubsidy: (async (req, res) => res.status(201).json(await settings.createSubsidyScheme(req.auth, s.subsidySchemeSchema.parse(req.body)))) as H,
};

export const quotationCtl = {
  list: (async (req, res) => res.json(await quotations.listQuotations(req.auth, { q: str(req.query.q), status: str(req.query.status) as QuotationStatus | undefined }))) as H,
  get: (async (req, res) => res.json(await quotations.getQuotation(req.auth, id(req)))) as H,
  create: (async (req, res) => res.status(201).json(await quotations.createQuotation(req.auth, s.quotationCreateSchema.parse(req.body)))) as H,
  revise: (async (req, res) => res.status(201).json(await quotations.reviseQuotation(req.auth, id(req), s.quotationVersionSchema.parse(req.body)))) as H,
  status: (async (req, res) => res.json(await quotations.setQuotationStatus(req.auth, id(req), s.quotationStatusSchema.parse(req.body).status))) as H,
  document: (async (req, res) => {
    const version = Number(req.params.version);
    const doc = await pdf.quotationDoc(req.auth, id(req), version);
    const { renderQuotationHtml } = await import('@solar-epc/pdf');
    await sendDocument(req, res, renderQuotationHtml(doc), `Quotation-${doc.number}-v${version}`);
  }) as H,
};

export const invoiceCtl = {
  list: (async (req, res) => res.json(await invoices.listInvoices(req.auth, { status: str(req.query.status) as InvoiceStatus | undefined, type: str(req.query.type) as InvoiceType | undefined }))) as H,
  get: (async (req, res) => res.json(await invoices.getInvoice(req.auth, id(req)))) as H,
  create: (async (req, res) => res.status(201).json(await invoices.createFromQuotation(req.auth, s.invoiceCreateSchema.parse(req.body)))) as H,
  update: (async (req, res) => res.json(await invoices.updateDraft(req.auth, id(req), s.invoiceUpdateSchema.parse(req.body)))) as H,
  remove: (async (req, res) => { await invoices.deleteDraft(req.auth, id(req)); res.status(204).end(); }) as H,
  issue: (async (req, res) => res.json(await invoices.issueInvoice(req.auth, id(req)))) as H,
  addPayment: (async (req, res) => res.status(201).json(await invoices.addPayment(req.auth, id(req), s.paymentSchema.parse(req.body)))) as H,
  creditNote: (async (req, res) => res.status(201).json(await invoices.createCreditNote(req.auth, id(req), s.creditNoteSchema.parse(req.body)))) as H,
  document: (async (req, res) => {
    const doc = await pdf.invoiceDoc(req.auth, id(req));
    const { renderInvoiceHtml } = await import('@solar-epc/pdf');
    await sendDocument(req, res, renderInvoiceHtml(doc), `${doc.title}-${doc.number ?? 'draft'}`);
  }) as H,
};
