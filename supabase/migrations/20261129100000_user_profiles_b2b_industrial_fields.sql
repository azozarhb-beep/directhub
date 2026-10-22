ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS year_established integer;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS nearest_fob_port text;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS annual_production_capacity text;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS website_url text;
