-- Move the two grammar cards currently used by lesson 1 into database-owned content.
-- Stable ids keep this seed safe to run more than once.

insert into public.grammar_patterns (
  id,
  lesson_id,
  structure,
  meaning_vi,
  usage_vi,
  conjugation_vi,
  notes_vi,
  status,
  sort_order
)
values
  (
    '21200000-0001-4000-8000-000000000001',
    '21000000-0001-4000-8000-000000000001',
    '(이)나 / -거나',
    'Hoặc, hay là.',
    'Dùng khi muốn nói có nhiều lựa chọn và chọn một trong số đó.',
    'Danh từ có patchim: 이나
Danh từ không có patchim: 나
Động từ hoặc tính từ: -거나',
    'Lược bỏ tiểu từ 이/가, 을/를 khi dùng (이)나.
Với tiểu từ nơi chốn hoặc thời gian như 에, 에서, (이)나 đứng sau tiểu từ đó.',
    'published',
    1
  ),
  (
    '21200000-0002-4000-8000-000000000001',
    '21000000-0001-4000-8000-000000000001',
    '-아서 / -어서 / -여서 (2)',
    '...Rồi..., và...',
    'Gắn sau động từ để nói theo thứ tự những sự việc có liên quan đến nhau.',
    'Nguyên âm cuối ㅏ hoặc ㅗ: -아서
Các nguyên âm còn lại: -어서
Động từ 하다: -여서 → 해서',
    'Không chia thì trước cấu trúc này.
Chủ ngữ hai vế phải là cùng một người hoặc vật.
Hành động trước tạo bối cảnh hoặc phương tiện cho hành động sau.',
    'published',
    2
  )
on conflict (id) do update set
  lesson_id = excluded.lesson_id,
  structure = excluded.structure,
  meaning_vi = excluded.meaning_vi,
  usage_vi = excluded.usage_vi,
  conjugation_vi = excluded.conjugation_vi,
  notes_vi = excluded.notes_vi,
  status = excluded.status,
  sort_order = excluded.sort_order;
