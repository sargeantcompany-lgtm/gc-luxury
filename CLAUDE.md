# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install                  # root deps (Express server)
npm start                    # run the server (server/index.js), requires .env — see below
npm run build                # installs deps + builds both React frontends into their dist/ folders

cd admin-frontend && npm install && npm run dev       # CRM dev server, http://localhost:5173
cd connector-frontend && npm install && npm run dev   # Connector dev server, http://localhost:5174
```

There is no test suite (`npm test` is an unimplemented stub) and no lint script configured — don't invent commands for either.

Working List owner CSVs use `Address`, `Owner`, and `Mobile` columns. Suburbs with 10+ entries get
their own category; smaller suburbs share an “Other suburbs” category. Preview locally with
`npm run import-working-list -- "C:\path\to\owners.csv" --dry-run`; import with the same command
without `--dry-run`. The Working List also has an admin-only CSV/XLSX upload control. Each
owner/mobile/property-address combination is a tap-to-text row.
The separate “Buyers” list accepts the legacy `Working list.xlsx - Sheet2.csv` layout
(name, mobile, email in the first three columns), keeps buyer contacts together without suburb
categories, and retains the remaining buyer details on each contact.
Working List contacts are grouped into separate named SMS lists (the existing list is
“Owners & Mobiles”); each list has its own suburb categories and can contain the same contact
as another list. Select or create a list in Outreach HQ before importing a CSV/XLSX file.

Required env vars (see `.env.example`): `DATABASE_URL` (Postgres), `PORT`, `CRM_ADMIN_KEY`, `CONNECTOR_ADMIN_KEY`.

**Dev-proxy gotcha**: `admin-frontend/vite.config.js` proxies `/api` to `localhost:3001`, but `connector-frontend/vite.config.js` proxies to `localhost:3000`, and the server's own default `PORT` is `3000`. If you're running the admin dev server against a local `npm start`, either set `PORT=3001` or fix the proxy target — they're currently inconsistent.

## Architecture

One Express server (`server/index.js`) serves three separate frontends plus two independent APIs, backed by a single Postgres database. There is no separate backend-for-frontend split — routing is by URL prefix in `index.js`.

- **`client/`** — static HTML/CSS/JS marketing site for GC Luxury, served at `/`. Its enquiry form (`POST /api/enquiries`) doesn't have its own table — it inserts straight into the CRM's `contacts` table under the `"GC Luxury"` brand and writes an `activity_log` row, tying the public site directly into the CRM.
- **`admin-frontend/`** — "Outreach HQ", a multi-brand CRM (React/Vite), built to `admin-frontend/dist` and served at `/admin`. Manages `brands` → `contacts` (pipeline stages, DNC) → `campaigns`/`templates` (email + SMS) → `activity_log`, with per-brand SMTP settings. It's now GC Luxury only: `GC Luxury` is the sole seeded brand, the old `Real Estate`/`Houzeey` brands are deleted on boot (bottom of `database/schema.sql`), new contacts default to GC Luxury, and Campaigns/Templates are hidden from the menu (routes redirect to the dashboard; the page files are kept for later).
- **`connector-frontend/`** — "The Connector", a buyer portal (React/Vite) for off-market/pre-market listings, built to `connector-frontend/dist` and served at `/connector`. Has its own admin sub-area (`/connector/admin`) for managing `listings`, per-buyer `top_five` picks, `connector_matches`, and `valuation_requests`.
- `GET /join?src=X` redirects to `/connector/?src=X` — the trackable-referral-link entry point into the Connector.

### Two admin auth schemes + one end-user auth scheme

- CRM admin (`/api/brands`, `/api/contacts`, `/api/campaigns`, `/api/templates`, `/api/activity`, `/api/settings`) is gated by `requireAdmin` in `server/crm/adminAuth.js`: a shared-secret `x-admin-key` header checked against `CRM_ADMIN_KEY`. The admin-frontend stores the key in `localStorage` and attaches it via an axios interceptor (`admin-frontend/src/services/api.js`).
- Connector admin (`/api/connector/admin/*`) uses the same shared-secret pattern but a separate key, `CONNECTOR_ADMIN_KEY` (`server/connector/adminAuth.js`).
- Connector *buyers* (the actual end users, not admins) get real session-cookie auth instead: `server/connector/auth.js` scrypt-hashes passwords, issues a 180-day `connector_session` cookie backed by the `buyer_sessions` table, and `requireBuyer` middleware resolves `req.buyer` from it.

Neither admin scheme is a user-account system — both are single shared secrets, checked with a plain `!==` comparison (not constant-time), so don't assume per-admin identity or audit trails exist there.

### Database

`database/schema.sql` is the only source of truth for the schema — there is no migration tool. It's executed in full on every server boot (`ensureSchema()` in `server/db.js`), so every statement in it must be idempotent: `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, `ON CONFLICT DO NOTHING`. When changing the schema, append idempotent statements to this file rather than editing historical `CREATE TABLE` blocks in place — e.g. the `top_five` table's move from a single global list to per-buyer rows is recorded as `ALTER TABLE` statements below its original `CREATE TABLE`, not by rewriting the original.

### Listing checklists

The Property Listing & Sales Checklist (one per property listed) is defined once in `server/listingChecklists.js` and stored in the `listing_checklists` table. Two UIs share it: the CRM's Listing Checklists page (`/api/listing-checklists`, CRM key) and the Listings tab of `/adam/admin` (`/adam/api/checklists`, Adam's admin cookie). Both fetch the checklist definition from the API rather than hardcoding it. Item keys are what's stored per listing, so never rename or reuse one.

### Listing auto-fill

`server/connector/ogFetch.js` scrapes a listing URL's Open Graph tags / JSON-LD for title, description, images, and price, used by the Connector admin UI to prefill a new listing from a pasted URL.

### Appraisal builders

`agent/public/appraisal-tool.html` is two builders on one page: `/adam/appraisal-tool.html` makes a normal Appraisal & Proposal, and `?type=summer` makes a Summer Auction Appraisal. The choice is saved on the appraisal as `summerAuction`, and the client view (`/adam/a/:id`) renders from that, so both must keep working.

### Form emails

Every public form (contact, appraisal request, offers, client portal and Vantage sign-ups, Summer Auction sign-up, Connector join, buyer brief and valuation requests) saves first, then emails `NOTIFY_EMAIL` through `sendFormEmail` in `server/notify.js`, using Resend's HTTP API. A failed send is only logged, and the form still succeeds.

### Deployment

Single Railway service (`railway.toml`, Nixpacks): `npm install && npm run build` then `npm start`. One Express process serves the static site, both built SPAs, and both APIs — there's no separate deploy target per frontend.
