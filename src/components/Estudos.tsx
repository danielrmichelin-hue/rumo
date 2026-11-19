"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronRight, Clock, Play, Plus, Trash2, X } from "lucide-react";
import {
  adicionarMateria, agendarSessao, apagarCurso, apagarMateria, apagarSessao, avancarCiclo, comecarSessao, comecarSessaoMarcada,
  concluirSessao, criarCurso, registrarAula, restaurarCiclo, restaurarSessao, salvarCurso, salvarMateria, type EstadoForm,
} from "@/app/(app)/acoes";
import { hojeISO } from "@/lib/datas";
import {
  emAndamento, horas, NOME_CICLO, quandoSessao, TIPOS_CURSO, type Curso, type Materia, type Sessao, type TipoCurso,
} from "@/lib/estudos";
import { useAvisar } from "./Avisos";
import type { ContextItem } from "./Shell";

// ---------- novo curso ----------

const PADRAO: Record<TipoCurso, { titulo: string; aulas: string; ciclos: string; horas: string; prova: string; materias: string[] }> = {
  graduacao: { titulo: "", aulas: "", ciclos: "8", horas: "10", prova: "prova", materias: [] },
  pos: { titulo: "Pós em ", aulas: "60", ciclos: "8", horas: "6", prova: "prova do módulo", materias: [] },
  idioma: { titulo: "Inglês", aulas: "", ciclos: "", horas: "3", prova: "prova de nível", materias: ["Conversação", "Gramática", "Vocabulário"] },
  concurso: { titulo: "Concurso ", aulas: "", ciclos: "", horas: "15", prova: "prova", materias: ["Português", "Raciocínio lógico", "Direito constitucional"] },
  curso: { titulo: "", aulas: "20", ciclos: "", horas: "3", prova: "entrega final", materias: [] },
};

