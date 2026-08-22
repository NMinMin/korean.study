alter table public.lesson_exercises
  add column if not exists image_url text,
  add column if not exists audio_url text;

-- Preserve old media links. Admin can later move an audio-only old link into
-- audio_url; image_url is the safest default for existing mixed assets.
update public.lesson_exercises
set image_url = media_url
where image_url is null and media_url is not null;
