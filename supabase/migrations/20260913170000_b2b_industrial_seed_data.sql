-- ============================================================
-- B2B Industrial Seed Data Migration
-- 9 verified supplier/factory profiles (China, Germany, Turkey)
-- 18 heavy industrial products across 5 categories
-- All prices in USD, MOQ 1-5 units, CE/ISO certified
-- ============================================================

DO $$
DECLARE
  -- Supplier user profile UUIDs
  sup_cn1_uid UUID := gen_random_uuid();
  sup_cn2_uid UUID := gen_random_uuid();
  sup_cn3_uid UUID := gen_random_uuid();
  sup_de1_uid UUID := gen_random_uuid();
  sup_de2_uid UUID := gen_random_uuid();
  sup_de3_uid UUID := gen_random_uuid();
  sup_tr1_uid UUID := gen_random_uuid();
  sup_tr2_uid UUID := gen_random_uuid();
  sup_tr3_uid UUID := gen_random_uuid();

  -- Supplier profile UUIDs
  sp_cn1 UUID := gen_random_uuid();
  sp_cn2 UUID := gen_random_uuid();
  sp_cn3 UUID := gen_random_uuid();
  sp_de1 UUID := gen_random_uuid();
  sp_de2 UUID := gen_random_uuid();
  sp_de3 UUID := gen_random_uuid();
  sp_tr1 UUID := gen_random_uuid();
  sp_tr2 UUID := gen_random_uuid();
  sp_tr3 UUID := gen_random_uuid();

