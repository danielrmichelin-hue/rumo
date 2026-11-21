"use client";

import { useOptimistic, useState, useTransition } from "react";
import { Check, Plus, X } from "lucide-react";
import { adicionarSubtarefas, apagarSubtarefa, marcarSubtarefa, renomearSubtarefa } from "@/app/(app)/acoes";
import type { Subtarefa } from "@/lib/subtarefas";
import { useAvisar } from "./Avisos";

function Linha({ s }: { s: Subtarefa }) {
  const [feita, setFeita] = useOptimistic(!!s.done_at);
  const [titulo, setTitulo] = useState(s.title);
  const [, iniciar] = useTransition();
  return (
    <li className="sub" data-feita={feita || undefined}>
      <button type="button" role="checkbox" aria-checked={feita} aria-label={`${feita ? "Reabrir" : "Feita"}: ${s.title}`} className="check check--sm"
        onClick={() => iniciar(async () => { setFeita(!feita); await marcarSubtarefa(s.id, !feita); })}>
        {feita && <Check aria-hidden />}
      </button>
      <input className="sub__t" value={titulo} onChange={(e) => setTitulo(e.target.value)} aria-label="Subtarefa" maxLength={200}
        onBlur={() => { if (titulo.trim() && titulo.trim() !== s.title) iniciar(() => renomearSubtarefa(s.id, titulo)); else setTitulo(s.title); }}
        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
      <button type="button" className="icon-btn sub__x" aria-label={`Apagar ${s.title}`} onClick={() => iniciar(() => apagarSubtarefa(s.id))}><X size={14} /></button>
    </li>
  );
}

/** A checklist da tarefa: marcar, renomear no lugar, apagar; colar uma lista cria uma subtarefa por linha */
export function Subtarefas({ tarefaId, itens }: { tarefaId: string; itens: Subtarefa[] }) {
  const [valor, setValor] = useState("");
  const [pendente, iniciar] = useTransition();
  const avisar = useAvisar();
  const feitas = itens.filter((s) => s.done_at).length;
  const enviar = (texto: string) => {
    if (!texto.trim()) return;
    setValor("");
    iniciar(async () => {
      const r = await adicionarSubtarefas(tarefaId, texto);
      if (!r.ok) { setValor(texto); avisar({ texto: r.erro ?? "Não foi possível guardar." }); }
    });
  };
  return (
    <section className="subs" aria-label="Subtarefas">
      <h2 className="sec__h">Subtarefas {itens.length > 0 && <em>{feitas} de {itens.length}</em>}</h2>
      {itens.length > 0 && (
        <>
          <span className="subs__barra" aria-hidden><i style={{ width: `${(feitas / itens.length) * 100}%` }} /></span>
          <ul className="subs__lista">{itens.map((s) => <Linha key={s.id} s={s} />)}</ul>
        </>
      )}
      <form className="quick-add" onSubmit={(e) => { e.preventDefault(); enviar(valor); }}>
        <input className="input" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="Nova subtarefa (ou cole uma lista)" aria-label="Nova subtarefa" maxLength={200}
          onPaste={(e) => { const t = e.clipboardData.getData("text"); if (t.includes("\n")) { e.preventDefault(); enviar(t); } }} />
        <button className="btn btn--line" type="submit" disabled={!valor.trim() || pendente}><Plus aria-hidden />Adicionar</button>
      </form>
    </section>
  );
}
