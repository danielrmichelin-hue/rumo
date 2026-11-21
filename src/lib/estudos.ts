// Estudos (Book 6.2) como ciclo de estudos: cada matéria tem horas no ciclo e uma lista de temas.
// O ciclo segue as matérias em ordem; fecha quando todas chegam nas horas e recomeça.
// As sessões são compromissos do Core (events com course_id); o tempo estudado vem das sessões concluídas.
import { diaDaSemana, diferencaDias, hojeISO, horaDe, rotuloData, SEMANA_CURTA, somarDias } from "./datas";
import { segundaDa } from "./semana";

export type TipoCurso = "graduacao" | "pos" | "idioma" | "concurso" | "curso";

export const TIPOS_CURSO: Record<TipoCurso, string> = {
  graduacao: "Graduação",
  pos: "Pós",
  idioma: "Idiomas",
  concurso: "Concurso",
  curso: "Curso livre",
};


export type Curso = {
  id: string;
  title: string;
  kind: TipoCurso;
  context_id: string | null;
  total_lessons: number | null;
  done_lessons: number;
  /** número do ciclo de estudos atual e quando ele começou */
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
  /** horas desta matéria em cada ciclo, em minutos */
  cycle_minutes: number | null;
  color: string;
  position: number;
};

/** Aula ou tema de uma matéria: visto em `done_at`; depois, revisões em 1, 7 e 30 dias */
export type Tema = { id: string; subject_id: string; module_id: string | null; title: string; position: number; done_at: string | null; review_step: number; next_review_on: string | null };
export type Modulo = { id: string; subject_id: string; title: string; position: number };

export type Sessao = {
  id: string;
  title: string;
  course_id: string | null;
  subject_id: string | null;
  topic_id: string | null;
  starts_at: string;
  ends_at: string | null;
  done_at: string | null;
  context_id: string | null;
  location: string | null;
};

export const CAMPOS_CURSO = "id, title, kind, context_id, total_lessons, done_lessons, current_cycle, cycle_started_on, weekly_minutes, exam_date, exam_label, status, note";
export const CAMPOS_MATERIA = "id, course_id, title, cycle_minutes, color, position";
export const CAMPOS_TEMA = "id, subject_id, module_id, title, position, done_at, review_step, next_review_on";
export const CAMPOS_MODULO = "id, subject_id, title, position";
export const CAMPOS_SESSAO = "id, title, course_id, subject_id, topic_id, starts_at, ends_at, done_at, context_id, location";

/** Cores das matérias (as mesmas do Book) */
export const CORES_MATERIA = ["#7B61E8", "#4C8BD8", "#D46AA6", "#3E9D72", "#E08A4A", "#C9A227", "#5B6B8C"];
/** Azul de estudo: estudos sem contexto e sessões no calendário */
export const AZUL_ESTUDO = "#4C8BD8";

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

const diaDa = (s: Pick<Sessao, "starts_at">) => hojeISO(new Date(s.starts_at));

// ---------- o ciclo ----------

export type LinhaCiclo = { materia: Materia; feito: number; meta: number | null; pct: number; completa: boolean };

/** Quanto cada matéria já teve neste ciclo, a próxima da vez e se o ciclo fechou */
export function resumoDoCiclo(c: Curso, materias: Materia[], sessoes: Sessao[]) {
  const doCiclo = sessoes.filter((s) => s.course_id === c.id && s.done_at && diaDa(s) >= c.cycle_started_on);
  const linhas: LinhaCiclo[] = [...materias]
    .sort((a, b) => a.position - b.position)
    .map((m) => {
      const feito = doCiclo.filter((s) => s.subject_id === m.id).reduce((t, s) => t + duracao(s), 0);
      const meta = m.cycle_minutes;
      return { materia: m, feito, meta, pct: meta ? Math.min(1, feito / meta) : 0, completa: !!meta && feito >= meta };
    });
  const comMeta = linhas.filter((l) => l.meta);
  const meta = comMeta.reduce((t, l) => t + l.meta!, 0);
  const feito = comMeta.reduce((t, l) => t + Math.min(l.feito, l.meta!), 0);
  const completo = comMeta.length > 0 && comMeta.every((l) => l.completa);
  // Próxima da vez: a primeira, na ordem do ciclo, que ainda não chegou nas horas
  const proxima = linhas.find((l) => l.meta && !l.completa) ?? (comMeta.length ? null : [...linhas].sort((a, b) => a.feito - b.feito)[0] ?? null);
  return { linhas, meta, feito, pct: meta ? feito / meta : 0, completo, proxima };
}

/** "Ciclo 2 · 14h de 30h · começou em 10/11" */
export function linhaDoCiclo(c: Curso, r: { meta: number; feito: number }, hoje: string = hojeISO()): string {
  const partes = [`Ciclo ${c.current_cycle}`];
  if (r.meta) partes.push(`${horas(r.feito)} de ${horas(r.meta)}`);
  partes.push(c.cycle_started_on === hoje ? "começou hoje" : `começou ${rotuloData(c.cycle_started_on, hoje).replace(/^(\d)/, "em $1")}`);
  return partes.join(" · ");
}

