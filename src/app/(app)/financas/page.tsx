import Link from "next/link";
import { ChevronLeft, ChevronRight, Download, Route } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AjustarInvestimento, AjustesFinancas, ApagarMovimento, ApagarParcelamento, LimiteCategoria, LinhaLancamento, Movimentar, NovaContaFixa, NovoInvestimento, NovoLancamento, NovoParcelamento, PagarParcela, PagarTodas } from "@/components/Financas";
import { ChecarRotina } from "@/components/Rotinas";
import { Anel } from "@/components/Caminho";
import type { ContextItem } from "@/components/Shell";
import { diaMes, hojeISO, rotuloData } from "@/lib/datas";
import {
  CAMPOS_INVESTIMENTO, CAMPOS_LANCAMENTO, CAMPOS_MOVIMENTO, CAMPOS_PARCELAMENTO, ciclo, cicloDoDia, contasDoMes, envelopes, mesCurto, mesVizinho, moeda,
  normalizarAjustes, normalizarInvestimento, normalizarLancamento, normalizarMovimento, normalizarParcelamento, parcelasDoCiclo, projetar, resumoDoMes,
  resumoParcelamentos, rotuloCiclo, saldoAtual, saldoDaConta, situacaoParcelamento, somarMeses, TIPOS_INVESTIMENTO, type Orcamento,
} from "@/lib/financas";
import { CAMPOS_ROTINA, type Marcacao, type Rotina } from "@/lib/rotinas";
import { CAMPOS_ROTA, normalizar, resumirRota } from "@/lib/rotas";

export const metadata = { title: "Finanças" };

const ABAS = [
  { v: "mes", r: "O mês" },
  { v: "parcelas", r: "Parcelamentos" },
  { v: "investimentos", r: "Investimentos" },
] as const;

