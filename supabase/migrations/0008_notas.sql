-- Notas: anotações que pertencem a algo (docs/plano-modulos.md, fase 8; Book 6.4)
-- Vinculada, não solta: mora num contexto, projeto, curso ou responsabilidade. Decisão registrada: o quê, por quê e quando.

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null default 'nota' check (kind in ('nota', 'decisao')),
  title text not null check (char_length(title) between 1 and 200),
  body text,
  why text,                                   -- decisão: por quê
  decided_on date,                            -- decisão: quando
  context_id uuid references public.contexts (id) on delete set null,
  project_id uuid references public.projects (id) on delete cascade,
  course_id uuid references public.study_courses (id) on delete cascade,
  responsibility_id uuid references public.responsibilities (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger notes_updated before update on public.notes for each row execute function public.set_updated_at();

create index notes_user on public.notes (user_id, created_at desc);
create index notes_context on public.notes (context_id);
create index notes_project on public.notes (project_id);
create index notes_course on public.notes (course_id);
create index notes_responsibility on public.notes (responsibility_id);

alter table public.notes enable row level security;
create policy "dono lê" on public.notes for select to authenticated using ((select auth.uid()) = user_id);
create policy "dono cria" on public.notes for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "dono altera" on public.notes for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "dono apaga" on public.notes for delete to authenticated using ((select auth.uid()) = user_id);
