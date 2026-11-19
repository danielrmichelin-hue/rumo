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
import { ehId, hojeISO, horaDe, inicioDoDia } from "@/lib/datas";
import { segundaDa } from "@/lib/semana";
import {
  AZUL_ESTUDO, CAMPOS_CURSO, CAMPOS_MATERIA, CAMPOS_SESSAO, CAMPOS_TEMA, duracao, emAndamento, horas, linhaDoCiclo, linhaDoEstudo, proximaSessao,
  quandoSessao, resumoDoCiclo, revisoesDoDia, semanaEmBarras, sessoesParaConfirmar, temasDa, TIPOS_CURSO, type Curso, type Materia, type Sessao, type Tema,
} from "@/lib/estudos";
import { CAMPOS_NOTA, type Nota } from "@/lib/notas";
import { CAMPOS_ROTA, normalizar, resumirRota } from "@/lib/rotas";

export const metadata = { title: "Estudos" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ehId(id)) notFound();
  const hoje = hojeISO();
  const supabase = await createClient();
  const [{ data: cursoDb }, { data: materiasDb }, { data: rotasDb }, { data: contextos }, { data: notas }] = await Promise.all([
    supabase.from("study_courses").select(CAMPOS_CURSO).eq("id", id).maybeSingle(),
    supabase.from("study_subjects").select(CAMPOS_MATERIA).eq("course_id", id).order("position"),
    supabase.from("routes").select(CAMPOS_ROTA).eq("course_id", id).order("created_at"),
    supabase.from("contexts").select("id, name, color, kind").eq("archived", false).order("position"),
    supabase.from("notes").select(CAMPOS_NOTA).eq("course_id", id).order("created_at", { ascending: false }),
  ]);
  if (!cursoDb) notFound();
  const curso = cursoDb as Curso;
  const materias = (materiasDb ?? []) as Materia[];

  // Sessões desde o começo do ciclo (ou da semana, o que vier antes) e as marcadas para frente
  const desde = inicioDoDia([curso.cycle_started_on, segundaDa(hoje)].sort()[0]);
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
  const linhaEstudo = linhaDoEstudo(curso, hoje);
  const revisoes = revisoesDoDia(temas, hoje);

  return (
    <div className="page page--wide">
      <div className="page__head study-top">
        <div style={{ flex: 1, minWidth: 0 }}>
          <p className="crumb"><Link href="/estudos">Estudos</Link><ChevronRight aria-hidden />{curso.title}</p>
        </div>
        <div className="page__actions">
          <RegistrarEstudo cursoId={curso.id} materias={materias} temas={temas} materiaInicial={daVez?.id} />
          <MarcarSessao cursoId={curso.id} materias={materias} temas={temas} materiaInicial={daVez?.id} variante="btn btn--line" />
        </div>
      </div>

      <header className="study-head">
        <small>
          {TIPOS_CURSO[curso.kind]} · {linhaDoCiclo(curso, ciclo, hoje)}
          {contexto && <> · <i className="dot" style={{ background: contexto.color }} />{contexto.name}</>}
          {curso.status === "pausado" && " · pausado"}
        </small>
        <h1 className="page__t">{curso.title}</h1>
        {(linhaEstudo || curso.total_lessons) && <p>{linhaEstudo}{curso.total_lessons ? <> <MaisUmaAula cursoId={curso.id} /></> : null}</p>}
      </header>

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
            {(notas ?? []).length > 0 ? <ListaNotas notas={(notas ?? []) as Nota[]} /> : <p className="empty">Resumos, dúvidas para levar à aula, o que caiu na última prova.</p>}
          </section>
        </div>

        <aside className="study-aside">
          <section className="sec" style={{ margin: 0 }}>
            <h2 className="sec__h">Sessões marcadas {marcadas.length > 0 && <em>{marcadas.length}</em>}</h2>
            {marcadas.length === 0 ? (
              <p className="empty" style={{ paddingTop: 2 }}>Marque as sessões da semana: elas vão para o calendário em azul e aparecem no Hoje no dia.</p>
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
              <p className="empty" style={{ paddingTop: 2 }}>Livros e apostilas viram Rotas de leitura: o Rumo calcula as páginas por dia.</p>
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

          <details className="card fold">
            <summary className="card__t" style={{ margin: 0, display: "flex", alignItems: "center", gap: 6 }}><ChevronRight aria-hidden />Detalhes do estudo</summary>
            <div style={{ marginTop: 14 }}><FormCurso curso={curso} contextos={ctx} /></div>
          </details>
        </aside>
      </div>
    </div>
  );
}
