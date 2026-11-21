"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Check, Hourglass, Plus, Scale } from "lucide-react";
import { capturar, concluir, organizar } from "@/app/(app)/acoes";
import { rotuloData, rotuloHora } from "@/lib/datas";
import { useAvisar } from "./Avisos";
import type { ContextItem } from "./Shell";

export type Demanda = {
  id: string; title: string; context_id: string | null; due_date: string | null; due_time: string | null;
  aguardando: boolean; quem: string | null; cobrarHoje: boolean; decidir: boolean; atrasada: boolean; passos?: string;
};

const CLASSIFICAR = "classificar";

/** Quadro das empresas: uma coluna por empresa e "Para classificar" (o Inbox). Arrastar muda a empresa da demanda. */
export function QuadroNegocios({ empresas, demandas: inicial, hoje }: { empresas: ContextItem[]; demandas: Demanda[]; hoje: string }) {
  const [demandas, setDemandas] = useState(inicial);
  const [base, setBase] = useState(inicial);
  if (base !== inicial) { setBase(inicial); setDemandas(inicial); }
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [sobre, setSobre] = useState<string | null>(null);
  const [, iniciar] = useTransition();
  const avisar = useAvisar();
  const colunas = [{ id: CLASSIFICAR, name: "Para classificar", color: "var(--text-3)" }, ...empresas];

  function mover(id: string, col: string) {
    const d = demandas.find((x) => x.id === id);
    const destino = col === CLASSIFICAR ? null : col;
    if (!d || d.context_id === destino) return;
    setDemandas((ds) => ds.map((x) => (x.id === id ? { ...x, context_id: destino } : x)));
    iniciar(async () => {
      await organizar(id, destino);
      const nome = colunas.find((c) => c.id === col)?.name;
      avisar({ texto: `${d.title}: ${destino ? nome : "sem empresa"}.`, acao: { rotulo: "Desfazer", fazer: () => iniciar(() => organizar(id, d.context_id)) } });
    });
  }

  function feita(d: Demanda) {
    setDemandas((ds) => ds.filter((x) => x.id !== d.id));
    iniciar(async () => {
      await concluir(d.id, true);
      avisar({ texto: "Concluída.", acao: { rotulo: "Desfazer", fazer: () => iniciar(() => concluir(d.id, false)) } });
    });
  }

  return (
    <div className="quadro">
      {colunas.map((c) => {
        const daqui = demandas.filter((d) => (c.id === CLASSIFICAR ? !d.context_id : d.context_id === c.id));
        const atrasadas = daqui.filter((d) => d.atrasada).length;
        return (
          <section
            key={c.id}
            className={`qcol${c.id === CLASSIFICAR ? " qcol--classificar" : ""}${sobre === c.id ? " is-sobre" : ""}`}
            onDragOver={(e) => { e.preventDefault(); if (sobre !== c.id) setSobre(c.id); }}
            onDragLeave={(e) => { if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) setSobre(null); }}
            onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData("text/plain") || arrastando; setSobre(null); setArrastando(null); if (id) mover(id, c.id); }}
          >
            <header className="qcol__h">
              <i className="dot" style={{ background: c.color }} />
              {c.id === CLASSIFICAR ? <b>{c.name}</b> : <Link href={`/negocios?e=${c.id}`}><b>{c.name}</b></Link>}
              <em>{daqui.length}</em>
              {atrasadas > 0 && <span className="qcol__late">{atrasadas} {atrasadas === 1 ? "atrasada" : "atrasadas"}</span>}
            </header>
            {c.id === CLASSIFICAR && !daqui.length && <p className="qcol__vazio">Nada para classificar.</p>}
            <ul className="plano__lista">
              {daqui.map((d) => (
                <li
                  key={d.id}
                  className={`pcard${d.atrasada ? " pcard--atrasada" : ""}${arrastando === d.id ? " pcard--arrastando" : ""}`}
                  draggable
                  onDragStart={(e) => { e.dataTransfer.setData("text/plain", d.id); e.dataTransfer.effectAllowed = "move"; setArrastando(d.id); }}
                  onDragEnd={() => { setArrastando(null); setSobre(null); }}
                >
                  <button type="button" role="checkbox" aria-checked={false} aria-label={`Concluir: ${d.title}`} className={`check check--sm${d.aguardando ? " check--wait" : ""}`} onClick={() => feita(d)} />
                  <span className="pcard__corpo">
                    <Link href={`/responsabilidades/${d.id}`} className="pcard__t">{d.title}</Link>
                    <span className="pcard__props">
                      {d.decidir && <span><Scale aria-hidden size={12} />Decisão</span>}
                      {d.aguardando && <span className={d.cobrarHoje ? "pcard__warn" : undefined}><Hourglass aria-hidden size={12} />{d.quem ?? "Aguardando"}{d.cobrarHoje ? " · cobrar" : ""}</span>}
                      {d.due_date && <span className={d.atrasada ? "pcard__late" : undefined}>{d.atrasada ? `Atrasada · ${rotuloData(d.due_date, hoje)}` : d.due_date === hoje ? "Hoje" : rotuloData(d.due_date, hoje)}{d.due_time ? ` ${rotuloHora(d.due_time)}` : ""}</span>}
                      {d.passos && <span>{d.passos}</span>}
                    </span>
                  </span>
                  <select className="pcard__mover" value={d.context_id ?? CLASSIFICAR} onChange={(e) => mover(d.id, e.target.value)} aria-label={`Mover ${d.title} para`}>
                    {colunas.map((x) => <option key={x.id} value={x.id}>{x.id === CLASSIFICAR ? "Sem empresa" : x.name}</option>)}
                  </select>
                </li>
              ))}
            </ul>
            <NovaDemanda onde={c.id === CLASSIFICAR ? "inbox" : c.id} />
          </section>
        );
      })}
    </div>
  );
}

/** Nova demanda direto na coluna (lida como a captura: data, hora) */
export function NovaDemanda({ onde, aberta = false }: { onde: string; aberta?: boolean }) {
  const [aberto, setAberto] = useState(aberta);
  const [valor, setValor] = useState("");
  const [pendente, iniciar] = useTransition();
  const avisar = useAvisar();
  if (!aberto) return <button type="button" className="pdia__add" onClick={() => setAberto(true)}><Plus aria-hidden />Demanda</button>;
  return (
    <form className={aberta ? "quick-add" : "pdia__form"} onSubmit={(e) => {
      e.preventDefault();
      const t = valor.trim(); if (!t) return;
      setValor("");
      iniciar(async () => { const r = await capturar(t, onde); if (!r.ok) { setValor(t); avisar({ texto: r.erro ?? "Não foi possível guardar." }); } });
    }}>
      <input className="input" autoFocus={!aberta} value={valor} onChange={(e) => setValor(e.target.value)} onBlur={() => { if (!aberta && !valor.trim()) setAberto(false); }} onKeyDown={(e) => !aberta && e.key === "Escape" && setAberto(false)} placeholder="Nova demanda, ex.: Enviar proposta sexta 10h" aria-label="Nova demanda" disabled={pendente} />
      {aberta && <button className="btn btn--line" type="submit" disabled={!valor.trim() || pendente}><Check aria-hidden />Guardar</button>}
    </form>
  );
}
