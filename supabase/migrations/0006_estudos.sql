-- Estudos: matérias, ciclos, sessões e progresso (docs/plano-modulos.md, fase 5; Book 6.2)
-- Sessões são compromissos do Core (events); leituras e "concluir o curso" são Rotas.

create table public.study_courses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  kind text not null default 'curso' check (kind in ('graduacao', 'pos', 'idioma', 'concurso', 'curso')),
  context_id uuid references public.contexts (id) on delete set null,
  total_lessons int check (total_lessons is null or total_lessons > 0),
  done_lessons int not null default 0 check (done_lessons >= 0),
  cycles int check (cycles is null or cycles > 0),          -- quantos ciclos (módulos, semestres)
  current_cycle int not null default 1 check (current_cycle > 0),
  cycle_started_on date not null default current_date,      -- para "semana 2" do ciclo
  weekly_minutes int check (weekly_minutes is null or weekly_minutes > 0), -- horas planejadas por semana
  exam_date date,                                           -- próxima prova ou entrega
  exam_label text,                                          -- "prova do módulo", "TCC"
  status text not null default 'ativo' check (status in ('ativo', 'pausado', 'concluido')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.study_subjects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  course_id uuid not null references public.study_courses (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  cycle int,                                                -- em qual ciclo a matéria está (nulo = todos)
  total_lessons int check (total_lessons is null or total_lessons > 0),
  done_lessons int not null default 0 check (done_lessons >= 0),
  next_topic text,                                          -- "Próxima: Pesquisa de mercado"
  color text not null default '#4C8BD8',
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Sessões de estudo = compromissos do Core
alter table public.events
  add column course_id uuid references public.study_courses (id) on delete cascade,
  add column subject_id uuid references public.study_subjects (id) on delete set null,
  add column done_at timestamptz;

-- Leituras e "concluir o curso" = Rotas ligadas ao curso
alter table public.routes add column course_id uuid references public.study_courses (id) on delete set null;

create trigger study_courses_updated before update on public.study_courses for each row execute function public.set_updated_at();
create trigger study_subjects_updated before update on public.study_subjects for each row execute function public.set_updated_at();

create index study_courses_user on public.study_courses (user_id, status);
create index study_courses_context on public.study_courses (context_id);
create index study_subjects_course on public.study_subjects (course_id, position);
create index study_subjects_user on public.study_subjects (user_id);
create index events_course on public.events (course_id);
create index events_subject on public.events (subject_id);
create index routes_course on public.routes (course_id);

do $$
declare t text;
begin
  foreach t in array array['study_courses', 'study_subjects'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "dono lê" on public.%I for select to authenticated using ((select auth.uid()) = user_id)', t);
    execute format('create policy "dono cria" on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)', t);
    execute format('create policy "dono altera" on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t);
    execute format('create policy "dono apaga" on public.%I for delete to authenticated using ((select auth.uid()) = user_id)', t);
  end loop;
end $$;
