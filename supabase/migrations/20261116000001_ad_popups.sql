-- Tabibi: popup advertisements.
--
-- Besides the fixed slots, an advertisement can now be a popup card shown on
-- top of a page. Popups have their own placements (one per page) and timing:
--   popup_delay_seconds     wait this long after the page opens before showing
--   popup_duration_seconds  close automatically after this long (null = stay until closed)
--   popup_repeat_hours      do not show the same ad to the same visitor again
--                           within this many hours (0 = every visit)
-- The repeat rule is applied on the visitor's device; nothing about visitors is stored.

alter table public.advertisements drop constraint advertisements_placement_check;
alter table public.advertisements add constraint advertisements_placement_check
  check (placement in (
    'home_top', 'home_middle', 'doctors_list', 'facilities_list',
    'popup_home', 'popup_doctors', 'popup_facilities'
  ));

alter table public.advertisements
  add column popup_delay_seconds integer not null default 2
    check (popup_delay_seconds between 0 and 120),
  add column popup_duration_seconds integer
    check (popup_duration_seconds is null or popup_duration_seconds between 3 and 300),
  add column popup_repeat_hours integer not null default 24
    check (popup_repeat_hours between 0 and 720);
