# Korean Study — Project Handoff / System Flow

> Tài liệu này là **context kỹ thuật dành cho AI/developer tiếp tục xây dựng dự án**. Mục tiêu là mô tả kiến trúc, luồng dữ liệu, nghiệp vụ, các module hiện có và các nguyên tắc không được phá vỡ khi mở rộng hệ thống.

Repository: `NMinMin/korean.study`
Branch chính: `main`

---

## 1. Tổng quan

**Korean Study** là web app học tiếng Hàn theo giáo trình, có:

- Đăng ký / đăng nhập bằng **Supabase Auth**.
- Hồ sơ người dùng, XP, level, streak.
- Quản lý giáo trình và tiến độ từng bài.
- Học **Từ vựng / Ngữ pháp**.
- Flashcard và ôn tập.
- Nghe - chép chính tả.
- Shadowing: ghi âm → Speech-to-Text → hiển thị transcript.
- Quiz / luyện tập AI.
- Ôn tập theo bài và theo lịch.
- Cộng đồng / bài học tùy chỉnh.
- Xếp hạng.
- Hệ thống kim cương và cửa hàng cây tiến độ.
- Cài đặt kế hoạch học và email nhắc học.
- Thông báo realtime.
- Admin dashboard, quản lý người dùng, nội dung và moderation.

Frontend dùng **React + Vite**; dữ liệu nghiệp vụ chính nằm ở **Supabase PostgreSQL**; backend là **Fastify + TypeScript** chạy Node.js và được triển khai riêng (Render). Frontend được triển khai qua Netlify. Cấu hình local/deploy hiện tại được mô tả trong README cũ và package scripts. fileciteturn2file0L2-L2

---

## 2. Kiến trúc tổng thể

```text
┌───────────────────────────────┐
│          React / Vite         │
│         Frontend Web          │
│                               │
│ pages / features / components │
│ services / lib / contexts     │
└───────────────┬───────────────┘
                │
        Supabase JS Client
                │
        ┌───────▼────────┐
        │ Supabase Auth  │
        │ PostgreSQL     │
        │ Realtime       │
        │ RLS / RPC      │
        └───────┬────────┘
                │
        ┌───────▼────────────────────┐
        │ Fastify API / Node >= 20   │
        │ /v1                         │
        │ auth + admin + AI + upload  │
        │ shadowing + reminders      │
        └───────┬────────────────────┘
                │
       ┌────────┼───────────┐
       ▼        ▼           ▼
     Groq    Speech-to-Text  SMTP
      AI        Provider     Email
```

Frontend package hiện tại gồm React 19, React Router 7, Supabase JS, Lucide React, TypeScript/Vite và Zod. Backend dùng Fastify 5, Supabase JS, multipart, Nodemailer, WebSocket và Zod; backend yêu cầu Node >=20. fileciteturn3file0L2-L2 fileciteturn4file0L2-L2

---

## 3. Cấu trúc source chính

```text
/
├── .docs/
│   └── YEU_CAU_APP_KOREAN_STUDY.docx
├── .github/workflows/
│   └── deploy-pages.yml
├── Sound Effect/
│   ├── Complete_Lesson.mp3
│   ├── Correct.mp3
│   ├── Discorrect.mp3
│   └── Notification.mp3
├── UIUX/
│   ├── backgroundcard.png
│   ├── backgroundcard_mobile.png
│   ├── backgrounddangky.png
│   ├── backgrounddangnhap.png
│   ├── Hide.png
│   ├── Show.png
│   └── mugunghwa.png
├── src/
│   ├── App.jsx
│   ├── App.tsx
│   ├── main.jsx
│   ├── components/
│   ├── contexts/
│   ├── data/
│   ├── features/
│   ├── lib/
│   ├── pages/
│   ├── services/
│   ├── styles/
│   └── utils/
├── backend/
│   └── src/
│       ├── config.ts
│       ├── index.ts
│       ├── lib/
│       ├── plugins/
│       ├── routes/
│       └── scripts/
└── supabase/
    └── migrations/
```

