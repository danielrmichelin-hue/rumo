"use client";

import { useOptimistic, useState, useTransition } from "react";
import { Archive, ArchiveRestore, Check, Plus, Scale, Settings2, Trash2 } from "lucide-react";
import { apagarInvestimento, apagarLancamento, apagarMovimento, conferirConta, conferirInvestimento, criarCategoria, criarConta, criarInvestimento, planoInvestimento, salvarCategoria, salvarConta, criarParcelamento, criarRotina, desfazerParcela, lancar, marcarLancamentoPago, movimentarInvestimento, pagarParcela, salvarAjustesFinancas, salvarOrcamento } from "@/app/(app)/acoes";
import { hojeISO, numeroBR, rotuloData } from "@/lib/datas";
import { moeda, naConta, NATUREZAS, nomesCategorias, ROTULO_TIPO, TIPOS_INVESTIMENTO, type Ajustes, type Categoria, type Conta, type Investimento, type Lancamento, type Movimento, type Natureza, type TipoLancamento } from "@/lib/financas";
import { CampoCategoria, CampoConta, useFinancas } from "./FinancasContexto";
import { useAvisar } from "./Avisos";
import { CampoContexto, Painel } from "./Comuns";
import type { ContextItem } from "./Shell";

/** Lançar em segundos: saída, entrada, investir ou resgatar ("ainda vou pagar" vira conta a pagar no mês) */
export function NovoLancamento({ contextos, inicio, fim, investimentos = [] }: { contextos: ContextItem[]; inicio: string; fim: string; investimentos?: Investimento[] }) {
  const hoje = hojeISO();
  const padraoDia = hoje >= inicio && hoje <= fim ? hoje : inicio;
  const [tipo, setTipo] = useState<TipoLancamento>("saida");
  const [valor, setValor] = useState("");
  const [descricao, setDescricao] = useState("");
  const { categorias: cats } = useFinancas();
  const padraoCat = (k: "entrada" | "saida") => { const n = nomesCategorias(cats, k); return k === "saida" ? n.find((c) => c === "Mercado") ?? n[0] : n[0]; };
  const [categoria, setCategoria] = useState(padraoCat("saida"));
  const [conta, setConta] = useState("");
  const [investimento, setInvestimento] = useState(investimentos[0]?.id ?? "");
  const [dia, setDia] = useState(padraoDia);
  const [aPagar, setAPagar] = useState(false);
  const [contexto, setContexto] = useState("");
  const [pendente, iniciar] = useTransition();
  const avisar = useAvisar();
  const transferencia = tipo === "aporte" || tipo === "resgate";
  const nomeInv = investimentos.find((i) => i.id === investimento)?.name ?? "";
  const escolher = (t: TipoLancamento) => { setTipo(t); if (t === "saida" || t === "entrada") setCategoria(padraoCat(t)); };

  return (
    <form
      className="fin-form"
      onSubmit={(e) => {
        e.preventDefault();
        const desc = descricao.trim() || (transferencia ? `${ROTULO_TIPO[tipo]} · ${nomeInv}` : "");
        iniciar(async () => {
          const r = await lancar({ kind: tipo, amount: numeroBR(valor), description: desc, category: categoria, happened_on: dia, paid: !aPagar, context_id: contexto || null, investment_id: transferencia ? investimento : null, account_id: conta || null });
          if (!r.ok) return avisar({ texto: r.erro ?? "Não foi possível lançar." });
          avisar({ texto: `${ROTULO_TIPO[tipo]}: ${moeda(numeroBR(valor))}${transferencia ? ` em ${nomeInv}` : ""}${aPagar && !transferencia ? ", a pagar" : ""}.`, acao: { rotulo: "Desfazer", fazer: () => iniciar(() => apagarLancamento(r.id!)) } });
          setValor(""); setDescricao(""); setAPagar(false);
        });
      }}
    >
      <div className="seg" role="radiogroup" aria-label="Tipo">
        {(["saida", "entrada", "aporte", "resgate"] as const).map((t) => (
          <label key={t}><input type="radio" checked={tipo === t} onChange={() => escolher(t)} disabled={(t === "aporte" || t === "resgate") && !investimentos.length} /><span>{ROTULO_TIPO[t]}</span></label>
        ))}
      </div>
      <div className="fin-form__linha">
        <label className="field">Valor<input className="input" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" required aria-label="Valor" /></label>
        <label className="field fin-form__desc">O que foi<input className="input" value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder={transferencia ? `${ROTULO_TIPO[tipo]} · ${nomeInv}` : tipo === "saida" ? "Ex.: Mercado da semana" : "Ex.: Salário"} maxLength={120} required={!transferencia} /></label>
        {transferencia ? (
          <label className="field">
            Investimento
            <select className="input" value={investimento} onChange={(e) => setInvestimento(e.target.value)}>{investimentos.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</select>
          </label>
        ) : (
          <CampoCategoria kind={tipo === "entrada" ? "entrada" : "saida"} value={categoria} onChange={setCategoria} />
        )}
        <label className="field">{aPagar ? "Vence em" : "Dia"}<input className="input" type="date" value={dia} onChange={(e) => setDia(e.target.value)} required /></label>
      </div>
      <div className="fin-form__pe">
        {transferencia
          ? <span className="field__hint">{tipo === "aporte" ? "Sai da conta e entra no investimento." : "Sai do investimento e volta para a conta."}</span>
          : <label className="check-line"><input type="checkbox" checked={aPagar} onChange={(e) => setAPagar(e.target.checked)} />{tipo === "saida" ? "Ainda vou pagar" : "Ainda vou receber"}</label>}
        <CampoConta value={conta} onChange={setConta} />
        {!transferencia && <details className="fin-form__mais"><summary>Contexto</summary><CampoContexto contextos={contextos} value={contexto} onChange={setContexto} /></details>}
        <button className="btn btn--sm" type="submit" disabled={pendente || !valor || (!transferencia && !descricao.trim()) || (transferencia && !investimento)}><Plus aria-hidden />Lançar</button>
      </div>
    </form>
  );
}

export function LinhaLancamento({ l, contexto }: { l: Lancamento; contexto?: ContextItem }) {
  const [pendente, iniciar] = useTransition();
  const avisar = useAvisar();
  return (
    <li className={`fin-l${l.paid ? "" : " fin-l--aberto"}`}>
      <time>{rotuloData(l.happened_on).replace(/^./, (c) => c.toUpperCase())}</time>
      <span className="fin-l__d">
        <b>{l.description}</b>
        <small>{l.category}{contexto && <> · <i className="dot" style={{ background: contexto.color }} />{contexto.name}</>}{l.routine_id ? " · conta fixa" : ""}{l.kind === "aporte" ? " · investi" : l.kind === "resgate" ? " · resgatei" : ""}{!l.paid ? (l.kind === "saida" ? " · a pagar" : " · a receber") : ""}</small>
      </span>
      <span className={`fin-l__v fin-l__v--${l.kind}`}>{naConta(l) < 0 ? "−" : "+"}{moeda(l.amount)}</span>
      <span className="fin-l__a">
        {!l.paid && (
          <button type="button" className="btn btn--line btn--sm" disabled={pendente} onClick={() => iniciar(async () => { await marcarLancamentoPago(l.id, true); avisar({ texto: l.kind === "saida" ? "Marcado como pago." : "Marcado como recebido." }); })}>
            <Check aria-hidden />{l.kind === "saida" ? "Paguei" : "Recebi"}
          </button>
        )}
        <button type="button" className="icon-btn" aria-label={`Apagar ${l.description}`} disabled={pendente} onClick={() => { if (confirm(`Apagar "${l.description}"?`)) iniciar(() => apagarLancamento(l.id)); }}><Trash2 size={15} /></button>
      </span>
    </li>
  );
}

/** Conta fixa nova: uma rotina mensal com valor */
export function NovaContaFixa({ contextos }: { contextos: ContextItem[] }) {
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [valor, setValor] = useState("");
  const [dia, setDia] = useState("10");
  const [categoria, setCategoria] = useState("Contas da casa");
  const [contexto, setContexto] = useState(contextos.find((c) => /finan|casa/i.test(c.name))?.id ?? "");
  const [pendente, iniciar] = useTransition();
  const avisar = useAvisar();
  if (!aberto) return <button type="button" className="btn btn--ghost btn--sm" onClick={() => setAberto(true)}><Plus aria-hidden />Conta fixa</button>;
  return (
    <form
      className="fin-form fin-form--conta"
      onSubmit={(e) => {
        e.preventDefault();
        iniciar(async () => {
          const r = await criarRotina({ title: nome, context_id: contexto || null, days: null, times_per_week: null, month_day: Number(dia) || null, at_time: null, duration_min: null, amount: numeroBR(valor), category: categoria });
          if (!r.ok) return avisar({ texto: r.erro ?? "Não foi possível criar." });
          avisar({ texto: `${nome}: todo dia ${dia}, ${moeda(numeroBR(valor))}. Aparece no Hoje no dia.` });
          setNome(""); setValor(""); setAberto(false);
        });
      }}
    >
      <div className="fin-form__linha">
        <label className="field fin-form__desc">Conta<input className="input" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Condomínio, internet, DAS" required maxLength={120} autoFocus /></label>
        <label className="field">Valor<input className="input" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" required /></label>
        <label className="field">Todo dia<input className="input" inputMode="numeric" value={dia} onChange={(e) => setDia(e.target.value.replace(/\D/g, "").slice(0, 2))} required /></label>
        <CampoCategoria kind="saida" value={categoria} onChange={setCategoria} />
      </div>
      <div className="fin-form__pe">
        <details className="fin-form__mais"><summary>Contexto</summary><CampoContexto contextos={contextos} value={contexto} onChange={setContexto} /></details>
        <button className="btn btn--ghost btn--sm" type="button" onClick={() => setAberto(false)}>Cancelar</button>
        <button className="btn btn--sm" type="submit" disabled={pendente || !nome.trim() || !valor}>Criar conta fixa</button>
      </div>
    </form>
  );
}

/** Limite por categoria, ajustado ali mesmo */
export function LimiteCategoria({ categoria, limite }: { categoria: string; limite: number | null }) {
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(limite ? String(limite).replace(".", ",") : "");
  const [pendente, iniciar] = useTransition();
  if (!editando) return <button type="button" className="fin-cat__lim" onClick={() => setEditando(true)}>{limite ? `de ${moeda(limite)}` : "definir limite"}</button>;
  return (
    <form className="fin-cat__form" onSubmit={(e) => { e.preventDefault(); iniciar(async () => { await salvarOrcamento(categoria, numeroBR(valor)); setEditando(false); }); }}>
      <input className="input" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} aria-label={`Limite de ${categoria}`} placeholder="0,00" autoFocus />
      <button className="btn btn--sm" type="submit" disabled={pendente}>OK</button>
    </form>
  );
}

