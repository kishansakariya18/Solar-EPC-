import { Router } from 'express';
import { authCtl, catalogueCtl, companyCtl, customerCtl, invoiceCtl, quotationCtl, settingsCtl } from '../controllers';
import { authenticate, requireRole } from '../middleware/auth';

export const router = Router();

router.post('/auth/login', authCtl.login);

router.use(authenticate);
router.get('/auth/me', authCtl.me);

// Who can write what (everyone signed in can read):
const admin = requireRole('ADMIN');
const sales = requireRole('ADMIN', 'SALES'); // customers, sites, quotations
const accounts = requireRole('ADMIN', 'ACCOUNTS'); // invoices, payments, credit notes

router.get('/dashboard', companyCtl.dashboard);
router.get('/company', companyCtl.get);
router.put('/company', admin, companyCtl.update);
router.get('/audit-logs', admin, companyCtl.auditLogs);

router.get('/customers', customerCtl.list);
router.post('/customers', sales, customerCtl.create);
router.get('/customers/:id', customerCtl.get);
router.put('/customers/:id', sales, customerCtl.update);
router.post('/customers/:id/sites', sales, customerCtl.addSite);
router.put('/sites/:id', sales, customerCtl.updateSite);

router.get('/products', catalogueCtl.listProducts);
router.post('/products', admin, catalogueCtl.createProduct);
router.put('/products/:id', admin, catalogueCtl.updateProduct);
router.get('/kits', catalogueCtl.listKits);
router.post('/kits', admin, catalogueCtl.createKit);
router.put('/kits/:id', admin, catalogueCtl.updateKit);

router.get('/tax-configs', settingsCtl.listTax);
router.get('/tax-configs/active', settingsCtl.activeTax);
router.post('/tax-configs', admin, settingsCtl.createTax);
router.get('/subsidy-schemes', settingsCtl.listSubsidy);
router.get('/subsidy-schemes/active', settingsCtl.activeSubsidy);
router.post('/subsidy-schemes', admin, settingsCtl.createSubsidy);

router.get('/quotations', quotationCtl.list);
router.post('/quotations', sales, quotationCtl.create);
router.get('/quotations/:id', quotationCtl.get);
router.post('/quotations/:id/revise', sales, quotationCtl.revise);
router.post('/quotations/:id/status', sales, quotationCtl.status);
router.get('/quotations/:id/versions/:version/document', quotationCtl.document);

router.get('/invoices', invoiceCtl.list);
router.post('/invoices', accounts, invoiceCtl.create);
router.get('/invoices/:id', invoiceCtl.get);
router.put('/invoices/:id', accounts, invoiceCtl.update);
router.delete('/invoices/:id', accounts, invoiceCtl.remove);
router.post('/invoices/:id/issue', accounts, invoiceCtl.issue);
router.post('/invoices/:id/payments', accounts, invoiceCtl.addPayment);
router.post('/invoices/:id/credit-notes', accounts, invoiceCtl.creditNote);
router.get('/invoices/:id/document', invoiceCtl.document);
