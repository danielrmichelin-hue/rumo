"use client";

import { useOptimistic, useTransition } from "react";
import Link from "next/link";
import { Check, Clock, CornerDownRight, FileText, Hourglass, Scale } from "lucide-react";
import { concluir, organizar } from "@/app/(app)/acoes";
import { estaAtrasada, hojeISO, rotuloData, rotuloHora } from "@/lib/datas";
import type { Responsabilidade } from "@/lib/tipos";
import type { ContextItem } from "./Shell";

type Props = {
  itens: Responsabilidade[];
  contextos: ContextItem[];
  /** Mostra a bolinha e o nome do contexto em cada linha */
  comContexto?: boolean;
  /** Inbox: mostra o seletor "Organizar em…" */
  organizavel?: boolean;
};

export function ListaResponsabilidades({ itens, contextos, comContexto = false, organizavel = false }: Props) {
  const hoje = hojeISO();
  return (
    <ul className="list">
      {itens.map((item) => (
        <Linha key={item.id} item={item} contextos={contextos} comContexto={comContexto} organizavel={organizavel} hoje={hoje} />
      ))}
    </ul>
  );
}

function Linha({ item, contextos, comContexto, organizavel, hoje }: { item: Responsabilidade; contextos: ContextItem[]; comContexto: boolean; organizavel: boolean; hoje: string }) {
  const [, iniciar] = useTransition();
  const [feita, setFeita] = useOptimistic(item.state === "concluida");
  const [saiu, setSaiu] = useOptimistic(false);
  const contexto = contextos.find((c) => c.id === item.context_id);
  const atrasada = !feita && estaAtrasada(item, hoje);

  function alternar() {
    iniciar(async () => {
      setFeita(!feita);
      await concluir(item.id, !feita);
    });
  }

  function mover(contextId: string) {
    if (!contextId) return;
    iniciar(async () => {
      setSaiu(true);
      await organizar(item.id, contextId);
    });
  }

  if (saiu) return null;

  return (
    <li className="item" data-feita={feita || undefined}>
      <button
        type="button"
        className="check"
        role="checkbox"
        aria-checked={feita}
        aria-label={feita ? `Reabrir: ${item.title}` : `Concluir: ${item.title}`}
        onClick={alternar}
      >
        {feita && <Check size={13} strokeWidth={3} />}
      </button>
      <div className="item__body">
        <Link href={`/responsabilidades/${item.id}`} className="item__title">{item.title}</Link>
        <span className="props">
          {item.kind === "decidir" && <span className="prop"><Scale size={13} aria-hidden />Decidir</span>}
          {comContexto && contexto && (
            <span className="prop"><i className="dot" style={{ background: contexto.color }} />{contexto.name}</span>
          )}
          {item.due_date && (
            <span className={`prop${atrasada ? " prop--late" : ""}`}>
              {atrasada ? `Prazo era ${rotuloData(item.due_date, hoje)}` : rotuloData(item.due_date, hoje)}
            </span>
          )}
          {item.due_time && <span className="prop"><Clock size={13} aria-hidden />{rotuloHora(item.due_time)}</span>}
          {item.state === "aguardando" && (
            <span className="prop">
              <Hourglass size={13} aria-hidden />
              {item.waiting_note}
              {item.follow_up_on && <> · cobrar {rotuloData(item.follow_up_on, hoje)}</>}
            </span>
          )}
          {item.note && <span className="prop" title="Tem nota"><FileText size={13} aria-label="Tem nota" /></span>}
          {feita && item.done_at && <span className="prop">Concluída {rotuloData(hojeISO(new Date(item.done_at)), hoje)}</span>}
        </span>
      </div>
      {organizavel && contextos.length > 0 && (
        <label className="organize">
          <CornerDownRight size={14} aria-hidden />
          <span className="sr-only">Organizar em</span>
          <select defaultValue="" onChange={(e) => mover(e.target.value)} aria-label={`Organizar "${item.title}" em um contexto`}>
            <option value="" disabled>Organizar em…</option>
            {contextos.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
      )}
    </li>
  );
}