`src/App.jsx` hiện là nơi điều phối dashboard và nhiều view/feature: curriculum, vocabulary, grammar, review, dictation, shadowing, AI quiz, community, shop, leaderboard, settings và auth. fileciteturn12file0L2-L2

**Lưu ý cho AI:** trước khi sửa một tính năng, hãy tìm module trong `src/features/<feature>` và service/lib liên quan trước; không nên dồn thêm business logic vào `App.jsx` nếu có thể tách thành feature/service.

---

# 4. Luồng đăng nhập / xác thực

```text
User
 │
 ▼
AuthView
 │
 ▼
Supabase Auth
 │
 ├── session / access token
 │
 ▼
Frontend lấy user/profile
 │
 ▼
Backend request (nếu cần)
 │
 └── Authorization: Bearer <access_token>
          │
          ▼
      requireAuth
          │
          ├── thiếu token → 401 UNAUTHORIZED
          ├── token sai/hết hạn → 401 INVALID_SESSION
          ├── profile.is_locked → 403 ACCOUNT_LOCKED
          └── hợp lệ → request.userId = user.id
```

Backend `requireAuth` đọc Bearer token, xác thực token qua Supabase và kiểm tra `profiles.is_locked` trước khi cho request đi tiếp. fileciteturn6file0L2-L2

### Admin

```text
Bearer token
    ↓
requireAuth
    ↓
requireAdmin
    ↓
/admin/*
```

Toàn bộ `adminRoutes` được gắn `preHandler: requireAdmin`, vì vậy route admin không nên được gọi trực tiếp mà bỏ qua lớp authorization. fileciteturn15file0L2-L2

---

# 5. Luồng khởi động ứng dụng

```text
main.jsx
  ↓
React root
  ↓
App / Auth
  ↓
kiểm tra Supabase session
  ↓
chưa đăng nhập → AuthView
đã đăng nhập  → KoreanStudyDashboard
  ↓
load profile / catalog / stats
  ↓
home dashboard
```

Dashboard giữ state cho `profile`, `active`, `view`, bài học hiện tại, review state, catalog, shop, user stats... Các view học tập được coi là `ACTIVE_STUDY_VIEWS` để điều khiển layout/navigation. fileciteturn12file0L2-L2

---

# 6. Luồng giáo trình

## 6.1 Load catalog

Frontend gọi `loadLearningCatalog()`.

```text
Supabase
 │
 ├── textbooks
 ├── lessons
 ├── user_textbooks
 ├── lesson_progress
 ├── activity_progress
 ├── vocabulary
 ├── grammar_patterns
 └── lesson_exercises
        ↓
loadLearningCatalog()
        ↓
map / tính progress
        ↓
LearningCatalog
        ↓
CurriculumHub / Lessons / Study views
```

`LearningCatalog` gồm `textbooks`, `myTextbooks`, `availableTextbooks`, `lessons`, `activeTextbook`, `continueLesson`, `vocabulary`, `grammar`, `exercises`. fileciteturn14file0L2-L2

## 6.2 Thêm giáo trình

```text
Available textbook
      ↓
addUserTextbook(textbookId)
      ↓
user_textbooks
      ↓
reload catalog
      ↓
MyTextbooks / active textbook
```

Chỉ nên cho user thêm giáo trình có trạng thái phù hợp theo nghiệp vụ; không hard-code danh sách giáo trình trong UI nếu dữ liệu đã có trong database.

## 6.3 Mở bài học

```text
Lesson card
   ↓
openLesson(lesson)
   ├── markLessonStarted(textbookId, lessonId)
   ├── cập nhật active/continue lesson
   └── view = lesson-detail
```

`markLessonStarted` quan trọng vì dashboard cần nhớ bài mà người dùng **chủ động mở**, kể cả khi progress vẫn 0%. Logic catalog hiện ưu tiên lesson được chọn rõ ràng trước khi fallback sang bài đang học hoặc bài tiếp theo. fileciteturn14file0L2-L2

---

