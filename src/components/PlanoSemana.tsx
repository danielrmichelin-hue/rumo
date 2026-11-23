"use client";

import { useState, useTransition } from "react";
import { ehExterno, LINK_AGENDA } from "@/lib/ical";
import Link from "next/link";
import { Check, Plus } from "lucide-react";
import { concluir, criarNoDia, moverParaDia } from "@/app/(app)/acoes";
import { rotuloData, rotuloHora, SEMANA_CURTA } from "@/lib/datas";
import { useAvisar } from "./Avisos";
import type { ContextItem } from "./Shell";

export type CartaoTarefa = { id: string; title: string; context_id: string | null; due_date: string | null; due_time: string | null; feita: boolean; atrasada: boolean; passos?: string };
export type EventoSemana = { id: string; title: string; dia: string; hora: string; minutos: number };
export type DiaSemana = { dia: string; hoje: boolean; passado: boolean };

const SEM_DATA = "sem-data";

/** Carga do dia: tarefas e horas de compromisso; dia cheio = muito para um dia só */
function carga(tarefas: number, minutos: number) {
  const h = Math.floor(minutos / 60), m = minutos % 60;
  const horas = minutos ? `${h ? `${h}h` : ""}${m ? `${String(m).padStart(h ? 2 : 1, "0")}${h ? "" : "min"}` : ""}` : "";
  return { texto: [tarefas ? `${tarefas} ${tarefas === 1 ? "tarefa" : "tarefas"}` : "", horas ? `${horas} de agenda` : ""].filter(Boolean).join(" · ") || "Livre", cheio: tarefas >= 6 || minutos >= 360 || (tarefas >= 4 && minutos >= 240) };
}

