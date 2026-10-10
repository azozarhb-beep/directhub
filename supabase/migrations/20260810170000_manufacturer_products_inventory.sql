-- Migration: Manufacturer Products & Inventory
-- Timestamp: 20260810170000

-- ============================================================
-- 1. TYPES
-- ============================================================
DROP TYPE IF EXISTS public.product_category CASCADE;
CREATE TYPE public.product_category AS ENUM (
  'raw_materials', 'chemicals', 'textiles', 'metals', 'plastics',
  'electronics', 'food_ingredients', 'packaging', 'machinery_parts', 'other'
);

DROP TYPE IF EXISTS public.inventory_status CASCADE;
CREATE TYPE public.inventory_status AS ENUM ('in_stock', 'low_stock', 'out_of_stock', 'discontinued');

-- ============================================================
-- 2. MANUFACTURER PRODUCTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.manufacturer_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    manufacturer_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    category public.product_category DEFAULT 'other'::public.product_category,
    sku TEXT DEFAULT '',
    unit TEXT DEFAULT 'kg',
    unit_price DECIMAL(12,2) DEFAULT 0,
    minimum_order_qty INTEGER DEFAULT 1,
    stock_quantity DECIMAL(12,2) DEFAULT 0,
    inventory_status public.inventory_status DEFAULT 'in_stock'::public.inventory_status,
    origin_country TEXT DEFAULT '',
    specifications JSONB DEFAULT '{}'::jsonb,
    images JSONB DEFAULT '[]'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 3. INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_manufacturer_products_manufacturer_id ON public.manufacturer_products(manufacturer_id);
CREATE INDEX IF NOT EXISTS idx_manufacturer_products_category ON public.manufacturer_products(category);
CREATE INDEX IF NOT EXISTS idx_manufacturer_products_status ON public.manufacturer_products(inventory_status);
CREATE INDEX IF NOT EXISTS idx_manufacturer_products_is_active ON public.manufacturer_products(is_active);

-- ============================================================
-- 4. FUNCTIONS
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_manufacturer_products_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;

-- ============================================================
-- 5. ENABLE RLS
-- ============================================================
ALTER TABLE public.manufacturer_products ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 6. RLS POLICIES
-- ============================================================

-- Manufacturers manage their own products
DROP POLICY IF EXISTS "manufacturers_manage_own_products" ON public.manufacturer_products;
CREATE POLICY "manufacturers_manage_own_products"
ON public.manufacturer_products
FOR ALL
TO authenticated
USING (manufacturer_id = auth.uid())
WITH CHECK (manufacturer_id = auth.uid());

-- Public can view active products
DROP POLICY IF EXISTS "public_view_active_products" ON public.manufacturer_products;
CREATE POLICY "public_view_active_products"
ON public.manufacturer_products
FOR SELECT
TO public
USING (is_active = true);

-- ============================================================
-- 7. TRIGGERS
-- ============================================================
DROP TRIGGER IF EXISTS update_manufacturer_products_updated_at ON public.manufacturer_products;
CREATE TRIGGER update_manufacturer_products_updated_at
    BEFORE UPDATE ON public.manufacturer_products
    FOR EACH ROW
    EXECUTE FUNCTION public.update_manufacturer_products_updated_at();

-- ============================================================
-- 8. MOCK DATA (for demo manufacturer account)
-- ============================================================
DO $$
DECLARE
    manufacturer_user_id UUID;
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'user_profiles'
    ) THEN
        SELECT id INTO manufacturer_user_id
        FROM public.user_profiles
        WHERE role = 'manufacturer'::public.user_role
        LIMIT 1;

        IF manufacturer_user_id IS NOT NULL THEN
            INSERT INTO public.manufacturer_products (
                id, manufacturer_id, name, description, category, sku,
                unit, unit_price, minimum_order_qty, stock_quantity,
                inventory_status, origin_country, is_active
            ) VALUES
                (gen_random_uuid(), manufacturer_user_id,
                 'Industrial Steel Rods', 'High-grade carbon steel rods for construction and manufacturing',
                 'metals'::public.product_category, 'STL-ROD-001',
                 'ton', 850.00, 5, 120.00,
                 'in_stock'::public.inventory_status, 'China', true),
                (gen_random_uuid(), manufacturer_user_id,
                 'Polypropylene Granules', 'Virgin PP granules suitable for injection molding',
                 'plastics'::public.product_category, 'PP-GRN-002',
                 'kg', 1.80, 500, 8500.00,
                 'in_stock'::public.inventory_status, 'Saudi Arabia', true),
                (gen_random_uuid(), manufacturer_user_id,
                 'Sodium Hydroxide (Caustic Soda)', 'Industrial grade NaOH 99% purity',
                 'chemicals'::public.product_category, 'NAOH-99-003',
                 'kg', 0.45, 1000, 25000.00,
                 'in_stock'::public.inventory_status, 'Germany', true),
                (gen_random_uuid(), manufacturer_user_id,
                 'Cotton Yarn 30/1', 'Combed cotton yarn for textile manufacturing',
                 'textiles'::public.product_category, 'CTN-YRN-004',
                 'kg', 3.20, 200, 3200.00,
                 'low_stock'::public.inventory_status, 'India', true),
                (gen_random_uuid(), manufacturer_user_id,
                 'Corrugated Cardboard Sheets', 'Double-wall corrugated packaging material',
                 'packaging'::public.product_category, 'PKG-CRD-005',
                 'sheet', 0.85, 1000, 0.00,
                 'out_of_stock'::public.inventory_status, 'UAE', true)
            ON CONFLICT (id) DO NOTHING;
        ELSE
            RAISE NOTICE 'No manufacturer user found. Skipping mock product data.';
        END IF;
    ELSE
        RAISE NOTICE 'Table user_profiles does not exist. Skipping mock data.';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Mock data insertion failed: %', SQLERRM;
END $$;
