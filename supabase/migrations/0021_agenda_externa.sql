-- Agenda do Google (ou outra) pelo endereço secreto iCal: os compromissos aparecem no Hoje, no Calendário e na Semana.
alter table public.profiles add column ical_url text check (ical_url is null or (ical_url like 'https://%' and char_length(ical_url) <= 1000));
