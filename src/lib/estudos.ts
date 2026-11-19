// Estudos: matérias, ciclos e progresso (Book 6.2). As sessões são compromissos do Core (events com course_id).
import { diaDaSemana, diferencaDias, hojeISO, horaDe, rotuloData, SEMANA_CURTA, SEMANA_LONGA, somarDias } from "./datas";
import { segundaDa } from "./semana";

export type TipoCurso = "graduacao" | "pos" | "idioma" | "concurso" | "curso";

export const TIPOS_CURSO: Record<TipoCurso, string> = {
  graduacao: "Graduação",
  pos: "Pós",
  idioma: "Idiomas",
  concurso: "Concurso",
  curso: "Curso livre",
};

/** A resposta de "O que você estuda agora?" (perguntas do começo) vira o tipo */
export const TIPO_DO_COMECO = Object.fromEntries(Object.entries(TIPOS_CURSO).map(([k, v]) => [v, k])) as Record<string, TipoCurso>;

export type Curso = {
  id: string;
  title: string;
  kind: TipoCurso;
  context_id: string | null;
  total_lessons: number | null;
  done_lessons: number;
  cycles: number | null;
  current_cycle: number;
  cycle_started_on: string;
  weekly_minutes: number | null;
  exam_date: string | null;
  exam_label: string | null;
  status: "ativo" | "pausado" | "concluido";
  note: string | null;
};

export type Materia = {
  id: string;
  course_id: string;
  title: string;
  cycle: number | null;
  total_lessons: number | null;
  done_lessons: number;
  next_topic: string | null;
  color: string;
  position: number;
};

export type Sessao = {
  id: string;
  title: string;
  course_id: string | null;
  subject_id: string | null;
  starts_at: string;
  ends_at: string | null;
  done_at: string | null;
  context_id: string | null;
  location: string | null;
};

export const CAMPOS_CURSO = "id, title, kind, context_id, total_lessons, done_lessons, cycles, current_cycle, cycle_started_on, weekly_minutes, exam_date, exam_label, status, note";
export const CAMPOS_MATERIA = "id, course_id, title, cycle, total_lessons, done_lessons, next_topic, color, position";
export const CAMPOS_SESSAO = "id, title, course_id, subject_id, starts_at, ends_at, done_at, context_id, location";

