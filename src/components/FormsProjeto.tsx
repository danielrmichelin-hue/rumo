"use client";

import { useActionState, useOptimistic, useState, useTransition } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { adicionarNoProjeto, apagarProjeto, criarProjeto, mudarEstadoProjeto, salvarProjeto, type EstadoForm } from "@/app/(app)/acoes";
import type { Projeto } from "@/lib/projetos";
import { AdicionarRapido, CampoContexto, Painel } from "./Comuns";
import type { ContextItem } from "./Shell";

export function NovoProjeto({ contextos, contextoPadrao }: { contextos: ContextItem[]; contextoPadrao?: string }) {
  const [aberto, setAberto] = useState(false);
  const [r, enviar, pendente] = useActionState<EstadoForm, FormData>(criarProjeto, {});

  return (
    <>
      <button type="button" className="btn" onClick={() => setAberto(true)}><Plus aria-hidden />Criar projeto</button>
      {aberto && (
        <Painel titulo="Criar projeto" fechar={() => setAberto(false)} acao={enviar}>
            <label className="field">
              Nome
              <input className="input" name="name" required maxLength={120} autoFocus placeholder="Ex.: Site novo da hamburgueria" />
              <span className="field__hint">Um resultado com etapas e fim.</span>
            </label>
            <div className="detail__props" style={{ gridTemplateColumns: "1fr 1fr" }}>
              <CampoContexto contextos={contextos} name="context_id" defaultValue={contextoPadrao} />
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
        </Painel>
      )}
    </>
  );
}

/** Adicionar etapa: uma linha, lida como a captura (data, hora, #contexto) */
export function AdicionarEtapa({ projetoId }: { projetoId: string }) {
  return <AdicionarRapido acao={(t) => adicionarNoProjeto(projetoId, t)} placeholder="Nova etapa, ex.: Aprovar o orçamento sexta" rotulo="Nova etapa" />;
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
          <CampoContexto contextos={contextos} name="context_id" defaultValue={projeto.context_id} />
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

/** Nome, contexto, entrega e nota num painel: a página do projeto fica com as etapas */
export function EditarProjeto({ projeto, contextos }: { projeto: Projeto; contextos: ContextItem[] }) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <button type="button" className="btn btn--line btn--sm" onClick={() => setAberto(true)}><Pencil aria-hidden />Editar</button>
      {aberto && (
        <Painel titulo="Editar projeto" fechar={() => setAberto(false)}>
          <FormProjeto projeto={projeto} contextos={contextos} />
        </Painel>
      )}
    </>
  );
}

const ESTADOS = [
  { v: "ativo", r: "Ativo" },
  { v: "pausado", r: "Pausado" },
  { v: "concluido", r: "Concluído" },
] as const;

export function EstadoProjeto({ id, status }: { id: string; status: Projeto["status"] }) {
  const [otimista, setOtimista] = useOptimistic(status);
  const [, iniciar] = useTransition();
  return (
    <div className="seg seg--sm" role="radiogroup" aria-label="Estado do projeto">
      {ESTADOS.map((e) => (
        <label key={e.v}>
          <input type="radio" name={`estado-${id}`} checked={otimista === e.v} onChange={() => iniciar(async () => { setOtimista(e.v); await mudarEstadoProjeto(id, e.v); })} />
          <span>{e.r}</span>
        </label>
      ))}
    </div>
  );
}
