import Link from "next/link";
import { ChevronLeft, ChevronRight, Download, Plus, Route } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AjustarInvestimento, AjustesFinancas, ApagarMovimento, ConferirConta, CopiarValor, LimiteCategoria, LinhaLancamento, Movimentar, NovaContaFixa, NovoInvestimento, NovoLancamento, NovoParcelamento, PagarParcela, PagarTodas } from "@/components/Financas";
import { ChecarRotina } from "@/components/Rotinas";
import { ExtratoMes, GradeParcelas, RolarAteMes } from "@/components/FinancasPlanilha";
import { FinancasProvider } from "@/components/FinancasContexto";
import { Consultor, type BaseConsultor } from "@/components/Consultor";
import { Anel } from "@/components/Caminho";
import type { ContextItem } from "@/components/Shell";
import { diaMes, hojeISO, rotuloData, somarMeses } from "@/lib/datas";
import {
  AJUSTE, CAMPOS_CATEGORIA, CAMPOS_CONTA, CAMPOS_INVESTIMENTO, CAMPOS_LANCAMENTO, CAMPOS_MOVIMENTO, CAMPOS_PARCELAMENTO, contasDoMes, datasDeSalario, ehAjuste, extratoDoMes, saldoAte, SALDO_INICIAL, type Categoria, type Conta, envelopes, limitesDoMes, mesCurto, mesDoDia, mesVizinho, moeda,
  movimentosDe, naConta, normalizarAjustes, normalizarInvestimento, normalizarLancamento, normalizarMovimento, normalizarParcelamento, parcelasDoCiclo, pixDoMes, projetar, valorParcela, resumoDoMes,
  NATUREZAS, resumoParcelamentos, saldoAtual, situacaoParcelamento, TIPOS_INVESTIMENTO, type Orcamento,
} from "@/lib/financas";
import { CAMPOS_ROTINA, type Marcacao, type Rotina } from "@/lib/rotinas";
import { CAMPOS_ROTA, normalizar, resumirRota } from "@/lib/rotas";

export const metadata = { title: "Finanças" };

