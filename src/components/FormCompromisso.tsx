"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { apagarCompromisso, criarCompromisso, salvarCompromisso, type EstadoForm } from "@/app/(app)/acoes";
import { CampoContexto, Painel } from "./Comuns";
import type { ContextItem } from "./Shell";

export type CompromissoEditavel = {
  id?: string;
  title: string;
  context_id: string | null;
  data: string;
  inicio: string;
  fim: string;
  location: string | null;
  note: string | null;
};

export function FormCompromisso({ inicial, contextos, aoTerminar }: { inicial: CompromissoEditavel; contextos: ContextItem[]; aoTerminar?: () => void }) {
  const editando = !!inicial.id;
  const [r, enviar, pendente] = useActionState<EstadoForm, FormData>(editando ? salvarCompromisso : criarCompromisso, {});
  const router = useRouter();

  useEffect(() => {
    if (!r.ok) return;
    if (aoTerminar) aoTerminar();
    else router.refresh();
  }, [r, aoTerminar, router]);

  return (
    <>
      <form action={enviar} className="detail" style={{ gap: 16 }}>
        {inicial.id && <input type="hidden" name="id" value={inicial.id} />}
        <label className="field">
          Compromisso
          <input className="input" name="title" defaultValue={inicial.title} required maxLength={200} placeholder="Ex.: Reunião com o Rodrigo" autoFocus={!editando} />
        </label>
        <div className="detail__props" style={{ gridTemplateColumns: "1fr 120px 120px" }}>
          <label className="field">
            Data
            <input className="input" type="date" name="data" defaultValue={inicial.data} required />
          </label>
          <label className="field">
            Início
            <input className="input" type="time" name="inicio" defaultValue={inicial.inicio} required />
          </label>
          <label className="field">
            Fim
            <input className="input" type="time" name="fim" defaultValue={inicial.fim} />
          </label>
        </div>
        <div className="detail__props" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <CampoContexto contextos={contextos} name="context_id" defaultValue={inicial.context_id} />
          <label className="field">
            Local
            <input className="input" name="location" defaultValue={inicial.location ?? ""} maxLength={120} placeholder="Ex.: Meet, escritório" />
          </label>
        </div>
        {editando && (
          <label className="field">
            Nota
            <textarea className="input input--area" name="note" defaultValue={inicial.note ?? ""} rows={4} placeholder="Pauta, links, o que foi combinado…" />
          </label>
        )}
        {r.erro && <p className="note note--err" role="alert">{r.erro}</p>}
        <div className="detail__foot">
          <button className="btn" type="submit" disabled={pendente}>{pendente ? "Guardando…" : editando ? "Guardar" : "Criar compromisso"}</button>
          {aoTerminar && <button className="btn btn--ghost" type="button" onClick={aoTerminar}>Cancelar</button>}
          {editando && r.ok && <span className="detail__status" role="status">Guardado.</span>}
        </div>
      </form>
      {editando && (
        <form action={apagarCompromisso} className="detail__danger" onSubmit={(e) => { if (!confirm("Apagar este compromisso?")) e.preventDefault(); }}>
          <input type="hidden" name="id" value={inicial.id} />
          <input type="hidden" name="voltar" value={`/calendario?semana=${inicial.data}`} />
          <button type="submit" className="btn btn--ghost btn--sm"><Trash2 aria-hidden />Apagar</button>
        </form>
      )}
    </>
  );
}

/** Botão "Novo compromisso" que abre o formulário num painel */
export function NovoCompromisso({ contextos, data, titulo, rotulo = "Novo compromisso", variante = "btn" }: { contextos: ContextItem[]; data: string; titulo?: string; rotulo?: string; variante?: string }) {
  const [aberto, setAberto] = useState(false);
  const fechar = () => setAberto(false);
  return (
    <>
      <button type="button" className={variante} onClick={() => setAberto(true)}>{variante === "btn" && <Plus aria-hidden />}{rotulo}</button>
      {aberto && (
        <Painel titulo="Novo compromisso" fechar={fechar}>
          <FormCompromisso inicial={{ title: titulo ?? "", context_id: null, data, inicio: "09:00", fim: "", location: null, note: null }} contextos={contextos} aoTerminar={fechar} />
        </Painel>
      )}
    </>
  );
}