export function NovoCurso({ contextos, tipoInicial, sugeridos }: { contextos: ContextItem[]; tipoInicial: TipoCurso | null; sugeridos: TipoCurso[] }) {
  const router = useRouter();
  const [tipo, setTipo] = useState<TipoCurso | null>(tipoInicial);
  const p = tipoInicial ? PADRAO[tipoInicial] : null;
  const [titulo, setTitulo] = useState(p?.titulo ?? "");
  const [aulas, setAulas] = useState(p?.aulas ?? "");
  const [feitas, setFeitas] = useState("");
  const [ciclos, setCiclos] = useState(p?.ciclos ?? "");
  const [ciclo, setCiclo] = useState("1");
  const [horasSemana, setHorasSemana] = useState(p?.horas ?? "");
  const [prova, setProva] = useState("");
  const [rotuloProva, setRotuloProva] = useState(p?.prova ?? "prova");
  const [materias, setMaterias] = useState<string[]>(p?.materias ?? []);
  const [nova, setNova] = useState("");
  const [contexto, setContexto] = useState(contextos.find((c) => /estud|pós|pos|faculdade/i.test(c.name))?.id ?? "");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, iniciar] = useTransition();

  function escolher(t: TipoCurso) {
    setTipo(t);
    const d = PADRAO[t];
    if (!titulo.trim() || Object.values(PADRAO).some((x) => x.titulo === titulo)) setTitulo(d.titulo);
    setAulas(d.aulas);
    setCiclos(d.ciclos);
    setHorasSemana(d.horas);
    setRotuloProva(d.prova);
    if (!materias.length || Object.values(PADRAO).some((x) => x.materias.join() === materias.join())) setMaterias(d.materias);
  }

  function addMateria() {
    const t = nova.trim();
    if (!t || materias.includes(t)) return;
    setMaterias([...materias, t]);
    setNova("");
  }

  const n = (v: string) => (v.trim() ? Number(v.replace(",", ".")) : null);
  const total = n(aulas);
  const nomeCiclo = tipo ? NOME_CICLO[tipo] : NOME_CICLO.curso;

  function criar(e: React.FormEvent) {
    e.preventDefault();
    if (!tipo) return setErro("Escolha o que você estuda.");
    setErro(null);
    iniciar(async () => {
      const r = await criarCurso({
        title: titulo,
        kind: tipo,
        context_id: contexto || null,
        total_lessons: total,
        done_lessons: n(feitas) ?? 0,
        cycles: n(ciclos),
        current_cycle: n(ciclo) ?? 1,
        weekly_minutes: n(horasSemana) ? Math.round(n(horasSemana)! * 60) : null,
        exam_date: prova || null,
        exam_label: rotuloProva,
        materias: nova.trim() ? [...materias, nova.trim()] : materias,
      });
      if (!r.ok) return setErro(r.erro ?? "Não foi possível criar.");
      router.push(`/estudos/${r.id}`);
    });
  }

  return (
    <form onSubmit={criar} className="course-form">
      <div className="chips" role="group" aria-label="O que você estuda">
        {(Object.keys(TIPOS_CURSO) as TipoCurso[]).map((t) => (
          <button key={t} type="button" aria-pressed={tipo === t} className="chip" onClick={() => escolher(t)}>
            {TIPOS_CURSO[t]}{sugeridos.includes(t) && tipo !== t && <small> · você contou</small>}
          </button>
        ))}
      </div>

      {tipo && (
        <>
          <label className="field">
            Nome
            <input className="input" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Pós em Marketing" required maxLength={120} autoFocus />
          </label>
          <div className="fields">
            <label className="field">Aulas no total<input className="input" inputMode="numeric" value={aulas} onChange={(e) => setAulas(e.target.value)} placeholder="Opcional" /></label>
            <label className="field">Já concluiu<input className="input" inputMode="numeric" value={feitas} onChange={(e) => setFeitas(e.target.value)} placeholder="0" /></label>
            <label className="field">Horas por semana<input className="input" inputMode="decimal" value={horasSemana} onChange={(e) => setHorasSemana(e.target.value)} placeholder="Ex.: 6" /></label>
          </div>
          <div className="fields">
            <label className="field">{nomeCiclo.varios}<input className="input" inputMode="numeric" value={ciclos} onChange={(e) => setCiclos(e.target.value)} placeholder="Opcional" /></label>
            <label className="field">{nomeCiclo.um} atual<input className="input" inputMode="numeric" value={ciclo} onChange={(e) => setCiclo(e.target.value)} /></label>
            <label className="field">
              Contexto
              <select className="input" value={contexto} onChange={(e) => setContexto(e.target.value)}>
                <option value="">Sem contexto</option>
                {contextos.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
          </div>
          <div className="fields" style={{ gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)" }}>
            <label className="field">Próxima prova ou entrega<input className="input" type="date" value={prova} min={hojeISO()} onChange={(e) => setProva(e.target.value)} /></label>
            <label className="field">Chamar de<input className="input" value={rotuloProva} onChange={(e) => setRotuloProva(e.target.value)} maxLength={60} /></label>
          </div>

          <div className="field">
            Matérias {ciclos ? `do ${nomeCiclo.um.toLowerCase()} atual` : ""}
            <div className="chips">
              {materias.map((m) => (
                <span key={m} className="chip chip--sel">{m}<button type="button" aria-label={`Tirar ${m}`} onClick={() => setMaterias(materias.filter((x) => x !== m))}><X size={12} /></button></span>
              ))}
            </div>
            <div className="quick-add" style={{ padding: 0 }}>
              <input className="input" value={nova} onChange={(e) => setNova(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addMateria(); } }} placeholder="Nova matéria, ex.: Posicionamento" aria-label="Nova matéria" maxLength={120} />
              <button type="button" className="btn btn--line" onClick={addMateria} disabled={!nova.trim()}><Plus aria-hidden />Matéria</button>
            </div>
          </div>

          <p className="field__hint">
            {total ? `${n(feitas) ?? 0} de ${total} aulas. ` : ""}
            {n(horasSemana) ? `A semana mostra ${horas(n(horasSemana)! * 60)} planejadas. ` : ""}
            As sessões que você marcar vão para o calendário e para o Hoje.
          </p>
          {erro && <p className="note note--err" role="alert">{erro}</p>}
          <div><button className="btn" type="submit" disabled={salvando || !titulo.trim()}>{salvando ? "Criando…" : "Criar"}</button></div>
        </>
      )}
    </form>
  );
}

// ---------- sessões ----------

/** "Começar sessão" do topo: abre uma sessão agora na matéria sugerida */
export function ComecarSessao({ cursoId, materia, variante = "btn" }: { cursoId: string; materia: Materia | null; variante?: string }) {
  const [pendente, iniciar] = useTransition();
  const avisar = useAvisar();
  return (
    <button
      type="button"
      className={variante}
      disabled={pendente}
      onClick={() => iniciar(async () => {
        const r = await comecarSessao(cursoId, materia?.id ?? null);
        if (r.ok) avisar({ texto: `Sessão começou${materia ? `: ${materia.title}` : ""}. Bom estudo.`, acao: { rotulo: "Desfazer", fazer: () => iniciar(() => apagarSessao(r.id!)) } });
      })}
    >
      <Play aria-hidden />Começar sessão
    </button>
  );
}

