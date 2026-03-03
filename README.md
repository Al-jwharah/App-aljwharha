# Aljwharah Assets Platform

Aljwharah is a production-grade Saudi B2B marketplace stack for industrial and commercial assets.

## What This Repository Contains

- `web/`: Next.js frontend (Arabic-first, SSR/ISR pages, admin and seller workflows)
- `api/`: NestJS backend (auth, listings, auctions, orders, payments, support, legal, AI)
- `brand/`: brand assets (logo, favicon, icon set)
- `docs/`: release and investor documents

## Strongest Product Features

- Multi-revenue model: listing commissions + subscriptions + paid ads
- End-to-end commerce: listings, auctions, cart, checkout, orders, payouts
- Governance layer: audit trails, owner/admin controls, risk and legal workflows
- AI professional agent:
  - smart search (`/ai/search`)
  - listing optimization (`/ai/listing-improve`)
  - support draft assistant (`/ai/support-draft`)
  - operations insights (`/ai/admin-insights`)
  - executive agent report (`/ai/agent-report`)
- Safe fallback behavior: if LLM credentials are absent, deterministic logic remains active

## AI Agent (LLM) Configuration

Set these environment variables in API runtime:

- `OPENAI_API_KEY` (required to enable LLM mode)
- `OPENAI_MODEL` (default: `gpt-5`)
- `OPENAI_RESPONSES_URL` (default: `https://api.openai.com/v1/responses`)
- `OPENAI_TIMEOUT_MS` (default: `15000`)

When unavailable, AI endpoints automatically fall back to internal deterministic logic and still return usable outputs.

## Quick Start

```bash
npm install
npm run dev:api
npm run dev:web
```

Build and validate:

```bash
npm run build
npm -w web run lint
npm -w api run test
```

## Core Public Routes

- `/`
- `/listings`
- `/auctions`
- `/trademarks`
- `/factories`
- `/stores`
- `/pricing`
- `/ai`
- `/about`
- `/how-it-works`
- `/seller-guide`
- `/buyer-guide`
- `/contact`
- `/terms`
- `/privacy`
- `/refund`
- `/ip-policy`

## Operational Notes

- Sitemap includes all key public marketing/legal pages plus dynamic listing/auction routes.
- API AI requests are logged in `ai_requests` and mirrored to audit logs for traceability.
- Recommended production sequence: migrate DB, deploy API, deploy web, run smoke checks.
