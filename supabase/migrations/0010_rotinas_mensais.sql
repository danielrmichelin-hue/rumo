-- Rotinas que se repetem por mês ("pagar o condomínio todo dia 10", "DAS dia 20").
-- Uma rotina tem exatamente um jeito de repetir: dias da semana, N vezes por semana ou um dia do mês.

alter table public.routines add column month_day smallint check (month_day is null or month_day between 1 and 31);
alter table public.routines drop constraint if exists routines_check;
alter table public.routines add constraint routines_uma_frequencia check (num_nonnulls(days, times_per_week, month_day) = 1);
