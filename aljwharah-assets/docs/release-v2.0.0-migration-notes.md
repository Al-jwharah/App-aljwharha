# Aljwharah v2.0.0 Migration Notes

## Scope
Production launch migrations for marketplace growth modules.

## Migration files
- 001_initial_schema.sql
- 002_auth_tables.sql
- 003_cart_orders.sql
- 004_payments_idempotency.sql
- 005_audit_log.sql
- 006_indexes_safety.sql
- 007_platform_settings.sql
- 008_order_pricing.sql
- 009_invoices.sql
- 010_status_alignment.sql
- 011_seller_finance.sql
- 012_notifications_outbox.sql
- 013_orders_total_amount.sql
- 014_phase2_growth_suite.sql
- 015_subscription_pending_charge.sql

## Operational notes
- All migrations execute via `schema_migrations` tracking.
- `run-migrations` now tolerates duplicate-object style SQL in partially-applied environments and keeps migration records idempotent.
- Run path in production: Cloud Run Job `aljwharah-migrate` using API image.

## Deploy order
1. Build API image.
2. Execute migration job.
3. Verify `/health/db` is 200.
4. Shift traffic to latest Cloud Run revision.

## Rollback guidance
- Prefer forward-fix migrations.
- For urgent rollback, shift traffic to prior stable revision first, then apply compensating SQL migration.
