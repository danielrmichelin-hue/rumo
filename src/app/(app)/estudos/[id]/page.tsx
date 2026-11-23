import Link from "next/link";
import { notFound } from "next/navigation";
import { BookOpen, ChevronRight, Route } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Anel, Caminho } from "@/components/Caminho";
import {
  AgoraNoEstudo, AvancarCiclo, ConfirmarSessao, FormCurso, MaisUmaAula, MarcarSessao, NovaMateria, RegistrarEstudo,
} from "@/components/Estudos";
import { CartaoMateria, RevisoesDoDia } from "@/components/Aulas";
import { ListaNotas, NovaNota } from "@/components/Notas";
import { diaMes, ehId, hojeISO, horaDe, inicioDoDia, somarDias } from "@/lib/datas";
import { NovaProva, RegistrarQuestoes } from "@/components/Desempenho";
import { AbaDesempenho, AbaEdital, AbaProvas, AbaQuestoes } from "./abas";
import { segundaDa } from "@/lib/semana";
import {
  aproveitamento, AZUL_ESTUDO, CAMPOS_QUESTAO, CAMPOS_SIMULADO, contagemProva, pctTexto, tomAcerto, type Questao, type Simulado, CAMPOS_CURSO, CAMPOS_MATERIA, CAMPOS_SESSAO, CAMPOS_TEMA, duracao, emAndamento, horas, linhaDoCiclo, proximaSessao,
  quandoSessao, resumoDoCiclo, revisoesDoDia, semanaEmBarras, sessoesParaConfirmar, temasDa, TIPOS_CURSO, type Curso, type Materia, type Sessao, type Tema,
} from "@/lib/estudos";
import { CAMPOS_NOTA, type Nota } from "@/lib/notas";
import { CAMPOS_ROTA, normalizar, resumirRota } from "@/lib/rotas";

export const metadata = { title: "Estudos" };

