-- Estudos refeitos (24/11/2026): Área (Profissional, Intelectual) > Projeto (Marketing, História…) > Disciplina
-- (Psicologia do Consumidor…) > Aulas numeradas. Cada área tem quantas aulas por dia (1 aula = 1 hora) e em que dias;
-- as disciplinas da área andam em paralelo, uma por aula do dia, na ordem dos projetos e das disciplinas.
-- As tabelas antigas de estudos (study_courses, study_subjects…) ficam como estão.

create table public.study_areas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  daily_lessons smallint not null default 1 check (daily_lessons between 0 and 12),
  weekdays smallint[] not null default '{1,2,3,4,5}',
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index study_areas_user on public.study_areas (user_id, position);

create table public.study_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  area_id uuid not null references public.study_areas (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  color text not null default '#6C4ED9' check (color ~ '^#[0-9a-fA-F]{6}$'),
  position int not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);
create index study_projects_area on public.study_projects (area_id, position);
create index study_projects_user on public.study_projects (user_id);

create table public.study_disciplines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id uuid not null references public.study_projects (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index study_disciplines_project on public.study_disciplines (project_id, position);
create index study_disciplines_user on public.study_disciplines (user_id);

create table public.study_lessons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  discipline_id uuid not null references public.study_disciplines (id) on delete cascade,
  number int not null check (number between 1 and 1000),
  title text check (char_length(title) <= 160),
  done_on date,
  minutes int check (minutes between 0 and 1440),
  note text check (char_length(note) <= 4000),
  created_at timestamptz not null default now(),
  unique (discipline_id, number)
);
create index study_lessons_discipline on public.study_lessons (discipline_id, number);
create index study_lessons_user_done on public.study_lessons (user_id, done_on);

alter table public.study_areas enable row level security;
create policy "dono lê" on public.study_areas for select to authenticated using ((select auth.uid()) = user_id);
create policy "dono cria" on public.study_areas for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "dono altera" on public.study_areas for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "dono apaga" on public.study_areas for delete to authenticated using ((select auth.uid()) = user_id);

alter table public.study_projects enable row level security;
create policy "dono lê" on public.study_projects for select to authenticated using ((select auth.uid()) = user_id);
create policy "dono cria" on public.study_projects for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "dono altera" on public.study_projects for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "dono apaga" on public.study_projects for delete to authenticated using ((select auth.uid()) = user_id);

alter table public.study_disciplines enable row level security;
create policy "dono lê" on public.study_disciplines for select to authenticated using ((select auth.uid()) = user_id);
create policy "dono cria" on public.study_disciplines for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "dono altera" on public.study_disciplines for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "dono apaga" on public.study_disciplines for delete to authenticated using ((select auth.uid()) = user_id);

alter table public.study_lessons enable row level security;
create policy "dono lê" on public.study_lessons for select to authenticated using ((select auth.uid()) = user_id);
create policy "dono cria" on public.study_lessons for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "dono altera" on public.study_lessons for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "dono apaga" on public.study_lessons for delete to authenticated using ((select auth.uid()) = user_id);
