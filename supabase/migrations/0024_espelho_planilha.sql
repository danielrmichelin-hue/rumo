-- Espelho da planilha de finanças: o Rumo lê o .xlsx do Daniel, mostra a diferença e aplica tudo de uma vez.
-- Uma função só, numa transação só: ou entra tudo, ou nada. Roda como o usuário (RLS de cada tabela vale).
create or replace function public.rumo_espelhar_planilha(p jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  r jsonb;
  novo uuid;
  chaves jsonb := '{}'::jsonb;
  n_parc int := 0; n_alt int := 0; n_lanc int := 0; n_apag int := 0; n_rend int := 0; n_rend_apag int := 0;
begin
  if auth.uid() is null then raise exception 'sem usuário'; end if;

  -- 1. Parcelamentos novos (a chave liga os lançamentos novos a eles)
  for r in select * from jsonb_array_elements(coalesce(p->'parcelamentos_novos', '[]'::jsonb)) loop
    insert into fin_installments (title, category, total, installments, paid_count, paid_before, first_due, creditor)
    values (r->>'title', coalesce(r->>'category', 'Compras'), (r->>'total')::numeric, (r->>'installments')::int, 0, 0, (r->>'first_due')::date, nullif(r->>'creditor', ''))
    returning id into novo;
    chaves := chaves || jsonb_build_object(r->>'chave', novo);
    n_parc := n_parc + 1;
  end loop;

  -- 2. Parcelamentos que mudaram na planilha
  for r in select * from jsonb_array_elements(coalesce(p->'parcelamentos_alterar', '[]'::jsonb)) loop
    update fin_installments set total = (r->>'total')::numeric, installments = (r->>'installments')::int, first_due = (r->>'first_due')::date
    where id = (r->>'id')::uuid;
    n_alt := n_alt + 1;
  end loop;

  -- 3. Lançamentos que só estavam no Rumo
  delete from fin_entries where id in (select (jsonb_array_elements_text(coalesce(p->'lancamentos_apagar', '[]'::jsonb)))::uuid);
  get diagnostics n_apag = row_count;

  -- 4. Lançamentos novos da planilha
  for r in select * from jsonb_array_elements(coalesce(p->'lancamentos_novos', '[]'::jsonb)) loop
    if (r->>'kind') not in ('entrada', 'saida') or (r->>'amount')::numeric <= 0 then raise exception 'lançamento inválido: %', r; end if;
    insert into fin_entries (kind, amount, description, category, happened_on, paid, account_id, investment_id, installment_id)
    values (r->>'kind', round((r->>'amount')::numeric, 2), left(r->>'description', 120), left(r->>'category', 60), (r->>'happened_on')::date, true,
      nullif(r->>'account_id', '')::uuid, nullif(r->>'investment_id', '')::uuid,
      coalesce(nullif(r->>'installment_id', '')::uuid, (chaves->>(r->>'parcela_chave'))::uuid));
    n_lanc := n_lanc + 1;
  end loop;

  -- 5. Rendimentos do investimento
  delete from fin_inv_moves where id in (select (jsonb_array_elements_text(coalesce(p->'rendimentos_apagar', '[]'::jsonb)))::uuid) and kind = 'rendimento';
  get diagnostics n_rend_apag = row_count;
  for r in select * from jsonb_array_elements(coalesce(p->'rendimentos_novos', '[]'::jsonb)) loop
    insert into fin_inv_moves (investment_id, kind, amount, happened_on, note)
    values ((r->>'investment_id')::uuid, 'rendimento', round((r->>'amount')::numeric, 2), (r->>'happened_on')::date, nullif(r->>'note', ''));
    n_rend := n_rend + 1;
  end loop;

  -- 6. Parcelas pagas como na planilha: as pagas antes = o que a planilha diz menos os pagamentos ligados
  for r in select * from jsonb_array_elements(coalesce(p->'pagas', '[]'::jsonb)) loop
    novo := coalesce(nullif(r->>'id', '')::uuid, (chaves->>(r->>'chave'))::uuid);
    update fin_installments i
    set paid_before = greatest(0, (r->>'pagas')::int - (select count(*) from fin_entries e where e.installment_id = i.id and e.paid))
    where i.id = novo;
  end loop;
  update fin_installments i
  set paid_count = least(i.installments, i.paid_before + (select count(*) from fin_entries e where e.installment_id = i.id and e.paid));

  -- 7. Plano de investimento (degraus e rendimento ao mês)
  if p ? 'plano' and jsonb_typeof(p->'plano') = 'object' then
    update fin_investments
    set plan_steps = coalesce(p->'plano'->'plan_steps', plan_steps),
        monthly_rate = coalesce((p->'plano'->>'monthly_rate')::numeric, monthly_rate),
        monthly_plan = coalesce((p->'plano'->>'monthly_plan')::numeric, monthly_plan)
    where id = (p->'plano'->>'investment_id')::uuid;
  end if;

  -- 8. A divisão do mês (parcelas / investir / livre)
  if p ? 'pcts' and jsonb_typeof(p->'pcts') = 'object' then
    update fin_settings
    set pct_parcelas = (p->'pcts'->>'pct_parcelas')::int, pct_investir = (p->'pcts'->>'pct_investir')::int, pct_livre = (p->'pcts'->>'pct_livre')::int
    where user_id = auth.uid();
  end if;

  return jsonb_build_object('parcelamentos', n_parc, 'alterados', n_alt, 'lancamentos', n_lanc, 'apagados', n_apag, 'rendimentos', n_rend, 'rendimentos_apagados', n_rend_apag);
end;
$$;

revoke all on function public.rumo_espelhar_planilha(jsonb) from public, anon;
grant execute on function public.rumo_espelhar_planilha(jsonb) to authenticated;
