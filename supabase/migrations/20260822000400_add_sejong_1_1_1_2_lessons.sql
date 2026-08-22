-- Source: 세종한국어 회화 익힘책 한국어판 1-1 / 1-2 (provided by product owner).
-- Only the verified table of contents is published to the catalog here. Lessons stay
-- `no_content` until vocabulary, grammar, audio and exercises have been reviewed.

alter table public.textbooks
  add column if not exists source_document_name text,
  add column if not exists source_document_url text;

-- Migration 003 may already have been applied before the 1-1/1-2 catalog rows
-- were added to its local seed. Upsert the parent rows here so this migration is
-- self-contained and never violates lessons_textbook_id_fkey.
insert into public.textbooks
  (id, slug, title_ko, title_vi, description, source_document_name, sort_order, status)
values
  (
    '11000000-0000-4000-8000-000000000001',
    'sejong-conversation-workbook-1-1',
    '세종한국어 회화 익힘책 1-1',
    'Giáo trình luyện hội thoại Sejong 1-1',
    'Sách luyện hội thoại Sejong 1-1, gồm 7 bài. Nội dung đang được biên soạn từ tài liệu nguồn do chủ sản phẩm cung cấp.',
    '세종한국어 회화 익힘책_한국어판_1-1.pdf',
    2,
    'published'
  ),
  (
    '12000000-0000-4000-8000-000000000001',
    'sejong-conversation-workbook-1-2',
    '세종한국어 회화 익힘책 1-2',
    'Giáo trình luyện hội thoại Sejong 1-2',
    'Sách luyện hội thoại Sejong 1-2, gồm các bài 8–14. Nội dung đang được biên soạn từ tài liệu nguồn do chủ sản phẩm cung cấp.',
    '세종한국어 회화 익힘책_한국어판_1-2.pdf',
    3,
    'published'
  )
on conflict (id) do update set
  slug = excluded.slug,
  title_ko = excluded.title_ko,
  title_vi = excluded.title_vi,
  description = excluded.description,
  source_document_name = excluded.source_document_name,
  sort_order = excluded.sort_order,
  status = excluded.status,
  updated_at = now();

update public.textbooks
set
  description = 'Sách luyện hội thoại Sejong 1-1, gồm 7 bài. Nội dung đang được biên soạn từ tài liệu nguồn do chủ sản phẩm cung cấp.',
  source_document_name = '세종한국어 회화 익힘책_한국어판_1-1.pdf',
  updated_at = now()
where id = '11000000-0000-4000-8000-000000000001';

update public.textbooks
set
  description = 'Sách luyện hội thoại Sejong 1-2, gồm các bài 8–14. Nội dung đang được biên soạn từ tài liệu nguồn do chủ sản phẩm cung cấp.',
  source_document_name = '세종한국어 회화 익힘책_한국어판_1-2.pdf',
  updated_at = now()
where id = '12000000-0000-4000-8000-000000000001';

insert into public.lessons (id, textbook_id, lesson_number, title_ko, status)
values
  ('11000000-0001-4000-8000-000000000001','11000000-0000-4000-8000-000000000001',1,'저는 이지윤이에요','no_content'),
  ('11000000-0002-4000-8000-000000000001','11000000-0000-4000-8000-000000000001',2,'회사에 가요','no_content'),
  ('11000000-0003-4000-8000-000000000001','11000000-0000-4000-8000-000000000001',3,'전화번호가 뭐예요?','no_content'),
  ('11000000-0004-4000-8000-000000000001','11000000-0000-4000-8000-000000000001',4,'책상 위에 지갑이 있어요?','no_content'),
  ('11000000-0005-4000-8000-000000000001','11000000-0000-4000-8000-000000000001',5,'사과 두 개하고 오렌지 세 개 주세요','no_content'),
  ('11000000-0006-4000-8000-000000000001','11000000-0000-4000-8000-000000000001',6,'저는 고기를 안 먹어요','no_content'),
  ('11000000-0007-4000-8000-000000000001','11000000-0000-4000-8000-000000000001',7,'‘서울행’을 꼭 보세요','no_content'),
  ('12000000-0008-4000-8000-000000000001','12000000-0000-4000-8000-000000000001',8,'공원에서 자전거를 탔어요','no_content'),
  ('12000000-0009-4000-8000-000000000001','12000000-0000-4000-8000-000000000001',9,'친구들하고 축구를 할 거예요','no_content'),
  ('12000000-0010-4000-8000-000000000001','12000000-0000-4000-8000-000000000001',10,'할아버지께서 낚시를 좋아하세요?','no_content'),
  ('12000000-0011-4000-8000-000000000001','12000000-0000-4000-8000-000000000001',11,'공연장 앞에서 만날까요?','no_content'),
  ('12000000-0012-4000-8000-000000000001','12000000-0000-4000-8000-000000000001',12,'좀 춥고 눈도 많이 올 거예요','no_content'),
  ('12000000-0013-4000-8000-000000000001','12000000-0000-4000-8000-000000000001',13,'가방이 예쁘지만 좀 무거워요','no_content'),
  ('12000000-0014-4000-8000-000000000001','12000000-0000-4000-8000-000000000001',14,'감기에 걸려서 축제에 못 갔어요','no_content')
on conflict (id) do update set
  textbook_id = excluded.textbook_id,
  lesson_number = excluded.lesson_number,
  title_ko = excluded.title_ko,
  status = excluded.status,
  updated_at = now();
