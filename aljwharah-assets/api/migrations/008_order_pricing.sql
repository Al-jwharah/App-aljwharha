-- 008_order_pricing.sql
-- Aljwharah — Add pricing breakdown + invoice to orders

ALTER TABLE orders ADD COLUMN IF NOT EXISTS subtotal_amount NUMERIC(14,2);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS platform_fee_amount NUMERIC(14,2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS invoice_no VARCHAR(30);

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_invoice_no ON orders(invoice_no) WHERE invoice_no IS NOT NULL;
