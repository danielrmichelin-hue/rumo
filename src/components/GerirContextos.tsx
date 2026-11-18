"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Archive, ArchiveRestore, ChevronDown, ChevronUp, Pencil, Trash2 } from "lucide-react";
import {
  apagarContexto,
  arquivarContexto,
  criarContexto,
  criarContextosSugeridos,
  moverContexto,
  salvarContexto,
  type EstadoForm,
} from "@/app/(app)/acoes";
import { slug } from "@/lib/captura";
import { CORES_CONTEXTO, type Contexto } from "@/lib/tipos";

export function GerirContextos({ contextos, abertas }: { contextos: Contexto[]; abertas: Record<string, number> }) {
  const ativos = contextos.filter((c) => !c.archived);
  const arquivados = contextos.filter((c) => c.archived);
  const [editando, setEditando] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  return (
    <div className="ctx">
      {contextos.length === 0 && (
        <div className="empty">
          <b>Comece pelos seus</b>
          Crie Iter Mídia, Rumo e Casa de uma vez. Dá para renomear, mudar a cor e criar outros depois.
          <div style={{ marginTop: 14 }}>
            <button className="btn btn--sm" type="button" disabled={pendente} onClick={() => iniciar(() => criarContextosSugeridos())}>
              {pendente ? "Criando…" : "Criar Iter Mídia, Rumo e Casa"}
            </button>
          </div>
        </div>
      )}

      {ativos.length > 0 && (
        <ul className="ctx__list">
          {ativos.map((c, i) =>
            editando === c.id ? (
              <li key={c.id} className="ctx__item ctx__item--edit">
                <FormContexto contexto={c} aoTerminar={() => setEditando(null)} abertas={abertas[c.id] ?? 0} />
              </li>
            ) : (
              <li key={c.id} className="ctx__item">
                <i className="dot dot--lg" style={{ background: c.color }} />
                <div className="ctx__body">
                  <Link href={`/contexto/${c.id}`} className="ctx__name">{c.name}</Link>
                  <span className="props">
                    <span className="prop">{c.kind === "empresa" ? "Empresa" : "Área"}</span>
                    <span className="prop">{abertas[c.id] ? `${abertas[c.id]} em aberto` : "Nada em aberto"}</span>
                    <span className="prop"><code>#{slug(c.name.split(/\s+/)[0])}</code></span>
                  </span>
                </div>
                <div className="ctx__actions">
                  <button type="button" className="icon-btn" aria-label={`Subir ${c.name}`} disabled={i === 0 || pendente} onClick={() => iniciar(() => moverContexto(c.id, -1))}><ChevronUp size={16} /></button>
                  <button type="button" className="icon-btn" aria-label={`Descer ${c.name}`} disabled={i === ativos.length - 1 || pendente} onClick={() => iniciar(() => moverContexto(c.id, 1))}><ChevronDown size={16} /></button>
                  <button type="button" className="icon-btn" aria-label={`Editar ${c.name}`} onClick={() => setEditando(c.id)}><Pencil size={15} /></button>
                  <button type="button" className="icon-btn" aria-label={`Arquivar ${c.name}`} title="Arquivar" disabled={pendente} onClick={() => iniciar(() => arquivarContexto(c.id, true))}><Archive size={15} /></button>
                </div>
              </li>
            ),
          )}
        </ul>
      )}

      <section className="ctx__new">
        <h2 className="group__t">Novo contexto</h2>
        <FormContexto />
      </section>

      {arquivados.length > 0 && (
        <details className="ctx__archived">
          <summary>Arquivados ({arquivados.length})</summary>
          <ul className="ctx__list">
            {arquivados.map((c) => (
              <li key={c.id} className="ctx__item">
                <i className="dot dot--lg" style={{ background: c.color, opacity: 0.5 }} />
                <div className="ctx__body">
                  <span className="ctx__name">{c.name}</span>
                  <span className="props"><span className="prop">{abertas[c.id] ? `${abertas[c.id]} em aberto` : "Nada em aberto"}</span></span>
                </div>
                <div className="ctx__actions">
                  <button type="button" className="icon-btn" aria-label={`Reativar ${c.name}`} title="Reativar" disabled={pendente} onClick={() => iniciar(() => arquivarContexto(c.id, false))}><ArchiveRestore size={15} /></button>
                  <BotaoApagar contexto={c} abertas={abertas[c.id] ?? 0} />
                </div>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function BotaoApagar({ contexto, abertas }: { contexto: Contexto; abertas: number }) {
  const [pendente, iniciar] = useTransition();
  return (
    <button
      type="button"
      className="icon-btn"
      aria-label={`Apagar ${contexto.name}`}
      title="Apagar"
      disabled={pendente}
      onClick={() => {
        const aviso = abertas ? ` As ${abertas} responsabilidades dele voltam para a Inbox.` : "";
        if (confirm(`Apagar ${contexto.name}?${aviso}`)) iniciar(() => apagarContexto(contexto.id));
      }}
    >
      <Trash2 size={15} />
    </button>
  );
}

function FormContexto({ contexto, aoTerminar, abertas = 0 }: { contexto?: Contexto; aoTerminar?: () => void; abertas?: number }) {
  const [resultado, enviar, pendente] = useActionState<EstadoForm, FormData>(contexto ? salvarContexto : criarContexto, {});
  const [cor, setCor] = useState(contexto?.color ?? CORES_CONTEXTO[0].cor);
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!resultado.ok) return;
    if (aoTerminar) aoTerminar();
    else form.current?.reset();
  }, [resultado, aoTerminar]);

  return (
    <form ref={form} action={enviar} className="ctx__form">
      {contexto && <input type="hidden" name="id" value={contexto.id} />}
      <div className="ctx__fields">
        <label className="field ctx__field-name">
          Nome
          <input className="input" name="name" defaultValue={contexto?.name} placeholder="Ex.: Iter Mídia" required maxLength={60} autoFocus={!!contexto} />
        </label>
        <label className="field">
          Tipo
          <select className="input" name="kind" defaultValue={contexto?.kind ?? "area"}>
            <option value="empresa">Empresa</option>
            <option value="area">Área da vida</option>
          </select>
        </label>
      </div>
      <fieldset className="swatches">
        <legend>Cor</legend>
        {CORES_CONTEXTO.map((c) => (
          <label key={c.cor} title={c.nome}>
            <input type="radio" name="color" value={c.cor} checked={cor === c.cor} onChange={() => setCor(c.cor)} />
            <span style={{ background: c.cor }} aria-label={c.nome} />
          </label>
        ))}
      </fieldset>
      {resultado.erro && <p className="note note--err" role="alert">{resultado.erro}</p>}
      <div className="ctx__formfoot">
        <button className="btn btn--sm" type="submit" disabled={pendente}>{pendente ? "Guardando…" : contexto ? "Guardar" : "Criar contexto"}</button>
        {aoTerminar && <button className="btn-quiet" type="button" onClick={aoTerminar}>Cancelar</button>}
        {contexto && (
          <span style={{ marginLeft: "auto" }}><BotaoApagar contexto={contexto} abertas={abertas} /></span>
        )}
      </div>
    </form>
  );
}