/** O cartão "Próxima sessão": Começar (traz para agora) ou Concluir (quando está acontecendo) */
export function ProximaSessao({ sessao, materia }: { sessao: Sessao; materia: Materia | null }) {
  const [pendente, iniciar] = useTransition();
  const avisar = useAvisar();
  const [agora, setAgora] = useState<Date | null>(null);
  useEffect(() => {
    setAgora(new Date());
    const t = setInterval(() => setAgora(new Date()), 30000);
    return () => clearInterval(t);
  }, []);
  const rodando = agora ? emAndamento(sessao, agora) : false;

  return (
    <section className="next" aria-label="Próxima sessão" style={{ gridTemplateColumns: "1fr" }}>
      <div>
        <span className="next__k">
          <img src="/brand/rumo-symbol.svg" alt="" className="logo-light" />
          <img src="/brand/rumo-symbol-light.svg" alt="" className="logo-dark" />
          {rodando ? "Sessão em andamento" : "Próxima sessão"}
        </span>
        <span className="next__t">{sessao.title}</span>
        <span className="props"><span className="prop"><Clock aria-hidden />{agora ? quandoSessao(sessao, agora) : quandoSessao(sessao)}</span></span>
      </div>
      <div className="next__act">
        {rodando ? (
          <button
            type="button"
            className="btn"
            disabled={pendente}
            onClick={() => iniciar(async () => {
              const r = await concluirSessao(sessao.id, true, !!materia);
              avisar({
                texto: materia ? `Sessão concluída. Uma aula de ${materia.title} registrada.` : "Sessão concluída.",
                acao: { rotulo: "Desfazer", fazer: () => iniciar(() => concluirSessao(sessao.id, false, !!materia, r.fimAntes).then(() => undefined)) },
              });
            })}
          >
            <Check aria-hidden />Concluir
          </button>
        ) : (
          <button
            type="button"
            className="btn"
            disabled={pendente}
            onClick={() => iniciar(async () => {
              const r = await comecarSessaoMarcada(sessao.id);
              if (r.ok && r.antes) avisar({ texto: "Sessão começou agora.", acao: { rotulo: "Desfazer", fazer: () => iniciar(() => restaurarSessao(sessao.id, r.antes!.starts_at, r.antes!.ends_at)) } });
            })}
          >
            <Play aria-hidden />Começar
          </button>
        )}
      </div>
    </section>
  );
}

