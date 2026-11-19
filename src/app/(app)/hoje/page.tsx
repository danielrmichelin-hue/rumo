import { ChevronRight, GraduationCap } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ListaResponsabilidades } from "@/components/ListaResponsabilidades";
import { BotaoNova, ProximoPasso } from "@/components/ProximoPasso";
import { agoraHora, dataPorExtenso, fimDoDia, hojeISO, horaDe, inicioDoDia, saudacao } from "@/lib/datas";
import { montarHoje, resumoDoDia } from "@/lib/hoje";
import { CAMPOS_LISTA, type Compromisso, type Responsabilidade } from "@/lib/tipos";
import Link from "next/link";
import { Anel, Caminho } from "@/components/Caminho";
import { CAMPOS_MARCO, CAMPOS_ROTA, type Marco, normalizar, resumirRota } from "@/lib/rotas";
import { AZUL_ESTUDO, CAMPOS_CURSO, CAMPOS_MATERIA, CAMPOS_SESSAO, CAMPOS_TEMA, horas, resumoDoCiclo, temasDa, type Curso, type Materia, type Sessao, type Tema } from "@/lib/estudos";
import { CAMPOS_ROTINA, desdeMarcas, feitaEm, hora, type Marcacao, mesDaRotina, type Rotina, rotinasDoDia, semanaDaRotina } from "@/lib/rotinas";
import { ChecarRotina } from "@/components/Rotinas";
import { Repeat } from "lucide-react";

export const metadata = { title: "Hoje" };

