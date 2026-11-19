// Rotinas & Hábitos (Book 6.3): uma rotina aparece no Hoje quando é a hora dela e some quando não é.
// Sem sequência que zera: a semana mostra o que foi feito, não o que faltou.
import { diaDaSemana, hojeISO, somarDias } from "./datas";
import { segundaDa } from "./semana";

export type Rotina = {
  id: string;
  title: string;
  context_id: string | null;
  /** dias fixos (0 = domingo … 6 = sábado); nulo quando é "N vezes por semana" */
  days: number[] | null;
  times_per_week: number | null;
  at_time: string | null;
  duration_min: number | null;
  status: "ativa" | "pausada";
  note: string | null;
  position: number;
};

export type Marcacao = { routine_id: string; done_on: string };

export const CAMPOS_ROTINA = "id, title, context_id, days, times_per_week, at_time, duration_min, status, note, position";
/** Verde do Book para rotinas sem contexto (calendário e lateral) */
export const VERDE_ROTINA = "#3E9D72";

const NOMES = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const NOMES_LONGOS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
/** Ordem de exibição dos dias: segunda primeiro */
export const SEMANA = [1, 2, 3, 4, 5, 6, 0];

/** "Todo dia", "Dias úteis", "Seg, qua, sex, sáb", "Sexta", "4 vezes por semana" */
export function textoFrequencia(r: Pick<Rotina, "days" | "times_per_week">): string {
  if (!r.days) return r.times_per_week === 1 ? "1 vez por semana" : `${r.times_per_week} vezes por semana`;
  const d = SEMANA.filter((x) => r.days!.includes(x));
  if (d.length === 7) return "Todo dia";
  if (d.length === 5 && !d.includes(0) && !d.includes(6)) return "Dias úteis";
  if (d.length === 1) return NOMES_LONGOS[d[0]];
  const t = d.map((x) => NOMES[x]).join(", ");
  return t[0].toUpperCase() + t.slice(1);
}

/** Quantas vezes na semana: os dias fixos ou o "N vezes" */
export const metaSemana = (r: Rotina) => r.days?.length ?? r.times_per_week ?? 1;

/** A semana da rotina, de segunda a domingo: feito, previsto, hoje */
export function semanaDaRotina(r: Rotina, marcas: Marcacao[], hoje: string = hojeISO()) {
  const seg = segundaDa(hoje);
  const feitos = new Set(marcas.filter((m) => m.routine_id === r.id).map((m) => m.done_on));
  const dias = Array.from({ length: 7 }, (_, i) => {
    const dia = somarDias(seg, i);
    return { dia, rotulo: NOMES[diaDaSemana(dia)], feito: feitos.has(dia), previsto: !!r.days?.includes(diaDaSemana(dia)), hoje: dia === hoje, futuro: dia > hoje };
  });
  const feitas = dias.filter((d) => d.feito).length;
  return { dias, feitas, meta: metaSemana(r), texto: `${feitas} de ${metaSemana(r)} nesta semana` };
}

/** É dia dela? Dias fixos: o dia está na lista. "N vezes": enquanto a semana não chegou na meta (ou já foi feita hoje). */
export function eDoDia(r: Rotina, marcas: Marcacao[], hoje: string = hojeISO()): boolean {
  if (r.status !== "ativa") return false;
  if (r.days) return r.days.includes(diaDaSemana(hoje));
  const s = semanaDaRotina(r, marcas, hoje);
  return s.feitas < s.meta || s.dias.some((d) => d.hoje && d.feito);
}

export const feitaEm = (r: Rotina, marcas: Marcacao[], dia: string) => marcas.some((m) => m.routine_id === r.id && m.done_on === dia);

/** As rotinas do dia, por horário (sem horário por último) */
export function rotinasDoDia(rotinas: Rotina[], marcas: Marcacao[], hoje: string = hojeISO()) {
  return rotinas
    .filter((r) => eDoDia(r, marcas, hoje))
    .sort((a, b) => (a.at_time ?? "99").localeCompare(b.at_time ?? "99") || a.position - b.position);
}

/** "07:00" a partir de "07:00:00" */
export const hora = (t: string | null) => (t ? t.slice(0, 5) : null);

/** Sugestões a partir da resposta das perguntas do começo */
export const SUGESTOES: Record<string, { title: string; days: number[]; at_time: string; duration_min: number }> = {
  Academia: { title: "Academia", days: [1, 3, 5], at_time: "07:00", duration_min: 60 },
  Leitura: { title: "Ler 20 páginas", days: [0, 1, 2, 3, 4, 5, 6], at_time: "21:00", duration_min: 30 },
  "Meditação": { title: "Meditar", days: [0, 1, 2, 3, 4, 5, 6], at_time: "07:00", duration_min: 10 },
  "Revisar a semana": { title: "Revisar a semana", days: [5], at_time: "17:30", duration_min: 30 },
};