# 7. Luồng hoàn thành bài học

Một lesson hiện được tính dựa trên 4 activity bắt buộc:

```text
REQUIRED_LESSON_ACTIVITIES =
  1. tuvung
  2. nghechep
  3. shadowing
  4. ontap
```

Progress lesson được tính từ progress của các activity này và so với `lesson_progress`. Khi tất cả activity đạt 100% và có `completed_at`, lesson được coi là hoàn thành. fileciteturn14file0L2-L2

Luồng khái quát:

```text
Lesson Detail
   │
   ├── Từ vựng
   │     └── activity_progress
   │
   ├── Nghe chép
   │     └── activity_progress
   │
   ├── Shadowing
   │     └── activity_progress
   │
   └── Ôn tập
         └── activity_progress
              ↓
       effective lesson progress
              ↓
       lesson_progress / stats
              ↓
       lesson done?
              ↓
       XP / gem / streak / dashboard
```

**Nguyên tắc:** nếu thay đổi cách tính completion, phải kiểm tra đồng thời dashboard, continue-learning, XP/gem, streak và review vì chúng phụ thuộc vào trạng thái hoàn thành.

---

# 8. Luồng Từ vựng / Ngữ pháp

## Từ vựng

Nguồn chính là bảng `vocabulary`; ngoài ra một số exercise `skill_type = vocabulary_grammar` và `exercise_type` thuộc nhóm vocabulary có thể được map thành vocabulary bổ sung. fileciteturn14file0L2-L2

```text
lesson
 ↓
vocabulary rows
 ↓
word / meaning / type / pronunciation
mnemonic / image / audio
 ↓
Vocab views
 ↓
Flashcard / Test / Review
 ↓
vocabulary_progress
```

## Ngữ pháp

```text
lesson
 ↓
grammar_patterns
 ↓
pattern / meaning / usage
conjugation / notes
 ↓
GrammarBookView
 ↓
Review / practice
```

---

# 9. Luồng Flashcard / Review

Các view review hiện có gồm:

- Review Hub
- Review Intro
- Review Quiz
- Review Result
- Review Lesson Select
- Flashcard
- Flashcard notebook
- Flashcard schedule
- Flashcard grammar

State review trong dashboard gồm answers, writing, reflex, difficulty, elapsed time, mode, selected lessons, seed, recheck và deck. fileciteturn12file0L2-L2

Khi mở rộng review, cần phân biệt:

```text
Normal practice
≠
Review scheduled items
≠
Recheck incorrect answers
```

Không nên dùng một state chung để làm mất khả năng phân biệt 3 luồng trên.

---

# 10. Luồng Nghe - Chép chính tả

Frontend có các mode như:

- Dictation practice
- Fill blank listen
- Match pairs
- Choose image

Khái quát:

```text
Lesson
 ↓
DictationView
 ↓
exercise từ lesson_exercises
 ↓
nghe audio / tương tác
 ↓
kiểm tra answer
 ↓
progress activity
 ↓
lesson progress
```

Các exercise có `skill_type = dictation` thuộc hệ thống `lesson_exercises`. fileciteturn14file0L2-L2

---

# 11. Luồng Shadowing

Đây là một trong các luồng có backend riêng.

```text
User
 ↓
ShadowingView
 ↓
record audio
 ↓
POST /v1/shadowing/transcribe
       Authorization: Bearer token
       multipart/form-data
       file = audio
 ↓
Fastify
 ↓
requireAuth
 ↓
validate audio
 ↓
Speech-to-Text provider
 ↓
transcript
 ↓
Frontend hiển thị kết quả
 ↓
chấm / progress / hoàn thành activity
```

Backend giới hạn 1 file, tối đa 20 MB, chỉ nhận MIME type bắt đầu bằng `audio/`, timeout Speech-to-Text 60 giây. Nếu không nhận diện được lời nói trả `422 SPEECH_NOT_RECOGNIZED`. fileciteturn9file0L2-L2

**Không đưa API key của Speech-to-Text vào frontend.** Provider URL và secret phải ở backend env.

