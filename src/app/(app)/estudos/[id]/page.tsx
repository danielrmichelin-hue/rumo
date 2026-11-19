import Link from "next/link";
import { notFound } from "next/navigation";
import { BookOpen, ChevronRight, Route } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Anel, Caminho } from "@/components/Caminho";
import {
  AvancarCiclo, ComecarSessao, EditarMateria, FormCurso, MaisUmaAula, MarcarSessao, NovaMateria, ProximaSessao,
} from "@/components/Estudos";
import { ehId, hojeISO, horaDe, inicioDoDia } from "@/lib/datas";
import { segundaDa } from "@/lib/semana";
import {
  AZUL_ESTUDO, CAMPOS_CURSO, CAMPOS_MATERIA, CAMPOS_SESSAO, duracao, horas, linhaCiclo, linhaMateria, linhaProgresso, materiaSugerida,
  NOME_CICLO, pctMateria, proximaSessao, quandoSessao, semanaEmBarras, type Curso, type Materia, type Sessao,
} from "@/lib/estudos";
import { CAMPOS_ROTA, normalizar, resumirRota } from "@/lib/rotas";

export const metadata = { title: "Estudos" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ehId(id)) notFound();
  const hoje = hojeISO();
  const desde = inicioDoDia(segundaDa(hoje));
  const supabase = await createClient();
  const [{ data: cursoDb }, { data: materiasDb }, { data: sessoesDb }, { data: rotasDb }, { data: contextos }] = await Promise.all([
    supabase.from("study_courses").select(CAMPOS_CURSO).eq("id", id).maybeSingle(),
    supabase.from("study_subjects").select(CAMPOS_MATERIA).eq("course_id", id).order("position"),
    supabase.from("events").select(CAMPOS_SESSAO).eq("course_id", id).gte("starts_at", desde).order("starts_at"),
    supabase.from("routes").select(CAMPOS_ROTA).eq("course_id", id).order("created_at"),
    supabase.from("contexts").select("id, name, color, kind").eq("archived", false).order("position"),
  ]);
  if (!cursoDb) notFound();

  const curso = cursoDb as Curso;
  const materias = (materiasDb ?? []) as Materia[];
  const sessoes = (sessoesDb ?? []) as Sessao[];
  const ctx = contextos ?? [];
  const contexto = ctx.find((c) => c.id === curso.context_id);
  const nomeCiclo = NOME_CICLO[curso.kind];
  const semana = semanaEmBarras(curso, sessoes, hoje);
  const prox = proximaSessao(curso.id, sessoes);
  const sugerida = materiaSugerida(materias, curso);
  const doCiclo = materias.filter((m) => !m.cycle || m.cycle >= curso.current_cycle);
  const anteriores = materias.filter((m) => m.cycle && m.cycle < curso.current_cycle);
  const marcadas = sessoes.filter((s) => !s.done_at && (s.id === prox?.id || new Date(s.starts_at).getTime() > Date.now()));
  const feitasSemana = sessoes.filter((s) => s.done_at);
  const rotas = (rotasDb ?? []).map(normalizar).filter((r) => r.status !== "concluida" || r.kind === "estudos");
  const leituras = rotas.filter((r) => r.kind === "leitura");
  const rotaCurso = rotas.find((r) => r.kind === "estudos") ?? null;
  const resumoCurso = rotaCurso ? resumirRota(rotaCurso, [], hoje) : null;
  const nomeMateria = (s: Sessao) => materias.find((m) => m.id === s.subject_id) ?? null;
  const novaRotaCurso = `/rotas/nova?tipo=estudos&curso=${curso.id}`;

  return (
    <div className="page page--wide">
      <div className="page__head study-top">
        <div style={{ flex: 1, minWidth: 0 }}>
          <p className="crumb"><Link href="/estudos">Estudos</Link><ChevronRight aria-hidden />{curso.title}</p>
        </div>
        <div className="page__actions">
          <Link href={`/rotas/nova?tipo=leitura&curso=${curso.id}`} className="btn btn--line"><BookOpen aria-hidden />Leituras</Link>
          <ComecarSessao cursoId={curso.id} materia={sugerida} />
        </div>
      </div>

      <header className="study-head">
        <small>{linhaCiclo(curso, hoje)}{contexto && <> · <i className="dot" style={{ background: contexto.color }} />{contexto.name}</>}{curso.status === "pausado" && " · pausado"}</small>
        <h1 className="page__t">{curso.title}</h1>
        <p>{linhaProgresso(curso, hoje)}</p>
      </header>

      <div className="route-cols study-cols">
        <div>
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

          <section className="sec">
            <h2 className="sec__h">Matérias {curso.cycles || curso.current_cycle > 1 ? `do ${nomeCiclo.um.toLowerCase()}` : ""} <em>{doCiclo.length}</em></h2>
            {doCiclo.length === 0 && <p className="empty">Quais matérias você tem agora? Cada uma mostra o progresso e a próxima aula.</p>}
            <ul className="list">
              {doCiclo.map((m) => {
                const pct = pctMateria(m);
                return (
                  <li key={m.id} className="subj">
                    <i className="dot" style={{ background: m.color }} />
                    <div>
                      <b>{m.title}</b>
                      <small>{linhaMateria(m, curso, sessoes, hoje)}</small>
                    </div>
                    {m.total_lessons ? <span className="bar2"><i style={{ width: `${pct * 100}%` }} /></span> : <span className="subj__n">{m.done_lessons} {m.done_lessons === 1 ? "aula" : "aulas"}</span>}
                    <em>{m.total_lessons ? `${Math.round(pct * 100)}%` : ""}</em>
                    <MaisUmaAula cursoId={curso.id} materia={m} />
                    <EditarMateria materia={m} nomeCiclo={nomeCiclo.um} />
                  </li>
                );
              })}
            </ul>
            <NovaMateria cursoId={curso.id} />
          </section>

          <section className="sec">
            <h2 className="sec__h">Sessões marcadas <em>{marcadas.length}</em><span className="sec__act"><MarcarSessao cursoId={curso.id} materias={doCiclo} materiaInicial={sugerida?.id} /></span></h2>
            {marcadas.length === 0 ? (
              <p className="empty">Marque as sessões da semana. Elas aparecem no calendário em azul e no Hoje, no dia.</p>
            ) : (
              <div className="agenda">
                {marcadas.map((s) => (
                  <Link key={s.id} href={`/calendario/${s.id}`} className="ag">
                    <time>{horaDe(s.starts_at)}</time>
                    <div><b>{s.title}</b><small><i className="dot" style={{ background: nomeMateria(s)?.color ?? AZUL_ESTUDO }} />{quandoSessao(s).split(",")[0]} · {horas(duracao(s))}</small></div>
                  </Link>
                ))}
              </div>
            )}
          </section>

          {feitasSemana.length > 0 && (
            <details className="sec fold">
              <summary className="sec__h"><ChevronRight aria-hidden />Sessões concluídas nesta semana <em>{feitasSemana.length}</em></summary>
              <div className="agenda">
                {feitasSemana.map((s) => (
                  <Link key={s.id} href={`/calendario/${s.id}`} className="ag ag--past">
                    <time>{horaDe(s.starts_at)}</time>
                    <div><b>{s.title}</b><small>{quandoSessao(s).split(",")[0]} · {horas(duracao(s))}</small></div>
                  </Link>
                ))}
              </div>
            </details>
          )}

          {anteriores.length > 0 && (
            <details className="sec fold">
              <summary className="sec__h"><ChevronRight aria-hidden />{nomeCiclo.varios} anteriores <em>{anteriores.length}</em></summary>
              <ul className="list">
                {anteriores.map((m) => (
                  <li key={m.id} className="subj">
                    <i className="dot" style={{ background: m.color }} />
                    <div><b>{m.title}</b><small>{nomeCiclo.um} {m.cycle} · {m.done_lessons} {m.done_lessons === 1 ? "aula" : "aulas"}</small></div>
                    <span />
                    <em />
                    <span />
                    <EditarMateria materia={m} nomeCiclo={nomeCiclo.um} />
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>

        <aside className="study-aside">
          {prox ? (
            <div className="study-next"><ProximaSessao sessao={prox} materia={nomeMateria(prox)} /></div>
          ) : (
            <div className="route-card study-next">
              <small>Próxima sessão</small>
              <b>Nenhuma marcada</b>
              <span style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}><MarcarSessao cursoId={curso.id} materias={doCiclo} materiaInicial={sugerida?.id} /></span>
            </div>
          )}

          <section className="sec" style={{ margin: 0 }}>
            <h2 className="sec__h">Leituras <span className="sec__act"><Link href={`/rotas/nova?tipo=leitura&curso=${curso.id}`} className="btn btn--ghost btn--sm">Nova leitura</Link></span></h2>
            {leituras.length === 0 ? (
              <p className="empty" style={{ paddingTop: 2 }}>Livros e textos do curso viram Rotas de leitura: o Rumo calcula as páginas por dia.</p>
            ) : (
              <div className="agenda">
                {leituras.map((r) => {
                  const res = resumirRota(r, [], hoje);
                  return (
                    <Link key={r.id} href={`/rotas/${r.id}`} className="ag" style={{ gridTemplateColumns: "20px minmax(0,1fr)" }}>
                      <span style={{ paddingTop: 3 }}><Anel pct={res.pct} /></span>
                      <div><b>{r.title}</b><small>{res.concluida ? "Lida" : `${res.agora}${res.ritmo ? ` · ${res.ritmo.replace(" páginas por dia", " por dia")}` : ""}`}</small></div>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>

          {rotaCurso && resumoCurso ? (
            <Link href={`/rotas/${rotaCurso.id}`} className="route" style={{ padding: 16, gap: 10 }}>
              <span className="route__k" style={{ color: "var(--text)", fontSize: 14, fontWeight: 500 }}><Anel pct={resumoCurso.pct} />Rota · {rotaCurso.title}</span>
              <Caminho pct={resumoCurso.pct} />
              <span className="route__line">{resumoCurso.concluida ? "Destino alcançado" : `${resumoCurso.ritmo ?? resumoCurso.agora}${resumoCurso.previsao ? ` · previsão: ${resumoCurso.previsao}` : ""}`}</span>
            </Link>
          ) : (
            <div className="route-card">
              <small>Rota</small>
              <b>Quando você quer terminar?</b>
              <span>Uma Rota calcula quantas aulas por semana faltam e traz o passo para o Hoje. Cada aula registrada aqui conta nela.</span>
              <span style={{ marginTop: 8 }}><Link href={novaRotaCurso} className="btn btn--line btn--sm"><Route aria-hidden />Criar a Rota</Link></span>
            </div>
          )}

          <AvancarCiclo curso={curso} />

          <details className="card fold">
            <summary className="card__t" style={{ margin: 0, display: "flex", alignItems: "center", gap: 6 }}><ChevronRight aria-hidden />Detalhes do curso</summary>
            <div style={{ marginTop: 14 }}><FormCurso curso={curso} contextos={ctx} /></div>
          </details>
        </aside>
      </div>
    </div>
  );
}
