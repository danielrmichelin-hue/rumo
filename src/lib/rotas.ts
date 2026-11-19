// Rotas: do destino ao próximo passo (Book cap. 07). Cálculo igual ao simulador do Book
// (docs/brand-book/assets/js/book.js): ritmo = o que falta ÷ o tempo até a chegada.
// "Rumo não pune desvios. Rumo recalcula o caminho."

import { BookOpen, Building2, GraduationCap, Wallet } from "lucide-react";
import { diaDaSemana, diaMes, diferencaDias, hojeISO, mesAno, montarISO, nomeDoMes, somarDias } from "./datas";

export type TipoRota = "financeiro" | "leitura" | "estudos" | "negocios";

export type Rota = {
  id: string;
  title: string;
  kind: TipoRota;
  context_id: string | null;
  target: number | null;
  current: number;
  start_value: number;
  start_date: string;
  target_date: string | null;
  status: "ativa" | "pausada" | "concluida";
  note: string | null;
  /** curso ligado (módulo Estudos): leituras e "concluir o curso" */
  course_id?: string | null;
};

export const ICONES_ROTA: Record<TipoRota, typeof Wallet> = { financeiro: Wallet, leitura: BookOpen, estudos: GraduationCap, negocios: Building2 };

export type Marco = { id: string; route_id: string; title: string; position: number; due_date: string | null; done_at: string | null };

export const CAMPOS_MARCO = "id, route_id, title, position, due_date, done_at";
export const CAMPOS_ROTA = "id, title, kind, context_id, target, current, start_value, start_date, target_date, status, note, course_id";

export const TIPOS: Record<TipoRota, { nome: string; exemplo: string; informa: string; calcula: string }> = {
  financeiro: { nome: "Financeiro", exemplo: "Guardar R$ 5.000", informa: "Quanto quer juntar, quanto já tem e o prazo", calcula: "O ritmo mensal e a data de chegada" },
  leitura: { nome: "Leitura", exemplo: "Terminar um livro", informa: "Páginas, quanto já leu e quando quer terminar", calcula: "O ritmo diário" },
  estudos: { nome: "Estudos", exemplo: "Concluir um curso de 60 aulas", informa: "Aulas, quantas já fez e quando quer terminar", calcula: "Aulas por semana e a previsão" },
  negocios: { nome: "Negócios", exemplo: "Abrir a segunda unidade", informa: "Os marcos até o destino", calcula: "O marco atual e os próximos passos dele" },
};


/** Números chegam do banco como número ou texto (numeric) */
export function normalizar(r: Record<string, unknown>): Rota {
  const n = (v: unknown) => (v === null || v === undefined ? null : Number(v));
  return { ...(r as Rota), target: n(r.target), current: n(r.current) ?? 0, start_value: n(r.start_value) ?? 0 };
}

export const brl = (v: number) => `R$ ${Math.round(v).toLocaleString("pt-BR")}`;

export function somarMeses(iso: string, meses: number): string {
  const [a, m, d] = iso.split("-").map(Number);
  const alvo = new Date(Date.UTC(a, m - 1 + meses, 1));
  const ultimo = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate();
  return montarISO(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, Math.min(d, ultimo));
}

/** Quanto tempo, na unidade do ritmo de cada tipo: meses (financeiro), dias (leitura), semanas (estudos e negócios) */
export function periodos(kind: TipoRota, de: string, ate: string): number {
  const dias = Math.max(1, diferencaDias(de, ate));
  if (kind === "financeiro") return Math.max(1, Math.round(dias / 30.44));
  if (kind === "leitura") return dias;
  return Math.max(1, Math.ceil(dias / 7));
}

/** Data de chegada a partir de um prazo informado na unidade do tipo (meses, dias ou semanas) */
export function chegadaPorPrazo(kind: TipoRota, prazo: number, hoje: string = hojeISO()): string {
  if (kind === "financeiro") return somarMeses(hoje, prazo);
  if (kind === "leitura") return somarDias(hoje, prazo);
  return somarDias(hoje, prazo * 7);
}

function arredondar(kind: TipoRota, v: number) {
  if (kind === "estudos") return Math.ceil(v * 10) / 10;
  return Math.ceil(v);
}

export function textoRitmo(kind: TipoRota, v: number): string {
  if (kind === "financeiro") return `${brl(v)} por mês`;
  if (kind === "leitura") return `${v} ${v === 1 ? "página" : "páginas"} por dia`;
  return `${String(v).replace(".", ",")} ${v === 1 ? "aula" : "aulas"} por semana`;
}

export function textoValor(kind: TipoRota, v: number): string {
  if (kind === "financeiro") return brl(v);
  if (kind === "leitura") return `${Math.round(v)} ${Math.round(v) === 1 ? "página" : "páginas"}`;
  return `${Math.round(v)} ${Math.round(v) === 1 ? "aula" : "aulas"}`;
}