---

# 12. Luồng AI Quiz / AI Grader

AI endpoint hiện tại:

```text
POST /v1/ai/json
```

Flow:

```text
AIQuizView
   ↓
POST /v1/ai/json
   ↓
requireAuth
   ↓
Zod validate text
   ↓
Groq API
   ↓
JSON object
   ↓
backend trả { result, model }
   ↓
frontend parse / hiển thị / chấm
```

Request chỉ nhận `text` dạng string, trim, độ dài 1–15.000 ký tự. Backend sử dụng Groq OpenAI-compatible Chat Completions với JSON response format, temperature thấp và timeout 25 giây. fileciteturn8file0L2-L2

Các lỗi đã được chuẩn hóa:

- `AI_GRADER_NOT_CONFIGURED`
- `INVALID_AI_REQUEST`
- `AI_GRADER_TIMEOUT`
- `AI_GRADER_RATE_LIMIT`
- `AI_GRADER_CREDENTIALS_REJECTED`
- `AI_GRADER_UPSTREAM_ERROR`
- `AI_GRADER_INVALID_RESPONSE`

**Nguyên tắc mở rộng AI:** frontend chỉ gửi dữ liệu học tập cần thiết; API key, provider URL và model config phải ở backend.

---

# 13. Luồng Dashboard / XP / Streak

Frontend gọi `computeAndSyncUserStats()` để đồng bộ thống kê user. Dashboard cũng subscribe Supabase Realtime trên `user_dashboard_snapshots`. Khi snapshot thay đổi, `xp` và `streak` được cập nhật ngay trên UI. fileciteturn12file0L2-L2

```text
Learning activity
      ↓
progress / daily stats
      ↓
computeAndSyncUserStats
      ↓
user stats / dashboard snapshot
      ↓
Realtime event
      ↓
Dashboard cập nhật XP + streak
```

Khi hoàn thành lesson còn có sound celebration và reward flow. Các module liên quan trong `App.jsx` gồm `progressService`, `gemStore`, `activityProgress` và `audioService`. fileciteturn12file0L2-L2

---

# 14. Luồng Kim cương / Shop / Cây tiến độ

```text
Hoàn thành lesson / reward
        ↓
awardLessonGems
        ↓
Gem balance
        ↓
Plant Shop
   ├── purchasePlant(plantId)
   │       ↓
   │   balance đủ?
   │       ├── không → error
   │       └── có → sở hữu plant
   │
   └── selectPlant(plantId)
           ↓
       selected plant
```

Dashboard giữ `balance`, `selectedPlant`, `plants` và có refresh shop sau thao tác mua/chọn. fileciteturn12file0L2-L2

**Không chỉ trừ gem ở frontend.** Nếu backend/database có transaction/RPC cho reward/purchase thì phải dùng logic server/database làm nguồn sự thật.

---

# 15. Luồng thông báo realtime

Frontend subscribe bảng `notifications` theo `user_id`.

```text
Database INSERT notification
        ↓
Supabase Realtime
        ↓
frontend channel
        ↓
play Notification.mp3
        ↓
window event: kstudy:notification-received
        ↓
UI refresh / notification state
```

Dashboard hiện có channel riêng cho notifications và phát sound khi có INSERT. fileciteturn12file0L2-L2

---

# 16. Luồng nhắc học bằng email

Endpoint backend:

```text
POST /v1/jobs/study-reminders
```

Endpoint này **không dùng user Bearer token**; nó dùng header:

```text
x-job-secret: <REMINDER_JOB_SECRET>
```

Flow:

```text
Scheduler / Cron
      ↓
POST /v1/jobs/study-reminders
      ↓
check x-job-secret
      ↓
expire_inactive_streaks()
      ↓
load user_settings
      ↓
reminder_enabled = true?
      ↓
kiểm tra weekly_schedule
      ↓
kiểm tra timezone + reminder_time
      ↓
kiểm tra daily_study_stats
      ↓
đã học hôm nay?
  ├── có → bỏ qua
  └── chưa → claim reminder_email_deliveries
                    ↓
                  lấy email
                    ↓
                 SMTP send
```