/** "4h10", "6h", "50 min" */
export function horas(min: number): string {
  const m = Math.round(min);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h}h${String(r).padStart(2, "0")}` : `${h}h`;
}

/** Fim da sessão; sem fim marcado, conta 50 minutos */
const fimSessao = (s: Pick<Sessao, "starts_at" | "ends_at">) => (s.ends_at ? new Date(s.ends_at).getTime() : new Date(s.starts_at).getTime() + 50 * 60000);

export function duracao(s: Pick<Sessao, "starts_at" | "ends_at">): number {
  return Math.max(5, Math.round((fimSessao(s) - new Date(s.starts_at).getTime()) / 60000));
}

/** Semana do ciclo atual: "semana 2" */
export function semanaDoCiclo(c: Curso, hoje: string = hojeISO()): number {
  return Math.max(1, Math.floor(Math.max(0, diferencaDias(c.cycle_started_on, hoje)) / 7) + 1);
}

/** "Ciclo 4 de 8 · semana 2" */
export function linhaCiclo(c: Curso, hoje: string = hojeISO()): string {
  const ciclo = c.cycles ? `Ciclo ${c.current_cycle} de ${c.cycles}` : `Ciclo ${c.current_cycle}`;
  return `${ciclo} · semana ${semanaDoCiclo(c, hoje)}`;
}

/** "38 de 60 aulas · prova do módulo em 12 dias" */
export function linhaProgresso(c: Curso, hoje: string = hojeISO()): string {
  const partes: string[] = [];
  if (c.total_lessons) partes.push(`${c.done_lessons} de ${c.total_lessons} aulas`);
  else if (c.done_lessons) partes.push(`${c.done_lessons} ${c.done_lessons === 1 ? "aula concluída" : "aulas concluídas"}`);
  if (c.exam_date && c.exam_date >= hoje) {
    const dias = diferencaDias(hoje, c.exam_date);
    partes.push(`${c.exam_label || "prova"} ${dias === 0 ? "hoje" : dias === 1 ? "amanhã" : `em ${dias} dias`}`);
  }
  return partes.join(" · ") || "Comece registrando as aulas que já fez.";
}

export function pctCurso(c: Curso): number {
  return c.total_lessons ? Math.min(1, c.done_lessons / c.total_lessons) : 0;
}

export function pctMateria(m: Materia): number {
  return m.total_lessons ? Math.min(1, m.done_lessons / m.total_lessons) : 0;
}

/** A semana em barras: cada dia preenche conforme o tempo estudado contra a meta do dia */
export function semanaEmBarras(c: Curso, sessoes: Sessao[], hoje: string = hojeISO()) {
  const seg = segundaDa(hoje);
  const metaDia = c.weekly_minutes ? c.weekly_minutes / 5 : 60;
  const dias = Array.from({ length: 7 }, (_, i) => {
    const dia = somarDias(seg, i);
    const feitos = sessoes
      .filter((s) => s.course_id === c.id && s.done_at && hojeISO(new Date(s.starts_at)) === dia)
      .reduce((t, s) => t + duracao(s), 0);
    return { dia, rotulo: SEMANA_CURTA[diaDaSemana(dia)], feitos, pct: Math.min(1, feitos / metaDia), hoje: dia === hoje };
  });
  const total = dias.reduce((t, d) => t + d.feitos, 0);
  return { dias, total, texto: c.weekly_minutes ? `${horas(total)} de ${horas(c.weekly_minutes)} planejadas` : total ? `${horas(total)} estudadas` : "Nenhuma sessão concluída esta semana" };
}

/** A próxima sessão: a que está acontecendo agora ou a próxima marcada */
export function proximaSessao(cursoId: string, sessoes: Sessao[], agora: Date = new Date()): Sessao | null {
  return (
    sessoes
      .filter((s) => s.course_id === cursoId && !s.done_at && fimSessao(s) > agora.getTime())
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0] ?? null
  );
}

/** Linha de cada matéria: "Próxima: Pesquisa de mercado", "Revisão marcada para sexta", "2 aulas nesta semana" */
export function linhaMateria(m: Materia, c: Curso, sessoes: Sessao[], hoje: string = hojeISO()): string {
  if (m.cycle && m.cycle > c.current_cycle) return "Começa no próximo ciclo";
  const marcada = sessoes
    .filter((s) => s.subject_id === m.id && !s.done_at && hojeISO(new Date(s.starts_at)) >= hoje)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0];
  if (m.next_topic) return `Próxima: ${m.next_topic}`;
  if (marcada) {
    const d = hojeISO(new Date(marcada.starts_at));
    return d === hoje ? "Sessão marcada para hoje" : `Sessão marcada para ${SEMANA_LONGA[diaDaSemana(d)]}`;
  }
  const seg = segundaDa(hoje);
  const nestaSemana = sessoes.filter((s) => s.subject_id === m.id && s.done_at && hojeISO(new Date(s.starts_at)) >= seg).length;
  if (nestaSemana) return `${nestaSemana} ${nestaSemana === 1 ? "sessão" : "sessões"} nesta semana`;
  return m.total_lessons ? `${m.done_lessons} de ${m.total_lessons} aulas` : `${m.done_lessons} ${m.done_lessons === 1 ? "aula" : "aulas"}`;
}

/** Cores das matérias (as mesmas do Book) */
export const CORES_MATERIA = ["#7B61E8", "#4C8BD8", "#D46AA6", "#3E9D72", "#E08A4A"];
/** Azul de estudo: cursos sem contexto e sessões no calendário */
export const AZUL_ESTUDO = "#4C8BD8";

/** Rótulos do "ciclo" em cada tipo de curso */
export const NOME_CICLO: Record<TipoCurso, { um: string; varios: string }> = {
  graduacao: { um: "Semestre", varios: "Semestres" },
  pos: { um: "Módulo", varios: "Módulos" },
  idioma: { um: "Nível", varios: "Níveis" },
  concurso: { um: "Ciclo", varios: "Ciclos" },
  curso: { um: "Módulo", varios: "Módulos" },
};

export function emAndamento(s: Sessao, agora: Date = new Date()): boolean {
  const ini = new Date(s.starts_at).getTime();
  return !s.done_at && ini <= agora.getTime() && agora.getTime() < fimSessao(s);
}

/** "Hoje, 19:00 · 50 min", "Amanhã, 08:00 · 1h", "Em andamento · até 19:50" */
export function quandoSessao(s: Sessao, agora: Date = new Date()): string {
  if (emAndamento(s, agora)) return `Em andamento · até ${horaDe(new Date(fimSessao(s)).toISOString())}`;
  const dia = rotuloData(hojeISO(new Date(s.starts_at)), hojeISO(agora));
  return `${dia[0].toUpperCase()}${dia.slice(1)}, ${horaDe(s.starts_at)} · ${horas(duracao(s))}`;
}

/** A matéria para "Começar sessão": a do ciclo com próxima aula definida, ou a menos avançada */
export function materiaSugerida(materias: Materia[], c: Curso): Materia | null {
  const doCiclo = materias.filter((m) => !m.cycle || m.cycle === c.current_cycle);
  return doCiclo.find((m) => m.next_topic) ?? [...doCiclo].sort((a, b) => pctMateria(a) - pctMateria(b) || a.position - b.position)[0] ?? null;
}
