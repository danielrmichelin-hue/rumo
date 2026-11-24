// Espelho da planilha de finanças do Daniel (controle.xlsx): lê as abas Lançamentos, Dívidas, Investimentos e Meu Mês
// e compara com o Rumo. Enquanto a planilha manda, o Rumo só espelha: o que é novo entra, o que só está no Rumo sai.
import { dataDoExcel, type Abas, type Celula } from "./xlsx";
import {
  AJUSTE, naConta, nomesCategorias, normalizarDescricao, SALDO_INICIAL, sugerirCategoria,
  type Categoria, type Conta, type Degrau, type Investimento, type Lancamento, type Parcelamento, type Regra,
} from "./financas";

export const ABAS_PLANILHA = ["Lançamentos", "Dívidas", "Investimentos", "Meu Mês"];

const r2 = (v: number) => Math.round(v * 100) / 100;
const txt = (v: Celula) => (v === null || v === undefined ? "" : String(v).trim());
const num = (v: Celula) => (typeof v === "number" ? v : typeof v === "string" && v.trim() && Number.isFinite(Number(v.replace(",", "."))) ? Number(v.replace(",", ".")) : null);

/** Subcategoria da planilha → categoria do Rumo */
const CATEGORIA: Record<string, string> = {
  "Mercado & Supermercado": "Mercado", "Bebidas & Snacks": "Restaurantes e delivery", "Delivery (iFood)": "Restaurantes e delivery",
  "Restaurantes & Lanches": "Restaurantes e delivery", "Transporte por App": "Transporte", "Passagens & Rodoviária": "Transporte",
  "Combustível": "Combustível", "Lavagem & Manutenção Veicular": "Transporte", "Pedágio & Estacionamento": "Transporte",
  "Decoração & Utensílios": "Moradia", "Pets": "Outros", "Cabelo & Barbearia": "Cuidados pessoais", "Higiene & Cosméticos": "Cuidados pessoais",
  "Calçados": "Compras", "Roupas": "Compras", "Acessórios": "Compras", "Assinaturas de IA & Software": "Assinaturas",
  "Eletrônicos & Celular": "Compras", "Cinema & Streaming": "Lazer", "Jogos & Colecionáveis": "Lazer", "Passeios & Eventos": "Lazer",
  "Presentes": "Presentes e doações", "Doações & Ofertas": "Presentes e doações", "Alianças & Casamento": "Compras",
  "Cursos & Estudos": "Educação", "Taxas e Tarifas": "Impostos",
  "Salário / Pró-labore": "Salário", "Renda Extra & Freelas": "Serviços", "Venda de Bens": "Vendas", "Reembolsos": "Outros",
  "Rendimento de Investimentos": "Rendimentos",
};
const MACROS_GENERICOS = new Set(["Diversas", "Dívidas", "Mercado", "Salário", "Outras Receitas", "Investimento Aporte", "Investimento Rendimento", "Resgate aplicação", "Saldo Inicial"]);

export type TipoPlanilha = "entrada" | "saida" | "aporte" | "resgate" | "rendimento";
export type LinhaPlanilha = {
  linha: number; dia: string; valor: number; conta: string; tipo: TipoPlanilha;
  descricao: string; sub: string; categoria: string | null; parcela: boolean;
};
export type ParcPlanilha = { linha: number; title: string; category: string; total: number; installments: number; pagas: number; first_due: string };
export type PlanilhaLida = {
  linhas: LinhaPlanilha[]; parcelamentos: ParcPlanilha[];
  plano: { degraus: Degrau[]; taxa: number | null };
  pcts: { pct_parcelas: number; pct_investir: number; pct_livre: number } | null;
  erros: string[];
};

