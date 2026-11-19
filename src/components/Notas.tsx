"use client";

import { useState, useTransition } from "react";
import { NotebookPen, Scale, Trash2 } from "lucide-react";
import { apagarNota, salvarNota, type DadosNota } from "@/app/(app)/acoes";
import { hojeISO } from "@/lib/datas";
import { dataDaNota, valorVinculo, type Nota } from "@/lib/notas";
import { useAvisar } from "./Avisos";
import { Painel } from "./Comuns";

/** Onde uma nota pode morar, em grupos (Contextos, Projetos, Cursos) */
export type Lugares = { grupo: string; itens: { valor: string; nome: string }[] }[];

function FormNota({ inicial, lugares, fixo, aoTerminar }: { inicial: DadosNota; lugares: Lugares; fixo?: boolean; aoTerminar: () => void }) {
  const [d, setD] = useState(inicial);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const avisar = useAvisar();
  const decisao = d.kind === "decisao";
  return (
    <form
      className="detail"
      style={{ gap: 14 }}
      onSubmit={(e) => {
        e.preventDefault();
        setErro(null);
        iniciar(async () => {
          const r = await salvarNota(d);
          if (!r.ok) return setErro(r.erro ?? "Não foi possível guardar.");
          if (!d.id) avisar({ texto: decisao ? "Decisão registrada." : "Nota guardada." });
          aoTerminar();
        });
      }}
    >
      <div className="seg" role="radiogroup" aria-label="Tipo" style={{ justifySelf: "start" }}>
        <label><input type="radio" checked={!decisao} onChange={() => setD({ ...d, kind: "nota" })} /><span><NotebookPen aria-hidden />Nota</span></label>
        <label><input type="radio" checked={decisao} onChange={() => setD({ ...d, kind: "decisao" })} /><span><Scale aria-hidden />Decisão</span></label>
      </div>
      <label className="field">
        {decisao ? "O que foi decidido" : "Título"}
        <input className="input" value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} required maxLength={200} autoFocus={!d.id} placeholder={decisao ? "Ex.: Contratar designer pleno em novembro" : "Ex.: O que o cliente pediu na reunião"} />
      </label>
      <label className="field">
        {decisao ? "Contexto da decisão" : "Texto"}
        <textarea className="input input--area" rows={4} value={d.body} onChange={(e) => setD({ ...d, body: e.target.value })} placeholder={decisao ? "Ex.: Decidido em reunião com o sócio." : "Escreva o que vale lembrar."} />
      </label>
      {decisao && (
        <div className="fields" style={{ gridTemplateColumns: "minmax(0, 1fr) 160px" }}>
          <label className="field">Por quê<input className="input" value={d.why} onChange={(e) => setD({ ...d, why: e.target.value })} placeholder="Ex.: Dois clientes novos e a equipe no limite" /></label>
          <label className="field">Quando<input className="input" type="date" value={d.decided_on} onChange={(e) => setD({ ...d, decided_on: e.target.value })} /></label>
        </div>
      )}
      {!fixo && (
        <label className="field">
          Onde ela mora
          <select className="input" value={d.vinculo} onChange={(e) => setD({ ...d, vinculo: e.target.value })} required>
            <option value="" disabled>Escolha um contexto, projeto ou curso</option>
            {lugares.filter((g) => g.itens.length).map((g) => (
              <optgroup key={g.grupo} label={g.grupo}>
                {g.itens.map((i) => <option key={i.valor} value={i.valor}>{i.nome}</option>)}
              </optgroup>
            ))}
          </select>
        </label>
      )}
      {erro && <p className="note note--err" role="alert">{erro}</p>}
      <div className="detail__foot">
        <button className="btn btn--sm" type="submit" disabled={pendente || !d.title.trim()}>{pendente ? "Guardando…" : d.id ? "Guardar" : decisao ? "Registrar decisão" : "Guardar nota"}</button>
        <button className="btn btn--ghost btn--sm" type="button" onClick={aoTerminar}>Cancelar</button>
      </div>
    </form>
  );
}

/** Botão "Nova nota": com `vinculo`, a nota já nasce no lugar da tela (projeto, curso, contexto) */
export function NovaNota({ lugares = [], vinculo, decisao = false, rotulo = "Nova nota", variante = "btn btn--line btn--sm" }: { lugares?: Lugares; vinculo?: string; decisao?: boolean; rotulo?: string; variante?: string }) {
  const [aberto, setAberto] = useState(false);
  const fechar = () => setAberto(false);
  return (
    <>
      <button type="button" className={variante} onClick={() => setAberto(true)}>{decisao ? <Scale aria-hidden /> : <NotebookPen aria-hidden />}{rotulo}</button>
      {aberto && (
        <Painel titulo={decisao ? "Registrar decisão" : "Nova nota"} fechar={fechar}>
          <FormNota inicial={{ kind: decisao ? "decisao" : "nota", title: "", body: "", why: "", decided_on: hojeISO(), vinculo: vinculo ?? "" }} lugares={lugares} fixo={!!vinculo} aoTerminar={fechar} />
        </Painel>
      )}
    </>
  );
}

/** As notas de um lugar, como no Book: "Iter Mídia · Decisão · 19 de novembro", título, texto e o porquê */
export function ListaNotas({ notas, rotulos = {}, lugares = [] }: { notas: Nota[]; rotulos?: Record<string, { nome: string; cor?: string }>; lugares?: Lugares }) {
  return (
    <div className="notes">
      {notas.map((n) => <CartaoNota key={n.id} nota={n} lugar={rotulos[n.id] ?? null} lugares={lugares} />)}
    </div>
  );
}

function CartaoNota({ nota, lugar, lugares }: { nota: Nota; lugar: { nome: string; cor?: string } | null; lugares: Lugares }) {
  const [editando, setEditando] = useState(false);
  const [pendente, iniciar] = useTransition();
  if (editando) {
    return (
      <article className="note-card">
        <FormNota
          inicial={{ id: nota.id, kind: nota.kind, title: nota.title, body: nota.body ?? "", why: nota.why ?? "", decided_on: nota.decided_on ?? hojeISO(), vinculo: valorVinculo(nota) }}
          lugares={lugares}
          fixo={!lugares.length}
          aoTerminar={() => setEditando(false)}
        />
      </article>
    );
  }
  return (
    <article className="note-card" id={nota.id}>
      <p className="note-card__k">
        {lugar && <><i className="dot" style={{ background: lugar.cor ?? "var(--gray)" }} />{lugar.nome} · </>}
        {nota.kind === "decisao" ? "Decisão" : "Nota"} · {dataDaNota(nota)}
      </p>
      <h3 className="note-card__t">{nota.title}</h3>
      {nota.body && <p className="note-card__b">{nota.body}</p>}
      {nota.why && <p className="note-card__why"><small>Por quê</small>{nota.why}</p>}
      <div className="note-card__act">
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => setEditando(true)}>Editar</button>
        <button type="button" className="icon-btn" aria-label={`Apagar ${nota.title}`} disabled={pendente} onClick={() => { if (confirm("Apagar esta nota?")) iniciar(() => apagarNota(nota.id)); }}>
          <Trash2 size={15} />
        </button>
      </div>
    </article>
  );
}
