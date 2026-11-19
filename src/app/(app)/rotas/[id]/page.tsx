import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight, BookOpen, Building2, ChevronRight, GraduationCap, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Anel, Caminho } from "@/components/Caminho";
import {
  AceitarRitmo, AdicionarPassoRota, ApagarMarco, ConcluirMarco, DesfazerRegistro, EscolhaRecalculo, FormRota, NovoMarco,
  PassoSugerido, RegistrarAvanco,
} from "@/components/ControlesRota";
import { ListaResponsabilidades } from "@/components/ListaResponsabilidades";
import { hojeISO, rotuloData } from "@/lib/datas";
import { CAMPOS_ROTA, mesAno, normalizar, PREFIXO_PASSO, resumirRota, textoValor, TIPOS, type Marco, type TipoRota } from "@/lib/rotas";
import { CAMPOS_LISTA, ordenar, type Responsabilidade } from "@/lib/tipos";

export const metadata = { title: "Rota" };

const ICONES: Record<TipoRota, typeof Wallet> = { financeiro: Wallet, leitura: BookOpen, estudos: GraduationCap, negocios: Building2 };
const EXEMPLO_PASSO: Record<TipoRota, string> = {
  financeiro: "Novo passo, ex.: Cancelar a assinatura que não uso",
  leitura: "Novo passo, ex.: Ler o capítulo 5 sábado",
  estudos: "Novo passo, ex.: Revisar o módulo 3 quinta 19h",
  negocios: "Novo passo deste marco, ex.: Publicar as vagas sexta",
};

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const hoje = hojeISO();
  const supabase = await createClient();
  const [{ data: dados }, { data: marcosDb }, { data: passosDb }, { data: entradas }, { data: outras }, { data: todosMarcos }, { data: contextos }] = await Promise.all([
    supabase.from("routes").select(CAMPOS_ROTA).eq("id", id).maybeSingle(),
    supabase.from("route_milestones").select("id, route_id, title, position, due_date, done_at").eq("route_id", id).order("position"),
    supabase.from("responsibilities").select(CAMPOS_LISTA + ", milestone_id").eq("route_id", id),
    supabase.from("route_entries").select("id, amount, note, happened_on, created_at").eq("route_id", id).order("created_at", { ascending: false }).limit(12),
    supabase.from("routes").select(CAMPOS_ROTA).neq("id", id).eq("status", "ativa").order("created_at"),
    supabase.from("route_milestones").select("id, route_id, title, position, due_date, done_at"),
    supabase.from("contexts").select("id, name, color, kind").eq("archived", false).order("position"),
  ]);
  if (!dados) notFound();

  const rota = normalizar(dados);
  const marcos = (marcosDb ?? []) as Marco[];
  const resumo = resumirRota(rota, marcos, hoje);
  const passos = ((passosDb ?? []) as unknown as (Responsabilidade & { milestone_id: string | null })[]).sort(ordenar);
  const abertos = passos.filter((p) => p.state !== "concluida");
  const feitos = passos.filter((p) => p.state === "concluida");
  const ctx = contextos ?? [];
  const contexto = ctx.find((c) => c.id === rota.context_id);
  const Icon = ICONES[rota.kind];
  const atual = marcos.find((m) => !m.done_at) ?? null;
  const passosDoAtual = atual ? passos.filter((p) => p.milestone_id === atual.id) : [];
  const jaSugerido = resumo.sugestao && abertos.some((p) => p.title === resumo.sugestao!.title);
  const prefixo = PREFIXO_PASSO[rota.kind];
  const passoAntigo = !jaSugerido && prefixo ? abertos.find((p) => p.title.startsWith(prefixo)) : undefined;
  const outrasRotas = (outras ?? []).map(normalizar);

  const quandoMarco = (m: Marco) => (m.done_at ? `Concluído em ${mesAno(hojeISO(new Date(m.done_at))).split(" de ")[0]}` : m.due_date ? `Até ${rotuloData(m.due_date, hoje)}` : m === atual ? "Agora" : "");

  return (
    <div className="page page--wide">
      <div className="page__head">
        <div style={{ flex: 1, minWidth: 0 }}>
          <p className="crumb"><Link href="/rotas">Rotas</Link><ChevronRight aria-hidden />{rota.title}</p>
        </div>
      </div>

      <section className="route-hero">
        <p className="route__k"><Icon aria-hidden />{resumo.destino ?? TIPOS[rota.kind].nome}{contexto && <> · <i className="dot" style={{ background: contexto.color }} />{contexto.name}</>}{rota.status === "pausada" && " · pausada"}</p>
        <h1 className="page__t">{rota.title}</h1>
        {rota.kind === "negocios" ? (
          <>
            <p className="page__sub" style={{ marginTop: -8 }}>{resumo.situacao}</p>
            {marcos.length > 0 && (
              <div className="miles" style={{ "--done": `${marcos.length > 1 ? (marcos.filter((m) => m.done_at).length / (marcos.length - 1)) * 100 : 0}%` } as React.CSSProperties}>
                {marcos.map((m) => (
                  <span key={m.id} className={`mile${m.done_at ? " is-done" : m === atual ? " is-now" : ""}`}>
                    <i /><b>{m.title}</b><small>{quandoMarco(m)}</small>
                  </span>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <p className="route-pct"><b>{Math.round(resumo.pct * 100)}%</b><span>{resumo.agora}</span></p>
            <Caminho pct={resumo.pct} />
          </>
        )}
      </section>

      {resumo.recalculo && (
        <div className="recalc" role="status" style={{ marginBottom: 24 }}>
          <span>A Rota foi recalculada: <b>{resumo.ritmo}</b>, mesmo destino. Antes eram {resumo.antes}.</span>
          {resumo.escolha ? (
            <>
              <span>Quer manter {resumo.escolha.manter} ou mover a chegada para {resumo.escolha.mover}?</span>
              <EscolhaRecalculo routeId={rota.id} manter={resumo.escolha.manter} mover={resumo.escolha.mover} novaData={resumo.escolha.novaData} />
            </>
          ) : (
            <div className="recalc__act"><AceitarRitmo routeId={rota.id} /></div>
          )}
        </div>
      )}

      <div className="route-cols">
        <div>
          {rota.kind === "negocios" ? (
            atual ? (
              <section className="sec">
                <h2 className="sec__h">Marco atual · {atual.title} <em>{passosDoAtual.filter((p) => p.state === "concluida").length} de {passosDoAtual.length} passos</em></h2>
                {passosDoAtual.length > 0 ? (
                  <ListaResponsabilidades itens={passosDoAtual} contextos={ctx} comContexto={false} />
                ) : (
                  <p className="empty">Quais são os passos deste marco? Poucos e concretos, com data quando fizer sentido.</p>
                )}
                <AdicionarPassoRota routeId={rota.id} marcoId={atual.id} exemplo={EXEMPLO_PASSO.negocios} />
                <p className="field__hint" style={{ padding: "0 10px 12px", display: "flex", alignItems: "center", gap: 6 }}><ArrowUpRight size={14} aria-hidden />Passos com data aparecem no Hoje no dia.</p>
                <ConcluirMarco id={atual.id} titulo={atual.title} feito={false} />
              </section>
            ) : (
              <div className="empty"><b>{marcos.length ? "Todos os marcos concluídos." : "Nenhum marco ainda."}</b>{marcos.length ? "Destino alcançado. Se quiser, marque a Rota como concluída nos detalhes." : "Defina as etapas que mostram avanço até o destino."}</div>
            )
          ) : (
            <section className="sec">
              <h2 className="sec__h">Próximos passos · vão para o Hoje <em>{abertos.length}</em></h2>
              {resumo.sugestao && !jaSugerido && rota.status === "ativa" && (
                <div style={{ marginBottom: 8 }}><PassoSugerido routeId={rota.id} titulo={resumo.sugestao.title} quando={passoAntigo ? `substitui "${passoAntigo.title}"` : resumo.sugestao.quando} atualizar={!!passoAntigo} /></div>
              )}
              {abertos.length > 0 && <ListaResponsabilidades itens={abertos} contextos={ctx} comContexto={false} />}
              <AdicionarPassoRota routeId={rota.id} exemplo={EXEMPLO_PASSO[rota.kind]} />
            </section>
          )}

          {rota.kind !== "negocios" && (
            <section className="sec">
              <h2 className="sec__h">Registrar avanço</h2>
              <div style={{ padding: "0 0 8px" }}><RegistrarAvanco routeId={rota.id} kind={rota.kind} /></div>
              {(entradas ?? []).length > 0 && (
                <ul className="list">
                  {(entradas ?? []).map((e, i) => (
                    <li key={e.id} className="row" style={{ gridTemplateColumns: "minmax(0,1fr) auto", alignItems: "center" }}>
                      <span className="row__body">
                        <span className="row__t">{Number(e.amount) > 0 ? "+" : ""}{textoValor(rota.kind, Number(e.amount))}</span>
                        <span className="props"><span className="prop">{rotuloData(e.happened_on, hoje)}</span>{e.note && <span className="prop">{e.note}</span>}</span>
                      </span>
                      {i === 0 && <DesfazerRegistro id={e.id} />}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {rota.kind === "negocios" && marcos.length > 0 && (
            <details className="sec fold">
              <summary className="sec__h"><ChevronRight aria-hidden />Todos os marcos <em>{marcos.length}</em></summary>
              <ul className="list">
                {marcos.map((m) => (
                  <li key={m.id} className="row" style={{ gridTemplateColumns: "minmax(0,1fr) auto", alignItems: "center" }}>
                    <span className="row__body">
                      <span className="row__t">{m.title}</span>
                      <span className="props"><span className="prop">{quandoMarco(m) || "Depois"}</span><span className="prop">{passos.filter((p) => p.milestone_id === m.id).length} passos</span></span>
                    </span>
                    <span className="row__r">
                      {m.done_at && <ConcluirMarco id={m.id} titulo={m.title} feito />}
                      <ApagarMarco id={m.id} />
                    </span>
                  </li>
                ))}
              </ul>
              <NovoMarco routeId={rota.id} />
            </details>
          )}

          {feitos.length > 0 && (
            <details className="sec fold">
              <summary className="sec__h"><ChevronRight aria-hidden />Passos concluídos <em>{feitos.length}</em></summary>
              <ListaResponsabilidades itens={feitos} contextos={ctx} comContexto={false} />
            </details>
          )}
        </div>

        <aside style={{ display: "grid", gap: 20 }}>
          <div className="route-card">
            <small>Ritmo necessário</small>
            <b>{resumo.ritmo ?? "—"}</b>
            <span>{rota.kind === "negocios" ? (resumo.previsao ? `Previsão: ${resumo.previsao}` : "") : resumo.situacao}</span>
          </div>
          {rota.kind !== "negocios" && (
            <div className="route-card"><small>Previsão</small><b>{resumo.previsao ?? "—"}</b></div>
          )}

          {outrasRotas.length > 0 && (
            <section className="sec" style={{ margin: 0 }}>
              <h2 className="sec__h">Outras rotas</h2>
              <div className="agenda">
                {outrasRotas.map((o) => {
                  const r = resumirRota(o, ((todosMarcos ?? []) as Marco[]).filter((m) => m.route_id === o.id), hoje);
                  return (
                    <Link key={o.id} href={`/rotas/${o.id}`} className="ag" style={{ gridTemplateColumns: "20px minmax(0,1fr)" }}>
                      <span style={{ paddingTop: 3 }}><Anel pct={r.pct} /></span>
                      <div><b>{o.title}</b><small>{r.linha}</small></div>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          <details className="card fold">
            <summary className="card__t" style={{ margin: 0, display: "flex", alignItems: "center", gap: 6 }}><ChevronRight aria-hidden />Detalhes da Rota</summary>
            <div style={{ marginTop: 14 }}><FormRota rota={rota} contextos={ctx} /></div>
          </details>
        </aside>
      </div>
    </div>
  );
}
