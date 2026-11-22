-- Notificações no celular (web push no app instalado).
-- push_subscriptions: cada aparelho que ativou os avisos; push_sent: o que já foi avisado (não repete).
-- A função "avisos" (Supabase Edge Functions) roda a cada 5 minutos pelo pg_cron e manda os avisos.
-- As chaves ficam no cofre (vault): rumo_vapid_publica, rumo_vapid_privada, rumo_avisos_token (criadas à parte, fora do repositório).
create extension if not exists pg_net;
create extension if not exists pg_cron;

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
create index push_subscriptions_user on public.push_subscriptions (user_id);

create table public.push_sent (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  chave text not null,
  sent_at timestamptz not null default now(),
  unique (user_id, chave)
);

alter table public.push_subscriptions enable row level security;
create policy "dono lê" on public.push_subscriptions for select to authenticated using ((select auth.uid()) = user_id);
create policy "dono cria" on public.push_subscriptions for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "dono altera" on public.push_subscriptions for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "dono apaga" on public.push_subscriptions for delete to authenticated using ((select auth.uid()) = user_id);
alter table public.push_sent enable row level security;
create policy "dono lê" on public.push_sent for select to authenticated using ((select auth.uid()) = user_id);

-- Só a função dos avisos (service_role) lê um segredo do cofre
create or replace function public.rumo_segredo(nome text) returns text
language sql security definer set search_path = '' as $$
  select decrypted_secret from vault.decrypted_secrets where name = nome limit 1
$$;
revoke all on function public.rumo_segredo(text) from public, anon, authenticated;
grant execute on function public.rumo_segredo(text) to service_role;

-- A cada 5 minutos, chama a função dos avisos
select cron.schedule('rumo-avisos', '*/5 * * * *', $$
  select net.http_post(
    url := 'https://mhzytmjasdvkpmklswlo.supabase.co/functions/v1/avisos',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-rumo-token', (select decrypted_secret from vault.decrypted_secrets where name = 'rumo_avisos_token')),
    body := '{}'::jsonb
  )
$$);
