import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AulasDaMateria, RevisoesDoDia } from "@/components/Aulas";
import { AjustesMateria, RegistrarEstudo } from "@/components/Estudos";
import { Foco } from "@/components/Foco";
import { ehId, hojeISO, inicioDoDia } from "@/lib/datas";
import {
  CAMPOS_CURSO, CAMPOS_MATERIA, CAMPOS_MODULO, CAMPOS_SESSAO, CAMPOS_TEMA, horas, resumoDoCiclo, revisoesDoDia, temasDa,
  type Curso, type Materia, type Modulo, type Sessao, type Tema,
} from "@/lib/estudos";

export const metadata = { title: "Matéria" };

export default async function Page({ params }: { params: Promise<{ id: string; mid: string }> }) {
  const { id, mid } = await params;
  if (!ehId(id) || !ehId(mid)) notFound();
  const hoje = hojeISO();
  const supabase = await createClient();
  const [{ data: cursoDb }, { data: materiasDb }, { data: modulosDb }, { data: temasDb }] = await Promise.all([
    supabase.from("study_courses").select(CAMPOS_CURSO).eq("id", id).maybeSingle(),
    supabase.from("study_subjects").select(CAMPOS_MATERIA).eq("course_id", id).order("position"),
    supabase.from("study_modules").select(CAMPOS_MODULO).eq("subject_id", mid).order("position"),
    supabase.from("study_topics").select(CAMPOS_TEMA).eq("subject_id", mid).order("position"),
  ]);
  const curso = cursoDb as Curso | null;
  const materias = (materiasDb ?? []) as Materia[];
  const materia = materias.find((m) => m.id === mid);
  if (!curso || !materia) notFound();
  const { data: sessoesDb } = await supabase.from("events").select(CAMPOS_SESSAO).eq("course_id", id).gte("starts_at", inicioDoDia(curso.cycle_started_on));
  const temas = (temasDb ?? []) as Tema[];
  const modulos = (modulosDb ?? []) as Modulo[];
  const linha = resumoDoCiclo(curso, materias, (sessoesDb ?? []) as Sessao[]).linhas.find((l) => l.materia.id === mid)!;
  const t = temasDa(materia, temas);
  const revisoes = revisoesDoDia(temas, hoje);
  const i = materias.findIndex((m) => m.id === mid);

  return (
    <div className="page page--wide">
      <div className="page__head study-top">
        <div style={{ flex: 1, minWidth: 0 }}>
          <p className="crumb"><Link href="/estudos">Estudos</Link><ChevronRight aria-hidden /><Link href={`/estudos/${id}`}>{curso.title}</Link><ChevronRight aria-hidden />{materia.title}</p>
        </div>
        <div className="page__actions">
          <RegistrarEstudo cursoId={id} materias={materias} temas={temas} materiaInicial={mid} />
          <Foco cursoId={id} materias={materias} temas={temas} materiaInicial={mid} temaInicial={t.proximo?.id} rotulo="Começar foco" />
        </div>
      </div>

      <header className="study-head">
        <small><i className="dot" style={{ background: materia.color }} />Ciclo {curso.current_cycle} · {linha.meta ? `${horas(linha.feito)} de ${horas(linha.meta)} nesta matéria` : `${horas(linha.feito)} neste ciclo`}</small>
        <h1 className="page__t">{materia.title}</h1>
        <p>{t.total ? `${t.feitos} de ${t.total} aulas vistas` : "Nenhuma aula ainda"}{t.proximo ? ` · próxima: ${t.proximo.title}` : ""}{revisoes.length ? ` · ${revisoes.length} para revisar hoje` : ""}</p>
        {linha.meta ? <span className="bar2 cycle-bar" style={{ margin: "6px 0 0", maxWidth: 420 }}><i style={{ width: `${linha.pct * 100}%`, background: materia.color }} /></span> : null}
      </header>

      {revisoes.length > 0 && (
        <section className="sec">
          <h2 className="sec__h">Revisar hoje <em>{revisoes.length}</em></h2>
          <RevisoesDoDia temas={revisoes} materias={[materia]} />
        </section>
      )}

      <section className="sec">
        <h2 className="sec__h">Aulas e temas <em>{t.total}</em></h2>
        <p className="page__para" style={{ margin: "0 0 12px" }}>Marque a aula como vista e o Rumo agenda as revisões: amanhã, em 7 dias e em 30 dias. Use módulos se o curso for dividido assim.</p>
        <AulasDaMateria materia={materia} modulos={modulos} temas={temas} />
      </section>

      <details className="card fold" style={{ marginTop: 24 }}>
        <summary className="card__t" style={{ margin: 0, display: "flex", alignItems: "center", gap: 6 }}><ChevronRight aria-hidden />Ajustes da matéria</summary>
        <div style={{ marginTop: 14 }}><AjustesMateria materia={materia} primeira={i === 0} ultima={i === materias.length - 1} cursoId={id} /></div>
      </details>
    </div>
  );
}
