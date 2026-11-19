"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { adicionarNoProjeto, apagarProjeto, criarProjeto, salvarProjeto, type EstadoForm } from "@/app/(app)/acoes";
import type { Projeto } from "@/lib/projetos";
import { useAvisar } from "./Avisos";
import type { ContextItem } from "./Shell";

export function NovoProjeto({ contextos, contextoPadrao }: { contextos: ContextItem[]; contextoPadrao?: string }) {
  const [aberto, setAberto] = useState(false);
  const [r, enviar, pendente] = useActionState<EstadoForm, FormData>(criarProjeto, {});
  const fundo = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!aberto) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [aberto]);

  return (
    <>
      <button type="button" className="btn" onClick={() => setAberto(true)}><Plus aria-hidden />Criar projeto</button>
      {aberto && (
        <div className="capture" ref={fundo} role="dialog" aria-modal="true" aria-label="Criar projeto" onMouseDown={(e) => e.target === fundo.current && setAberto(false)}>
          <form className="capture__box" action={enviar}>
            <i className="capture__grab" aria-hidden />
            <div className="capture__head">
              <b>Criar projeto</b>
              <button type="button" className="icon-btn" onClick={() => setAberto(false)} aria-label="Fechar"><X size={18} /></button>
            </div>
            <label className="field">
              Nome
              <input className="input" name="name" required maxLength={120} autoFocus placeholder="Ex.: Site novo da hamburgueria" />
              <span className="field__hint">Um resultado com etapas e fim.</span>
            </label>
            <div className="detail__props" style={{ gridTemplateColumns: "1fr 1fr" }}>
              <label className="field">
                Contexto
                <select className="input" name="context_id" defaultValue={contextoPadrao ?? ""}>
                  <option value="">Sem contexto</option>
                  {contextos.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
              <label className="field">
                Entrega
                <input className="input" type="date" name="due_date" />
              </label>
            </div>
            {r.erro && <p className="note note--err" role="alert">{r.erro}</p>}
            <div className="capture__foot">
              <span />
              <button className="btn" type="submit" disabled={pendente}>{pendente ? "Criando…" : "Criar projeto"}</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

/** Adicionar etapa: uma linha, lida como a captura (data, hora, #contexto) */
export function AdicionarEtapa({ projetoId }: { projetoId: string }) {
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
          const r = await adicionarNoProjeto(projetoId, t);
          if (!r.ok) { setValor(t); avisar({ texto: r.erro ?? "Não foi possível guardar." }); }
        });
      }}
    >
      <input className="input" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="Nova etapa, ex.: Aprovar a página de cardápio sexta" aria-label="Nova etapa" maxLength={500} />
      <button className="btn btn--line" type="submit" disabled={!valor.trim() || pendente}><Plus aria-hidden />Adicionar</button>
    </form>
  );
}

export function FormProjeto({ projeto, contextos }: { projeto: Projeto; contextos: ContextItem[] }) {
  const [r, enviar, pendente] = useActionState<EstadoForm, FormData>(salvarProjeto, {});
  return (
    <>
      <form action={enviar} className="detail" style={{ gap: 16 }}>
        <input type="hidden" name="id" value={projeto.id} />
        <label className="field">
          Nome
          <input className="input" name="name" defaultValue={projeto.name} required maxLength={120} />
        </label>
        <div className="detail__props">
          <label className="field">
            Contexto
            <select className="input" name="context_id" defaultValue={projeto.context_id ?? ""}>
              <option value="">Sem contexto</option>
              {contextos.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className="field">
            Entrega
            <input className="input" type="date" name="due_date" defaultValue={projeto.due_date ?? ""} />
          </label>
          <label className="field">
            Estado
            <select className="input" name="status" defaultValue={projeto.status}>
              <option value="ativo">Ativo</option>
              <option value="pausado">Pausado</option>
              <option value="concluido">Concluído</option>
            </select>
          </label>
        </div>
        <label className="field">
          Nota
          <textarea className="input input--area" name="note" defaultValue={projeto.note ?? ""} rows={5} placeholder="Objetivo, de quem depende, links…" />
        </label>
        {r.erro && <p className="note note--err" role="alert">{r.erro}</p>}
        <div className="detail__foot">
          <button className="btn" type="submit" disabled={pendente}>{pendente ? "Guardando…" : "Guardar"}</button>
          {r.ok && <span className="detail__status" role="status">Guardado.</span>}
        </div>
      </form>
      <form action={apagarProjeto} className="detail__danger" onSubmit={(e) => { if (!confirm("Apagar este projeto? As etapas continuam, sem projeto.")) e.preventDefault(); }}>
        <input type="hidden" name="id" value={projeto.id} />
        <button type="submit" className="btn btn--ghost btn--sm"><Trash2 aria-hidden />Apagar projeto</button>
      </form>
    </>
  );
}
