// Finanças do mês: o que entrou, o que saiu, o que falta pagar e onde o dinheiro foi.
// Contas fixas são rotinas mensais com valor ("Condomínio · R$ 800 · todo dia 10"): pagar = marcar a rotina + lançar a saída.
import { somarMeses } from "./datas";
import { diaNoMes, type Marcacao, type Rotina } from "./rotinas";

export type TipoLancamento = "entrada" | "saida" | "aporte" | "resgate";
export type Lancamento = {
  id: string;
  /** aporte = investi (sai da conta, entra no investimento); resgate = resgatei (o contrário) */
  kind: TipoLancamento;
  amount: number;
  description: string;
  category: string;
  happened_on: string;
  paid: boolean;
  routine_id: string | null;
  context_id: string | null;
  /** parcela de um parcelamento */
  installment_id?: string | null;
  /** investir ou resgatar: de qual investimento */
  investment_id?: string | null;
};
export type Orcamento = { id: string; category: string; monthly_limit: number };

export const CAMPOS_LANCAMENTO = "id, kind, amount, description, category, happened_on, paid, routine_id, context_id, installment_id, investment_id";

export const CATEGORIAS_SAIDA = ["Moradia", "Mercado", "Restaurantes e delivery", "Contas da casa", "Transporte", "Saúde", "Cuidados pessoais", "Educação", "Lazer", "Assinaturas", "Compras", "Presentes e doações", "Impostos", "Outros"];
export const CATEGORIAS_ENTRADA = ["Salário", "Pró-labore", "Vendas", "Serviços", "Rendimentos", "Outros"];

export const ROTULO_TIPO: Record<TipoLancamento, string> = { saida: "Saída", entrada: "Entrada", aporte: "Investi", resgate: "Resgatei" };
/** Investir e resgatar são transferências entre a conta e o investimento: não são gasto nem renda */
export const ehTransferencia = (l: Pick<Lancamento, "kind">) => l.kind === "aporte" || l.kind === "resgate";
/** Efeito na conta: entrada e resgate somam; saída e aporte tiram */
export const naConta = (l: Pick<Lancamento, "kind" | "amount">) => (l.kind === "entrada" || l.kind === "resgate" ? l.amount : -l.amount);

/** "R$ 1.234,56" */
export const moeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Números do banco chegam como texto (numeric). No banco, investir é uma saída ligada a um investimento e
 *  resgatar é uma entrada ligada a um investimento; no app, viram "aporte" e "resgate". */
export const normalizarLancamento = (l: Record<string, unknown>): Lancamento => ({
  ...(l as Lancamento),
  amount: Number(l.amount),
  kind: l.investment_id ? (l.kind === "saida" ? "aporte" : "resgate") : (l.kind as Lancamento["kind"]),
});
/** O contrário, para gravar: aporte e resgate viram saída e entrada com o investimento */
export const tipoNoBanco = (kind: TipoLancamento): "entrada" | "saida" => (kind === "aporte" || kind === "saida" ? "saida" : "entrada");

const ultimoDia = (a: number, m: number) => new Date(Date.UTC(a, m, 0)).getUTCDate();
const dataDo = (a: number, m: number, d: number) => {
  const x = new Date(Date.UTC(a, m - 1, 1));
  const ano = x.getUTCFullYear(), mes = x.getUTCMonth() + 1;
  return `${ano}-${String(mes).padStart(2, "0")}-${String(Math.min(d, ultimoDia(ano, mes))).padStart(2, "0")}`;
};

/** O mês financeiro "AAAA-MM": do dia em que recebe até a véspera do mesmo dia no mês seguinte
 *  (recebe dia 20: outubro = 20/10 a 19/11). Recebe dia 1 (ou sem dia): o mês do calendário. */
export function limitesDoMes(mes: string, diaRecebe = 1) {
  const [a, m] = mes.split("-").map(Number);
  if (diaRecebe <= 1) return { inicio: `${mes}-01`, fim: dataDo(a, m, ultimoDia(a, m)) };
  const inicio = dataDo(a, m, diaRecebe);
  const prox = dataDo(a, m + 1, diaRecebe);
  const fim = new Date(Date.parse(`${prox}T12:00:00Z`) - 86400000).toISOString().slice(0, 10);
  return { inicio, fim };
}

/** Em que mês financeiro cai um dia */
export function mesDoDia(dia: string, diaRecebe = 1): string {
  const [a, m, d] = dia.split("-").map(Number);
  const daqui = `${a}-${String(m).padStart(2, "0")}`;
  return diaRecebe <= 1 || d >= Math.min(diaRecebe, ultimoDia(a, m)) ? daqui : mesVizinho(daqui, -1);
}

