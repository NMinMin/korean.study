-- Consolidate curriculum content into lesson_exercises without assuming that
-- legacy vocabulary/grammar tables still exist. Safe for both the full legacy
-- schema and installations already using only lesson_exercises.

begin;

-- Build the old-vocabulary -> canonical-flashcard map from source_key first.
-- This still works after public.vocabulary has already been removed.
create temporary table canonical_vocabulary_map (
  vocabulary_id uuid primary key,
  exercise_id uuid not null unique
) on commit drop;

insert into canonical_vocabulary_map (vocabulary_id, exercise_id)
select
  replace(exercise.source_key, 'seed:vocabulary:flashcard:', '')::uuid,
  exercise.id
from public.lesson_exercises as exercise
where exercise.source_key ~* '^seed:vocabulary:flashcard:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
on conflict (vocabulary_id) do update set exercise_id = excluded.exercise_id;

insert into canonical_vocabulary_map (vocabulary_id, exercise_id)
select
  replace(exercise.source_key, 'content:vocabulary:', '')::uuid,
  exercise.id
from public.lesson_exercises as exercise
where exercise.source_key ~* '^content:vocabulary:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
on conflict (vocabulary_id) do update set exercise_id = excluded.exercise_id;

-- If the legacy vocabulary table exists, copy any rows that do not yet have a
-- canonical flashcard and preserve their media/details.
do $migration$
begin
  if to_regclass('public.vocabulary') is null then
    return;
  end if;

  insert into public.lesson_exercises (
    source_key, lesson_id, skill_type, exercise_type, prompt_ko, prompt_vi,
    answer, explanation_vi, image_url, audio_url, sort_order, status
  )
  select
    'content:vocabulary:' || vocabulary.id::text,
    vocabulary.lesson_id,
    'vocabulary_grammar',
    'flashcard',
    vocabulary.word_ko,
    vocabulary.meaning_vi,
    jsonb_strip_nulls(jsonb_build_object(
      'word', vocabulary.word_ko,
      'meaning', vocabulary.meaning_vi,
      'partOfSpeech', vocabulary.part_of_speech,
      'pronunciation', vocabulary.pronunciation,
      'mnemonic', vocabulary.mnemonic,
      'imageUrl', vocabulary.image_url,
      'audioUrl', vocabulary.audio_url
    )),
    vocabulary.mnemonic,
    vocabulary.image_url,
    vocabulary.audio_url,
    vocabulary.sort_order,
    vocabulary.status
  from public.vocabulary as vocabulary
  where not exists (
    select 1 from canonical_vocabulary_map as mapping
    where mapping.vocabulary_id = vocabulary.id
  )
    and not exists (
      select 1 from public.lesson_exercises as exercise
      where exercise.source_key = 'content:vocabulary:' || vocabulary.id::text
    );

  insert into canonical_vocabulary_map (vocabulary_id, exercise_id)
  select vocabulary.id, exercise.id
  from public.vocabulary as vocabulary
  join public.lesson_exercises as exercise
    on exercise.source_key = 'content:vocabulary:' || vocabulary.id::text
  on conflict (vocabulary_id) do update set exercise_id = excluded.exercise_id;

  update public.lesson_exercises as exercise
  set
    answer = jsonb_strip_nulls(jsonb_build_object(
      'word', vocabulary.word_ko,
      'meaning', vocabulary.meaning_vi,
      'partOfSpeech', vocabulary.part_of_speech,
      'pronunciation', vocabulary.pronunciation,
      'mnemonic', vocabulary.mnemonic,
      'imageUrl', vocabulary.image_url,
      'audioUrl', vocabulary.audio_url
    )) || coalesce(exercise.answer, '{}'::jsonb),
    image_url = coalesce(exercise.image_url, vocabulary.image_url),
    audio_url = coalesce(exercise.audio_url, vocabulary.audio_url)
  from public.vocabulary as vocabulary
  join canonical_vocabulary_map as mapping on mapping.vocabulary_id = vocabulary.id
  where exercise.id = mapping.exercise_id;

  if to_regclass('public.vocabulary_examples') is not null then
    with example_payload as (
      select
        mapping.exercise_id,
        jsonb_agg(
          jsonb_strip_nulls(jsonb_build_object(
            'ko', example.sentence_ko,
            'vi', example.translation_vi,
            'audioUrl', example.audio_url
          )) order by example.sort_order, example.id
        ) as examples
      from public.vocabulary_examples as example
      join canonical_vocabulary_map as mapping
        on mapping.vocabulary_id = example.vocabulary_id
      group by mapping.exercise_id
    )
    update public.lesson_exercises as exercise
    set answer = coalesce(exercise.answer, '{}'::jsonb)
      || jsonb_build_object('examples', payload.examples, 'example', payload.examples -> 0)
    from example_payload as payload
    where exercise.id = payload.exercise_id;
  end if;
