-- Lançamentos são a base de tudo: investir (aporte) e resgatar também são lançamentos, ligados ao investimento.
-- O saldo da conta, o saldo de cada investimento, os envelopes e o resumo saem daqui.
-- fin_inv_moves fica só com os rendimentos (não passam pela conta).
alter table public.fin_entries drop constraint if exists fin_entries_kind_check;
alter table public.fin_entries add constraint fin_entries_kind_check check (kind in ('entrada', 'saida', 'aporte', 'resgate'));
alter table public.fin_entries add column investment_id uuid references public.fin_investments (id) on delete set null;
-- só investir e resgatar apontam para um investimento (que pode ter sido apagado: fica nulo)
alter table public.fin_entries add constraint fin_entries_investimento_check check (kind in ('aporte', 'resgate') or investment_id is null);
create index fin_entries_investment on public.fin_entries (investment_id);

insert into public.fin_entries (user_id, kind, amount, description, category, happened_on, paid, investment_id, note, created_at)
select m.user_id, m.kind, m.amount,
       left((case when m.kind = 'aporte' then 'Investi · ' else 'Resgatei · ' end) || i.name, 120),
       'Investimentos', m.happened_on, true, m.investment_id, m.note, m.created_at
from public.fin_inv_moves m join public.fin_investments i on i.id = m.investment_id
where m.kind in ('aporte', 'resgate');
delete from public.fin_inv_moves where kind in ('aporte', 'resgate');
