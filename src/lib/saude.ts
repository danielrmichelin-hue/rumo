// Saúde: remédios no horário, consultas e exames, medidas ao longo do tempo. Tudo só com a pessoa.
// Remédio = rotina com dose; cada horário é uma rotina (marcar 8h não marca 20h).
// Consulta, exame, vacina, procedimento = compromisso do calendário com health_kind.
import { diaMes, hojeISO, rotuloData, somarDias } from "./datas";
import { feitaEm, type Marcacao, type Rotina } from "./rotinas";

export const TIPOS_SAUDE = {
  consulta: "Consulta",
  exame: "Exame",
  vacina: "Vacina",
  procedimento: "Procedimento",
} as const;
export type TipoSaude = keyof typeof TIPOS_SAUDE;

/** Contexto de saúde da pessoa, pelo nome */
export const ehSaude = (nome: string) => /^sa[uú]de\b/i.test(nome.trim());

// ---------- remédios ----------

export type Remedio = {
  chave: string;
  title: string;
  dose: string;
  ends_on: string | null;
  context_id: string | null;
  ativo: boolean;
  /** um por horário, em ordem */
  doses: { rotina: Rotina; hora: string | null }[];
};

/** Junta as rotinas de um mesmo remédio (mesmo nome e dose) */
export function agruparRemedios(rotinas: Rotina[]): Remedio[] {
  const mapa = new Map<string, Remedio>();
  for (const r of rotinas.filter((x) => x.dose)) {
    const chave = `${r.title.toLowerCase()}|${r.dose!.toLowerCase()}|${r.status}`;
    const m = mapa.get(chave) ?? { chave, title: r.title, dose: r.dose!, ends_on: r.ends_on ?? null, context_id: r.context_id, ativo: r.status === "ativa", doses: [] };
    m.doses.push({ rotina: r, hora: r.at_time ? r.at_time.slice(0, 5) : null });
    if (r.ends_on && (!m.ends_on || r.ends_on > m.ends_on)) m.ends_on = r.ends_on;
    mapa.set(chave, m);
  }
  for (const m of mapa.values()) m.doses.sort((a, b) => (a.hora ?? "99").localeCompare(b.hora ?? "99"));
  return [...mapa.values()].sort((a, b) => (a.doses[0].hora ?? "99").localeCompare(b.doses[0].hora ?? "99") || a.title.localeCompare(b.title));
}

/** "Uso contínuo", "Até 30 de novembro", "Termina hoje", "Terminou em 12 de novembro" */
export function textoTratamento(ends_on: string | null, hoje: string = hojeISO()): string {
  if (!ends_on) return "Uso contínuo";
  if (ends_on === hoje) return "Termina hoje";
  return ends_on > hoje ? `Até ${diaMes(ends_on)}` : `Terminou em ${diaMes(ends_on)}`;
}

/** Doses de hoje: tomadas e no total (só remédios ativos e em tratamento) */
export function dosesDeHoje(remedios: Remedio[], marcas: Marcacao[], hoje: string = hojeISO()) {
  const doses = remedios.filter((m) => m.ativo && (!m.ends_on || m.ends_on >= hoje)).flatMap((m) => m.doses);
  return { total: doses.length, tomadas: doses.filter((d) => feitaEm(d.rotina, marcas, hoje)).length };
}

// ---------- medidas ----------

export type TipoMedida = "peso" | "pressao" | "glicemia" | "sono" | "cintura" | "outro";
export type Medida = { id: string; kind: TipoMedida; label: string | null; value: number; value2: number | null; measured_on: string; note: string | null };
export const CAMPOS_MEDIDA = "id, kind, label, value, value2, measured_on, note";

export const MEDIDAS: Record<TipoMedida, { rotulo: string; unidade: string; casas: number }> = {
  peso: { rotulo: "Peso", unidade: "kg", casas: 1 },
  pressao: { rotulo: "Pressão", unidade: "mmHg", casas: 0 },
  glicemia: { rotulo: "Glicemia", unidade: "mg/dL", casas: 0 },
  sono: { rotulo: "Sono", unidade: "h", casas: 1 },
  cintura: { rotulo: "Cintura", unidade: "cm", casas: 0 },
  outro: { rotulo: "Outra", unidade: "", casas: 1 },
};

export const normalizarMedida = (m: Record<string, unknown>): Medida => ({ ...(m as Medida), value: Number(m.value), value2: m.value2 === null || m.value2 === undefined ? null : Number(m.value2) });

const num = (v: number, casas: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: casas });

/** "82,4 kg", "120/80", "7,5 h" */
export function valorMedida(m: Pick<Medida, "kind" | "value" | "value2">): string {
  const t = MEDIDAS[m.kind];
  if (m.kind === "pressao") return `${num(m.value, 0)}/${num(m.value2 ?? 0, 0)}`;
  return `${num(m.value, t.casas)}${t.unidade ? ` ${t.unidade}` : ""}`;
}

export type Serie = { chave: string; kind: TipoMedida; rotulo: string; pontos: Medida[]; ultima: Medida; variacao: string | null };

/** Uma série por medida (a "outra" separa pelo nome), com a última e a variação desde a primeira dos últimos 90 dias */
export function seriesDeMedidas(medidas: Medida[], hoje: string = hojeISO()): Serie[] {
  const grupos = new Map<string, Medida[]>();
  for (const m of [...medidas].sort((a, b) => a.measured_on.localeCompare(b.measured_on))) {
    const chave = m.kind === "outro" ? `outro:${(m.label ?? "").toLowerCase()}` : m.kind;
    grupos.set(chave, [...(grupos.get(chave) ?? []), m]);
  }
  const ordem = Object.keys(MEDIDAS);
  return [...grupos.entries()]
    .map(([chave, pontos]) => {
      const ultima = pontos[pontos.length - 1];
      const desde = somarDias(hoje, -90);
      const base = pontos.find((p) => p.measured_on >= desde && p !== ultima);
      let variacao: string | null = null;
      if (base && ultima.kind !== "pressao") {
        const d = ultima.value - base.value;
        const t = MEDIDAS[ultima.kind];
        variacao = Math.abs(d) < 10 ** -t.casas / 2 ? `Igual desde ${rotuloData(base.measured_on, hoje)}` : `${d > 0 ? "+" : "−"}${num(Math.abs(d), t.casas)}${t.unidade ? ` ${t.unidade}` : ""} desde ${rotuloData(base.measured_on, hoje)}`;
      }
      return { chave, kind: ultima.kind, rotulo: ultima.kind === "outro" ? ultima.label ?? "Outra" : MEDIDAS[ultima.kind].rotulo, pontos: pontos.slice(-12), ultima, variacao };
    })
    .sort((a, b) => ordem.indexOf(a.kind) - ordem.indexOf(b.kind) || a.rotulo.localeCompare(b.rotulo));
}