/** Lê as abas da planilha. Erros em português, com a linha, quando não dá para confiar no que foi lido. */
export function lerPlanilha(abas: Abas): PlanilhaLida {
  const erros: string[] = [];
  const L = abas["Lançamentos"];
  if (!L) return { linhas: [], parcelamentos: [], plano: { degraus: [], taxa: null }, pcts: null, erros: ["A planilha não tem a aba Lançamentos."] };
  // Cabeçalho na linha 5: Macro, Descrição, Valor, Data, …, Local (I), …, Tipo (K), …, Subcategoria (N), …, Parcelado (P)
  const cab = (L[5] ?? []).map(txt);
  const col = (nome: string) => cab.findIndex((c) => c === nome);
  const c = { macro: col("Macro"), desc: col("Descrição"), valor: col("Valor"), data: col("Data"), local: col("Local"), tipo: col("Tipo"), sub: col("Subcategoria"), parc: col("Parcelado") };
  const faltando = Object.entries(c).filter(([, i]) => i < 0).map(([k]) => k);
  if (faltando.length) return { linhas: [], parcelamentos: [], plano: { degraus: [], taxa: null }, pcts: null, erros: [`A aba Lançamentos mudou de formato (falta a coluna: ${faltando.join(", ")}).`] };

  const linhas: LinhaPlanilha[] = [];
  for (let n = 6; n < L.length; n++) {
    const r = L[n];
    if (!r) continue;
    const macro = txt(r[c.macro]), desc = txt(r[c.desc]), valor = num(r[c.valor]);
    if (!macro && valor === null) continue;
    const dia = dataDoExcel(r[c.data] ?? null);
    if (!dia) { erros.push(`Lançamentos, linha ${n}: data que não consigo ler.`); continue; }
    if (valor === null) { erros.push(`Lançamentos, linha ${n}: valor que não consigo ler.`); continue; }
    if (Math.abs(valor) < 0.005) continue;
    const local = txt(r[c.local]), tipoPl = txt(r[c.tipo]), sub = txt(r[c.sub]);
    if (!["Conta Corrente", "Conta Empresa", "Investimento"].includes(local)) { erros.push(`Lançamentos, linha ${n}: local "${local}" desconhecido.`); continue; }
    // O lado do investimento só traz os rendimentos; aplicação e resgate já estão do lado da conta
    if (local === "Investimento" && tipoPl === "Investimento") continue;
    let tipo: TipoPlanilha;
    if (local === "Investimento") tipo = "rendimento";
    else if (tipoPl === "Investimento") tipo = valor < 0 ? "aporte" : "resgate";
    else tipo = valor < 0 ? "saida" : "entrada";
    let descricao = desc && !["Compras", "Saldo"].includes(desc) ? desc : macro;
    if (macro === "Mercado" && desc === "Compras") descricao = "Mercado";
    if (!MACROS_GENERICOS.has(macro) && descricao !== macro) descricao = `${macro} · ${descricao}`;
    const categoria = tipoPl === "Saldo Inicial" ? SALDO_INICIAL : tipoPl === "Ajuste" ? AJUSTE : CATEGORIA[sub] ?? null;
    linhas.push({ linha: n, dia, valor: r2(valor), conta: local, tipo, descricao: descricao.slice(0, 120), sub, categoria, parcela: txt(r[c.parc]) === "Sim" || macro === "Dívidas" });
  }

  // Dívidas: Nome, Classificação, Valor Total, Qtde Parcela, Valor Parcela, Pago, …, Início (J); até "Total"
  const parcelamentos: ParcPlanilha[] = [];
  const D = abas["Dívidas"] ?? [];
  const vistos = new Map<string, number>();
  for (let n = 4; n < D.length; n++) {
    const r = D[n]; if (!r) continue;
    const nome = txt(r[1]);
    if (!nome) continue;
    if (nome === "Total") break;
    const total = num(r[3]), qtd = num(r[4]), pagas = num(r[6]), ini = dataDoExcel(r[9] ?? null);
    if (total === null || qtd === null || !ini) { erros.push(`Dívidas, linha ${n} (${nome}): valor, parcelas ou início que não consigo ler.`); continue; }
    const repetido = vistos.get(nome) ?? 0;
    vistos.set(nome, repetido + 1);
    const classe = txt(r[2]);
    const title = repetido ? `${nome} (${classe === "Presente" ? "presente" : repetido + 1})` : nome;
    parcelamentos.push({ linha: n, title, category: classe === "Presente" ? "Presentes e doações" : "Compras", total: r2(total), installments: Math.round(qtd), pagas: Math.max(0, Math.round(pagas ?? 0)), first_due: ini });
  }

  // Investimentos: Data (B), Saldo Inicial, Aporte Planejado (D), Juros Est. (E): vira o plano em degraus
  const I = abas["Investimentos"] ?? [];
  const degraus: Degrau[] = [];
  let taxa: number | null = null;
  for (let n = 3; n < I.length; n++) {
    const r = I[n]; if (!r) continue;
    const dia = dataDoExcel(r[1] ?? null), aporte = num(r[3]), juros = num(r[4]);
    if (!dia || aporte === null) continue;
    if (taxa === null && juros !== null && juros >= 0 && juros <= 0.2) taxa = juros;
    const mes = dia.slice(0, 7);
    if (!degraus.length || degraus[degraus.length - 1].valor !== r2(aporte)) degraus.push({ de: mes, valor: r2(aporte) });
  }

  // Meu Mês: as porcentagens das caixinhas (C11 parcelas, C12 investir, C13 livre)
  const M = abas["Meu Mês"] ?? [];
  const pc = [num(M[11]?.[2] ?? null), num(M[12]?.[2] ?? null), num(M[13]?.[2] ?? null)].map((v) => (v === null ? null : Math.round(v * 100)));
  const pcts = pc.every((v) => v !== null && v >= 0 && v <= 100) && pc.reduce((t, v) => t! + v!, 0) === 100 ? { pct_parcelas: pc[0]!, pct_investir: pc[1]!, pct_livre: pc[2]! } : null;

  return { linhas, parcelamentos, plano: { degraus, taxa }, pcts, erros };
}

