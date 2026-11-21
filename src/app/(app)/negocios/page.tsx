import Link from "next/link";
import { ArrowRight, Building2, CalendarClock, Plus, Scale } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Lista } from "@/components/Lista";
import type { ContextItem } from "@/components/Shell";
import { NovaDemanda, QuadroNegocios, type Demanda } from "@/components/QuadroNegocios";
import { contarPassos } from "@/lib/subtarefas";
import { ehId } from "@/lib/datas";
import { agoraHora, haDias, hojeISO, horaDe, inicioDoDia, prazoPassou, rotuloData, somarDias } from "@/lib/datas";
import { CAMPOS_ROTINA, eDoDia, feitaEm, desdeMarcas, type Marcacao, type Rotina } from "@/lib/rotinas";
import { CAMPOS_LISTA, ordenar, type Compromisso, type Responsabilidade } from "@/lib/tipos";

export const metadata = { title: "Negócios" };

export default async function Page({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const { e: escolhida } = await searchParams;
  const hoje = hojeISO();
  const agora = agoraHora();
  const supabase = await createClient();
  const { data: empresasDb } = await supabase.from("contexts").select("id, name, color, kind").eq("kind", "empresa").eq("archived", false).order("position");
  const empresas = (empresasDb ?? []) as ContextItem[];
  const ids = empresas.map((e) => e.id);
  const [{ data: itensDb }, { data: eventosDb }, { data: rotinasDb }, { data: marcasDb }, { data: inboxDb }] = ids.length
    ? await Promise.all([
        supabase.from("responsibilities").select(CAMPOS_LISTA).in("context_id", ids).neq("state", "concluida"),
        supabase.from("events").select("id, title, context_id, starts_at, ends_at, location").in("context_id", ids).gte("starts_at", inicioDoDia(hoje)).order("starts_at").limit(40),
        supabase.from("routines").select(CAMPOS_ROTINA).in("context_id", ids).eq("status", "ativa"),
        supabase.from("routine_checks").select("routine_id, done_on").gte("done_on", desdeMarcas(hoje)),
        // Para classificar: o que está no Inbox
        supabase.from("responsibilities").select(CAMPOS_LISTA).is("context_id", null).is("project_id", null).is("route_id", null).neq("state", "concluida"),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: [] }];
  const itens = ((itensDb ?? []) as Responsabilidade[]).sort(ordenar);
  const eventos = (eventosDb ?? []) as Compromisso[];
  const rotinas = (rotinasDb ?? []) as Rotina[];
  const marcas = (marcasDb ?? []) as Marcacao[];

  const empresa = ehId(escolhida) ? empresas.find((e) => e.id === escolhida) ?? null : null;
  const inbox = ((inboxDb ?? []) as Responsabilidade[]).sort(ordenar);
  const passos = await contarPassos(supabase, [...itens, ...inbox].map((i) => i.id));
  const demanda = (i: Responsabilidade): Demanda => ({
    id: i.id, title: i.title, context_id: i.context_id, due_date: i.due_date, due_time: i.due_time,
    aguardando: i.state === "aguardando", quem: i.waiting_note, cobrarHoje: i.state === "aguardando" && !!i.follow_up_on && i.follow_up_on <= hoje,
    decidir: i.kind === "decidir", atrasada: i.state === "a_fazer" && prazoPassou(i, hoje, agora),
    passos: passos[i.id]?.total ? `${passos[i.id].feitos}/${passos[i.id].total}` : undefined,
  });
  // No quadro: atrasadas primeiro, depois por prazo; sem data e aguardando no fim
  const peso = (d: Demanda) => (d.atrasada ? 0 : d.aguardando ? 3 : d.due_date ? 1 : 2);
  const demandas = [...itens, ...inbox].map(demanda).sort((a, b) => peso(a) - peso(b) || (a.due_date ?? "").localeCompare(b.due_date ?? ""));
  const contar = (id: string) => {
    const daqui = itens.filter((i) => i.context_id === id);
    return { abertas: daqui.filter((i) => i.state === "a_fazer").length, atrasadas: daqui.filter((i) => i.state === "a_fazer" && prazoPassou(i, hoje, agora)).length };
  };

  // Quem me deve o quê: os retornos que você espera, por pessoa, em todas as empresas
  const aguardando = itens.filter((i) => i.state === "aguardando");
  const porPessoa = new Map<string, Responsabilidade[]>();
  for (const i of aguardando) {
    const quem = i.waiting_note?.trim() || "Sem nome";
    porPessoa.set(quem, [...(porPessoa.get(quem) ?? []), i]);
  }
  const pessoas = [...porPessoa.entries()].sort((a, b) => b[1].length - a[1].length);
  const decisoes = itens.filter((i) => i.kind === "decidir" && i.state === "a_fazer");

  return (
    <div className={`page ${empresa ? "page--wide" : "page--full"}`}>
      <div className="page__head">
        <div><h1 className="page__t">{empresa ? empresa.name : "Negócios"}</h1></div>
        <div className="page__actions"><Link href="/contextos" className="btn btn--line btn--sm"><Plus aria-hidden />Empresa</Link></div>
      </div>

      {!empresas.length ? (
        <div className="empty empty--box" style={{ maxWidth: 560 }}>
          <b><Building2 size={16} aria-hidden style={{ verticalAlign: -3, marginRight: 6 }} />Nenhuma empresa ainda</b>
          <span>Crie um contexto do tipo empresa para cada negócio.</span>
        </div>
      ) : (
        <>
          <nav className="chips emp-chips" aria-label="Empresa">
            <Link href="/negocios" className="chip" aria-current={!empresa ? "page" : undefined}>Todas<em>{itens.filter((i) => i.state === "a_fazer").length}</em></Link>
            {empresas.map((e) => {
              const n = contar(e.id);
              return (
                <Link key={e.id} href={`/negocios?e=${e.id}`} className="chip" aria-current={empresa?.id === e.id ? "page" : undefined}>
                  <i className="dot" style={{ background: e.color }} />{e.name}<em>{n.abertas}</em>{n.atrasadas > 0 && <b className="chip__late">{n.atrasadas}</b>}
                </Link>
              );
            })}
          </nav>

          {!empresa ? (
            <>
              <QuadroNegocios empresas={empresas} demandas={demandas} hoje={hoje} />
              <div className="fin-cols" style={{ marginTop: 24 }}>
                <section className="bloco">
                  <h2 className="sec__h">Quem me deve o quê {aguardando.length > 0 && <em>{aguardando.length}</em>}</h2>
                  {!pessoas.length ? (
                    <p className="bloco__vazio">Ninguém te deve retorno.</p>
                  ) : (
                    <div className="pessoas">
                      {pessoas.map(([quem, lista]) => (
                        <div key={quem} className="pessoa">
                          <h3><span className="avatar avatar--sm" aria-hidden>{quem.slice(0, 1).toUpperCase()}</span>{quem}<em>{lista.length}</em><small>{(() => { const h = haDias(lista.map((i) => i.updated_at ?? i.created_at).sort()[0], hoje); return h === "hoje" ? "desde hoje" : `há ${h}`; })()}</small></h3>
                          <Lista itens={lista} contextos={empresas} cobravel />
                        </div>
                      ))}
                    </div>
                  )}
                </section>
                <section className="bloco">
                  <h2 className="sec__h"><Scale size={15} aria-hidden style={{ marginRight: 6, verticalAlign: -2 }} />Para decidir {decisoes.length > 0 && <em>{decisoes.length}</em>}</h2>
                  {decisoes.length ? <Lista itens={decisoes} contextos={empresas} /> : <p className="bloco__vazio">Nenhuma decisão pendente.</p>}
                </section>
              </div>
            </>
          ) : (() => {
            const e = empresa;
            const daqui = itens.filter((i) => i.context_id === e.id);
            const abertas = daqui.filter((i) => i.state === "a_fazer" && i.kind !== "decidir");
            const atrasadas = abertas.filter((i) => prazoPassou(i, hoje, agora));
            const semana = abertas.filter((i) => !atrasadas.includes(i) && (i.today || (i.due_date && i.due_date <= somarDias(hoje, 7))));
            const depois = abertas.filter((i) => !atrasadas.includes(i) && !semana.includes(i) && i.due_date);
            const semData = abertas.filter((i) => !i.due_date && !i.today);
            const esperando = daqui.filter((i) => i.state === "aguardando");
            const decidir = daqui.filter((i) => i.kind === "decidir" && i.state === "a_fazer");
            const reunioes = eventos.filter((x) => x.context_id === e.id && new Date(x.starts_at) > new Date()).slice(0, 4);
            const rotinasHoje = rotinas.filter((r) => r.context_id === e.id && eDoDia(r, marcas, hoje) && !feitaEm(r, marcas, hoje));
            const secao = (titulo: string, lista: Responsabilidade[], extra: { cobravel?: boolean; late?: boolean } = {}) =>
              lista.length > 0 && (
                <section className="sec">
                  <h2 className={`sec__h${extra.late ? " sec__h--late" : ""}`}>{titulo} <em>{lista.length}</em></h2>
                  <Lista itens={lista} contextos={empresas} comContexto={false} cobravel={extra.cobravel} />
                </section>
              );
            return (
              <div className="fin-cols">
                <div>
                  <NovaDemanda onde={e.id} aberta />
                  {secao("Atrasadas", atrasadas, { late: true })}
                  {secao("Esta semana", semana)}
                  {secao("Depois", depois)}
                  {secao("Sem data", semData)}
                  {secao("Aguardando alguém", esperando, { cobravel: true })}
                  {secao("Para decidir", decidir)}
                  {!daqui.length && <p className="empty">Nenhuma demanda em {e.name}.</p>}
                </div>
                <aside className="fin-lado">
                  <section className="bloco">
                    <dl className="empresa__nums">
                      <div><dt>Abertas</dt><dd>{abertas.length}</dd></div>
                      <div className={atrasadas.length ? "is-quente" : undefined}><dt>Atrasadas</dt><dd>{atrasadas.length}</dd></div>
                      <div><dt>Retornos</dt><dd>{esperando.length}</dd></div>
                      <div><dt>Decidir</dt><dd>{decidir.length}</dd></div>
                    </dl>
                  </section>
                  <section className="bloco">
                    <h2 className="sec__h">Próximas reuniões</h2>
                    {reunioes.length ? (
                      <div className="agenda">
                        {reunioes.map((r) => (
                          <Link key={r.id} href={`/calendario/${r.id}`} className="ag"><time>{horaDe(r.starts_at)}</time><div><b>{r.title}</b><small><CalendarClock aria-hidden size={12} />{rotuloData(hojeISO(new Date(r.starts_at)), hoje)}</small></div></Link>
                        ))}
                      </div>
                    ) : <p className="bloco__vazio">Nenhuma reunião marcada.</p>}
                  </section>
                  {rotinasHoje.length > 0 && (
                    <section className="bloco">
                      <h2 className="sec__h">Rotinas de hoje</h2>
                      <p className="bloco__vazio">{rotinasHoje.map((r) => r.title).join(", ")}</p>
                    </section>
                  )}
                  <Link href={`/contexto/${e.id}`} className="btn btn--line btn--sm" style={{ justifySelf: "start" }}>Notas e rotinas de {e.name}<ArrowRight aria-hidden /></Link>
                </aside>
              </div>
            );
          })()}
        </>
      )}
    </div>
  );
}