Backend dùng timezone của profile, mặc định `Asia/Ho_Chi_Minh`, và cho phép sai lệch khoảng 7 phút quanh reminder time. Nó cũng tránh gửi trùng bằng bảng `reminder_email_deliveries`. fileciteturn10file0L2-L2

**Quan trọng:** streak maintenance phải tiếp tục hoạt động ngay cả khi SMTP chưa cấu hình; đây là chủ ý của code hiện tại. fileciteturn10file0L2-L2

---

# 17. Luồng Admin

Admin API nằm dưới `/v1/admin/*` và bắt buộc `requireAdmin`. fileciteturn15file0L2-L2

Các nhóm nghiệp vụ hiện có trong `admin.ts` gồm:

- Dashboard thống kê.
- Danh sách người dùng.
- Thay đổi role `user/admin`.
- Khóa / mở khóa tài khoản.
- Quản lý giáo trình.
- Quản lý lesson.
- Quản lý vocabulary / grammar / exercises.
- Media / upload liên quan nội dung.
- Content reports / moderation.
- Các thao tác quản trị khác được triển khai trong cùng route module.

## Admin dashboard

Dashboard hỗ trợ range 7 hoặc 30 ngày và có cache 5 phút. Dữ liệu gồm active users, average completed lessons, average minutes, retention, pending reports, số textbook/lesson/user, chart theo ngày, course progress và vocabulary khó. fileciteturn15file0L2-L2

```text
Admin
 ↓
GET /v1/admin/dashboard?days=7|30
 ↓
cache còn mới?
 ├── có → trả cache
 └── không
       ↓
   query study stats
   query lesson progress
   query vocabulary progress
   query counts
       ↓
   aggregate
       ↓
   save admin_dashboard_cache
       ↓
   response
```

---

# 18. Khóa tài khoản

```text
Admin
 ↓
PATCH /v1/admin/users/:id/lock
 ↓
Auth ban/unban
 ↓
profiles.is_locked
profiles.locked_at
profiles.locked_by
```

Không cho admin tự khóa chính mình. Khi update profile thất bại, code có rollback trạng thái Auth. fileciteturn15file0L2-L2

---

# 19. Database / Supabase

Database được xây dựng theo migration tăng dần trong `supabase/migrations`.

Các nhóm migration hiện thấy gồm:

```text
foundation
study plans + daily stats
flashcard progress
seed Sejong 2-1
Sejong 1-1 / 1-2 lessons
admin dashboard cache
admin dashboard realtime
community moderation
lesson exercises
seed lesson exercises
exercise media
user account lock
...
```

Danh sách migration hiện tại cho thấy schema được phát triển theo từng feature, không phải một schema duy nhất. fileciteturn13file0L2-L2

### Khi thêm database feature

Luôn ưu tiên:

```text
Feature requirement
 ↓
new migration SQL
 ↓
constraints / indexes / RLS / RPC / trigger nếu cần
 ↓
service/lib
 ↓
UI
```

Không sửa trực tiếp database production bằng SQL ad-hoc rồi quên tạo migration.

---

# 20. RLS / security model

Supabase là nguồn dữ liệu chính và frontend dùng public `VITE_*` credentials. README gốc nhấn mạnh rằng mọi biến `VITE_*` đều có thể đọc bởi browser; tuyệt đối không đưa service-role key, Google service-account JSON hoặc secret job vào `VITE_*`. fileciteturn2file0L2-L2

```text
PUBLIC / browser
  ├── VITE_SUPABASE_URL
  └── VITE_SUPABASE_ANON_KEY

SERVER ONLY
  ├── SUPABASE_SERVICE_ROLE_KEY
  ├── GROQ_GRADER_API_KEY
  ├── SMTP credentials
  ├── REMINDER_JOB_SECRET
  ├── Speech-to-Text secret/config
  └── các secret khác
```

**Không expose server secret qua frontend bundle.**

