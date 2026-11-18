-- Índices para as chaves estrangeiras (recomendação de desempenho do Supabase)
create index contexts_user_position on public.contexts (user_id, position);
create index people_user on public.people (user_id);
create index people_context on public.people (context_id);
create index events_context on public.events (context_id);
create index projects_context on public.projects (context_id);
create index responsibilities_context on public.responsibilities (context_id);
create index responsibilities_project on public.responsibilities (project_id);
create index responsibilities_waiting_for on public.responsibilities (waiting_for);
