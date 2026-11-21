-- Subtarefas: uma checklist dentro de cada tarefa (responsibilities). Feita = done_at preenchido.
create table public.subtasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  responsibility_id uuid not null references public.responsibilities (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  done_at timestamptz,
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index subtasks_responsibility on public.subtasks (responsibility_id, position);
create index subtasks_user on public.subtasks (user_id);

alter table public.subtasks enable row level security;
create policy "dono lê" on public.subtasks for select to authenticated using ((select auth.uid()) = user_id);
create policy "dono cria" on public.subtasks for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "dono altera" on public.subtasks for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "dono apaga" on public.subtasks for delete to authenticated using ((select auth.uid()) = user_id);
