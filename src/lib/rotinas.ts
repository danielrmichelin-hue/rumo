// Rotinas & Hábitos (Book 6.3): uma rotina aparece no Hoje quando é a hora dela e some quando não é.
// Sem sequência que zera: a semana mostra o que foi feito, não o que faltou.
import { diaDaSemana, diferencaDias, hojeISO, montarISO, rotuloData, SEMANA_CURTA, SEMANA_LONGA, somarDias } from "./datas";
import { segundaDa } from "./semana";

export type Rotina = {
  id: string;
  title: string;
  context_id: string | null;
  /** um jeito de repetir: dias fixos (0 = domingo … 6 = sábado), "N vezes por semana" ou um dia do mês */
  days: number[] | null;
  times_per_week: number | null;
  month_day: number | null;
  at_time: string | null;
  duration_min: number | null;
  status: "ativa" | "pausada";
  note: string | null;
  position: number;
};

export type Marcacao = { routine_id: string; done_on: string };

export const CAMPOS_ROTINA = "id, title, context_id, days, times_per_week, month_day, at_time, duration_min, status, note, position";
/** Verde do Book para rotinas sem contexto (calendário e lateral) */
export const VERDE_ROTINA = "#3E9D72";

/** Ordem de exibição dos dias: segunda primeiro */
export const SEMANA = [1, 2, 3, 4, 5, 6, 0];

/** "Todo dia", "Dias úteis", "Seg, qua, sex, sáb", "Sexta", "4 vezes por semana", "Todo dia 10" */
export function textoFrequencia(r: Pick<Rotina, "days" | "times_per_week" | "month_day">): string {
  if (r.month_day) return `Todo dia ${r.month_day}`;
  if (!r.days) return r.times_per_week === 1 ? "1 vez por semana" : `${r.times_per_week} vezes por semana`;
  const d = SEMANA.filter((x) => r.days!.includes(x));
  if (d.length === 7) return "Todo dia";
  if (d.length === 5 && !d.includes(0) && !d.includes(6)) return "Dias úteis";
  if (d.length === 1) return SEMANA_LONGA[d[0]][0].toUpperCase() + SEMANA_LONGA[d[0]].slice(1);
  const t = d.map((x) => SEMANA_CURTA[x]).join(", ");
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
    return { dia, rotulo: SEMANA_CURTA[diaDaSemana(dia)], feito: feitos.has(dia), previsto: !!r.days?.includes(diaDaSemana(dia)), hoje: dia === hoje, futuro: dia > hoje };
  });
  const feitas = dias.filter((d) => d.feito).length;
  return { dias, feitas, meta: metaSemana(r), texto: `${feitas} de ${metaSemana(r)} nesta semana` };
}

// ---------- uma vez por mês ("pagar o condomínio todo dia 10") ----------

/** O dia dela neste mês (dia 31 em mês curto vira o último dia) */
export function diaNoMes(r: Pick<Rotina, "month_day">, hoje: string = hojeISO()): string {
  const [a, m] = hoje.split("-").map(Number);
  const ultimo = new Date(Date.UTC(a, m, 0)).getUTCDate();
  return montarISO(a, m, Math.min(r.month_day ?? 1, ultimo));
}

/** Situação no mês: feita (e quando), a partir de quando aparece e a frase curta */
export function mesDaRotina(r: Rotina, marcas: Marcacao[], hoje: string = hojeISO()) {
  const dia = diaNoMes(r, hoje);
  const feitaEm = marcas.filter((m) => m.routine_id === r.id && m.done_on.slice(0, 7) === hoje.slice(0, 7)).map((m) => m.done_on).sort()[0] ?? null;
  const falta = diferencaDias(hoje, dia);
  const texto = feitaEm ? `Feita em ${rotuloData(feitaEm, hoje)}` : falta > 0 ? `Dia ${Number(dia.slice(8))} · ${falta === 1 ? "amanhã" : `em ${falta} dias`}` : falta === 0 ? "Hoje" : `Desde dia ${Number(dia.slice(8))}`;
  return { dia, feitaEm, texto };
}

/** Desde quando buscar as marcações: o que vier antes entre a segunda-feira e o dia 1 do mês */
export const desdeMarcas = (hoje: string = hojeISO()) => [segundaDa(hoje), `${hoje.slice(0, 7)}-01`].sort()[0];

/** É dia dela? Dias fixos: o dia está na lista. "N vezes": enquanto a semana não chegou na meta (ou já foi feita hoje).
 *  Mensal: do dia dela em diante, até ser feita (atraso sem alarme: "desde dia 10"). */
export function eDoDia(r: Rotina, marcas: Marcacao[], hoje: string = hojeISO()): boolean {
  if (r.status !== "ativa") return false;
  if (r.month_day) {
    const m = mesDaRotina(r, marcas, hoje);
    return m.feitaEm ? m.feitaEm === hoje : m.dia <= hoje;
  }
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
