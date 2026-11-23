import { GraduationCap, Pill, Repeat, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Lista } from "@/components/Lista";
import { BotaoNova, ProximoPasso } from "@/components/ProximoPasso";
import { agoraHora, dataPorExtenso, fimDoDia, hojeISO, horaDe, inicioDoDia, saudacao } from "@/lib/datas";
import { montarHoje, resumoDoDia } from "@/lib/hoje";
import { CAMPOS_LISTA, type Compromisso, type Responsabilidade } from "@/lib/tipos";
import Link from "next/link";
import { Anel } from "@/components/Caminho";
import { CAMPOS_MARCO, CAMPOS_ROTA, type Marco, normalizar, resumirRota } from "@/lib/rotas";
import { AZUL_ESTUDO, linhaDoEstudo, CAMPOS_CURSO, CAMPOS_MATERIA, CAMPOS_SESSAO, CAMPOS_TEMA, horas, resumoDoCiclo, temasDa, type Curso, type Materia, type Sessao, type Tema } from "@/lib/estudos";
import { CAMPOS_ROTINA, desdeMarcas, feitaEm, hora, type Marcacao, mesDaRotina, type Rotina, rotinasDoDia, semanaDaRotina } from "@/lib/rotinas";
import { ChecarRotina } from "@/components/Rotinas";
import { Logo } from "@/components/Logo";
import { Children } from "react";
import { RevisoesDoDia } from "@/components/Aulas";
import { CAMPOS_PARCELAMENTO, moeda, normalizarParcelamento, parcelasDoCiclo } from "@/lib/financas";

export const metadata = { title: "Hoje" };

