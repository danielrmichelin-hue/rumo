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

export const SEMANA_CURTA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

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

/** "Venceu ontem", "Venceu em 12/11", "Venceu às 10h" (hoje, com hora já passada) */
export function rotuloVencido(iso: string, hora: string | null, hoje: string = hojeISO()): string {
  if (iso === hoje) return hora ? `Atrasada desde as ${rotuloHora(hora)}` : "Vence hoje";
  const dias = -diferencaDias(hoje, iso);
  return `Atrasada há ${dias} ${dias === 1 ? "dia" : "dias"}`;
}

/** Prazo passou? Considera a hora quando o prazo é hoje. */
export function prazoPassou(item: { due_date: string | null; due_time: string | null; state: string }, hoje: string = hojeISO(), agora: string = agoraHora()): boolean {
  if (item.state === "concluida" || !item.due_date) return false;
  if (item.due_date < hoje) return true;
  return item.due_date === hoje && !!item.due_time && item.due_time.slice(0, 5) < agora;
}

export const SEMANA_LONGA = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
export const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** "novembro" */
export const nomeDoMes = (iso: string) => MESES[Number(iso.slice(5, 7)) - 1];
/** "18 de novembro" */
export const diaMes = (iso: string) => `${Number(iso.slice(8, 10))} de ${nomeDoMes(iso)}`;
/** "novembro de 2026" */
export const mesAno = (iso: string) => `${nomeDoMes(iso)} de ${iso.slice(0, 4)}`;

/** "quarta, 18 de novembro" */
export function dataPorExtenso(iso: string): string {
  return `${SEMANA_LONGA[diaDaSemana(iso)]}, ${diaMes(iso)}`;
}

/** "Bom dia", "Boa tarde", "Boa noite" no fuso de São Paulo */
export function saudacao(agora: string = agoraHora()): string {
  const h = Number(agora.slice(0, 2));
  if (h < 5) return "Boa noite";
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

// Brasil sem horário de verão: o dia em São Paulo vai de 00:00 a 23:59 em -03:00

/** Data e hora de São Paulo como instante ISO (UTC) */
export const instante = (data: string, hora: string) => new Date(`${data}T${hora.slice(0, 5)}:00-03:00`).toISOString();
export const inicioDoDia = (iso: string) => instante(iso, "00:00");
export const fimDoDia = (iso: string) => new Date(`${iso}T23:59:59.999-03:00`).toISOString();

/** "HH:MM" de um instante, em São Paulo */
export const horaDe = (timestamp: string) => agoraHora(new Date(timestamp));

/** Parâmetro de rota é um id do banco? */
export const ehId = (v: string | undefined | null): v is string => !!v && /^[0-9a-f-]{36}$/i.test(v);

/** Número digitado: "1.234,5" → 1234.5, "64.00" → 64 (o que não for número vira 0) */
export function numeroBR(v: string): number {
  let t = v.replace(/[R$\s]/g, "");
  // "1.234,56" e "1,5" (vírgula decimal); "64.00" e "0.9" (ponto decimal); "1.234" (ponto de milhar)
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  else if (/\.\d{3}$/.test(t) || (t.match(/\./g) ?? []).length > 1) t = t.replace(/\./g, "");
  const n = Number(t);
  return Number.isFinite(n) ? n : 0;
}

/** "hoje", "1 dia", "5 dias" desde um instante */
export function haDias(timestamp: string, hoje: string = hojeISO()): string {
  const d = Math.max(0, diferencaDias(hojeISO(new Date(timestamp)), hoje));
  return d === 0 ? "hoje" : d === 1 ? "1 dia" : `${d} dias`;
}

/** Mesmo dia, N meses depois (31 em mês curto vira o último dia) */
export function somarMeses(iso: string, n: number): string {
  const [a, m, d] = iso.split("-").map(Number);
  const alvo = new Date(Date.UTC(a, m - 1 + n, 1));
  const ultimo = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate();
  return montarISO(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, Math.min(d, ultimo));
}
