// Painel do período (a aba Painel da planilha): resumo, a divisão 50/30/20 por tipo de gasto e o diagnóstico.
// Tudo sai dos lançamentos pagos da conta, mês a mês do salário.
import { ehAjuste, moeda, type Categoria, type Lancamento, type Natureza } from "./financas";

type Ciclo = { inicio: string; fim: string };
const r2 = (v: number) => Math.round(v * 100) / 100;
const pctTexto = (v: number) => `${String(Math.round(v * 1000) / 10).replace(".", ",")}%`;

export const METAS_NATUREZA: Record<Natureza, number> = { essencial: 0.5, estilo: 0.3, objetivos: 0.2 };

export function painelDoPeriodo({ lancamentos, ciclos, categorias, pctParcelas, pctInvestir }: {
  lancamentos: Lancamento[]; ciclos: Ciclo[]; categorias: Categoria[]; pctParcelas: number; pctInvestir: number;
}) {
  const n = Math.max(1, ciclos.length);
  const noPeriodo = lancamentos.filter((l) => l.paid && !ehAjuste(l) && ciclos.some((c) => l.happened_on >= c.inicio && l.happened_on <= c.fim));
  const soma = (f: (l: Lancamento) => boolean) => r2(noPeriodo.filter(f).reduce((t, l) => t + l.amount, 0));
  const entrou = soma((l) => l.kind === "entrada");
  const saiu = soma((l) => l.kind === "saida");
  const aportes = soma((l) => l.kind === "aporte");
  const resgates = soma((l) => l.kind === "resgate");
  const investiu = r2(aportes - resgates);
  const parcelas = soma((l) => l.kind === "saida" && !!l.installment_id);
  const fixos = soma((l) => l.kind === "saida" && !l.installment_id && (!!l.routine_id || /assinatura/i.test(l.category)));
  const natureza = (cat: string) => categorias.find((c) => c.kind === "saida" && c.name === cat)?.nature ?? null;
  const porNatureza = {
    essencial: soma((l) => l.kind === "saida" && natureza(l.category) === "essencial"),
    estilo: soma((l) => l.kind === "saida" && natureza(l.category) === "estilo"),
    // Objetivos e patrimônio: gastos com objetivo e o que foi investido (líquido)
    objetivos: r2(soma((l) => l.kind === "saida" && natureza(l.category) === "objetivos") + Math.max(0, investiu)),
    semTipo: soma((l) => l.kind === "saida" && !natureza(l.category)),
  };
  const porCategoria = [...new Set(noPeriodo.filter((l) => l.kind === "saida").map((l) => l.category))]
    .map((cat) => ({ cat, total: soma((l) => l.kind === "saida" && l.category === cat), vezes: noPeriodo.filter((l) => l.kind === "saida" && l.category === cat).length }))
    .sort((a, b) => b.total - a.total);

  // Diagnóstico: onde melhorar (frases curtas, com o número do período e a média por mês)
  const diag: { titulo: string; valor: number; texto: string; tom: "atencao" | "info" | "bom" }[] = [];
  const pct = (v: number) => (entrou ? v / entrou : 0);
  const maior = porCategoria[0];
  if (maior && saiu) diag.push({ titulo: `Maior gasto: ${maior.cat}`, valor: maior.total, tom: "info", texto: `${moeda(maior.total / n)} por mês, ${pctTexto(maior.total / saiu)} de tudo o que saiu.` });
  if (parcelas) diag.push({ titulo: "Compras parceladas", valor: parcelas, tom: pct(parcelas) > pctParcelas / 100 ? "atencao" : "info", texto: `Comprometeram ${pctTexto(pct(parcelas))} da renda${pct(parcelas) > pctParcelas / 100 ? `, acima dos ${pctParcelas}% do limite. Enquanto isso não cair, não há folga real` : ""}.` });
  if (fixos) diag.push({ titulo: "Contas fixas e assinaturas", valor: fixos, tom: "info", texto: `${moeda(fixos / n)} por mês fixos. Sobra depois dos fixos: ${moeda((entrou - fixos) / n)} por mês.` });
  const fora = porCategoria.filter((c) => /restaurante|delivery|lanche|ifood/i.test(c.cat)).reduce((t, c) => t + c.total, 0);
  const mercado = porCategoria.filter((c) => /mercado/i.test(c.cat)).reduce((t, c) => t + c.total, 0);
  if (fora && mercado) diag.push({ titulo: "Comida fora de casa", valor: fora, tom: fora > mercado * 2 ? "atencao" : "info", texto: `${moeda(fora / n)} por mês, ${String(Math.round((fora / mercado) * 10) / 10).replace(".", ",")} vezes o que vai no mercado.` });
  const presentes = porCategoria.filter((c) => /presente|doa/i.test(c.cat)).reduce((t, c) => t + c.total, 0);
  if (presentes) diag.push({ titulo: "Presentes e doações", valor: presentes, tom: "info", texto: `${moeda(presentes / n)} por mês. Um teto por mês evita o parcelamento em cascata.` });
  const nResgates = noPeriodo.filter((l) => l.kind === "resgate").length;
  if (nResgates >= 3) diag.push({ titulo: "Resgates do investimento", valor: resgates, tom: "atencao", texto: `Você resgatou ${nResgates} vezes (${moeda(resgates)}). Resgatar para pagar conta quer dizer que o mês não fechou.` });
  const excessoEstilo = porNatureza.estilo - entrou * METAS_NATUREZA.estilo;
  if (entrou && excessoEstilo > 0) diag.push({ titulo: "Estilo de vida acima de 30%", valor: excessoEstilo, tom: "atencao", texto: `Foram ${pctTexto(pct(porNatureza.estilo))} da renda. Cortar metade do excesso sobraria ${moeda(excessoEstilo / 2 / n)} por mês para investir.` });
  if (entrou) diag.push({ titulo: "Taxa de poupança", valor: investiu, tom: pct(investiu) >= pctInvestir / 100 ? "bom" : "atencao", texto: `Você investiu ${pctTexto(pct(investiu))} do que entrou (meta: ${pctInvestir}%).` });

  return {
    meses: n, entrou, saiu, sobra: r2(entrou - saiu), aportes, resgates, investiu, parcelas, fixos,
    poupanca: pct(investiu), porNatureza, porCategoria, diag,
    // Para os números baterem: o extrato do período (o que entrou − saiu − investiu = o que ficou na conta)
    ficou: r2(entrou - saiu - investiu),
  };
}

