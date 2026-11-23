"use client";

// Matéria por dentro: módulos (opcionais) e aulas/temas, cada um com estado (não vista, vista, revisar),
// e as revisões do dia (1, 7 e 30 dias depois de ver).
import { useState, useTransition } from "react";
import Link from "next/link";
import { Check, ChevronRight, Pencil, Plus, RotateCcw, Trash2, X } from "lucide-react";
import {
  adicionarTemas, apagarModulo, apagarTema, criarModulo, desfazerRevisao, marcarTema, renomearModulo, revisarTema,
} from "@/app/(app)/acoes";
import { pctTexto, textoRevisao, tomAcerto, type Materia, type Modulo, type Tema } from "@/lib/estudos";
import { rotuloData } from "@/lib/datas";
import { useAvisar } from "./Avisos";
import { AdicionarRapido } from "./Comuns";

/** O botão "Revisei", com desfazer */
export function Revisei({ tema }: { tema: Tema }) {
  const [pendente, iniciar] = useTransition();
  const avisar = useAvisar();
  return (
    <button
      type="button"
      className="btn btn--line btn--sm"
      disabled={pendente}
      onClick={() => iniciar(async () => {
        const r = await revisarTema(tema.id);
        if (!r) return;
        avisar({
          texto: r.proxima ? `Revisado. Próxima revisão ${rotuloData(r.proxima)}.` : "Revisado. Esta aula fechou as três revisões.",
          acao: { rotulo: "Desfazer", fazer: () => iniciar(() => desfazerRevisao(tema.id, tema.review_step, tema.next_review_on)) },
        });
      })}
    >
      <RotateCcw aria-hidden />Revisei
    </button>
  );
}

/** Revisões do dia, com a matéria de cada uma */
export function RevisoesDoDia({ temas, materias, cursoDe }: { temas: Tema[]; materias: Materia[]; cursoDe?: (m: Materia) => string }) {
  return (
    <ul className="list">
      {temas.map((t) => {
        const m = materias.find((x) => x.id === t.subject_id);
        return (
          <li key={t.id} className="row" style={{ gridTemplateColumns: "20px minmax(0,1fr) auto", alignItems: "center" }}>
            <RotateCcw className="row__ic" aria-hidden style={{ color: m?.color }} />
            <div className="row__body">
              <span className="row__t">{t.title}</span>
              <span className="props">
                {m && <span className="prop"><i className="dot" style={{ background: m.color }} />{m.title}{cursoDe ? ` · ${cursoDe(m)}` : ""}</span>}
                <span className="prop">{textoRevisao(t).texto} · {t.review_step + 1}ª de 3</span>
              </span>
            </div>
            <Revisei tema={t} />
          </li>
        );
      })}
    </ul>
  );
}

function LinhaAula({ tema, extra }: { tema: Tema; extra?: React.ReactNode }) {
  const [pendente, iniciar] = useTransition();
  const avisar = useAvisar();
  const rev = textoRevisao(tema);
  return (
    <li className={`aula${tema.done_at ? " is-vista" : ""}`}>
      <button
        type="button"
        role="checkbox"
        aria-checked={!!tema.done_at}
        aria-label={`${tema.done_at ? "Marcar como não vista" : "Marcar como vista"}: ${tema.title}`}
        className="check"
        disabled={pendente}
        onClick={() => iniciar(async () => {
          await marcarTema(tema.id, !tema.done_at);
          if (!tema.done_at) avisar({ texto: "Vista. A 1ª revisão fica para amanhã." });
        })}
      >
        {tema.done_at && <Check aria-hidden />}
      </button>
      <span className="aula__t">{tema.title}{extra}</span>
      <span className={`aula__rev aula__rev--${rev.tom}`}>{rev.texto}</span>
      {rev.tom === "hoje" ? <Revisei tema={tema} /> : <span />}
      <button type="button" className="icon-btn aula__del" aria-label={`Apagar ${tema.title}`} disabled={pendente} onClick={() => iniciar(() => apagarTema(tema.id))}><X size={14} /></button>
    </li>
  );
}