export default async function Page() {
  const supabase = await createClient();
  const hoje = hojeISO();
  const agora = agoraHora();
  // Brasil sem horário de verão: o dia em São Paulo vai de 00:00 a 23:59 em -03:00
  const inicio = inicioDoDia(hoje);
  const fim = fimDoDia(hoje);

  const [{ data: { user } }, { data: perfil }, { data: contextos }, { data: projetos }, { data: abertas }, { data: feitas }, { data: eventos }, { data: rotasDb }, { data: marcosDb }, { data: rotinasDb }, { data: marcasDb }, { data: cursosDb }, { data: materiasDb }, { data: parcDb }] = await Promise.all([
    supabase.auth.getUser(),
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
    supabase.from("fin_installments").select(CAMPOS_PARCELAMENTO),
  ]);
  // Parcelas que vencem hoje ou já venceram e ainda não foram pagas
  const parcelasHoje = parcelasDoCiclo((parcDb ?? []).map(normalizarParcelamento), "0000-01-01", hoje, hoje);
  // Estudos: a matéria da vez em cada ciclo (some quando já há sessão de estudo marcada para hoje)
  const cursos = (cursosDb ?? []) as Curso[];
  const materias = (materiasDb ?? []) as Materia[];
  const [{ data: sessoesDb }, { data: temasDb }, { data: revisoesDb }] = cursos.length
    ? await Promise.all([
        supabase.from("events").select(CAMPOS_SESSAO).not("course_id", "is", null).gte("starts_at", inicioDoDia(cursos.map((c) => c.cycle_started_on).sort()[0])),
        materias.length ? supabase.from("study_topics").select(CAMPOS_TEMA).in("subject_id", materias.map((m) => m.id)).is("done_at", null) : Promise.resolve({ data: [] }),
        supabase.from("study_topics").select(CAMPOS_TEMA).lte("next_review_on", hoje).order("next_review_on"),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];
  const revisoes = ((revisoesDb ?? []) as Tema[]).filter((t) => materias.some((m) => m.id === t.subject_id));
  const cursoDaMateria = (m: Materia) => cursos.find((c) => c.id === m.course_id)?.title ?? "";
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
  const nome = perfil?.display_name || (user?.email ?? "").split("@")[0];
  const primeiroNome = nome.split(/\s+/)[0];
  const doDiaComFeitas = [...dia.doDia, ...dia.concluidasHoje];
  const marcas = (marcasDb ?? []) as Marcacao[];
  const rotinas = rotinasDoDia((rotinasDb ?? []) as Rotina[], marcas, hoje);
  const proximoEvento = dia.agenda.find((e) => !e.done_at && horaDe(e.starts_at) >= agora);
  // Linha do dia (6h às 24h): compromissos como faixas, rotinas com horário como pontos, e o agora
  const minutos = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
  const naLinha = (hhmm: string) => Math.max(0, Math.min(100, ((minutos(hhmm) - 360) / 1080) * 100));
  const numeros = [
    { n: dia.numeros.atrasadas, rotulo: dia.numeros.atrasadas === 1 ? "atrasada" : "atrasadas", href: "#atencao", quente: true },
    { n: dia.doDia.length, rotulo: "para hoje", href: "#hoje" },
    { n: dia.agenda.length, rotulo: "na agenda", href: "#agenda" },
    { n: parcelasHoje.length, rotulo: "para pagar", href: "/financas" },
  ];

  return (
    <div className="page page--wide">
      <section className="palco" aria-label="O seu dia">
        <div className="palco__topo">
          <div>
            <p className="palco__data">{dataPorExtenso(hoje)}</p>
            <h1 className="palco__t">{saudacao(agora)}, {primeiroNome}</h1>
            <p className="palco__resumo">{resumoDoDia(dia, rotinas.filter((r) => !feitaEm(r, marcas, hoje)).length, estudos.length)}</p>
          </div>
          <div className="hide-mobile"><BotaoNova /></div>
        </div>

        <div className="linha-dia" aria-hidden>
          <div className="linha-dia__trilho">
            <i className="linha-dia__feito" style={{ width: `${naLinha(agora)}%` }} />
            {dia.agenda.map((e) => (
              <i key={e.id} className="linha-dia__ev" style={{ left: `${naLinha(horaDe(e.starts_at))}%`, width: `max(6px, ${naLinha(e.ends_at ? horaDe(e.ends_at) : horaDe(e.starts_at)) - naLinha(horaDe(e.starts_at))}%)` }} title={`${horaDe(e.starts_at)} ${e.title}`} />
            ))}
            {rotinas.filter((r) => r.at_time && !feitaEm(r, marcas, hoje)).map((r) => <i key={r.id} className="linha-dia__rot" style={{ left: `${naLinha(r.at_time!.slice(0, 5))}%` }} />)}
            <i className="linha-dia__agora" style={{ left: `${naLinha(agora)}%` }}><span>{agora}</span></i>
          </div>
          <div className="linha-dia__horas"><span>6h</span><span>12h</span><span>18h</span><span>24h</span></div>
        </div>

        <ul className="palco__nums">
          {numeros.map((x) => (
            <li key={x.rotulo}><Link href={x.href} className={x.quente && x.n > 0 ? "is-quente" : undefined}><b>{x.n}</b><span>{x.rotulo}</span></Link></li>
          ))}
        </ul>

      {dia.proximo ? (
        <ProximoPasso
          proximo={dia.proximo}
          contextos={ctx}
          projeto={dia.proximo.tipo === "responsabilidade" && dia.proximo.item.project_id ? nomesProjetos[dia.proximo.item.project_id] : undefined}
          rota={dia.proximo.tipo === "responsabilidade" && dia.proximo.item.route_id ? mapaRotas[dia.proximo.item.route_id] : undefined}
        />
      ) : (
        <section className="next next--calmo" aria-label="Próximo passo">
          <div>
            <span className="next__k"><Logo forma="simbolo" />Próximo passo</span>
            <span className="next__t">Nada urgente agora.</span>
            <p className="next__p">Bom momento para o que não tem prazo.</p>
          </div>
          <div className="next__act"><BotaoNova rotulo="Capturar" variante="btn btn--line" /></div>
        </section>
      )}
      </section>

      <div className="painel">
        <div className="painel__col">
          <Bloco id="atencao" titulo="Atenção" n={dia.atencao.length} alerta={dia.numeros.atrasadas > 0} vazio="Nada atrasado e nenhum retorno para cobrar hoje.">
            {dia.atencao.length > 0 && <Lista itens={dia.atencao} contextos={ctx} projetos={nomesProjetos} rotas={mapaRotas} cobravel />}
          </Bloco>
          <Bloco id="hoje" titulo="Hoje" n={dia.doDia.length} acao={doDiaComFeitas.length ? <span className="sec__act">Por horário</span> : null} vazio="Nada com prazo para hoje.">
            {doDiaComFeitas.length > 0 && <Lista itens={doDiaComFeitas} contextos={ctx} projetos={nomesProjetos} rotas={mapaRotas} semHoje />}
          </Bloco>
          <Bloco titulo="Aguardando alguém" n={dia.aguardando.length} acao={dia.aguardando.length > 4 ? <Link href="/responsabilidades?estado=aguardando" className="sec__act">Ver todos</Link> : null} vazio="Ninguém te deve retorno agora.">
            {dia.aguardando.length > 0 && <Lista itens={dia.aguardando.slice(0, 4)} contextos={ctx} projetos={nomesProjetos} rotas={mapaRotas} />}
          </Bloco>
        </div>

        <div className="painel__col">
          <Bloco id="agenda" titulo="Agenda" n={dia.agenda.length} acao={<Link href="/calendario" className="sec__act">Calendário</Link>} vazio="Nenhum compromisso hoje.">
            {dia.agenda.length > 0 && (
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
          </Bloco>

          <Bloco titulo={rotinas.some((r) => r.dose) ? "Rotinas e remédios" : "Rotinas"} n={rotinas.filter((r) => !feitaEm(r, marcas, hoje)).length} acao={<Link href="/rotinas" className="sec__act">Rotinas</Link>} vazio="Nenhuma rotina para hoje.">
              {rotinas.length > 0 && (
                <ul className="list">
                  {rotinas.map((r) => {
                    const feita = feitaEm(r, marcas, hoje);
                    const sem = semanaDaRotina(r, marcas, hoje);
                    return (
                      <li key={r.id} className="row" data-feita={feita || undefined}>
                        <ChecarRotina rotina={r} feita={feita} />
                        <div className="row__body">
                          <span className="row__t">{r.title}</span>
                          <span className="props">
                            {r.dose ? <span className="prop"><Pill aria-hidden />Remédio · {r.dose}</span> : <span className="prop"><Repeat aria-hidden />{r.month_day ? mesDaRotina(r, marcas, hoje).texto : sem.texto}</span>}
                            {r.amount ? <span className="prop">{moeda(Number(r.amount))}</span> : null}
                            {r.at_time && <span className="prop">{hora(r.at_time)}</span>}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Bloco>

          {parcelasHoje.length > 0 && (
            <Bloco titulo="Para pagar" n={parcelasHoje.length} acao={<Link href="/financas" className="sec__act">Finanças</Link>} vazio="">
              <Link href="/financas" className="pagar-hoje">
                <Wallet aria-hidden />
                <span>
                  <b>{parcelasHoje.length === 1 ? `Parcela de ${parcelasHoje[0].p.title}` : `${parcelasHoje.length} parcelas`} · {moeda(parcelasHoje.reduce((t, x) => t + x.s.parcela, 0))}</b>
                  <small>{parcelasHoje.map((x) => x.p.title).slice(0, 4).join(", ")}{parcelasHoje.length > 4 ? "…" : ""}{parcelasHoje.some((x) => x.vence < hoje) ? " · algumas desde antes" : " · vencem hoje"}</small>
                </span>
              </Link>
            </Bloco>
          )}

          <Bloco titulo="Estudos" n={estudos.length + revisoes.length} acao={<Link href="/estudos" className="sec__act">Estudos</Link>} vazio={cursos.length ? "Sessão de estudo já marcada para hoje, ou ciclo completo." : "Monte o seu ciclo de estudos para ver aqui a matéria da vez."}>
              {revisoes.length > 0 && <RevisoesDoDia temas={revisoes} materias={materias} cursoDe={cursoDaMateria} />}
              {estudos.length > 0 && (
                <ul className="list">
                  {estudos.map(({ c, linha, tema }) => (
                    <li key={c.id} className="row">
                      <GraduationCap className="row__ic" aria-hidden style={{ color: linha.materia.color }} />
                      <div className="row__body">
                        <Link href={`/estudos/${c.id}`} className="row__t">{linha.materia.title}{tema ? ` · ${tema.title}` : ""}</Link>
                        <span className="props">
                          <span className="prop">{c.title}</span>
                          {linha.meta && <span className="prop">faltam {horas(linha.meta - linha.feito)} no ciclo</span>}
                          {c.exam_date && <span className="prop prop--today">{linhaDoEstudo(c, hoje).split(" · ")[0]}</span>}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Bloco>

          <Bloco titulo="Rotas" n={rotas.length} acao={<Link href="/rotas" className="sec__act">Rotas</Link>} vazio="Nenhuma Rota em andamento.">
              {rotas.length > 0 && (
                <div className="agenda">
                  {rotas.slice(0, 4).map(({ r, resumo }) => (
                    <Link key={r.id} href={`/rotas/${r.id}`} className="ag" style={{ gridTemplateColumns: "20px minmax(0,1fr)" }}>
                      <span style={{ paddingTop: 3 }}><Anel pct={resumo.pct} /></span>
                      <div><b>{r.title}</b><small>{resumo.linha}</small></div>
                    </Link>
                  ))}
                </div>
              )}
            </Bloco>
        </div>
      </div>

      <p className="list-foot hide-mobile" aria-hidden>
        <span><kbd>C</kbd> capturar</span>
        <span><kbd>⌘K</kbd> buscar</span>
      </p>
    </div>
  );
}

/** Um bloco do painel: sempre no mesmo lugar; vazio vira uma linha só */
function Bloco({ id, titulo, n, acao, vazio, alerta = false, children }: { id?: string; titulo: string; n: number; acao?: React.ReactNode; vazio: string; alerta?: boolean; children?: React.ReactNode }) {
  return (
    <section id={id} className={`bloco${alerta ? " bloco--alerta" : ""}`}>
      <h2 className="sec__h">{titulo}{n > 0 && <em>{n}</em>}{acao}</h2>
      {Children.toArray(children).length ? children : <p className="bloco__vazio">{vazio}</p>}
    </section>
  );
}
