# Solar EPC Quotation & Invoice App

GST-correct quotations and invoices for rooftop solar EPC work. Built from the PRD and Build Plan (Nov 2026).

## Layout

```
apps/api        Express + TypeScript + Prisma (routes → controllers → services, zod validation)
apps/web        Next.js app (quote builder, invoices, settings)
packages/core   Tax engine, amount in words, kit expansion, subsidy, FY numbering (pure TS + tests)
packages/pdf    HTML templates for the quotation (2 pages) and invoice
```

## Run locally

Needs Node 22+, pnpm, PostgreSQL and Google Chrome (used to render PDFs). `docker-compose.yml` provides Postgres and Redis if you don't have them installed.

```bash
pnpm install
cp apps/api/.env.example apps/api/.env      # then set DATABASE_URL, JWT_SECRET, SEED_PASSWORD
cp apps/web/.env.example apps/web/.env.local
pnpm db:migrate
pnpm db:seed
pnpm dev                                     # API on :4000, web on :3000
```

Sign in at http://localhost:3000 as `admin@nayarasolar.test`, `sales@nayarasolar.test` or `accounts@nayarasolar.test` with the `SEED_PASSWORD` from `apps/api/.env`.

```bash
pnpm test        # tax engine tests
pnpm typecheck
```

## Rules the code enforces

- Money is Decimal end to end (decimal.js in `packages/core`, Decimal(14,2) in Postgres). No JS floats in pricing or tax.
- Tax rates, the 70:30 split, HSN and SAC come from the `TaxConfig` table. A change is a new row with an effective date.
- Totals are always recomputed on the server; the browser's figures are only a live preview using the same engine.
- Quotation revisions are new versions. Earlier versions are never changed.
- An invoice gets its FY number only when issued, inside the same transaction as the status change (series row locked). Issued invoices cannot be edited or deleted; corrections are credit notes.
- Seller, buyer and tax details are frozen as snapshots on every quotation version and invoice.
- Every query is scoped by `companyId`; roles (Admin, Sales, Accounts) are enforced in the API.

## Seed data is sample data

Prices, kits, warranty terms, milestone percentages and the SAC code in `apps/api/prisma/seed.ts` are placeholders. Replace them with the real Phase 0 inputs, and have the CA confirm the tax settings before go-live.

## Not built yet

- PDF rendering runs inside the request with the local Chrome. The BullMQ job and S3 storage from the plan are still to do.
- Credit note PDF, debit notes, user management screen, logo upload, Sentry, staging deploy, backups.
- Supply-only and service-only jobs tax the whole contract at the goods or service rate, pending the CA's answer.
- Phase 2 and 3 items (milestone billing, WhatsApp, Razorpay, e-invoicing, project tracker, reports, multi-company).
