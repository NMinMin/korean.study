# Korean Study

Ứng dụng React/Vite với Supabase Auth/PostgreSQL và API Fastify chạy trên Render.

## Chạy local

1. Sao chép `.env.example` thành `.env` và điền `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
2. Sao chép `backend/.env.example` thành `backend/.env` và điền các secret backend.
3. Chạy migration trong `supabase/migrations` trên Supabase staging.
4. Chạy frontend bằng `npm run dev`.
5. Chạy API bằng `npm run dev` trong thư mục `backend`.

Không đưa `SUPABASE_SERVICE_ROLE_KEY`, Google service-account JSON hoặc secret tác vụ vào biến `VITE_*`. Mọi biến `VITE_*` đều có thể được trình duyệt và người dùng cuối đọc.

## Kiểm tra

- Frontend: `npm run typecheck`, `npm run lint`, `npm run build`.
- Backend: `npm run typecheck`, `npm run build`.

## Deploy

- Netlify đọc cấu hình `netlify.toml`; thêm các biến frontend trong Site configuration.
- Render đọc `render.yaml`; thêm các biến server-only trong Environment.
- Cấu hình Supabase Auth Site URL và Redirect URLs cho domain Netlify production/staging.