export function mesVizinho(mes: string, delta: number) {
  const [a, m] = mes.split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export type ContaFixa = { rotina: Rotina; dia: string; valor: number; paga: boolean; pagaEm: string | null; texto: string };

/** As contas fixas do ciclo (rotinas mensais com valor): o dia de cada uma dentro do ciclo e se já foi paga
 *  (a marcação vale para o mês do calendário daquele dia) */
const simples = (t: string) => t.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

/** Contas fixas do mês. Paga = marcada, ou com um lançamento de saída dela no mês (ligado à conta ou com o nome dela) */
export function contasDoMes(rotinas: Rotina[], marcas: Marcacao[], inicio: string, fim: string, lancamentos: Lancamento[] = []): ContaFixa[] {
  return rotinas
    .filter((r) => r.month_day && r.amount)
    .map((r) => {
      let dia = diaNoMes(r, inicio);
      if (dia < inicio) dia = diaNoMes(r, fim);
      const nome = simples(r.title);
      const noPeriodo = (d: string) => d >= inicio && d <= fim;
      const lancada = lancamentos.find((l) => l.kind === "saida" && noPeriodo(l.happened_on) && (l.routine_id === r.id || (nome.length >= 3 && simples(l.description).includes(nome))));
      const pagaEm = marcas.filter((x) => x.routine_id === r.id && noPeriodo(x.done_on)).map((x) => x.done_on).sort()[0] ?? lancada?.happened_on ?? null;
      return { rotina: r, dia, valor: Number(r.amount), paga: !!pagaEm, pagaEm, texto: pagaEm ? "Paga" : `Dia ${Number(dia.slice(8))}` };
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

// ---------- ajustes: a divisão do que entra e o saldo da conta ----------

export type Ajustes = { pay_day: number; pct_parcelas: number; pct_investir: number; pct_livre: number; cash_balance: number | null; cash_on: string | null };
export const AJUSTES_PADRAO: Ajustes = { pay_day: 1, pct_parcelas: 50, pct_investir: 20, pct_livre: 30, cash_balance: null, cash_on: null };
export const normalizarAjustes = (a: Record<string, unknown> | null): Ajustes =>
  a ? { ...AJUSTES_PADRAO, ...(a as Ajustes), pay_day: Number(a.pay_day) || 1, cash_balance: a.cash_balance === null || a.cash_balance === undefined ? null : Number(a.cash_balance) } : AJUSTES_PADRAO;

// ---------- parcelamentos ----------

export type Parcelamento = { id: string; title: string; category: string; total: number; installments: number; paid_count: number; first_due: string; creditor: string | null; context_id: string | null; note: string | null };
export const CAMPOS_PARCELAMENTO = "id, title, category, total, installments, paid_count, first_due, creditor, context_id, note";
export const normalizarParcelamento = (p: Record<string, unknown>): Parcelamento => ({ ...(p as Parcelamento), total: Number(p.total), installments: Number(p.installments), paid_count: Number(p.paid_count) });

const MES_CURTO = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
/** "dez/27" */
export const mesCurto = (iso: string) => `${MES_CURTO[Number(iso.slice(5, 7)) - 1]}/${iso.slice(2, 4)}`;

export function situacaoParcelamento(p: Parcelamento, hoje: string) {
  const parcela = Math.round((p.total / p.installments) * 100) / 100;
  const faltam = p.installments - p.paid_count;
  const restante = Math.max(0, Math.round((p.total - parcela * p.paid_count) * 100) / 100);
  const ultima = somarMeses(p.first_due, p.installments - 1);
  const proxima = faltam > 0 ? somarMeses(p.first_due, p.paid_count) : null;
  const estado: "quitado" | "pagando" | "a_comecar" = faltam === 0 ? "quitado" : p.paid_count === 0 && p.first_due > hoje ? "a_comecar" : "pagando";
  return { parcela, faltam, restante: faltam ? restante : 0, ultima, proxima, estado };
}

/** As parcelas que vencem no ciclo (ou que ficaram de ciclos anteriores): uma por parcelamento, a próxima a pagar */
export function parcelasDoCiclo(lista: Parcelamento[], inicio: string, fim: string, hoje: string) {
  return lista
    .map((p) => ({ p, s: situacaoParcelamento(p, hoje) }))
    .filter(({ s }) => s.proxima && s.proxima <= fim)
    .map(({ p, s }) => ({ p, s, numero: p.paid_count + 1, vence: s.proxima!, atrasada: s.proxima! < inicio }))
    .sort((a, b) => a.vence.localeCompare(b.vence) || a.p.title.localeCompare(b.p.title));
}

/** Quanto se deve, quanto sai por mês e quando tudo termina */
export function resumoParcelamentos(lista: Parcelamento[], hoje: string) {
  const ativos = lista.map((p) => ({ p, s: situacaoParcelamento(p, hoje) })).filter(({ s }) => s.estado !== "quitado");
  return {
    deve: ativos.reduce((t, { s }) => t + s.restante, 0),
    porMes: ativos.reduce((t, { s }) => t + s.parcela, 0),
    ultima: ativos.map(({ s }) => s.ultima).sort().pop() ?? null,
    emCurso: ativos.length,
    quitados: lista.length - ativos.length,
  };
}

// ---------- investimentos ----------

export type TipoInvestimento = "caixinha" | "renda_fixa" | "tesouro" | "fundos" | "acoes" | "previdencia" | "cripto" | "outro";
export const TIPOS_INVESTIMENTO: Record<TipoInvestimento, string> = {
  caixinha: "Caixinha / conta remunerada",
  renda_fixa: "Renda fixa (CDB, RDB, LCI)",
  tesouro: "Tesouro Direto",
  fundos: "Fundos",
  acoes: "Ações e FIIs",
  previdencia: "Previdência",
  cripto: "Cripto",
  outro: "Outro",
};
export type Investimento = { id: string; name: string; kind: TipoInvestimento; institution: string | null; balance: number; balance_on: string; monthly_rate: number | null; monthly_plan: number | null; status: "ativo" | "encerrado"; note: string | null };
/** Movimento de um investimento: aportes e resgates vêm dos lançamentos; rendimentos, da aba Investimentos */
export type Movimento = { id: string; investment_id: string; kind: "aporte" | "resgate" | "rendimento"; amount: number; happened_on: string; note: string | null; origem: "lancamento" | "rendimento"; descricao?: string };
export const CAMPOS_INVESTIMENTO = "id, name, kind, institution, balance, balance_on, monthly_rate, monthly_plan, status, note";
export const CAMPOS_MOVIMENTO = "id, investment_id, kind, amount, happened_on, note";
const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
export const normalizarInvestimento = (i: Record<string, unknown>): Investimento => ({ ...(i as Investimento), balance: Number(i.balance), monthly_rate: num(i.monthly_rate), monthly_plan: num(i.monthly_plan) });
export const normalizarMovimento = (m: Record<string, unknown>): Movimento => ({ ...(m as Movimento), amount: Number(m.amount), origem: "rendimento" });
/** Os lançamentos de investir e resgatar, como movimentos do investimento */
export const movimentosDe = (lancamentos: Lancamento[]): Movimento[] =>
  lancamentos.filter((l) => ehTransferencia(l) && l.investment_id).map((l) => ({
    id: l.id, investment_id: l.investment_id!, kind: l.kind as "aporte" | "resgate", amount: l.amount, happened_on: l.happened_on, note: null, origem: "lancamento", descricao: l.description,
  }));

/** Saldo de hoje: o informado, mais o que entrou e menos o que saiu depois daquele dia */
export function saldoAtual(i: Investimento, movs: Movimento[]) {
  return movs
    .filter((m) => m.investment_id === i.id && m.happened_on > i.balance_on)
    .reduce((t, m) => t + (m.kind === "resgate" ? -m.amount : m.amount), i.balance);
}

/** Juros compostos com aporte mensal: onde o saldo chega em N meses */
export function projetar(saldo: number, taxa: number, aporte: number, meses: number) {
  let s = saldo;
  for (let i = 0; i < meses; i++) s = s * (1 + taxa) + aporte;
  return s;
}

// ---------- onde está o dinheiro e quanto posso gastar ----------

/** Conta corrente: o saldo informado, mais o efeito de cada lançamento pago depois daquele dia
 *  (entradas e resgates somam; saídas e aportes tiram) */
export function saldoDaConta(a: Ajustes, lancamentos: Lancamento[]) {
  if (a.cash_balance === null || !a.cash_on) return null;
  return lancamentos.filter((x) => x.paid && x.happened_on > a.cash_on!).reduce((t, x) => t + naConta(x), a.cash_balance);
}

/** Os envelopes do ciclo: do que entrou, a parte das parcelas e a de investir saem primeiro; o resto é gasto livre.
 *  Se as parcelas passam da parte delas, a diferença sai do gasto livre. */
export function envelopes(a: Ajustes, entrou: number, parcelasDoCiclo: number, aportes: number, gastoLivre: number) {
  const alvoParcelas = (entrou * a.pct_parcelas) / 100;
  const alvoInvestir = (entrou * a.pct_investir) / 100;
  const excesso = Math.max(0, parcelasDoCiclo - alvoParcelas);
  const livre = Math.max(0, (entrou * a.pct_livre) / 100 - excesso);
  return {
    parcelas: { alvo: alvoParcelas, usado: parcelasDoCiclo },
    investir: { alvo: alvoInvestir, usado: aportes },
    livre: { alvo: livre, usado: gastoLivre, sobra: livre - gastoLivre },
    excesso,
  };
}