/** Aulas coladas de uma vez (um por linha), dentro do módulo */
function NovasAulas({ materiaId, moduloId, vazio }: { materiaId: string; moduloId: string | null; vazio: boolean }) {
  const [valor, setValor] = useState("");
  const [pendente, iniciar] = useTransition();
  const avisar = useAvisar();
  return (
    <form
      className="topics__add"
      onSubmit={(e) => {
        e.preventDefault();
        const t = valor.trim();
        if (!t) return;
        iniciar(async () => {
          const r = await adicionarTemas(materiaId, t, moduloId);
          if (!r.ok) return avisar({ texto: r.erro ?? "Não foi possível guardar." });
          setValor("");
          if ((r.n ?? 0) > 1) avisar({ texto: `${r.n} aulas adicionadas.` });
        });
      }}
    >
      <textarea
        className="input input--area"
        rows={vazio ? 3 : 1}
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !valor.includes("\n")) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }}
        placeholder={vazio ? "Cole as aulas ou temas, um por linha (pode ser a lista do edital ou da ementa)" : "Nova aula ou tema"}
        aria-label="Novas aulas"
      />
      <button className="btn btn--line btn--sm" type="submit" disabled={!valor.trim() || pendente}><Plus aria-hidden />Adicionar</button>
    </form>
  );
}

function CabecaModulo({ modulo, vistas, total }: { modulo: Modulo; vistas: number; total: number }) {
  const [editando, setEditando] = useState(false);
  const [nome, setNome] = useState(modulo.title);
  const [pendente, iniciar] = useTransition();
  if (editando) {
    return (
      <form className="modulo__edit" onSubmit={(e) => { e.preventDefault(); iniciar(async () => { await renomearModulo(modulo.id, nome); setEditando(false); }); }}>
        <input className="input" value={nome} onChange={(e) => setNome(e.target.value)} aria-label="Nome do módulo" maxLength={120} autoFocus />
        <button className="btn btn--sm" type="submit" disabled={pendente}>Guardar</button>
        <button className="btn btn--ghost btn--sm" type="button" onClick={() => setEditando(false)}>Cancelar</button>
      </form>
    );
  }
  return (
    <span className="modulo__acoes">
      <em>{vistas} de {total}</em>
      <button type="button" className="icon-btn" aria-label={`Renomear ${modulo.title}`} onClick={(e) => { e.preventDefault(); setEditando(true); }}><Pencil size={14} /></button>
      <button type="button" className="icon-btn" aria-label={`Apagar o módulo ${modulo.title}`} disabled={pendente} onClick={(e) => { e.preventDefault(); if (confirm(`Apagar o módulo ${modulo.title}? As aulas dele continuam na matéria.`)) iniciar(() => apagarModulo(modulo.id)); }}><Trash2 size={14} /></button>
    </span>
  );
}

/** Módulos (abrem e fecham) e as aulas sem módulo */
export function AulasDaMateria({ materia, modulos, temas }: { materia: Materia; modulos: Modulo[]; temas: Tema[] }) {
  const daMateria = temas.filter((t) => t.subject_id === materia.id).sort((a, b) => a.position - b.position);
  const soltas = daMateria.filter((t) => !t.module_id || !modulos.some((m) => m.id === t.module_id));
  return (
    <div className="aulas">
      {modulos.map((mod) => {
        const lista = daMateria.filter((t) => t.module_id === mod.id);
        const vistas = lista.filter((t) => t.done_at).length;
        const aberto = lista.some((t) => !t.done_at || textoRevisao(t).tom === "hoje") || !lista.length;
        return (
          <details key={mod.id} className="modulo" open={aberto}>
            <summary><ChevronRight aria-hidden /><b>{mod.title}</b><CabecaModulo modulo={mod} vistas={vistas} total={lista.length} /></summary>
            <ul className="aulas__lista">{lista.map((t) => <LinhaAula key={t.id} tema={t} />)}</ul>
            <NovasAulas materiaId={materia.id} moduloId={mod.id} vazio={!lista.length} />
          </details>
        );
      })}
      {(soltas.length > 0 || !modulos.length) && (
        <section className="modulo modulo--solto">
          {modulos.length > 0 && <h3 className="sec__h">Sem módulo {soltas.length > 0 && <em>{soltas.length}</em>}</h3>}
          <ul className="aulas__lista">{soltas.map((t) => <LinhaAula key={t.id} tema={t} />)}</ul>
          <NovasAulas materiaId={materia.id} moduloId={null} vazio={!daMateria.length} />
        </section>
      )}
      <AdicionarRapido acao={(t) => criarModulo(materia.id, t)} placeholder="Novo módulo (opcional), ex.: Módulo 1 · Fonética" rotulo="Novo módulo" botao="Módulo" maxLength={120} />
    </div>
  );
}