// ---------- ajustes: dia do pagamento, envelopes e saldo da conta ----------

export function AjustesFinancas({ ajustes }: { ajustes: Ajustes }) {
  const [aberto, setAberto] = useState(false);
  const [pct, setPct] = useState([ajustes.pct_parcelas, ajustes.pct_investir, ajustes.pct_livre].map(String));
  const [diaRecebe, setDiaRecebe] = useState(ajustes.pay_day > 1 ? String(ajustes.pay_day) : "");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const avisar = useAvisar();
  const soma = pct.reduce((t, x) => t + (Number(x) || 0), 0);
  const rotulos = ["Parcelas", "Investir", "Gasto livre"];
  return (
    <>
      <button type="button" className="btn btn--line btn--sm" onClick={() => setAberto(true)}><Settings2 aria-hidden />Ajustes</button>
      {aberto && (
        <Painel titulo="Ajustes das finanças" fechar={() => setAberto(false)}>
          <form
            className="detail"
            style={{ gap: 18 }}
            onSubmit={(e) => {
              e.preventDefault();
              setErro(null);
              iniciar(async () => {
                const r = await salvarAjustesFinancas({ pay_day: Number(diaRecebe) || null, pct_parcelas: Number(pct[0]), pct_investir: Number(pct[1]), pct_livre: Number(pct[2]) });
                if (!r.ok) return setErro(r.erro ?? "Não foi possível guardar.");
                avisar({ texto: "Ajustes guardados." });
                setAberto(false);
              });
            }}
          >
            <label className="field">
              Dia em que recebo
              <input className="input" style={{ maxWidth: 120 }} inputMode="numeric" value={diaRecebe} onChange={(e) => setDiaRecebe(e.target.value.replace(/\D/g, "").slice(0, 2))} placeholder="1" />
              <span className="field__hint">{Number(diaRecebe) >= 2 && Number(diaRecebe) <= 28 ? `Cada mês vai do dia ${Number(diaRecebe)} até o dia ${Number(diaRecebe) - 1} do mês seguinte.` : Number(diaRecebe) > 28 ? "Use um dia de 1 a 28." : "Vazio ou 1: o mês do calendário."}</span>
            </label>
            <div className="field">
              Como divido o que entra no mês
              <div className="fin-pcts">
                {rotulos.map((r, i) => (
                  <label key={r} className="field">{r}
                    <span className="fin-pct"><input className="input" inputMode="numeric" value={pct[i]} onChange={(e) => setPct(pct.map((x, j) => (j === i ? e.target.value.replace(/\D/g, "").slice(0, 3) : x)))} /><small>%</small></span>
                  </label>
                ))}
              </div>
              <span className="field__hint">{soma === 100 ? "Parcelas e investir saem primeiro; o resto é o que você pode gastar livre." : `Soma ${soma}%. Precisa dar 100%.`}</span>
            </div>
            {erro && <p className="note note--err" role="alert">{erro}</p>}
            <div className="detail__foot"><button className="btn" type="submit" disabled={pendente || soma !== 100}>Guardar</button></div>
          </form>
          <GerirContas />
          <GerirCategorias />
        </Painel>
      )}
    </>
  );
}

