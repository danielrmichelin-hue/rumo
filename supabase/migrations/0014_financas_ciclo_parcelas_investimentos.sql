-- Finanças completas: o mês que vai do dia do pagamento até a véspera do próximo, parcelamentos
-- (compras em N vezes, com quanto falta e quando termina), investimentos (saldo, aportes, resgates, rendimentos)
-- e os envelopes "quanto posso gastar" (parcelas / investir / gasto livre).

create table public.fin_settings (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  pay_day smallint check (pay_day between 1 and 31),            -- dia em que recebe; null = mês do calendário
  weekend_shift boolean not null default true,                  -- caiu no sábado/domingo: o ciclo começa na sexta antes
  pct_parcelas smallint not null default 50 check (pct_parcelas between 0 and 100),
  pct_investir smallint not null default 20 check (pct_investir between 0 and 100),
  pct_livre smallint not null default 30 check (pct_livre between 0 and 100),
  cash_balance numeric(12, 2),                                  -- saldo da conta informado…
  cash_on date,                                                 -- …ao fim deste dia; o resto o Rumo soma
  updated_at timestamptz not null default now(),
  check (pct_parcelas + pct_investir + pct_livre = 100)
);

create table public.fin_installments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  category text not null default 'Compras' check (char_length(category) between 1 and 40),
  total numeric(12, 2) not null check (total > 0),
  installments smallint not null check (installments between 1 and 120),
  paid_count smallint not null default 0 check (paid_count >= 0),
  first_due date not null,                                      -- vencimento da 1ª parcela; as outras, um mês depois cada
  creditor text check (creditor is null or char_length(creditor) between 1 and 60),   -- cartão, loja, pessoa
  context_id uuid references public.contexts (id) on delete set null,
  note text,
  created_at timestamptz not null default now(),
  check (paid_count <= installments)
);
create index fin_installments_user on public.fin_installments (user_id, first_due);
create index fin_installments_context on public.fin_installments (context_id);

alter table public.fin_entries add column installment_id uuid references public.fin_installments (id) on delete set null;
create index fin_entries_installment on public.fin_entries (installment_id);

create table public.fin_investments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  kind text not null default 'renda_fixa' check (kind in ('caixinha', 'renda_fixa', 'tesouro', 'fundos', 'acoes', 'previdencia', 'cripto', 'outro')),
  institution text check (institution is null or char_length(institution) between 1 and 60),
  balance numeric(14, 2) not null default 0,                    -- saldo informado…
  balance_on date not null default (now() at time zone 'America/Sao_Paulo')::date,   -- …ao fim deste dia
  monthly_rate numeric(6, 4) check (monthly_rate is null or monthly_rate between 0 and 0.2),   -- 0,009 = 0,9% ao mês
  monthly_plan numeric(12, 2) check (monthly_plan is null or monthly_plan >= 0),               -- quanto pretende pôr por mês
  status text not null default 'ativo' check (status in ('ativo', 'encerrado')),
  note text,
  created_at timestamptz not null default now()
);
create index fin_investments_user on public.fin_investments (user_id, status);

create table public.fin_inv_moves (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  investment_id uuid not null references public.fin_investments (id) on delete cascade,
  kind text not null check (kind in ('aporte', 'resgate', 'rendimento')),
  amount numeric(12, 2) not null check (amount > 0),
  happened_on date not null default (now() at time zone 'America/Sao_Paulo')::date,
  note text check (note is null or char_length(note) <= 200),
  created_at timestamptz not null default now()
);
create index fin_inv_moves_user on public.fin_inv_moves (user_id, happened_on);
create index fin_inv_moves_investment on public.fin_inv_moves (investment_id);

do $$
declare t text;
begin
  foreach t in array array['fin_settings', 'fin_installments', 'fin_investments', 'fin_inv_moves'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "dono lê" on public.%I for select to authenticated using ((select auth.uid()) = user_id)', t);
    execute format('create policy "dono cria" on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)', t);
    execute format('create policy "dono altera" on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t);
    execute format('create policy "dono apaga" on public.%I for delete to authenticated using ((select auth.uid()) = user_id)', t);
  end loop;
end $$;
