-- Aljwharah Production Seed Data
-- Run against Cloud SQL: aljwharah-pg

-- 1) Categories
INSERT INTO categories (id, name_ar, name_en, slug, icon, sort_order, created_at)
VALUES
  (gen_random_uuid(), 'مواد خام', 'Raw Materials', 'raw-materials', '🧪', 1, NOW()),
  (gen_random_uuid(), 'مخزون زائد', 'Surplus Stock', 'surplus', '📦', 2, NOW()),
  (gen_random_uuid(), 'معدات', 'Equipment', 'equipment', '⚙️', 3, NOW()),
  (gen_random_uuid(), 'خطوط إنتاج', 'Production Lines', 'production-lines', '🏭', 4, NOW()),
  (gen_random_uuid(), 'قطع غيار', 'Spare Parts', 'spare-parts', '🔧', 5, NOW()),
  (gen_random_uuid(), 'سكراب', 'Scrap', 'scrap', '♻️', 6, NOW()),
  (gen_random_uuid(), 'مستودعات', 'Warehouses', 'warehouses', '🏢', 7, NOW())
ON CONFLICT DO NOTHING;

-- 2) Demo seller user
INSERT INTO users (id, email, phone, name, role, email_verified, phone_verified, created_at, updated_at)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'seller1@aljwharah.ai', '+966500000001', 'مؤسسة الراشد للمعدات', 'seller', true, true, NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000002', 'seller2@aljwharah.ai', '+966500000002', 'مصانع الخليج للبلاستيك', 'seller', true, true, NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000003', 'seller3@aljwharah.ai', '+966500000003', 'شركة الأمل للخردة', 'seller', true, true, NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000004', 'seller4@aljwharah.ai', '+966500000004', 'مجموعة النور الصناعية', 'seller', true, true, NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000005', 'seller5@aljwharah.ai', '+966500000005', 'مؤسسة الصحراء للمواد الخام', 'seller', true, true, NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000006', 'seller6@aljwharah.ai', '+966500000006', 'مصنع الوطنية للكرتون', 'seller', true, true, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- 3) Stores
INSERT INTO stores (id, user_id, name_ar, name_en, city, verified, created_at)
VALUES
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'مؤسسة الراشد للمعدات', 'Al-Rashid Equipment', 'الرياض', true, NOW()),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'مصانع الخليج للبلاستيك', 'Gulf Plastics Factories', 'الدمام', true, NOW()),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000003', 'شركة الأمل للخردة', 'Al-Amal Scrap Co', 'جدة', true, NOW()),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000004', 'مجموعة النور الصناعية', 'Al-Noor Industrial Group', 'الخبر', true, NOW()),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000005', 'مؤسسة الصحراء للمواد الخام', 'Sahra Raw Materials', 'ينبع', true, NOW()),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000006', 'مصنع الوطنية للكرتون', 'National Carton Factory', 'الرياض', true, NOW())
ON CONFLICT DO NOTHING;

-- 4) Factories
INSERT INTO factories (id, user_id, name_ar, name_en, city, industry, license_number, verified, created_at)
VALUES
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'مصنع الراشد للمعدات الثقيلة', 'Al-Rashid Heavy Equipment Factory', 'الرياض', 'معدات ثقيلة', 'MODON-10234', true, NOW()),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'مصنع الخليج للبلاستيك', 'Gulf Plastics Factory', 'الدمام', 'بلاستيك', 'MODON-20567', true, NOW()),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000003', 'مصنع جدة لإعادة التدوير', 'Jeddah Recycling Factory', 'جدة', 'إعادة تدوير', 'MODON-30891', true, NOW()),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000004', 'مصنع النور للتعبئة والتغليف', 'Al-Noor Packaging Factory', 'الخبر', 'تعبئة وتغليف', 'MODON-41235', true, NOW()),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000005', 'مصنع الصحراء للكيماويات', 'Sahra Chemicals Factory', 'ينبع', 'كيماويات', 'MODON-51678', true, NOW()),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000006', 'مصنع الوطنية للكرتون المموج', 'National Corrugated Carton Factory', 'الرياض', 'كرتون', 'MODON-62012', true, NOW())
ON CONFLICT DO NOTHING;

