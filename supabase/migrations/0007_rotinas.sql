-- Rotinas & Hábitos: o que se repete, no horário certo (docs/plano-modulos.md, fase 7; Book 6.3)
-- Sem sequência que zera: só o que foi feito em cada dia. A semana mostra o feito, não a culpa.

create table public.routines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  context_id uuid references public.contexts (id) on delete set null,
  -- dias fixos (0 = domingo … 6 = sábado) ou "N vezes por semana" (dias livres)
  days smallint[] check (days is null or (cardinality(days) between 1 and 7 and days <@ array[0,1,2,3,4,5,6]::smallint[])),
  times_per_week smallint check (times_per_week is null or times_per_week between 1 and 7),
  at_time time,                                  -- horário (opcional)
  duration_min smallint check (duration_min is null or duration_min between 5 and 600),
  status text not null default 'ativa' check (status in ('ativa', 'pausada')),
  note text,
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((days is null) <> (times_per_week is null))
);

create table public.routine_checks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  routine_id uuid not null references public.routines (id) on delete cascade,
  done_on date not null,
  created_at timestamptz not null default now(),
  unique (routine_id, done_on)
);

create trigger routines_updated before update on public.routines for each row execute function public.set_updated_at();

create index routines_user on public.routines (user_id, status, position);
create index routines_context on public.routines (context_id);
create index routine_checks_user on public.routine_checks (user_id, done_on);

do $$
declare t text;
begin
  foreach t in array array['routines', 'routine_checks'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "dono lê" on public.%I for select to authenticated using ((select auth.uid()) = user_id)', t);
    execute format('create policy "dono cria" on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)', t);
    execute format('create policy "dono altera" on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t);
    execute format('create policy "dono apaga" on public.%I for delete to authenticated using ((select auth.uid()) = user_id)', t);
  end loop;
end $$;
