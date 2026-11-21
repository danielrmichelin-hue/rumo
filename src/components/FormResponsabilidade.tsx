"use client";

import { startTransition, useActionState, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { apagarResponsabilidade, salvarResponsabilidade, type EstadoForm } from "@/app/(app)/acoes";
import { hojeISO, rotuloData, somarDiasUteis } from "@/lib/datas";
import type { Contexto, Estado, Responsabilidade } from "@/lib/tipos";

const ESTADOS: Array<{ v: Estado; r: string }> = [
  { v: "a_fazer", r: "A fazer" },
  { v: "aguardando", r: "Aguardando alguém" },
  { v: "concluida", r: "Concluída" },
];

export function FormResponsabilidade({ item, contextos, pessoas, voltar, projetos = [], children }: { item: Responsabilidade; contextos: Contexto[]; pessoas: string[]; voltar: string; projetos?: { id: string; name: string }[]; children?: React.ReactNode }) {
  const [resultado, enviar, pendente] = useActionState<EstadoForm, FormData>(salvarResponsabilidade, {});
  const [estado, setEstado] = useState<Estado>(item.state);
  const [tipo, setTipo] = useState(item.kind);
  const [cobrar, setCobrar] = useState(item.follow_up_on ?? "");
  const [mudou, setMudou] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const hoje = hojeISO();
  const padraoCobranca = somarDiasUteis(hoje, 3);
  const guardado = resultado.ok && !mudou && !pendente;

  function escolherEstado(v: Estado) {
    setEstado(v);
    if (v === "aguardando" && !cobrar) setCobrar(padraoCobranca);
  }

  const rotuloNota = tipo === "decidir" ? (estado === "concluida" ? "Decisão" : "Nota · ao concluir, escreva aqui a decisão") : "Nota";

  return (
    <>
      <form
        ref={form}
        onSubmit={(e) => {
          // Sem o reset automático do React: o formulário continua mostrando o que foi guardado
          e.preventDefault();
          const dados = new FormData(e.currentTarget);
          setMudou(false);
          startTransition(() => enviar(dados));
        }}
        className="detail"
        onChange={() => setMudou(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); form.current?.requestSubmit(); }
        }}
      >
        <input type="hidden" name="id" value={item.id} />
        <textarea name="title" className="detail__title" defaultValue={item.title} rows={1} required maxLength={300} aria-label="Título" />

        <div className="detail__row">
          <fieldset className="seg seg--state" aria-label="Estado">
            {ESTADOS.map((e) => (
              <label key={e.v}>
                <input type="radio" name="state" value={e.v} checked={estado === e.v} onChange={() => escolherEstado(e.v)} />
                <span>{e.r}</span>
              </label>
            ))}
          </fieldset>
          <fieldset className="seg" aria-label="Tipo">
            {(["fazer", "decidir"] as const).map((k) => (
              <label key={k}>
                <input type="radio" name="kind" value={k} checked={tipo === k} onChange={() => setTipo(k)} />
                <span>{k === "fazer" ? "Fazer" : "Decisão"}</span>
              </label>
            ))}
          </fieldset>
        </div>

        {estado === "aguardando" && (
          <div className="waiting">
            <label className="field">
              Aguardando quem
              <input className="input" name="waiting_note" defaultValue={item.waiting_note ?? ""} list="pessoas" placeholder="Nome da pessoa ou o que você espera" required autoFocus={item.state !== "aguardando"} maxLength={120} />
              <datalist id="pessoas">{pessoas.map((p) => <option key={p} value={p} />)}</datalist>
            </label>
            <label className="field">
              Cobrar em
              <input className="input" type="date" name="follow_up_on" value={cobrar} onChange={(e) => setCobrar(e.target.value)} required />
              <span className="field__hint">{cobrar === padraoCobranca ? "Em 3 dias úteis." : cobrar ? rotuloData(cobrar, hoje) : ""} No dia, volta para o Hoje.</span>
            </label>
          </div>
        )}

        <div className="detail__props">
          <label className="field">
            Contexto
            <select className="input" name="context_id" defaultValue={item.context_id ?? ""}>
              <option value="">Sem contexto (Inbox)</option>
              {contextos.map((c) => (
                <option key={c.id} value={c.id}>{c.name}{c.archived ? " (arquivado)" : ""}</option>
              ))}
            </select>
          </label>
          <label className="field">
            Prazo
            <input className="input" type="date" name="due_date" defaultValue={item.due_date ?? ""} />
          </label>
          <label className="field">
            Hora
            <input className="input" type="time" name="due_time" defaultValue={item.due_time?.slice(0, 5) ?? ""} />
          </label>
        </div>

        <label className="field">
          Projeto
          <select className="input" name="project_id" defaultValue={item.project_id ?? ""}>
            <option value="">Sem projeto</option>
            {projetos.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>

        <label className="field" style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 400 }}>
          <input type="checkbox" name="today" defaultChecked={item.today} style={{ width: 18, height: 18, accentColor: "var(--accent)" }} />
          Marcar para hoje, mesmo sem prazo
        </label>

        <label className="field">
          {rotuloNota}
          <textarea name="note" className="input input--area" defaultValue={item.note ?? ""} rows={6} placeholder="Contexto, links, o que foi combinado…" />
        </label>

        {item.raw_capture && (
          <p className="detail__origin">Capturado como <q>{item.raw_capture}</q></p>
        )}

        {resultado.erro && <p className="note note--err" role="alert">{resultado.erro}</p>}

        <div className="detail__foot">
          <button className="btn" type="submit" disabled={pendente}>{pendente ? "Guardando…" : "Guardar"}</button>
          <span className="detail__status" role="status">{guardado ? "Guardado." : <kbd>⌘ Enter</kbd>}</span>
        </div>
      </form>

      {children}

      <form
        action={apagarResponsabilidade}
        className="detail__danger"
        onSubmit={(e) => { if (!confirm("Apagar esta tarefa? Não dá para desfazer.")) e.preventDefault(); }}
      >
        <input type="hidden" name="id" value={item.id} />
        <input type="hidden" name="voltar" value={voltar} />
        <button type="submit" className="btn btn--ghost btn--sm"><Trash2 aria-hidden />Apagar</button>
      </form>
    </>
  );
}