// ---------- parcelamentos ----------

/** Paguei esta parcela: lança a saída e conta como paga */
export function PagarParcela({ id, titulo, rotulo }: { id: string; titulo: string; rotulo: string }) {
  const [paga, setPaga] = useOptimistic(false);
  const [, iniciar] = useTransition();
  const avisar = useAvisar();
  return (
    <button type="button" role="checkbox" aria-checked={paga} aria-label={`Paguei ${titulo}, ${rotulo}`} className="check" disabled={paga}
      onClick={() => iniciar(async () => {
        setPaga(true);
        const r = await pagarParcela(id);
        if (r.ok) avisar({ texto: `${titulo}: ${rotulo} paga.`, acao: { rotulo: "Desfazer", fazer: () => iniciar(() => desfazerParcela(id, r.lancamento)) } });
      })}>
      {paga && <Check aria-hidden />}
    </button>
  );
}

export function PagarTodas({ ids, total }: { ids: string[]; total: number }) {
  const [pendente, iniciar] = useTransition();
  const avisar = useAvisar();
  return (
    <button type="button" className="btn btn--line btn--sm" disabled={pendente || !ids.length}
      onClick={() => iniciar(async () => {
        const feitos: { id: string; l?: string }[] = [];
        for (const id of ids) { const r = await pagarParcela(id); if (r.ok) feitos.push({ id, l: r.lancamento }); }
        avisar({ texto: `${feitos.length} ${feitos.length === 1 ? "parcela paga" : "parcelas pagas"}, ${moeda(total)}.`, acao: { rotulo: "Desfazer", fazer: () => iniciar(async () => { for (const f of feitos) await desfazerParcela(f.id, f.l); }) } });
      })}>
      <Check aria-hidden />Paguei todas
    </button>
  );
}