---

# 21. Backend API map

Backend register các route group sau dưới prefix `/v1`: `me`, `uploads`, `admin`, `shadowing`, `ai`, `reminders`. Health endpoint là `/health`. fileciteturn5file0L2-L2

| Nhóm | Prefix / endpoint | Auth |
|---|---|---|
| Health | `GET /health` | Không |
| Me | `/v1/me` | Bearer |
| Uploads | `/v1/...` | tùy route |
| Admin | `/v1/admin/...` | Admin |
| AI | `POST /v1/ai/json` | Bearer |
| Shadowing | `POST /v1/shadowing/transcribe` | Bearer |
| Reminder job | `POST /v1/jobs/study-reminders` | Job secret |

`/health` trả trạng thái service và timestamp; API có not-found handler và error handler thống nhất với `requestId`. fileciteturn5file0L2-L2

---

# 22. Error handling convention

Backend nên giữ format lỗi:

```json
{
  "code": "ERROR_CODE",
  "message": "Thông báo cho người dùng",
  "requestId": "..."
}
```

Một số endpoint thêm `upstreamStatus` / `upstreamCode` khi lỗi từ provider bên ngoài. AI route hiện đã áp dụng convention này. fileciteturn8file0L2-L2

Khi tạo endpoint mới:

1. Validate input bằng Zod.
2. Trả HTTP status phù hợp.
3. Có error `code` ổn định.
4. Log lỗi phía server.
5. Trả `requestId` để debug.
6. Không trả secret/provider credential ra client.

---

# 23. Realtime model

Hiện frontend sử dụng Supabase Realtime cho ít nhất:

- `user_dashboard_snapshots` → cập nhật XP/streak.
- `notifications` → thông báo realtime.

Khi tạo subscription:

```text
supabase.channel(uniqueChannel)
  ↓
.on('postgres_changes', ...)
  ↓
.subscribe()
  ↓
cleanup: supabase.removeChannel(channel)
```

Dashboard đã cleanup channel trong `useEffect`, vì vậy feature mới phải giữ nguyên pattern này để tránh leak/subscription trùng. fileciteturn12file0L2-L2

---

# 24. Fallback data

`src/data/fallbackData` chứa dữ liệu fallback/sample như lesson, vocabulary, grammar, shadow lines và context liên quan dashboard. `loadLearningCatalog()` ưu tiên database; fallback tồn tại để UI có thể hoạt động trong một số tình huống dữ liệu chưa sẵn sàng. fileciteturn12file0L2-L2

**AI khi phát triển feature mới:** không nên mặc định thêm mock data thay cho database nếu feature đã có schema thật. Trước tiên kiểm tra migration + service + mapping.

---

# 25. Data flow chuẩn cho feature mới

Khi AI/developer được yêu cầu xây thêm tính năng, dùng flow này:

```text
1. Requirement
      ↓
2. Xác định user flow
      ↓
3. Xác định data cần lưu
      ↓
4. Kiểm tra bảng / migration hiện có
      ↓
5. Nếu thiếu → tạo migration
      ↓
6. Cập nhật RLS / RPC / trigger nếu cần
      ↓
7. Tạo service/lib cho data access
      ↓
8. Tạo backend endpoint nếu có secret,
   privileged operation hoặc external provider
      ↓
9. Tạo feature UI
      ↓
10. Update progress / XP / streak nếu feature là activity
      ↓
11. Realtime nếu cần
      ↓
12. Error handling
      ↓
13. Test / typecheck / lint / build
```

---

# 26. Quy tắc quan trọng khi tiếp tục code

## Không phá business rule hiện tại

- Lesson completion dựa trên 4 activity bắt buộc.
- Progress lesson không được tự ý đổi mẫu số.
- `last_activity = lesson` có ý nghĩa: user chủ động chọn bài.
- Dashboard continue-learning phải ưu tiên bài user vừa chọn.
- Timezone mặc định của app là `Asia/Ho_Chi_Minh`.
- Streak và daily stats có logic database/backend riêng.
- Reward/gem không nên chỉ tin dữ liệu client.

