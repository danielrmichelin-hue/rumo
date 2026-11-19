// Finanças do mês: o que entrou, o que saiu, o que falta pagar e onde o dinheiro foi.
// Contas fixas são rotinas mensais com valor ("Condomínio · R$ 800 · todo dia 10"): pagar = marcar a rotina + lançar a saída.
import { diaNoMes, mesDaRotina, type Marcacao, type Rotina } from "./rotinas";

export type Lancamento = {
  id: string;
  kind: "entrada" | "saida";
  amount: number;
  description: string;
  category: string;
  happened_on: string;
  paid: boolean;
  routine_id: string | null;
  context_id: string | null;
};
export type Orcamento = { id: string; category: string; monthly_limit: number };

export const CAMPOS_LANCAMENTO = "id, kind, amount, description, category, happened_on, paid, routine_id, context_id";

export const CATEGORIAS_SAIDA = ["Moradia", "Mercado", "Contas da casa", "Transporte", "Saúde", "Educação", "Lazer", "Assinaturas", "Compras", "Impostos", "Outros"];
export const CATEGORIAS_ENTRADA = ["Salário", "Pró-labore", "Vendas", "Serviços", "Rendimentos", "Outros"];

/** "R$ 1.234,56" */
export const moeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Números do banco chegam como texto (numeric) */
export const normalizarLancamento = (l: Record<string, unknown>): Lancamento => ({ ...(l as Lancamento), amount: Number(l.amount) });

/** Primeiro e último dia do mês "AAAA-MM" */
export function limitesDoMes(mes: string) {
  const [a, m] = mes.split("-").map(Number);
  const ultimo = new Date(Date.UTC(a, m, 0)).getUTCDate();
  return { inicio: `${mes}-01`, fim: `${mes}-${String(ultimo).padStart(2, "0")}` };
}

export function mesVizinho(mes: string, delta: number) {
  const [a, m] = mes.split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export type ContaFixa = { rotina: Rotina; dia: string; valor: number; paga: boolean; pagaEm: string | null; texto: string };

/** As contas fixas do mês (rotinas mensais com valor), com o estado de cada uma */
export function contasDoMes(rotinas: Rotina[], marcas: Marcacao[], mes: string, hoje: string): ContaFixa[] {
  const referencia = hoje.slice(0, 7) === mes ? hoje : `${mes}-01`;
  return rotinas
    .filter((r) => r.month_day && r.amount)
    .map((r) => {
      const m = mesDaRotina(r, marcas.filter((x) => x.done_on.slice(0, 7) === mes), referencia);
      return { rotina: r, dia: diaNoMes(r, referencia), valor: Number(r.amount), paga: !!m.feitaEm, pagaEm: m.feitaEm, texto: m.texto };
    })
    .sort((a, b) => a.dia.localeCompare(b.dia));
}

/** O mês em números e por categoria */
export function resumoDoMes(lancamentos: Lancamento[], contas: ContaFixa[], orcamentos: Orcamento[]) {
  const pagos = lancamentos.filter((l) => l.paid);
  const entrou = pagos.filter((l) => l.kind === "entrada").reduce((t, l) => t + l.amount, 0);
  const saiu = pagos.filter((l) => l.kind === "saida").reduce((t, l) => t + l.amount, 0);
  // Falta pagar: contas fixas ainda não pagas + lançamentos de saída marcados "a pagar"
  const aPagar = contas.filter((c) => !c.paga).reduce((t, c) => t + c.valor, 0) + lancamentos.filter((l) => !l.paid && l.kind === "saida").reduce((t, l) => t + l.amount, 0);
  const aReceber = lancamentos.filter((l) => !l.paid && l.kind === "entrada").reduce((t, l) => t + l.amount, 0);
  const porCategoria = new Map<string, number>();
  for (const l of pagos.filter((x) => x.kind === "saida")) porCategoria.set(l.category, (porCategoria.get(l.category) ?? 0) + l.amount);
  for (const o of orcamentos) if (!porCategoria.has(o.category)) porCategoria.set(o.category, 0);
  const categorias = [...porCategoria.entries()]
    .map(([categoria, gasto]) => {
      const limite = orcamentos.find((o) => o.category === categoria)?.monthly_limit ?? null;
      return { categoria, gasto, limite: limite ? Number(limite) : null };
    })
    .sort((a, b) => b.gasto - a.gasto);
  return { entrou, saiu, saldo: entrou - saiu, aPagar, aReceber, categorias };
}
