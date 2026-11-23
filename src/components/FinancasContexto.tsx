"use client";

// As categorias e contas do Daniel valem em toda a tela de Finanças (lançar, editar, parcelamentos, contas fixas)
import { createContext, useContext, useState, useTransition } from "react";
import { Check, X } from "lucide-react";
import { criarCategoria } from "@/app/(app)/acoes";
import { nomesCategorias, type Categoria, type Conta } from "@/lib/financas";
import { useAvisar } from "./Avisos";

const Ctx = createContext<{ categorias: Categoria[]; contas: Conta[] }>({ categorias: [], contas: [] });

export function FinancasProvider({ categorias, contas, children }: { categorias: Categoria[]; contas: Conta[]; children: React.ReactNode }) {
  return <Ctx.Provider value={{ categorias, contas }}>{children}</Ctx.Provider>;
}

export const useFinancas = () => useContext(Ctx);

const NOVA = "__nova__";

/** Categoria com "+ Nova categoria…" no fim da lista: cria na hora e já escolhe */
export function CampoCategoria({ kind, value, onChange, rotulo = "Categoria" }: { kind: "entrada" | "saida"; value: string; onChange: (v: string) => void; rotulo?: string }) {
  const { categorias } = useFinancas();
  const nomes = nomesCategorias(categorias, kind);
  const [criando, setCriando] = useState(false);
  const [nome, setNome] = useState("");
  const [pendente, iniciar] = useTransition();
  const avisar = useAvisar();
  const lista = value && !nomes.includes(value) ? [...nomes, value] : nomes;
  if (criando) {
    const criar = () => iniciar(async () => {
      const r = await criarCategoria(nome, kind);
      if (!r.ok) return avisar({ texto: r.erro ?? "Não foi possível criar." });
      onChange(r.nome!); setCriando(false); setNome("");
    });
    return (
      <label className="field">
        Nova categoria
        <span className="cat-nova">
          <input className="input" value={nome} onChange={(e) => setNome(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (nome.trim()) criar(); } if (e.key === "Escape") setCriando(false); }} placeholder="Ex.: Combustível" autoFocus maxLength={60} />
          <button type="button" className="icon-btn" aria-label="Criar categoria" disabled={!nome.trim() || pendente} onClick={criar}><Check size={16} /></button>
          <button type="button" className="icon-btn" aria-label="Cancelar" onClick={() => setCriando(false)}><X size={16} /></button>
        </span>
      </label>
    );
  }
  return (
    <label className="field">
      {rotulo}
      <select className="input" value={value} onChange={(e) => (e.target.value === NOVA ? setCriando(true) : onChange(e.target.value))}>
        {lista.map((c) => <option key={c}>{c}</option>)}
        <option value={NOVA}>+ Nova categoria…</option>
      </select>
    </label>
  );
}

/** Conta do lançamento: só aparece quando há mais de uma conta ativa */
export function CampoConta({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ativas = useFinancas().contas.filter((c) => !c.archived);
  if (ativas.length < 2) return null;
  return (
    <label className="field">
      Conta
      <select className="input" value={value || ativas[0].id} onChange={(e) => onChange(e.target.value)}>
        {ativas.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
    </label>
  );
}