/** Como a chegada é dita: mês e ano no financeiro, dia e mês nos outros */
export function textoChegada(kind: TipoRota, iso: string): string {
  return kind === "financeiro" || kind === "negocios" ? mesAno(iso) : diaMes(iso);
}

export type Sugestao = { title: string; due_date: string; today: boolean; quando: string };

/** Começo do título do passo que a Rota sugere, para atualizar em vez de duplicar */
export const PREFIXO_PASSO: Record<TipoRota, string | null> = { financeiro: "Transferir ", leitura: "Ler ", estudos: "Assistir ", negocios: null };

export type ResumoRota = {
  pct: number;
  agora: string; // "R$ 1.200 de R$ 5.000"
  destino: string | null; // "Destino · junho de 2027"
  ritmo: string | null; // "R$ 475 por mês"
  previsao: string | null;
  situacao: string; // "No ritmo, com 3 semanas de folga"
  recalculo: boolean; // o ritmo necessário subiu: a tela mostra o novo e o de antes
  antes: string | null; // ritmo planejado, quando a Rota recalculou ("R$ 380")
  escolha: { manter: string; mover: string; novaData: string } | null;
  sugestao: Sugestao | null;
  linha: string; // linha curta para listas: "R$ 380 por mês · março"
  concluida: boolean;
};

/** O próximo "dia 5" a partir de hoje (dia sugerido para guardar dinheiro) */
function proximoDia5(hoje: string) {
  const [a, m, d] = hoje.split("-").map(Number);
  if (d <= 5) return montarISO(a, m, 5);
  const prox = somarMeses(montarISO(a, m, 1), 1);
  return `${prox.slice(0, 8)}05`;
}

function proximaSexta(hoje: string) {
  const d = diaDaSemana(hoje);
  return somarDias(hoje, d <= 5 ? 5 - d : 6);
}

export function resumirRota(r: Rota, marcos: Marco[] = [], hoje: string = hojeISO()): ResumoRota {
  if (r.kind === "negocios") return resumirNegocio(r, marcos, hoje);

  const alvo = r.target ?? 0;
  const atual = Math.min(r.current, alvo || r.current);
  const falta = Math.max(0, alvo - r.current);
  const pct = alvo ? Math.min(1, r.current / alvo) : 0;
  const agora = r.kind === "financeiro" ? `${brl(atual)} de ${brl(alvo)}` : r.kind === "leitura" ? `${Math.round(atual)} de ${Math.round(alvo)} páginas` : `${Math.round(atual)} de ${Math.round(alvo)} aulas`;
  const concluida = alvo > 0 && falta <= 0;

  if (concluida || !r.target_date) {
    return {
      pct, agora, concluida,
      destino: r.target_date ? `Destino · ${textoChegada(r.kind, r.target_date)}` : null,
      ritmo: null, previsao: null,
      situacao: concluida ? "Destino alcançado." : "Defina quando quer chegar para o Rumo calcular o ritmo.",
      recalculo: false, antes: null, escolha: null, sugestao: null,
      linha: concluida ? "Destino alcançado" : agora,
    };
  }

  const restante = periodos(r.kind, hoje, r.target_date);
  const ritmoValor = arredondar(r.kind, falta / restante);
  const totalPlanejado = periodos(r.kind, r.start_date, r.target_date);
  const planejado = arredondar(r.kind, Math.max(0, alvo - r.start_value) / totalPlanejado);

  // Situação: compara com onde a Rota deveria estar hoje pelo plano
  const diasTotal = Math.max(1, diferencaDias(r.start_date, r.target_date));
  const diasPassados = Math.max(0, diferencaDias(r.start_date, hoje));
  const esperado = r.start_value + ((alvo - r.start_value) * Math.min(diasPassados, diasTotal)) / diasTotal;
  const porDia = (alvo - r.start_value) / diasTotal;
  let situacao = "No ritmo.";
  if (porDia > 0 && r.current > esperado) {
    const folga = Math.floor((r.current - esperado) / porDia);
    situacao = folga >= 14 ? `No ritmo, com ${Math.floor(folga / 7)} semanas de folga.` : folga >= 7 ? "No ritmo, com 1 semana de folga." : "No ritmo.";
  }

  // Recálculo: o ritmo necessário subiu em relação ao planejado
  let recalculo = false;
  let escolha: ResumoRota["escolha"] = null;
  if (planejado > 0 && ritmoValor > planejado * 1.02) {
    recalculo = true;
    situacao = "O caminho mudou. A Rota recalculou o ritmo.";
    if (ritmoValor > planejado * 1.25) {
      // Manter o ritmo planejado empurra a chegada
      const periodosNoRitmo = Math.ceil(falta / planejado);
      const novaData = chegadaPorPrazo(r.kind, periodosNoRitmo, hoje);
      escolha = { manter: textoChegada(r.kind, r.target_date), mover: textoChegada(r.kind, novaData), novaData };
    }
  }

  // Previsão pelo ritmo real, quando já há tempo e avanço para medir
  let previsao = textoChegada(r.kind, r.target_date);
  const avancou = r.current - r.start_value;
  const passados = periodos(r.kind, r.start_date, hoje);
  if (avancou > 0 && diasPassados >= (r.kind === "leitura" ? 3 : r.kind === "financeiro" ? 45 : 14)) {
    const ritmoReal = avancou / passados;
    const faltam = Math.ceil(falta / ritmoReal);
    const eta = chegadaPorPrazo(r.kind, faltam, hoje);
    const dif = diferencaDias(eta, r.target_date);
    // Só antecipa boas notícias; quando o ritmo real está abaixo, o recálculo já mostra o novo caminho
    if (dif >= 14) previsao = `${textoChegada(r.kind, eta)} · ${Math.floor(dif / 7)} semanas antes do destino`;
  }

  // Próximo passo sugerido (o que cabe agora), como no simulador do Book
  let sugestao: Sugestao | null = null;
  if (r.kind === "financeiro") {
    const due = proximoDia5(hoje);
    sugestao = { title: `Transferir ${brl(ritmoValor)} até o dia 5`, due_date: due, today: false, quando: `Vai para o Hoje no dia ${Number(due.slice(8))}` };
  } else if (r.kind === "leitura") {
    sugestao = { title: `Ler ${ritmoValor} ${ritmoValor === 1 ? "página" : "páginas"} hoje`, due_date: hoje, today: true, quando: "Vai para o Hoje agora" };
  } else {
    const n = Math.ceil(ritmoValor);
    sugestao = { title: `Assistir ${n} ${n === 1 ? "aula" : "aulas"} esta semana`, due_date: proximaSexta(hoje), today: false, quando: "Fica no Hoje até sexta" };
  }

  return {
    pct, agora, concluida: false,
    destino: `Destino · ${textoChegada(r.kind, r.target_date)}`,
    ritmo: textoRitmo(r.kind, ritmoValor),
    previsao, situacao, recalculo, escolha, sugestao,
    antes: recalculo ? textoRitmo(r.kind, planejado).replace(/ por .*/, "") : null,
    linha: `${textoRitmo(r.kind, ritmoValor)} · ${r.kind === "financeiro" ? nomeDoMes(r.target_date) : diaMes(r.target_date)}`,
  };
}

