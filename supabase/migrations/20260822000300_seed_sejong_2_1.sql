-- Stable content identifiers are required so per-user progress can sync across devices.
-- This seed is intentionally idempotent and does not overwrite admin-managed media URLs.

insert into public.textbooks (id, slug, title_ko, title_vi, description, sort_order, status)
values (
  '21000000-0000-4000-8000-000000000001',
  'sejong-conversation-workbook-2-1',
  '세종한국어 회화 익힘책 2-1',
  'Giáo trình luyện hội thoại Sejong 2-1',
  'Giáo trình đang học trong Korean Study.',
  1,
  'published'
)
on conflict (id) do update set
  slug = excluded.slug,
  title_ko = excluded.title_ko,
  title_vi = excluded.title_vi,
  description = excluded.description,
  sort_order = excluded.sort_order,
  status = excluded.status,
  updated_at = now();

insert into public.textbooks (id, slug, title_ko, title_vi, sort_order, status)
values
  ('11000000-0000-4000-8000-000000000001','sejong-conversation-workbook-1-1','세종한국어 회화 익힘책 1-1','Giáo trình luyện hội thoại Sejong 1-1',2,'published'),
  ('12000000-0000-4000-8000-000000000001','sejong-conversation-workbook-1-2','세종한국어 회화 익힘책 1-2','Giáo trình luyện hội thoại Sejong 1-2',3,'published'),
  ('22000000-0000-4000-8000-000000000001','sejong-conversation-workbook-2-2','세종한국어 회화 익힘책 2-2','Giáo trình luyện hội thoại Sejong 2-2',4,'published'),
  ('31000000-0000-4000-8000-000000000001','sejong-conversation-workbook-3-1','세종한국어 회화 익힘책 3-1','Giáo trình luyện hội thoại Sejong 3-1',5,'published'),
  ('32000000-0000-4000-8000-000000000001','sejong-conversation-workbook-3-2','세종한국어 회화 익힘책 3-2','Giáo trình luyện hội thoại Sejong 3-2',6,'published'),
  ('41000000-0000-4000-8000-000000000001','sejong-conversation-workbook-4-1','세종한국어 회화 익힘책 4-1','Giáo trình luyện hội thoại Sejong 4-1',7,'published'),
  ('42000000-0000-4000-8000-000000000001','sejong-conversation-workbook-4-2','세종한국어 회화 익힘책 4-2','Giáo trình luyện hội thoại Sejong 4-2',8,'published')
on conflict (id) do update set
  slug = excluded.slug,
  title_ko = excluded.title_ko,
  title_vi = excluded.title_vi,
  sort_order = excluded.sort_order,
  status = excluded.status,
  updated_at = now();

insert into public.lessons (id, textbook_id, lesson_number, title_ko, status)
values
  ('21000000-0001-4000-8000-000000000001', '21000000-0000-4000-8000-000000000001', 1, '꽃다발이나 케이크는 어때요?', 'published'),
  ('21000000-0002-4000-8000-000000000001', '21000000-0000-4000-8000-000000000001', 2, '회사 일이 많아서 바빴습니다', 'no_content'),
  ('21000000-0003-4000-8000-000000000001', '21000000-0000-4000-8000-000000000001', 3, '버스로 10분쯤 걸릴 거예요', 'no_content'),
  ('21000000-0004-4000-8000-000000000001', '21000000-0000-4000-8000-000000000001', 4, '점심 먹으러 갈래요?', 'no_content'),
  ('21000000-0005-4000-8000-000000000001', '21000000-0000-4000-8000-000000000001', 5, '저녁 먹은 후에 조깅을 해요', 'no_content'),
  ('21000000-0006-4000-8000-000000000001', '21000000-0000-4000-8000-000000000001', 6, '푹 쉬어서 괜찮아졌어요', 'no_content'),
  ('21000000-0007-4000-8000-000000000001', '21000000-0000-4000-8000-000000000001', 7, '일곱 시로 예약해 주세요', 'no_content')
on conflict (id) do update set
  textbook_id = excluded.textbook_id,
  lesson_number = excluded.lesson_number,
  title_ko = excluded.title_ko,
  status = excluded.status,
  updated_at = now();

insert into public.vocabulary
  (id, lesson_id, word_ko, meaning_vi, part_of_speech, pronunciation, mnemonic, sort_order, status)
