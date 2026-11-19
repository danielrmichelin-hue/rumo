-- Estudos como ciclo de estudos: cada matéria tem horas no ciclo e uma lista de temas.
-- O ciclo avança pelas matérias em ordem; fecha quando todas chegam nas horas e recomeça (ciclo 2, 3…).
-- O tempo vem das sessões concluídas (events com course_id e done_at) desde o início do ciclo.

alter table public.study_subjects
  add column cycle_minutes int check (cycle_minutes is null or cycle_minutes between 5 and 6000);

create table public.study_topics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  subject_id uuid not null references public.study_subjects (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  position int not null default 0,
  done_at timestamptz,
  created_at timestamptz not null default now()
);

create index study_topics_subject on public.study_topics (subject_id, position);
create index study_topics_user on public.study_topics (user_id);

alter table public.events add column topic_id uuid references public.study_topics (id) on delete set null;
create index events_topic on public.events (topic_id);

alter table public.study_topics enable row level security;
create policy "dono lê" on public.study_topics for select to authenticated using ((select auth.uid()) = user_id);
create policy "dono cria" on public.study_topics for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "dono altera" on public.study_topics for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "dono apaga" on public.study_topics for delete to authenticated using ((select auth.uid()) = user_id);

-- A "próxima aula" escrita antes vira o primeiro tema da matéria
insert into public.study_topics (user_id, subject_id, title)
select user_id, id, next_topic from public.study_subjects where next_topic is not null and char_length(next_topic) between 1 and 200;
