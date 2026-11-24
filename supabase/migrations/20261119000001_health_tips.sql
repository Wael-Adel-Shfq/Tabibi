-- "Tip of the day" (كل يوم معلومة) on the home page, managed by admins.
-- Visitors read active tips; the app shows one per day, cycling through them
-- in sort order.

create table public.health_tips (
  id uuid primary key default gen_random_uuid(),
  text_ar text not null check (length(btrim(text_ar)) between 10 and 300),
  -- Optional: the English site falls back to the Arabic text.
  text_en text check (text_en is null or length(btrim(text_en)) between 10 and 300),
  is_active boolean not null default true,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index health_tips_active_idx on public.health_tips (sort_order, created_at) where is_active;

create trigger health_tips_updated_at
before update on public.health_tips
for each row execute function public.set_updated_at();

-- Same model as the other directory tables: public read, admin write through RLS.
revoke all on public.health_tips from anon, authenticated;
grant select on public.health_tips to anon, authenticated;
grant insert, update, delete on public.health_tips to authenticated;
grant all on public.health_tips to service_role;

alter table public.health_tips enable row level security;

create policy "health_tips: public reads active"
on public.health_tips for select to anon, authenticated
using (is_active);

create policy "health_tips: admin manages"
on public.health_tips for all to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

-- General starter tips (not medical advice for a specific condition); admins
-- can edit, hide or delete them.
insert into public.health_tips (text_ar, text_en, sort_order) values
  ('اشرب كمية كافية من الماء على مدار اليوم، خاصة في الأيام الحارة.',
   'Drink enough water through the day, especially when it is hot.', 10),
  ('اغسل يديك بالماء والصابون لمدة 20 ثانية على الأقل قبل الأكل وبعد استخدام الحمام.',
   'Wash your hands with soap and water for at least 20 seconds before eating and after using the toilet.', 20),
  ('لا تتناول المضادات الحيوية إلا بوصفة من الطبيب، وأكمل الجرعة كما وُصفت لك.',
   'Only take antibiotics prescribed by a doctor, and finish the course as prescribed.', 30),
  ('احتفظ بقائمة بأدويتك الحالية وخذها معك عند زيارة أي طبيب.',
   'Keep a list of your current medicines and bring it to every doctor visit.', 40),
  ('المشي نصف ساعة معظم أيام الأسبوع يفيد القلب والمزاج.',
   'Walking for half an hour on most days is good for your heart and mood.', 50),
  ('النوم الكافي ليلًا يساعد جسمك على التعافي ويقوّي المناعة.',
   'Enough sleep at night helps your body recover and supports your immunity.', 60),
  ('قِس ضغط الدم بانتظام، فارتفاعه قد لا تصاحبه أي أعراض.',
   'Check your blood pressure regularly; high blood pressure often has no symptoms.', 70);
