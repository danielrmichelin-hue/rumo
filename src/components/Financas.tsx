"use client";

import { useOptimistic, useState, useTransition } from "react";
import { Check, Plus, Settings2, Trash2 } from "lucide-react";
import { apagarInvestimento, apagarLancamento, apagarMovimento, apagarParcelamento, atualizarSaldoInvestimento, criarInvestimento, criarParcelamento, criarRotina, desfazerParcela, lancar, marcarLancamentoPago, movimentarInvestimento, pagarParcela, salvarAjustesFinancas, salvarOrcamento } from "@/app/(app)/acoes";
import { hojeISO, numeroBR, rotuloData } from "@/lib/datas";
import { CATEGORIAS_ENTRADA, CATEGORIAS_SAIDA, moeda, TIPOS_INVESTIMENTO, type Ajustes, type Investimento, type Lancamento, type Movimento } from "@/lib/financas";
import { useAvisar } from "./Avisos";
import { CampoContexto, Painel } from "./Comuns";
import type { ContextItem } from "./Shell";

/** Lançar uma entrada ou saída em segundos; "ainda vou pagar" vira conta a pagar no mês */
export function NovoLancamento({ contextos, mes }: { contextos: ContextItem[]; mes: string }) {
  const hoje = hojeISO();
  const padraoDia = hoje.slice(0, 7) === mes ? hoje : `${mes}-01`;
  const [tipo, setTipo] = useState<"saida" | "entrada">("saida");
  const [valor, setValor] = useState("");
  const [descricao, setDescricao] = useState("");
  const [categoria, setCategoria] = useState(CATEGORIAS_SAIDA[1]);
  const [dia, setDia] = useState(padraoDia);
  const [aPagar, setAPagar] = useState(false);
  const [contexto, setContexto] = useState("");
  const [pendente, iniciar] = useTransition();
  const avisar = useAvisar();
  const categorias = tipo === "saida" ? CATEGORIAS_SAIDA : CATEGORIAS_ENTRADA;

  return (
    <form
      className="fin-form"
      onSubmit={(e) => {
        e.preventDefault();
        iniciar(async () => {
          const r = await lancar({ kind: tipo, amount: numeroBR(valor), description: descricao, category: categoria, happened_on: dia, paid: !aPagar, context_id: contexto || null });
          if (!r.ok) return avisar({ texto: r.erro ?? "Não foi possível lançar." });
          avisar({ texto: `${tipo === "saida" ? "Saída" : "Entrada"} de ${moeda(numeroBR(valor))} lançada${aPagar ? " como a pagar" : ""}.`, acao: { rotulo: "Desfazer", fazer: () => iniciar(() => apagarLancamento(r.id!)) } });
          setValor(""); setDescricao(""); setAPagar(false);
        });
      }}
    >
      <div className="seg" role="radiogroup" aria-label="Tipo">
        <label><input type="radio" checked={tipo === "saida"} onChange={() => { setTipo("saida"); setCategoria(CATEGORIAS_SAIDA[1]); }} /><span>Saída</span></label>
        <label><input type="radio" checked={tipo === "entrada"} onChange={() => { setTipo("entrada"); setCategoria(CATEGORIAS_ENTRADA[0]); }} /><span>Entrada</span></label>
      </div>
      <div className="fin-form__linha">
        <label className="field">Valor<input className="input" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" required aria-label="Valor" /></label>
        <label className="field fin-form__desc">O que foi<input className="input" value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder={tipo === "saida" ? "Ex.: Mercado da semana" : "Ex.: Salário"} maxLength={120} required /></label>
        <label className="field">
          Categoria
          <select className="input" value={categoria} onChange={(e) => setCategoria(e.target.value)}>{categorias.map((c) => <option key={c}>{c}</option>)}</select>
        </label>
        <label className="field">{aPagar ? "Vence em" : "Dia"}<input className="input" type="date" value={dia} onChange={(e) => setDia(e.target.value)} required /></label>
      </div>
      <div className="fin-form__pe">
        <label className="check-line"><input type="checkbox" checked={aPagar} onChange={(e) => setAPagar(e.target.checked)} />{tipo === "saida" ? "Ainda vou pagar" : "Ainda vou receber"}</label>
        <details className="fin-form__mais"><summary>Contexto</summary><CampoContexto contextos={contextos} value={contexto} onChange={setContexto} /></details>
        <button className="btn btn--sm" type="submit" disabled={pendente || !valor || !descricao.trim()}><Plus aria-hidden />Lançar</button>
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
        <small>{l.category}{contexto && <> · <i className="dot" style={{ background: contexto.color }} />{contexto.name}</>}{l.routine_id ? " · conta fixa" : ""}{!l.paid ? (l.kind === "saida" ? " · a pagar" : " · a receber") : ""}</small>
      </span>
      <span className={`fin-l__v fin-l__v--${l.kind}`}>{l.kind === "saida" ? "−" : "+"}{moeda(l.amount)}</span>
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
        <label className="field">Categoria<select className="input" value={categoria} onChange={(e) => setCategoria(e.target.value)}>{CATEGORIAS_SAIDA.map((c) => <option key={c}>{c}</option>)}</select></label>
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

export function AjustesFinancas({ ajustes, saldoConta }: { ajustes: Ajustes; saldoConta: number | null }) {
  const [aberto, setAberto] = useState(false);
  const [usaDia, setUsaDia] = useState(!!ajustes.pay_day);
  const [dia, setDia] = useState(String(ajustes.pay_day ?? 5));
  const [fimDeSemana, setFimDeSemana] = useState(ajustes.weekend_shift);
  const [pct, setPct] = useState([ajustes.pct_parcelas, ajustes.pct_investir, ajustes.pct_livre].map(String));
  const [saldo, setSaldo] = useState(saldoConta === null ? "" : saldoConta.toFixed(2).replace(".", ","));
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const avisar = useAvisar();
  const soma = pct.reduce((t, x) => t + (Number(x) || 0), 0);
  const rotulos = ["Parcelas e dívidas", "Investir", "Gasto livre"];
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
                const r = await salvarAjustesFinancas({ pay_day: usaDia ? Number(dia) : null, weekend_shift: fimDeSemana, pct_parcelas: Number(pct[0]), pct_investir: Number(pct[1]), pct_livre: Number(pct[2]), cash_balance: saldo.trim() ? numeroBR(saldo) : null });
                if (!r.ok) return setErro(r.erro ?? "Não foi possível guardar.");
                avisar({ texto: "Ajustes guardados." });
                setAberto(false);
              });
            }}
          >
            <div className="field">
              Meu mês começa
              <div className="seg" role="radiogroup" aria-label="Meu mês começa" style={{ justifySelf: "start" }}>
                <label><input type="radio" checked={usaDia} onChange={() => setUsaDia(true)} /><span>No dia em que recebo</span></label>
                <label><input type="radio" checked={!usaDia} onChange={() => setUsaDia(false)} /><span>No dia 1</span></label>
              </div>
              {usaDia && (
                <div className="chips" style={{ alignItems: "center" }}>
                  <span className="field__hint">Recebo todo dia</span>
                  <input className="input" style={{ width: 72 }} inputMode="numeric" value={dia} onChange={(e) => setDia(e.target.value.replace(/\D/g, "").slice(0, 2))} aria-label="Dia em que recebo" />
                  <label className="check-line"><input type="checkbox" checked={fimDeSemana} onChange={(e) => setFimDeSemana(e.target.checked)} />Caiu no fim de semana, conta a sexta antes</label>
                </div>
              )}
              <span className="field__hint">O mês vai do dia em que o dinheiro entra até a véspera do próximo.</span>
            </div>
            <div className="field">
              Como divido o que entra
              <div className="fin-pcts">
                {rotulos.map((r, i) => (
                  <label key={r} className="field">{r}
                    <span className="fin-pct"><input className="input" inputMode="numeric" value={pct[i]} onChange={(e) => setPct(pct.map((x, j) => (j === i ? e.target.value.replace(/\D/g, "").slice(0, 3) : x)))} /><small>%</small></span>
                  </label>
                ))}
              </div>
              <span className="field__hint">{soma === 100 ? "Parcelas e investir saem primeiro; o resto é o que você pode gastar livre." : `Soma ${soma}%. Precisa dar 100%.`}</span>
            </div>
            <label className="field">
              Saldo da conta hoje
              <input className="input" style={{ maxWidth: 200 }} inputMode="decimal" value={saldo} onChange={(e) => setSaldo(e.target.value)} placeholder="0,00" />
              <span className="field__hint">Olhe no app do banco. Daqui para frente o Rumo soma as entradas e tira as saídas que você lançar.</span>
            </label>
            {erro && <p className="note note--err" role="alert">{erro}</p>}
            <div className="detail__foot"><button className="btn" type="submit" disabled={pendente || soma !== 100}>Guardar</button></div>
          </form>
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
        <label className="field">Categoria<select className="input" value={v.category} onChange={(e) => setV({ ...v, category: e.target.value })}>{CATEGORIAS_SAIDA.map((c) => <option key={c}>{c}</option>)}</select></label>
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

