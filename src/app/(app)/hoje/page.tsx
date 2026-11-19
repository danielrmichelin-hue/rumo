import { ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ListaResponsabilidades } from "@/components/ListaResponsabilidades";
import { BotaoNova, ProximoPasso } from "@/components/ProximoPasso";
import { agoraHora, dataPorExtenso, hojeISO, saudacao } from "@/lib/datas";
import { horaSP, montarHoje, resumoDoDia } from "@/lib/hoje";
import { CAMPOS_LISTA, type Compromisso, type Responsabilidade } from "@/lib/tipos";
import Link from "next/link";
import { Anel, Caminho } from "@/components/Caminho";
import { CAMPOS_ROTA, normalizar, resumirRota, type Marco } from "@/lib/rotas";

export const metadata = { title: "Hoje" };

export default async function Page() {
  const supabase = await createClient();
  const hoje = hojeISO();
  const agora = agoraHora();
  // Brasil sem horário de verão: o dia em São Paulo vai de 00:00 a 23:59 em -03:00
  const inicio = new Date(`${hoje}T00:00:00-03:00`).toISOString();
  const fim = new Date(`${hoje}T23:59:59.999-03:00`).toISOString();

  const [{ data: perfil }, { data: contextos }, { data: projetos }, { data: abertas }, { data: feitas }, { data: eventos }, { data: rotasDb }, { data: marcosDb }] = await Promise.all([
    supabase.from("profiles").select("display_name").maybeSingle(),
    supabase.from("contexts").select("id, name, color, kind").order("position"),
    supabase.from("projects").select("id, name"),
    supabase.from("responsibilities").select(CAMPOS_LISTA).neq("state", "concluida"),
    supabase.from("responsibilities").select(CAMPOS_LISTA).eq("state", "concluida").gte("done_at", inicio).order("done_at"),
    supabase.from("events").select("id, title, context_id, starts_at, ends_at, location").gte("starts_at", inicio).lte("starts_at", fim).order("starts_at"),
    supabase.from("routes").select(CAMPOS_ROTA).eq("status", "ativa").order("created_at"),
    supabase.from("route_milestones").select("id, route_id, title, position, due_date, done_at"),
  ]);
  const rotas = (rotasDb ?? []).map((x) => {
    const r = normalizar(x);
    return { r, resumo: resumirRota(r, ((marcosDb ?? []) as Marco[]).filter((m) => m.route_id === r.id), hoje) };
  });
  const mapaRotas = Object.fromEntries(rotas.map(({ r, resumo }) => [r.id, { title: r.title, pct: resumo.pct }]));

  const ctx = contextos ?? [];
  const nomesProjetos = Object.fromEntries((projetos ?? []).map((p) => [p.id, p.name]));
  const dia = montarHoje((abertas ?? []) as Responsabilidade[], (feitas ?? []) as Responsabilidade[], (eventos ?? []) as Compromisso[], hoje, agora);
  const { data: { user } } = await supabase.auth.getUser();
  const nome = perfil?.display_name || (user?.email ?? "").split("@")[0];
  const primeiroNome = nome.split(/\s+/)[0];
  const doDiaComFeitas = [...dia.doDia, ...dia.concluidasHoje];
  const vazio = !dia.proximo && !dia.atencao.length && !doDiaComFeitas.length;
  const proximoEvento = dia.agenda.find((e) => horaSP(e.starts_at) >= agora);

  return (
    <div className="page page--wide">
      <div className="page__head">
        <div>
          <p className="crumb">Hoje · {dataPorExtenso(hoje)}</p>
        </div>
        <div className="page__actions hide-mobile"><BotaoNova /></div>
      </div>

      <div className="today">
        <div className="today__main">
          <header>
            <p className="today__hello">{saudacao(agora)}, {primeiroNome}</p>
            <h1 className="page__t">O que precisa da sua atenção agora</h1>
            <p className="today__sum">{resumoDoDia(dia)}</p>
          </header>

          {dia.proximo && (
            <ProximoPasso
              proximo={dia.proximo}
              contextos={ctx}
              projeto={dia.proximo.tipo === "responsabilidade" && dia.proximo.item.project_id ? nomesProjetos[dia.proximo.item.project_id] : undefined}
              rota={dia.proximo.tipo === "responsabilidade" && dia.proximo.item.route_id ? mapaRotas[dia.proximo.item.route_id] : undefined}
            />
          )}

          {dia.atencao.length > 0 && (
            <section className="sec" aria-labelledby="sec-atencao">
              <h2 className="sec__h" id="sec-atencao">Atenção <em>{dia.atencao.length}</em></h2>
              <ListaResponsabilidades itens={dia.atencao} contextos={ctx} projetos={nomesProjetos} rotas={mapaRotas} cobravel />
            </section>
          )}

          {doDiaComFeitas.length > 0 && (
            <section className="sec" aria-labelledby="sec-hoje">
              <h2 className="sec__h" id="sec-hoje">Hoje <em>{dia.doDia.length}</em><span className="sec__act">Por horário</span></h2>
              <ListaResponsabilidades itens={doDiaComFeitas} contextos={ctx} projetos={nomesProjetos} rotas={mapaRotas} semHoje />
            </section>
          )}

          {vazio && (
            <div className="empty">
              <b>Nada pendente nesta etapa.</b>
              Capture o que estiver na cabeça: aperte C ou o botão Capturar. O que tiver data aparece aqui no dia.
            </div>
          )}

          {dia.aguardando.length > 0 && (
            <details className="sec fold">
              <summary className="sec__h"><ChevronRight aria-hidden />Aguardando alguém <em>{dia.aguardando.length}</em></summary>
              <ListaResponsabilidades itens={dia.aguardando} contextos={ctx} projetos={nomesProjetos} rotas={mapaRotas} />
            </details>
          )}

          <p className="list-foot hide-mobile" aria-hidden>
            <span><kbd>C</kbd> capturar</span>
            <span><kbd>⌘K</kbd> buscar</span>
          </p>
        </div>

        <aside className="today__aside" aria-label="Agenda do dia">
          <section className="sec">
            <h2 className="sec__h">Agenda</h2>
            {dia.agenda.length === 0 ? (
              <p className="empty" style={{ paddingTop: 4 }}>Nenhum compromisso hoje.</p>
            ) : (
              <div className="agenda">
                {dia.agenda.map((e) => {
                  const hora = horaSP(e.starts_at);
                  const c = ctx.find((x) => x.id === e.context_id);
                  const passou = (e.ends_at ? horaSP(e.ends_at) : hora) < agora;
                  return (
                    <div key={e.id}>
                      {e.id === proximoEvento?.id && <div className="nowline" aria-hidden />}
                      <div className={`ag${e.id === proximoEvento?.id ? " ag--next" : ""}${passou ? " ag--past" : ""}`}>
                        <time>{hora}</time>
                        <div>
                          <b>{e.title}</b>
                          {(c || e.location) && <small>{c && <><i className="dot" style={{ background: c.color }} />{c.name}</>}{e.location && ` · ${e.location}`}</small>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {rotas.length > 0 && (
            <section className="sec">
              <h2 className="sec__h">Rotas em andamento</h2>
              <div style={{ display: "grid", gap: 10 }}>
                {rotas.slice(0, 3).map(({ r, resumo }) => (
                  <Link key={r.id} href={`/rotas/${r.id}`} className="route" style={{ padding: 14, gap: 10 }}>
                    <span className="route__k" style={{ color: "var(--text)", fontSize: 14, fontWeight: 500 }}><Anel pct={resumo.pct} />{r.title}</span>
                    <Caminho pct={resumo.pct} />
                    <span className="route__line">{r.kind === "financeiro" ? `${resumo.agora.split(" de ")[0]} guardados · ` : ""}{resumo.linha}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
