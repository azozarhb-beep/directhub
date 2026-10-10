-- Add sales_model column to manufacturer_products table
-- This fixes the "Could not find the 'sales_model' column" schema cache error

ALTER TABLE public.manufacturer_products
ADD COLUMN IF NOT EXISTS sales_model TEXT DEFAULT 'B2B';
