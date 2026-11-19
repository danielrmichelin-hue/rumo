"use client";

import { useActionState, useState, useTransition } from "react";
import { Check, Plus, Sun, Trash2 } from "lucide-react";
import {
  adicionarMarco, adicionarPassoRota, apagarMarco, apagarRota, concluirMarco, criarPassoSugerido, decidirRecalculo,
  desfazerAvanco, registrarAvanco, salvarRota, type EstadoForm,
} from "@/app/(app)/acoes";
import { textoValor, type Rota, type TipoRota } from "@/lib/rotas";
import { useAvisar } from "./Avisos";
import type { ContextItem } from "./Shell";

const PERGUNTA: Record<Exclude<TipoRota, "negocios">, { rotulo: string; exemplo: string }> = {
  financeiro: { rotulo: "Quanto guardou", exemplo: "Ex.: 400" },
  leitura: { rotulo: "Quantas páginas leu", exemplo: "Ex.: 30" },
  estudos: { rotulo: "Quantas aulas concluiu", exemplo: "Ex.: 2" },
};

export function RegistrarAvanco({ routeId, kind }: { routeId: string; kind: Exclude<TipoRota, "negocios"> }) {
  const [valor, setValor] = useState("");
  const [pendente, iniciar] = useTransition();
  const avisar = useAvisar();
  return (
    <form
      className="ask__add"
      onSubmit={(e) => {
        e.preventDefault();
        const n = Number(valor.replace(/\./g, "").replace(",", "."));
        if (!(n > 0)) return;
        iniciar(async () => {
          const r = await registrarAvanco(routeId, n);
          if (!r.ok) { avisar({ texto: r.erro ?? "Não foi possível registrar." }); return; }
          setValor("");
          avisar({ texto: `Registrado: ${textoValor(kind, n)}.`, acao: { rotulo: "Desfazer", fazer: () => iniciar(() => desfazerAvanco(r.entradaId!)) } });
        });
      }}
    >
      <label className="field" style={{ flex: 1 }}>
        <span className="sr-only">{PERGUNTA[kind].rotulo}</span>
        <input className="input" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder={`${PERGUNTA[kind].rotulo}? ${PERGUNTA[kind].exemplo}`} aria-label={PERGUNTA[kind].rotulo} />
      </label>
      <button className="btn btn--line" type="submit" disabled={pendente || !valor.trim()}>Registrar</button>
    </form>
  );
}

export function DesfazerRegistro({ id }: { id: string }) {
  const [pendente, iniciar] = useTransition();
  return <button type="button" className="btn btn--ghost btn--sm" disabled={pendente} onClick={() => iniciar(() => desfazerAvanco(id))}>Desfazer</button>;
}

export function EscolhaRecalculo({ routeId, manter, mover, novaData }: { routeId: string; manter: string; mover: string; novaData: string }) {
  const [pendente, iniciar] = useTransition();
  const avisar = useAvisar();
  return (
    <div className="recalc__act">
      <button type="button" className="btn btn--sm" disabled={pendente} onClick={() => iniciar(async () => { await decidirRecalculo(routeId, "manter"); avisar({ texto: `Chegada mantida em ${manter}. O novo ritmo vale daqui para frente.` }); })}>Manter {manter}</button>
      <button type="button" className="btn btn--line btn--sm" disabled={pendente} onClick={() => iniciar(async () => { await decidirRecalculo(routeId, "mover", novaData); avisar({ texto: `Chegada movida para ${mover}, com o ritmo de antes.` }); })}>Mover para {mover}</button>
    </div>
  );
}

export function AceitarRitmo({ routeId }: { routeId: string }) {
  const [pendente, iniciar] = useTransition();
  return <button type="button" className="btn btn--ghost btn--sm" disabled={pendente} onClick={() => iniciar(() => decidirRecalculo(routeId, "manter"))}>Entendi</button>;
}

export function PassoSugerido({ routeId, titulo, quando, atualizar = false }: { routeId: string; titulo: string; quando: string; atualizar?: boolean }) {
  const [pendente, iniciar] = useTransition();
  const avisar = useAvisar();
  return (
    <div className="sim__next" style={{ alignItems: "center", gridTemplateColumns: "20px minmax(0,1fr) auto" }}>
      <span className="check" aria-hidden />
      <span><b>{titulo}</b><small>Sugestão · {quando}</small></span>
      <button type="button" className="btn btn--sm" disabled={pendente} onClick={() => iniciar(async () => { const r = await criarPassoSugerido(routeId); if (r.ok) avisar({ texto: atualizar ? `Passo atualizado: ${r.titulo}.` : `No Hoje: ${r.titulo}.` }); })}>
        <Sun aria-hidden />{atualizar ? "Atualizar o passo" : "Colocar no Hoje"}
      </button>
    </div>
  );
}

