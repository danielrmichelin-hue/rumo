// Leitura da captura rápida. Entende: hoje, amanhã, depois de amanhã, dias da semana,
// datas (12/11, 12/11/2027, dia 25), horas (10h, 10h30, 14:30) e #contexto.
// O que não entender fica no título, sem erro. Função pura: a mesma leitura roda na
// prévia (navegador) e ao guardar (servidor).

import { dataExiste, diaDaSemana, diferencaDias, montarISO, somarDias } from "./datas";

export type ContextoParaCaptura = { id: string; name: string };

export type Leitura = {
  title: string;
  due_date: string | null;
  due_time: string | null; // "HH:MM"
  context_id: string | null;
  /** "Decidir …" vira decisão */
  kind: "fazer" | "decidir";
  /** Trechos que viraram propriedade, para a prévia */
  trechos: { data?: string; hora?: string; contexto?: string };
  /** Onde estão esses trechos no texto digitado (para marcar na própria caixa) */
  marcas: { inicio: number; fim: number }[];
  /** #tag que não corresponde a nenhum contexto (fica no título) */
  tagDesconhecida: string | null;
};

const L = "(?<![\\p{L}\\p{N}])"; // início de palavra (funciona com acento)
const R = "(?![\\p{L}\\p{N}])"; // fim de palavra

const PREP_DATA = "(?:(?:no\\s+dia|nesta|nessa|neste|nesse|na|no|em|at[ée]|para|pra|dia)\\s+)?";
const PREP_HORA = "(?:(?:at[ée]\\s+[àáa]s|[àáa]s|at[ée])\\s+)?";

const DIAS: Array<[RegExp, number]> = [
  [/^dom/, 0], [/^seg/, 1], [/^ter/, 2], [/^qua/, 3], [/^qui/, 4], [/^sex/, 5], [/^s[áa]b/, 6],
];

const SEMANA =
  "(?:pr[óo]xim[ao]\\s+)?(?:(?:segunda|ter[çc]a|quarta|quinta|sexta)(?:[-\\s]feira)?|s[áa]bado|domingo|seg|qua|qui|sex|s[áa]b|dom)\\.?";

type Achado = { inicio: number; fim: number; texto: string };

function achar(texto: string, padrao: string): (Achado & { grupos: string[] }) | null {
  const re = new RegExp(padrao, "iu");
  const m = re.exec(texto);
  if (!m) return null;
  return { inicio: m.index, fim: m.index + m[0].length, texto: m[0], grupos: m.slice(1) };
}

/** Texto sem acento, minúsculo, só letras e números: "Iter Mídia" → "itermidia" */
export function slug(texto: string): string {
  return texto.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
}

export function acharContexto(tag: string, contextos: ContextoParaCaptura[]): ContextoParaCaptura | null {
  const t = slug(tag);
  if (!t) return null;
  const exato = contextos.find((c) => slug(c.name) === t);
  if (exato) return exato;
  const palavra = contextos.find((c) => c.name.split(/\s+/).some((p) => slug(p) === t));
  if (palavra) return palavra;
  if (t.length >= 2) return contextos.find((c) => slug(c.name).startsWith(t)) ?? null;
  return null;
}

function lerData(texto: string, hoje: string): { achado: Achado; iso: string } | null {
  const candidatos: Array<{ achado: Achado; iso: string }> = [];

  const relativo = achar(texto, `${L}${PREP_DATA}(depois\\s+de\\s+amanh[ãa]|amanh[ãa]|hoje)${R}`);
  if (relativo) {
    const palavra = slug(relativo.grupos[0]);
    const dias = palavra.startsWith("depois") ? 2 : palavra === "amanha" ? 1 : 0;
    candidatos.push({ achado: relativo, iso: somarDias(hoje, dias) });
  }

  const semana = achar(texto, `${L}${PREP_DATA}(${SEMANA})${R}`);
  // "a segunda versão", "o domingo inteiro": artigo antes e palavra depois é ordinal ou substantivo, não data
  const ordinal =
    semana &&
    semana.texto === semana.grupos[0] &&
    !/feira/i.test(semana.texto) &&
    /(?:^|\s)(?:a|o|da|do|um|uma|esta|essa|este|esse)\s$/iu.test(texto.slice(0, semana.inicio)) &&
    /^\s+\p{L}/u.test(texto.slice(semana.fim));
  if (semana && !ordinal) {
    const nome = slug(semana.grupos[0].replace(/^pr[óo]xim[ao]\s+/iu, ""));
    const alvo = DIAS.find(([re]) => re.test(nome))?.[1];
    if (alvo !== undefined) {
      let dias = (alvo - diaDaSemana(hoje) + 7) % 7;
      if (dias === 0) dias = 7; // "sexta" dito numa sexta é a próxima
      candidatos.push({ achado: semana, iso: somarDias(hoje, dias) });
    }
  }

  const barra = achar(texto, `${L}${PREP_DATA}(\\d{1,2})/(\\d{1,2})(?:/(\\d{4}|\\d{2}))?${R}`);
  if (barra) {
    const dia = Number(barra.grupos[0]);
    const mes = Number(barra.grupos[1]);
    const anoHoje = Number(hoje.slice(0, 4));
    let ano = barra.grupos[2] ? Number(barra.grupos[2]) : anoHoje;
    if (ano < 100) ano += 2000;
    if (dataExiste(ano, mes, dia)) {
      let iso = montarISO(ano, mes, dia);
      // Sem ano e já passou há mais de um mês: é o ano que vem
      if (!barra.grupos[2] && diferencaDias(hoje, iso) < -30 && dataExiste(ano + 1, mes, dia)) iso = montarISO(ano + 1, mes, dia);
      candidatos.push({ achado: barra, iso });
    }
  }

  const diaDoMes = achar(texto, `${L}(?:no\\s+|at[ée]\\s+(?:o\\s+)?)?dia\\s+(\\d{1,2})${R}(?!/)`);
  if (diaDoMes) {
    const dia = Number(diaDoMes.grupos[0]);
    let [ano, mes] = hoje.split("-").map(Number);
    if (dia < Number(hoje.slice(8, 10))) {
      mes += 1;
      if (mes > 12) { mes = 1; ano += 1; }
    }
    if (dataExiste(ano, mes, dia)) candidatos.push({ achado: diaDoMes, iso: montarISO(ano, mes, dia) });
  }

  // Vale a primeira data do texto; as outras ficam no título
  candidatos.sort((a, b) => a.achado.inicio - b.achado.inicio);
  return candidatos[0] ?? null;
}

