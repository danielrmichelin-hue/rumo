-- Lançamentos são a base de tudo: investir e resgatar também são lançamentos, ligados ao investimento.
-- Sem apagar nada: investir = saída com investment_id; resgatar = entrada com investment_id
-- (o app mostra como "Investi" e "Resgatei"). Os aportes e resgates que estavam em fin_inv_moves são copiados
-- para cá; as linhas antigas ficam guardadas e o app passa a ler de fin_inv_moves só os rendimentos.
alter table public.fin_entries add column investment_id uuid references public.fin_investments (id) on delete set null;
create index fin_entries_investment on public.fin_entries (investment_id);

insert into public.fin_entries (user_id, kind, amount, description, category, happened_on, paid, investment_id, note, created_at)
select m.user_id, case when m.kind = 'aporte' then 'saida' else 'entrada' end, m.amount,
       left((case when m.kind = 'aporte' then 'Investi · ' else 'Resgatei · ' end) || i.name, 120),
       'Investimentos', m.happened_on, true, m.investment_id, m.note, m.created_at
from public.fin_inv_moves m join public.fin_investments i on i.id = m.investment_id
where m.kind in ('aporte', 'resgate');
