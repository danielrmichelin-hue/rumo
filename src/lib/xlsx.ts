// Leitor de .xlsx sem biblioteca: o arquivo é um zip de XMLs. Lê os valores salvos de cada célula
// (o Excel guarda o resultado das fórmulas), aba por aba. Funciona no navegador e no Node (DecompressionStream).

export type Celula = string | number | boolean | null;
/** Cada aba: linhas (a partir da 1) com as colunas (A = 0) */
export type Abas = Record<string, Celula[][]>;

async function inflar(dados: Uint8Array): Promise<Uint8Array> {
  const fluxo = new Blob([dados as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(fluxo).arrayBuffer());
}

/** Os arquivos do zip (nome → conteúdo em texto), só os que interessam */
async function abrirZip(buf: ArrayBuffer, quer: (nome: string) => boolean): Promise<Map<string, string>> {
  const v = new DataView(buf), bytes = new Uint8Array(buf);
  // Fim do diretório central: assinatura 0x06054b50, procurada de trás para frente
  let fim = -1;
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 65557); i--) if (v.getUint32(i, true) === 0x06054b50) { fim = i; break; }
  if (fim < 0) throw new Error("Não é um arquivo .xlsx.");
  const total = v.getUint16(fim + 10, true);
  let p = v.getUint32(fim + 16, true);
  const saida = new Map<string, string>();
  const texto = new TextDecoder("utf-8");
  for (let k = 0; k < total; k++) {
    if (v.getUint32(p, true) !== 0x02014b50) throw new Error("Arquivo .xlsx corrompido.");
    const metodo = v.getUint16(p + 10, true), tamanho = v.getUint32(p + 20, true);
    const nLen = v.getUint16(p + 28, true), xLen = v.getUint16(p + 30, true), cLen = v.getUint16(p + 32, true);
    const local = v.getUint32(p + 42, true);
    const nome = texto.decode(bytes.subarray(p + 46, p + 46 + nLen));
    p += 46 + nLen + xLen + cLen;
    if (!quer(nome)) continue;
    const ini = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true);
    const bruto = bytes.subarray(ini, ini + tamanho);
    saida.set(nome, texto.decode(metodo === 0 ? bruto : metodo === 8 ? await inflar(bruto) : (() => { throw new Error("Compressão do .xlsx não suportada."); })()));
  }
  return saida;
}

const ENT: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const desescapar = (s: string) => s.replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e: string) => (e[0] === "#" ? String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : ENT[e] ?? m));
const textos = (xml: string) => [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => desescapar(m[1])).join("");
const coluna = (ref: string) => { let n = 0; for (const c of ref.replace(/\d+/g, "")) n = n * 26 + (c.charCodeAt(0) - 64); return n - 1; };

/** Lê as abas pedidas (pelo nome) de um .xlsx */
export async function lerXlsx(buf: ArrayBuffer, nomes: string[]): Promise<Abas> {
  const arquivos = await abrirZip(buf, (n) => n === "xl/workbook.xml" || n === "xl/_rels/workbook.xml.rels" || n === "xl/sharedStrings.xml" || /^xl\/worksheets\/sheet\d+\.xml$/.test(n));
  const wb = arquivos.get("xl/workbook.xml"), rels = arquivos.get("xl/_rels/workbook.xml.rels");
  if (!wb || !rels) throw new Error("Não é um arquivo .xlsx do Excel.");
  const alvo = new Map([...rels.matchAll(/<Relationship\b([^>]*)\/?>/g)].map((m) => [m[1].match(/Id="([^"]+)"/)?.[1], m[1].match(/Target="([^"]+)"/)?.[1]]));
  const compartilhadas = [...(arquivos.get("xl/sharedStrings.xml") ?? "").matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => textos(m[1]));
  const abas: Abas = {};
  for (const m of wb.matchAll(/<sheet\b([^>]*)\/?>/g)) {
    const nome = desescapar(m[1].match(/name="([^"]+)"/)?.[1] ?? "");
    if (!nomes.includes(nome)) continue;
    const rid = m[1].match(/r:id="([^"]+)"/)?.[1];
    const caminho = alvo.get(rid)?.replace(/^\/?(xl\/)?/, "xl/");
    const xml = caminho ? arquivos.get(caminho) : undefined;
    if (!xml) continue;
    const linhas: Celula[][] = [];
    for (const r of xml.matchAll(/<row\b[^>]*\br="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
      const linha: Celula[] = [];
      for (const c of r[2].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const ref = c[1].match(/\br="([A-Z]+\d+)"/)?.[1];
        if (!ref) continue;
        const t = c[1].match(/\bt="(\w+)"/)?.[1];
        const corpo = c[2] ?? "";
        const bruto = corpo.match(/<v>([\s\S]*?)<\/v>/)?.[1];
        let valor: Celula = null;
        if (t === "s") valor = bruto !== undefined ? compartilhadas[Number(bruto)] ?? null : null;
        else if (t === "inlineStr") valor = textos(corpo);
        else if (t === "str") valor = bruto !== undefined ? desescapar(bruto) : null;
        else if (t === "b") valor = bruto === "1";
        else if (t === "e") valor = null;
        else if (bruto !== undefined) valor = Number(bruto);
        linha[coluna(ref)] = valor;
      }
      linhas[Number(r[1])] = linha;
    }
    abas[nome] = linhas;
  }
  return abas;
}

/** Data do Excel (número de dias desde 30/12/1899) → "2026-11-23" */
export function dataDoExcel(v: Celula): string | null {
  if (typeof v === "number" && v > 20000 && v < 80000) return new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000).toISOString().slice(0, 10);
  if (typeof v === "string") { const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/) ?? v.match(/^(\d{2})\/(\d{2})\/(\d{4})/); if (m) return m[1].length === 4 ? `${m[1]}-${m[2]}-${m[3]}` : `${m[3]}-${m[2]}-${m[1]}`; }
  return null;
}