export function NovoParcelamento({ contextos, credores }: { contextos: ContextItem[]; credores: string[] }) {
  const [aberto, setAberto] = useState(false);
  const [v, setV] = useState({ title: "", total: "", n: "10", pagas: "0", first_due: hojeISO(), creditor: credores[0] ?? "", category: "Compras", context_id: "" });
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const avisar = useAvisar();
  const parcela = numeroBR(v.total) / (Number(v.n) || 1);
  if (!aberto) return <button type="button" className="btn btn--sm" onClick={() => setAberto(true)}><Plus aria-hidden />Parcelamento</button>;
  return (
    <form
      className="fin-form fin-form--conta"
      onSubmit={(e) => {
        e.preventDefault();
        setErro(null);
        iniciar(async () => {
          const r = await criarParcelamento({ title: v.title, category: v.category, total: numeroBR(v.total), installments: Number(v.n), paid_count: Number(v.pagas), first_due: v.first_due, creditor: v.creditor || null, context_id: v.context_id || null });
          if (!r.ok) return setErro(r.erro ?? "Não foi possível guardar.");
          avisar({ texto: `${v.title.trim()}: ${v.n}x de ${moeda(parcela)}.` });
          setV({ ...v, title: "", total: "", pagas: "0" });
          setAberto(false);
        });
      }}
    >
      <div className="fin-form__linha fin-form__linha--parc">
        <label className="field fin-form__desc">O que foi<input className="input" value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} placeholder="Ex.: iPhone, aliança, curso" maxLength={120} required autoFocus /></label>
        <label className="field">Valor total<input className="input" inputMode="decimal" value={v.total} onChange={(e) => setV({ ...v, total: e.target.value })} placeholder="0,00" required /></label>
        <label className="field">Em quantas vezes<input className="input" inputMode="numeric" value={v.n} onChange={(e) => setV({ ...v, n: e.target.value.replace(/\D/g, "").slice(0, 3) })} required /></label>
        <label className="field">1ª parcela vence<input className="input" type="date" value={v.first_due} onChange={(e) => setV({ ...v, first_due: e.target.value })} required /></label>
      </div>
      <div className="fin-form__linha fin-form__linha--parc2">
        <label className="field">Já paguei<input className="input" inputMode="numeric" value={v.pagas} onChange={(e) => setV({ ...v, pagas: e.target.value.replace(/\D/g, "").slice(0, 3) })} /></label>
        <label className="field">Onde ou com quem<input className="input" list="credores" value={v.creditor} onChange={(e) => setV({ ...v, creditor: e.target.value })} placeholder="Ex.: Cartão Nubank" maxLength={60} /><datalist id="credores">{credores.map((c) => <option key={c} value={c} />)}</datalist></label>
        <CampoCategoria kind="saida" value={v.category} onChange={(c) => setV({ ...v, category: c })} />
      </div>
      {erro && <p className="note note--err" role="alert">{erro}</p>}
      <div className="fin-form__pe">
        <span className="field__hint">{v.total && Number(v.n) ? `${v.n}x de ${moeda(parcela)}. No dia, a parcela aparece aqui para marcar como paga.` : "A parcela de cada mês aparece aqui para marcar como paga."}</span>
        <details className="fin-form__mais"><summary>Contexto</summary><CampoContexto contextos={contextos} value={v.context_id} onChange={(id) => setV({ ...v, context_id: id })} /></details>
        <button className="btn btn--ghost btn--sm" type="button" onClick={() => setAberto(false)}>Cancelar</button>
        <button className="btn btn--sm" type="submit" disabled={pendente || !v.title.trim() || !v.total}>Guardar</button>
      </div>
    </form>
  );
}

