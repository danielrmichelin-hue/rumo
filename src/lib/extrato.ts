// Extrato do banco (a aba Extrato da planilha): lê o arquivo que o Nubank exporta (CSV ou OFX)
// e confere linha a linha com os lançamentos: o que já está no Rumo, o que falta lançar e o que sobra.
import { ehAjuste, naConta, type Lancamento } from "./financas";

export type LinhaExtrato = { n: number; dia: string; valor: number; descricao: string; ref: string };

const r2 = (v: number) => Math.round(v * 100) / 100;

/** "-1.234,56", "-1234.56", "1234,5" → número com sinal */
function valorDoBanco(v: string): number | null {
  let t = v.trim().replace(/[R$\s"]/g, "");
  if (!t) return null;
  if (t.includes(",") && t.includes(".")) t = t.lastIndexOf(",") > t.lastIndexOf(".") ? t.replace(/\./g, "").replace(",", ".") : t.replace(/,/g, "");
  else if (t.includes(",")) t = t.replace(",", ".");
  const n = Number(t);
  return Number.isFinite(n) ? r2(n) : null;
}

/** "24/11/2026", "2026-11-24", "20261124" → "2026-11-24" */
function diaDoBanco(v: string): string | null {
  const t = v.trim().replace(/"/g, "");
  const m = t.match(/^(\d{2})\/(\d{2})\/(\d{4})/) ?? t.match(/^(\d{4})-?(\d{2})-?(\d{2})/);
  if (!m) return null;
  const [a, me, d] = m[3]?.length === 4 ? [m[3], m[2], m[1]] : [m[1], m[2], m[3]];
  const iso = `${a}-${me}-${d}`;
  const x = new Date(`${iso}T12:00:00Z`);
  return Number.isNaN(x.getTime()) || x.toISOString().slice(0, 10) !== iso ? null : iso;
}

/** Separa uma linha de CSV respeitando aspas */
function colunas(linha: string, sep: string): string[] {
  const out: string[] = [];
  let atual = "", aspas = false;
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i];
    if (c === '"') { if (aspas && linha[i + 1] === '"') { atual += '"'; i++; } else aspas = !aspas; }
    else if (c === sep && !aspas) { out.push(atual); atual = ""; }
    else atual += c;
  }
  out.push(atual);
  return out.map((x) => x.trim());
}

const semAcento = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Lê o arquivo do banco. Erro em português quando não dá para confiar no que foi lido. */
export function lerExtrato(texto: string): { linhas: LinhaExtrato[]; erro?: string } {
  const limpo = texto.replace(/^﻿/, "");
  // OFX: cada <STMTTRN> tem DTPOSTED, TRNAMT, MEMO e FITID
  if (/<OFX>|<STMTTRN>/i.test(limpo)) {
    const linhas: LinhaExtrato[] = [];
    const blocos = limpo.split(/<STMTTRN>/i).slice(1);
    for (const [i, b] of blocos.entries()) {
      const campo = (nome: string) => b.match(new RegExp(`<${nome}>([^<\\r\\n]*)`, "i"))?.[1]?.trim() ?? "";
      const dia = diaDoBanco(campo("DTPOSTED")), valor = valorDoBanco(campo("TRNAMT"));
      if (!dia || valor === null) return { linhas: [], erro: `Não consegui ler o lançamento ${i + 1} do arquivo OFX.` };
      linhas.push({ n: i + 1, dia, valor, descricao: campo("MEMO") || campo("NAME") || "Sem descrição", ref: campo("FITID") });
    }
    return linhas.length ? { linhas } : { linhas: [], erro: "O arquivo OFX não tem lançamentos." };
  }
  const brutas = limpo.split(/\r?\n/).filter((l) => l.trim());
  if (!brutas.length) return { linhas: [], erro: "O arquivo está vazio." };
  const sep = (brutas[0].match(/;/g) ?? []).length > (brutas[0].match(/,/g) ?? []).length ? ";" : ",";
  const cab = colunas(brutas[0], sep).map(semAcento);
  const achar = (...nomes: string[]) => cab.findIndex((c) => nomes.some((n) => c.includes(n)));
  const temCabecalho = achar("data") >= 0 && achar("valor") >= 0;
  // Nubank: Data, Valor, Identificador, Descrição
  const iData = temCabecalho ? achar("data") : 0;
  const iValor = temCabecalho ? achar("valor") : 1;
  const iRef = temCabecalho ? achar("identificador", "id") : 2;
  const iDesc = temCabecalho ? achar("descri", "historico", "memo") : 3;
  const linhas: LinhaExtrato[] = [];
  for (const [i, bruta] of brutas.slice(temCabecalho ? 1 : 0).entries()) {
    const c = colunas(bruta, sep);
    const dia = diaDoBanco(c[iData] ?? ""), valor = valorDoBanco(c[iValor] ?? "");
    if (!dia || valor === null) return { linhas: [], erro: `Não consegui ler a linha ${i + (temCabecalho ? 2 : 1)} do arquivo: "${bruta.slice(0, 60)}". Use o CSV ou o OFX que o Nubank exporta.` };
    linhas.push({ n: i + 1, dia, valor, descricao: (iDesc >= 0 ? c[iDesc] : "") || "Sem descrição", ref: iRef >= 0 ? c[iRef] ?? "" : "" });
  }
  return linhas.length ? { linhas } : { linhas: [], erro: "O arquivo não tem lançamentos." };
}

const DIA = 86400000;
const distancia = (a: string, b: string) => Math.abs(Date.parse(`${a}T12:00:00Z`) - Date.parse(`${b}T12:00:00Z`)) / DIA;

export type Conciliacao = {
  de: string; ate: string;
  /** uma linha do extrato e o lançamento dela (ou as parcelas que foram juntas num Pix só) */
  casados: { linha: LinhaExtrato; lancamentos: Lancamento[] }[];
  faltam: LinhaExtrato[];
  sobram: Lancamento[];
  totalExtrato: number; totalRumo: number;
};

/** Casa cada linha do extrato com um lançamento pago da conta de mesmo valor (no centavo) e até 3 dias de diferença;
 *  os mais perto primeiro, cada lançamento uma vez só. */
export function conciliar(linhas: LinhaExtrato[], lancamentos: Lancamento[], folga = 3): Conciliacao {
  const dias = linhas.map((l) => l.dia).sort();
  const de = dias[0], ate = dias[dias.length - 1];
  const candidatos = lancamentos.filter((l) => l.paid && !ehAjuste(l) && distancia(l.happened_on, l.happened_on < de ? de : l.happened_on > ate ? ate : l.happened_on) <= folga);
  const pares: { i: number; l: Lancamento; d: number }[] = [];
  linhas.forEach((x, i) => {
    for (const l of candidatos) {
      if (Math.abs(r2(naConta(l)) - x.valor) < 0.005) { const d = distancia(l.happened_on, x.dia); if (d <= folga) pares.push({ i, l, d }); }
    }
  });
  pares.sort((a, b) => a.d - b.d || a.i - b.i);
  const usadasLinhas = new Set<number>(), usados = new Set<string>();
  const casados: Conciliacao["casados"] = [];
  for (const p of pares) {
    if (usadasLinhas.has(p.i) || usados.has(p.l.id)) continue;
    usadasLinhas.add(p.i); usados.add(p.l.id);
    casados.push({ linha: linhas[p.i], lancamentos: [p.l] });
  }
  // Pix das parcelas: um Pix só no banco, uma saída por parcela no Rumo (no mesmo dia, somando o valor exato)
  linhas.forEach((x, i) => {
    if (usadasLinhas.has(i) || x.valor >= 0) return;
    const porDia = new Map<string, Lancamento[]>();
    for (const l of candidatos) if (l.installment_id && l.kind === "saida" && !usados.has(l.id) && distancia(l.happened_on, x.dia) <= folga) porDia.set(l.happened_on, [...(porDia.get(l.happened_on) ?? []), l]);
    const grupo = [...porDia.entries()].sort((a, b) => distancia(a[0], x.dia) - distancia(b[0], x.dia)).find(([, g]) => g.length > 1 && Math.abs(r2(g.reduce((t, l) => t + l.amount, 0)) + x.valor) < 0.005)?.[1];
    if (!grupo) return;
    usadasLinhas.add(i); grupo.forEach((l) => usados.add(l.id));
    casados.push({ linha: x, lancamentos: grupo });
  });
  const faltam = linhas.filter((_, i) => !usadasLinhas.has(i));
  const sobram = lancamentos.filter((l) => l.paid && !ehAjuste(l) && l.happened_on >= de && l.happened_on <= ate && !usados.has(l.id));
  const noPeriodo = lancamentos.filter((l) => l.paid && l.happened_on >= de && l.happened_on <= ate);
  return {
    de, ate, casados: casados.sort((a, b) => a.linha.dia.localeCompare(b.linha.dia)), faltam, sobram,
    totalExtrato: r2(linhas.reduce((t, l) => t + l.valor, 0)), totalRumo: r2(noPeriodo.reduce((t, l) => t + naConta(l), 0)),
  };
}

/** O que a linha do extrato provavelmente é: aplicação ou resgate de investimento, saída ou entrada */
export function tipoDaLinha(l: LinhaExtrato): "saida" | "entrada" | "aporte" | "resgate" {
  const d = semAcento(l.descricao);
  if (/aplicac|guardad|rdb|caixinha|investimento/.test(d) && !/resgat/.test(d) && l.valor < 0) return "aporte";
  if (/resgat|retirad/.test(d) && /rdb|caixinha|investimento|guardad|resgate rdb/.test(d) && l.valor > 0) return "resgate";
  return l.valor < 0 ? "saida" : "entrada";
}

/** "Transferência enviada pelo Pix - FULANO - •••.123.456-•• - BANCO" → "Pix enviado · Fulano"; "Compra no débito - POSTO FOX" → "Posto Fox" */
export function descricaoDaLinha(l: LinhaExtrato): string {
  const partes = l.descricao.split(" - ").map((p) => p.trim()).filter(Boolean);
  const titulo = (s: string) => s.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());
  const d = semAcento(partes[0] ?? "");
  const quem = partes[1] && !/^[•*\d.\-/ ]+$/.test(partes[1]) ? titulo(partes[1]) : "";
  if (/transferencia enviada|pix enviado/.test(d)) return quem ? `Pix enviado · ${quem}` : "Pix enviado";
  if (/transferencia recebida|pix recebido/.test(d)) return quem ? `Pix recebido · ${quem}` : "Pix recebido";
  if (/compra no debito|compra/.test(d) && partes[1]) return titulo(partes[1]);
  return l.descricao.slice(0, 120);
}
