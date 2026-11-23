// Agenda do Google (ou qualquer agenda com endereço iCal): lê os compromissos de um período.
// Entende eventos com hora, fuso (TZID), repetição diária/semanal/mensal (RRULE) e exceções (EXDATE); dia inteiro fica de fora.
import type { Compromisso } from "./tipos";

export type Externo = Compromisso & { externo: true };
/** Compromisso que veio da agenda externa: abre no Google Agenda */
export const ehExterno = (id: string) => id.startsWith("g-");
export const LINK_AGENDA = "https://calendar.google.com/calendar/r";

const DIA = 86400000;
const SEMANA_ICS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

/** Diferença do fuso para UTC, em ms, naquele instante */
function deslocamento(fuso: string, t: number): number {
  try {
    const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: fuso, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(new Date(t)).map((x) => [x.type, x.value]));
    return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - t;
  } catch {
    return -3 * 3600000; // fuso desconhecido: São Paulo
  }
}

/** "20261124T100000" (+ Z ou TZID) → instante; "20261124" → dia inteiro */
function lerData(valor: string, params: string): { t: number; diaInteiro: boolean } | null {
  const m = valor.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/);
  if (!m) return null;
  const [, a, me, d, h, mi, s, z] = m;
  if (!h) return { t: Date.UTC(+a, +me - 1, +d, 3), diaInteiro: true }; // meia-noite em São Paulo
  const local = Date.UTC(+a, +me - 1, +d, +h, +mi, +s);
  if (z) return { t: local, diaInteiro: false };
  const fuso = params.match(/TZID=([^;:]+)/)?.[1] ?? "America/Sao_Paulo";
  return { t: local - deslocamento(fuso, local), diaInteiro: false };
}

type Bruto = { uid: string; titulo: string; local: string | null; ini: number; fim: number; diaInteiro: boolean; rrule: string | null; exdates: Set<number> };

function lerEventos(texto: string): Bruto[] {
  const linhas = texto.replace(/\r?\n[ \t]/g, "").split(/\r?\n/);
  const eventos: Bruto[] = [];
  let e: Partial<Bruto> & { exdates?: Set<number> } | null = null;
  const tirarEscape = (v: string) => v.replace(/\\n/gi, " ").replace(/\\([,;\\])/g, "$1").trim();
  for (const l of linhas) {
    if (l === "BEGIN:VEVENT") { e = { exdates: new Set() }; continue; }
    if (l === "END:VEVENT") {
      if (e?.ini !== undefined && e.titulo !== undefined) eventos.push({ uid: e.uid ?? String(e.ini), titulo: e.titulo, local: e.local ?? null, ini: e.ini, fim: e.fim ?? e.ini + (e.diaInteiro ? DIA : 3600000), diaInteiro: !!e.diaInteiro, rrule: e.rrule ?? null, exdates: e.exdates! });
      e = null; continue;
    }
    if (!e) continue;
    const i = l.indexOf(":"); if (i < 0) continue;
    const [nome, ...resto] = l.slice(0, i).split(";");
    const params = resto.join(";"), valor = l.slice(i + 1);
    if (nome === "UID") e.uid = valor;
    else if (nome === "SUMMARY") e.titulo = tirarEscape(valor) || "(sem título)";
    else if (nome === "LOCATION") e.local = tirarEscape(valor) || null;
    else if (nome === "RRULE") e.rrule = valor;
    else if (nome === "DTSTART") { const d = lerData(valor, params); if (d) { e.ini = d.t; e.diaInteiro = d.diaInteiro; } }
    else if (nome === "DTEND") { const d = lerData(valor, params); if (d) e.fim = d.t; }
    else if (nome === "EXDATE") for (const v of valor.split(",")) { const d = lerData(v, params); if (d) e.exdates!.add(d.t); }
    else if (nome === "STATUS" && valor === "CANCELLED") e.titulo = undefined as unknown as string;
  }
  return eventos;
}

/** As ocorrências de um evento dentro do período (repetições diárias, semanais e mensais) */
function ocorrencias(ev: Bruto, de: number, ate: number): number[] {
  if (!ev.rrule) return ev.ini <= ate && ev.fim >= de ? [ev.ini] : [];
  const r = Object.fromEntries(ev.rrule.split(";").map((p) => p.split("=")));
  const passo = Math.max(1, Number(r.INTERVAL) || 1);
  const ateRegra = r.UNTIL ? lerData(r.UNTIL, "")?.t ?? Infinity : Infinity;
  const limite = Number(r.COUNT) || Infinity;
  const dias = r.BYDAY ? r.BYDAY.split(",").map((d: string) => SEMANA_ICS.indexOf(d.slice(-2))) : null;
  const saida: number[] = [];
  let n = 0;
  for (let k = 0, t = ev.ini; t <= ate && t <= ateRegra && n < limite && k < 3000; k++) {
    let candidatos: number[] = [t];
    if (r.FREQ === "WEEKLY" && dias) {
      const base = t - ((new Date(t - 3 * 3600000).getUTCDay()) * DIA); // domingo da semana (em São Paulo)
      candidatos = dias.map((d: number) => base + d * DIA).filter((c: number) => c >= ev.ini).sort((a: number, b: number) => a - b);
    }
    for (const c of candidatos) {
      if (c > ate || c > ateRegra || n >= limite) break;
      n++;
      if (c + (ev.fim - ev.ini) >= de && !ev.exdates.has(c)) saida.push(c);
    }
    if (r.FREQ === "DAILY") t += passo * DIA;
    else if (r.FREQ === "WEEKLY") t += passo * 7 * DIA;
    else if (r.FREQ === "MONTHLY") { const d = new Date(t); d.setUTCMonth(d.getUTCMonth() + passo); t = d.getTime(); }
    else if (r.FREQ === "YEARLY") { const d = new Date(t); d.setUTCFullYear(d.getUTCFullYear() + passo); t = d.getTime(); }
    else break;
  }
  return saida;
}

/** Compromissos da agenda externa entre dois instantes (ISO). Falhou a leitura: lista vazia, sem travar a tela. */
export async function agendaExterna(url: string | null | undefined, deISO: string, ateISO: string): Promise<Externo[]> {
  if (!url || !/^https:\/\//.test(url)) return [];
  try {
    const r = await fetch(url, { next: { revalidate: 300 }, signal: AbortSignal.timeout(4000) });
    if (!r.ok) return [];
    const de = new Date(deISO).getTime(), ate = new Date(ateISO).getTime();
    // Eventos de dia inteiro (aniversários, feriados) ficam de fora: o Rumo mostra o que tem hora marcada
    return lerEventos(await r.text()).filter((ev) => !ev.diaInteiro).flatMap((ev) =>
      ocorrencias(ev, de, ate).map((t) => ({
        id: `g-${ev.uid}-${t}`, title: ev.titulo, context_id: null, location: ev.local,
        starts_at: new Date(t).toISOString(), ends_at: new Date(t + (ev.fim - ev.ini)).toISOString(), course_id: null, done_at: null, externo: true as const,
      })),
    );
  } catch {
    return [];
  }
}
