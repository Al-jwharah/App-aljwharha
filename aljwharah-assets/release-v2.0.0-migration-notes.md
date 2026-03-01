# Aljwharah v2.0.0 — Phase 2 Growth Release

## 🚀 What's New

### Core Platform
- **Seller Wallet & Payouts** — Pending/available balance tracking, payout requests with admin approval
- **Invoice System** — `INV-YYYY-NNNNNN` concurrent-safe numbering, pricing breakdown (subtotal + platform fee + total)
- **Commission Engine** — Admin-configurable `commission_bps` (basis points) with minimum fee support
- **Revenue Dashboard** — Date-range summary with gross/paid/refunded/net metrics

### Marketplace Features
- **Auctions Module** — Create/bid/close auctions with real-time bidding, auto-close via scheduler
- **Promoted Ads (Paid Listings)** — Tap-integrated ad campaigns with impression/click tracking, expiry worker
- **Subscription Plans** — Tiered seller plans with commission discounts and listing limits
- **AI Valuation** — Domain/trademark/IP asset valuation scoring via OpenAI integration

### Operations & Admin
- **Order Events Timeline** — Full audit trail per order (buyer/system/admin actions)
- **Admin Notes** — Add internal notes to orders
- **Payout Management** — Approve/reject payout requests with audit trail
- **Support Tickets** — Buyer/seller ticket system with admin assignment and replies
- **Legal/IP Module** — Trademark dispute and ownership verification management
- **Owner Console** — Platform owner dashboard for high-level KPIs and settings

### Security & Observability (from Phase 1)
- **Structured JSON Logging** — Request-scoped with severity levels
- **Global Error Filter** — Safe error responses, no stack leaks
- **Rate Limiting** — Redis-backed throttling across Cloud Run instances
- **Webhook Signature Verification** — Tap HMAC validation
- **Idempotency** — Payment creation and webhook processing
- **Security Headers** — Helmet, HSTS, CSP, CORS
- **Database Safety** — Indexes, constraints, concurrency guards

### Infrastructure
- **Health Readiness Endpoint** — `/health/ready` checks DB + Redis
- **Job Runner** — 6 scheduled jobs: release-expired, reconcile-payments, settle-balances, process-notifications, close-auctions, expire-ads
- **Job Run Recording** — `job_runs` table for observability
- **SSO Module** — Social login ready (Google/Apple)

---

## 📋 Migration Steps

### 1. Database Migrations (run in order)
```bash
psql $DATABASE_URL -f api/migrations/007_platform_settings.sql
psql $DATABASE_URL -f api/migrations/008_order_pricing.sql
psql $DATABASE_URL -f api/migrations/009_invoices.sql
# Plus any Phase 2 migrations in 010-020 range
```

### 2. New Environment Variables
```env
# Required
OPENAI_API_KEY=sk-...           # For AI valuation module
SETTLEMENT_DAYS=7               # Days before pending balance becomes available

# Optional (existing)
REDIS_URL=redis://...           # Already required from Phase 1
INTERNAL_JOB_SECRET=...         # Already required from Phase 1
```

### 3. Cloud Scheduler Jobs (add to existing)
```
POST /internal/jobs/settle-balances         — daily 03:00 UTC
POST /internal/jobs/process-notifications   — every 2 min
POST /internal/jobs/close-auctions          — every 5 min
POST /internal/jobs/expire-ads              — every 15 min
```

### 4. Deploy
```bash
# API
gcloud run deploy aljwharah-api --source=api/ --region=us-central1

# Web
gcloud run deploy aljwharah-web --source=web/ --region=us-central1
```

---

## 📦 Bundle Contents
- `aljwharah-v2.0.0.bundle` — Full git bundle (clone with `git clone aljwharah-v2.0.0.bundle`)

## ⚠️ Breaking Changes
- Orders table now has `total_amount`, `subtotal_amount`, `platform_fee_amount`, `invoice_no` columns
- Payment status `CANCELLED` removed from `PaymentStatus` enum (use `FAILED`)
- `ThrottlerGuard` replaced with `UserThrottlerGuard`
- `AuthModule` is now `@Global()` — remove redundant imports if needed