values
  ('21100000-0001-4000-8000-000000000001','21000000-0001-4000-8000-000000000001','꽃다발','Bó hoa, lẵng hoa','명사','[꼳따발]','꽃(hoa) + 다발(bó) = bó hoa',1,'published'),
  ('21100000-0002-4000-8000-000000000001','21000000-0001-4000-8000-000000000001','만년필','Bút máy','명사','[만년필]','만년(muôn đời) + 필(bút) = bút viết được rất lâu',2,'published'),
  ('21100000-0003-4000-8000-000000000001','21000000-0001-4000-8000-000000000001','목도리','Khăn quàng cổ','명사','[목또리]','목(cổ) + 도리(vật quấn quanh)',3,'published'),
  ('21100000-0004-4000-8000-000000000001','21000000-0001-4000-8000-000000000001','상품권','Phiếu mua hàng, thẻ quà tặng','명사','[상품꿘]','상품(hàng hóa) + 권(phiếu/quyền)',4,'published'),
  ('21100000-0005-4000-8000-000000000001','21000000-0001-4000-8000-000000000001','향수','Nước hoa','명사','[향수]','향(hương thơm) + 수(nước)',5,'published'),
  ('21100000-0006-4000-8000-000000000001','21000000-0001-4000-8000-000000000001','상을 받다','Nhận thưởng, được thưởng','동사','[상을 받따]','상(giải thưởng) + 을 받다(nhận)',6,'published'),
  ('21100000-0007-4000-8000-000000000001','21000000-0001-4000-8000-000000000001','취직하다','Tìm việc làm','동사','[취지카다]','취직(tựu chức) + 하다',7,'published'),
  ('21100000-0008-4000-8000-000000000001','21000000-0001-4000-8000-000000000001','결혼하다','Kết hôn','동사','[결혼하다]','결혼 có âm Hán Việt gần với kết hôn',8,'published'),
  ('21100000-0009-4000-8000-000000000001','21000000-0001-4000-8000-000000000001','시험에 합격하다','Thi đậu','동사','[시험에 합껴카다]','합격(hợp cách) + 하다',9,'published'),
  ('21100000-0010-4000-8000-000000000001','21000000-0001-4000-8000-000000000001','축하 메시지를 보내다','Gửi tin nhắn chúc mừng','동사','[축하 메시지를 보내다]','축하 + 메시지 + 보내다(gửi)',10,'published'),
  ('21100000-0011-4000-8000-000000000001','21000000-0001-4000-8000-000000000001','기념사진을 찍다','Chụp ảnh kỷ niệm','동사','[기념사지늘 찍따]','기념(kỷ niệm) + 사진(ảnh) + 찍다(chụp)',11,'published'),
  ('21100000-0012-4000-8000-000000000001','21000000-0001-4000-8000-000000000001','축하 파티를 하다','Tổ chức một buổi ăn mừng','동사','[추카 파티를 하다]','축하 + 파티(party) + 하다',12,'published'),
  ('21100000-0013-4000-8000-000000000001','21000000-0001-4000-8000-000000000001','축하 카드를 쓰다','Viết một tấm thiệp chúc mừng','동사','[추카 카드를 쓰다]','축하 + 카드(card) + 쓰다(viết)',13,'published'),
  ('21100000-0014-4000-8000-000000000001','21000000-0001-4000-8000-000000000001','축의금을 전달하다','Đưa tiền mừng','동사','[추기금을 전달하다]','축의금(tiền mừng cưới) + 전달하다',14,'published'),
  ('21100000-0015-4000-8000-000000000001','21000000-0001-4000-8000-000000000001','축하 인사를 하다','Gửi lời chúc mừng','동사','[추카 인사를 하다]','축하 + 인사(chào hỏi) + 하다',15,'published'),
  ('21100000-0016-4000-8000-000000000001','21000000-0001-4000-8000-000000000001','선물을 주다','Tặng quà','동사','[선무를 주다]','선물(quà) + 주다(cho)',16,'published'),
  ('21100000-0017-4000-8000-000000000001','21000000-0001-4000-8000-000000000001','초대하다','Mời','동사','[초대하다]','초대 + 하다',17,'published'),
  ('21100000-0018-4000-8000-000000000001','21000000-0001-4000-8000-000000000001','초대받다','Nhận được lời mời','동사','[초대받따]','초대 + 받다(nhận)',18,'published'),
  ('21100000-0019-4000-8000-000000000001','21000000-0001-4000-8000-000000000001','졸업식','Lễ tốt nghiệp','명사','[조럽씩]','졸업(tốt nghiệp) + 식(lễ)',19,'published'),
  ('21100000-0020-4000-8000-000000000001','21000000-0001-4000-8000-000000000001','덮개','Tấm che, cái nắp','명사','[덥깨]','덮다(che, đậy) + 개',20,'published'),
  ('21100000-0021-4000-8000-000000000001','21000000-0001-4000-8000-000000000001','쉽다','Dễ dàng','형용사','[쉽따]','Tính từ chỉ sự dễ dàng',21,'published'),
  ('21100000-0022-4000-8000-000000000001','21000000-0001-4000-8000-000000000001','갚다','Trả lại, hoàn lại','동사','[갑따]','Gặp lại người để trả nợ',22,'published'),
  ('21100000-0023-4000-8000-000000000001','21000000-0001-4000-8000-000000000001','탑승','Sự lên tàu xe, máy bay','명사','[탑씅]','탑승 = lên tàu xe hoặc máy bay',23,'published'),
  ('21100000-0024-4000-8000-000000000001','21000000-0001-4000-8000-000000000001','앞집','Nhà đối diện, nhà phía trước','명사','[압찝]','앞(trước) + 집(nhà)',24,'published'),
  ('21100000-0025-4000-8000-000000000001','21000000-0001-4000-8000-000000000001','춥다','Lạnh','형용사','[춥따]','Tính từ chỉ thời tiết lạnh',25,'published'),
  ('21100000-0026-4000-8000-000000000001','21000000-0001-4000-8000-000000000001','입술','Môi','명사','[입쑬]','입(miệng) + 술',26,'published'),
  ('21100000-0027-4000-8000-000000000001','21000000-0001-4000-8000-000000000001','옆집','Nhà bên, nhà hàng xóm','명사','[엽찝]','옆(bên cạnh) + 집(nhà)',27,'published'),
  ('21100000-0028-4000-8000-000000000001','21000000-0001-4000-8000-000000000001','엎드리다','Nằm sấp, sấp xuống sàn','동사','[업뜨리다]','엎 gần âm úp: úp người xuống',28,'published')
on conflict (id) do update set
  lesson_id = excluded.lesson_id,
  word_ko = excluded.word_ko,
  meaning_vi = excluded.meaning_vi,
  part_of_speech = excluded.part_of_speech,
  pronunciation = excluded.pronunciation,
  mnemonic = excluded.mnemonic,
  sort_order = excluded.sort_order,
  status = excluded.status,
  updated_at = now();