function lerHora(texto: string): { achado: Achado; hora: string } | null {
  const candidatos: Array<{ achado: Achado; hora: string }> = [];
  const comH = achar(texto, `${L}${PREP_HORA}(\\d{1,2})\\s?hs?(\\d{2})?${R}`);
  if (comH) candidatos.push({ achado: comH, hora: `${comH.grupos[0]}:${comH.grupos[1] ?? "00"}` });
  const doisPontos = achar(texto, `${L}${PREP_HORA}(\\d{1,2}):(\\d{2})${R}`);
  if (doisPontos) candidatos.push({ achado: doisPontos, hora: `${doisPontos.grupos[0]}:${doisPontos.grupos[1]}` });

  const validos = candidatos
    .map(({ achado, hora }) => {
      const [h, m] = hora.split(":").map(Number);
      return h <= 23 && m <= 59 ? { achado, hora: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}` } : null;
    })
    .filter((c): c is { achado: Achado; hora: string } => c !== null)
    .sort((a, b) => a.achado.inicio - b.achado.inicio);
  return validos[0] ?? null;
}

function lerContexto(texto: string, contextos: ContextoParaCaptura[]) {
  const re = /(?<![\p{L}\p{N}])#([\p{L}\p{N}_-]+)/gu;
  let primeiraDesconhecida: string | null = null;
  for (const m of texto.matchAll(re)) {
    const contexto = acharContexto(m[1], contextos);
    if (contexto) {
      return { achado: { inicio: m.index!, fim: m.index! + m[0].length, texto: m[0] }, contexto, desconhecida: null };
    }
    primeiraDesconhecida ??= m[1];
  }
  return { achado: null, contexto: null, desconhecida: primeiraDesconhecida };
}

function tirar(texto: string, trechos: Achado[]): string {
  let resto = texto;
  for (const t of [...trechos].sort((a, b) => b.inicio - a.inicio)) {
    resto = resto.slice(0, t.inicio) + " " + resto.slice(t.fim);
  }
  return resto
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim()
    .replace(/^[,.;:\-–—\s]+|[,;:\-–—\s]+$/g, "")
    .trim();
}

export function lerCaptura(texto: string, contextos: ContextoParaCaptura[], hoje: string): Leitura {
  // As posições valem para o texto como foi digitado; o título sai sem espaços sobrando
  const original = texto;
  const usados: Achado[] = [];
  const trechos: Leitura["trechos"] = {};

  // Contexto primeiro: um "#sexta" vira contexto se existir, não data
  const ctx = lerContexto(original, contextos);
  if (ctx.achado) { usados.push(ctx.achado); trechos.contexto = ctx.achado.texto; }

  // Esconde o que já foi usado para que as próximas leituras não o peguem
  const mascarar = (s: string) => usados.reduce((acc, u) => acc.slice(0, u.inicio) + "\u0000".repeat(u.fim - u.inicio) + acc.slice(u.fim), s);

  const data = lerData(mascarar(original), hoje);
  if (data) { usados.push(data.achado); trechos.data = original.slice(data.achado.inicio, data.achado.fim); }

  const hora = lerHora(mascarar(original));
  if (hora) { usados.push(hora.achado); trechos.hora = original.slice(hora.achado.inicio, hora.achado.fim); }

  let title = tirar(original, usados);
  if (!title) title = original.replace(/\s+/g, " ").trim();
  title = (title.charAt(0).toLocaleUpperCase("pt-BR") + title.slice(1)).slice(0, 300);

  return {
    title,
    due_date: data?.iso ?? (hora ? hoje : null), // hora sem data: hoje
    due_time: hora?.hora ?? null,
    context_id: ctx.contexto?.id ?? null,
    kind: /^decidir(?![\p{L}\p{N}])/iu.test(title) ? "decidir" : "fazer",
    trechos,
    marcas: usados.map(({ inicio, fim }) => ({ inicio, fim })).sort((a, b) => a.inicio - b.inicio),
    tagDesconhecida: ctx.desconhecida,
  };
}
