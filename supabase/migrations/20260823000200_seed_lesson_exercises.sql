-- Seed the exercises that are currently available in the learner UI.
-- source_key makes this migration safe to run more than once and lets admins
-- edit the seeded records later without creating duplicates.

alter table public.lesson_exercises
  add column if not exists source_key text;

create unique index if not exists lesson_exercises_source_key_uidx
  on public.lesson_exercises(source_key);

-- Every published vocabulary item becomes a flashcard exercise.
insert into public.lesson_exercises (
  lesson_id, source_key, skill_type, exercise_type, prompt_ko, prompt_vi,
  answer, explanation_vi, sort_order, status
)
select
  v.lesson_id,
  'seed:vocabulary:flashcard:' || v.id,
  'vocabulary_grammar',
  'flashcard',
  v.word_ko,
  v.meaning_vi,
  jsonb_strip_nulls(jsonb_build_object(
    'word', v.word_ko,
    'meaning', v.meaning_vi,
    'partOfSpeech', v.part_of_speech,
    'pronunciation', v.pronunciation,
    'mnemonic', v.mnemonic
  )),
  v.mnemonic,
  v.sort_order,
  'published'
from public.vocabulary v
where v.lesson_id = '21000000-0001-4000-8000-000000000001'
  and v.status = 'published'
on conflict (source_key) do update set
  lesson_id = excluded.lesson_id,
  prompt_ko = excluded.prompt_ko,
  prompt_vi = excluded.prompt_vi,
  answer = excluded.answer,
  explanation_vi = excluded.explanation_vi,
  sort_order = excluded.sort_order,
  updated_at = now();

-- The two grammar patterns already shown in lesson 1.
insert into public.lesson_exercises (
  lesson_id, source_key, skill_type, exercise_type, prompt_ko, prompt_vi,
  answer, explanation_vi, sort_order, status
)
values
  (
    '21000000-0001-4000-8000-000000000001',
    'seed:grammar:lesson-1:choice',
    'vocabulary_grammar', 'grammar', '(이)나 / -거나',
    'Diễn tả nhiều lựa chọn và chọn một trong số đó.',
    '{"forms":[{"subject":"Danh từ có patchim","form":"이나"},{"subject":"Danh từ không có patchim","form":"나"},{"subject":"Động từ hoặc tính từ","form":"-거나"}]}'::jsonb,
    'Dùng khi muốn nói có nhiều lựa chọn, chọn một trong số đó.',
    101, 'published'
  ),
  (
    '21000000-0001-4000-8000-000000000001',
    'seed:grammar:lesson-1:sequence',
    'vocabulary_grammar', 'grammar', '-아서 / -어서 / -여서 (2)',
    'Nối các hành động có liên quan theo thứ tự.',
    '{"forms":[{"condition":"Nguyên âm cuối là ㅏ hoặc ㅗ","form":"-아서"},{"condition":"Các nguyên âm còn lại","form":"-어서"},{"condition":"Động từ 하다","form":"-여서 → 해서"}]}'::jsonb,
    'Gắn sau động từ để nói theo thứ tự những sự việc có liên quan với nhau.',
    102, 'published'
  )
on conflict (source_key) do update set
  prompt_ko = excluded.prompt_ko,
  prompt_vi = excluded.prompt_vi,
  answer = excluded.answer,
  explanation_vi = excluded.explanation_vi,
  sort_order = excluded.sort_order,
  updated_at = now();

-- Fixed fill-in-the-blank exercises from the lesson UI.
insert into public.lesson_exercises (
  lesson_id, source_key, skill_type, exercise_type, prompt_ko, prompt_vi,
  answer, sort_order, status
)
values
  ('21000000-0001-4000-8000-000000000001','seed:fillblank:lesson-1:1','review','fill_blank','생일이라 친구에게 예쁜 ___을 선물했어요.','Vì là sinh nhật nên tôi đã tặng bạn một bó hoa đẹp.','{"correct":"꽃다발"}'::jsonb,201,'published'),
  ('21000000-0001-4000-8000-000000000001','seed:fillblank:lesson-1:2','review','fill_blank','졸업 선물로 ___을 받았어요.','Tôi đã nhận được bút máy làm quà tốt nghiệp.','{"correct":"만년필"}'::jsonb,202,'published'),
  ('21000000-0001-4000-8000-000000000001','seed:fillblank:lesson-1:3','review','fill_blank','날씨가 추워서 ___를 했어요.','Vì trời lạnh nên tôi đã quàng khăn.','{"correct":"목도리"}'::jsonb,203,'published'),
  ('21000000-0001-4000-8000-000000000001','seed:fillblank:lesson-1:4','review','fill_blank','백화점에서 쓸 수 있는 ___을 선물했어요.','Tôi đã tặng phiếu mua hàng có thể dùng ở trung tâm thương mại.','{"correct":"상품권"}'::jsonb,204,'published'),
  ('21000000-0001-4000-8000-000000000001','seed:fillblank:lesson-1:5','review','fill_blank','___가 너무 좋아서 하나 더 샀어요.','Vì nước hoa quá thích nên tôi đã mua thêm một cái.','{"correct":"향수"}'::jsonb,205,'published')