## Không đưa secret vào frontend

Đặc biệt:

- `SUPABASE_SERVICE_ROLE_KEY`
- Groq API key
- SMTP password
- job secret
- Speech-to-Text secret
- Google service account

## Không bypass auth

Endpoint user → `requireAuth`.
Endpoint admin → `requireAdmin`.
Job endpoint → secret riêng.

## Không tạo duplicate logic

Trước khi viết mới, tìm:

```text
src/features/
src/lib/
src/services/
backend/src/routes/
backend/src/plugins/
supabase/migrations/
```

Nếu đã có service/helper thì tái sử dụng.

---

# 27. Development commands

## Frontend

```bash
npm install
npm run dev
npm run typecheck
npm run lint
npm run build
npm run preview
```

Các script frontend hiện được khai báo trong root `package.json`. fileciteturn3file0L2-L2

## Backend

```bash
cd backend
npm install
npm run dev
npm run typecheck
npm run build
npm start
```

Backend cũng có:

```bash
npm run seed:admin
```

Các script này và yêu cầu Node >=20 nằm trong `backend/package.json`. fileciteturn4file0L2-L2

---

# 28. Environment

## Frontend

Copy:

```text
.env.example → .env
```

Các biến public hiện có tối thiểu:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

## Backend

Copy:

```text
backend/.env.example → backend/.env
```

Các secret backend được mô tả trong file env example và config backend. Không commit `.env`. README gốc cũng yêu cầu tách server-only secret khỏi `VITE_*`. fileciteturn2file0L2-L2

---

# 29. Deployment

Kiến trúc deploy hiện tại:

```text
GitHub
 ├── frontend → Netlify
 └── backend → Render

Supabase
 ├── Auth
 ├── PostgreSQL
 ├── Realtime
 └── RPC / database logic
```

Frontend dùng `netlify.toml`; backend dùng `render.yaml`. Supabase Auth cần cấu hình Site URL và Redirect URLs cho production/staging domain. fileciteturn2file0L2-L2

---

# 30. AI Handoff Prompt — dùng cho AI khác

Có thể copy nguyên block dưới đây khi giao repository cho AI khác:

```text
Bạn đang tiếp tục phát triển repository NMinMin/korean.study.

Đây là ứng dụng học tiếng Hàn dùng:
- React + Vite frontend
- Supabase Auth + PostgreSQL + Realtime + RLS/RPC
- Fastify + TypeScript backend, Node >=20
- Netlify frontend deployment
- Render backend deployment
- Groq cho AI grading/JSON
- Speech-to-Text provider cho shadowing
- SMTP cho study reminder email

Hãy đọc README.md này trước khi sửa code.

Kiến trúc:
Frontend → Supabase trực tiếp cho dữ liệu người dùng/nghiệp vụ thông thường.
Frontend → Fastify /v1 cho các tác vụ cần server, secret, external provider hoặc privileged operation.
Backend → Supabase bằng server client khi cần quyền server.

Auth:
- User API dùng Authorization: Bearer <access_token>.
- Backend requireAuth xác thực token và kiểm tra profiles.is_locked.
- Admin route dùng requireAdmin.
- Reminder job dùng x-job-secret, không dùng user Bearer token.

Learning flow:
textbook → lesson → lesson activities → activity_progress → lesson_progress → XP/streak/dashboard.
Một lesson hiện yêu cầu 4 activity: tuvung, nghechep, shadowing, ontap.
Không thay đổi business rule này nếu requirement không yêu cầu.

Catalog:
loadLearningCatalog() lấy textbooks, lessons, user_textbooks, lesson_progress, activity_progress, vocabulary, grammar_patterns và lesson_exercises rồi map thành LearningCatalog.

Lesson navigation:
markLessonStarted() được gọi khi user chủ động mở lesson. last_activity='lesson' phải được tôn trọng để dashboard không tự nhảy sang bài khác.

Shadowing:
POST /v1/shadowing/transcribe → multipart audio → Speech-to-Text → transcript.
Giới hạn audio 20 MB.

AI:
POST /v1/ai/json → authenticated request → Zod validation → Groq → JSON response.
Không bao giờ expose Groq API key ở frontend.

Realtime:
user_dashboard_snapshots → XP/streak.
notifications → notification sound + UI event.
Luôn cleanup Supabase channel trong useEffect.

Security:
Không đưa SUPABASE_SERVICE_ROLE_KEY, API keys, SMTP password, job secret hoặc provider secret vào VITE_*.
Không bypass RLS/auth.
Không tin reward/gem từ client nếu operation có thể được xác thực ở server/database.

Database:
Mọi thay đổi schema phải tạo migration mới trong supabase/migrations.
Kiểm tra migration, RLS, indexes, RPC và trigger trước khi tạo bảng/logic mới.

Development:
Frontend: npm run typecheck && npm run lint && npm run build
Backend: cd backend && npm run typecheck && npm run build

Khi implement feature mới:
1. đọc code hiện tại liên quan
2. xác định data flow
3. tái sử dụng service/helper
4. tạo migration nếu thiếu schema
5. cập nhật RLS/RPC/trigger nếu cần
6. thêm backend endpoint nếu cần
7. thêm UI feature
8. nối progress/reward/realtime nếu feature có liên quan
9. xử lý error bằng code ổn định + requestId
10. chạy typecheck/lint/build

Không rewrite toàn bộ project nếu chỉ cần sửa một feature.
Không tạo mock/fallback mới nếu database/service thật đã tồn tại.
Giữ nguyên UI/UX hiện tại trừ khi requirement yêu cầu thay đổi.
```

