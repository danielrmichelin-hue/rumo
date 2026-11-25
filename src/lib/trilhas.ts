// Estudos: Área (Profissional, Intelectual) > Projeto > Disciplina > Aulas numeradas.
// Cada área tem N aulas por dia (1 aula = 1 hora) em certos dias da semana; as disciplinas andam em paralelo:
// a cada dia, as N primeiras da fila que ainda têm aula dão uma aula cada. Quando uma acaba, a próxima entra.
// O roadmap é recalculado a partir de hoje com o que falta: se faltar um dia, as datas andam sozinhas.
import { diaDaSemana, somarDias } from "./datas";

export type Area = { id: string; name: string; daily_lessons: number; weekdays: number[]; position: number };
export type ProjetoEstudo = { id: string; area_id: string; name: string; color: string; position: number; archived: boolean };
export type Disciplina = { id: string; project_id: string; name: string; position: number };
export type Aula = { id: string; discipline_id: string; number: number; title: string | null; done_on: string | null; minutes: number | null; note: string | null };

export const CAMPOS_AREA = "id, name, daily_lessons, weekdays, position";
export const CAMPOS_PROJETO_ESTUDO = "id, area_id, name, color, position, archived";
export const CAMPOS_DISCIPLINA = "id, project_id, name, position";
export const CAMPOS_AULA = "id, discipline_id, number, title, done_on, minutes, note";
export const CORES_PROJETO = ["#6C4ED9", "#2a78d6", "#1baf7a", "#eb6834", "#e87ba4", "#eda100", "#008300", "#e34948"];

export const normalizarArea = (a: Record<string, unknown>): Area => ({
  ...(a as Area), daily_lessons: Number(a.daily_lessons ?? 0), position: Number(a.position ?? 0),
  weekdays: (Array.isArray(a.weekdays) ? a.weekdays : [1, 2, 3, 4, 5]).map(Number).filter((d) => d >= 0 && d <= 6),
});

/** Nome da aula: "Psicologia do Consumidor · Aula 3" (com o título, se tiver) */
export const nomeDaAula = (d: Pick<Disciplina, "name">, a: Pick<Aula, "number" | "title">) => `${d.name} · Aula ${a.number}${a.title ? `: ${a.title}` : ""}`;

/** A fila de uma área: as disciplinas na ordem dos projetos (não arquivados) e, dentro deles, na ordem das disciplinas */
export function filaDaArea(area: Area, projetos: ProjetoEstudo[], disciplinas: Disciplina[]) {
  const doArea = projetos.filter((p) => p.area_id === area.id && !p.archived).sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));
  return doArea.flatMap((p) => disciplinas.filter((d) => d.project_id === p.id).sort((a, b) => a.position - b.position || a.name.localeCompare(b.name)).map((d) => ({ d, p })));
}

export type Situacao = {
  total: number; feitas: number; restantes: number; minutos: number;
  proxima: Aula | null; feitaHoje: Aula | null; inicio: string | null; fim: string | null; ultimaFeita: string | null;
};

/** A situação de cada disciplina: quantas aulas, quantas feitas, a próxima e a feita hoje */
export function situacaoDisciplina(aulas: Aula[], hoje: string): Omit<Situacao, "inicio" | "fim"> {
  const ordem = [...aulas].sort((a, b) => a.number - b.number);
  const feitas = ordem.filter((a) => a.done_on);
  const datas = feitas.map((a) => a.done_on!).sort();
  return {
    total: ordem.length, feitas: feitas.length, restantes: ordem.length - feitas.length,
    minutos: feitas.reduce((t, a) => t + (a.minutes ?? 0), 0),
    proxima: ordem.find((a) => !a.done_on) ?? null,
    feitaHoje: [...feitas].reverse().find((a) => a.done_on === hoje) ?? null,
    ultimaFeita: datas[datas.length - 1] ?? null,
  };
}

/** É dia de estudar nessa área? */
export const diaDeEstudo = (area: Pick<Area, "weekdays">, dia: string) => area.weekdays.includes(diaDaSemana(dia));

/**
 * O roadmap da área a partir de hoje: em que dia cada disciplina começa e termina.
 * Hoje conta: quem já deu aula hoje ocupa o seu lugar do dia; os outros lugares de hoje ainda podem ser feitos.
 */
export function roadmapDaArea(area: Area, fila: { d: Disciplina; p: ProjetoEstudo }[], aulasDe: (id: string) => Aula[], hoje: string) {
  const sit = new Map(fila.map(({ d }) => [d.id, situacaoDisciplina(aulasDe(d.id), hoje)]));
  const restantes = new Map(fila.map(({ d }) => [d.id, sit.get(d.id)!.restantes]));
  const inicio = new Map<string, string>(), fim = new Map<string, string>();
  // O que já aconteceu: começou na primeira aula feita; se já acabou, terminou na última
  for (const { d } of fila) {
    const aulas = aulasDe(d.id).filter((a) => a.done_on).map((a) => a.done_on!).sort();
    if (aulas.length) inicio.set(d.id, aulas[0]);
    if (sit.get(d.id)!.restantes === 0 && sit.get(d.id)!.total > 0) fim.set(d.id, aulas[aulas.length - 1] ?? hoje);
  }
  const vagas = Math.max(0, area.daily_lessons);
  if (vagas > 0 && area.weekdays.length) {
    let dia = hoje;
    for (let passo = 0; passo < 5000 && [...restantes.values()].some((r) => r > 0); passo++, dia = somarDias(dia, 1)) {
      if (!diaDeEstudo(area, dia)) continue;
      // Hoje, quem já deu aula hoje está na roda (mesmo que tenha acabado hoje) e já gastou a vaga
      const naRoda = fila.filter(({ d }) => restantes.get(d.id)! > 0 || (dia === hoje && sit.get(d.id)!.feitaHoje)).slice(0, vagas);
      for (const { d } of naRoda) {
        if (dia === hoje && sit.get(d.id)!.feitaHoje) continue;
        if (restantes.get(d.id)! <= 0) continue;
        if (!inicio.has(d.id)) inicio.set(d.id, dia);
        const r = restantes.get(d.id)! - 1;
        restantes.set(d.id, r);
        if (r === 0) fim.set(d.id, dia);
      }
    }
  }
  return fila.map(({ d, p }) => ({ d, p, ...sit.get(d.id)!, inicio: inicio.get(d.id) ?? null, fim: fim.get(d.id) ?? null }));
}

/** As aulas de hoje numa área: uma de cada disciplina na roda (a feita hoje, ou a próxima) */
export function aulasDeHoje(area: Area, fila: { d: Disciplina; p: ProjetoEstudo }[], aulasDe: (id: string) => Aula[], hoje: string) {
  if (!diaDeEstudo(area, hoje) || area.daily_lessons <= 0) return [];
  return fila
    .map(({ d, p }) => ({ d, p, s: situacaoDisciplina(aulasDe(d.id), hoje) }))
    .filter(({ s }) => s.restantes > 0 || s.feitaHoje)
    .slice(0, area.daily_lessons)
    .map(({ d, p, s }) => ({ d, p, aula: (s.feitaHoje ?? s.proxima)!, feita: !!s.feitaHoje, s }))
    .filter((x) => x.aula);
}