export function AdicionarPassoRota({ routeId, marcoId, exemplo }: { routeId: string; marcoId?: string | null; exemplo: string }) {
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
          const r = await adicionarPassoRota(routeId, t, marcoId);
          if (!r.ok) { setValor(t); avisar({ texto: r.erro ?? "Não foi possível guardar." }); }
        });
      }}
    >
      <input className="input" value={valor} onChange={(e) => setValor(e.target.value)} placeholder={exemplo} aria-label="Novo passo" maxLength={500} />
      <button className="btn btn--line" type="submit" disabled={!valor.trim() || pendente}><Plus aria-hidden />Adicionar</button>
    </form>
  );
}

export function ConcluirMarco({ id, titulo, feito }: { id: string; titulo: string; feito: boolean }) {
  const [pendente, iniciar] = useTransition();
  const avisar = useAvisar();
  return (
    <button
      type="button"
      className={feito ? "btn btn--ghost btn--sm" : "btn btn--line btn--sm"}
      disabled={pendente}
      onClick={() => iniciar(async () => {
        await concluirMarco(id, !feito);
        if (!feito) avisar({ texto: `Marco concluído: ${titulo}.`, acao: { rotulo: "Desfazer", fazer: () => iniciar(() => concluirMarco(id, false)) } });
      })}
    >
      {feito ? "Reabrir marco" : <><Check aria-hidden />Concluir o marco {titulo}</>}
    </button>
  );
}

export function NovoMarco({ routeId }: { routeId: string }) {
  const [valor, setValor] = useState("");
  const [pendente, iniciar] = useTransition();
  return (
    <form className="quick-add" onSubmit={(e) => { e.preventDefault(); const t = valor.trim(); if (!t) return; setValor(""); iniciar(() => adicionarMarco(routeId, t)); }}>
      <input className="input" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="Novo marco, ex.: Documentação" aria-label="Novo marco" maxLength={120} />
      <button className="btn btn--line" type="submit" disabled={!valor.trim() || pendente}><Plus aria-hidden />Marco</button>
    </form>
  );
}

export function ApagarMarco({ id }: { id: string }) {
  const [pendente, iniciar] = useTransition();
  return (
    <button type="button" className="icon-btn" aria-label="Apagar marco" disabled={pendente} onClick={() => { if (confirm("Apagar este marco? Os passos dele continuam na Rota.")) iniciar(() => apagarMarco(id)); }}>
      <Trash2 size={15} />
    </button>
  );
}

export function FormRota({ rota, contextos }: { rota: Rota; contextos: ContextItem[] }) {
  const [r, enviar, pendente] = useActionState<EstadoForm, FormData>(salvarRota, {});
  return (
    <>
      <form action={enviar} className="detail" style={{ gap: 14 }}>
        <input type="hidden" name="id" value={rota.id} />
        <label className="field">
          Destino
          <input className="input" name="title" defaultValue={rota.title} required maxLength={120} />
        </label>
        {rota.kind !== "negocios" && (
          <label className="field">
            {rota.kind === "financeiro" ? "Quanto quer juntar (R$)" : rota.kind === "leitura" ? "Páginas do livro" : "Aulas do curso"}
            <input className="input" name="target" inputMode="decimal" defaultValue={rota.target ?? ""} />
          </label>
        )}
        <label className="field">
          Chegada
          <input className="input" type="date" name="target_date" defaultValue={rota.target_date ?? ""} />
        </label>
        <label className="field">
          Contexto
          <select className="input" name="context_id" defaultValue={rota.context_id ?? ""}>
            <option value="">Sem contexto</option>
            {contextos.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label className="field">
          Estado
          <select className="input" name="status" defaultValue={rota.status}>
            <option value="ativa">Em andamento</option>
            <option value="pausada">Pausada</option>
            <option value="concluida">Destino alcançado</option>
          </select>
        </label>
        <label className="field">
          Nota
          <textarea className="input input--area" name="note" defaultValue={rota.note ?? ""} rows={3} placeholder="Por que este destino importa" />
        </label>
        {r.erro && <p className="note note--err" role="alert">{r.erro}</p>}
        <div className="detail__foot">
          <button className="btn btn--sm" type="submit" disabled={pendente}>{pendente ? "Guardando…" : "Guardar"}</button>
          {r.ok && <span className="detail__status" role="status">Guardado.</span>}
        </div>
      </form>
      <form action={apagarRota} className="detail__danger" onSubmit={(e) => { if (!confirm("Apagar esta Rota? Os passos continuam como responsabilidades.")) e.preventDefault(); }}>
        <input type="hidden" name="id" value={rota.id} />
        <button type="submit" className="btn btn--ghost btn--sm"><Trash2 aria-hidden />Apagar Rota</button>
      </form>
    </>
  );
}
