-- Repair seeded learning content moved through lesson_exercises before the
-- bulk-move endpoint also synchronized its source vocabulary/grammar record.

do $migration$
begin
  if to_regclass('public.vocabulary') is not null then
    update public.vocabulary as vocabulary
    set
      lesson_id = exercise.lesson_id,
      updated_at = now()
    from public.lesson_exercises as exercise
    where exercise.source_key = 'seed:vocabulary:flashcard:' || vocabulary.id::text
      and vocabulary.lesson_id is distinct from exercise.lesson_id;
  end if;

  if to_regclass('public.grammar_patterns') is not null then
    update public.grammar_patterns as grammar
    set lesson_id = exercise.lesson_id
    from public.lesson_exercises as exercise
    where exercise.skill_type = 'vocabulary_grammar'
      and exercise.exercise_type = 'grammar'
      and exercise.source_key like 'seed:grammar:%'
      and exercise.prompt_ko = grammar.structure
      and grammar.lesson_id is distinct from exercise.lesson_id;
  end if;
end
$migration$;
