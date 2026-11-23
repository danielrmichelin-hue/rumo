-- Estudos completos: questões resolvidas (por matéria e, se quiser, por tema) e simulados com a nota.
create table public.study_questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  course_id uuid not null references public.study_courses (id) on delete cascade,
  subject_id uuid references public.study_subjects (id) on delete cascade,
  topic_id uuid references public.study_topics (id) on delete set null,
  done_on date not null default current_date,
  total int not null check (total between 1 and 2000),
  correct int not null check (correct >= 0 and correct <= total),
  note text check (char_length(note) <= 500),
  created_at timestamptz not null default now()
);
create index study_questions_course on public.study_questions (course_id, done_on);
create index study_questions_subject on public.study_questions (subject_id);
create index study_questions_topic on public.study_questions (topic_id);
create index study_questions_user on public.study_questions (user_id);

create table public.study_mocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  course_id uuid not null references public.study_courses (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  done_on date not null default current_date,
  total int not null check (total between 1 and 2000),
  correct int not null check (correct >= 0 and correct <= total),
  minutes int check (minutes between 1 and 1440),
  note text check (char_length(note) <= 1000),
  created_at timestamptz not null default now()
);
create index study_mocks_course on public.study_mocks (course_id, done_on);
create index study_mocks_user on public.study_mocks (user_id);

alter table public.study_questions enable row level security;
create policy "dono lê" on public.study_questions for select to authenticated using ((select auth.uid()) = user_id);
create policy "dono cria" on public.study_questions for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "dono altera" on public.study_questions for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "dono apaga" on public.study_questions for delete to authenticated using ((select auth.uid()) = user_id);

alter table public.study_mocks enable row level security;
create policy "dono lê" on public.study_mocks for select to authenticated using ((select auth.uid()) = user_id);
create policy "dono cria" on public.study_mocks for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "dono altera" on public.study_mocks for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "dono apaga" on public.study_mocks for delete to authenticated using ((select auth.uid()) = user_id);
