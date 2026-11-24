-- Plano de investimento em degraus (a aba Investimentos da planilha): a partir de cada mês, quanto pôr por mês.
-- [{"de": "2026-11", "valor": 1000}, {"de": "2027-03", "valor": 1500}]. monthly_plan continua sendo o valor de agora.
alter table public.fin_investments add column if not exists plan_steps jsonb not null default '[]'::jsonb;
