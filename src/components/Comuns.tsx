"use client";

// Peças repetidas nas telas: campo de contexto, painel por cima da tela e linha de adicionar rápido.
import { useEffect, useState, useTransition } from "react";
import { Plus, X } from "lucide-react";
import { useAvisar } from "./Avisos";
import type { ContextItem } from "./Shell";

/** Campo "Contexto" com "Sem contexto". Com `name`, vai no formulário; com `value`/`onChange`, é controlado. */
export function CampoContexto({ contextos, name, defaultValue, value, onChange }: {
  contextos: ContextItem[];
  name?: string;
  defaultValue?: string | null;
  value?: string;
  onChange?: (id: string) => void;
}) {
  const controle = onChange ? { value, onChange: (e: React.ChangeEvent<HTMLSelectElement>) => onChange(e.target.value) } : { defaultValue: defaultValue ?? "" };
  return (
    <label className="field">
      Contexto
      <select className="input" name={name} {...controle}>
        <option value="">Sem contexto</option>
        {contextos.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
    </label>
  );
}

/** Painel por cima da tela (folha no celular): fecha com Esc, no X ou clicando fora. Com `acao`, a caixa é o formulário. */
export function Painel({ titulo, fechar, acao, children }: { titulo: string; fechar: () => void; acao?: (form: FormData) => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && fechar();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fechar]);
  const conteudo = (
    <>
      <i className="capture__grab" aria-hidden />
      <div className="capture__head">
        <b>{titulo}</b>
        <button type="button" className="icon-btn" onClick={fechar} aria-label="Fechar"><X size={18} /></button>
      </div>
      {children}
    </>
  );
  return (
    <div className="capture" role="dialog" aria-modal="true" aria-label={titulo} onMouseDown={(e) => e.target === e.currentTarget && fechar()}>
      {acao ? <form className="capture__box" action={acao}>{conteudo}</form> : <div className="capture__box">{conteudo}</div>}
    </div>
  );
}

/** Uma linha para adicionar algo rápido (passo, etapa, matéria, marco). Se der erro, o texto volta para a caixa. */
export function AdicionarRapido({ acao, placeholder, rotulo, botao = "Adicionar", maxLength = 500 }: {
  acao: (texto: string) => Promise<{ ok: boolean; erro?: string } | void>;
  placeholder: string;
  rotulo: string;
  botao?: string;
  maxLength?: number;
}) {
  const [valor, setValor] = useState("");
  const [pendente, iniciar] = useTransition();
  const avisar = useAvisar();
  return (
    <form
      className="quick-add"
      onSubmit={(e) => {
        e.preventDefault();
        const t = valor.trim();
        if (!t) return;
        setValor("");
        iniciar(async () => {
          const r = await acao(t);
          if (r && !r.ok) { setValor(t); avisar({ texto: r.erro ?? "Não foi possível guardar." }); }
        });
      }}
    >
      <input className="input" value={valor} onChange={(e) => setValor(e.target.value)} placeholder={placeholder} aria-label={rotulo} maxLength={maxLength} />
      <button className="btn btn--line" type="submit" disabled={!valor.trim() || pendente}><Plus aria-hidden />{botao}</button>
    </form>
  );
}
