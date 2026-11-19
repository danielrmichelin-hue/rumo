"use client";

import { useState, useTransition } from "react";
import { Check, Plus, Trash2 } from "lucide-react";
import { apagarLancamento, criarRotina, lancar, marcarLancamentoPago, salvarOrcamento } from "@/app/(app)/acoes";
import { hojeISO, numeroBR, rotuloData } from "@/lib/datas";
import { CATEGORIAS_ENTRADA, CATEGORIAS_SAIDA, moeda, type Lancamento } from "@/lib/financas";
import { useAvisar } from "./Avisos";
import { CampoContexto } from "./Comuns";
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
