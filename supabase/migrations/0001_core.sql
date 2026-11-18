-- Rumo · MVP · Core (contextos, pessoas, projetos, responsabilidades, compromissos)
-- Cada linha pertence a um usuário; a segurança por linha (RLS) garante que ninguém vê os dados de outro.

create extension if not exists pg_trgm;

create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- Contextos: Iter Mídia, Rumo, Casa…
create table public.contexts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  color text not null default '#6C4ED9',
  kind text not null default 'area' check (kind in ('empresa', 'area')),
  position int not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Pessoas: só para "aguardando quem" e para a busca
create table public.people (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  context_id uuid references public.contexts (id) on delete set null,
  contact text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Projetos
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  context_id uuid references public.contexts (id) on delete set null,
  status text not null default 'ativo' check (status in ('ativo', 'pausado', 'concluido')),
  due_date date,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Responsabilidades: o centro do Rumo
create table public.responsibilities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 300),
  note text,
  kind text not null default 'fazer' check (kind in ('fazer', 'decidir')),
  context_id uuid references public.contexts (id) on delete set null,
  project_id uuid references public.projects (id) on delete set null,
  state text not null default 'a_fazer' check (state in ('a_fazer', 'aguardando', 'concluida')),
  due_date date,
  due_time time,
  today boolean not null default false,            -- marcada para hoje
  waiting_for uuid references public.people (id) on delete set null,
  waiting_note text,                               -- quem, quando não é uma pessoa cadastrada
  follow_up_on date,                               -- quando cobrar
  done_at timestamptz,
  source text not null default 'manual' check (source in ('captura', 'manual')),
  raw_capture text,                                -- o texto original da captura
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint waiting_needs_follow_up check (state <> 'aguardando' or follow_up_on is not null),
  constraint done_has_date check ((state = 'concluida') = (done_at is not null))
);

-- Compromissos: o calendário da v1
create table public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  context_id uuid references public.contexts (id) on delete set null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  location text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ends_after_start check (ends_at is null or ends_at >= starts_at)
);

-- updated_at automático
create trigger contexts_updated before update on public.contexts for each row execute function public.set_updated_at();
create trigger people_updated before update on public.people for each row execute function public.set_updated_at();
create trigger projects_updated before update on public.projects for each row execute function public.set_updated_at();
create trigger responsibilities_updated before update on public.responsibilities for each row execute function public.set_updated_at();
create trigger events_updated before update on public.events for each row execute function public.set_updated_at();

-- Índices para o Hoje, a Inbox e a busca
create index responsibilities_user_state on public.responsibilities (user_id, state);
create index responsibilities_user_due on public.responsibilities (user_id, due_date) where state <> 'concluida';
create index responsibilities_user_follow on public.responsibilities (user_id, follow_up_on) where state = 'aguardando';
create index responsibilities_inbox on public.responsibilities (user_id, created_at) where context_id is null and state <> 'concluida';
create index responsibilities_title_trgm on public.responsibilities using gin (title gin_trgm_ops);
create index events_user_start on public.events (user_id, starts_at);
create index projects_user_status on public.projects (user_id, status);

-- Segurança por linha: cada usuário só vê e altera o que é dele
do $$
declare t text;
begin
  foreach t in array array['contexts', 'people', 'projects', 'responsibilities', 'events'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "dono lê" on public.%I for select to authenticated using ((select auth.uid()) = user_id)', t);
    execute format('create policy "dono cria" on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)', t);
    execute format('create policy "dono altera" on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t);
    execute format('create policy "dono apaga" on public.%I for delete to authenticated using ((select auth.uid()) = user_id)', t);
  end loop;
end $$;