const ABAS = [
  { v: "lancamentos", r: "Lançamentos" },
  { v: "mes", r: "Mês" },
  { v: "parcelas", r: "Parcelas" },
  { v: "investimentos", r: "Investimentos" },
  { v: "resumo", r: "Resumo" },
] as const;
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** O mês financeiro: do dia em que recebe até a véspera do próximo (ou o do calendário), em tudo */
export default async function Page({ searchParams }: { searchParams: Promise<{ mes?: string; aba?: string; lm?: string; conta?: string }> }) {
  const { mes: param, aba: abaParam, lm, conta: contaParam } = await searchParams;
  const aba = ABAS.find((a) => a.v === abaParam)?.v ?? "lancamentos";
  const hoje = hojeISO();
  const supabase = await createClient();
  const [{ data: ajustesDb }, { data: contasDb }, { data: catsDb }, { data: salariosDb }] = await Promise.all([
    supabase.from("fin_settings").select("pay_day, pct_parcelas, pct_investir, pct_livre").maybeSingle(),
    supabase.from("fin_accounts").select(CAMPOS_CONTA).order("position"),
    supabase.from("fin_categories").select(CAMPOS_CATEGORIA).order("position"),
    // O salário marca o começo de cada mês (se cair antes do dia, o mês começa nele)
    supabase.from("fin_entries").select("kind, category, happened_on").eq("kind", "entrada").eq("category", "Salário"),
  ]);
  const contas = (contasDb ?? []) as Conta[];
  const categorias = (catsDb ?? []) as Categoria[];
  const aj = normalizarAjustes(ajustesDb);
  const dr = aj.pay_day; // dia em que recebe: o mês vai dele até a véspera do próximo
  const salarios = datasDeSalario((salariosDb ?? []) as { kind: "entrada"; category: string; happened_on: string }[]);
  const lim = (m: string) => limitesDoMes(m, dr, salarios);
  const atual = mesDoDia(hoje, dr, salarios);
  const pedido = param ?? lm;
  const mes = pedido && /^\d{4}-(0[1-9]|1[0-2])$/.test(pedido) ? pedido : atual;
  const { inicio, fim } = lim(mes);
  const ano = mes.slice(0, 4);
  const esteMes = mes === atual;
  const doMes = (m: string, l: { happened_on: string }) => { const x = lim(m); return l.happened_on >= x.inicio && l.happened_on <= x.fim; };

  const [{ data: todosDb }, { data: rotinasDb }, { data: marcasDb }, { data: orcDb }, { data: contextos }, { data: rotasDb }, { data: parcDb }, { data: invDb }, { data: movDb }] = await Promise.all([
    // Todos os lançamentos: o saldo de cada mês é a soma de tudo o que veio antes
    supabase.from("fin_entries").select(CAMPOS_LANCAMENTO).order("happened_on", { ascending: false }),
    supabase.from("routines").select(CAMPOS_ROTINA).eq("status", "ativa").not("month_day", "is", null).not("amount", "is", null),
    supabase.from("routine_checks").select("routine_id, done_on").gte("done_on", inicio).lte("done_on", fim),
    supabase.from("fin_budgets").select("id, category, monthly_limit"),
    supabase.from("contexts").select("id, name, color, kind").eq("archived", false).order("position"),
    supabase.from("routes").select(CAMPOS_ROTA).eq("kind", "financeiro").order("created_at"),
    supabase.from("fin_installments").select(CAMPOS_PARCELAMENTO).order("first_due"),
    supabase.from("fin_investments").select(CAMPOS_INVESTIMENTO).order("created_at"),
    supabase.from("fin_inv_moves").select(CAMPOS_MOVIMENTO).order("happened_on", { ascending: false }),
  ]);
  // Contas: sem conta = a principal; arquivada fica fora do mês (a não ser que seja escolhida)
  const principal = contas.find((c) => !c.archived) ?? null;
  const contaDe = (l: { account_id?: string | null }) => l.account_id ?? principal?.id ?? null;
  const arquivadas = new Set(contas.filter((c) => c.archived).map((c) => c.id));
  const contaSel = contas.find((c) => c.id === contaParam) ?? null;
  const daConta = (l: { account_id?: string | null }) => (contaSel ? contaDe(l) === contaSel.id : !arquivadas.has(contaDe(l) ?? ""));
  const tudo = (todosDb ?? []).map(normalizarLancamento);
  const todos = tudo.filter(daConta);
  const lancamentos = todos.filter((l) => l.happened_on >= inicio && l.happened_on <= fim);
  const atrasados = esteMes ? todos.filter((l) => !l.paid && l.happened_on < inicio) : [];
  const ext = extratoDoMes(todos, inicio, fim);
  const fixas = contasDoMes((rotinasDb ?? []) as Rotina[], (marcasDb ?? []) as Marcacao[], inicio, fim, lancamentos);
  const r = resumoDoMes([...lancamentos, ...atrasados], fixas, (orcDb ?? []) as Orcamento[]);
  const ctx = (contextos ?? []) as ContextItem[];
  const parcelamentos = (parcDb ?? []).map(normalizarParcelamento);
  const investimentos = (invDb ?? []).map(normalizarInvestimento);
  // Movimentos dos investimentos: aportes e resgates vêm dos lançamentos; rendimentos, da aba Investimentos
  // Aportes e resgates vêm dos lançamentos; do investimento, só rendimentos, saldo inicial e ajustes
  const movs = [...movimentosDe(tudo), ...(movDb ?? []).map(normalizarMovimento).filter((m) => m.kind === "rendimento" || m.note === AJUSTE || m.note === SALDO_INICIAL)].sort((a, b) => b.happened_on.localeCompare(a.happened_on));
  const metas = (rotasDb ?? []).map(normalizar);

  // Onde está o dinheiro
  const conta = saldoAte(tudo.filter((l) => !arquivadas.has(contaDe(l) ?? "")), hoje);
  const investido = investimentos.filter((i) => i.status === "ativo").reduce((t, i) => t + saldoAtual(i, movs), 0);
  const divida = resumoParcelamentos(parcelamentos, hoje);

  // Parcelas do mês: as que ainda vencem nele (para marcar) e, na divisão, as pagas mais as que faltam
  const parcelasAPagar = mes >= atual ? parcelasDoCiclo(parcelamentos, inicio, fim, hoje) : [];
  const parcelasNoMes = lancamentos.filter((l) => l.paid && l.kind === "saida" && l.installment_id).reduce((t, l) => t + l.amount, 0) + parcelasAPagar.reduce((t, x) => t + x.valor, 0);
  const movsMes = movs.filter((m) => m.happened_on >= inicio && m.happened_on <= fim);
  const investiu = movsMes.reduce((t, m) => t + (m.kind === "aporte" ? m.amount : m.kind === "resgate" ? -m.amount : 0), 0);
  const gastoLivre = lancamentos.filter((l) => l.paid && l.kind === "saida" && !l.installment_id).reduce((t, l) => t + l.amount, 0);
  const env = envelopes(aj, r.entrou, parcelasNoMes, Math.max(0, investiu), gastoLivre);

  const aPagarLanc = [...atrasados, ...lancamentos].filter((l) => !l.paid).sort((a, b) => a.happened_on.localeCompare(b.happened_on));
  const contasAbertas = fixas.filter((c) => !c.paga);
  const nAPagar = parcelasAPagar.length + contasAbertas.length + aPagarLanc.length;
  const maxCat = Math.max(1, ...r.categorias.map((c) => Math.max(c.gasto, c.limite ?? 0)));
  // Para onde foi: % dos gastos do mês, a média dos 3 meses anteriores e o tipo de gasto (essencial, estilo de vida, objetivos)
  const anteriores = [1, 2, 3].map((k) => lim(mesVizinho(mes, -k)));
  const mediaCat = (cat: string) => anteriores.reduce((t, x) => t + todos.filter((l) => l.paid && l.kind === "saida" && l.category === cat && l.happened_on >= x.inicio && l.happened_on <= x.fim).reduce((a, l) => a + l.amount, 0), 0) / 3;
  const natureza = (cat: string) => categorias.find((c) => c.kind === "saida" && c.name === cat)?.nature ?? null;
  const porNatureza = (["essencial", "estilo", "objetivos"] as const).map((n) => ({ n, v: r.categorias.filter((c) => natureza(c.categoria) === n).reduce((t, c) => t + c.gasto, 0) }));
  const nomeMes = diaMes(`${mes}-01`).split(" de ")[1];
  const credores = [...new Set(parcelamentos.map((p) => p.creditor).filter((c): c is string => !!c))];
  const ativos = investimentos.filter((i) => i.status === "ativo");
  const saldoMes = (m: string) => todos.filter((l) => l.paid && doMes(m, l) && !ehAjuste(l)).reduce((t, l) => t + naConta(l), 0);
  const temMes = (m: string) => todos.some((l) => doMes(m, l));

  const Barra = ({ usado, alvo }: { usado: number; alvo: number }) => (
    <span className="fin-cat__bar"><i style={{ width: `${alvo > 0 ? Math.min(100, (usado / alvo) * 100) : usado > 0 ? 100 : 0}%` }} /></span>
  );

  return (
    <FinancasProvider categorias={categorias} contas={contas}>
    <div className="page page--wide">
      <div className="page__head">
        <div>
          <h1 className="page__t">Finanças</h1>
        </div>
        <div className="page__actions">
          <AjustesFinancas ajustes={aj} />
          <a href={`/financas/planilha?mes=${mes}`} className="btn btn--line btn--sm"><Download aria-hidden />Planilha</a>
        </div>
      </div>

      <div className="fin-onde" aria-label="Onde está o seu dinheiro">
        <div><small>Na conta</small><b className={conta < 0 ? "neg" : undefined}>{moeda(conta)}</b><span>{contas.filter((c) => !c.archived).map((c) => c.name).join(" + ") || "Pelos lançamentos"}</span></div>
        <div><small>Investido</small><b>{moeda(investido)}</b></div>
        <div><small>Devo em parcelas</small><b>{moeda(divida.deve)}</b>{divida.ultima && <span>Livre em {mesCurto(divida.ultima)}</span>}</div>
        <div><small>Tenho menos o que devo</small><b className={conta + investido - divida.deve < 0 ? "neg" : undefined}>{moeda(conta + investido - divida.deve)}</b></div>
      </div>

      <nav className="tabs" aria-label="Partes das finanças">
        {ABAS.map((a) => (
          <Link key={a.v} href={`/financas?${new URLSearchParams({ ...(a.v !== "lancamentos" ? { aba: a.v } : {}), ...(mes !== atual ? { mes } : {}) })}`} aria-current={a.v === aba ? "page" : undefined}>
            {a.r}{a.v === "parcelas" && divida.emCurso > 0 && <em>{divida.emCurso}</em>}{a.v === "investimentos" && investimentos.length > 0 && <em>{investimentos.length}</em>}
          </Link>
        ))}
      </nav>

      {aba === "lancamentos" && (() => {
        // A base de tudo: os lançamentos pela data, mês do calendário, com o saldo da conta no fim de cada dia
        const cm = (lm ?? param ?? hoje.slice(0, 7)).slice(0, 7);
        const cAno = cm.slice(0, 4);
        const dias = (m: string) => new Date(Date.UTC(Number(m.slice(0, 4)), Number(m.slice(5, 7)), 0)).getUTCDate();
        const ini = `${cm}-01`, fimCm = `${cm}-${String(dias(cm)).padStart(2, "0")}`;
        const doCm = todos.filter((l) => l.happened_on >= ini && l.happened_on <= fimCm);
        const x = extratoDoMes(todos, ini, fimCm);
        const saldos = Object.fromEntries([...new Set(doCm.map((l) => l.happened_on))].map((d) => [d, saldoAte(todos, d)]));
        const nomeCm = diaMes(ini).split(" de ")[1];
        return (
          <>
            <div className="meses">
              <Link href={`/financas?lm=${Number(cAno) - 1}-12`} className="icon-btn" aria-label="Ano anterior"><ChevronLeft size={18} /></Link>
              <b className="meses__ano">{cAno}</b>
              <div className="meses__lista">
                {MESES.map((nome, i) => {
                  const m = `${cAno}-${String(i + 1).padStart(2, "0")}`;
                  const n = todos.filter((l) => l.happened_on.startsWith(m)).length;
                  return (
                    <Link key={m} href={`/financas?lm=${m}`} className={`mes${m === cm ? " is-atual" : ""}${n ? "" : " is-vazio"}`} aria-current={m === cm ? "page" : undefined}>
                      <b>{nome}</b><small>{n || "—"}</small>
                    </Link>
                  );
                })}
              </div>
              <Link href={`/financas?lm=${Number(cAno) + 1}-01`} className="icon-btn" aria-label="Próximo ano"><ChevronRight size={18} /></Link>
              <RolarAteMes key={cm} />
            </div>
            <section className="fluxo" aria-label={`Conta em ${nomeCm}`}>
              <div><small>Saldo em 1/{cm.slice(5)}</small><b>{moeda(x.inicial)}</b><span>Fim do mês anterior</span></div>
              <div className="fluxo__mais"><small>Entradas</small><b className="pos">{moeda(x.entrou)}</b><span>{(n => `${n} ${n === 1 ? "lançamento" : "lançamentos"}`)(doCm.filter((l) => l.kind === "entrada" && !ehAjuste(l)).length)}</span></div>
              <div className="fluxo__menos"><small>Saídas</small><b>{moeda(x.saiu)}</b><span>{(n => `${n} ${n === 1 ? "lançamento" : "lançamentos"}`)(doCm.filter((l) => l.kind === "saida" && !ehAjuste(l)).length)}</span></div>
              <div className="fluxo__menos"><small>Investiu</small><b className="transf">{x.investiu < 0 ? "−" : ""}{moeda(Math.abs(x.investiu))}</b><span>Pôs {moeda(x.aportes)} · tirou {moeda(x.resgates)}</span></div>
              {Math.abs(x.ajustes) >= 0.005 && <div className="fluxo__mais"><small>Ajustes</small><b>{x.ajustes < 0 ? "−" : "+"}{moeda(Math.abs(x.ajustes))}</b><span>Para bater com o banco</span></div>}
              <div className="fluxo__igual"><small>Saldo em {dias(cm)}/{cm.slice(5)}</small><b className={x.final < 0 ? "neg" : undefined}>{moeda(x.final)}</b><span>{cm === hoje.slice(0, 7) ? <ConferirConta conta={contaSel ?? principal} calculado={saldoAte(todos, hoje)} /> : "Vira o saldo do próximo mês"}</span></div>
            </section>
            <NovoLancamento key={cm} contextos={ctx} inicio={ini} fim={fimCm} investimentos={ativos} />
            <ExtratoMes key={`l${cm}`} lancamentos={doCm} hoje={hoje} investimentos={investimentos} saldos={saldos} />
          </>
        );
      })()}

      {aba === "mes" && (
        <>
          <div className="meses">
            <Link href={`/financas?mes=${Number(ano) - 1}-12`} className="icon-btn" aria-label="Ano anterior"><ChevronLeft size={18} /></Link>
            <b className="meses__ano">{ano}</b>
            <div className="meses__lista">
              {MESES.map((nome, i, todos) => {
                const m = `${ano}-${String(i + 1).padStart(2, "0")}`;
                const maior = Math.max(1, ...todos.map((_, j) => Math.abs(saldoMes(`${ano}-${String(j + 1).padStart(2, "0")}`))));
                const sm = saldoMes(m);
                return (
                  <Link key={m} href={`/financas?mes=${m}`} className={`mes${m === mes ? " is-atual" : ""}${temMes(m) ? "" : " is-vazio"}${sm < 0 ? " is-neg" : ""}`} aria-current={m === mes ? "page" : undefined} style={{ "--h": `${temMes(m) ? Math.max(8, (Math.abs(sm) / maior) * 100) : 0}%` } as React.CSSProperties}>
                    <b>{nome}</b>
                    <small className={temMes(m) ? (sm < 0 ? "neg" : "pos") : undefined}>{temMes(m) ? `${sm < 0 ? "−" : "+"}${moeda(Math.abs(sm)).replace("R$", "").trim()}` : "—"}</small>
                  </Link>
                );
              })}
            </div>
            <Link href={`/financas?mes=${Number(ano) + 1}-01`} className="icon-btn" aria-label="Próximo ano"><ChevronRight size={18} /></Link>
            <RolarAteMes key={mes} />
          </div>

          <div className="fin-mes-topo">
            <p className="fin-periodo">{dr > 1 ? `Mês do salário de ${nomeMes}` : nomeMes[0].toUpperCase() + nomeMes.slice(1)} · de {Number(inicio.slice(8))}/{inicio.slice(5, 7)} a {Number(fim.slice(8))}/{fim.slice(5, 7)}{contaSel ? ` · ${contaSel.name}` : ""}</p>
            {contas.filter((c) => !c.archived).length > 1 && (
              <nav className="chips fin-contas" aria-label="Conta">
                <Link href={`/financas?mes=${mes}`} className="chip" aria-current={!contaSel ? "page" : undefined}>Todas</Link>
                {contas.filter((c) => !c.archived || c.id === contaSel?.id).map((c) => <Link key={c.id} href={`/financas?mes=${mes}&conta=${c.id}`} className="chip" aria-current={contaSel?.id === c.id ? "page" : undefined}>{c.name}</Link>)}
              </nav>
            )}
          </div>
          <section className="fluxo" aria-label="O mês como extrato">
            <div><small>Saldo inicial</small><b>{moeda(ext.inicial)}</b><span>Sobrou do mês anterior</span></div>
            <div className="fluxo__mais"><small>Entrou</small><b className="pos">{moeda(ext.entrou)}</b>{r.aReceber > 0 ? <span>e {moeda(r.aReceber)} a receber</span> : <span>Renda do mês</span>}</div>
            <div className="fluxo__menos"><small>Saiu</small><b>{moeda(ext.saiu)}</b>{r.aPagar + parcelasAPagar.reduce((t, x) => t + x.valor, 0) > 0 ? <span>e {moeda(r.aPagar + parcelasAPagar.reduce((t, x) => t + x.valor, 0))} a pagar</span> : <span>Gastos e parcelas</span>}</div>
            <div className="fluxo__menos"><small>Investiu</small><b className="transf">{ext.investiu < 0 ? "−" : ""}{moeda(Math.abs(ext.investiu))}</b><span>{ext.investiu < 0 ? "Resgatou mais do que pôs" : `Pôs ${moeda(ext.aportes)} · tirou ${moeda(ext.resgates)}`}</span></div>
            {Math.abs(ext.ajustes) >= 0.005 && <div className="fluxo__mais"><small>Ajustes</small><b>{ext.ajustes < 0 ? "−" : "+"}{moeda(Math.abs(ext.ajustes))}</b><span>Para bater com o banco</span></div>}
            <div className="fluxo__igual"><small>{esteMes ? "Saldo agora" : "Saldo final"}</small><b className={ext.final < 0 ? "neg" : undefined}>{moeda(ext.final)}</b><span>{esteMes ? <ConferirConta conta={contaSel ?? principal} calculado={saldoAte(todos, hoje)} /> : "Vira o saldo inicial do próximo"}</span></div>
          </section>

          <p className="fin-lancar"><Link href={`/financas?lm=${hoje.slice(0, 7)}`} className="btn btn--sm"><Plus aria-hidden />Lançar</Link><span>Os números deste mês saem da aba Lançamentos.</span></p>

          <div className="fin-cols">
            <div className="fin-principal">
              <section className="bloco">
                <h2 className="sec__h">Para pagar em {nomeMes} {nAPagar > 0 && <em>{nAPagar}</em>}<span className="sec__act">{parcelasAPagar.length > 1 && <PagarTodas ids={parcelasAPagar.map((x) => x.p.id)} total={parcelasAPagar.reduce((t, x) => t + x.valor, 0)} />}<NovaContaFixa contextos={ctx} /></span></h2>
                {nAPagar === 0 ? (
                  <p className="bloco__vazio">{fixas.length || parcelamentos.length ? "Tudo pago neste mês." : "Nada para pagar."}</p>
                ) : (
                  <ul className="list">
                    {parcelasAPagar.map(({ p, valor, numero, vence, atrasada }) => (
                      <li key={p.id} className="row fin-conta">
                        {esteMes || vence <= hoje ? <PagarParcela id={p.id} titulo={p.title} rotulo={`parcela ${numero} de ${p.installments}`} /> : <span />}
                        <div className="row__body">
                          <span className="row__t">{p.title}</span>
                          <span className="props"><span className="prop">Parcela {numero} de {p.installments}</span><span className={`prop${atrasada || vence < hoje ? " prop--late" : ""}`}>{atrasada || vence < hoje ? `Venceu ${rotuloData(vence, hoje)}` : vence === hoje ? "Vence hoje" : `Dia ${Number(vence.slice(8))}`}</span></span>
                        </div>
                        <span className="fin-l__v">{moeda(valor)}</span>
                      </li>
                    ))}
                    {contasAbertas.map((c) => (
                      <li key={c.rotina.id} className="row fin-conta">
                        {esteMes ? <ChecarRotina rotina={c.rotina} feita={false} /> : <span />}
                        <div className="row__body">
                          <span className="row__t">{c.rotina.title}</span>
                          <span className="props"><span className="prop">Conta fixa</span><span className={`prop${c.dia < hoje && esteMes ? " prop--late" : ""}`}>Dia {Number(c.dia.slice(8))}</span></span>
                        </div>
                        <span className="fin-l__v">{moeda(c.valor)}</span>
                      </li>
                    ))}
                    {aPagarLanc.map((l) => <LinhaLancamento key={l.id} l={l} contexto={ctx.find((c) => c.id === l.context_id)} />)}
                  </ul>
                )}
              </section>

              <ExtratoMes key={mes} lancamentos={lancamentos} hoje={hoje} investimentos={investimentos} />
            </div>

            <aside className="fin-lado">
              <section className="bloco">
                <h2 className="sec__h">Como o dinheiro se divide</h2>
                {r.entrou === 0 ? (
                  <p className="bloco__vazio">Quando entrar dinheiro no mês, o Rumo separa {aj.pct_parcelas}% para parcelas, {aj.pct_investir}% para investir e {aj.pct_livre}% para gastar livre.</p>
                ) : (
                  <ul className="fin-cats">
                    {[
                      { t: `Parcelas · ${aj.pct_parcelas}%`, e: env.parcelas, nota: env.excesso > 0 ? `Passou ${moeda(env.excesso)}; saiu do gasto livre` : "Já comprometido" },
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
                <h2 className="sec__h">Para onde foi em {nomeMes}</h2>
                {r.categorias.length === 0 ? (
                  <p className="bloco__vazio">Nenhum gasto.</p>
                ) : (
                  <>
                  {r.saiu > 0 && porNatureza.some((x) => x.v > 0) && (
                    <div className="natureza" aria-label="Tipo de gasto">
                      <span className="natureza__barra">{porNatureza.map((x) => x.v > 0 && <i key={x.n} className={`natureza--${x.n}`} style={{ width: `${(x.v / r.saiu) * 100}%` }} />)}</span>
                      <span className="natureza__leg">{porNatureza.map((x) => <span key={x.n}><i className={`natureza--${x.n}`} />{NATUREZAS[x.n]} {Math.round((x.v / r.saiu) * 100)}%</span>)}</span>
                    </div>
                  )}
                  <ul className="fin-cats">
                    {r.categorias.map((c) => {
                      const media = mediaCat(c.categoria);
                      const delta = media > 0 ? (c.gasto - media) / media : null;
                      return (
                        <li key={c.categoria} className={c.limite && c.gasto > c.limite ? "is-passou" : undefined}>
                          <span className="fin-cat__t"><b>{c.categoria}</b><span>{moeda(c.gasto)} <LimiteCategoria categoria={c.categoria} limite={c.limite} /></span></span>
                          <span className="fin-cat__bar">
                            <i style={{ width: `${(c.gasto / maxCat) * 100}%` }} />
                            {c.limite ? <u style={{ left: `${(c.limite / maxCat) * 100}%` }} aria-hidden /> : null}
                          </span>
                          <small className="fin-cat__nota">{r.saiu ? `${Math.round((c.gasto / r.saiu) * 100)}% dos gastos` : ""}{delta !== null && Math.abs(delta) >= 0.05 ? <> · <span className={delta > 0 ? "sobe" : "desce"}>{delta > 0 ? "↑" : "↓"} {Math.round(Math.abs(delta) * 100)}% vs média ({moeda(media)})</span></> : media > 0 ? " · na média" : ""}</small>
                        </li>
                      );
                    })}
                  </ul>
                  </>
                )}
              </section>
            </aside>
          </div>
        </>
      )}

      {aba === "parcelas" && (() => {
        const comSit = parcelamentos.map((p) => ({ p, s: situacaoParcelamento(p, hoje) }));
        const emCurso = comSit.filter(({ s }) => s.estado !== "quitado").sort((a, b) => a.s.ultima.localeCompare(b.s.ultima)).map(({ p }) => p);
        const quitados = comSit.filter(({ s }) => s.estado === "quitado").sort((a, b) => b.s.ultima.localeCompare(a.s.ultima)).map(({ p }) => p);
        const totalComprado = parcelamentos.reduce((t, p) => t + p.total, 0);
        // Consultor: renda e gasto do dia a dia (sem parcelas) dos 3 meses fechados; parcelas que já saem nos próximos 12
        const fechados = [1, 2, 3].map((k) => lim(mesVizinho(atual, -k)));
        const media = (f: (l: (typeof todos)[number]) => boolean) => fechados.reduce((t, x) => t + todos.filter((l) => l.paid && !ehAjuste(l) && l.happened_on >= x.inicio && l.happened_on <= x.fim && f(l)).reduce((a, l) => a + l.amount, 0), 0) / 3;
        // Cada parcela cai no mês (do salário) em que vence: um parcelamento que começa em dezembro só pesa de dezembro em diante
        const vencimentos = parcelamentos.flatMap((p) => { const s = situacaoParcelamento(p, hoje); return Array.from({ length: p.installments }, (_, i) => ({ dia: somarMeses(p.first_due, i), v: valorParcela(p, i) })); });
        const base: BaseConsultor = {
          renda: Math.round(media((l) => l.kind === "entrada")), gasto: Math.round(media((l) => l.kind === "saida" && !l.installment_id)),
          pctParcelas: aj.pct_parcelas, pctInvestir: aj.pct_investir,
          meses: Array.from({ length: 12 }, (_, k) => { const m = mesVizinho(atual, k); const x = lim(m); return { rotulo: mesCurto(`${m}-01`), parcelas: Math.round(vencimentos.filter((v) => v.dia >= x.inicio && v.dia <= x.fim).reduce((t, v) => t + v.v, 0) * 100) / 100 }; }),
        };
        const [esteMes, proximoMes] = base.meses;
        const lAtual = lim(atual);
        const pix = pixDoMes(parcelamentos, lAtual.inicio, lAtual.fim);
        const nomeAtual = diaMes(`${atual}-01`).split(" de ")[1];
        const aComecar = comSit.filter(({ s }) => s.estado === "a_comecar").length;
        return (
          <>
            <div className="nums">
              <div><small>Ainda devo</small><b>{moeda(divida.deve)}</b><span>Já paguei {moeda(totalComprado - divida.deve)} de {moeda(totalComprado)}</span></div>
              <div><small>Sai em {esteMes.rotulo}</small><b>{moeda(esteMes.parcelas)}</b><span>{proximoMes.parcelas !== esteMes.parcelas ? `Em ${proximoMes.rotulo}: ${moeda(proximoMes.parcelas)}` : `${divida.emCurso} em curso`}{aComecar ? ` · ${aComecar} a começar` : ""}</span></div>
              <div><small>Livre de parcelas em</small><b className="nums__texto">{divida.ultima ? mesCurto(divida.ultima) : "—"}</b><span>{divida.ultima ? diaMes(divida.ultima) : "Nada parcelado"}</span></div>
              <div><small>Já quitados</small><b>{divida.quitados}</b></div>
            </div>
            {pix.itens.length > 0 && (
              <section className="bloco pix">
                <h2 className="sec__h">Pix das parcelas de {nomeAtual}<span className="sec__act">{diaMes(lAtual.inicio)} a {diaMes(lAtual.fim)}</span></h2>
                <div className="pix__total">
                  <div><small>{pix.falta ? (pix.pago ? "Falta mandar" : "Mandar no Pix") : "Pago"}</small><b>{moeda(pix.falta || pix.total)}</b>{pix.pago > 0 && pix.falta > 0 && <span>Já mandou {moeda(pix.pago)} de {moeda(pix.total)}</span>}</div>
                  {pix.falta > 0 && <span className="pix__acoes"><CopiarValor valor={pix.falta} /><PagarTodas ids={pix.itens.filter((i) => !i.paga).map((i) => i.p.id)} total={pix.falta} rotulo="Mandei o Pix" /></span>}
                </div>
                <ul className="pix__lista">
                  {pix.itens.map((i) => (
                    <li key={`${i.p.id}-${i.numero}`} className={i.paga ? "is-paga" : undefined}>
                      <span><b>{i.p.title}</b><small>Parcela {i.numero} de {i.p.installments}{i.atrasada ? ` · venceu ${diaMes(i.vence)}` : ""}{i.paga ? " · paga" : ""}</small></span>
                      <span className="pix__v">{moeda(i.valor)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <Consultor base={base} />
            <div style={{ margin: "16px 0" }}><NovoParcelamento contextos={ctx} credores={credores} /></div>
            {parcelamentos.length === 0 ? <p className="empty">Nenhum parcelamento.</p> : (
              <>
                {emCurso.length > 0 && <section className="sec"><h2 className="sec__h">Em curso <em>{emCurso.length}</em></h2><GradeParcelas parcelamentos={emCurso} hoje={hoje} /></section>}
                {quitados.length > 0 && (
                  <details className="sec fold"><summary className="sec__h"><ChevronRight aria-hidden />Quitados <em>{quitados.length}</em></summary><GradeParcelas parcelamentos={quitados} hoje={hoje} /></details>
                )}
              </>
            )}
          </>
        );
      })()}


      {aba === "resumo" && (() => {
        const ciclos = Array.from({ length: 12 }, (_, k) => { const m = mesVizinho(atual, k - 11); return { m, ...lim(m) }; });
        const daqui = (l: { happened_on: string }, c: { inicio: string; fim: string }) => l.happened_on >= c.inicio && l.happened_on <= c.fim;
        const pagos = todos.filter((l) => l.paid);
        const usados = ciclos.filter((c) => pagos.some((l) => daqui(l, c)) || movs.some((m) => daqui(m, c)));
        const soma = (lista: { amount: number }[]) => lista.reduce((t, l) => t + l.amount, 0);
        const cats = [...new Set(pagos.filter((l) => l.kind === "saida" && !ehAjuste(l)).map((l) => l.category))]
          .map((cat) => ({ cat, valores: usados.map((c) => soma(pagos.filter((l) => l.kind === "saida" && l.category === cat && daqui(l, c)))) }))
          .map((x) => ({ ...x, total: x.valores.reduce((a, b) => a + b, 0) }))
          .sort((a, b) => b.total - a.total);
        const linha = (valores: number[]) => ({ valores, total: valores.reduce((a, b) => a + b, 0) });
        const exts = usados.map((c) => extratoDoMes(todos, c.inicio, c.fim));
        const entrou = linha(exts.map((x) => x.entrou));
        const saiu = linha(exts.map((x) => x.saiu));
        const parcelasL = linha(usados.map((c) => soma(pagos.filter((l) => l.kind === "saida" && l.installment_id && daqui(l, c)))));
        const investiu = linha(exts.map((x) => x.investiu));
        const ajustes = linha(exts.map((x) => x.ajustes));
        const cel = (v: number) => (Math.abs(v) < 0.005 ? <span className="tabela__zero">—</span> : moeda(v).replace("R$", "").trim());
        const n = Math.max(1, usados.length);
        const rotulo = (c: { inicio: string }) => mesCurto(c.inicio);
        if (!usados.length) return <p className="empty">Nada lançado nos últimos 12 meses.</p>;
        return (
          <>
            <p className="field__hint" style={{ margin: "0 0 10px" }}>Em R$, cada mês de {dr > 1 ? `${dr} a ${dr - 1}` : "1 a 31"}. O saldo final de um mês é o inicial do seguinte.</p>
            <div className="planilha__rolo">
              <table className="tabela tabela--resumo">
                <thead><tr><th>Categoria</th>{usados.map((c) => <th key={c.m} className="num">{rotulo(c)}</th>)}<th className="num">Total</th><th className="num">Média</th></tr></thead>
                <tbody>
                  <tr><td>Saldo inicial</td>{exts.map((x, i) => <td key={i} className="num">{cel(x.inicial)}</td>)}<td className="num" /><td className="num" /></tr>
                  <tr className="tabela__forte"><td>Entrou</td>{entrou.valores.map((v, i) => <td key={i} className="num pos">{cel(v)}</td>)}<td className="num pos">{cel(entrou.total)}</td><td className="num">{cel(entrou.total / n)}</td></tr>
                  <tr className="tabela__forte"><td>Saiu</td>{saiu.valores.map((v, i) => <td key={i} className="num">{cel(v)}</td>)}<td className="num">{cel(saiu.total)}</td><td className="num">{cel(saiu.total / n)}</td></tr>
                  <tr><td>Investiu (aportes − resgates)</td>{investiu.valores.map((v, i) => <td key={i} className="num">{cel(v)}</td>)}<td className="num">{cel(investiu.total)}</td><td className="num">{cel(investiu.total / n)}</td></tr>
                  {ajustes.valores.some((v) => Math.abs(v) >= 0.005) && <tr><td>Ajustes de saldo</td>{ajustes.valores.map((v, i) => <td key={i} className="num">{cel(v)}</td>)}<td className="num">{cel(ajustes.total)}</td><td className="num" /></tr>}
                  <tr className="tabela__forte"><td>Saldo final</td>{exts.map((x, i) => <td key={i} className={`num ${x.final < 0 ? "neg" : ""}`}>{cel(x.final)}</td>)}<td className="num" /><td className="num" /></tr>
                  <tr><td>Sobrou do que entrou</td>{entrou.valores.map((v, i) => <td key={i} className={`num ${v - saiu.valores[i] < 0 ? "neg" : "pos"}`}>{cel(v - saiu.valores[i])}</td>)}<td className="num">{cel(entrou.total - saiu.total)}</td><td className="num">{cel((entrou.total - saiu.total) / n)}</td></tr>
                  <tr><td>Taxa de poupança</td>{entrou.valores.map((v, i) => <td key={i} className="num">{v ? `${Math.round((investiu.valores[i] / v) * 100)}%` : <span className="tabela__zero">—</span>}</td>)}<td className="num">{entrou.total ? `${Math.round((investiu.total / entrou.total) * 100)}%` : "—"}</td><td className="num" /></tr>
                  <tr><td>Parcelas pagas</td>{parcelasL.valores.map((v, i) => <td key={i} className="num">{cel(v)}</td>)}<td className="num">{cel(parcelasL.total)}</td><td className="num">{cel(parcelasL.total / n)}</td></tr>
                  <tr><td>Parcelas / renda</td>{parcelasL.valores.map((v, i) => <td key={i} className={`num ${entrou.valores[i] && v / entrou.valores[i] > aj.pct_parcelas / 100 ? "neg" : ""}`}>{entrou.valores[i] ? `${Math.round((v / entrou.valores[i]) * 100)}%` : <span className="tabela__zero">—</span>}</td>)}<td className="num">{entrou.total ? `${Math.round((parcelasL.total / entrou.total) * 100)}%` : "—"}</td><td className="num" /></tr>
                  <tr className="tabela__sep"><td colSpan={usados.length + 3}>Saídas por categoria</td></tr>
                  {cats.map((c) => (
                    <tr key={c.cat}><td>{c.cat}</td>{c.valores.map((v, i) => <td key={i} className="num">{cel(v)}</td>)}<td className="num"><b>{cel(c.total)}</b></td><td className="num">{cel(c.total / n)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        );
      })()}


      {aba === "investimentos" && (
        <>
          <div className="nums">
            <div><small>Investido hoje</small><b className="pos">{moeda(investido)}</b></div>
            <div><small>Aportes neste mês</small><b>{moeda(movsMes.filter((m) => m.kind === "aporte").reduce((t, m) => t + m.amount, 0))}</b><span>Resgates: {moeda(movsMes.filter((m) => m.kind === "resgate").reduce((t, m) => t + m.amount, 0))}</span></div>
            <div><small>Rendeu nos últimos 12 meses</small><b>{moeda(movs.filter((m) => m.kind === "rendimento" && m.happened_on > somarMeses(hoje, -12)).reduce((t, m) => t + m.amount, 0))}</b><span>O que você lançou como rendimento</span></div>
            <div><small>Em 12 meses, no plano</small><b>{moeda(investimentos.filter((i) => i.status === "ativo").reduce((t, i) => t + projetar(saldoAtual(i, movs), i.monthly_rate ?? 0, i.monthly_plan ?? 0, 12), 0))}</b><span>Com o aporte e a taxa de cada um</span></div>
          </div>
          <div style={{ marginBottom: 16 }}><NovoInvestimento /></div>

          <div className="fin-cols">
            <div>
              {investimentos.length === 0 && <p className="empty">Nenhum investimento.</p>}
              {investimentos.map((i) => {
                const saldo = saldoAtual(i, movs);
                const meus = movs.filter((m) => m.investment_id === i.id);
                const anos = [1, 3, 5].map((a) => ({ a, v: projetar(saldo, i.monthly_rate ?? 0, i.monthly_plan ?? 0, a * 12) }));
                return (
                  <section key={i.id} className="bloco inv">
                    <div className="inv__head">
                      <div><h2 className="inv__t">{i.name}</h2><small>{TIPOS_INVESTIMENTO[i.kind]}{i.institution ? ` · ${i.institution}` : ""}{i.monthly_rate ? ` · rende ${String(Math.round(i.monthly_rate * 10000) / 100).replace(".", ",")}% ao mês` : ""}</small></div>
                      <div className="inv__saldo"><b>{moeda(saldo)}</b><small>Pelos lançamentos · <AjustarInvestimento inv={i} saldo={saldo} /></small></div>
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
                              <span>{m.note === AJUSTE || m.note === SALDO_INICIAL ? m.note : <>{m.kind === "aporte" ? "Investi" : m.kind === "resgate" ? "Resgatei" : "Rendimento"}{m.note ? ` · ${m.note}` : ""}</>}{m.origem === "lancamento" ? <small> · lançamento</small> : null}</span>
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
    </FinancasProvider>
  );
}
