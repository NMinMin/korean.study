create extension if not exists pgcrypto;

create type public.app_role as enum ('user', 'admin');
create type public.content_status as enum ('draft', 'published', 'locked', 'no_content');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 60),
  avatar_url text,
  timezone text not null default 'Asia/Ho_Chi_Minh',
  xp integer not null default 0 check (xp >= 0),
  level integer not null default 1 check (level >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_roles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  role public.app_role not null default 'user',
  created_at timestamptz not null default now()
);

create table public.user_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  daily_goal_minutes integer not null default 15 check (daily_goal_minutes between 5 and 180),
  weekly_schedule smallint[] not null default '{1,2,3,4,5}',
  reminder_enabled boolean not null default false,
  reminder_time time not null default '20:00',
  effect_sound_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

create table public.streak_states (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  current_streak integer not null default 0 check (current_streak >= 0),
  longest_streak integer not null default 0 check (longest_streak >= 0),
  last_study_date date,
  freeze_available boolean not null default true,
  freeze_granted_month date not null default date_trunc('month', current_date)::date,
  updated_at timestamptz not null default now()
);

create table public.textbooks (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title_ko text not null,
  title_vi text,
  description text,
  cover_url text,
  sort_order integer not null default 0,
  status public.content_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  textbook_id uuid not null references public.textbooks(id) on delete cascade,
  lesson_number integer not null check (lesson_number > 0),
  title_ko text not null,
  title_vi text,
  status public.content_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (textbook_id, lesson_number)
);

create table public.vocabulary (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  word_ko text not null,
  meaning_vi text not null,
  part_of_speech text,
  pronunciation text,
  mnemonic text,
  image_url text,
  audio_url text,
  sort_order integer not null default 0,
  status public.content_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.vocabulary_examples (
  id uuid primary key default gen_random_uuid(),
  vocabulary_id uuid not null references public.vocabulary(id) on delete cascade,
  sentence_ko text not null,
  translation_vi text not null,
  audio_url text,
  sort_order integer not null default 0
);

create table public.grammar_patterns (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  structure text not null,
  meaning_vi text not null,
  usage_vi text,
  conjugation_vi text,
  notes_vi text,
  status public.content_status not null default 'draft',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.user_textbooks (
  user_id uuid not null references public.profiles(id) on delete cascade,
  textbook_id uuid not null references public.textbooks(id) on delete cascade,
  status text not null default 'studying' check (status in ('studying','completed','paused')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  primary key (user_id, textbook_id)
);

create table public.lesson_progress (
  user_id uuid not null references public.profiles(id) on delete cascade,
  textbook_id uuid not null references public.textbooks(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  progress_percent numeric(5,2) not null default 0 check (progress_percent between 0 and 100),
  last_activity text,
  last_position jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

create table public.vocabulary_progress (
  user_id uuid not null references public.profiles(id) on delete cascade,
  textbook_id uuid not null references public.textbooks(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  vocabulary_id uuid not null references public.vocabulary(id) on delete cascade,
  mastery smallint not null default 0 check (mastery between 0 and 5),
  correct_count integer not null default 0,
  incorrect_count integer not null default 0,
  next_review_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, vocabulary_id)
);

create table public.vocabulary_bookmarks (
  user_id uuid not null references public.profiles(id) on delete cascade,
  vocabulary_id uuid not null references public.vocabulary(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, vocabulary_id)
);

create table public.vocabulary_notes (
  user_id uuid not null references public.profiles(id) on delete cascade,
  vocabulary_id uuid not null references public.vocabulary(id) on delete cascade,
  note text not null default '' check (char_length(note) <= 2000),
  updated_at timestamptz not null default now(),
  primary key (user_id, vocabulary_id)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null,
  title text not null,
  body text,
  payload jsonb not null default '{}',
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
declare display_name_value text;
begin
  display_name_value := coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1), 'Người học');
  insert into public.profiles (id, display_name) values (new.id, display_name_value);
  insert into public.user_roles (user_id, role) values (new.id, 'user');
  insert into public.user_settings (user_id) values (new.id);
  insert into public.streak_states (user_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.user_roles where user_id = auth.uid() and role = 'admin');
$$;

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.user_settings enable row level security;
alter table public.streak_states enable row level security;
alter table public.textbooks enable row level security;
alter table public.lessons enable row level security;
alter table public.vocabulary enable row level security;
alter table public.vocabulary_examples enable row level security;
alter table public.grammar_patterns enable row level security;
alter table public.user_textbooks enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.vocabulary_progress enable row level security;
alter table public.vocabulary_bookmarks enable row level security;
alter table public.vocabulary_notes enable row level security;
alter table public.notifications enable row level security;

create policy "profiles readable by authenticated users" on public.profiles for select to authenticated using (true);
create policy "users update own profile" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "users read own role" on public.user_roles for select to authenticated using (user_id = auth.uid());
create policy "users manage own settings" on public.user_settings for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "users read own streak" on public.streak_states for select to authenticated using (user_id = auth.uid());

create policy "published textbooks are readable" on public.textbooks for select to authenticated using (status = 'published' or public.is_admin());
create policy "published lessons are readable" on public.lessons for select to authenticated using (status in ('published','locked','no_content') or public.is_admin());
create policy "published vocabulary is readable" on public.vocabulary for select to authenticated using (status = 'published' or public.is_admin());
create policy "published vocabulary examples are readable" on public.vocabulary_examples for select to authenticated using (exists(select 1 from public.vocabulary v where v.id = vocabulary_id and (v.status = 'published' or public.is_admin())));
create policy "published grammar is readable" on public.grammar_patterns for select to authenticated using (status = 'published' or public.is_admin());

create policy "admins manage textbooks" on public.textbooks for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage lessons" on public.lessons for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage vocabulary" on public.vocabulary for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage vocabulary examples" on public.vocabulary_examples for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage grammar" on public.grammar_patterns for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "users manage own textbooks" on public.user_textbooks for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "users manage own lesson progress" on public.lesson_progress for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "users manage own vocabulary progress" on public.vocabulary_progress for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "users manage own bookmarks" on public.vocabulary_bookmarks for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "users manage own vocabulary notes" on public.vocabulary_notes for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "users read own notifications" on public.notifications for select to authenticated using (user_id = auth.uid());
create policy "users update own notifications" on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create index lessons_textbook_idx on public.lessons(textbook_id, lesson_number);
create index vocabulary_lesson_idx on public.vocabulary(lesson_id, sort_order);
create index notifications_user_unread_idx on public.notifications(user_id, created_at desc) where read_at is null;