-- 5) Listings (20 industrial listings)
INSERT INTO listings (id, user_id, title, description, type, category_slug, city, price, currency, status, seller_verified, created_at, updated_at)
VALUES
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'مواد خام بتروكيماوية — بولي إيثيلين عالي الكثافة', 'بولي إيثيلين HDPE درجة أولى، مناسب لصناعة الأنابيب والحاويات. الكمية 50 طن.', 'RAW_MATERIAL', 'raw-materials', 'الجبيل', 420000, 'SAR', 'APPROVED', true, NOW(), NOW()),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'خط تعبئة مياه — طاقة 5000 عبوة/ساعة', 'خط تعبئة مياه أوتوماتيكي كامل، إيطالي الصنع، بحالة ممتازة. يشمل ماكينات التعبئة والتغليف.', 'PRODUCTION_LINE', 'production-lines', 'الرياض', 2800000, 'SAR', 'APPROVED', true, NOW(), NOW()),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000003', 'مستودع مبرّد — 3000م² — مرخّص', 'مستودع تخزين مبرّد مساحة 3000 متر مربع، مرخّص من الهيئة العامة للغذاء والدواء. 3 غرف تبريد.', 'WAREHOUSE', 'warehouses', 'الدمام', 1500000, 'SAR', 'APPROVED', true, NOW(), NOW()),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000004', 'معدات تصنيع CNC — 4 ماكينات', '4 ماكينات CNC يابانية (Fanuc) موديل 2021، ساعات تشغيل منخفضة. صيانة دورية موثقة.', 'EQUIPMENT', 'equipment', 'جدة', 680000, 'SAR', 'APPROVED', true, NOW(), NOW()),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000005', 'مخزون زائد — أنابيب PVC 200 طن', 'أنابيب PVC بأقطار مختلفة (2-8 بوصة)، إنتاج محلي. مخزون فائض من مشروع حكومي.', 'SURPLUS', 'surplus', 'ينبع', 145000, 'SAR', 'APPROVED', true, NOW(), NOW()),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000006', 'قطع غيار محركات ديزل — كوماتسو', 'قطع غيار أصلية لمحركات كوماتسو SA6D140E. تشمل: بساتم، شنابر، بطانات أسطوانات.', 'SPARE_PARTS', 'spare-parts', 'الرياض', 92000, 'SAR', 'APPROVED', true, NOW(), NOW()),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'سكراب نحاس — 8 طن درجة A', 'سكراب نحاس نظيف درجة A، مصدر صناعي. جاهز للشحن من ميناء الدمام.', 'SCRAP', 'scrap', 'الدمام', 210000, 'SAR', 'APPROVED', true, NOW(), NOW()),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'خط إنتاج كرتون مموّج — ياباني', 'خط إنتاج كرتون مموّج Mitsubishi كامل، طاقة إنتاجية 2000 متر/ساعة. تم صيانته مؤخراً.', 'PRODUCTION_LINE', 'production-lines', 'الخبر', 3200000, 'SAR', 'APPROVED', true, NOW(), NOW()),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000003', 'مصنع أغذية مرخّص — جاهز للتشغيل', 'مصنع أغذية مرخّص بالكامل من SFDA، مساحة 2500م². يشمل خطوط إنتاج وتخزين مبرّد.', 'PRODUCTION_LINE', 'production-lines', 'الرياض', 8500000, 'SAR', 'APPROVED', true, NOW(), NOW()),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000004', 'خط تصنيع مستحضرات تجميل كامل', 'خط إنتاج مستحضرات تجميل متكامل: خلط، تعبئة، تغليف. سعة 3000 وحدة/ساعة.', 'PRODUCTION_LINE', 'production-lines', 'جدة', 4200000, 'SAR', 'APPROVED', true, NOW(), NOW()),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000005', 'مستودع لوجستي — الرياض — 5000م²', 'مستودع لوجستي حديث مساحة 5000م²، أرضيات إيبوكسي، 8 أبواب تحميل، نظام إطفاء.', 'WAREHOUSE', 'warehouses', 'الرياض', 2100000, 'SAR', 'APPROVED', true, NOW(), NOW()),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000006', 'معدات طباعة أوفست — هايدلبرج', 'ماكينة طباعة Heidelberg Speedmaster SM102 — 4 ألوان. ساعات تشغيل 85,000. بحالة جيدة.', 'EQUIPMENT', 'equipment', 'الدمام', 1600000, 'SAR', 'APPROVED', true, NOW(), NOW()),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'مواد خام — راتنج بولي بروبيلين', 'راتنج PP للحقن، 30 طن. مصدر أرامكو/سابك. شهادة جودة متوفرة.', 'RAW_MATERIAL', 'raw-materials', 'الجبيل', 280000, 'SAR', 'APPROVED', true, NOW(), NOW()),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'سكراب ألمنيوم — 15 طن', 'سكراب ألمنيوم مختلط من خطوط إنتاج. نسبة نقاء عالية. FOB الدمام.', 'SCRAP', 'scrap', 'الدمام', 175000, 'SAR', 'APPROVED', true, NOW(), NOW()),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000003', 'قطع غيار كهربائية — ABB', 'قطع غيار كهربائية ABB: موزعات، قواطع، محولات. مخزون فائض من مشروع.', 'SPARE_PARTS', 'spare-parts', 'جدة', 65000, 'SAR', 'APPROVED', false, NOW(), NOW()),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000004', 'مخزون زائد — زيوت تشحيم صناعية', 'زيوت تشحيم Shell Omala S4 — 500 برميل. ختم المصنع سليم. تاريخ صلاحية 2028.', 'SURPLUS', 'surplus', 'الرياض', 120000, 'SAR', 'APPROVED', true, NOW(), NOW()),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000005', 'معدات لحام آلية — Lincoln', 'نظام لحام آلية Lincoln Electric FLEXCUT. 2 ماكينة. ضمان سنة.', 'EQUIPMENT', 'equipment', 'ينبع', 340000, 'SAR', 'APPROVED', false, NOW(), NOW()),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000006', 'خط تصنيع أكياس بلاستيك', 'خط إنتاج أكياس بلاستيك HM/LDPE كامل: نفخ، طباعة، قص. طاقة 200 كغ/ساعة.', 'PRODUCTION_LINE', 'production-lines', 'الرياض', 1800000, 'SAR', 'APPROVED', true, NOW(), NOW()),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'قطع غيار هيدروليك — CAT', 'قطع غيار هيدروليك أصلية Caterpillar. مضخات + أسطوانات + خراطيم. مخزون جديد.', 'SPARE_PARTS', 'spare-parts', 'الرياض', 155000, 'SAR', 'APPROVED', true, NOW(), NOW()),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'سكراب حديد — 100 طن', 'سكراب حديد صناعي نظيف من تفكيك هناجر. جاهز للشحن. السعر شامل التحميل.', 'SCRAP', 'scrap', 'جدة', 85000, 'SAR', 'APPROVED', false, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- 6) Auctions (1 live + 2 scheduled)
INSERT INTO auctions (id, user_id, title_ar, title_en, city, status, starting_price, current_price, bid_increment, starts_at, ends_at, bid_count, created_at)
VALUES
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'خط إنتاج بلاستيك — ألماني', 'German Plastic Production Line', 'الرياض', 'LIVE', 900000, 1250000, 25000, NOW() - INTERVAL '2 hours', NOW() + INTERVAL '4 hours', 14, NOW()),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000003', 'مخزون قطع غيار صناعية — 12 طن', 'Industrial Spare Parts Stock — 12 Tons', 'الدمام', 'SCHEDULED', 250000, 250000, 10000, NOW() + INTERVAL '24 hours', NOW() + INTERVAL '72 hours', 0, NOW()),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000005', 'سكراب نحاس وألمنيوم — 25 طن', 'Copper & Aluminum Scrap — 25 Tons', 'جدة', 'SCHEDULED', 380000, 380000, 15000, NOW() + INTERVAL '48 hours', NOW() + INTERVAL '96 hours', 0, NOW())
ON CONFLICT DO NOTHING;

-- Verify counts
SELECT 'categories' AS entity, COUNT(*) AS count FROM categories
UNION ALL SELECT 'users', COUNT(*) FROM users
UNION ALL SELECT 'stores', COUNT(*) FROM stores
UNION ALL SELECT 'factories', COUNT(*) FROM factories
UNION ALL SELECT 'listings', COUNT(*) FROM listings
UNION ALL SELECT 'auctions', COUNT(*) FROM auctions;
