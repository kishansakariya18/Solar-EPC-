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

## Deploy for free (pilot)

Free hosting suits a pilot, not live billing: free services sleep, storage is capped and backups aren't guaranteed. The setup below is Render for the two apps and Supabase (or Neon) for Postgres. Render has no India region, so `render.yaml` uses Singapore.

1. **Push this repo to GitHub.**
2. **Create the database.** In Supabase, create a project (pick Mumbai if offered) and copy the **Session pooler** connection string: Connect → Session pooler. The direct string is IPv6-only and won't work from Render. With Neon, copy the direct (not pooled) string.
3. **Create the services.** In Render, go to New → Blueprint, pick the repo, and it reads `render.yaml`. When asked, fill in:
   - `DATABASE_URL`: the string from step 2.
   - `WEB_ORIGIN`: `https://solar-epc-web.onrender.com` (the web service's URL; check it once created).
   - `NEXT_PUBLIC_API_URL`: `https://solar-epc-api.onrender.com/api`.

   The API image installs Chromium for PDFs and runs `prisma migrate deploy` each time it starts.
4. **Create the first admin.** Render's free plan has no shell, so run this once from your own machine against the same database:
   ```bash
   DATABASE_URL="<connection string>" ADMIN_EMAIL="you@example.com" ADMIN_PASSWORD="<12+ characters>" \
     pnpm --filter @solar-epc/api db:seed:prod
   ```
   This creates the company, one admin, the GST settings and the subsidy scheme, with no sample products or customers. It does nothing if a company already exists. Optional: `ADMIN_NAME`, `COMPANY_NAME`, `COMPANY_STATE_CODE` (default `24`), `COMPANY_PHONE`.
5. **Load the product catalogue (optional).** `catalogue/products.csv` holds a starter list (Adani, Waaree, Tata, Goldi, Pahal panels; Xwatt and Polycab inverters; structure, cables, ACDB/DCDB, earthing, LA, meters, services). Prices are indicative: edit them to your distributor rates first. Then:
   ```bash
   DATABASE_URL="<connection string>" DRY_RUN=1 pnpm --filter @solar-epc/api db:import:products   # check only
   DATABASE_URL="<connection string>" pnpm --filter @solar-epc/api db:import:products
   ```
   Rows are matched on `sku`, so running it again updates prices instead of adding duplicates. Nothing is deleted. Use `PRODUCTS_CSV=<path>` for another file.
6. **Sign in** at the web URL, then fill in Settings (address, GSTIN, bank, UPI, warranty, milestones) and build your kits from the products.

If you change a service's URL, update `WEB_ORIGIN` on the API and redeploy, or update `NEXT_PUBLIC_API_URL` on the web app and redeploy it (that value is baked in at build time).

To test the API image locally: `docker build -f apps/api/Dockerfile -t solar-epc-api .`

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
- Credit note PDF, debit notes, user management screen, logo upload, Sentry, backups.
- Supply-only and service-only jobs tax the whole contract at the goods or service rate, pending the CA's answer.
- Phase 2 and 3 items (milestone billing, WhatsApp, Razorpay, e-invoicing, project tracker, reports, multi-company).
