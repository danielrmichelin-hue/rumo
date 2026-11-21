import Link from "next/link";
import { ArrowRight, Building2, CalendarClock, Hourglass, Scale } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Lista } from "@/components/Lista";
import type { ContextItem } from "@/components/Shell";
import { agoraHora, haDias, hojeISO, horaDe, inicioDoDia, prazoPassou, rotuloData, somarDias } from "@/lib/datas";
import { CAMPOS_ROTINA, eDoDia, feitaEm, desdeMarcas, type Marcacao, type Rotina } from "@/lib/rotinas";
import { CAMPOS_LISTA, ordenar, type Compromisso, type Responsabilidade } from "@/lib/tipos";

export const metadata = { title: "Negócios" };

export default async function Page() {
  const hoje = hojeISO();
  const agora = agoraHora();
  const supabase = await createClient();
  const { data: empresasDb } = await supabase.from("contexts").select("id, name, color, kind").eq("kind", "empresa").eq("archived", false).order("position");
  const empresas = (empresasDb ?? []) as ContextItem[];
  const ids = empresas.map((e) => e.id);
  const [{ data: itensDb }, { data: eventosDb }, { data: rotinasDb }, { data: marcasDb }] = ids.length
    ? await Promise.all([
        supabase.from("responsibilities").select(CAMPOS_LISTA).in("context_id", ids).neq("state", "concluida"),
        supabase.from("events").select("id, title, context_id, starts_at, ends_at, location").in("context_id", ids).gte("starts_at", inicioDoDia(hoje)).order("starts_at").limit(40),
        supabase.from("routines").select(CAMPOS_ROTINA).in("context_id", ids).eq("status", "ativa"),
        supabase.from("routine_checks").select("routine_id, done_on").gte("done_on", desdeMarcas(hoje)),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }];
  const itens = ((itensDb ?? []) as Responsabilidade[]).sort(ordenar);
  const eventos = (eventosDb ?? []) as Compromisso[];
  const rotinas = (rotinasDb ?? []) as Rotina[];
  const marcas = (marcasDb ?? []) as Marcacao[];
  const semana = somarDias(hoje, 7);

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
    <div className="page page--wide">
      <div className="page__head">
        <div>
          <h1 className="page__t">Negócios</h1>
        </div>
      </div>

      {!empresas.length ? (
        <div className="empty empty--box" style={{ maxWidth: 560 }}>
          <b><Building2 size={16} aria-hidden style={{ verticalAlign: -3, marginRight: 6 }} />Nenhuma empresa ainda</b>
          <span>Crie um contexto do tipo empresa para cada negócio que você tem ou dirige.</span>
          <div style={{ marginTop: 10 }}><Link href="/contextos" className="btn btn--sm">Criar uma empresa</Link></div>
        </div>
      ) : (
        <>
          <div className="empresas">
            {empresas.map((e) => {
              const daqui = itens.filter((i) => i.context_id === e.id);
              const abertas = daqui.filter((i) => i.state === "a_fazer");
              const atrasadas = abertas.filter((i) => prazoPassou(i, hoje, agora));
              const esperando = daqui.filter((i) => i.state === "aguardando");
              const cobrarHoje = esperando.filter((i) => i.follow_up_on && i.follow_up_on <= hoje);
              const decidir = daqui.filter((i) => i.kind === "decidir" && i.state === "a_fazer");
              const proximo = atrasadas[0] ?? cobrarHoje[0] ?? abertas.find((i) => i.today || (i.due_date && i.due_date <= semana)) ?? abertas[0];
              const reuniao = eventos.find((x) => x.context_id === e.id && new Date(x.starts_at) > new Date());
              const rotinasHoje = rotinas.filter((r) => r.context_id === e.id && eDoDia(r, marcas, hoje) && !feitaEm(r, marcas, hoje));
              return (
                <article key={e.id} className="empresa" style={{ "--c": e.color } as React.CSSProperties}>
                  <Link href={`/contexto/${e.id}`} className="empresa__t"><i className="dot" style={{ background: e.color }} />{e.name}<ArrowRight aria-hidden /></Link>
                  <dl className="empresa__nums">
                    <div><dt>Abertas</dt><dd>{abertas.length}</dd></div>
                    <div className={atrasadas.length ? "is-quente" : undefined}><dt>Atrasadas</dt><dd>{atrasadas.length}</dd></div>
                    <div><dt>Retornos</dt><dd>{esperando.length}</dd></div>
                    <div><dt>Decidir</dt><dd>{decidir.length}</dd></div>
                  </dl>
                  <div className="empresa__linhas">
                    <p><b>Próximo passo</b>{proximo ? <Link href={`/responsabilidades/${proximo.id}`}>{proximo.title}</Link> : <span>Nada pendente</span>}</p>
                    <p><CalendarClock aria-hidden />{reuniao ? <span>{reuniao.title} · {rotuloData(hojeISO(new Date(reuniao.starts_at)), hoje)}, {horaDe(reuniao.starts_at)}</span> : <span>Nenhuma reunião marcada</span>}</p>
                    {cobrarHoje.length > 0 && <p><Hourglass aria-hidden /><span>{cobrarHoje.length} {cobrarHoje.length === 1 ? "retorno para cobrar hoje" : "retornos para cobrar hoje"}</span></p>}
                    {rotinasHoje.length > 0 && <p><span>Hoje: {rotinasHoje.map((r) => r.title).join(", ")}</span></p>}
                  </div>
                </article>
              );
            })}
          </div>

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
              <h2 className="sec__h"><Scale size={15} aria-hidden style={{ marginRight: 6, verticalAlign: -2 }} />Para decidir <em>{decisoes.length}</em></h2>
              {decisoes.length ? <Lista itens={decisoes} contextos={empresas} /> : <p className="bloco__vazio">Nenhuma decisão pendente nas empresas.</p>}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