// ---------- comparar com o Rumo ----------

const nomeParc = (s: string) => normalizarDescricao(s.replace(/\(presente\)/i, "")).replace(/\b(parcela|parcelas|quitacao)\b/g, " ").replace(/\s+/g, " ").trim();

export type Novo = {
  chave: string; linha: number; dia: string; valor: number; conta: string; tipo: Exclude<TipoPlanilha, "rendimento">;
  description: string; category: string; account_id: string | null; investment_id: string | null;
  installment_id: string | null; parcela_chave: string | null; parcelaNome: string | null;
};
export type Espelho = {
  de: string; ate: string;
  iguais: number; datasDiferentes: number;
  novos: Novo[];
  soNoRumo: Lancamento[];
  rendNovos: { linha: number; dia: string; valor: number; descricao: string }[];
  rendSoNoRumo: { id: string; happened_on: string; amount: number }[];
  parcNovos: (ParcPlanilha & { chave: string })[];
  parcAlterar: { id: string; title: string; antes: string; depois: string; total: number; installments: number; first_due: string }[];
  parcSoNoRumo: Parcelamento[];
  pagas: { id: string | null; chave: string | null; pagas: number }[];
  plano: { investment_id: string; plan_steps: Degrau[]; monthly_rate: number | null; monthly_plan: number | null; muda: boolean } | null;
  pcts: PlanilhaLida["pcts"] & { muda?: boolean } | null;
  saldoPlanilha: number; saldoRumoAgora: number; saldoRumoDepois: number;
  avisos: string[];
};