/** "Prova em 40 dias · 38 de 60 aulas" */
export function linhaDoEstudo(c: Curso, hoje: string = hojeISO()): string {
  const partes: string[] = [];
  if (c.exam_date && c.exam_date >= hoje) {
    const dias = diferencaDias(hoje, c.exam_date);
    const nome = c.exam_label || "prova";
    partes.push(`${nome[0].toUpperCase()}${nome.slice(1)} ${dias === 0 ? "hoje" : dias === 1 ? "amanhã" : `em ${dias} dias`}`);
  }
  if (c.total_lessons) partes.push(`${c.done_lessons} de ${c.total_lessons} aulas`);
  return partes.join(" · ");
}

// ---------- temas ----------

export function temasDa(m: Materia, temas: Tema[]) {
  const daMateria = temas.filter((t) => t.subject_id === m.id).sort((a, b) => a.position - b.position);
  const feitos = daMateria.filter((t) => t.done_at).length;
  return { lista: daMateria, feitos, total: daMateria.length, proximo: daMateria.find((t) => !t.done_at) ?? null };
}

// ---------- semana e sessões ----------

/** A semana em barras: cada dia preenche conforme o tempo estudado contra a meta do dia */
export function semanaEmBarras(c: Curso, sessoes: Sessao[], hoje: string = hojeISO()) {
  const seg = segundaDa(hoje);
  const metaDia = c.weekly_minutes ? c.weekly_minutes / 5 : 60;
  const dias = Array.from({ length: 7 }, (_, i) => {
    const dia = somarDias(seg, i);
    const feitos = sessoes.filter((s) => s.course_id === c.id && s.done_at && diaDa(s) === dia).reduce((t, s) => t + duracao(s), 0);
    return { dia, rotulo: SEMANA_CURTA[diaDaSemana(dia)], feitos, pct: Math.min(1, feitos / metaDia), hoje: dia === hoje };
  });
  const total = dias.reduce((t, d) => t + d.feitos, 0);
  return { dias, total, texto: c.weekly_minutes ? `${horas(total)} de ${horas(c.weekly_minutes)}` : total ? `${horas(total)} estudadas` : "Nada registrado ainda" };
}

export function emAndamento(s: Sessao, agora: Date = new Date()): boolean {
  return !s.done_at && new Date(s.starts_at).getTime() <= agora.getTime() && agora.getTime() < fimSessao(s);
}

/** A sessão acontecendo agora ou a próxima marcada */
export function proximaSessao(cursoId: string, sessoes: Sessao[], agora: Date = new Date()): Sessao | null {
  return sessoes.filter((s) => s.course_id === cursoId && !s.done_at && fimSessao(s) > agora.getTime()).sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0] ?? null;
}

/** Sessões marcadas que já passaram sem ser concluídas: o Rumo pergunta se aconteceram, sem cobrar */
export function sessoesParaConfirmar(cursoId: string, sessoes: Sessao[], agora: Date = new Date()): Sessao[] {
  return sessoes.filter((s) => s.course_id === cursoId && !s.done_at && fimSessao(s) <= agora.getTime());
}

/** "Hoje, 19:00 · 50 min", "Amanhã, 08:00 · 1h", "Em andamento · até 19:50" */
export function quandoSessao(s: Sessao, agora: Date = new Date()): string {
  if (emAndamento(s, agora)) return `Em andamento · até ${horaDe(new Date(fimSessao(s)).toISOString())}`;
  const dia = rotuloData(diaDa(s), hojeISO(agora));
  return `${dia[0].toUpperCase()}${dia.slice(1)}, ${horaDe(s.starts_at)} · ${horas(duracao(s))}`;
}

// ---------- revisões espaçadas ----------

/** Dias até cada revisão depois de ver: 1, 7 e 30 */
export const INTERVALOS = [1, 7, 30];

/** A próxima revisão depois de `feitas` revisões (null quando acabou) */
export function proximaRevisao(feitas: number, dia: string = hojeISO()): string | null {
  return feitas < INTERVALOS.length ? somarDias(dia, INTERVALOS[feitas]) : null;
}

/** "Revisar hoje", "Revisão em 6 dias", "Revisado 3 vezes", "Não vista" */
export function textoRevisao(t: Tema, hoje: string = hojeISO()): { texto: string; tom: "hoje" | "depois" | "ok" | "nada" } {
  if (!t.done_at) return { texto: "Não vista", tom: "nada" };
  if (!t.next_review_on) return { texto: t.review_step ? `Revisado ${t.review_step} ${t.review_step === 1 ? "vez" : "vezes"}` : "Vista", tom: "ok" };
  const dias = diferencaDias(hoje, t.next_review_on);
  if (dias <= 0) return { texto: dias < 0 ? "Revisar (ficou para trás)" : "Revisar hoje", tom: "hoje" };
  return { texto: `${t.review_step + 1}ª revisão ${dias === 1 ? "amanhã" : `em ${dias} dias`}`, tom: "depois" };
}

export const revisoesDoDia = (temas: Tema[], hoje: string = hojeISO()) => temas.filter((t) => t.done_at && t.next_review_on && t.next_review_on <= hoje);