export default async function Page({ searchParams }: { searchParams: Promise<{ mes?: string; aba?: string }> }) {
  const { mes: param, aba: abaParam } = await searchParams;
  const aba = ABAS.find((a) => a.v === abaParam)?.v ?? "mes";
  const hoje = hojeISO();
  const supabase = await createClient();
  const { data: ajustesDb } = await supabase.from("fin_settings").select("pay_day, weekend_shift, pct_parcelas, pct_investir, pct_livre, cash_balance, cash_on").maybeSingle();
  const aj = normalizarAjustes(ajustesDb);
  const atual = cicloDoDia(hoje, aj);
  const mes = param && /^\d{4}-(0[1-9]|1[0-2])$/.test(param) ? param : atual;
  const { inicio, fim } = ciclo(mes, aj);
  const esteCiclo = mes === atual;

  const [{ data: lancDb }, { data: rotinasDb }, { data: marcasDb }, { data: orcDb }, { data: contextos }, { data: rotasDb }, { data: atrasadosDb }, { data: parcDb }, { data: invDb }, { data: movDb }, { data: depoisDb }] = await Promise.all([
    supabase.from("fin_entries").select(CAMPOS_LANCAMENTO).gte("happened_on", inicio).lte("happened_on", fim).order("happened_on", { ascending: false }),
    supabase.from("routines").select(CAMPOS_ROTINA).eq("status", "ativa").not("month_day", "is", null).not("amount", "is", null),
    supabase.from("routine_checks").select("routine_id, done_on").gte("done_on", `${inicio.slice(0, 7)}-01`).lte("done_on", fim),
    supabase.from("fin_budgets").select("id, category, monthly_limit"),
    supabase.from("contexts").select("id, name, color, kind").eq("archived", false).order("position"),
    supabase.from("routes").select(CAMPOS_ROTA).eq("kind", "financeiro").order("created_at"),
    // A pagar de ciclos anteriores continua aparecendo (sem alarme)
    esteCiclo ? supabase.from("fin_entries").select(CAMPOS_LANCAMENTO).eq("paid", false).lt("happened_on", inicio) : Promise.resolve({ data: [] }),
    supabase.from("fin_installments").select(CAMPOS_PARCELAMENTO).order("first_due"),
    supabase.from("fin_investments").select(CAMPOS_INVESTIMENTO).order("created_at"),
    supabase.from("fin_inv_moves").select(CAMPOS_MOVIMENTO).order("happened_on", { ascending: false }),
    // Para o saldo da conta: o que entrou e saiu depois do saldo informado
    aj.cash_on ? supabase.from("fin_entries").select(CAMPOS_LANCAMENTO).eq("paid", true).gt("happened_on", aj.cash_on) : Promise.resolve({ data: [] }),
  ]);
  const lancamentos = (lancDb ?? []).map(normalizarLancamento);
  const atrasados = (atrasadosDb ?? []).map(normalizarLancamento);
  const contas = contasDoMes((rotinasDb ?? []) as Rotina[], (marcasDb ?? []) as Marcacao[], inicio, fim);
  const r = resumoDoMes([...lancamentos, ...atrasados], contas, (orcDb ?? []) as Orcamento[]);
  const ctx = (contextos ?? []) as ContextItem[];
  const parcelamentos = (parcDb ?? []).map(normalizarParcelamento);
  const investimentos = (invDb ?? []).map(normalizarInvestimento);
  const movs = (movDb ?? []).map(normalizarMovimento);
  const metas = (rotasDb ?? []).map(normalizar);

  // Onde está o dinheiro
  const conta = saldoDaConta(aj, (depoisDb ?? []).map(normalizarLancamento), movs);
  const investido = investimentos.filter((i) => i.status === "ativo").reduce((t, i) => t + saldoAtual(i, movs), 0);
  const divida = resumoParcelamentos(parcelamentos, hoje);

  // Parcelas: as que vencem neste ciclo (para pagar) e quanto delas cabe no ciclo (para os envelopes)
  const aPagarParcelas = esteCiclo ? parcelasDoCiclo(parcelamentos, inicio, fim, hoje) : [];
  // No envelope das parcelas: o que já foi pago neste mês mais o que ainda vence nele (pagou adiantado, não conta de novo)
  const pagasNoCiclo = lancamentos.filter((l) => l.paid && l.kind === "saida" && l.installment_id).reduce((t, l) => t + l.amount, 0);
  const pendentes = mes >= atual ? parcelasDoCiclo(parcelamentos, inicio, fim, hoje).reduce((t, x) => t + x.s.parcela, 0) : 0;
  const parcelasNoCiclo = pagasNoCiclo + pendentes;
  const movsCiclo = movs.filter((m) => m.happened_on >= inicio && m.happened_on <= fim);
  const aportesLiq = Math.max(0, movsCiclo.reduce((t, m) => t + (m.kind === "aporte" ? m.amount : m.kind === "resgate" ? -m.amount : 0), 0));
  const gastoLivre = lancamentos.filter((l) => l.paid && l.kind === "saida" && !l.installment_id).reduce((t, l) => t + l.amount, 0);
  const env = envelopes(aj, r.entrou, parcelasNoCiclo, aportesLiq, gastoLivre);

  const aPagar = [...atrasados, ...lancamentos].filter((l) => !l.paid).sort((a, b) => a.happened_on.localeCompare(b.happened_on));
  const feitos = lancamentos.filter((l) => l.paid);
  const maxCat = Math.max(1, ...r.categorias.map((c) => Math.max(c.gasto, c.limite ?? 0)));
  const titulo = aj.pay_day ? rotuloCiclo(inicio, fim) : (() => { const t = diaMes(inicio).split(" de ")[1]; return `${t[0].toUpperCase()}${t.slice(1)} de ${inicio.slice(0, 4)}`; })();
  const url = (extra: Record<string, string>) => `/financas?${new URLSearchParams({ ...(aba !== "mes" ? { aba } : {}), ...(mes !== atual ? { mes } : {}), ...extra })}`;
  const credores = [...new Set(parcelamentos.map((p) => p.creditor).filter((c): c is string => !!c))];

  const Barra = ({ usado, alvo }: { usado: number; alvo: number }) => (
    <span className="fin-cat__bar"><i style={{ width: `${alvo > 0 ? Math.min(100, (usado / alvo) * 100) : usado > 0 ? 100 : 0}%` }} /></span>
  );

  return (
    <div className="page page--wide">
      <div className="page__head">
        <div>
          <h1 className="page__t">Finanças</h1>
          <p className="page__para">O mês numa tela, as parcelas até a última e o que está investido. Tudo lançado por você, sem banco conectado.</p>
        </div>
        <div className="page__actions">
          <AjustesFinancas ajustes={aj} saldoConta={conta} />
          <a href={`/financas/planilha?mes=${mes}`} className="btn btn--line btn--sm"><Download aria-hidden />Planilha</a>
        </div>
      </div>

      <div className="fin-onde" aria-label="Onde está o seu dinheiro">
        <div><small>Na conta</small><b>{conta === null ? "—" : moeda(conta)}</b>{conta === null && <span>Informe em Ajustes</span>}</div>
        <div><small>Investido</small><b>{moeda(investido)}</b></div>
        <div><small>Falta pagar de parcelas</small><b>{moeda(divida.deve)}</b>{divida.ultima && <span>Livre em {mesCurto(divida.ultima)}</span>}</div>
        <div><small>O que é seu de fato</small><b className={(conta ?? 0) + investido - divida.deve < 0 ? "neg" : undefined}>{moeda((conta ?? 0) + investido - divida.deve)}</b><span>Tem menos o que deve</span></div>
      </div>

      <nav className="tabs" aria-label="Partes das finanças">
        {ABAS.map((a) => (
          <Link key={a.v} href={`/financas?${new URLSearchParams({ ...(a.v !== "mes" ? { aba: a.v } : {}), ...(mes !== atual ? { mes } : {}) })}`} aria-current={a.v === aba ? "page" : undefined}>
            {a.r}{a.v === "parcelas" && divida.emCurso > 0 && <em>{divida.emCurso}</em>}{a.v === "investimentos" && investimentos.length > 0 && <em>{investimentos.length}</em>}
          </Link>
        ))}
      </nav>

      {aba === "mes" && (
        <>
          <div className="fin-ciclo">
            <Link href={url({ mes: mesVizinho(mes, -1) })} className="icon-btn" aria-label="Mês anterior"><ChevronLeft size={18} /></Link>
            <span className="fin-mes">{titulo}</span>
            <Link href={url({ mes: mesVizinho(mes, 1) })} className="icon-btn" aria-label="Próximo mês"><ChevronRight size={18} /></Link>
            {!esteCiclo && <Link href={url({ mes: atual })} className="sec__act">Voltar ao mês atual</Link>}
          </div>

          <div className="nums">
            <div><small>Entrou</small><b className="pos">{moeda(r.entrou)}</b>{r.aReceber > 0 && <span>e {moeda(r.aReceber)} a receber</span>}</div>
            <div><small>Saiu</small><b>{moeda(r.saiu)}</b></div>
            <div><small>Pode gastar livre</small><b>{moeda(Math.max(0, env.livre.sobra))}</b><span>{r.entrou ? `de ${moeda(env.livre.alvo)} · já usou ${moeda(env.livre.usado)}` : "Lance o que entrou para calcular"}</span></div>
            <div><small>Falta pagar</small><b>{moeda(r.aPagar + aPagarParcelas.reduce((t, x) => t + x.s.parcela, 0))}</b><span>Contas, parcelas e a pagar</span></div>
          </div>

          <NovoLancamento contextos={ctx} mes={inicio.slice(0, 7)} />

          <div className="fin-cols">
            <div>
              {aPagarParcelas.length > 0 && (
                <section className="bloco">
                  <h2 className="sec__h">Parcelas deste mês <em>{moeda(aPagarParcelas.reduce((t, x) => t + x.s.parcela, 0))}</em><span className="sec__act"><PagarTodas ids={aPagarParcelas.map((x) => x.p.id)} total={aPagarParcelas.reduce((t, x) => t + x.s.parcela, 0)} /></span></h2>
                  <ul className="list">
                    {aPagarParcelas.map(({ p, s, numero, vence, atrasada }) => (
                      <li key={p.id} className="row fin-conta">
                        <PagarParcela id={p.id} titulo={p.title} rotulo={`parcela ${numero} de ${p.installments}`} />
                        <div className="row__body">
                          <span className="row__t">{p.title}</span>
                          <span className="props"><span className="prop">{numero} de {p.installments}</span><span className="prop">{atrasada ? `Venceu ${rotuloData(vence, hoje)}` : vence === hoje ? "Vence hoje" : `Dia ${Number(vence.slice(8))}`}</span>{p.creditor && <span className="prop">{p.creditor}</span>}{numero === p.installments && <span className="prop">Última</span>}</span>
                        </div>
                        <span className="fin-l__v">{moeda(s.parcela)}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <section className="bloco">
                <h2 className="sec__h">Contas fixas {contas.length > 0 && <em>{contas.filter((c) => !c.paga).length} de {contas.length} abertas</em>}<span className="sec__act"><NovaContaFixa contextos={ctx} /></span></h2>
                {contas.length === 0 ? (
                  <p className="bloco__vazio">Condomínio, internet, assinaturas: crie uma conta fixa com o dia e o valor. Ela aparece no Hoje no dia e, ao marcar, o pagamento entra aqui.</p>
                ) : (
                  <ul className="list">
                    {contas.map((c) => (
                      <li key={c.rotina.id} className="row fin-conta" data-feita={c.paga || undefined}>
                        {esteCiclo ? <ChecarRotina rotina={c.rotina} feita={c.paga} /> : <span />}
                        <div className="row__body">
                          <span className="row__t">{c.rotina.title}</span>
                          <span className="props"><span className="prop">{c.paga ? `Paga ${rotuloData(c.pagaEm!)}` : `Dia ${Number(c.dia.slice(8))}${c.dia < hoje && esteCiclo ? " · ainda aberta" : ""}`}</span>{c.rotina.category && <span className="prop">{c.rotina.category}</span>}</span>
                        </div>
                        <span className="fin-l__v">{moeda(c.valor)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {aPagar.length > 0 && (
                <section className="bloco">
                  <h2 className="sec__h">A pagar e a receber <em>{aPagar.length}</em></h2>
                  <ul className="list">{aPagar.map((l) => <LinhaLancamento key={l.id} l={l} contexto={ctx.find((c) => c.id === l.context_id)} />)}</ul>
                </section>
              )}

              <section className="bloco">
                <h2 className="sec__h">Lançamentos {feitos.length > 0 && <em>{feitos.length}</em>}</h2>
                {feitos.length === 0 ? <p className="bloco__vazio">Nada lançado neste mês.</p> : <ul className="list">{feitos.map((l) => <LinhaLancamento key={l.id} l={l} contexto={ctx.find((c) => c.id === l.context_id)} />)}</ul>}
              </section>
            </div>

            <aside className="fin-lado">
              <section className="bloco">
                <h2 className="sec__h">Como o dinheiro se divide</h2>
                {r.entrou === 0 ? (
                  <p className="bloco__vazio">Quando você lançar o que entrou, o Rumo separa {aj.pct_parcelas}% para parcelas, {aj.pct_investir}% para investir e {aj.pct_livre}% para gastar livre. Ajuste em Ajustes.</p>
                ) : (
                  <ul className="fin-cats">
                    {[
                      { t: `Parcelas · ${aj.pct_parcelas}%`, e: env.parcelas, nota: env.excesso > 0 ? `Passou ${moeda(env.excesso)}; saiu do gasto livre` : "Obrigatório: já está comprometido" },
                      { t: `Investir · ${aj.pct_investir}%`, e: env.investir, nota: env.investir.usado >= env.investir.alvo ? "Feito neste mês" : `Falta pôr ${moeda(env.investir.alvo - env.investir.usado)}` },
                      { t: `Gasto livre · ${aj.pct_livre}%`, e: env.livre, nota: env.livre.sobra >= 0 ? `Ainda pode usar ${moeda(env.livre.sobra)}` : `Passou ${moeda(-env.livre.sobra)}` },
                    ].map(({ t, e, nota }) => (
                      <li key={t} className={e.usado > e.alvo + 0.005 ? "is-passou" : undefined}>
                        <span className="fin-cat__t"><b>{t}</b><span>{moeda(e.usado)} de {moeda(e.alvo)}</span></span>
                        <Barra usado={e.usado} alvo={e.alvo} />
                        <small className="fin-cat__nota">{nota}</small>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="bloco">
                <h2 className="sec__h">Para onde foi</h2>
                {r.categorias.length === 0 ? (
                  <p className="bloco__vazio">Os gastos do mês aparecem aqui por categoria. Dá para pôr um limite em cada uma.</p>
                ) : (
                  <ul className="fin-cats">
                    {r.categorias.map((c) => (
                      <li key={c.categoria} className={c.limite && c.gasto > c.limite ? "is-passou" : undefined}>
                        <span className="fin-cat__t"><b>{c.categoria}</b><span>{moeda(c.gasto)} <LimiteCategoria categoria={c.categoria} limite={c.limite} /></span></span>
                        <span className="fin-cat__bar">
                          <i style={{ width: `${(c.gasto / maxCat) * 100}%` }} />
                          {c.limite ? <u style={{ left: `${(c.limite / maxCat) * 100}%` }} aria-hidden /> : null}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </aside>
          </div>
        </>
      )}

      {aba === "parcelas" && (
        <>
          <div className="nums">
            <div><small>Ainda devo</small><b>{moeda(divida.deve)}</b></div>
            <div><small>Sai por mês</small><b>{moeda(divida.porMes)}</b><span>{divida.emCurso} {divida.emCurso === 1 ? "parcelamento" : "parcelamentos"} em curso</span></div>
            <div><small>Livre de parcelas em</small><b className="nums__texto">{divida.ultima ? mesCurto(divida.ultima) : "—"}</b><span>{divida.ultima ? diaMes(divida.ultima) : "Nada parcelado"}</span></div>
            <div><small>Já quitados</small><b>{divida.quitados}</b></div>
          </div>
          <div style={{ marginBottom: 16 }}><NovoParcelamento contextos={ctx} credores={credores} /></div>
          {parcelamentos.length === 0 ? (
            <p className="empty">Compras em várias vezes: guarde o total, em quantas vezes e quando vence a primeira. O Rumo mostra quanto falta e quando termina.</p>
          ) : (
            <>
              {(["pagando", "a_comecar", "quitado"] as const).map((estado) => {
                const grupo = parcelamentos.map((p) => ({ p, s: situacaoParcelamento(p, hoje) })).filter(({ s }) => s.estado === estado).sort((a, b) => a.s.ultima.localeCompare(b.s.ultima));
                if (!grupo.length) return null;
                const lista = (
                  <ul className="parcs">
                    {grupo.map(({ p, s }) => (
                      <li key={p.id} className="parc">
                        <span className="parc__t"><b>{p.title}</b><small>{p.category}{p.creditor ? ` · ${p.creditor}` : ""} · {moeda(p.total)} em {p.installments}x</small></span>
                        <span className="parc__prog">
                          <span className="parc__pontos" aria-label={`${p.paid_count} de ${p.installments} pagas`}>{Array.from({ length: p.installments }, (_, i) => <i key={i} className={i < p.paid_count ? "on" : undefined} />)}</span>
                          <small>{estado === "quitado" ? `Quitado em ${mesCurto(s.ultima)}` : estado === "a_comecar" ? `Começa ${rotuloData(p.first_due, hoje)}` : `${p.paid_count} de ${p.installments} · última em ${mesCurto(s.ultima)}`}</small>
                        </span>
                        <span className="parc__v"><b>{moeda(s.parcela)}</b><small>{s.restante > 0 ? `falta ${moeda(s.restante)}` : "pago"}</small></span>
                        <ApagarParcelamento id={p.id} titulo={p.title} />
                      </li>
                    ))}
                  </ul>
                );
                const nome = estado === "pagando" ? "Pagando" : estado === "a_comecar" ? "A começar" : "Quitados";
                return estado === "quitado" ? (
                  <details key={estado} className="sec fold"><summary className="sec__h"><ChevronRight aria-hidden />{nome} <em>{grupo.length}</em></summary>{lista}</details>
                ) : (
                  <section key={estado} className="sec"><h2 className="sec__h">{nome} <em>{grupo.length}</em></h2>{lista}</section>
                );
              })}
            </>
          )}
        </>
      )}

      {aba === "investimentos" && (
        <>
          <div className="nums">
            <div><small>Investido hoje</small><b className="pos">{moeda(investido)}</b></div>
            <div><small>Aportes neste mês</small><b>{moeda(movsCiclo.filter((m) => m.kind === "aporte").reduce((t, m) => t + m.amount, 0))}</b><span>Resgates: {moeda(movsCiclo.filter((m) => m.kind === "resgate").reduce((t, m) => t + m.amount, 0))}</span></div>
            <div><small>Rendeu nos últimos 12 meses</small><b>{moeda(movs.filter((m) => m.kind === "rendimento" && m.happened_on > somarMeses(hoje, -12)).reduce((t, m) => t + m.amount, 0))}</b><span>O que você lançou como rendimento</span></div>
            <div><small>Em 12 meses, no plano</small><b>{moeda(investimentos.filter((i) => i.status === "ativo").reduce((t, i) => t + projetar(saldoAtual(i, movs), i.monthly_rate ?? 0, i.monthly_plan ?? 0, 12), 0))}</b><span>Com o aporte e a taxa de cada um</span></div>
          </div>
          <div style={{ marginBottom: 16 }}><NovoInvestimento /></div>

          <div className="fin-cols">
            <div>
              {investimentos.length === 0 && <p className="empty">Caixinha, CDB, Tesouro, ações: guarde cada lugar com o saldo de hoje. Aportes, resgates e rendimentos ficam no histórico.</p>}
              {investimentos.map((i) => {
                const saldo = saldoAtual(i, movs);
                const meus = movs.filter((m) => m.investment_id === i.id);
                const anos = [1, 3, 5].map((a) => ({ a, v: projetar(saldo, i.monthly_rate ?? 0, i.monthly_plan ?? 0, a * 12) }));
                return (
                  <section key={i.id} className="bloco inv">
                    <div className="inv__head">
                      <div><h2 className="inv__t">{i.name}</h2><small>{TIPOS_INVESTIMENTO[i.kind]}{i.institution ? ` · ${i.institution}` : ""}{i.monthly_rate ? ` · rende ${String(Math.round(i.monthly_rate * 10000) / 100).replace(".", ",")}% ao mês` : ""}</small></div>
                      <div className="inv__saldo"><b>{moeda(saldo)}</b><small>Conferido {rotuloData(i.balance_on, hoje)} <AjustarInvestimento inv={i} saldo={saldo} /></small></div>
                    </div>
                    <Movimentar inv={i} />
                    {(i.monthly_plan || i.monthly_rate) && (
                      <p className="inv__proj">
                        {i.monthly_plan ? `Pondo ${moeda(i.monthly_plan)} por mês` : "Sem aportes"}{i.monthly_rate ? "" : ", sem rendimento estimado"}: {anos.map(({ a, v }) => `${moeda(v)} em ${a} ${a === 1 ? "ano" : "anos"}`).join(" · ")}.
                      </p>
                    )}
                    {meus.length > 0 && (
                      <details className="fold">
                        <summary className="sec__h"><ChevronRight aria-hidden />Histórico <em>{meus.length}</em></summary>
                        <ul className="inv__hist">
                          {meus.slice(0, 60).map((m) => (
                            <li key={m.id}>
                              <time>{rotuloData(m.happened_on, hoje)}</time>
                              <span>{m.kind === "aporte" ? "Aporte" : m.kind === "resgate" ? "Resgate" : "Rendimento"}{m.note ? ` · ${m.note}` : ""}</span>
                              <b className={m.kind === "resgate" ? undefined : "pos"}>{m.kind === "resgate" ? "−" : "+"}{moeda(m.amount)}</b>
                              <ApagarMovimento m={m} />
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </section>
                );
              })}
            </div>

            <aside className="fin-lado">
              <section className="bloco">
                <h2 className="sec__h">Metas<Link href="/rotas/nova?tipo=financeiro" className="sec__act">Nova meta</Link></h2>
                <div className="agenda">
                  {metas.filter((m) => m.status === "ativa").map((m) => {
                    const res = resumirRota(m, [], hoje);
                    return (
                      <Link key={m.id} href={`/rotas/${m.id}`} className="ag" style={{ gridTemplateColumns: "20px minmax(0,1fr)" }}>
                        <span style={{ paddingTop: 3 }}><Anel pct={res.pct} /></span>
                        <div><b>{m.title}</b><small>{res.agora} · {res.ritmo ?? res.situacao}</small></div>
                      </Link>
                    );
                  })}
                  {divida.deve > 0 && (
                    <Link href="/financas?aba=parcelas" className="ag" style={{ gridTemplateColumns: "20px minmax(0,1fr)" }}>
                      <span style={{ paddingTop: 3 }}><Anel pct={1 - divida.deve / Math.max(1, parcelamentos.reduce((t, p) => t + p.total, 0))} /></span>
                      <div><b>Quitar todas as parcelas</b><small>Faltam {moeda(divida.deve)} · livre em {divida.ultima ? mesCurto(divida.ultima) : "—"}</small></div>
                    </Link>
                  )}
                  {metas.filter((m) => m.status !== "ativa").map((m) => (
                    <Link key={m.id} href={`/rotas/${m.id}`} className="ag ag--past" style={{ gridTemplateColumns: "20px minmax(0,1fr)" }}>
                      <span style={{ paddingTop: 3 }}><Anel pct={1} /></span>
                      <div><b>{m.title}</b><small>Alcançada</small></div>
                    </Link>
                  ))}
                </div>
                {metas.length === 0 && <div style={{ padding: "6px 6px 4px" }}><Link href="/rotas/nova?tipo=financeiro" className="btn btn--line btn--sm"><Route aria-hidden />Criar uma meta</Link></div>}
              </section>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
