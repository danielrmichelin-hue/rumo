-- Áreas escondidas da lateral e a chave do atalho da Siri (captura sem abrir o app).
alter table public.profiles add column hidden_areas text[] not null default '{}';
alter table public.profiles add column capture_token text unique check (capture_token is null or char_length(capture_token) between 24 and 64);

-- O atalho manda a chave; estas funções acham o dono pela chave e só mexem nas coisas dele.
create or replace function public.rumo_contextos_por_chave(p_chave text)
returns table (id uuid, name text)
language sql stable security definer set search_path = ''
as $$
  select c.id, c.name from public.contexts c
  join public.profiles p on p.user_id = c.user_id
  where p.capture_token = p_chave and c.archived = false
  order by c.position;
$$;

create or replace function public.rumo_capturar_por_chave(p_chave text, p_titulo text, p_data date, p_hora time, p_tipo text, p_contexto uuid, p_original text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  dono uuid;
  novo uuid;
begin
  select user_id into dono from public.profiles where capture_token = p_chave;
  if dono is null or coalesce(trim(p_titulo), '') = '' then return null; end if;
  if p_contexto is not null and not exists (select 1 from public.contexts where id = p_contexto and user_id = dono) then p_contexto := null; end if;
  insert into public.responsibilities (user_id, title, due_date, due_time, kind, context_id, source, raw_capture)
  values (dono, left(trim(p_titulo), 300), p_data, p_hora, case when p_tipo = 'decidir' then 'decidir' else 'fazer' end, p_contexto, 'captura', left(p_original, 1000))
  returning id into novo;
  return novo;
end;
$$;

revoke all on function public.rumo_contextos_por_chave(text) from public;
revoke all on function public.rumo_capturar_por_chave(text, text, date, time, text, uuid, text) from public;
grant execute on function public.rumo_contextos_por_chave(text) to anon, authenticated;
grant execute on function public.rumo_capturar_por_chave(text, text, date, time, text, uuid, text) to anon, authenticated;
