-- Estudos: meta de data por projeto ("terminar Marketing até 31/03") e o horário do aviso das aulas do dia no celular.
alter table public.study_projects add column if not exists target_on date;
alter table public.profiles add column if not exists study_reminder time;
