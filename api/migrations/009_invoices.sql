-- 009_invoices.sql
-- Aljwharah — Invoice sequence (concurrent-safe)

CREATE TABLE IF NOT EXISTS invoice_sequences (
  year    INT PRIMARY KEY,
  last_no INT NOT NULL DEFAULT 0
);
