import Link from "next/link";
import { ChevronLeft, ChevronRight, Download, Route } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { LimiteCategoria, LinhaLancamento, NovaContaFixa, NovoLancamento } from "@/components/Financas";
import { ChecarRotina } from "@/components/Rotinas";
import { Anel } from "@/components/Caminho";
import type { ContextItem } from "@/components/Shell";
import { hojeISO, mesAno, rotuloData } from "@/lib/datas";
import { CAMPOS_LANCAMENTO, contasDoMes, limitesDoMes, mesVizinho, moeda, normalizarLancamento, resumoDoMes, type Orcamento } from "@/lib/financas";
import { CAMPOS_ROTINA, type Marcacao, type Rotina } from "@/lib/rotinas";
import { CAMPOS_ROTA, normalizar, resumirRota } from "@/lib/rotas";

export const metadata = { title: "Finanças" };

export default async function Page({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const { mes: param } = await searchParams;
  const hoje = hojeISO();
  const mes = param && /^\d{4}-(0[1-9]|1[0-2])$/.test(param) ? param : hoje.slice(0, 7);
  const { inicio, fim } = limitesDoMes(mes);
  const esteMes = mes === hoje.slice(0, 7);

  const supabase = await createClient();
  const [{ data: lancDb }, { data: rotinasDb }, { data: marcasDb }, { data: orcDb }, { data: contextos }, { data: rotasDb }, { data: atrasadosDb }] = await Promise.all([
    supabase.from("fin_entries").select(CAMPOS_LANCAMENTO).gte("happened_on", inicio).lte("happened_on", fim).order("happened_on", { ascending: false }),
    supabase.from("routines").select(CAMPOS_ROTINA).eq("status", "ativa").not("month_day", "is", null).not("amount", "is", null),
    supabase.from("routine_checks").select("routine_id, done_on").gte("done_on", inicio).lte("done_on", fim),
    supabase.from("fin_budgets").select("id, category, monthly_limit"),
    supabase.from("contexts").select("id, name, color, kind").eq("archived", false).order("position"),
    supabase.from("routes").select(CAMPOS_ROTA).eq("kind", "financeiro").eq("status", "ativa"),
    // A pagar de meses anteriores continua aparecendo (sem alarme)
    esteMes ? supabase.from("fin_entries").select(CAMPOS_LANCAMENTO).eq("paid", false).lt("happened_on", inicio) : Promise.resolve({ data: [] }),
  ]);
  const lancamentos = (lancDb ?? []).map(normalizarLancamento);
  const atrasados = (atrasadosDb ?? []).map(normalizarLancamento);
  const contas = contasDoMes((rotinasDb ?? []) as Rotina[], (marcasDb ?? []) as Marcacao[], mes, hoje);
  const r = resumoDoMes([...lancamentos, ...atrasados], contas, (orcDb ?? []) as Orcamento[]);
  const ctx = (contextos ?? []) as ContextItem[];
  const aPagar = [...atrasados, ...lancamentos].filter((l) => !l.paid).sort((a, b) => a.happened_on.localeCompare(b.happened_on));
  const feitos = lancamentos.filter((l) => l.paid);
  const metas = (rotasDb ?? []).map(normalizar);
  const maxCat = Math.max(1, ...r.categorias.map((c) => Math.max(c.gasto, c.limite ?? 0)));
  const titulo = mesAno(inicio);

  return (
    <div className="page page--wide">
      <div className="page__head">
        <div>
          <h1 className="page__t">Finanças</h1>
          <p className="page__para">O mês numa tela: o que entrou, o que saiu, o que falta pagar e para onde foi o dinheiro. Tudo lançado por você, sem banco conectado.</p>
        </div>
        <div className="page__actions">
          <Link href={`/financas?mes=${mesVizinho(mes, -1)}`} className="icon-btn" aria-label="Mês anterior"><ChevronLeft size={18} /></Link>
          <span className="fin-mes">{titulo[0].toUpperCase() + titulo.slice(1)}</span>
          <Link href={`/financas?mes=${mesVizinho(mes, 1)}`} className="icon-btn" aria-label="Próximo mês"><ChevronRight size={18} /></Link>
          <a href={`/financas/planilha?mes=${mes}`} className="btn btn--line btn--sm"><Download aria-hidden />Planilha</a>
        </div>
      </div>

      <div className="fin-nums">
        <div><small>Entrou</small><b className="pos">{moeda(r.entrou)}</b></div>
        <div><small>Saiu</small><b>{moeda(r.saiu)}</b></div>
        <div><small>Saldo do mês</small><b className={r.saldo < 0 ? "neg" : "pos"}>{moeda(r.saldo)}</b></div>
        <div><small>Falta pagar</small><b>{moeda(r.aPagar)}</b>{r.aReceber > 0 && <span>e {moeda(r.aReceber)} a receber</span>}</div>
      </div>

      <NovoLancamento contextos={ctx} mes={mes} />

      <div className="fin-cols">
        <div>
          <section className="bloco">
            <h2 className="sec__h">Contas fixas <em>{contas.filter((c) => !c.paga).length} de {contas.length} abertas</em><span className="sec__act"><NovaContaFixa contextos={ctx} /></span></h2>
            {contas.length === 0 ? (
              <p className="bloco__vazio">Condomínio, internet, escola, DAS: crie uma conta fixa com o dia e o valor. Ela aparece no Hoje no dia e, ao marcar, o pagamento entra aqui.</p>
            ) : (
              <ul className="list">
                {contas.map((c) => (
                  <li key={c.rotina.id} className="row fin-conta" data-feita={c.paga || undefined}>
                    {esteMes ? <ChecarRotina rotina={c.rotina} feita={c.paga} /> : <span />}
                    <div className="row__body">
                      <span className="row__t">{c.rotina.title}</span>
                      <span className="props"><span className="prop">{c.paga ? `Paga ${rotuloData(c.pagaEm!)}` : `Dia ${Number(c.dia.slice(8))}${c.dia < hoje && esteMes ? " · ainda aberta" : ""}`}</span>{c.rotina.category && <span className="prop">{c.rotina.category}</span>}</span>
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
            <h2 className="sec__h">Lançamentos <em>{feitos.length}</em></h2>
            {feitos.length === 0 ? <p className="bloco__vazio">Nada lançado em {titulo}.</p> : <ul className="list">{feitos.map((l) => <LinhaLancamento key={l.id} l={l} contexto={ctx.find((c) => c.id === l.context_id)} />)}</ul>}
          </section>
        </div>

        <aside className="fin-lado">
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

          <section className="bloco">
            <h2 className="sec__h">Metas<Link href="/rotas/nova?tipo=financeiro" className="sec__act">Nova meta</Link></h2>
            {metas.length === 0 ? (
              <p className="bloco__vazio">Reserva, viagem, quitar algo: uma Rota financeira calcula quanto guardar por mês.</p>
            ) : (
              <div className="agenda">
                {metas.map((m) => {
                  const res = resumirRota(m, [], hoje);
                  return (
                    <Link key={m.id} href={`/rotas/${m.id}`} className="ag" style={{ gridTemplateColumns: "20px minmax(0,1fr)" }}>
                      <span style={{ paddingTop: 3 }}><Anel pct={res.pct} /></span>
                      <div><b>{m.title}</b><small>{res.agora} · {res.ritmo ?? res.situacao}</small></div>
                    </Link>
                  );
                })}
              </div>
            )}
            {metas.length === 0 && <div style={{ padding: "6px 6px 4px" }}><Link href="/rotas/nova?tipo=financeiro" className="btn btn--line btn--sm"><Route aria-hidden />Criar uma meta</Link></div>}
          </section>
        </aside>
      </div>
    </div>
  );
}