on conflict (source_key) do update set
  prompt_ko = excluded.prompt_ko,
  prompt_vi = excluded.prompt_vi,
  answer = excluded.answer,
  sort_order = excluded.sort_order,
  updated_at = now();

-- A review question is generated for each vocabulary item. Options are built
-- by the attempt service when a session starts, so only the canonical answer
-- is persisted here.
insert into public.lesson_exercises (
  lesson_id, source_key, skill_type, exercise_type, prompt_ko, prompt_vi,
  answer, explanation_vi, sort_order, status
)
select
  v.lesson_id,
  'seed:review:meaning:' || v.id,
  'review',
  'multiple_choice_meaning',
  v.word_ko,
  'Chọn nghĩa tiếng Việt đúng.',
  jsonb_build_object('correct', v.meaning_vi, 'vocabularyId', v.id),
  case when v.pronunciation is null then v.meaning_vi
       else v.meaning_vi || ' · Phát âm: ' || v.pronunciation end,
  300 + v.sort_order,
  'published'
from public.vocabulary v
where v.lesson_id = '21000000-0001-4000-8000-000000000001'
  and v.status = 'published'
on conflict (source_key) do update set
  prompt_ko = excluded.prompt_ko,
  prompt_vi = excluded.prompt_vi,
  answer = excluded.answer,
  explanation_vi = excluded.explanation_vi,
  sort_order = excluded.sort_order,
  updated_at = now();

-- Dialogue lines shared by dictation and Shadowing. Embedded base64 media from
-- the prototype is intentionally not copied; media_url can be assigned through
-- the admin page after uploading the reusable file to Cloudinary.
with dialogue(no, ko, vi, rhythm, pronunciation) as (
  values
    (1,'다니엘 씨, 이번 주 토요일이 안나 씨 생일이에요.','Anh Daniel ơi, thứ Bảy tuần này là sinh nhật chị Anna.','다니엘 씨, / 이번 주 토요일이 / 안나 씨 생일이에요.','[다니엘 씨, 이번 주 토요이리 안나 씨 생이리에요]'),
    (2,'무슨 선물을 할까요?','Nên tặng quà gì nhỉ?','무슨 / 선물을 할까요?','[무슨 선무를 할까요?]'),
    (3,'향수나 지갑은 어때요?','Nước hoa hoặc ví thì sao?','향수나 / 지갑은 어때요?','[향수나 지가븐 어때요?]'),
    (4,'안나 씨는 향수를 좋아해요.','Chị Anna thích nước hoa lắm.','안나 씨는 / 향수를 좋아해요.','[안나 씨는 향수를 조아해요]'),
    (5,'그럼, 향수가 좋겠네요.','Vậy thì nước hoa được đấy.','그럼, / 향수가 좋겠네요.','[그럼, 향수가 조켄네요]'),
    (6,'그런데 생일날 함께 뭘 하면 좋을까요?','Nhưng mà hôm sinh nhật nên cùng làm gì thì tốt nhỉ?','그런데 / 생일날 함께 / 뭘 하면 / 좋을까요?','[그런데 생일랄 함께 뭘 하면 조을까요?]')
)
insert into public.lesson_exercises (
  lesson_id, source_key, skill_type, exercise_type, prompt_ko, prompt_vi,
  answer, explanation_vi, sort_order, status
)
select
  '21000000-0001-4000-8000-000000000001'::uuid,
  'seed:dictation:lesson-1:' || no,
  'dictation', 'dictation', ko, vi,
  jsonb_build_object('correct', ko, 'ignorePunctuation', true),
  'Chuẩn hóa Unicode, dấu câu và khoảng trắng trước khi chấm.',
  no, 'published'::public.content_status
from dialogue
union all
select
  '21000000-0001-4000-8000-000000000001'::uuid,
  'seed:shadowing:lesson-1:' || no,
  'shadowing', 'shadowing', ko, vi,
  jsonb_build_object('transcript', ko, 'rhythmBreak', rhythm, 'realPronunciation', pronunciation),
  'Thời gian phản xạ bằng thời lượng audio mẫu cộng 3 giây.',
  no, 'published'::public.content_status
from dialogue
on conflict (source_key) do update set
  prompt_ko = excluded.prompt_ko,
  prompt_vi = excluded.prompt_vi,
  answer = excluded.answer,
  explanation_vi = excluded.explanation_vi,
  sort_order = excluded.sort_order,
  updated_at = now();
