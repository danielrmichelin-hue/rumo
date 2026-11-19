-- Estudos: matéria → módulo (opcional) → aula/tema, e revisões espaçadas (1, 7 e 30 dias depois de ver).
-- study_topics passa a ser a "aula ou tema": done_at = quando foi vista; review_step e next_review_on = a próxima revisão.

create table public.study_modules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  subject_id uuid not null references public.study_subjects (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index study_modules_subject on public.study_modules (subject_id, position);
create index study_modules_user on public.study_modules (user_id);

alter table public.study_topics
  add column module_id uuid references public.study_modules (id) on delete set null,
  add column review_step smallint not null default 0 check (review_step between 0 and 4), -- 0 sem revisão · 1..3 revisões feitas até · 4 concluídas
  add column next_review_on date;
create index study_topics_module on public.study_topics (module_id);
create index study_topics_review on public.study_topics (user_id, next_review_on);

alter table public.study_modules enable row level security;
create policy "dono lê" on public.study_modules for select to authenticated using ((select auth.uid()) = user_id);
create policy "dono cria" on public.study_modules for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "dono altera" on public.study_modules for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "dono apaga" on public.study_modules for delete to authenticated using ((select auth.uid()) = user_id);
