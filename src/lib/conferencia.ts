// Conferência (a aba Conciliação da planilha): checagens automáticas que dizem se os números batem,
// e os avisos do topo de Finanças ("o que eu preciso saber hoje").
import {
  ehAjuste, ehTransferencia, moeda, mesCurto, naConta, situacaoParcelamento, type Categoria, type Lancamento, type Parcelamento,
} from "./financas";

export type ItemChecagem = { id: string; dia: string; texto: string };
export type Checagem = { chave: string; titulo: string; ok: boolean; detalhe: string; itens: ItemChecagem[] };

export const CONFERIDO = "Conferido: não é repetido";
const r2 = (v: number) => Math.round(v * 100) / 100;
const dm = (iso: string) => `${iso.slice(8)}/${iso.slice(5, 7)}/${iso.slice(2, 4)}`;
const item = (l: Lancamento, extra = ""): ItemChecagem => ({ id: l.id, dia: l.happened_on, texto: `${l.description} · ${moeda(l.amount)}${extra}` });

/**
 * @param lancamentos todos os lançamentos (de todas as contas)
 * @param daConta os da conta (ou contas) que contam no saldo
 * @param investimentos saldo de cada investimento ativo, já somado dos movimentos
 */
export function checagens({ lancamentos, daConta, categorias, parcelamentos, investimentos, idsInvestimentos, hoje }: {
  lancamentos: Lancamento[]; daConta: Lancamento[]; categorias: Categoria[]; parcelamentos: Parcelamento[];
  investimentos: { nome: string; saldo: number }[]; idsInvestimentos: Set<string>; hoje: string;
}): Checagem[] {
  const lista: Checagem[] = [];
  const add = (chave: string, titulo: string, itens: ItemChecagem[], detalheOk: string, detalheErro: (n: number) => string) =>
    lista.push({ chave, titulo, ok: itens.length === 0, detalhe: itens.length ? detalheErro(itens.length) : detalheOk, itens });

  // 1. A conta nunca fica negativa (se ficou, falta lançar uma entrada ou um valor está errado)
  const negativos: ItemChecagem[] = [];
  const porDia = new Map<string, number>();
  for (const l of daConta) if (l.paid) porDia.set(l.happened_on, (porDia.get(l.happened_on) ?? 0) + naConta(l));
  let saldo = 0;
  for (const dia of [...porDia.keys()].sort()) {
    saldo = r2(saldo + porDia.get(dia)!);
    if (saldo < -0.05 && dia <= hoje) negativos.push({ id: dia, dia, texto: `Fim do dia ${dm(dia)}: ${moeda(saldo)}` });
  }
  add("negativo", "A conta não fica negativa em nenhum dia", negativos.reverse(), "Em nenhum dia o saldo ficou abaixo de zero.",
    (n) => `Em ${n} ${n === 1 ? "dia" : "dias"} o saldo ficou negativo: falta uma entrada na planilha, ou um valor ou uma data está errado.`);

  // 2. Lançamentos repetidos (mesmo dia, valor, tipo e descrição), a menos que já tenha conferido
  const grupos = new Map<string, Lancamento[]>();
  for (const l of lancamentos) {
    if ((l.note ?? "").includes(CONFERIDO)) continue;
    const k = [l.happened_on, l.kind, l.amount.toFixed(2), l.description.trim().toLowerCase(), l.account_id ?? ""].join("|");
    grupos.set(k, [...(grupos.get(k) ?? []), l]);
  }
  const repetidos = [...grupos.values()].filter((g) => g.length > 1).flatMap((g) => g.map((l) => item(l, ` · ${g.length}x no dia`)));
  add("repetidos", "Nenhum lançamento repetido", repetidos.sort((a, b) => b.dia.localeCompare(a.dia)), "Nenhum lançamento igual no mesmo dia.",
    (n) => `${n} lançamentos iguais no mesmo dia. Se não forem de verdade, apague o que sobrou na planilha.`);

  // 3. Categoria que existe na lista (renomear pela lista acompanha os lançamentos; uma solta fica fora dos resumos)
  const nomes = { entrada: new Set(categorias.filter((c) => c.kind === "entrada").map((c) => c.name)), saida: new Set(categorias.filter((c) => c.kind === "saida").map((c) => c.name)) };
  const semCategoria = lancamentos.filter((l) => !ehTransferencia(l) && !ehAjuste(l) && !nomes[l.kind as "entrada" | "saida"]?.has(l.category)).map((l) => item(l, ` · "${l.category || "sem categoria"}"`));
  add("categoria", "Todo lançamento com categoria da lista", semCategoria, "Todos estão numa categoria sua.",
    (n) => `${n} ${n === 1 ? "lançamento está" : "lançamentos estão"} com uma categoria que não está na sua lista.`);

  // 4. Valores: maiores que zero (o tipo diz se entra ou sai)
  const valores = lancamentos.filter((l) => !(l.amount > 0)).map((l) => item(l));
  add("valores", "Valores maiores que zero", valores, "Nenhum valor zerado ou negativo.", (n) => `${n} com valor zero ou negativo.`);

  // 5. Datas: nada pago no futuro
  const futuro = lancamentos.filter((l) => l.paid && l.happened_on > hoje).map((l) => item(l));
  add("futuro", "Nada marcado como pago no futuro", futuro, "Nenhum pagamento com data depois de hoje.",
    (n) => `${n} ${n === 1 ? "está marcado" : "estão marcados"} como pago com data depois de hoje.`);

  // 6. Transferências: todo "investi"/"resgatei" aponta para um investimento que existe
  const soltas = lancamentos.filter((l) => ehTransferencia(l) && !idsInvestimentos.has(l.investment_id ?? "")).map((l) => item(l));
  add("transferencias", "Investir e resgatar ligados a um investimento", soltas, "Todo aporte e resgate tem o investimento certo.",
    (n) => `${n} sem investimento: o dinheiro sai da conta e não aparece em lugar nenhum.`);

  // 7. Investimentos: nenhum saldo negativo
  const invNeg = investimentos.filter((i) => i.saldo < -0.005).map((i) => ({ id: i.nome, dia: hoje, texto: `${i.nome}: ${moeda(i.saldo)}` }));
  add("investimentos", "Nenhum investimento negativo", invNeg, "Todo investimento com saldo zero ou positivo.",
    (n) => `${n} com saldo negativo: falta um aporte ou o resgate está maior que o investido.`);

  // 8. Parcelas pagas = pagas antes + pagamentos lançados, e nunca mais pagamentos que parcelas
  const ligados = new Map<string, number>();
  for (const l of lancamentos) if (l.installment_id && l.paid) ligados.set(l.installment_id, (ligados.get(l.installment_id) ?? 0) + 1);
  const parcelasErradas = parcelamentos.flatMap((p) => {
    const lancados = ligados.get(p.id) ?? 0, antes = p.paid_before ?? 0;
    if (antes + lancados > p.installments) return [{ id: p.id, dia: p.first_due, texto: `${p.title}: ${antes + lancados} pagamentos para ${p.installments} parcelas` }];
    if (p.paid_count !== antes + lancados) return [{ id: p.id, dia: p.first_due, texto: `${p.title}: conta ${p.paid_count} pagas, mas há ${lancados} lançadas e ${antes} de antes` }];
    return [];
  });
  add("parcelas", "Parcelas pagas batem com os lançamentos", parcelasErradas, "Cada parcela paga tem o seu lançamento.",
    (n) => `${n} ${n === 1 ? "parcelamento não bate" : "parcelamentos não batem"}: confira as pagas na aba Dívidas da planilha.`);

  // 9. Nada a pagar esquecido
  const vencidos = lancamentos.filter((l) => !l.paid && l.happened_on < hoje).map((l) => item(l, ` · venceu ${dm(l.happened_on)}`));
  add("vencidos", "Nada a pagar ou receber esquecido", vencidos, "Nenhum lançamento em aberto com data passada.",
    (n) => `${n} em aberto com a data já passada.`);

  return lista;
}

