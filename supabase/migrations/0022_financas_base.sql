-- Finanças com a base certa: contas (cada uma com o seu saldo, que sai só dos lançamentos), categorias editáveis
-- e parcelas pagas contadas pelos lançamentos (paid_before = as que já estavam pagas antes do Rumo).
create table public.fin_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  position int not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);
create index fin_accounts_user on public.fin_accounts (user_id, position);
alter table public.fin_entries add column account_id uuid references public.fin_accounts (id) on delete set null;
create index fin_entries_account on public.fin_entries (account_id);

create table public.fin_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  kind text not null check (kind in ('entrada', 'saida')),
  -- para onde vai o dinheiro: essencial, estilo de vida ou objetivos (como no plano de contas)
  nature text check (nature in ('essencial', 'estilo', 'objetivos')),
  position int not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, kind, name)
);
create index fin_categories_user on public.fin_categories (user_id, kind, position);

alter table public.fin_installments add column paid_before int not null default 0 check (paid_before >= 0);

do $$
declare t text;
begin
  foreach t in array array['fin_accounts', 'fin_categories'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "dono lê" on public.%I for select to authenticated using ((select auth.uid()) = user_id)', t);
    execute format('create policy "dono cria" on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)', t);
    execute format('create policy "dono altera" on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t);
    execute format('create policy "dono apaga" on public.%I for delete to authenticated using ((select auth.uid()) = user_id)', t);
  end loop;
end $$;