export function ApagarParcelamento({ id, titulo }: { id: string; titulo: string }) {
  const [pendente, iniciar] = useTransition();
  return <button type="button" className="icon-btn" aria-label={`Apagar ${titulo}`} disabled={pendente} onClick={() => { if (confirm(`Apagar o parcelamento "${titulo}"? Os pagamentos já lançados continuam.`)) iniciar(() => apagarParcelamento(id)); }}><Trash2 size={15} /></button>;
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
        <label className="field">Saldo hoje<input className="input" inputMode="decimal" value={v.balance} onChange={(e) => setV({ ...v, balance: e.target.value })} placeholder="0,00" /></label>
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
        avisar({ texto: `${tipo === "aporte" ? "Aporte" : tipo === "resgate" ? "Resgate" : "Rendimento"} de ${moeda(numeroBR(valor))} em ${inv.name}.`, acao: { rotulo: "Desfazer", fazer: () => iniciar(() => apagarMovimento(r.id!)) } });
        setValor("");
      });
    }}>
      <select className="input" value={tipo} onChange={(e) => setTipo(e.target.value as typeof tipo)} aria-label="Tipo de movimento">
        <option value="aporte">Aporte</option><option value="resgate">Resgate</option><option value="rendimento">Rendimento</option>
      </select>
      <input className="input" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" aria-label="Valor" required />
      <input className="input" type="date" value={dia} max={hojeISO()} onChange={(e) => setDia(e.target.value)} aria-label="Dia" required />
      <button className="btn btn--sm" type="submit" disabled={pendente || !valor}>Lançar</button>
    </form>
  );
}