/** Marcar uma sessão: matéria, dia, hora e duração. Vira compromisso do calendário. */
export function MarcarSessao({ cursoId, materias, materiaInicial, rotulo = "Marcar sessão", variante = "btn btn--line btn--sm" }: { cursoId: string; materias: Materia[]; materiaInicial?: string | null; rotulo?: string; variante?: string }) {
  const [aberto, setAberto] = useState(false);
  const [r, enviar, pendente] = useActionState<EstadoForm, FormData>(agendarSessao, {});
  const fundo = useRef<HTMLDivElement>(null);
  const ultimo = useRef<number | undefined>(undefined);
  const avisar = useAvisar();

  useEffect(() => {
    if (r.ok && r.em !== ultimo.current) {
      ultimo.current = r.em;
      setAberto(false);
      avisar({ texto: "Sessão marcada. Está no calendário e aparece no Hoje no dia." });
    }
  }, [r, avisar]);

  useEffect(() => {
    if (!aberto) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [aberto]);

  return (
    <>
      <button type="button" className={variante} onClick={() => setAberto(true)}><Plus aria-hidden />{rotulo}</button>
      {aberto && (
        <div className="capture" ref={fundo} role="dialog" aria-modal="true" aria-label="Marcar sessão" onMouseDown={(e) => e.target === fundo.current && setAberto(false)}>
          <div className="capture__box">
            <i className="capture__grab" aria-hidden />
            <div className="capture__head">
              <b>Marcar sessão de estudo</b>
              <button type="button" className="icon-btn" onClick={() => setAberto(false)} aria-label="Fechar"><X size={18} /></button>
            </div>
            <form action={enviar} className="detail" style={{ gap: 14 }}>
              <input type="hidden" name="course_id" value={cursoId} />
              {materias.length > 0 && (
                <label className="field">
                  Matéria
                  <select className="input" name="subject_id" defaultValue={materiaInicial ?? materias[0].id}>
                    {materias.map((m) => <option key={m.id} value={m.id}>{m.title}{m.next_topic ? ` · ${m.next_topic}` : ""}</option>)}
                    <option value="">Sem matéria</option>
                  </select>
                </label>
              )}
              <div className="fields">
                <label className="field">Dia<input className="input" type="date" name="data" defaultValue={hojeISO()} required /></label>
                <label className="field">Hora<input className="input" type="time" name="inicio" defaultValue="19:00" required /></label>
                <label className="field">
                  Duração
                  <select className="input" name="minutos" defaultValue="50">
                    {[25, 50, 60, 90, 120].map((m) => <option key={m} value={m}>{horas(m)}</option>)}
                  </select>
                </label>
              </div>
              {r.erro && <p className="note note--err" role="alert">{r.erro}</p>}
              <div className="detail__foot"><button className="btn btn--sm" type="submit" disabled={pendente}>{pendente ? "Marcando…" : "Marcar"}</button></div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

// ---------- matérias ----------

export function MaisUmaAula({ cursoId, materia }: { cursoId: string; materia: Materia | null }) {
  const [pendente, iniciar] = useTransition();
  const avisar = useAvisar();
  return (
    <button
      type="button"
      className="icon-btn"
      title={materia ? `Registrar uma aula de ${materia.title}` : "Registrar uma aula"}
      aria-label={materia ? `Registrar uma aula de ${materia.title}` : "Registrar uma aula"}
      disabled={pendente}
      onClick={() => iniciar(async () => {
        await registrarAula(cursoId, materia?.id ?? null, 1);
        avisar({ texto: materia ? `Uma aula de ${materia.title} registrada.` : "Uma aula registrada.", acao: { rotulo: "Desfazer", fazer: () => iniciar(() => registrarAula(cursoId, materia?.id ?? null, -1).then(() => undefined)) } });
      })}
    >
      <Plus size={16} />
    </button>
  );
}

export function NovaMateria({ cursoId }: { cursoId: string }) {
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
          const r = await adicionarMateria(cursoId, t);
          if (!r.ok) { setValor(t); avisar({ texto: r.erro ?? "Não foi possível adicionar." }); }
        });
      }}
    >
      <input className="input" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="Nova matéria, ex.: Métricas e análise" aria-label="Nova matéria" maxLength={120} />
      <button className="btn btn--line" type="submit" disabled={!valor.trim() || pendente}><Plus aria-hidden />Matéria</button>
    </form>
  );
}

/** Ajustar a matéria: próxima aula, total de aulas e ciclo. O botão ocupa a última coluna da linha e o formulário abre embaixo. */
export function EditarMateria({ materia, nomeCiclo }: { materia: Materia; nomeCiclo: string }) {
  const [aberto, setAberto] = useState(false);
  const [r, enviar, pendente] = useActionState<EstadoForm, FormData>(salvarMateria, {});
  const [apagando, iniciar] = useTransition();
  const ultimo = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (r.ok && r.em !== ultimo.current) { ultimo.current = r.em; setAberto(false); }
  }, [r]);
  return (
    <>
      <button type="button" className="icon-btn subj__toggle" aria-expanded={aberto} aria-label={`Ajustar ${materia.title}`} title="Ajustar" onClick={() => setAberto(!aberto)}>
        <ChevronRight size={15} aria-hidden />
      </button>
      {aberto && (
        <form action={enviar} className="detail subj__form">
          <input type="hidden" name="id" value={materia.id} />
          <div className="fields">
            <label className="field">Matéria<input className="input" name="title" defaultValue={materia.title} required maxLength={120} /></label>
            <label className="field">Próxima aula<input className="input" name="next_topic" defaultValue={materia.next_topic ?? ""} placeholder="Ex.: Pesquisa de mercado" maxLength={120} /></label>
            <div className="fields" style={{ gridTemplateColumns: "1fr 1fr" }}>
              <label className="field">Aulas<input className="input" name="total_lessons" inputMode="numeric" defaultValue={materia.total_lessons ?? ""} placeholder="Opcional" /></label>
              <label className="field">{nomeCiclo}<input className="input" name="cycle" inputMode="numeric" defaultValue={materia.cycle ?? ""} placeholder="Todos" /></label>
            </div>
          </div>
          {r.erro && <p className="note note--err" role="alert">{r.erro}</p>}
          <div className="detail__foot">
            <button className="btn btn--sm" type="submit" disabled={pendente}>{pendente ? "Guardando…" : "Guardar"}</button>
            <button type="button" className="btn btn--ghost btn--sm" style={{ marginLeft: "auto" }} disabled={apagando} onClick={() => { if (confirm(`Tirar a matéria ${materia.title}? As sessões dela continuam no calendário.`)) iniciar(() => apagarMateria(materia.id)); }}>
              <Trash2 aria-hidden />Tirar
            </button>
          </div>
        </form>
      )}
    </>
  );
}