// ---------- investimentos ----------

const taxaTexto = (t: number | null) => (t ? String(Math.round(t * 10000) / 100).replace(".", ",") : "");

export function NovoInvestimento() {
  const [aberto, setAberto] = useState(false);
  const [v, setV] = useState({ name: "", kind: "renda_fixa", institution: "", balance: "", taxa: "", plano: "" });
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  if (!aberto) return <button type="button" className="btn btn--sm" onClick={() => setAberto(true)}><Plus aria-hidden />Investimento</button>;
  return (
    <form className="fin-form fin-form--conta" onSubmit={(e) => {
      e.preventDefault(); setErro(null);
      iniciar(async () => {
        const r = await criarInvestimento({ name: v.name, kind: v.kind, institution: v.institution || null, balance: numeroBR(v.balance || "0"), monthly_rate: v.taxa ? numeroBR(v.taxa) / 100 : null, monthly_plan: v.plano ? numeroBR(v.plano) : null });
        if (!r.ok) return setErro(r.erro ?? "Não foi possível guardar.");
        setAberto(false); setV({ name: "", kind: "renda_fixa", institution: "", balance: "", taxa: "", plano: "" });
      });
    }}>
      <div className="fin-form__linha fin-form__linha--inv">
        <label className="field fin-form__desc">Nome<input className="input" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} placeholder="Ex.: Caixinha da reserva" maxLength={80} required autoFocus /></label>
        <label className="field">Tipo<select className="input" value={v.kind} onChange={(e) => setV({ ...v, kind: e.target.value })}>{Object.entries(TIPOS_INVESTIMENTO).map(([k, r]) => <option key={k} value={k}>{r}</option>)}</select></label>
        <label className="field">Onde<input className="input" value={v.institution} onChange={(e) => setV({ ...v, institution: e.target.value })} placeholder="Ex.: Nubank" maxLength={60} /></label>
      </div>
      <div className="fin-form__linha fin-form__linha--inv2">
        <label className="field">Já tenho aplicado<input className="input" inputMode="decimal" value={v.balance} onChange={(e) => setV({ ...v, balance: e.target.value })} placeholder="0,00" /></label>
        <label className="field">Rende ao mês (%)<input className="input" inputMode="decimal" value={v.taxa} onChange={(e) => setV({ ...v, taxa: e.target.value })} placeholder="Ex.: 0,9" /></label>
        <label className="field">Pretendo pôr por mês<input className="input" inputMode="decimal" value={v.plano} onChange={(e) => setV({ ...v, plano: e.target.value })} placeholder="0,00" /></label>
      </div>
      {erro && <p className="note note--err" role="alert">{erro}</p>}
      <div className="fin-form__pe">
        <span className="field__hint">O rendimento é uma estimativa sua; serve para a projeção.</span>
        <button className="btn btn--ghost btn--sm" type="button" onClick={() => setAberto(false)}>Cancelar</button>
        <button className="btn btn--sm" type="submit" disabled={pendente || !v.name.trim()}>Guardar</button>
      </div>
    </form>
  );
}

