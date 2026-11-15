-- Tabibi: reference data that every environment needs.
-- Egypt's 27 governorates and a starter list of medical specialties.
-- Areas, doctors and facilities are entered by the admin; none are seeded.

insert into public.governorates (name_ar, name_en, sort_order) values
  ('القاهرة', 'Cairo', 1),
  ('الجيزة', 'Giza', 2),
  ('الإسكندرية', 'Alexandria', 3),
  ('القليوبية', 'Qalyubia', 4),
  ('الدقهلية', 'Dakahlia', 5),
  ('الشرقية', 'Sharqia', 6),
  ('الغربية', 'Gharbia', 7),
  ('المنوفية', 'Monufia', 8),
  ('البحيرة', 'Beheira', 9),
  ('كفر الشيخ', 'Kafr El Sheikh', 10),
  ('دمياط', 'Damietta', 11),
  ('بورسعيد', 'Port Said', 12),
  ('الإسماعيلية', 'Ismailia', 13),
  ('السويس', 'Suez', 14),
  ('شمال سيناء', 'North Sinai', 15),
  ('جنوب سيناء', 'South Sinai', 16),
  ('الفيوم', 'Faiyum', 17),
  ('بني سويف', 'Beni Suef', 18),
  ('المنيا', 'Minya', 19),
  ('أسيوط', 'Asyut', 20),
  ('سوهاج', 'Sohag', 21),
  ('قنا', 'Qena', 22),
  ('الأقصر', 'Luxor', 23),
  ('أسوان', 'Aswan', 24),
  ('البحر الأحمر', 'Red Sea', 25),
  ('الوادي الجديد', 'New Valley', 26),
  ('مطروح', 'Matrouh', 27)
on conflict (name_ar) do nothing;

insert into public.specialties (name_ar, name_en, sort_order) values
  ('باطنة', 'Internal Medicine', 1),
  ('أطفال', 'Pediatrics', 2),
  ('نساء وتوليد', 'Obstetrics and Gynecology', 3),
  ('جراحة عامة', 'General Surgery', 4),
  ('عظام', 'Orthopedics', 5),
  ('قلب وأوعية دموية', 'Cardiology', 6),
  ('جلدية', 'Dermatology', 7),
  ('أنف وأذن وحنجرة', 'ENT', 8),
  ('عيون', 'Ophthalmology', 9),
  ('أسنان', 'Dentistry', 10),
  ('مخ وأعصاب', 'Neurology', 11),
  ('نفسية', 'Psychiatry', 12),
  ('مسالك بولية', 'Urology', 13),
  ('صدر', 'Pulmonology', 14),
  ('جهاز هضمي وكبد', 'Gastroenterology and Hepatology', 15),
  ('غدد صماء وسكر', 'Endocrinology and Diabetes', 16),
  ('كلى', 'Nephrology', 17),
  ('أورام', 'Oncology', 18),
  ('روماتيزم', 'Rheumatology', 19),
  ('علاج طبيعي', 'Physiotherapy', 20),
  ('تغذية', 'Nutrition', 21),
  ('ممارس عام', 'General Practice', 22)
on conflict (name_ar) do nothing;