---

# 31. Checklist trước khi merge

```text
[ ] Feature có đúng user flow?
[ ] Đã đọc service/helper hiện có chưa?
[ ] Database có migration chưa?
[ ] RLS có đúng chưa?
[ ] Auth có đúng chưa?
[ ] Admin có bị lộ endpoint không?
[ ] Secret có nằm server-only không?
[ ] Progress có cập nhật đúng không?
[ ] XP/gem/streak có bị cộng trùng không?
[ ] Timezone có đúng Asia/Ho_Chi_Minh không?
[ ] Realtime channel có cleanup không?
[ ] Loading/error/empty state có chưa?
[ ] Mobile UI có được kiểm tra không?
[ ] npm run typecheck pass?
[ ] npm run lint pass?
[ ] npm run build pass?
[ ] backend typecheck/build pass?
```

---

# 32. Tài liệu nguồn quan trọng

- `.docs/YEU_CAU_APP_KOREAN_STUDY.docx`: yêu cầu nghiệp vụ gốc.
- `src/App.jsx`: orchestration/dashboard và mapping giữa nhiều feature.
- `src/lib/learningContent.ts`: catalog + lesson progress mapping.
- `backend/src/index.ts`: API registration, CORS, error handling.
- `backend/src/plugins/auth.ts`: authentication.
- `backend/src/plugins/admin.ts`: admin authorization.
- `backend/src/routes/admin.ts`: admin API.
- `backend/src/routes/ai.ts`: AI API.
- `backend/src/routes/shadowing.ts`: Speech-to-Text API.
- `backend/src/routes/reminders.ts`: scheduled reminder job.
- `supabase/migrations/*`: nguồn sự thật về database schema và database logic.

---

# 33. Nguyên tắc cuối cùng

> **Đừng chỉ nhìn UI. Hãy lần theo toàn bộ flow: UI → feature → service/lib → Supabase/backend → database → progress/reward/realtime.**

Một thay đổi được xem là hoàn chỉnh chỉ khi nó không làm sai các trạng thái liên quan: **auth → data → progress → XP/streak → dashboard → realtime → notification/reward**.

README này là tài liệu handoff; khi kiến trúc hoặc business rule thay đổi đáng kể, hãy cập nhật README cùng lúc với code/migration để AI/developer tiếp theo không phải đoán lại hệ thống.
