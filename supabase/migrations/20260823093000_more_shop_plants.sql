insert into public.plant_catalog (id, name, description, price, sort_order, is_active) values
  ('succulent', 'Sen đá', 'Từng vòng lá mọng nước bung ra theo tiến độ.', 90, 6, true),
  ('cactus', 'Xương rồng', 'Bền bỉ lớn lên, đâm nhánh và nở hoa sa mạc.', 120, 7, true),
  ('bamboo', 'Tre may mắn', 'Từng đốt tre vươn cao mang ý nghĩa may mắn.', 180, 8, true),
  ('monstera', 'Trầu bà lá xẻ', 'Những chiếc lá lớn lần lượt bung và xẻ tán.', 220, 9, true),
  ('rose', 'Hoa hồng', 'Thân leo phát triển rồi nở thành chùm hoa rực rỡ.', 200, 10, true)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  price = excluded.price,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active;