/** Cartão da matéria na mesa de estudo: horas no ciclo, aulas vistas e revisões do dia */
export function CartaoMateria({ cursoId, materia, feito, meta, vistas, total, revisar, daVez, proxima }: {
  cursoId: string; materia: Materia; feito: number; meta: number | null; vistas: number; total: number; revisar: number; daVez: boolean; proxima: string | null;
}) {
  const pct = meta ? Math.min(1, feito / meta) : 0;
  const completa = !!meta && feito >= meta;
  const h = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? String(m % 60).padStart(2, "0") : ""}` : `${Math.round(m)} min`);
  return (
    <Link href={`/estudos/${cursoId}/materia/${materia.id}`} className={`mcard${daVez ? " mcard--vez" : ""}${completa ? " mcard--ok" : ""}`} style={{ "--c": materia.color } as React.CSSProperties}>
      <span className="mcard__k">{daVez ? "A vez dela" : completa ? "Horas do ciclo completas" : "No ciclo"}{revisar > 0 && <b> · {revisar} para revisar</b>}</span>
      <span className="mcard__t">{materia.title}</span>
      <span className="mcard__bar"><i style={{ width: `${pct * 100}%` }} /></span>
      <span className="mcard__nums">
        <span>{meta ? `${h(feito)} de ${h(meta)}` : h(feito)}</span>
        <span>{total ? `${vistas} de ${total} aulas` : "Sem aulas ainda"}</span>
      </span>
      {proxima && <span className="mcard__prox">Próxima: {proxima}</span>}
    </Link>
  );
}

/** Edital verticalizado: a matéria com todos os temas, o que já viu, as revisões e o acerto em questões de cada tema */
export function EditalMateria({ cursoId, materia, temas, acertoTema, acertoMateria }: {
  cursoId: string; materia: Materia; temas: Tema[]; acertoTema: Record<string, { pct: number | null; total: number }>; acertoMateria: { pct: number | null; total: number };
}) {
  const lista = temas.filter((t) => t.subject_id === materia.id).sort((a, b) => a.position - b.position);
  const vistos = lista.filter((t) => t.done_at).length;
  const revisados = lista.filter((t) => t.review_step >= 3).length;
  return (
    <section className="edital" style={{ "--c": materia.color } as React.CSSProperties}>
      <header className="edital__h">
        <Link href={`/estudos/${cursoId}/materia/${materia.id}`} className="edital__t"><i className="dot" style={{ background: materia.color }} />{materia.title}</Link>
        <span className="edital__nums">
          <span>{vistos} de {lista.length} vistos</span>
          {revisados > 0 && <span>{revisados} revisados 3×</span>}
          {acertoMateria.total > 0 && <span className={`acerto acerto--${tomAcerto(acertoMateria.pct)}`}>{pctTexto(acertoMateria.pct)} em {acertoMateria.total}</span>}
        </span>
      </header>
      <span className="edital__barra"><i style={{ width: `${lista.length ? (vistos / lista.length) * 100 : 0}%` }} /></span>
      <ul className="aulas__lista">
        {lista.map((t) => {
          const a = acertoTema[t.id];
          return <LinhaAula key={t.id} tema={t} extra={a?.total ? <span className={`acerto acerto--${tomAcerto(a.pct)}`}>{pctTexto(a.pct)}</span> : null} />;
        })}
      </ul>
      <NovasAulas materiaId={materia.id} moduloId={null} vazio={!lista.length} />
    </section>
  );
}
