-- Recomendações do verificador de segurança do Supabase
create schema if not exists extensions;
alter extension pg_trgm set schema extensions;
alter function public.set_updated_at() set search_path = '';
