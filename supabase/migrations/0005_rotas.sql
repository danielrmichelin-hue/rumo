-- Rotas: do destino ao próximo passo (docs/plano-modulos.md, Book cap. 07)
-- Uma Rota desce em camadas: destino → ritmo → marcos → próximos passos (responsabilidades do Core) → Hoje.

create table public.routes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  kind text not null check (kind in ('financeiro', 'leitura', 'estudos', 'negocios')),
  context_id uuid references public.contexts (id) on delete set null,
  target numeric check (target is null or target > 0),   -- valor, páginas ou aulas do destino (negócios: nulo)
  current numeric not null default 0 check (current >= 0), -- quanto já tem, leu ou concluiu
  start_value numeric not null default 0,                  -- ponto de partida do ritmo planejado
  start_date date not null default current_date,
  target_date date,                                        -- quando quer chegar
  status text not null default 'ativa' check (status in ('ativa', 'pausada', 'concluida')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Marcos: as etapas que mostram avanço (Rotas de negócio)
create table public.route_milestones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  route_id uuid not null references public.routes (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  position int not null default 0,
  due_date date,
  done_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Registros de avanço: "guardei R$ 400", "li 30 páginas", "concluí 2 aulas"
create table public.route_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  route_id uuid not null references public.routes (id) on delete cascade,
  amount numeric not null,
  note text,
  happened_on date not null default current_date,
  created_at timestamptz not null default now()
);

-- Os próximos passos de uma Rota são responsabilidades do Core
alter table public.responsibilities
  add column route_id uuid references public.routes (id) on delete set null,
  add column milestone_id uuid references public.route_milestones (id) on delete set null;

create trigger routes_updated before update on public.routes for each row execute function public.set_updated_at();
create trigger route_milestones_updated before update on public.route_milestones for each row execute function public.set_updated_at();

create index routes_user_status on public.routes (user_id, status);
create index routes_context on public.routes (context_id);
create index route_milestones_route on public.route_milestones (route_id, position);
create index route_milestones_user on public.route_milestones (user_id);
create index route_entries_route on public.route_entries (route_id, happened_on);
create index route_entries_user on public.route_entries (user_id);
create index responsibilities_route on public.responsibilities (route_id);
create index responsibilities_milestone on public.responsibilities (milestone_id);

do $$
declare t text;
begin
  foreach t in array array['routes', 'route_milestones', 'route_entries'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "dono lê" on public.%I for select to authenticated using ((select auth.uid()) = user_id)', t);
    execute format('create policy "dono cria" on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)', t);
    execute format('create policy "dono altera" on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t);
    execute format('create policy "dono apaga" on public.%I for delete to authenticated using ((select auth.uid()) = user_id)', t);
  end loop;
end $$;
