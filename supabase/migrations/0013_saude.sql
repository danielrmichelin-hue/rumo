-- Saúde: remédios, consultas e exames, medidas. Tudo fica só com a pessoa (RLS "dono").
-- Remédio = rotina com dose (aparece no Hoje no horário; um remédio de 8h e 20h são duas rotinas com o mesmo nome).
-- Tratamento com fim: ends_on (vale para qualquer rotina).
-- Consulta, exame, vacina, procedimento = compromisso do calendário com health_kind; o resultado fica na nota.

alter table public.routines add column dose text check (dose is null or char_length(dose) between 1 and 80);
alter table public.routines add column ends_on date;

alter table public.events add column health_kind text check (health_kind in ('consulta', 'exame', 'vacina', 'procedimento'));
create index events_health on public.events (user_id, starts_at) where health_kind is not null;

create table public.health_measures (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('peso', 'pressao', 'glicemia', 'sono', 'cintura', 'outro')),
  label text check (label is null or char_length(label) between 1 and 60),  -- nome da medida "outro"
  value numeric(7,2) not null,
  value2 numeric(7,2),                                                       -- pressão: a mínima
  measured_on date not null default (now() at time zone 'America/Sao_Paulo')::date,
  note text check (note is null or char_length(note) <= 300),
  created_at timestamptz not null default now()
);
create index health_measures_user on public.health_measures (user_id, kind, measured_on);

alter table public.health_measures enable row level security;
create policy "dono lê" on public.health_measures for select to authenticated using ((select auth.uid()) = user_id);
create policy "dono cria" on public.health_measures for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "dono altera" on public.health_measures for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "dono apaga" on public.health_measures for delete to authenticated using ((select auth.uid()) = user_id);
