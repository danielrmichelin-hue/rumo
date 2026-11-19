import Link from "next/link";
import { Clock, GraduationCap, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { segundaDa } from "@/lib/semana";
import { hojeISO, inicioDoDia } from "@/lib/datas";
import {
  AZUL_ESTUDO, CAMPOS_CURSO, CAMPOS_MATERIA, CAMPOS_SESSAO, horas, linhaDoCiclo, linhaDoEstudo, proximaSessao, quandoSessao, resumoDoCiclo, semanaEmBarras,
  TIPOS_CURSO, type Curso, type Materia, type Sessao,
} from "@/lib/estudos";

export const metadata = { title: "Estudos" };

export default async function Page() {
  const supabase = await createClient();
  const hoje = hojeISO();
  const [{ data: cursosDb }, { data: materiasDb }, { data: contextos }] = await Promise.all([
    supabase.from("study_courses").select(CAMPOS_CURSO).order("created_at"),
    supabase.from("study_subjects").select(CAMPOS_MATERIA).order("position"),
    supabase.from("contexts").select("id, name, color"),
  ]);
  const cursos = (cursosDb ?? []) as Curso[];
  const materias = (materiasDb ?? []) as Materia[];
  // Sessões desde o ciclo mais antigo em andamento (ou desde segunda)
  const desde = inicioDoDia([segundaDa(hoje), ...cursos.map((c) => c.cycle_started_on)].sort()[0]);
  const { data: sessoesDb } = await supabase.from("events").select(CAMPOS_SESSAO).not("course_id", "is", null).gte("starts_at", desde).order("starts_at");
  const sessoes = (sessoesDb ?? []) as Sessao[];
  const ativos = cursos.filter((c) => c.status !== "concluido");
  const concluidos = cursos.filter((c) => c.status === "concluido");
  const ctx = contextos ?? [];

  const cartao = (c: Curso) => {
    const contexto = ctx.find((x) => x.id === c.context_id);
    const semana = semanaEmBarras(c, sessoes, hoje);
    const prox = proximaSessao(c.id, sessoes);
    const ciclo = resumoDoCiclo(c, materias.filter((m) => m.course_id === c.id), sessoes);
    const linha = linhaDoEstudo(c, hoje);
    return (
      <article key={c.id} className="route">
        <p className="route__k">
          <i className="dot" style={{ background: contexto?.color ?? AZUL_ESTUDO }} />
          {TIPOS_CURSO[c.kind]}{contexto && ` · ${contexto.name}`}{c.status === "pausado" && " · pausado"}
        </p>
        <div>
          <Link href={`/estudos/${c.id}`} className="route__t">{c.title}</Link>
          <p className="route__line" style={{ marginTop: 4 }}>{linhaDoCiclo(c, ciclo, hoje)}</p>
        </div>
        {ciclo.meta > 0 && <span className="bar2" aria-label={`${Math.round(ciclo.pct * 100)}% do ciclo`}><i style={{ width: `${ciclo.pct * 100}%` }} /></span>}
        {ciclo.proxima && !ciclo.completo && <p className="route__line"><b>Agora</b> · {ciclo.proxima.materia.title}{ciclo.proxima.meta ? ` · faltam ${horas(ciclo.proxima.meta - ciclo.proxima.feito)}` : ""}</p>}
        {ciclo.completo && <p className="route__line"><b>Ciclo completo</b> · pronto para o próximo</p>}
        {linha && <p className="route__line">{linha}</p>}
        <p className="route__line"><b>Esta semana</b> · {semana.texto}</p>
        {prox && <p className="route__line" style={{ display: "flex", alignItems: "center", gap: 6 }}><Clock size={14} aria-hidden />{prox.title} · {quandoSessao(prox)}</p>}
      </article>
    );
  };

  return (
    <div className="page page--wide">
      <div className="page__head">
        <div>
          <h1 className="page__t">Estudos</h1>
          <p className="page__sub">Seu ciclo de estudos: matérias com horas, temas e sessões. O que você marca vai para o calendário e para o Hoje.</p>
        </div>
        <div className="page__actions"><Link href="/estudos/novo" className="btn"><Plus aria-hidden />Novo estudo</Link></div>
      </div>

      {!cursos.length ? (
        <div className="empty empty--box" style={{ maxWidth: 560 }}>
          <b><GraduationCap size={16} aria-hidden style={{ verticalAlign: -3, marginRight: 6 }} />Primeiro ciclo de estudos</b>
          <span>Concurso, pós, graduação, idioma ou curso livre. Diga as matérias e as horas de cada uma: o Rumo mostra a matéria da vez, os temas e a semana.</span>
          <div style={{ marginTop: 10 }}><Link href="/estudos/novo" className="btn btn--sm">Montar o ciclo</Link></div>
        </div>
      ) : (
        <>
          <section className="sec">
            <h2 className="sec__h">Em andamento <em>{ativos.length}</em></h2>
            <div className="routes">{ativos.map(cartao)}</div>
          </section>
          {concluidos.length > 0 && (
            <section className="sec">
              <h2 className="sec__h">Concluídos <em>{concluidos.length}</em></h2>
              <div className="routes">{concluidos.map(cartao)}</div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
