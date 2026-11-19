-- Finanças do mês (o que depende de você): lançamentos de entrada e saída, contas a pagar, contas fixas
-- (rotinas mensais com valor) e um limite simples por categoria. Sem banco conectado: tudo lançado à mão.

alter table public.routines
  add column amount numeric(12, 2) check (amount is null or amount > 0),   -- conta fixa: valor do mês
  add column category text check (category is null or char_length(category) between 1 and 40);

create table public.fin_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('entrada', 'saida')),
  amount numeric(12, 2) not null check (amount > 0),
  description text not null check (char_length(description) between 1 and 120),
  category text not null default 'Outros' check (char_length(category) between 1 and 40),
  happened_on date not null default current_date,       -- quando entrou ou saiu (ou o vencimento, se ainda não pago)
  paid boolean not null default true,                   -- false = a pagar ou a receber
  routine_id uuid references public.routines (id) on delete set null,   -- veio de uma conta fixa
  context_id uuid references public.contexts (id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);
create index fin_entries_user_day on public.fin_entries (user_id, happened_on);
create index fin_entries_routine on public.fin_entries (routine_id);
create index fin_entries_context on public.fin_entries (context_id);

create table public.fin_budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  category text not null check (char_length(category) between 1 and 40),
  monthly_limit numeric(12, 2) not null check (monthly_limit > 0),
  created_at timestamptz not null default now(),
  unique (user_id, category)
);

do $$
declare t text;
begin
  foreach t in array array['fin_entries', 'fin_budgets'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "dono lê" on public.%I for select to authenticated using ((select auth.uid()) = user_id)', t);
    execute format('create policy "dono cria" on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)', t);
    execute format('create policy "dono altera" on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t);
    execute format('create policy "dono apaga" on public.%I for delete to authenticated using ((select auth.uid()) = user_id)', t);
  end loop;
end $$;