// ---------- ciclo e curso ----------

export function AvancarCiclo({ curso }: { curso: Curso }) {
  const [pendente, iniciar] = useTransition();
  const avisar = useAvisar();
  const nome = NOME_CICLO[curso.kind].um;
  if (curso.cycles && curso.current_cycle >= curso.cycles) return null;
  return (
    <button
      type="button"
      className="btn btn--ghost btn--sm"
      style={{ justifySelf: "start" }}
      disabled={pendente}
      onClick={() => iniciar(async () => {
        const r = await avancarCiclo(curso.id, 1);
        if (r.ok && r.antes) avisar({ texto: `${nome} ${curso.current_cycle + 1} começou.`, acao: { rotulo: "Desfazer", fazer: () => iniciar(() => restaurarCiclo(curso.id, r.antes!.ciclo, r.antes!.inicio)) } });
      })}
    >
      Começar o {nome.toLowerCase()} {curso.current_cycle + 1}
    </button>
  );
}

export function FormCurso({ curso, contextos }: { curso: Curso; contextos: ContextItem[] }) {
  const [r, enviar, pendente] = useActionState<EstadoForm, FormData>(salvarCurso, {});
  const nome = NOME_CICLO[curso.kind];
  return (
    <>
      <form action={enviar} className="detail" style={{ gap: 14 }}>
        <input type="hidden" name="id" value={curso.id} />
        <label className="field">Nome<input className="input" name="title" defaultValue={curso.title} required maxLength={120} /></label>
        <label className="field">
          Tipo
          <select className="input" name="kind" defaultValue={curso.kind}>
            {(Object.keys(TIPOS_CURSO) as TipoCurso[]).map((t) => <option key={t} value={t}>{TIPOS_CURSO[t]}</option>)}
          </select>
        </label>
        <label className="field">Aulas no total<input className="input" name="total_lessons" inputMode="numeric" defaultValue={curso.total_lessons ?? ""} placeholder="Opcional" /></label>
        <label className="field">{nome.varios}<input className="input" name="cycles" inputMode="numeric" defaultValue={curso.cycles ?? ""} placeholder="Opcional" /></label>
        <label className="field">Horas por semana<input className="input" name="weekly_hours" inputMode="decimal" defaultValue={curso.weekly_minutes ? String(curso.weekly_minutes / 60).replace(".", ",") : ""} /></label>
        <label className="field">Próxima prova ou entrega<input className="input" type="date" name="exam_date" defaultValue={curso.exam_date ?? ""} /></label>
        <label className="field">Chamar de<input className="input" name="exam_label" defaultValue={curso.exam_label ?? ""} placeholder="prova do módulo" maxLength={60} /></label>
        <label className="field">
          Contexto
          <select className="input" name="context_id" defaultValue={curso.context_id ?? ""}>
            <option value="">Sem contexto</option>
            {contextos.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label className="field">
          Estado
          <select className="input" name="status" defaultValue={curso.status}>
            <option value="ativo">Em andamento</option>
            <option value="pausado">Pausado</option>
            <option value="concluido">Concluído</option>
          </select>
        </label>
        <label className="field">Nota<textarea className="input input--area" name="note" defaultValue={curso.note ?? ""} rows={3} placeholder="Por que este curso importa" /></label>
        {r.erro && <p className="note note--err" role="alert">{r.erro}</p>}
        <div className="detail__foot">
          <button className="btn btn--sm" type="submit" disabled={pendente}>{pendente ? "Guardando…" : "Guardar"}</button>
          {r.ok && <span className="detail__status" role="status">Guardado.</span>}
        </div>
      </form>
      <form action={apagarCurso} className="detail__danger" onSubmit={(e) => { if (!confirm("Apagar este curso? As matérias e as sessões dele saem junto.")) e.preventDefault(); }}>
        <input type="hidden" name="id" value={curso.id} />
        <button type="submit" className="btn btn--ghost btn--sm"><Trash2 aria-hidden />Apagar curso</button>
      </form>
    </>
  );
}