export type Aviso = { tom: "erro" | "atencao" | "info"; texto: string; link?: string };

/** "O que eu preciso saber hoje": o resumo da aba Início da planilha */
export function avisosDoDia({ problemas, parcelasMes, renda, pctLimite, tenho, devo, parcelamentos, hoje, pixFalta, pixVencido, nomeMes, livre }: {
  problemas: number; parcelasMes: number; renda: number; pctLimite: number; tenho: number; devo: number; parcelamentos: Parcelamento[]; hoje: string;
  pixFalta: number; pixVencido: boolean; nomeMes: string; livre: { alvo: number; usado: number } | null;
}): Aviso[] {
  const avisos: Aviso[] = [];
  if (problemas) avisos.push({ tom: "erro", texto: `${problemas} ${problemas === 1 ? "checagem pede" : "checagens pedem"} correção na Conferência.`, link: "/financas?aba=resumo#conferencia" });
  if (pixFalta > 0) avisos.push({ tom: pixVencido ? "erro" : "atencao", texto: `${pixVencido ? "Falta mandar" : "A mandar"} o Pix das parcelas de ${nomeMes}: ${moeda(pixFalta)}.`, link: "/financas?aba=parcelas" });
  if (livre && livre.alvo > 0) {
    const sobra = r2(livre.alvo - livre.usado);
    avisos.push({ tom: sobra < 0 ? "erro" : "info", texto: sobra < 0 ? `Você passou ${moeda(-sobra)} do gasto livre de ${nomeMes} (${moeda(livre.alvo)}).` : `Você pode gastar ${moeda(livre.alvo)} livremente em ${nomeMes}. Já usou ${moeda(livre.usado)}, ainda pode ${moeda(sobra)}.`, link: "/financas?aba=mes" });
  }
  if (renda > 0 && parcelasMes > 0) {
    const pct = parcelasMes / renda;
    avisos.push({ tom: pct > pctLimite / 100 ? "atencao" : "info", texto: `Suas parcelas de ${nomeMes} (${moeda(parcelasMes)}) comprometem ${String(Math.round(pct * 1000) / 10).replace(".", ",")}% da sua renda${pct > pctLimite / 100 ? `, acima dos ${pctLimite}% do seu limite` : ""}.` });
  }
  const real = r2(tenho - devo);
  const ativos = parcelamentos.map((p) => ({ p, s: situacaoParcelamento(p, hoje) })).filter(({ s }) => s.estado !== "quitado");
  const ultima = ativos.map(({ s }) => s.ultima).sort().pop();
  if (real < 0) avisos.push({ tom: "atencao", texto: `Sua situação real é negativa: você deve ${moeda(-real)} mais do que tem.${ultima ? ` A última parcela é em ${mesCurto(ultima)}.` : ""}` });
  const proxima = [...ativos].sort((a, b) => a.s.ultima.localeCompare(b.s.ultima))[0];
  if (proxima) avisos.push({ tom: "info", texto: `Próxima dívida a sair: ${proxima.p.title}, faltando ${moeda(proxima.s.restante)} (última parcela em ${mesCurto(proxima.s.ultima)}).`, link: "/financas?aba=parcelas" });
  if (parcelamentos.length) avisos.push({ tom: "info", texto: `Você tem ${ativos.length} ${ativos.length === 1 ? "dívida" : "dívidas"} em curso e ${parcelamentos.length - ativos.length} já ${parcelamentos.length - ativos.length === 1 ? "quitada" : "quitadas"}.` });
  return avisos;
}
