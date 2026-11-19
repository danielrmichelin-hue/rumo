import Link from "next/link";
import { Clock, GraduationCap, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { segundaDa } from "@/lib/semana";
import { hojeISO, inicioDoDia } from "@/lib/datas";
import {
  AZUL_ESTUDO, CAMPOS_CURSO, CAMPOS_SESSAO, linhaCiclo, linhaProgresso, pctCurso, proximaSessao, quandoSessao, semanaEmBarras, TIPOS_CURSO,
  type Curso, type Sessao,
} from "@/lib/estudos";

export const metadata = { title: "Estudos" };

export default async function Page() {
  const supabase = await createClient();
  const hoje = hojeISO();
  const desde = inicioDoDia(segundaDa(hoje));
  const [{ data: cursosDb }, { data: sessoesDb }, { data: contextos }] = await Promise.all([
    supabase.from("study_courses").select(CAMPOS_CURSO).order("created_at"),
    supabase.from("events").select(CAMPOS_SESSAO).not("course_id", "is", null).gte("starts_at", desde).order("starts_at"),
    supabase.from("contexts").select("id, name, color"),
  ]);
  const cursos = (cursosDb ?? []) as Curso[];
  const sessoes = (sessoesDb ?? []) as Sessao[];
  const ativos = cursos.filter((c) => c.status !== "concluido");
  const concluidos = cursos.filter((c) => c.status === "concluido");
  const ctx = contextos ?? [];

  const cartao = (c: Curso) => {
    const contexto = ctx.find((x) => x.id === c.context_id);
    const semana = semanaEmBarras(c, sessoes, hoje);
    const prox = proximaSessao(c.id, sessoes);
    const pct = pctCurso(c);
    return (
      <article key={c.id} className="route">
        <p className="route__k">
          <i className="dot" style={{ background: contexto?.color ?? AZUL_ESTUDO }} />
          {TIPOS_CURSO[c.kind]}{contexto && ` · ${contexto.name}`}{c.status === "pausado" && " · pausado"}
        </p>
        <div>
          <Link href={`/estudos/${c.id}`} className="route__t">{c.title}</Link>
          <p className="route__line" style={{ marginTop: 4 }}>{linhaCiclo(c, hoje)}</p>
        </div>
        {c.total_lessons ? <span className="bar2" aria-label={`${Math.round(pct * 100)}% das aulas`}><i style={{ width: `${pct * 100}%` }} /></span> : null}
        <p className="route__line">{linhaProgresso(c, hoje)}</p>
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
          <p className="page__sub">Matérias, ciclos e sessões. As sessões vão para o calendário e para o Hoje.</p>
        </div>
        <div className="page__actions"><Link href="/estudos/novo" className="btn"><Plus aria-hidden />Novo curso</Link></div>
      </div>

      {!cursos.length ? (
        <div className="empty empty--box" style={{ maxWidth: 560 }}>
          <b><GraduationCap size={16} aria-hidden style={{ verticalAlign: -3, marginRight: 6 }} />Primeiro curso</b>
          <span>Graduação, pós, idioma, concurso ou curso livre. Informe as aulas, as matérias e as horas da semana: o Rumo mostra o ciclo, a semana e a próxima sessão.</span>
          <div style={{ marginTop: 10 }}><Link href="/estudos/novo" className="btn btn--sm">Criar o primeiro curso</Link></div>
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