const ABAS = [
  { v: "ciclo", r: "Ciclo" },
  { v: "conteudo", r: "Conteúdo" },
  { v: "exercicios", r: "Exercícios" },
  { v: "provas", r: "Provas e notas" },
  { v: "desempenho", r: "Desempenho" },
] as const;

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ aba?: string }> }) {
  const { id } = await params;
  const { aba: abaParam } = await searchParams;
  const aba = ABAS.find((a) => a.v === abaParam)?.v ?? "ciclo";
  if (!ehId(id)) notFound();
  const hoje = hojeISO();
  const supabase = await createClient();
  const [{ data: cursoDb }, { data: materiasDb }, { data: rotasDb }, { data: contextos }, { data: notas }, { data: questoesDb }, { data: simuladosDb }] = await Promise.all([
    supabase.from("study_courses").select(CAMPOS_CURSO).eq("id", id).maybeSingle(),
    supabase.from("study_subjects").select(CAMPOS_MATERIA).eq("course_id", id).order("position"),
    supabase.from("routes").select(CAMPOS_ROTA).eq("course_id", id).order("created_at"),
    supabase.from("contexts").select("id, name, color, kind").eq("archived", false).order("position"),
    supabase.from("notes").select(CAMPOS_NOTA).eq("course_id", id).order("created_at", { ascending: false }),
    supabase.from("study_questions").select(CAMPOS_QUESTAO).eq("course_id", id).order("done_on"),
    supabase.from("study_mocks").select(CAMPOS_SIMULADO).eq("course_id", id).order("done_on"),
  ]);
  if (!cursoDb) notFound();
  const curso = cursoDb as Curso;
  const materias = (materiasDb ?? []) as Materia[];

  // Sessões desde o começo do ciclo ou das últimas 18 semanas (o que vier antes) e as marcadas para frente
  const desde = inicioDoDia([curso.cycle_started_on, somarDias(segundaDa(hoje), -7 * 17)].sort()[0]);
  const [{ data: sessoesDb }, { data: temasDb }] = await Promise.all([
    supabase.from("events").select(CAMPOS_SESSAO).eq("course_id", id).gte("starts_at", desde).order("starts_at"),
    materias.length ? supabase.from("study_topics").select(CAMPOS_TEMA).in("subject_id", materias.map((m) => m.id)).order("position") : Promise.resolve({ data: [] }),
  ]);
  const sessoes = (sessoesDb ?? []) as Sessao[];
  const temas = (temasDb ?? []) as Tema[];

  const ctx = contextos ?? [];
  const contexto = ctx.find((c) => c.id === curso.context_id);
  const ciclo = resumoDoCiclo(curso, materias, sessoes);
  const daVez = ciclo.proxima?.materia ?? null;
  const temaDaVez = daVez ? temasDa(daVez, temas).proximo : null;
  const semana = semanaEmBarras(curso, sessoes, hoje);
  const prox = proximaSessao(curso.id, sessoes);
  // A sessão vira o destaque quando está acontecendo ou começa nas próximas 3 horas
  const mostrarSessao = prox && (emAndamento(prox) || new Date(prox.starts_at).getTime() - Date.now() < 3 * 3600000) ? prox : null;
  const confirmar = sessoesParaConfirmar(curso.id, sessoes);
  const marcadas = sessoes.filter((s) => !s.done_at && new Date(s.starts_at).getTime() > Date.now() && s.id !== mostrarSessao?.id);
  const feitasSemana = sessoes.filter((s) => s.done_at && s.starts_at >= inicioDoDia(segundaDa(hoje))).reverse();
  const rotas = (rotasDb ?? []).map(normalizar);
  const leituras = rotas.filter((r) => r.kind === "leitura" && r.status !== "concluida");
  const rotaCurso = rotas.find((r) => r.kind === "estudos") ?? null;
  const resumoRota = rotaCurso ? resumirRota(rotaCurso, [], hoje) : null;
  const corMateria = (s: Sessao) => materias.find((m) => m.id === s.subject_id)?.color ?? AZUL_ESTUDO;
  const revisoes = revisoesDoDia(temas, hoje);
  const questoes = (questoesDb ?? []) as Questao[];
  const simulados = ((simuladosDb ?? []) as Simulado[]).map((x) => ({ ...x, total: Number(x.total), correct: Number(x.correct) }));
  const acerto = aproveitamento(questoes);
  const prova = contagemProva(curso, hoje);
  const vistos = temas.filter((t) => t.done_at).length;

  return (
    <div className="page page--wide">
      <p className="crumb"><Link href="/estudos">Estudos</Link><ChevronRight aria-hidden />{curso.title}</p>
      <section className="palco palco--estudo" aria-label={curso.title}>
        <div className="palco__topo">
          <div>
            <p className="palco__data">
              {TIPOS_CURSO[curso.kind]} · Ciclo {curso.current_cycle}
              {contexto && <> · {contexto.name}</>}
              {curso.status === "pausado" && " · pausado"}
            </p>
            <h1 className="palco__t">{curso.title}</h1>
            <p className="palco__resumo">{linhaDoCiclo(curso, ciclo, hoje)}{curso.total_lessons ? <> · {curso.done_lessons} de {curso.total_lessons} aulas <MaisUmaAula cursoId={curso.id} /></> : null}</p>
          </div>
          {prova ? (
            <div className="prova" title={curso.exam_date ? diaMes(curso.exam_date) : undefined}>
              <b>{prova.dias}</b><span>{prova.dias === 1 ? "dia" : "dias"} para {prova.nome.toLowerCase() === "prova" ? "a prova" : prova.nome}</span>
              <small>{diaMes(curso.exam_date!)}</small>
            </div>
          ) : (
            <Link href="#detalhes" className="prova prova--sem"><span>Data da prova</span><small>Defina em Detalhes</small></Link>
          )}
        </div>
        <ul className="palco__nums">
          <li><Link href={`/estudos/${curso.id}?aba=desempenho`}><b>{horas(semana.total)}</b><span>{curso.weekly_minutes ? `de ${horas(curso.weekly_minutes)} na semana` : "nesta semana"}</span></Link></li>
          <li><Link href={`/estudos/${curso.id}?aba=conteudo`}><b>{temas.length ? `${Math.round((vistos / temas.length) * 100)}%` : "—"}</b><span>{temas.length ? `do conteúdo (${vistos}/${temas.length})` : "do conteúdo"}</span></Link></li>
          <li><Link href={`/estudos/${curso.id}?aba=exercicios`} className={acerto.pct !== null && tomAcerto(acerto.pct) === "fraco" ? "is-quente" : undefined}><b>{pctTexto(acerto.pct)}</b><span>{acerto.total ? `de acerto em ${acerto.total} exercícios` : "de acerto nos exercícios"}</span></Link></li>
          <li><Link href={`/estudos/${curso.id}`} className={revisoes.length ? "is-quente" : undefined}><b>{revisoes.length}</b><span>{revisoes.length === 1 ? "revisão hoje" : "revisões hoje"}</span></Link></li>
        </ul>
        <div className="palco__acoes">
          <RegistrarEstudo cursoId={curso.id} materias={materias} temas={temas} materiaInicial={daVez?.id} variante="btn" />
          <RegistrarQuestoes cursoId={curso.id} materias={materias} temas={temas} materiaInicial={daVez?.id} />
          <NovaProva cursoId={curso.id} variante="btn btn--line" />
          <MarcarSessao cursoId={curso.id} materias={materias} temas={temas} materiaInicial={daVez?.id} variante="btn btn--line" />
        </div>
      </section>

      <nav className="tabs tabs--estudo" aria-label="Partes do estudo">
        {ABAS.map((a) => (
          <Link key={a.v} href={a.v === "ciclo" ? `/estudos/${curso.id}` : `/estudos/${curso.id}?aba=${a.v}`} aria-current={a.v === aba ? "page" : undefined}>
            {a.r}{a.v === "exercicios" && acerto.total > 0 && <em>{acerto.total}</em>}{a.v === "provas" && simulados.length > 0 && <em>{simulados.length}</em>}{a.v === "conteudo" && temas.length > 0 && <em>{vistos}/{temas.length}</em>}
          </Link>
        ))}
      </nav>

      {aba === "conteudo" && <AbaEdital cursoId={curso.id} materias={materias} temas={temas} questoes={questoes} />}
      {aba === "exercicios" && <AbaQuestoes cursoId={curso.id} materias={materias} temas={temas} questoes={questoes} />}
      {aba === "provas" && <AbaProvas cursoId={curso.id} simulados={simulados} />}
      {aba === "desempenho" && <AbaDesempenho materias={materias} sessoes={sessoes} questoes={questoes} metaSemana={curso.weekly_minutes} />}

      {aba === "ciclo" && (
      <div className="route-cols study-cols">
        <div>
          <div className="study-next">
            <AgoraNoEstudo curso={curso} sessao={mostrarSessao} materia={daVez} tema={temaDaVez} falta={ciclo.proxima?.meta ? ciclo.proxima.meta - ciclo.proxima.feito : null} materias={materias} temas={temas} />
          </div>

          {revisoes.length > 0 && (
            <section className="sec">
              <h2 className="sec__h">Revisões de hoje {revisoes.length > 0 && <em>{revisoes.length}</em>}</h2>
              <RevisoesDoDia temas={revisoes} materias={materias} />
            </section>
          )}

          {confirmar.length > 0 && (
            <section className="sec">
              <h2 className="sec__h">Para confirmar {confirmar.length > 0 && <em>{confirmar.length}</em>}</h2>
              <ul className="list">{confirmar.map((s) => <ConfirmarSessao key={s.id} sessao={s} />)}</ul>
            </section>
          )}

          <section className="sec">
            <h2 className="sec__h">
              Ciclo {curso.current_cycle} {ciclo.meta ? <em>{horas(ciclo.feito)} de {horas(ciclo.meta)}</em> : null}
              {materias.length > 0 && <span className="sec__act"><AvancarCiclo curso={curso} completo={ciclo.completo} /></span>}
            </h2>
            {ciclo.meta > 0 && <span className="bar2 cycle-bar" aria-label={`${Math.round(ciclo.pct * 100)}% do ciclo`}><i style={{ width: `${ciclo.pct * 100}%` }} /></span>}
            {ciclo.completo && <p className="note" style={{ margin: "8px 0" }}>Todas as matérias chegaram nas horas deste ciclo. Comece o próximo quando quiser: as horas voltam a zero e os temas continuam.</p>}
            {materias.length === 0 ? (
              <p className="empty">Quais matérias entram no ciclo? Escreva o nome e as horas de cada uma, na ordem em que vai estudar.</p>
            ) : (
              <div className="mcards">
                {ciclo.linhas.map((l) => {
                  const t = temasDa(l.materia, temas);
                  return (
                    <CartaoMateria
                      key={l.materia.id}
                      cursoId={curso.id}
                      materia={l.materia}
                      feito={l.feito}
                      meta={l.meta}
                      vistas={t.feitos}
                      total={t.total}
                      revisar={revisoes.filter((r) => r.subject_id === l.materia.id).length}
                      daVez={l.materia.id === daVez?.id && !ciclo.completo}
                      proxima={t.proximo?.title ?? null}
                    />
                  );
                })}
              </div>
            )}
            <NovaMateria cursoId={curso.id} />
          </section>

          <section className="sec">
            <h2 className="sec__h">Esta semana <em>{semana.texto}</em></h2>
            <div className="week" role="img" aria-label={`Esta semana: ${semana.texto}`}>
              {semana.dias.map((d) => (
                <div key={d.dia} className={d.hoje ? "is-today" : undefined} title={d.feitos ? horas(d.feitos) : undefined}>
                  <i style={{ "--h": `${Math.round(d.pct * 100)}%` } as React.CSSProperties} />{d.rotulo}
                </div>
              ))}
            </div>
          </section>

          {feitasSemana.length > 0 && (
            <details className="sec fold">
              <summary className="sec__h"><ChevronRight aria-hidden />Estudado nesta semana {feitasSemana.length > 0 && <em>{feitasSemana.length}</em>}</summary>
              <div className="agenda">
                {feitasSemana.map((s) => (
                  <Link key={s.id} href={`/calendario/${s.id}`} className="ag">
                    <time>{horaDe(s.starts_at)}</time>
                    <div><b>{s.title}</b><small><i className="dot" style={{ background: corMateria(s) }} />{quandoSessao(s).split(",")[0]} · {horas(duracao(s))}</small></div>
                  </Link>
                ))}
              </div>
            </details>
          )}

          <section className="sec">
            <h2 className="sec__h">Notas <em>{(notas ?? []).length}</em><span className="sec__act"><NovaNota vinculo={`e:${curso.id}`} /></span></h2>
            {(notas ?? []).length > 0 ? <ListaNotas notas={(notas ?? []) as Nota[]} /> : <p className="empty">Nenhuma nota.</p>}
          </section>
        </div>

        <aside className="study-aside">
          <section className="sec" style={{ margin: 0 }}>
            <h2 className="sec__h">Sessões marcadas {marcadas.length > 0 && <em>{marcadas.length}</em>}</h2>
            {marcadas.length === 0 ? (
              <p className="empty" style={{ paddingTop: 2 }}>Nenhuma sessão marcada.</p>
            ) : (
              <div className="agenda">
                {marcadas.slice(0, 6).map((s) => (
                  <Link key={s.id} href={`/calendario/${s.id}`} className="ag">
                    <time>{horaDe(s.starts_at)}</time>
                    <div><b>{s.title}</b><small><i className="dot" style={{ background: corMateria(s) }} />{quandoSessao(s).split(",")[0]} · {horas(duracao(s))}</small></div>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section className="sec" style={{ margin: 0 }}>
            <h2 className="sec__h">Leituras <span className="sec__act"><Link href={`/rotas/nova?tipo=leitura&curso=${curso.id}`} className="btn btn--ghost btn--sm"><BookOpen aria-hidden />Nova</Link></span></h2>
            {leituras.length === 0 ? (
              <p className="empty" style={{ paddingTop: 2 }}>Nenhuma leitura.</p>
            ) : (
              <div className="agenda">
                {leituras.map((r) => {
                  const res = resumirRota(r, [], hoje);
                  return (
                    <Link key={r.id} href={`/rotas/${r.id}`} className="ag" style={{ gridTemplateColumns: "20px minmax(0,1fr)" }}>
                      <span style={{ paddingTop: 3 }}><Anel pct={res.pct} /></span>
                      <div><b>{r.title}</b><small>{res.agora}{res.ritmo ? ` · ${res.ritmo.replace(" páginas por dia", " por dia")}` : ""}</small></div>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>

          {rotaCurso && resumoRota ? (
            <Link href={`/rotas/${rotaCurso.id}`} className="route" style={{ padding: 16, gap: 10 }}>
              <span className="route__k" style={{ color: "var(--text)", fontSize: 14, fontWeight: 500 }}><Anel pct={resumoRota.pct} />Rota · {rotaCurso.title}</span>
              <Caminho pct={resumoRota.pct} />
              <span className="route__line">{resumoRota.concluida ? "Destino alcançado" : `${resumoRota.ritmo ?? resumoRota.agora}${resumoRota.previsao ? ` · previsão: ${resumoRota.previsao}` : ""}`}</span>
            </Link>
          ) : curso.total_lessons ? (
            <div className="route-card">
              <small>Rota</small>
              <b>Quando você quer terminar?</b>
              <span>Uma Rota calcula quantas aulas por semana faltam e traz o passo para o Hoje.</span>
              <span style={{ marginTop: 8 }}><Link href={`/rotas/nova?tipo=estudos&curso=${curso.id}`} className="btn btn--line btn--sm"><Route aria-hidden />Criar a Rota</Link></span>
            </div>
          ) : null}

          <details className="card fold" id="detalhes">
            <summary className="card__t" style={{ margin: 0, display: "flex", alignItems: "center", gap: 6 }}><ChevronRight aria-hidden />Detalhes do estudo</summary>
            <div style={{ marginTop: 14 }}><FormCurso curso={curso} contextos={ctx} /></div>
          </details>
        </aside>
      </div>
      )}
    </div>
  );
}
