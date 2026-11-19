// Contas de semana para o calendário (datas "AAAA-MM-DD", fuso de São Paulo)
import { diaDaSemana, mesAno, somarDias } from "./datas";

/** Segunda-feira da semana de uma data */
export function segundaDa(iso: string): string {
  const d = diaDaSemana(iso); // 0 = domingo
  return somarDias(iso, d === 0 ? -6 : 1 - d);
}

/** Número da semana ISO 8601 */
export function numeroSemana(iso: string): number {
  const [a, m, d] = iso.split("-").map(Number);
  const data = new Date(Date.UTC(a, m - 1, d));
  const dia = data.getUTCDay() || 7;
  data.setUTCDate(data.getUTCDate() + 4 - dia);
  const inicioAno = new Date(Date.UTC(data.getUTCFullYear(), 0, 1));
  return Math.ceil(((data.getTime() - inicioAno.getTime()) / 86400000 + 1) / 7);
}

/** "Novembro de 2026" (título do calendário) */
export function tituloDoMes(iso: string): string {
  const t = mesAno(iso);
  return t[0].toUpperCase() + t.slice(1);
}

/** Distribui compromissos que se sobrepõem em colunas lado a lado */
export function emColunas<T extends { ini: number; fim: number }>(itens: T[]): (T & { col: number; cols: number })[] {
  const ordenados = [...itens].sort((a, b) => a.ini - b.ini || b.fim - a.fim);
  const saida: (T & { col: number; cols: number })[] = [];
  let grupo: (T & { col: number; cols: number })[] = [];
  let fimGrupo = -1;
  const fechar = () => {
    const cols = Math.max(1, ...grupo.map((g) => g.col + 1));
    grupo.forEach((g) => (g.cols = cols));
    saida.push(...grupo);
    grupo = [];
  };
  for (const it of ordenados) {
    if (it.ini >= fimGrupo && grupo.length) fechar();
    const ocupadas = grupo.filter((g) => g.fim > it.ini).map((g) => g.col);
    let col = 0;
    while (ocupadas.includes(col)) col++;
    grupo.push({ ...it, col, cols: 1 });
    fimGrupo = Math.max(fimGrupo, it.fim);
  }
  if (grupo.length) fechar();
  return saida;
}