export function PlanoSemana({ dias, tarefas: inicial, eventos, contextos, hoje }: { dias: DiaSemana[]; tarefas: CartaoTarefa[]; eventos: EventoSemana[]; contextos: ContextItem[]; hoje: string }) {
  const [tarefas, setTarefas] = useState(inicial);
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [sobre, setSobre] = useState<string | null>(null);
  const [, iniciar] = useTransition();
  const avisar = useAvisar();
  // A lista do servidor muda quando algo é criado ou concluído em outro lugar
  const [base, setBase] = useState(inicial);
  if (base !== inicial) { setBase(inicial); setTarefas(inicial); }

  const ctx = (id: string | null) => contextos.find((c) => c.id === id);
  const naColuna = (col: string) => tarefas.filter((t) => (col === SEM_DATA ? !t.due_date : t.due_date === col));
  const atrasadas = tarefas.filter((t) => t.atrasada && t.due_date && t.due_date < dias[0].dia);

  function mover(id: string, destino: string) {
    const t = tarefas.find((x) => x.id === id);
    const dia = destino === SEM_DATA ? null : destino;
    if (!t || t.due_date === dia) return;
    setTarefas((ts) => ts.map((x) => (x.id === id ? { ...x, due_date: dia, atrasada: !!dia && dia < hoje } : x)));
    iniciar(async () => {
      const r = await moverParaDia(id, dia);
      if (!r.ok) { setTarefas((ts) => ts.map((x) => (x.id === id ? t : x))); return avisar({ texto: "Não foi possível mover." }); }
      avisar({ texto: dia ? `${t.title}: ${rotuloData(dia, hoje)}.` : `${t.title}: sem data.`, acao: { rotulo: "Desfazer", fazer: () => iniciar(async () => { await moverParaDia(id, r.antes ?? null); }) } });
    });
  }

  function feita(t: CartaoTarefa) {
    setTarefas((ts) => ts.map((x) => (x.id === t.id ? { ...x, feita: !x.feita } : x)));
    iniciar(async () => {
      await concluir(t.id, !t.feita);
      if (!t.feita) avisar({ texto: "Concluída.", acao: { rotulo: "Desfazer", fazer: () => iniciar(() => concluir(t.id, false)) } });
    });
  }

  const alvo = (col: string) => ({
    onDragOver: (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (sobre !== col) setSobre(col); },
    onDragLeave: (e: React.DragEvent) => { if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) setSobre(null); },
    onDrop: (e: React.DragEvent) => { e.preventDefault(); const id = e.dataTransfer.getData("text/plain") || arrastando; setSobre(null); setArrastando(null); if (id) mover(id, col); },
  });

  const Cartao = ({ t, comData = false }: { t: CartaoTarefa; comData?: boolean }) => {
    const c = ctx(t.context_id);
    return (
      <li
        className={`pcard${t.feita ? " pcard--feita" : ""}${t.atrasada && !t.feita ? " pcard--atrasada" : ""}${arrastando === t.id ? " pcard--arrastando" : ""}`}
        draggable={!t.feita}
        onDragStart={(e) => { e.dataTransfer.setData("text/plain", t.id); e.dataTransfer.effectAllowed = "move"; setArrastando(t.id); }}
        onDragEnd={() => { setArrastando(null); setSobre(null); }}
      >
        <button type="button" role="checkbox" aria-checked={t.feita} aria-label={`${t.feita ? "Reabrir" : "Concluir"}: ${t.title}`} className="check check--sm" onClick={() => feita(t)}>{t.feita && <Check aria-hidden />}</button>
        <span className="pcard__corpo">
          <Link href={`/responsabilidades/${t.id}`} className="pcard__t">{t.title}</Link>
          <span className="pcard__props">
            {c && <span><i className="dot" style={{ background: c.color }} />{c.name}</span>}
            {t.due_time && <span>{rotuloHora(t.due_time)}</span>}
            {comData && t.due_date && <span className="pcard__late">{rotuloData(t.due_date, hoje)}</span>}
            {t.passos && <span>{t.passos}</span>}
          </span>
        </span>
        <select className="pcard__mover" value={t.due_date ?? SEM_DATA} onChange={(e) => mover(t.id, e.target.value)} aria-label={`Mover ${t.title} para`}>
          <option value={SEM_DATA}>Sem data</option>
          {dias.map((d) => <option key={d.dia} value={d.dia}>{SEMANA_CURTA[new Date(d.dia + "T12:00:00Z").getUTCDay()]} {Number(d.dia.slice(8))}</option>)}
          {t.due_date && !dias.some((d) => d.dia === t.due_date) && <option value={t.due_date}>{rotuloData(t.due_date, hoje)}</option>}
        </select>
      </li>
    );
  };

  return (
    <div className="plano">
      <aside className={`plano__fila${sobre === SEM_DATA ? " is-sobre" : ""}`} {...alvo(SEM_DATA)}>
        {atrasadas.length > 0 && (
          <section>
            <h2 className="plano__h plano__h--late">Atrasadas <em>{atrasadas.length}</em></h2>
            <ul className="plano__lista">{atrasadas.map((t) => <Cartao key={t.id} t={t} comData />)}</ul>
          </section>
        )}
        <section>
          <h2 className="plano__h">Sem data <em>{naColuna(SEM_DATA).length}</em></h2>
          <p className="plano__dica">Arraste para um dia, ou use o menu ⋮ do cartão.</p>
          <ul className="plano__lista">{naColuna(SEM_DATA).map((t) => <Cartao key={t.id} t={t} />)}</ul>
        </section>
      </aside>

      <div className="plano__dias">
        {dias.map((d) => {
          const ts = naColuna(d.dia);
          const evs = eventos.filter((e) => e.dia === d.dia);
          const k = carga(ts.filter((t) => !t.feita).length, evs.reduce((s, e) => s + e.minutos, 0));
          const dt = new Date(d.dia + "T12:00:00Z");
          return (
            <section key={d.dia} className={`pdia${d.hoje ? " pdia--hoje" : ""}${d.passado ? " pdia--passado" : ""}${sobre === d.dia ? " is-sobre" : ""}`} {...alvo(d.dia)}>
              <header className="pdia__h">
                <b>{SEMANA_CURTA[dt.getUTCDay()]}</b><span>{Number(d.dia.slice(8))}</span>
                <small className={k.cheio ? "pdia__cheio" : undefined}>{k.cheio ? `Dia cheio · ${k.texto}` : k.texto}</small>
              </header>
              {evs.length > 0 && (
                <ul className="pdia__evs">
                  {evs.map((e) => <li key={e.id}><Link href={ehExterno(e.id) ? LINK_AGENDA : `/calendario/${e.id}`} target={ehExterno(e.id) ? "_blank" : undefined}><time>{e.hora}</time>{e.title}</Link></li>)}
                </ul>
              )}
              <ul className="plano__lista">{ts.map((t) => <Cartao key={t.id} t={t} />)}</ul>
              <NovaNoDia dia={d.dia} />
            </section>
          );
        })}
      </div>
    </div>
  );
}

function NovaNoDia({ dia }: { dia: string }) {
  const [aberto, setAberto] = useState(false);
  const [valor, setValor] = useState("");
  const [pendente, iniciar] = useTransition();
  const avisar = useAvisar();
  if (!aberto) return <button type="button" className="pdia__add" onClick={() => setAberto(true)}><Plus aria-hidden />Tarefa</button>;
  return (
    <form className="pdia__form" onSubmit={(e) => {
      e.preventDefault();
      const t = valor.trim(); if (!t) return;
      setValor("");
      iniciar(async () => { const r = await criarNoDia(t, dia); if (!r.ok) { setValor(t); avisar({ texto: r.erro ?? "Não foi possível guardar." }); } });
    }}>
      <input className="input" autoFocus value={valor} onChange={(e) => setValor(e.target.value)} onBlur={() => { if (!valor.trim()) setAberto(false); }} onKeyDown={(e) => e.key === "Escape" && setAberto(false)} placeholder="Nova tarefa #contexto" aria-label="Nova tarefa neste dia" disabled={pendente} />
    </form>
  );
}