BEGIN

  -- ============================================================
  -- STEP 1: Insert user_profiles for each factory/supplier
  -- ============================================================

  INSERT INTO public.user_profiles (id, email, full_name, company_name, country, role, is_verified, is_active, account_type)
  VALUES
    (sup_cn1_uid, 'sales@sinopack-machinery.com', 'Zhang Wei', 'SinoPack Machinery Co., Ltd.', 'China', 'manufacturer', true, true, 'factory'),
    (sup_cn2_uid, 'export@greatwall-bottling.com', 'Li Jianhua', 'Great Wall Bottling Equipment Corp.', 'China', 'manufacturer', true, true, 'factory'),
    (sup_cn3_uid, 'info@chinaplast-extrusion.com', 'Wang Fang', 'ChinaPlast Extrusion Technology Ltd.', 'China', 'manufacturer', true, true, 'factory'),
    (sup_de1_uid, 'vertrieb@koenig-verpackung.de', 'Klaus Müller', 'König Verpackungsmaschinen GmbH', 'Germany', 'manufacturer', true, true, 'factory'),
    (sup_de2_uid, 'export@rhein-cnc.de', 'Hans Bauer', 'Rhein CNC Maschinenbau GmbH', 'Germany', 'manufacturer', true, true, 'factory'),
    (sup_de3_uid, 'sales@bavarian-foodtech.de', 'Petra Schneider', 'Bavarian FoodTech Engineering GmbH', 'Germany', 'manufacturer', true, true, 'factory'),
    (sup_tr1_uid, 'ihracat@anatoliamak.com.tr', 'Mehmet Yılmaz', 'Anatolia Makina Sanayi A.Ş.', 'Turkey', 'manufacturer', true, true, 'factory'),
    (sup_tr2_uid, 'export@istanbul-plastik.com.tr', 'Ayşe Kaya', 'İstanbul Plastik Ekstrüzyon Ltd. Şti.', 'Turkey', 'manufacturer', true, true, 'factory'),
    (sup_tr3_uid, 'sales@bosphorus-cnc.com.tr', 'Ali Demir', 'Bosphorus CNC Teknoloji A.Ş.', 'Turkey', 'manufacturer', true, true, 'factory')
  ON CONFLICT (email) DO NOTHING;

  -- ============================================================
  -- STEP 2: Insert supplier_profiles
  -- ============================================================

  INSERT INTO public.supplier_profiles (
    id, user_id, company_name, description, country, city,
    established_year, employee_count, annual_revenue,
    main_categories, certifications, website,
    tier, is_verified, response_rate, avg_response_time,
    total_rfqs_received, rating, review_count, is_active
  )
  VALUES
    -- China Supplier 1: Packaging Lines
    (sp_cn1, sup_cn1_uid,
     'SinoPack Machinery Co., Ltd.',
     'Leading Chinese manufacturer of automated packaging lines and end-of-line solutions. Specializes in high-speed shrink wrapping, carton erecting, palletizing, and complete turnkey packaging systems for FMCG, food, and pharmaceutical industries.',
     'China', 'Guangzhou',
     2003, '500-999', '$20M-$50M USD',
     ARRAY['Automated Packaging Lines', 'Shrink Wrapping', 'Palletizing Systems', 'Carton Erecting'],
     ARRAY['CE', 'ISO 9001:2015', 'ISO 14001'],
     'www.sinopack-machinery.com',
     'verified', true, 92, '8h',
     340, 4.6, 87, true),

    -- China Supplier 2: Bottling Lines
    (sp_cn2, sup_cn2_uid,
     'Great Wall Bottling Equipment Corp.',
     'Specialized manufacturer of complete PET and glass bottling lines for beverages, water, and liquid food products. Offers filling, capping, labeling, and inspection systems with capacities from 2,000 to 60,000 BPH.',
     'China', 'Zhangjiagang',
     1998, '1000-4999', '$50M-$100M USD',
     ARRAY['Bottling Lines', 'Filling Machines', 'Capping Systems', 'Labeling Equipment'],
     ARRAY['CE', 'ISO 9001:2015', 'ISO 22000', 'FDA Compliant'],
     'www.greatwall-bottling.com',
     'verified', true, 88, '12h',
     520, 4.7, 134, true),

    -- China Supplier 3: Plastic Extrusion
    (sp_cn3, sup_cn3_uid,
     'ChinaPlast Extrusion Technology Ltd.',
     'Premier manufacturer of single-screw and twin-screw plastic extrusion machines for pipe, profile, sheet, and film production. Serves global markets with CE-certified equipment and full after-sales support.',
     'China', 'Ningbo',
     2007, '200-499', '$10M-$20M USD',
     ARRAY['Plastic Extrusion Machines', 'Twin-Screw Extruders', 'Pipe Extrusion Lines', 'Film Extrusion'],
     ARRAY['CE', 'ISO 9001:2015'],
     'www.chinaplast-extrusion.com',
     'verified', true, 85, '24h',
     210, 4.4, 56, true),

    -- Germany Supplier 1: Packaging Lines
    (sp_de1, sup_de1_uid,
     'König Verpackungsmaschinen GmbH',
     'German precision manufacturer of automated packaging lines for the pharmaceutical, chemical, and food industries. Known for hygienic design, Industry 4.0 integration, and compliance with EU GMP standards.',
     'Germany', 'Stuttgart',
     1987, '200-499', '$30M-$60M USD',
     ARRAY['Automated Packaging Lines', 'Pharmaceutical Packaging', 'Food Packaging', 'Blister Packaging'],
     ARRAY['CE', 'ISO 9001:2015', 'ISO 15378', 'GMP Certified'],
     'www.koenig-verpackung.de',
     'verified', true, 95, '4h',
     180, 4.9, 62, true),

    -- Germany Supplier 2: CNC Machining
    (sp_de2, sup_de2_uid,
     'Rhein CNC Maschinenbau GmbH',
     'High-precision CNC machining center manufacturer based in the Rhine-Ruhr industrial region. Produces 3-axis, 4-axis, and 5-axis machining centers for aerospace, automotive, and mold-making industries.',
     'Germany', 'Düsseldorf',
     1975, '500-999', '$80M-$150M USD',
     ARRAY['CNC Machining Centers', '5-Axis Machining', 'Milling Machines', 'Turning Centers'],
     ARRAY['CE', 'ISO 9001:2015', 'ISO 10791', 'VDW Member'],
     'www.rhein-cnc.de',
     'verified', true, 97, '2h',
     290, 4.9, 98, true),

    -- Germany Supplier 3: Food Processing
    (sp_de3, sup_de3_uid,
     'Bavarian FoodTech Engineering GmbH',
     'Bavarian engineering company specializing in complete food processing lines for meat, dairy, bakery, and ready-meal production. Offers hygienic stainless-steel construction with EHEDG and 3-A certification.',
     'Germany', 'Munich',
     1992, '100-199', '$15M-$30M USD',
     ARRAY['Food Processing Lines', 'Meat Processing', 'Dairy Processing', 'Bakery Equipment'],
     ARRAY['CE', 'ISO 9001:2015', 'ISO 22000', 'EHEDG', '3-A Sanitary Standards'],
     'www.bavarian-foodtech.de',
     'verified', true, 93, '6h',
     145, 4.8, 41, true),

    -- Turkey Supplier 1: Packaging & Food Processing
    (sp_tr1, sup_tr1_uid,
     'Anatolia Makina Sanayi A.Ş.',
     'Turkish industrial machinery manufacturer with 25+ years of experience in automated packaging and food processing equipment. Exports to 45+ countries with competitive pricing and European-standard quality.',
     'Turkey', 'Konya',
     1999, '200-499', '$10M-$25M USD',
     ARRAY['Automated Packaging Lines', 'Food Processing Lines', 'Conveyor Systems', 'Weighing & Dosing'],
     ARRAY['CE', 'ISO 9001:2015', 'ISO 22000', 'TSE'],
     'www.anatoliamak.com.tr',
     'verified', true, 89, '12h',
     265, 4.5, 73, true),

    -- Turkey Supplier 2: Plastic Extrusion
    (sp_tr2, sup_tr2_uid,
     'İstanbul Plastik Ekstrüzyon Ltd. Şti.',
     'Istanbul-based manufacturer of plastic extrusion machinery for pipe, profile, and sheet production. Combines German engineering know-how with competitive Turkish manufacturing costs.',
     'Turkey', 'Istanbul',
     2005, '100-199', '$5M-$10M USD',
     ARRAY['Plastic Extrusion Machines', 'Pipe Extrusion', 'Profile Extrusion', 'Sheet Extrusion'],
     ARRAY['CE', 'ISO 9001:2015', 'TSE'],
     'www.istanbul-plastik.com.tr',
     'verified', true, 84, '24h',
     130, 4.3, 34, true),

    -- Turkey Supplier 3: CNC Machining
    (sp_tr3, sup_tr3_uid,
     'Bosphorus CNC Teknoloji A.Ş.',
     'Turkish CNC machining center manufacturer serving the automotive, defense, and mold industries. Offers 3-axis and 5-axis vertical machining centers with Fanuc and Siemens control systems.',
     'Turkey', 'Bursa',
     2010, '100-199', '$8M-$15M USD',
     ARRAY['CNC Machining Centers', 'Vertical Machining Centers', 'Mold Making', 'Automotive Parts'],
     ARRAY['CE', 'ISO 9001:2015', 'ISO/TS 16949', 'TSE'],
     'www.bosphorus-cnc.com.tr',
     'verified', true, 87, '18h',
     98, 4.5, 27, true)
  ON CONFLICT (user_id) DO NOTHING;

  -- ============================================================
  -- STEP 3: Insert manufacturer_products (18 products)
  -- ============================================================

  -- ---- AUTOMATED PACKAGING LINES (4 products) ----

  INSERT INTO public.manufacturer_products (
    id, manufacturer_id, name, description, category,
    sku, unit, unit_price, minimum_order_qty, min_order_quantity,
    stock_quantity, inventory_status, origin_country,
    specifications, certifications, hs_code,
    lead_time_days, sample_available, tags,
    is_active, is_published, factory_type,
    weight_kg, dimensions, warranty_months, industry_sector,
    order_model, b2b_min_quantity
  )
  VALUES
  -- Product 1: High-Speed Shrink Wrap Packaging Line (China)
  (gen_random_uuid(), sup_cn1_uid,
   'High-Speed Automatic Shrink Wrap Packaging Line SPL-6000',
   'Complete automated shrink wrap packaging line for FMCG products. Handles bottles, cans, cartons, and trays at up to 6,000 packs/hour. Includes infeed conveyor, grouping unit, shrink wrapper, heat tunnel, and outfeed conveyor. PLC-controlled with HMI touchscreen. Suitable for food, beverage, and household products.',
   'packaging',
   'SPL-6000-CN', 'unit', 85000.00, 1, 1,
   8, 'in_stock', 'China',
   jsonb_build_object(
     'throughput_capacity', '6,000 packs/hour',
     'power_rating', '22 kW',
     'film_type', 'POF / PE shrink film',
     'max_pack_size', '600 x 400 x 300 mm',
     'heat_tunnel_temperature', '120-220°C adjustable',
     'control_system', 'Siemens S7-1200 PLC + 10" HMI',
     'machine_weight', '3,200 kg',
     'dimensions_mm', '12,500 x 1,800 x 2,100 mm',
     'voltage', '380V / 50Hz / 3-phase',
     'air_consumption', '0.6 MPa, 200 L/min'
   ),
   '["CE", "ISO 9001:2015"]'::jsonb,
   '8422.30', 60, false,
   '["packaging line", "shrink wrap", "automated packaging", "FMCG", "high speed"]'::jsonb,
   true, true, 'international',
   3200, '12500 x 1800 x 2100 mm', 24, 'Packaging & FMCG',
   'b2b_only', 1),

  -- Product 2: Robotic Palletizing & End-of-Line Packaging System (China)
  (gen_random_uuid(), sup_cn1_uid,
   'Robotic Palletizing End-of-Line Packaging System RPL-2000',
   'Fully automated end-of-line packaging system with 6-axis robotic palletizer. Handles cartons, bags, and trays up to 25 kg per unit. Includes case erector, product filler, case sealer, labeler, and robotic palletizer with pallet wrapper. Designed for food, chemical, and industrial goods.',
   'packaging',
   'RPL-2000-CN', 'unit', 145000.00, 1, 1,
   4, 'in_stock', 'China',
   jsonb_build_object(
     'throughput_capacity', '2,000 cases/hour',
     'robot_payload', '200 kg',
     'robot_reach', '3,100 mm',
     'power_rating', '45 kW',
     'pallet_size', '1,200 x 1,000 mm (Euro/US)',
     'max_stack_height', '2,200 mm',
     'control_system', 'KUKA KR C4 + Siemens PLC',
     'machine_weight', '8,500 kg',
     'dimensions_mm', '18,000 x 6,000 x 3,500 mm',
     'voltage', '380V / 50Hz / 3-phase',
     'compressed_air', '0.6 MPa, 500 L/min'
   ),
   '["CE", "ISO 9001:2015", "ISO 10218-1 Robot Safety"]'::jsonb,
   '8428.90', 90, false,
   '["palletizing", "robotic", "end-of-line", "packaging", "automation"]'::jsonb,
   true, true, 'international',
   8500, '18000 x 6000 x 3500 mm', 24, 'Packaging & Logistics',
   'b2b_only', 1),

  -- Product 3: Pharmaceutical Blister & Carton Packaging Line (Germany)
  (gen_random_uuid(), sup_de1_uid,
   'Pharmaceutical Blister & Carton Packaging Line BCP-400',
   'GMP-compliant pharmaceutical packaging line combining blister forming, tablet/capsule feeding, sealing, and automatic cartoning. Handles 400 blisters/min with 100% vision inspection. Suitable for tablets, capsules, and medical devices. Fully compliant with EU GMP Annex 1 and FDA 21 CFR Part 11.',
   'packaging',
   'BCP-400-DE', 'unit', 520000.00, 1, 1,
   2, 'in_stock', 'Germany',
   jsonb_build_object(
     'throughput_capacity', '400 blisters/min',
     'power_rating', '35 kW',
     'blister_material', 'PVC/PVDC/Alu-Alu foil',
     'carton_size_range', '30-200 x 20-120 x 10-80 mm',
     'vision_inspection', '100% inline camera system',
     'serialization', 'Track & Trace ready (GS1)',
     'control_system', 'Siemens S7-1500 + 15" Comfort Panel',
     'machine_weight', '5,800 kg',
     'dimensions_mm', '14,000 x 2,200 x 2,400 mm',
     'cleanroom_class', 'ISO Class 7 compatible',
     'voltage', '400V / 50Hz / 3-phase'
   ),
   '["CE", "ISO 9001:2015", "ISO 15378", "GMP Annex 1", "FDA 21 CFR Part 11"]'::jsonb,
   '8422.30', 120, false,
   '["pharmaceutical packaging", "blister", "GMP", "cartoning", "serialization"]'::jsonb,
   true, true, 'international',
   5800, '14000 x 2200 x 2400 mm', 36, 'Pharmaceutical',
   'b2b_only', 1),

  -- Product 4: Automated Flow-Wrap & Checkweigher Packaging Line (Turkey)
  (gen_random_uuid(), sup_tr1_uid,
   'Automated Flow-Wrap & Checkweigher Packaging Line FWL-300',
   'Horizontal flow-wrap packaging line for food products including biscuits, chocolate bars, fresh produce, and bakery items. Integrated checkweigher and metal detector ensure 100% quality compliance. Output up to 300 packs/min with automatic film splicing.',
   'packaging',
   'FWL-300-TR', 'unit', 68000.00, 1, 1,
   6, 'in_stock', 'Turkey',
   jsonb_build_object(
     'throughput_capacity', '300 packs/min',
     'power_rating', '15 kW',
     'film_width', '100-600 mm',
     'product_dimensions', 'max 250 x 150 x 80 mm',
     'checkweigher_accuracy', '+/- 0.5 g',
     'metal_detector', 'Ferrous 1.5mm / Non-ferrous 2.0mm',
     'control_system', 'Mitsubishi PLC + 7" HMI',
     'machine_weight', '1,800 kg',
     'dimensions_mm', '8,500 x 1,200 x 1,600 mm',
     'voltage', '380V / 50Hz / 3-phase'
   ),
   '["CE", "ISO 9001:2015", "ISO 22000", "TSE"]'::jsonb,
   '8422.20', 45, false,
   '["flow wrap", "food packaging", "checkweigher", "metal detector", "bakery"]'::jsonb,
   true, true, 'international',
   1800, '8500 x 1200 x 1600 mm', 24, 'Food & Beverage',
   'b2b_only', 1),

  -- ---- BOTTLING LINES (4 products) ----

  -- Product 5: Complete PET Water Bottling Line 12,000 BPH (China)
  (gen_random_uuid(), sup_cn2_uid,
   'Complete PET Water Bottling Line 12,000 BPH WBL-12000',
   'Turnkey PET water bottling line including blow molder, rinser, filler, capper, labeler, date coder, and shrink wrapper. Capacity 12,000 bottles/hour for 0.5L-2L PET bottles. CIP system included. Suitable for still water, sparkling water, and juice.',
   'packaging',
   'WBL-12000-CN', 'unit', 195000.00, 1, 1,
   3, 'in_stock', 'China',
   jsonb_build_object(
     'throughput_capacity', '12,000 BPH (0.5L)',
     'bottle_size_range', '200ml - 2,000ml PET',
     'filling_type', 'Gravity filling / Pressure filling',
     'capping_type', 'Screw cap / Sport cap',
     'labeling_type', 'OPP self-adhesive / Sleeve label',
     'blow_molder_cavities', '6 cavities',
     'power_rating', '110 kW total line',
     'CIP_system', 'Full automatic CIP included',
     'control_system', 'Siemens S7-300 PLC + SCADA',
     'machine_weight', '18,000 kg total',
     'dimensions_mm', '45,000 x 8,000 x 3,200 mm (full line)',
     'voltage', '380V / 50Hz / 3-phase'
   ),
   '["CE", "ISO 9001:2015", "ISO 22000", "FDA Compliant"]'::jsonb,
   '8422.11', 120, false,
   '["bottling line", "PET", "water", "beverage", "turnkey"]'::jsonb,
   true, true, 'international',
   18000, '45000 x 8000 x 3200 mm', 24, 'Beverage',
   'b2b_only', 1),

  -- Product 6: Glass Bottle Beer & Carbonated Beverage Filling Line 20,000 BPH (China)
  (gen_random_uuid(), sup_cn2_uid,
   'Glass Bottle Beer & Carbonated Beverage Filling Line GBL-20000',
   'Complete glass bottle filling line for beer, carbonated soft drinks, and sparkling water. Includes bottle washer, filler, crowner/capper, pasteurizer, labeler, and packer. Isobaric pressure filling ensures zero CO2 loss. Capacity 20,000 BPH for 330ml-750ml glass bottles.',
   'packaging',
   'GBL-20000-CN', 'unit', 380000.00, 1, 1,
   2, 'in_stock', 'China',
   jsonb_build_object(
     'throughput_capacity', '20,000 BPH (330ml)',
     'bottle_size_range', '250ml - 750ml glass',
     'filling_type', 'Isobaric counter-pressure filling',
     'capping_type', 'Crown cap / Screw cap',
     'pasteurizer', 'Tunnel pasteurizer included',
     'bottle_washer', 'Multi-stage rotary washer',
     'CO2_loss', '< 0.1 vol% per fill',
     'power_rating', '185 kW total line',
     'control_system', 'Siemens S7-400 PLC + SCADA',
     'machine_weight', '42,000 kg total',
     'dimensions_mm', '65,000 x 12,000 x 4,000 mm',
     'voltage', '380V / 50Hz / 3-phase'
   ),
   '["CE", "ISO 9001:2015", "ISO 22000", "FDA Compliant"]'::jsonb,
   '8422.11', 150, false,
   '["bottling line", "glass bottle", "beer", "carbonated", "isobaric filling"]'::jsonb,
   true, true, 'international',
   42000, '65000 x 12000 x 4000 mm', 24, 'Beverage',
   'b2b_only', 1),

  -- Product 7: Aseptic Liquid Food Filling & Packaging Line (Germany)
  (gen_random_uuid(), sup_de3_uid,
   'Aseptic Liquid Food Filling & Packaging Line AFL-8000',
   'German-engineered aseptic filling line for UHT milk, juice, and liquid food products in Tetra Pak-style cartons and HDPE bottles. Includes UHT sterilization module, aseptic filler, and secondary packaging. Capacity 8,000 packs/hour. Compliant with EU food contact regulations.',
   'packaging',
   'AFL-8000-DE', 'unit', 720000.00, 1, 1,
   1, 'in_stock', 'Germany',
   jsonb_build_object(
     'throughput_capacity', '8,000 packs/hour',
     'product_types', 'UHT milk, juice, liquid food, cream',
     'pack_formats', '200ml, 500ml, 1L carton / HDPE bottle',
     'sterilization_temperature', '135-145°C UHT',
     'aseptic_standard', 'ISO 22000 / EHEDG compliant',
     'CIP_SIP', 'Fully automatic CIP/SIP system',
     'power_rating', '220 kW total line',
     'control_system', 'Siemens S7-1500 + MES integration',
     'machine_weight', '28,000 kg total',
     'dimensions_mm', '38,000 x 10,000 x 4,500 mm',
     'voltage', '400V / 50Hz / 3-phase'
   ),
   '["CE", "ISO 9001:2015", "ISO 22000", "EHEDG", "3-A Sanitary Standards"]'::jsonb,
   '8422.11', 180, false,
   '["aseptic filling", "UHT", "liquid food", "dairy", "carton packaging"]'::jsonb,
   true, true, 'international',
   28000, '38000 x 10000 x 4500 mm', 36, 'Food & Dairy',
   'b2b_only', 1),

  -- Product 8: Edible Oil Filling & Capping Line 5,000 BPH (Turkey)
  (gen_random_uuid(), sup_tr1_uid,
   'Edible Oil Filling & Capping Line with Nitrogen Flushing OFL-5000',
   'Automated filling line for edible oils, sauces, and viscous liquids in PET and glass bottles. Features nitrogen flushing to extend shelf life, servo-driven filling valves for high accuracy, and automatic cap sorting and tightening. Capacity 5,000 BPH for 0.5L-5L containers.',
   'packaging',
   'OFL-5000-TR', 'unit', 95000.00, 1, 1,
   5, 'in_stock', 'Turkey',
   jsonb_build_object(
     'throughput_capacity', '5,000 BPH (1L)',
     'container_types', 'PET / Glass 0.5L - 5L',
     'filling_type', 'Servo-driven volumetric filling',
     'filling_accuracy', '+/- 1 ml',
     'nitrogen_flushing', 'Pre-fill and post-fill N2 flushing',
     'capping_type', 'Screw cap / Snap cap',
     'power_rating', '25 kW',
     'control_system', 'Mitsubishi PLC + 10" HMI',
     'machine_weight', '3,500 kg',
     'dimensions_mm', '12,000 x 2,000 x 2,200 mm',
     'voltage', '380V / 50Hz / 3-phase'
   ),
   '["CE", "ISO 9001:2015", "ISO 22000", "TSE"]'::jsonb,
   '8422.11', 60, false,
   '["oil filling", "edible oil", "nitrogen flushing", "viscous liquid", "bottling"]'::jsonb,
   true, true, 'international',
   3500, '12000 x 2000 x 2200 mm', 24, 'Food & Beverage',
   'b2b_only', 1),

  -- ---- PLASTIC EXTRUSION MACHINES (3 products) ----

  -- Product 9: Twin-Screw Co-Rotating Extruder TSE-75 (China)
  (gen_random_uuid(), sup_cn3_uid,
   'Twin-Screw Co-Rotating Extruder for Compounding & Masterbatch TSE-75',
   'High-performance co-rotating twin-screw extruder for plastic compounding, masterbatch production, and reactive extrusion. Screw diameter 75mm, L/D ratio 40:1. Suitable for PP, PE, PVC, ABS, PA, and engineering plastics. Includes gravimetric feeders, vacuum degassing, and underwater pelletizer.',
   'plastics',
   'TSE-75-CN', 'unit', 125000.00, 1, 1,
   5, 'in_stock', 'China',
   jsonb_build_object(
     'screw_diameter', '75 mm',
     'LD_ratio', '40:1',
     'screw_type', 'Co-rotating parallel twin-screw',
     'output_capacity', '300-600 kg/hour (PP)',
     'screw_speed', '0-600 RPM',
     'motor_power', '110 kW main drive',
     'barrel_zones', '12 heating/cooling zones',
     'barrel_temperature', 'up to 400°C',
     'pelletizer_type', 'Underwater strand pelletizer',
     'control_system', 'Siemens S7-1200 + 12" HMI',
     'machine_weight', '8,500 kg',
     'dimensions_mm', '9,500 x 1,800 x 2,200 mm',
     'voltage', '380V / 50Hz / 3-phase'
   ),
   '["CE", "ISO 9001:2015"]'::jsonb,
   '8477.20', 75, false,
   '["twin screw extruder", "compounding", "masterbatch", "plastic extrusion", "pelletizer"]'::jsonb,
   true, true, 'international',
   8500, '9500 x 1800 x 2200 mm', 24, 'Plastics & Rubber',
   'b2b_only', 1),

  -- Product 10: HDPE/PP Pipe Extrusion Line 20-110mm (Turkey)
  (gen_random_uuid(), sup_tr2_uid,
   'HDPE/PP Pipe Extrusion Line 20-110mm PEL-110',
   'Complete pipe extrusion line for HDPE, PP, and LDPE pipes in diameter range 20-110mm. Includes single-screw extruder, crosshead die, vacuum calibration tank, haul-off unit, and planetary cutter. Suitable for water supply, gas distribution, and drainage pipes. Compliant with ISO 4427 and EN 12201.',
   'plastics',
   'PEL-110-TR', 'unit', 78000.00, 1, 1,
   4, 'in_stock', 'Turkey',
   jsonb_build_object(
     'pipe_diameter_range', '20 - 110 mm',
     'pipe_wall_thickness', '2.0 - 10.0 mm',
     'output_capacity', '250-400 kg/hour',
     'screw_diameter', '90 mm',
     'LD_ratio', '30:1',
     'motor_power', '75 kW',
     'line_speed', '0.5 - 8 m/min',
     'calibration_tank', 'Vacuum calibration 6m length',
     'haul_off_force', '5,000 N',
     'cutter_type', 'Planetary saw cutter',
     'control_system', 'Siemens S7-300 + 10" HMI',
     'machine_weight', '6,200 kg total line',
     'dimensions_mm', '22,000 x 1,500 x 1,800 mm',
     'voltage', '380V / 50Hz / 3-phase'
   ),
   '["CE", "ISO 9001:2015", "ISO 4427", "EN 12201", "TSE"]'::jsonb,
   '8477.90', 60, false,
   '["pipe extrusion", "HDPE pipe", "PP pipe", "extrusion line", "water pipe"]'::jsonb,
   true, true, 'international',
   6200, '22000 x 1500 x 1800 mm', 24, 'Plastics & Construction',
   'b2b_only', 1),

  -- Product 11: PVC Window Profile Extrusion Line (Germany)
  (gen_random_uuid(), sup_de1_uid,
   'PVC Window & Door Profile Extrusion Line with 4-Cavity Die PVC-EL4',
   'German-engineered PVC profile extrusion line for window frames, door profiles, and architectural profiles. Features conical twin-screw extruder, 4-cavity profile die, multi-stage vacuum calibration, and servo haul-off. Output up to 600 kg/hour. Suitable for uPVC, CPVC, and WPC profiles.',
   'plastics',
   'PVC-EL4-DE', 'unit', 285000.00, 1, 1,
   2, 'in_stock', 'Germany',
   jsonb_build_object(
     'profile_type', 'Window frame / Door / Architectural profiles',
     'screw_type', 'Conical counter-rotating twin-screw',
     'screw_diameter', '92/188 mm conical',
     'output_capacity', '400-600 kg/hour',
     'die_cavities', '4 cavities',
     'motor_power', '90 kW',
     'calibration_table', '8m vacuum calibration table',
     'haul_off_speed', '0.5 - 6 m/min',
     'control_system', 'Siemens S7-1500 + 15" Comfort Panel',
     'machine_weight', '12,000 kg total line',
     'dimensions_mm', '28,000 x 2,500 x 2,200 mm',
     'voltage', '400V / 50Hz / 3-phase'
   ),
   '["CE", "ISO 9001:2015", "EN 12608 PVC Profiles"]'::jsonb,
   '8477.90', 90, false,
   '["PVC extrusion", "window profile", "door profile", "uPVC", "profile extrusion"]'::jsonb,
   true, true, 'international',
   12000, '28000 x 2500 x 2200 mm', 36, 'Construction & Building',
   'b2b_only', 1),

  -- ---- FOOD PROCESSING LINES (4 products) ----

  -- Product 12: Industrial Meat Processing & Mincing Line (Germany)
  (gen_random_uuid(), sup_de3_uid,
   'Industrial Meat Processing & Mincing Line MPL-3000',
   'Complete hygienic meat processing line for beef, pork, and poultry. Includes pre-breaker, industrial mincer, mixer, portioner, and vacuum packaging unit. Stainless steel AISI 316L construction throughout. EHEDG-certified hygienic design. Capacity 3,000 kg/hour. Suitable for meat processing plants and food manufacturers.',
   'food_ingredients',
   'MPL-3000-DE', 'unit', 420000.00, 1, 1,
   2, 'in_stock', 'Germany',
   jsonb_build_object(
     'throughput_capacity', '3,000 kg/hour',
     'product_types', 'Beef, pork, poultry, mixed meat',
     'mincer_plate_diameter', '200 mm',
     'mixer_capacity', '500 L',
     'portioner_accuracy', '+/- 2 g',
     'material_construction', 'AISI 316L stainless steel',
     'CIP_system', 'Automatic CIP with hot water & foam',
     'power_rating', '95 kW total line',
     'control_system', 'Siemens S7-1500 + 15" HMI',
     'machine_weight', '12,500 kg total',
     'dimensions_mm', '25,000 x 4,000 x 2,500 mm',
     'operating_temperature', '0-4°C (chilled environment)',
     'voltage', '400V / 50Hz / 3-phase'
   ),
   '["CE", "ISO 9001:2015", "ISO 22000", "EHEDG", "3-A Sanitary Standards", "HACCP"]'::jsonb,
   '8438.20', 120, false,
   '["meat processing", "mincing", "food processing", "EHEDG", "hygienic design"]'::jsonb,
   true, true, 'international',
   12500, '25000 x 4000 x 2500 mm', 36, 'Meat & Food Processing',
   'b2b_only', 1),

  -- Product 13: Continuous Snack Food Frying & Seasoning Line (China)
  (gen_random_uuid(), sup_cn1_uid,
   'Continuous Snack Food Frying & Seasoning Line SFL-500',
   'Automated continuous frying and seasoning line for potato chips, extruded snacks, nuts, and pellets. Includes continuous fryer with oil filtration, de-oiling conveyor, tumble seasoning drum, and cooling conveyor. Oil temperature control +/- 1°C. Capacity 500 kg/hour.',
   'food_ingredients',
   'SFL-500-CN', 'unit', 165000.00, 1, 1,
   3, 'in_stock', 'China',
   jsonb_build_object(
     'throughput_capacity', '500 kg/hour',
     'product_types', 'Potato chips, extruded snacks, nuts, pellets',
     'fryer_type', 'Continuous immersion fryer',
     'fryer_length', '8 m',
     'oil_temperature_control', '+/- 1°C accuracy',
     'oil_filtration', 'Continuous centrifugal filtration',
     'seasoning_drum', '1,200 mm diameter tumble drum',
     'power_rating', '180 kW (including heating)',
     'oil_capacity', '1,200 L',
     'control_system', 'Siemens S7-1200 + 10" HMI',
     'machine_weight', '9,800 kg total',
     'dimensions_mm', '22,000 x 3,500 x 2,800 mm',
     'voltage', '380V / 50Hz / 3-phase'
   ),
   '["CE", "ISO 9001:2015", "ISO 22000", "HACCP"]'::jsonb,
   '8438.60', 90, false,
   '["snack food", "frying line", "seasoning", "potato chips", "food processing"]'::jsonb,
   true, true, 'international',
   9800, '22000 x 3500 x 2800 mm', 24, 'Snack Food',
   'b2b_only', 1),

  -- Product 14: Industrial Tomato Paste & Sauce Processing Line (Turkey)
  (gen_random_uuid(), sup_tr1_uid,
   'Industrial Tomato Paste & Sauce Processing Line TPL-20T',
   'Complete tomato paste and sauce production line with capacity 20 tons/hour fresh tomatoes. Includes washing, sorting, crushing, pre-heating, extraction, evaporation, sterilization, and aseptic filling. Suitable for tomato paste (28-30 Brix), ketchup, and tomato sauce production.',
   'food_ingredients',
   'TPL-20T-TR', 'unit', 340000.00, 1, 1,
   2, 'in_stock', 'Turkey',
   jsonb_build_object(
     'throughput_capacity', '20 tons/hour fresh tomatoes',
     'final_product', 'Tomato paste 28-30 Brix / Ketchup / Sauce',
     'evaporator_type', 'Triple-effect falling film evaporator',
     'sterilization', 'UHT sterilization 121°C',
     'filling_type', 'Aseptic bag-in-box / Drum filling',
     'water_consumption', '3 m3/ton tomatoes',
     'steam_consumption', '0.8 ton/ton tomatoes',
     'power_rating', '280 kW total line',
     'control_system', 'Siemens S7-400 + SCADA',
     'material_construction', 'AISI 304/316 stainless steel',
     'machine_weight', '35,000 kg total',
     'dimensions_mm', '60,000 x 15,000 x 8,000 mm',
     'voltage', '380V / 50Hz / 3-phase'
   ),
   '["CE", "ISO 9001:2015", "ISO 22000", "HACCP", "TSE"]'::jsonb,
   '8438.80', 150, false,
   '["tomato paste", "sauce processing", "food processing", "evaporator", "aseptic"]'::jsonb,
   true, true, 'international',
   35000, '60000 x 15000 x 8000 mm', 24, 'Food Processing',
   'b2b_only', 1),

  -- Product 15: Dairy Pasteurization & Homogenization Line (Germany)
  (gen_random_uuid(), sup_de3_uid,
   'Dairy Pasteurization & Homogenization Line DPL-10000',
   'Complete dairy processing line for milk pasteurization, homogenization, and standardization. Capacity 10,000 L/hour. Includes plate heat exchanger, high-pressure homogenizer, cream separator, and CIP system. Compliant with EU dairy hygiene regulations (EC 853/2004). Suitable for fresh milk, flavored milk, and cream.',
   'food_ingredients',
   'DPL-10000-DE', 'unit', 485000.00, 1, 1,
   2, 'in_stock', 'Germany',
   jsonb_build_object(
     'throughput_capacity', '10,000 L/hour',
     'product_types', 'Fresh milk, flavored milk, cream, whey',
     'pasteurization_type', 'HTST 72°C / 15 sec or UHT 135°C',
     'homogenizer_pressure', '200 bar (2-stage)',
     'cream_separator', 'Hermetic centrifugal separator',
     'heat_recovery', '> 92% thermal energy recovery',
     'CIP_system', 'Automatic CIP with caustic/acid/rinse',
     'power_rating', '145 kW total',
     'control_system', 'Siemens S7-1500 + 15" HMI + MES',
     'material_construction', 'AISI 316L stainless steel',
     'machine_weight', '18,000 kg total',
     'dimensions_mm', '30,000 x 6,000 x 4,000 mm',
     'voltage', '400V / 50Hz / 3-phase'
   ),
   '["CE", "ISO 9001:2015", "ISO 22000", "EHEDG", "3-A Sanitary Standards", "EC 853/2004"]'::jsonb,
   '8434.20', 120, false,
   '["dairy processing", "pasteurization", "homogenization", "milk processing", "EHEDG"]'::jsonb,
   true, true, 'international',
   18000, '30000 x 6000 x 4000 mm', 36, 'Dairy',
   'b2b_only', 1),

  -- ---- CNC MACHINING CENTERS (3 products) ----

  -- Product 16: 5-Axis Vertical Machining Center VMC-1050 (Germany)
  (gen_random_uuid(), sup_de2_uid,
   '5-Axis Vertical Machining Center VMC-1050 with Siemens 840D',
   'High-precision 5-axis vertical machining center for complex aerospace, automotive, and mold-making applications. Features 1,050 x 600 x 600 mm work envelope, 18,000 RPM HSK-A63 spindle, and Siemens SINUMERIK 840D sl CNC. Simultaneous 5-axis interpolation with RTCP function.',
   'machinery_parts',
   'VMC-1050-DE', 'unit', 850000.00, 1, 1,
   2, 'in_stock', 'Germany',
   jsonb_build_object(
     'axis_configuration', '5-axis simultaneous (X/Y/Z/A/C)',
     'work_envelope', '1,050 x 600 x 600 mm',
     'table_size', '1,200 x 600 mm',
     'max_table_load', '800 kg',
     'spindle_speed', '18,000 RPM (HSK-A63)',
     'spindle_power', '40 kW (S1)',
     'spindle_torque', '200 Nm',
     'rapid_traverse', '60 m/min (X/Y/Z)',
     'tool_magazine', '60 tools ATC',
     'positioning_accuracy', '+/- 0.003 mm',
     'repeatability', '+/- 0.002 mm',
     'CNC_control', 'Siemens SINUMERIK 840D sl',
     'machine_weight', '22,000 kg',
     'dimensions_mm', '4,800 x 4,200 x 3,800 mm',
     'voltage', '400V / 50Hz / 3-phase'
   ),
   '["CE", "ISO 9001:2015", "ISO 10791-1", "ISO 10791-7", "VDW Certified"]'::jsonb,
   '8457.10', 180, false,
   '["5-axis machining", "VMC", "CNC", "aerospace", "mold making", "Siemens 840D"]'::jsonb,
   true, true, 'international',
   22000, '4800 x 4200 x 3800 mm', 36, 'Aerospace & Automotive',
   'b2b_only', 1),

  -- Product 17: 3-Axis CNC Horizontal Machining Center HMC-800 (China)
  (gen_random_uuid(), sup_cn3_uid,
   '3-Axis CNC Horizontal Machining Center HMC-800 with Fanuc 0i-MF',
   'Heavy-duty horizontal machining center for large prismatic parts in automotive, energy, and general engineering. 800 x 800 x 800 mm work envelope, 10,000 RPM BT-50 spindle, 90-tool ATC, and pallet changer. Fanuc 0i-MF CNC control. Suitable for cast iron, steel, and aluminum machining.',
   'machinery_parts',
   'HMC-800-CN', 'unit', 320000.00, 1, 1,
   3, 'in_stock', 'China',
   jsonb_build_object(
     'axis_configuration', '3-axis (X/Y/Z) + B-axis rotary table',
     'work_envelope', '800 x 800 x 800 mm',
     'pallet_size', '800 x 800 mm',
     'max_workpiece_weight', '1,200 kg',
     'spindle_speed', '10,000 RPM (BT-50)',
     'spindle_power', '37 kW (S1)',
     'spindle_torque', '350 Nm',
     'rapid_traverse', '48 m/min (X/Y/Z)',
     'tool_magazine', '90 tools ATC',
     'pallet_changer', 'Automatic 2-pallet changer',
     'positioning_accuracy', '+/- 0.005 mm',
     'repeatability', '+/- 0.003 mm',
     'CNC_control', 'Fanuc 0i-MF Plus',
     'machine_weight', '28,000 kg',
     'dimensions_mm', '5,500 x 5,200 x 3,600 mm',
     'voltage', '380V / 50Hz / 3-phase'
   ),
   '["CE", "ISO 9001:2015", "ISO 10791-1"]'::jsonb,
   '8457.20', 120, false,
   '["horizontal machining center", "HMC", "CNC", "automotive", "pallet changer", "Fanuc"]'::jsonb,
   true, true, 'international',
   28000, '5500 x 5200 x 3600 mm', 24, 'Automotive & Engineering',
   'b2b_only', 1),

  -- Product 18: 4-Axis CNC Vertical Machining Center VMC-650 (Turkey)
  (gen_random_uuid(), sup_tr3_uid,
   '4-Axis CNC Vertical Machining Center VMC-650 with Fanuc 0i-MF',
   'Rigid 4-axis vertical machining center for mold making, automotive parts, and general precision machining. 650 x 500 x 500 mm work envelope, 12,000 RPM BT-40 spindle, and 24-tool ATC. Fanuc 0i-MF control. Competitive pricing with European-quality construction. Suitable for steel, aluminum, and cast iron.',
   'machinery_parts',
   'VMC-650-TR', 'unit', 95000.00, 2, 2,
   6, 'in_stock', 'Turkey',
   jsonb_build_object(
     'axis_configuration', '4-axis (X/Y/Z + 4th rotary axis)',
     'work_envelope', '650 x 500 x 500 mm',
     'table_size', '750 x 500 mm',
     'max_table_load', '600 kg',
     'spindle_speed', '12,000 RPM (BT-40)',
     'spindle_power', '22 kW (S1)',
     'spindle_torque', '120 Nm',
     'rapid_traverse', '36 m/min (X/Y/Z)',
     'tool_magazine', '24 tools ATC',
     'positioning_accuracy', '+/- 0.005 mm',
     'repeatability', '+/- 0.003 mm',
     'CNC_control', 'Fanuc 0i-MF',
     'machine_weight', '8,500 kg',
     'dimensions_mm', '2,800 x 2,600 x 2,900 mm',
     'voltage', '380V / 50Hz / 3-phase'
   ),
   '["CE", "ISO 9001:2015", "ISO/TS 16949", "TSE"]'::jsonb,
   '8457.10', 75, false,
   '["VMC", "4-axis CNC", "mold making", "vertical machining", "Fanuc", "automotive"]'::jsonb,
   true, true, 'international',
   8500, '2800 x 2600 x 2900 mm', 24, 'Mold Making & Automotive',
   'b2b_only', 2)

  ON CONFLICT (id) DO NOTHING;

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'B2B seed data insertion failed: %', SQLERRM;
END $$;
