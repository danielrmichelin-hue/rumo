-- Perfil da pessoa: nome, módulos ligados e respostas das perguntas do começo (docs/onboarding.md)
create table public.profiles (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 60),
  modules text[] not null default '{}',     -- negocios, estudos, rotinas, notas, rotas
  onboarding jsonb not null default '{}',   -- escolhas e respostas do começo
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated before update on public.profiles for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
create policy "dono lê" on public.profiles for select to authenticated using ((select auth.uid()) = user_id);
create policy "dono cria" on public.profiles for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "dono altera" on public.profiles for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "dono apaga" on public.profiles for delete to authenticated using ((select auth.uid()) = user_id);