/** Aporte, resgate ou rendimento numa linha */
export function Movimentar({ inv }: { inv: Investimento }) {
  const [tipo, setTipo] = useState<"aporte" | "resgate" | "rendimento">("aporte");
  const [valor, setValor] = useState("");
  const [dia, setDia] = useState(hojeISO());
  const [pendente, iniciar] = useTransition();
  const avisar = useAvisar();
  return (
    <form className="inv-mov" onSubmit={(e) => {
      e.preventDefault();
      iniciar(async () => {
        const r = await movimentarInvestimento(inv.id, tipo, numeroBR(valor), dia);
        if (!r.ok) return avisar({ texto: r.erro ?? "Não foi possível guardar." });
        avisar({ texto: `${tipo === "aporte" ? "Investi" : tipo === "resgate" ? "Resgatei" : "Rendimento"} ${moeda(numeroBR(valor))} em ${inv.name}.${r.origem === "lancamento" ? " Está nos lançamentos." : ""}`, acao: { rotulo: "Desfazer", fazer: () => iniciar(() => (r.origem === "lancamento" ? apagarLancamento(r.id!) : apagarMovimento(r.id!))) } });
        setValor("");
      });
    }}>
      <select className="input" value={tipo} onChange={(e) => setTipo(e.target.value as typeof tipo)} aria-label="Tipo de movimento">
        <option value="aporte">Investi</option><option value="resgate">Resgatei</option><option value="rendimento">Rendimento</option>
      </select>
      <input className="input" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" aria-label="Valor" required />
      <input className="input" type="date" value={dia} max={hojeISO()} onChange={(e) => setDia(e.target.value)} aria-label="Dia" required />
      <button className="btn btn--sm" type="submit" disabled={pendente || !valor}>Lançar</button>
    </form>
  );
}

/** Conferir com o app do banco: a diferença vira um ajuste no histórico; a taxa e o plano servem para a projeção */
export function AjustarInvestimento({ inv, saldo }: { inv: Investimento; saldo: number }) {
  const [aberto, setAberto] = useState(false);
  const [v, setV] = useState({ real: "", taxa: taxaTexto(inv.monthly_rate), plano: inv.monthly_plan ? String(inv.monthly_plan).replace(".", ",") : "" });
  const [pendente, iniciar] = useTransition();
  const avisar = useAvisar();
  if (!aberto) return <button type="button" className="fin-cat__lim" onClick={() => setAberto(true)}>Conferir e plano</button>;
  const dif = v.real.trim() ? Math.round((numeroBR(v.real) - saldo) * 100) / 100 : 0;
  return (
    <form className="inv-aj" onSubmit={(e) => {
      e.preventDefault();
      iniciar(async () => {
        await planoInvestimento(inv.id, v.taxa ? numeroBR(v.taxa) / 100 : null, v.plano ? numeroBR(v.plano) : null);
        if (v.real.trim()) { const r = await conferirInvestimento(inv.id, saldo, numeroBR(v.real)); if (r.ok && r.diferenca) avisar({ texto: `Ajuste de ${r.diferenca > 0 ? "+" : "−"}${moeda(Math.abs(r.diferenca))} lançado em ${inv.name}.` }); }
        setAberto(false);
      });
    }}>
      <label className="field">No app do banco<input className="input" inputMode="decimal" value={v.real} onChange={(e) => setV({ ...v, real: e.target.value })} placeholder={saldo.toFixed(2).replace(".", ",")} autoFocus /><span className="field__hint">{dif ? `Diferença ${dif > 0 ? "+" : "−"}${moeda(Math.abs(dif))}: vira um ajuste` : "Igual ao do Rumo"}</span></label>
      <label className="field">Rende ao mês (%)<input className="input" inputMode="decimal" value={v.taxa} onChange={(e) => setV({ ...v, taxa: e.target.value })} /></label>
      <label className="field">Pôr por mês<input className="input" inputMode="decimal" value={v.plano} onChange={(e) => setV({ ...v, plano: e.target.value })} /></label>
      <button className="btn btn--sm" type="submit" disabled={pendente}>OK</button>
      <button className="btn btn--ghost btn--sm" type="button" onClick={() => setAberto(false)}>Cancelar</button>
      <button className="icon-btn" type="button" aria-label={`Apagar ${inv.name}`} onClick={() => { if (confirm(`Apagar "${inv.name}" e o histórico dele?`)) iniciar(() => apagarInvestimento(inv.id)); }}><Trash2 size={15} /></button>
    </form>
  );
}