export function espelhar(pl: PlanilhaLida, rumo: {
  lancamentos: Lancamento[]; contas: Conta[]; investimentos: Investimento[]; rendimentos: { id: string; investment_id: string; happened_on: string; amount: number }[];
  parcelamentos: Parcelamento[]; categorias: Categoria[]; regras: Regra[]; ajustes: { pct_parcelas: number; pct_investir: number; pct_livre: number }; hoje: string;
}): Espelho {
  const avisos: string[] = [];
  const principal = rumo.contas.find((c) => !c.archived) ?? null;
  const empresa = rumo.contas.find((c) => /empresa/i.test(c.name)) ?? null;
  const contaDe = (l: Lancamento) => l.account_id ?? principal?.id ?? "";
  const idConta = (nome: string) => (nome === "Conta Empresa" ? empresa?.id ?? null : principal?.id ?? null);
  const invAtivo = rumo.investimentos.find((i) => i.status === "ativo") ?? rumo.investimentos[0] ?? null;
  if (pl.linhas.some((l) => l.conta === "Conta Empresa") && !empresa) avisos.push("A planilha tem a Conta Empresa e o Rumo não: esses lançamentos entram na conta principal.");
  if (pl.linhas.some((l) => l.tipo !== "entrada" && l.tipo !== "saida") && !invAtivo) avisos.push("A planilha tem investimentos e o Rumo não tem nenhum investimento criado.");

  const contas = pl.linhas.filter((l) => l.tipo !== "rendimento");
  const dias = pl.linhas.map((l) => l.dia).sort();
  const de = dias[0] ?? rumo.hoje, ate = dias[dias.length - 1] ?? rumo.hoje;

  // 1. Lançamentos: mesmo dia, mesma conta, mesmo valor na conta; entre vários iguais, o de descrição mais parecida
  const pagos = rumo.lancamentos.filter((l) => l.paid);
  const porChave = new Map<string, Lancamento[]>();
  for (const l of pagos) {
    const k = `${contaDe(l)}|${l.happened_on}|${r2(naConta(l)).toFixed(2)}`;
    porChave.set(k, [...(porChave.get(k) ?? []), l]);
  }
  const usados = new Set<string>();
  let semPar: LinhaPlanilha[] = [];
  let iguais = 0, datasDiferentes = 0;
  const contaX = (x: LinhaPlanilha) => idConta(x.conta) ?? principal?.id ?? "";
  for (const x of contas) {
    const k = `${contaX(x)}|${x.dia}|${x.valor.toFixed(2)}`;
    const cands = (porChave.get(k) ?? []).filter((l) => !usados.has(l.id) && l.kind === x.tipo);
    if (!cands.length) { semPar.push(x); continue; }
    const alvo = normalizarDescricao(x.descricao);
    const melhor = cands.find((l) => normalizarDescricao(l.description) === alvo) ?? cands[0];
    usados.add(melhor.id); iguais++;
  }
  const livres = () => pagos.filter((l) => !usados.has(l.id));
  const mesmo = (l: Lancamento, x: LinhaPlanilha) => contaDe(l) === contaX(x) && l.kind === x.tipo;
  // Uma linha da planilha = vários lançamentos do Rumo no mesmo dia (ex.: um aporte de 2.000 lançado em 1.500 + 500)
  semPar = semPar.filter((x) => {
    const g = livres().filter((l) => mesmo(l, x) && l.happened_on === x.dia);
    if (g.length < 2 || Math.abs(r2(g.reduce((t, l) => t + naConta(l), 0)) - x.valor) >= 0.005) return true;
    g.forEach((l) => usados.add(l.id)); iguais++;
    return false;
  });
  // Vários da planilha no mesmo dia = um lançamento do Rumo
  for (const l of livres()) {
    const g = semPar.filter((x) => mesmo(l, x) && l.happened_on === x.dia);
    if (g.length < 2 || Math.abs(r2(g.reduce((t, x) => t + x.valor, 0)) - r2(naConta(l))) >= 0.005) continue;
    usados.add(l.id); iguais += g.length;
    semPar = semPar.filter((x) => !g.includes(x));
  }
  // Mesmo valor com a data até 3 dias diferente (ex.: o salário de 19/10 que a planilha pôs em 20/10): conta como igual
  const DIA = 86400000;
  semPar = semPar.filter((x) => {
    const perto = livres().filter((l) => mesmo(l, x) && Math.abs(r2(naConta(l)) - x.valor) < 0.005 && Math.abs(Date.parse(l.happened_on) - Date.parse(x.dia)) <= 3 * DIA)
      .sort((a, b) => Math.abs(Date.parse(a.happened_on) - Date.parse(x.dia)) - Math.abs(Date.parse(b.happened_on) - Date.parse(x.dia)));
    if (!perto.length) return true;
    usados.add(perto[0].id); iguais++; datasDiferentes++;
    return false;
  });
  const soNoRumo = pagos.filter((l) => !usados.has(l.id) && l.happened_on >= de).sort((a, b) => a.happened_on.localeCompare(b.happened_on));

  // 2. Parcelamentos: pelo nome e o início (e o valor); os novos ganham uma chave para ligar as parcelas
  const parcNovos: Espelho["parcNovos"] = [];
  const parcAlterar: Espelho["parcAlterar"] = [];
  const pagas: Espelho["pagas"] = [];
  const casadosParc = new Map<number, string>(); // linha da planilha → id no Rumo
  const usadosParc = new Set<string>();
  for (const p of pl.parcelamentos) {
    const mesmo = rumo.parcelamentos.filter((r) => !usadosParc.has(r.id) && nomeParc(r.title) === nomeParc(p.title));
    const achado = mesmo.find((r) => r.first_due === p.first_due && Math.abs(r.total - p.total) < 0.005)
      ?? mesmo.find((r) => r.first_due === p.first_due) ?? (mesmo.length === 1 ? mesmo[0] : undefined);
    if (achado) {
      usadosParc.add(achado.id); casadosParc.set(p.linha, achado.id);
      if (Math.abs(achado.total - p.total) >= 0.005 || achado.installments !== p.installments || achado.first_due !== p.first_due)
        parcAlterar.push({ id: achado.id, title: achado.title, antes: `${achado.installments}x, ${achado.total.toFixed(2)}, ${achado.first_due}`, depois: `${p.installments}x, ${p.total.toFixed(2)}, ${p.first_due}`, total: p.total, installments: p.installments, first_due: p.first_due });
      pagas.push({ id: achado.id, chave: null, pagas: p.pagas });
    } else {
      const chave = `p${p.linha}`;
      parcNovos.push({ ...p, chave });
      pagas.push({ id: null, chave, pagas: p.pagas });
    }
  }
  const parcSoNoRumo = rumo.parcelamentos.filter((r) => !usadosParc.has(r.id));
  // Para ligar um pagamento de parcela: o parcelamento com o nome na descrição, o que estava valendo na data
  const alvosParc = [
    ...pl.parcelamentos.map((p) => ({ nome: nomeParc(p.title), first_due: p.first_due, id: casadosParc.get(p.linha) ?? null, chave: casadosParc.has(p.linha) ? null : `p${p.linha}`, title: p.title })),
    ...parcSoNoRumo.map((r) => ({ nome: nomeParc(r.title), first_due: r.first_due, id: r.id, chave: null, title: r.title })),
  ].sort((a, b) => b.nome.length - a.nome.length);
  const ligarParcela = (descricao: string, dia: string) => {
    const d = nomeParc(descricao);
    const cands = alvosParc.filter((a) => a.nome && (d === a.nome || d.includes(a.nome) || (d.length > 4 && a.nome.includes(d))));
    if (!cands.length) return null;
    const melhorNome = cands[0].nome;
    const mesmoNome = cands.filter((a) => a.nome === melhorNome);
    return [...mesmoNome].filter((a) => a.first_due <= dia).sort((a, b) => a.first_due.localeCompare(b.first_due)).pop() ?? mesmoNome[0];
  };

  // 3. Os novos: categoria da planilha (ou pela regra do Rumo), conta, investimento e parcela
  const novos: Novo[] = semPar.map((x) => {
    const tipo = x.tipo as Novo["tipo"];
    const kindCat: "entrada" | "saida" = tipo === "entrada" || tipo === "resgate" ? "entrada" : "saida";
    const lista = nomesCategorias(rumo.categorias, kindCat);
    let category = x.categoria ?? "";
    if (category !== SALDO_INICIAL && category !== AJUSTE && !lista.includes(category)) {
      const s = sugerirCategoria(rumo.regras, x.descricao, kindCat);
      category = s && lista.includes(s.c) ? s.c : lista.includes("Outros") ? "Outros" : lista[0] ?? "Outros";
    }
    if (tipo === "aporte" || tipo === "resgate") category = "Investimentos";
    const alvo = x.parcela && tipo === "saida" ? ligarParcela(x.descricao, x.dia) : null;
    const conta = idConta(x.conta);
    return {
      chave: `l${x.linha}`, linha: x.linha, dia: x.dia, valor: x.valor, conta: x.conta, tipo, description: x.descricao, category,
      account_id: conta && conta !== principal?.id ? conta : null,
      investment_id: tipo === "aporte" || tipo === "resgate" ? invAtivo?.id ?? null : null,
      installment_id: alvo?.id ?? null, parcela_chave: alvo?.chave ?? null, parcelaNome: alvo?.title ?? null,
    };
  });

  // 4. Rendimentos do investimento: mesmo dia e valor
  const rendRumo = rumo.rendimentos.filter((m) => !invAtivo || m.investment_id === invAtivo.id);
  const usadosRend = new Set<string>();
  const rendNovos: Espelho["rendNovos"] = [];
  for (const x of pl.linhas.filter((l) => l.tipo === "rendimento")) {
    const par = rendRumo.find((m) => !usadosRend.has(m.id) && m.happened_on === x.dia && Math.abs(m.amount - Math.abs(x.valor)) < 0.005);
    if (par) usadosRend.add(par.id); else rendNovos.push({ linha: x.linha, dia: x.dia, valor: Math.abs(x.valor), descricao: x.descricao });
  }
  const rendSoNoRumo = rendRumo.filter((m) => !usadosRend.has(m.id) && m.happened_on >= de);

  // 5. Plano e divisão do mês
  const plano = invAtivo && pl.plano.degraus.length ? {
    investment_id: invAtivo.id, plan_steps: pl.plano.degraus, monthly_rate: pl.plano.taxa,
    monthly_plan: [...pl.plano.degraus].reverse().find((d) => d.de <= rumo.hoje.slice(0, 7))?.valor ?? null,
    muda: JSON.stringify(pl.plano.degraus) !== JSON.stringify(invAtivo.plan_steps ?? []) || (pl.plano.taxa !== null && Math.abs((invAtivo.monthly_rate ?? 0) - pl.plano.taxa) > 1e-6),
  } : null;
  const pcts = pl.pcts ? { ...pl.pcts, muda: pl.pcts.pct_parcelas !== rumo.ajustes.pct_parcelas || pl.pcts.pct_investir !== rumo.ajustes.pct_investir || pl.pcts.pct_livre !== rumo.ajustes.pct_livre } : null;

  // 6. A prova: o saldo da conta principal pela planilha e no Rumo, antes e depois
  const naPrincipal = (l: Lancamento) => contaDe(l) === principal?.id;
  const saldoPlanilha = r2(contas.filter((x) => x.conta === "Conta Corrente").reduce((t, x) => t + x.valor, 0));
  const saldoRumoAgora = r2(pagos.filter(naPrincipal).reduce((t, l) => t + naConta(l), 0));
  const saldoRumoDepois = r2(saldoRumoAgora - soNoRumo.filter(naPrincipal).reduce((t, l) => t + naConta(l), 0) + novos.filter((n) => !n.account_id).reduce((t, n) => t + n.valor, 0));

  return { de, ate, iguais, datasDiferentes, novos, soNoRumo, rendNovos, rendSoNoRumo, parcNovos, parcAlterar, parcSoNoRumo, pagas, plano, pcts, saldoPlanilha, saldoRumoAgora, saldoRumoDepois, avisos };
}