end
$migration$;

-- Standardize mapped seed keys after the map has been captured.
update public.lesson_exercises as exercise
set source_key = 'content:vocabulary:' || mapping.vocabulary_id::text
from canonical_vocabulary_map as mapping
where exercise.id = mapping.exercise_id
  and exercise.source_key is distinct from 'content:vocabulary:' || mapping.vocabulary_id::text;

-- Grammar has no learner-owned foreign keys, so it can be copied directly when
-- present and skipped cleanly when it was already removed.
do $migration$
begin
  if to_regclass('public.grammar_patterns') is null then
    return;
  end if;

  update public.lesson_exercises as exercise
  set source_key = 'content:grammar:' || grammar.id::text
  from public.grammar_patterns as grammar
  where exercise.source_key like 'seed:grammar:%'
    and exercise.prompt_ko = grammar.structure;

  insert into public.lesson_exercises (
    source_key, lesson_id, skill_type, exercise_type, prompt_ko, prompt_vi,
    answer, explanation_vi, sort_order, status
  )
  select
    'content:grammar:' || grammar.id::text,
    grammar.lesson_id,
    'vocabulary_grammar',
    'grammar',
    grammar.structure,
    grammar.meaning_vi,
    jsonb_strip_nulls(jsonb_build_object(
      'correct', grammar.structure,
      'contextVi', grammar.meaning_vi,
      'usageVi', grammar.usage_vi,
      'conjugationVi', grammar.conjugation_vi,
      'formulaLines', case when grammar.conjugation_vi is null then null else to_jsonb(string_to_array(grammar.conjugation_vi, E'\n')) end,
      'note', grammar.notes_vi
    )),
    coalesce(grammar.usage_vi, grammar.notes_vi),
    grammar.sort_order,
    grammar.status
  from public.grammar_patterns as grammar
  where not exists (
    select 1 from public.lesson_exercises as exercise
    where exercise.source_key = 'content:grammar:' || grammar.id::text
  );

  update public.lesson_exercises as exercise
  set answer = jsonb_strip_nulls(jsonb_build_object(
      'correct', grammar.structure,
      'contextVi', grammar.meaning_vi,
      'usageVi', grammar.usage_vi,
      'conjugationVi', grammar.conjugation_vi,
      'formulaLines', case when grammar.conjugation_vi is null then null else to_jsonb(string_to_array(grammar.conjugation_vi, E'\n')) end,
      'note', grammar.notes_vi
    )) || coalesce(exercise.answer, '{}'::jsonb)
  from public.grammar_patterns as grammar
  where exercise.source_key = 'content:grammar:' || grammar.id::text;
end
$migration$;

-- Generated review rows now follow their canonical flashcard.
update public.lesson_exercises as review
set
  lesson_id = flashcard.lesson_id,
  answer = jsonb_set(
    coalesce(review.answer, '{}'::jsonb),
    '{vocabularyId}',
    to_jsonb(mapping.exercise_id::text),
    true
  )
from canonical_vocabulary_map as mapping
join public.lesson_exercises as flashcard on flashcard.id = mapping.exercise_id
where review.source_key = 'seed:review:meaning:' || mapping.vocabulary_id::text;

-- Repoint learner-owned state from old vocabulary UUIDs to flashcard UUIDs.
alter table public.vocabulary_progress
  drop constraint if exists vocabulary_progress_vocabulary_id_fkey;
alter table public.vocabulary_bookmarks
  drop constraint if exists vocabulary_bookmarks_vocabulary_id_fkey;
alter table public.vocabulary_notes
  drop constraint if exists vocabulary_notes_vocabulary_id_fkey;

update public.vocabulary_progress as progress
set vocabulary_id = mapping.exercise_id
from canonical_vocabulary_map as mapping
where progress.vocabulary_id = mapping.vocabulary_id;

update public.vocabulary_bookmarks as bookmark
set vocabulary_id = mapping.exercise_id
from canonical_vocabulary_map as mapping
where bookmark.vocabulary_id = mapping.vocabulary_id;

update public.vocabulary_notes as note
set vocabulary_id = mapping.exercise_id
from canonical_vocabulary_map as mapping
where note.vocabulary_id = mapping.vocabulary_id;

alter table public.vocabulary_progress
  add constraint vocabulary_progress_vocabulary_id_fkey
  foreign key (vocabulary_id) references public.lesson_exercises(id) on delete cascade not valid;
alter table public.vocabulary_bookmarks
  add constraint vocabulary_bookmarks_vocabulary_id_fkey
  foreign key (vocabulary_id) references public.lesson_exercises(id) on delete cascade not valid;
alter table public.vocabulary_notes
  add constraint vocabulary_notes_vocabulary_id_fkey
  foreign key (vocabulary_id) references public.lesson_exercises(id) on delete cascade not valid;