/** Conferir a conta com o banco: o Rumo mostra a diferença e lança um "Ajuste de saldo" para bater */
export function ConferirConta({ conta, calculado }: { conta: Conta | null; calculado: number }) {
  const [aberto, setAberto] = useState(false);
  const [real, setReal] = useState("");
  const [pendente, iniciar] = useTransition();
  const avisar = useAvisar();
  const dif = real.trim() ? Math.round((numeroBR(real) - calculado) * 100) / 100 : null;
  return (
    <>
      <button type="button" className="btn btn--line btn--sm" onClick={() => setAberto(true)}><Scale aria-hidden />Conferir com o banco</button>
      {aberto && (
        <Painel titulo={`Conferir ${conta?.name ?? "a conta"}`} fechar={() => setAberto(false)}>
          <form className="detail" style={{ gap: 14 }} onSubmit={(e) => {
            e.preventDefault();
            iniciar(async () => {
              const r = await conferirConta(conta?.id ?? null, calculado, numeroBR(real));
              if (!r.ok) return avisar({ texto: "Não foi possível conferir." });
              avisar({ texto: r.diferenca ? `Ajuste de ${r.diferenca > 0 ? "+" : "−"}${moeda(Math.abs(r.diferenca))} lançado. Agora bate.` : "Bate com o banco." });
              setAberto(false); setReal("");
            });
          }}>
            <p className="conferir__calc">Pelos seus lançamentos: <b>{moeda(calculado)}</b></p>
            <label className="field">Quanto o banco mostra agora<input className="input" inputMode="decimal" value={real} onChange={(e) => setReal(e.target.value)} placeholder="0,00" autoFocus /></label>
            {dif !== null && <p className={`conferir__dif${Math.abs(dif) < 0.005 ? " is-ok" : ""}`}>{Math.abs(dif) < 0.005 ? "Bate." : `Diferença de ${dif > 0 ? "+" : "−"}${moeda(Math.abs(dif))}. Antes de ajustar, veja se falta lançar algo; se não, o Rumo lança um ajuste de saldo hoje.`}</p>}
            <div className="detail__foot"><button className="btn" type="submit" disabled={pendente || dif === null}>{dif && Math.abs(dif) >= 0.005 ? "Lançar o ajuste" : "Conferir"}</button></div>
          </form>
        </Painel>
      )}
    </>
  );
}

/** Contas: cada uma com o seu saldo (sai dos lançamentos dela). Arquivada sai das contas do mês. */
function GerirContas() {
  const { contas } = useFinancas();
  const [nome, setNome] = useState("");
  const [pendente, iniciar] = useTransition();
  return (
    <section className="cad">
      <h3 className="cad__t">Contas</h3>
      <ul className="cad__lista">
        {contas.map((c) => (
          <li key={c.id} className={c.archived ? "is-arq" : undefined}>
            <input className="input" defaultValue={c.name} aria-label="Nome da conta" onBlur={(e) => e.target.value.trim() && e.target.value !== c.name && iniciar(() => salvarConta(c.id, { name: e.target.value }))} />
            <button type="button" className="icon-btn" aria-label={c.archived ? "Reativar" : "Arquivar"} title={c.archived ? "Reativar" : "Arquivar"} disabled={pendente} onClick={() => iniciar(() => salvarConta(c.id, { archived: !c.archived }))}>{c.archived ? <ArchiveRestore size={15} /> : <Archive size={15} />}</button>
          </li>
        ))}
      </ul>
      <form className="cad__nova" onSubmit={(e) => { e.preventDefault(); if (nome.trim()) iniciar(async () => { await criarConta(nome); setNome(""); }); }}>
        <input className="input" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nova conta (ex.: Nubank, Carteira)" maxLength={60} />
        <button type="submit" className="btn btn--line btn--sm" disabled={!nome.trim() || pendente}><Plus aria-hidden />Conta</button>
      </form>
    </section>
  );
}