function resumirNegocio(r: Rota, marcos: Marco[], hoje: string): ResumoRota {
  const lista = [...marcos].sort((a, b) => a.position - b.position);
  const total = lista.length;
  const feitos = lista.filter((m) => m.done_at).length;
  const pct = total ? feitos / total : 0;
  const concluida = total > 0 && feitos === total;
  const destino = r.target_date ? `Destino · ${mesAno(r.target_date)}` : null;
  const agora = `${total} ${total === 1 ? "marco" : "marcos"} · ${feitos} ${feitos === 1 ? "concluído" : "concluídos"}`;
  let ritmo: string | null = null;
  let previsao: string | null = null;
  let situacao = concluida ? "Destino alcançado." : total ? "" : "Defina os marcos até o destino.";

  if (!concluida && total && r.target_date) {
    const faltam = total - feitos;
    const semanas = periodos("negocios", hoje, r.target_date);
    const cada = Math.max(1, Math.round(semanas / faltam));
    ritmo = `1 marco a cada ${cada} ${cada === 1 ? "semana" : "semanas"}`;
    previsao = mesAno(r.target_date);
    situacao = "No ritmo.";
    const semanasPassadas = diferencaDias(r.start_date, hoje) / 7;
    if (feitos > 0 && semanasPassadas >= 2) {
      const media = semanasPassadas / feitos;
      const eta = somarDias(hoje, Math.ceil(media * faltam * 7));
      const dif = diferencaDias(eta, r.target_date);
      previsao = `${mesAno(eta)}${dif >= 14 ? ` · ${Math.floor(dif / 7)} semanas antes do destino` : ""}`;
      situacao = dif >= 14 ? `No ritmo, com ${Math.floor(dif / 7)} semanas de folga.` : dif >= 0 ? "No ritmo." : `No ritmo atual, a chegada fica para ${mesAno(eta)}.`;
    }
  }

  return {
    pct, agora, concluida, destino, ritmo, previsao,
    situacao: situacao ? `${agora} · ${situacao.charAt(0).toLowerCase()}${situacao.slice(1)}` : agora,
    recalculo: false, antes: null, escolha: null, sugestao: null,
    linha: `${feitos}/${total} marcos${r.target_date ? ` · ${nomeDoMes(r.target_date)}` : ""}`,
  };
}

/** Texto do anel na lateral: "62%" ou "2/6" */
export function rotuloAnel(r: Rota, resumo: ResumoRota, marcos: Marco[] = []): string {
  if (r.kind === "negocios") return `${marcos.filter((m) => m.done_at).length}/${marcos.length}`;
  return `${Math.round(resumo.pct * 100)}%`;
}
