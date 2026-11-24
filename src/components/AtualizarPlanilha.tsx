"use client";

// Atualizar da planilha: o Daniel alimenta a planilha (controle.xlsx) e o Rumo espelha.
// Lê o arquivo aqui mesmo, mostra o que muda e só grava quando ele confirma (tudo numa vez, ou nada).
import { useMemo, useState, useTransition } from "react";
import { Check, FileSpreadsheet } from "lucide-react";
import { espelharPlanilha, type PacoteEspelho } from "@/app/(app)/acoes";
import { lerXlsx } from "@/lib/xlsx";
import { ABAS_PLANILHA, espelhar, lerPlanilha, type PlanilhaLida } from "@/lib/planilha";
import { moeda, ROTULO_TIPO, type Investimento, type Lancamento, type Parcelamento } from "@/lib/financas";
import { CampoCategoria, useFinancas } from "./FinancasContexto";
import { useAvisar } from "./Avisos";
import { Painel } from "./Comuns";

const dm = (iso: string) => `${iso.slice(8)}/${iso.slice(5, 7)}/${iso.slice(2, 4)}`;
const sinal = (v: number) => `${v < 0 ? "−" : "+"}${moeda(Math.abs(v))}`;

export function AtualizarPlanilha({ lancamentos, investimentos, parcelamentos, rendimentos, ajustes, hoje }: {
  lancamentos: Lancamento[]; investimentos: Investimento[]; parcelamentos: Parcelamento[];
  rendimentos: { id: string; investment_id: string; happened_on: string; amount: number }[];
  ajustes: { pct_parcelas: number; pct_investir: number; pct_livre: number }; hoje: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [lida, setLida] = useState<PlanilhaLida | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [lendo, setLendo] = useState(false);
  const [manter, setManter] = useState<Set<string>>(new Set()); // "só no Rumo" que ele preferiu manter
  const [categorias, setCategorias] = useState<Record<string, string>>({});
  const [pendente, iniciar] = useTransition();
  const { contas, categorias: cats, regras } = useFinancas();
  const avisar = useAvisar();

  const e = useMemo(() => (lida ? espelhar(lida, { lancamentos, contas, investimentos, rendimentos, parcelamentos, categorias: cats, regras, ajustes, hoje }) : null),
    [lida, lancamentos, contas, investimentos, rendimentos, parcelamentos, cats, regras, ajustes, hoje]);

  async function ler(arquivo: File) {
    setErro(null); setLida(null); setLendo(true);
    try {
      const pl = lerPlanilha(await lerXlsx(await arquivo.arrayBuffer(), ABAS_PLANILHA));
      if (!pl.linhas.length && pl.erros.length) setErro(pl.erros[0]);
      else {
        setLida(pl); setCategorias({});
        // O que o Rumo tem depois do último dia da planilha fica marcado para manter (a planilha pode não estar em dia)
        const ultimo = pl.linhas.map((l) => l.dia).sort().pop() ?? "";
        setManter(new Set(lancamentos.filter((l) => l.paid && l.happened_on > ultimo).map((l) => l.id)));
      }
    } catch (x) {
      setErro(x instanceof Error ? x.message : "Não consegui ler o arquivo.");
    } finally { setLendo(false); }
  }

  const apagar = e ? e.soNoRumo.filter((l) => !manter.has(l.id)) : [];
  const contaPrincipal = contas.find((c) => !c.archived)?.id;
  const naPrincipal = (l: Lancamento) => !l.account_id || l.account_id === contaPrincipal;
  const valorConta = (l: Lancamento) => (l.kind === "entrada" || l.kind === "resgate" ? l.amount : -l.amount);
  const depois = e ? Math.round((e.saldoRumoAgora - apagar.filter(naPrincipal).reduce((t, l) => t + valorConta(l), 0) + e.novos.filter((n) => !n.account_id).reduce((t, n) => t + n.valor, 0)) * 100) / 100 : 0;
  const bate = e ? Math.abs(depois - e.saldoPlanilha) < 0.005 : false;
  const pagasMudam = e ? e.pagas.some((x) => x.id && x.pagas > (parcelamentos.find((p) => p.id === x.id)?.paid_count ?? 0)) : false;
  const nadaMuda = e && !pagasMudam && !e.novos.length && !apagar.length && !e.rendNovos.length && !e.rendSoNoRumo.length && !e.parcNovos.length && !e.parcAlterar.length && !e.plano?.muda && !e.pcts?.muda;

  const depoisDaPlanilha = e ? e.soNoRumo.filter((l) => l.happened_on > e.ate) : [];

  function aplicar() {
    if (!e) return;
    if (apagar.length && !confirm(`Tirar ${apagar.length} ${apagar.length === 1 ? "lançamento" : "lançamentos"} do Rumo, porque não ${apagar.length === 1 ? "está" : "estão"} na planilha?`)) return;
    const pacote: PacoteEspelho = {
      parcelamentos_novos: e.parcNovos.map((p) => ({ chave: p.chave, title: p.title, category: p.category, total: p.total, installments: p.installments, first_due: p.first_due, creditor: "Cartão do meu pai" })),
      parcelamentos_alterar: e.parcAlterar.map((p) => ({ id: p.id, total: p.total, installments: p.installments, first_due: p.first_due })),
      lancamentos_apagar: apagar.map((l) => l.id),
      lancamentos_novos: e.novos.map((n) => ({
        kind: n.tipo === "entrada" || n.tipo === "resgate" ? "entrada" : "saida", amount: Math.abs(n.valor), description: n.description,
        category: categorias[n.chave] ?? n.category, happened_on: n.dia, account_id: n.account_id, investment_id: n.investment_id,
        installment_id: n.installment_id, parcela_chave: n.parcela_chave,
      })),
      rendimentos_apagar: e.rendSoNoRumo.map((m) => m.id),
      rendimentos_novos: e.rendNovos.map((r) => ({ investment_id: e.plano?.investment_id ?? investimentos.find((i) => i.status === "ativo")?.id ?? "", amount: r.valor, happened_on: r.dia, note: r.descricao.slice(0, 200) })),
      pagas: e.pagas,
      plano: e.plano?.muda ? { investment_id: e.plano.investment_id, plan_steps: e.plano.plan_steps, monthly_rate: e.plano.monthly_rate, monthly_plan: e.plano.monthly_plan } : null,
      pcts: e.pcts?.muda ? { pct_parcelas: e.pcts.pct_parcelas, pct_investir: e.pcts.pct_investir, pct_livre: e.pcts.pct_livre } : null,
    };
    iniciar(async () => {
      const r = await espelharPlanilha(pacote);
      if (!r.ok) return avisar({ texto: r.erro ?? "Não foi possível atualizar." });
      setAberto(false); setLida(null);
      avisar({ texto: `Rumo atualizado pela planilha: ${r.feito?.lancamentos ?? 0} novos, ${r.feito?.apagados ?? 0} tirados.` });
    });
  }

  return (
    <>
      <button type="button" className="btn btn--line btn--sm" onClick={() => setAberto(true)}><FileSpreadsheet aria-hidden />Atualizar da planilha</button>
      {aberto && (
        <Painel titulo="Atualizar da planilha" fechar={() => setAberto(false)}>
          <div className="detail extrato-banco" style={{ gap: 14 }}>
            <label className="field">
              Sua planilha (.xlsx)
              <input className="input" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(x) => { const f = x.target.files?.[0]; if (f) void ler(f); }} />
            </label>
            {!lida && !erro && <p className="field__hint">{lendo ? "Lendo a planilha…" : "Salve a planilha e escolha o arquivo. O Rumo mostra o que muda e só grava quando você confirmar."}</p>}
            {erro && <p className="note note--err" role="alert">{erro}</p>}
            {lida && e && (
              <>
                {[...lida.erros, ...e.avisos].map((x) => <p key={x} className="note note--err">{x}</p>)}
                {depoisDaPlanilha.length > 0 && <p className="note note--err">A planilha vai até {dm(e.ate)} e o Rumo tem {depoisDaPlanilha.length} {depoisDaPlanilha.length === 1 ? "lançamento" : "lançamentos"} depois disso. Essa é a versão mais nova da planilha? Eles ficam desmarcados (ficam no Rumo) até você marcar.</p>}
                <p className="extrato-banco__periodo">Planilha de {dm(e.de)} a {dm(e.ate)} · {lida.linhas.length} lançamentos · {lida.parcelamentos.length} parcelamentos</p>
                <div className="nums nums--3">
                  <div><small>Iguais nos dois</small><b className="pos">{e.iguais}</b>{e.datasDiferentes > 0 && <span>{e.datasDiferentes} com a data até 3 dias diferente</span>}</div>
                  <div><small>Novos da planilha</small><b>{e.novos.length}</b><span>{e.novos.length ? "Vão entrar no Rumo" : "Nada novo"}</span></div>
                  <div><small>Só no Rumo</small><b className={apagar.length ? "neg" : undefined}>{e.soNoRumo.length}</b><span>{e.soNoRumo.length ? `${apagar.length} vão sair` : "Nada"}</span></div>
                </div>
                <p className={`extrato-banco__total${bate ? " is-ok" : ""}`}>
                  Conta Corrente pela planilha: {moeda(e.saldoPlanilha)} · no Rumo hoje: {moeda(e.saldoRumoAgora)} · depois de atualizar: {moeda(depois)}
                  {bate ? " — iguais." : ` — diferença de ${moeda(Math.abs(depois - e.saldoPlanilha))}.`}
                </p>

                {e.novos.length > 0 && (
                  <section>
                    <h3 className="sec__h">Novos da planilha <em>{e.novos.length}</em></h3>
                    <ul className="extrato-banco__lista">
                      {e.novos.map((n) => (
                        <li key={n.chave} className="planilha-linha">
                          <span />
                          <div className="extrato-banco__info">
                            <span><b>{dm(n.dia)}</b><span className={n.valor > 0 ? "pos" : undefined}>{sinal(n.valor)}</span></span>
                            <small>{n.description}{n.parcelaNome ? ` · parcela de ${n.parcelaNome}` : ""}{n.account_id ? ` · ${n.conta}` : ""}</small>
                          </div>
                          <div className="extrato-banco__campos">
                            {n.tipo === "aporte" || n.tipo === "resgate"
                              ? <span className="field__hint">{ROTULO_TIPO[n.tipo]} · investimento</span>
                              : <CampoCategoria kind={n.tipo} value={categorias[n.chave] ?? n.category} onChange={(v) => setCategorias((c) => ({ ...c, [n.chave]: v }))} rotulo="" />}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                {e.soNoRumo.length > 0 && (
                  <section>
                    <h3 className="sec__h">Só no Rumo <em>{e.soNoRumo.length}</em></h3>
                    <p className="field__hint">Não estão na planilha: saem do Rumo. Desmarque o que quiser manter.</p>
                    <ul className="extrato-banco__lista">
                      {e.soNoRumo.map((l) => (
                        <li key={l.id} className={manter.has(l.id) ? "is-fora" : undefined}>
                          <label className="extrato-banco__marca"><input type="checkbox" checked={!manter.has(l.id)} onChange={(x) => setManter((m) => { const n = new Set(m); if (x.target.checked) n.delete(l.id); else n.add(l.id); return n; })} aria-label={`Tirar ${l.description}`} /></label>
                          <div className="extrato-banco__info">
                            <span><b>{dm(l.happened_on)}</b><span className={valorConta(l) > 0 ? "pos" : undefined}>{sinal(valorConta(l))}</span></span>
                            <small>{l.description} · {l.category}</small>
                          </div>
                          <span />
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                {(e.rendNovos.length > 0 || e.rendSoNoRumo.length > 0) && (
                  <section>
                    <h3 className="sec__h">Rendimentos do investimento</h3>
                    <ul className="extrato-banco__sobra">
                      {e.rendNovos.map((r) => <li key={r.linha}><span>{dm(r.dia)} · entra: {r.descricao}</span><span>+{moeda(r.valor)}</span></li>)}
                      {e.rendSoNoRumo.map((m) => <li key={m.id}><span>{dm(m.happened_on)} · sai (não está na planilha)</span><span>{moeda(m.amount)}</span></li>)}
                    </ul>
                  </section>
                )}

                {(e.parcNovos.length > 0 || e.parcAlterar.length > 0 || e.parcSoNoRumo.length > 0) && (
                  <section>
                    <h3 className="sec__h">Parcelamentos</h3>
                    <ul className="extrato-banco__sobra">
                      {e.parcNovos.map((p) => <li key={p.chave}><span>Novo: {p.title} · {p.installments}x · {p.pagas} pagas</span><span>{moeda(p.total)}</span></li>)}
                      {e.parcAlterar.map((p) => <li key={p.id}><span>Muda: {p.title} ({p.antes} → {p.depois})</span><span>{moeda(p.total)}</span></li>)}
                      {e.parcSoNoRumo.map((p) => <li key={p.id}><span>Só no Rumo (fica): {p.title}</span><span>{moeda(p.total)}</span></li>)}
                    </ul>
                  </section>
                )}
                {e.plano?.muda && <p className="field__hint">O plano de investimento vem da planilha: {e.plano.plan_steps.length} degraus{e.plano.monthly_rate !== null ? `, rendendo ${String(Math.round(e.plano.monthly_rate * 10000) / 100).replace(".", ",")}% ao mês` : ""}.</p>}
                {e.pcts?.muda && <p className="field__hint">A divisão do mês vem da planilha: parcelas {e.pcts.pct_parcelas}%, investir {e.pcts.pct_investir}%, livre {e.pcts.pct_livre}%.</p>}
                <p className="field__hint">As parcelas pagas de cada parcelamento passam a ser as da planilha.</p>

                <div className="detail__foot">
                  {nadaMuda
                    ? <span className="field__hint">{e.soNoRumo.length ? `Nada novo da planilha. ${e.soNoRumo.length} ${e.soNoRumo.length === 1 ? "lançamento só no Rumo fica" : "lançamentos só no Rumo ficam"}: marque para tirar.` : "O Rumo já está igual à planilha."}</span>
                    : <button type="button" className="btn" disabled={pendente || lida.erros.length > 0} onClick={aplicar}><Check aria-hidden />{pendente ? "Atualizando…" : "Atualizar o Rumo"}</button>}
                </div>
              </>
            )}
          </div>
        </Painel>
      )}
    </>
  );
}
