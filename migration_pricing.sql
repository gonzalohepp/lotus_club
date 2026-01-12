-- Migration: Add principal and additional pricing to classes
ALTER TABLE classes ADD COLUMN IF NOT EXISTS price_principal NUMERIC;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS price_additional NUMERIC;

-- Migrate existing price to price_principal
UPDATE classes SET price_principal = price WHERE price_principal IS NULL;

-- Add is_principal flag to enrollments
ALTER TABLE class_enrollments ADD COLUMN IF NOT EXISTS is_principal BOOLEAN DEFAULT false;
