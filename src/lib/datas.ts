// Datas do Rumo: sempre no fuso de São Paulo, sempre como texto "AAAA-MM-DD" (o tipo date do banco).

export const FUSO = "America/Sao_Paulo";

/** Hoje em São Paulo, como "AAAA-MM-DD". */
export function hojeISO(agora: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: FUSO, year: "numeric", month: "2-digit", day: "2-digit" }).format(agora);
}

/** Hora atual em São Paulo, como "HH:MM". */
export function agoraHora(agora: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: FUSO, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(agora);
}

function paraData(iso: string): Date {
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d));
}

function paraISO(data: Date): string {
  return data.toISOString().slice(0, 10);
}

export function somarDias(iso: string, dias: number): string {
  const d = paraData(iso);
  d.setUTCDate(d.getUTCDate() + dias);
  return paraISO(d);
}

/** 0 = domingo … 6 = sábado */
export function diaDaSemana(iso: string): number {
  return paraData(iso).getUTCDay();
}

/** Soma dias úteis (segunda a sexta). Feriados ficam para depois. */
export function somarDiasUteis(iso: string, dias: number): string {
  let atual = iso;
  let faltam = dias;
  while (faltam > 0) {
    atual = somarDias(atual, 1);
    const dia = diaDaSemana(atual);
    if (dia !== 0 && dia !== 6) faltam--;
  }
  return atual;
}

/** Data válida no calendário? */
export function dataExiste(ano: number, mes: number, dia: number): boolean {
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return false;
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  return d.getUTCFullYear() === ano && d.getUTCMonth() === mes - 1 && d.getUTCDate() === dia;
}

export function montarISO(ano: number, mes: number, dia: number): string {
  return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

export function diferencaDias(de: string, ate: string): number {
  return Math.round((paraData(ate).getTime() - paraData(de).getTime()) / 86_400_000);
}

const SEMANA_CURTA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

/** "hoje", "amanhã", "ontem", "sex, 21/11", "21/11/2027" */
export function rotuloData(iso: string, hoje: string = hojeISO()): string {
  const diff = diferencaDias(hoje, iso);
  if (diff === 0) return "hoje";
  if (diff === 1) return "amanhã";
  if (diff === -1) return "ontem";
  const [a, m, d] = iso.split("-");
  const curta = `${d}/${m}`;
  if (a !== hoje.slice(0, 4)) return `${curta}/${a}`;
  if (diff > 1 && diff < 7) return `${SEMANA_CURTA[diaDaSemana(iso)]}, ${curta}`;
  return curta;
}

/** "10:00:00" ou "10:00" → "10h"; "14:30" → "14h30" */
export function rotuloHora(hora: string): string {
  const [h, m] = hora.split(":");
  return m && m !== "00" ? `${Number(h)}h${m}` : `${Number(h)}h`;
}

export function estaAtrasada(item: { due_date: string | null; state: string }, hoje: string = hojeISO()): boolean {
  return item.state !== "concluida" && !!item.due_date && item.due_date < hoje;
}