/** Conferir com o banco: o saldo de hoje, a taxa e o aporte planejado */
export function AjustarInvestimento({ inv, saldo }: { inv: Investimento; saldo: number }) {
  const [aberto, setAberto] = useState(false);
  const [v, setV] = useState({ saldo: saldo.toFixed(2).replace(".", ","), taxa: taxaTexto(inv.monthly_rate), plano: inv.monthly_plan ? String(inv.monthly_plan).replace(".", ",") : "" });
  const [pendente, iniciar] = useTransition();
  if (!aberto) return <button type="button" className="fin-cat__lim" onClick={() => setAberto(true)}>Conferir saldo</button>;
  return (
    <form className="inv-aj" onSubmit={(e) => { e.preventDefault(); iniciar(async () => { await atualizarSaldoInvestimento(inv.id, numeroBR(v.saldo), v.taxa ? numeroBR(v.taxa) / 100 : null, v.plano ? numeroBR(v.plano) : null); setAberto(false); }); }}>
      <label className="field">Saldo hoje<input className="input" inputMode="decimal" value={v.saldo} onChange={(e) => setV({ ...v, saldo: e.target.value })} autoFocus /></label>
      <label className="field">Rende ao mês (%)<input className="input" inputMode="decimal" value={v.taxa} onChange={(e) => setV({ ...v, taxa: e.target.value })} /></label>
      <label className="field">Pôr por mês<input className="input" inputMode="decimal" value={v.plano} onChange={(e) => setV({ ...v, plano: e.target.value })} /></label>
      <button className="btn btn--sm" type="submit" disabled={pendente}>OK</button>
      <button className="btn btn--ghost btn--sm" type="button" onClick={() => setAberto(false)}>Cancelar</button>
      <button className="icon-btn" type="button" aria-label={`Apagar ${inv.name}`} onClick={() => { if (confirm(`Apagar "${inv.name}" e o histórico dele?`)) iniciar(() => apagarInvestimento(inv.id)); }}><Trash2 size={15} /></button>
    </form>
  );
}

export function ApagarMovimento({ m }: { m: Movimento }) {
  const [pendente, iniciar] = useTransition();
  return <button type="button" className="icon-btn" aria-label="Apagar movimento" disabled={pendente} onClick={() => iniciar(() => apagarMovimento(m.id))}><Trash2 size={14} /></button>;
}