export default async function Page() {
  const supabase = await createClient();
  const hoje = hojeISO();
  const agora = agoraHora();
  // Brasil sem horário de verão: o dia em São Paulo vai de 00:00 a 23:59 em -03:00
  const inicio = inicioDoDia(hoje);
  const fim = fimDoDia(hoje);

  const [{ data: perfil }, { data: contextos }, { data: projetos }, { data: abertas }, { data: feitas }, { data: eventos }, { data: rotasDb }, { data: marcosDb }, { data: rotinasDb }, { data: marcasDb }, { data: cursosDb }, { data: materiasDb }] = await Promise.all([
    supabase.from("profiles").select("display_name").maybeSingle(),
    supabase.from("contexts").select("id, name, color, kind").order("position"),
    supabase.from("projects").select("id, name"),
    supabase.from("responsibilities").select(CAMPOS_LISTA).neq("state", "concluida"),
    supabase.from("responsibilities").select(CAMPOS_LISTA).eq("state", "concluida").gte("done_at", inicio).order("done_at"),
    supabase.from("events").select("id, title, context_id, starts_at, ends_at, location, course_id, done_at").gte("starts_at", inicio).lte("starts_at", fim).order("starts_at"),
    supabase.from("routes").select(CAMPOS_ROTA).eq("status", "ativa").order("created_at"),
    supabase.from("route_milestones").select(CAMPOS_MARCO),
    supabase.from("routines").select(CAMPOS_ROTINA).eq("status", "ativa").order("position"),
    supabase.from("routine_checks").select("routine_id, done_on").gte("done_on", desdeMarcas(hoje)),
    supabase.from("study_courses").select(CAMPOS_CURSO).eq("status", "ativo").order("created_at"),
    supabase.from("study_subjects").select(CAMPOS_MATERIA).order("position"),
  ]);
  // Estudos: a matéria da vez em cada ciclo (some quando já há sessão de estudo marcada para hoje)
  const cursos = (cursosDb ?? []) as Curso[];
  const materias = (materiasDb ?? []) as Materia[];
  const [{ data: sessoesDb }, { data: temasDb }] = cursos.length
    ? await Promise.all([
        supabase.from("events").select(CAMPOS_SESSAO).not("course_id", "is", null).gte("starts_at", inicioDoDia(cursos.map((c) => c.cycle_started_on).sort()[0])),
        materias.length ? supabase.from("study_topics").select(CAMPOS_TEMA).in("subject_id", materias.map((m) => m.id)).is("done_at", null) : Promise.resolve({ data: [] }),
      ])
    : [{ data: [] }, { data: [] }];
  const sessoes = (sessoesDb ?? []) as Sessao[];
  const estudos = cursos
    .map((c) => ({ c, ciclo: resumoDoCiclo(c, materias.filter((m) => m.course_id === c.id), sessoes) }))
    .filter(({ c, ciclo }) => ciclo.proxima && !ciclo.completo && !sessoes.some((s) => s.course_id === c.id && hojeISO(new Date(s.starts_at)) === hoje && !s.done_at))
    .map(({ c, ciclo }) => ({ c, linha: ciclo.proxima!, tema: temasDa(ciclo.proxima!.materia, (temasDb ?? []) as Tema[]).proximo }));
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
  const marcas = (marcasDb ?? []) as Marcacao[];
  const rotinas = rotinasDoDia((rotinasDb ?? []) as Rotina[], marcas, hoje);
  const vazio = !dia.proximo && !dia.atencao.length && !doDiaComFeitas.length && !rotinas.length && !estudos.length;
  const proximoEvento = dia.agenda.find((e) => !e.done_at && horaDe(e.starts_at) >= agora);

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
            <p className="today__sum">{resumoDoDia(dia, rotinas.filter((r) => !feitaEm(r, marcas, hoje)).length, estudos.length)}</p>
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

          {estudos.length > 0 && (
            <section className="sec" aria-labelledby="sec-estudos">
              <h2 className="sec__h" id="sec-estudos">Estudos <em>{estudos.length}</em></h2>
              <ul className="list">
                {estudos.map(({ c, linha, tema }) => (
                  <li key={c.id} className="row">
                    <GraduationCap className="row__ic" aria-hidden style={{ color: linha.materia.color }} />
                    <div className="row__body">
                      <Link href={`/estudos/${c.id}`} className="row__t">{linha.materia.title}{tema ? ` · ${tema.title}` : ""}</Link>
                      <span className="props">
                        <span className="prop">{c.title} · ciclo {c.current_cycle}</span>
                        {linha.meta && <span className="prop">faltam {horas(linha.meta - linha.feito)} dela no ciclo</span>}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {rotinas.length > 0 && (
            <section className="sec" aria-labelledby="sec-rotinas">
              <h2 className="sec__h" id="sec-rotinas">Rotinas <em>{rotinas.filter((r) => !feitaEm(r, marcas, hoje)).length}</em><Link href="/rotinas" className="sec__act">Ver a semana</Link></h2>
              <ul className="list">
                {rotinas.map((r) => {
                  const feita = feitaEm(r, marcas, hoje);
                  const s = semanaDaRotina(r, marcas, hoje);
                  return (
                    <li key={r.id} className="row" data-feita={feita || undefined}>
                      <ChecarRotina rotina={r} feita={feita} />
                      <div className="row__body">
                        <span className="row__t">{r.title}</span>
                        <span className="props">
                          <span className="prop"><Repeat aria-hidden />Rotina · {r.month_day ? mesDaRotina(r, marcas, hoje).texto : s.texto}</span>
                          {r.at_time && <span className="prop">{hora(r.at_time)}{r.duration_min ? ` · ${r.duration_min} min` : ""}</span>}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
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
                  const hora = horaDe(e.starts_at);
                  const c = ctx.find((x) => x.id === e.context_id);
                  const passou = (e.ends_at ? horaDe(e.ends_at) : hora) < agora || !!e.done_at;
                  const estudo = !!e.course_id;
                  return (
                    <div key={e.id}>
                      {e.id === proximoEvento?.id && <div className="nowline" aria-hidden />}
                      <div className={`ag${e.id === proximoEvento?.id ? " ag--next" : ""}${passou ? " ag--past" : ""}`}>
                        <time>{hora}</time>
                        <div>
                          {estudo ? <Link href={`/estudos/${e.course_id}`}><b>{e.title}</b></Link> : <b>{e.title}</b>}
                          {estudo ? (
                            <small><i className="dot" style={{ background: AZUL_ESTUDO }} />Estudo{e.done_at ? " · concluída" : ""}</small>
                          ) : (c || e.location) && <small>{c && <><i className="dot" style={{ background: c.color }} />{c.name}</>}{e.location && ` · ${e.location}`}</small>}
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