alter table public.vocabulary_progress validate constraint vocabulary_progress_vocabulary_id_fkey;
alter table public.vocabulary_bookmarks validate constraint vocabulary_bookmarks_vocabulary_id_fkey;
alter table public.vocabulary_notes validate constraint vocabulary_notes_vocabulary_id_fkey;

-- Progress location follows a flashcard whenever admin moves it.
create or replace function public.sync_vocabulary_progress_location()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_textbook_id uuid;
begin
  if new.skill_type <> 'vocabulary_grammar'
     or new.exercise_type not in ('vocabulary', 'vocab', 'word', 'flashcard') then
    return new;
  end if;

  select lesson.textbook_id into target_textbook_id
  from public.lessons as lesson
  where lesson.id = new.lesson_id;

  update public.vocabulary_progress
  set lesson_id = new.lesson_id,
      textbook_id = target_textbook_id,
      updated_at = now()
  where vocabulary_id = new.id
    and (lesson_id is distinct from new.lesson_id
      or textbook_id is distinct from target_textbook_id);
  return new;
end;
$$;

revoke all on function public.sync_vocabulary_progress_location() from public;
grant execute on function public.sync_vocabulary_progress_location() to service_role;

drop trigger if exists sync_vocabulary_progress_location_after_move
  on public.lesson_exercises;
create trigger sync_vocabulary_progress_location_after_move
after update of lesson_id on public.lesson_exercises
for each row
when (old.lesson_id is distinct from new.lesson_id)
execute function public.sync_vocabulary_progress_location();

update public.vocabulary_progress as progress
set
  lesson_id = exercise.lesson_id,
  textbook_id = lesson.textbook_id
from public.lesson_exercises as exercise
join public.lessons as lesson on lesson.id = exercise.lesson_id
where progress.vocabulary_id = exercise.id
  and (progress.lesson_id is distinct from exercise.lesson_id
    or progress.textbook_id is distinct from lesson.textbook_id);

-- Repair lesson status from actual canonical content.
update public.lessons as lesson
set status = 'no_content', updated_at = now()
where lesson.status = 'published'
  and not exists (
    select 1 from public.lesson_exercises as exercise
    where exercise.lesson_id = lesson.id and exercise.status = 'published'
  );

update public.lessons as lesson
set status = 'published', updated_at = now()
where lesson.status = 'no_content'
  and exists (
    select 1 from public.lesson_exercises as exercise
    where exercise.lesson_id = lesson.id and exercise.status = 'published'
  );

create or replace function public.refresh_lesson_content_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected_lesson_id uuid;
begin
  foreach affected_lesson_id in array array[
    case when tg_op = 'INSERT' then null else old.lesson_id end,
    case when tg_op = 'DELETE' then null else new.lesson_id end
  ] loop
    if affected_lesson_id is null then continue; end if;
    update public.lessons as lesson
    set
      status = case when exists (
        select 1 from public.lesson_exercises as exercise
        where exercise.lesson_id = affected_lesson_id
          and exercise.status = 'published'
      ) then 'published'::public.content_status else 'no_content'::public.content_status end,
      updated_at = now()
    where lesson.id = affected_lesson_id
      and lesson.status in ('published', 'no_content');
  end loop;
  return coalesce(new, old);
end;
$$;

revoke all on function public.refresh_lesson_content_status() from public;
grant execute on function public.refresh_lesson_content_status() to service_role;

drop trigger if exists refresh_lesson_content_status_after_change
  on public.lesson_exercises;
create trigger refresh_lesson_content_status_after_change
after insert or delete or update of lesson_id, status on public.lesson_exercises
for each row execute function public.refresh_lesson_content_status();

drop table if exists public.vocabulary_examples;
drop table if exists public.grammar_patterns;
drop table if exists public.vocabulary;

create index if not exists lesson_exercises_vocabulary_lesson_idx
  on public.lesson_exercises (lesson_id, exercise_type, sort_order)
  where status = 'published' and skill_type = 'vocabulary_grammar';

drop trigger if exists invalidate_admin_dashboard_cache_after_change
  on public.lesson_exercises;
create trigger invalidate_admin_dashboard_cache_after_change
after insert or update or delete or truncate on public.lesson_exercises
for each statement execute function public.invalidate_admin_dashboard_cache();

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'lesson_exercises'
     ) then
    alter publication supabase_realtime add table public.lesson_exercises;
  end if;
end
$$;

comment on table public.lesson_exercises is
  'Canonical curriculum content for vocabulary, grammar, dictation, shadowing and review.';
comment on column public.vocabulary_progress.vocabulary_id is
  'Canonical vocabulary flashcard id referencing lesson_exercises(id).';

notify pgrst, 'reload schema';

commit;