/** Categorias: criar, renomear (os lançamentos acompanham), dizer se é essencial, estilo de vida ou objetivo, arquivar */
function GerirCategorias() {
  const { categorias } = useFinancas();
  const [kind, setKind] = useState<"saida" | "entrada">("saida");
  const [, iniciar] = useTransition();
  const avisar = useAvisar();
  const lista = categorias.filter((c) => c.kind === kind).sort((a, b) => Number(a.archived) - Number(b.archived) || a.position - b.position);
  return (
    <section className="cad">
      <h3 className="cad__t">Categorias
        <span className="seg seg--sm" role="group" aria-label="Tipo de categoria">
          <button type="button" aria-pressed={kind === "saida"} onClick={() => setKind("saida")}>Saídas</button>
          <button type="button" aria-pressed={kind === "entrada"} onClick={() => setKind("entrada")}>Entradas</button>
        </span>
      </h3>
      <ul className="cad__lista">
        {lista.map((c: Categoria) => (
          <li key={c.id} className={c.archived ? "is-arq" : undefined}>
            <input className="input" defaultValue={c.name} aria-label="Nome da categoria" onBlur={(e) => e.target.value.trim() && e.target.value !== c.name && iniciar(async () => { const r = await salvarCategoria(c.id, { name: e.target.value }); if (!r.ok) avisar({ texto: r.erro ?? "Não foi possível renomear." }); else avisar({ texto: "Renomeada. Os lançamentos acompanharam." }); })} />
            {kind === "saida" && (
              <select className="input" value={c.nature ?? ""} aria-label="Tipo de gasto" onChange={(e) => iniciar(() => salvarCategoria(c.id, { nature: (e.target.value || null) as Natureza | null }).then(() => undefined))}>
                <option value="">Sem tipo</option>
                {Object.entries(NATUREZAS).map(([k, r]) => <option key={k} value={k}>{r}</option>)}
              </select>
            )}
            <button type="button" className="icon-btn" aria-label={c.archived ? "Reativar" : "Arquivar"} title={c.archived ? "Reativar" : "Arquivar"} onClick={() => iniciar(() => salvarCategoria(c.id, { archived: !c.archived }).then(() => undefined))}>{c.archived ? <ArchiveRestore size={15} /> : <Archive size={15} />}</button>
          </li>
        ))}
      </ul>
      <form className="cad__nova" onSubmit={(e) => { e.preventDefault(); const f = e.currentTarget; const nome = (f.elements.namedItem("nome") as HTMLInputElement).value; if (nome.trim()) iniciar(async () => { const r = await criarCategoria(nome, kind); if (!r.ok) return avisar({ texto: r.erro ?? "Não foi possível criar." }); f.reset(); }); }}>
        <input className="input" name="nome" placeholder={kind === "saida" ? "Nova categoria (ex.: Combustível, Pets)" : "Nova categoria (ex.: Freelas)"} maxLength={60} />
        <button type="submit" className="btn btn--line btn--sm"><Plus aria-hidden />Categoria</button>
      </form>
    </section>
  );
}

export function ApagarMovimento({ m }: { m: Movimento }) {
  const [pendente, iniciar] = useTransition();
  return <button type="button" className="icon-btn" aria-label="Apagar movimento" disabled={pendente} onClick={() => { if (confirm(m.origem === "lancamento" ? "Apagar este lançamento?" : "Apagar este rendimento?")) iniciar(() => (m.origem === "lancamento" ? apagarLancamento(m.id) : apagarMovimento(m.id))); }}><Trash2 size={14} /></button>;
}
