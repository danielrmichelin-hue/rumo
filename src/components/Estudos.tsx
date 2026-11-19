"use client";

import { useActionState, useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Check, ChevronRight, Clock, PenLine, Play, Plus, Trash2, X } from "lucide-react";
import {
  adicionarMateria, adicionarTemas, agendarSessao, apagarCurso, apagarMateria, apagarSessao, apagarTema, avancarCiclo, comecarSessao,
  comecarSessaoMarcada, concluirSessao, criarCurso, marcarTema, moverMateria, registrarAula, registrarEstudo, restaurarCiclo, restaurarSessao,
  salvarCurso, salvarMateria, type EstadoForm,
} from "@/app/(app)/acoes";
import { hojeISO } from "@/lib/datas";
import { emAndamento, horas, quandoSessao, TIPOS_CURSO, type Curso, type LinhaCiclo, type Materia, type Sessao, type Tema, type TipoCurso } from "@/lib/estudos";
import { useAvisar } from "./Avisos";
import { AdicionarRapido, CampoContexto, Painel } from "./Comuns";
import { Logo } from "./Logo";
import type { ContextItem } from "./Shell";

const DURACOES = [25, 50, 60, 90, 120];

// ---------- novo estudo ----------

const PADRAO: Record<TipoCurso, { titulo: string; horas: string; prova: string; materias: { title: string; h: string }[] }> = {
  concurso: { titulo: "Concurso ", horas: "15", prova: "prova", materias: [{ title: "Português", h: "4" }, { title: "Raciocínio lógico", h: "3" }, { title: "Direito constitucional", h: "3" }, { title: "Direito administrativo", h: "3" }] },
  graduacao: { titulo: "", horas: "10", prova: "prova", materias: [] },
  pos: { titulo: "Pós em ", horas: "6", prova: "entrega do módulo", materias: [] },
  idioma: { titulo: "Inglês", horas: "3", prova: "prova de nível", materias: [{ title: "Conversação", h: "1" }, { title: "Gramática", h: "1" }, { title: "Vocabulário", h: "1" }] },
  curso: { titulo: "", horas: "3", prova: "entrega final", materias: [] },
};

const hParaMin = (h: string) => {
  const n = Number(h.replace(",", "."));
  return n > 0 ? Math.round(n * 60) : null;
};

export function NovoCurso({ contextos, tipoInicial, sugeridos }: { contextos: ContextItem[]; tipoInicial: TipoCurso | null; sugeridos: TipoCurso[] }) {
  const router = useRouter();
  const inicial = tipoInicial ? PADRAO[tipoInicial] : null;
  const [tipo, setTipo] = useState<TipoCurso | null>(tipoInicial);
  const [titulo, setTitulo] = useState(inicial?.titulo ?? "");
  const [horasSemana, setHorasSemana] = useState(inicial?.horas ?? "");
  const [prova, setProva] = useState("");
  const [rotuloProva, setRotuloProva] = useState(inicial?.prova ?? "prova");
  const [materias, setMaterias] = useState(inicial?.materias ?? []);
  const [contexto, setContexto] = useState(contextos.find((c) => /estud|pós|pos|faculdade|concurso/i.test(c.name))?.id ?? "");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, iniciar] = useTransition();

  function escolher(t: TipoCurso) {
    const d = PADRAO[t];
    setTipo(t);
    if (!titulo.trim() || Object.values(PADRAO).some((x) => x.titulo === titulo)) setTitulo(d.titulo);
    setHorasSemana(d.horas);
    setRotuloProva(d.prova);
    if (!materias.length || Object.values(PADRAO).some((x) => x.materias === materias)) setMaterias(d.materias);
  }

  const totalCiclo = materias.reduce((t, m) => t + (hParaMin(m.h) ?? 0), 0);
  const mudar = (i: number, campo: "title" | "h", v: string) => setMaterias(materias.map((m, k) => (k === i ? { ...m, [campo]: v } : m)));

  function criar(e: React.FormEvent) {
    e.preventDefault();
    if (!tipo) return setErro("Escolha o que você estuda.");
    setErro(null);
    iniciar(async () => {
      const r = await criarCurso({
        title: titulo,
        kind: tipo,
        context_id: contexto || null,
        weekly_minutes: hParaMin(horasSemana),
        exam_date: prova || null,
        exam_label: rotuloProva,
        materias: materias.map((m) => ({ title: m.title, minutos: hParaMin(m.h) })),
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
            <input className="input" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Concurso TRT, Pós em Marketing" required maxLength={120} autoFocus />
          </label>

          <div className="field">
            <span>Matérias do ciclo <span className="field__hint" style={{ fontWeight: 400 }}>· na ordem em que você vai estudar, com as horas de cada uma por ciclo</span></span>
            <div className="cycle-edit">
              {materias.map((m, i) => (
                <div key={i} className="cycle-edit__row">
                  <span className="cycle-edit__n">{i + 1}</span>
                  <input className="input" value={m.title} onChange={(e) => mudar(i, "title", e.target.value)} placeholder="Matéria" aria-label={`Matéria ${i + 1}`} maxLength={120} />
                  <label className="cycle-edit__h">
                    <input className="input" inputMode="decimal" value={m.h} onChange={(e) => mudar(i, "h", e.target.value)} aria-label={`Horas de ${m.title || `matéria ${i + 1}`} no ciclo`} />
                    <span>h</span>
                  </label>
                  <button type="button" className="icon-btn" aria-label={`Tirar ${m.title || "matéria"}`} onClick={() => setMaterias(materias.filter((_, k) => k !== i))}><X size={15} /></button>
                </div>
              ))}
              <button type="button" className="btn btn--ghost btn--sm" style={{ justifySelf: "start" }} onClick={() => setMaterias([...materias, { title: "", h: "2" }])}><Plus aria-hidden />Matéria</button>
            </div>
            <span className="field__hint">{totalCiclo ? `Um ciclo tem ${horas(totalCiclo)}. Quando todas as matérias chegam nas horas, começa o próximo.` : "Os temas de cada matéria (o conteúdo do edital ou da ementa) entram depois, na matéria."}</span>
          </div>

          <div className="fields">
            <label className="field">Horas por semana<input className="input" inputMode="decimal" value={horasSemana} onChange={(e) => setHorasSemana(e.target.value)} placeholder="Ex.: 15" /></label>
            <label className="field">Prova ou entrega<input className="input" type="date" value={prova} min={hojeISO()} onChange={(e) => setProva(e.target.value)} /></label>
            <label className="field">Chamar de<input className="input" value={rotuloProva} onChange={(e) => setRotuloProva(e.target.value)} maxLength={60} /></label>
          </div>
          <CampoContexto contextos={contextos} value={contexto} onChange={setContexto} />

          {erro && <p className="note note--err" role="alert">{erro}</p>}
          <div><button className="btn" type="submit" disabled={salvando || !titulo.trim()}>{salvando ? "Criando…" : "Criar e começar o ciclo 1"}</button></div>
        </>
      )}
    </form>
  );
}

// ---------- o que estudar agora ----------

/** O único destaque da tela: a sessão acontecendo, a próxima marcada ou a matéria da vez no ciclo */
export function AgoraNoEstudo({ curso, sessao, materia, tema, falta }: { curso: Curso; sessao: Sessao | null; materia: Materia | null; tema: Tema | null; falta: number | null }) {
  const [pendente, iniciar] = useTransition();
  const avisar = useAvisar();
  const [agora, setAgora] = useState<Date | null>(null);
  const [temaFeito, setTemaFeito] = useState(false);
  useEffect(() => {
    setAgora(new Date());
    const t = setInterval(() => setAgora(new Date()), 30000);
    return () => clearInterval(t);
  }, []);
  const rodando = sessao && agora ? emAndamento(sessao, agora) : false;
  const minutos = rodando && agora ? Math.max(0, Math.round((agora.getTime() - new Date(sessao!.starts_at).getTime()) / 60000)) : 0;

  let rotulo = "Agora no ciclo";
  let titulo = materia ? `${materia.title}${tema ? ` · ${tema.title}` : ""}` : "Escolha a primeira matéria";
  let linha = materia ? (falta ? `Faltam ${horas(falta)} dela neste ciclo` : "Sem horas definidas para o ciclo") : "Adicione as matérias do ciclo abaixo.";
  if (sessao) {
    rotulo = rodando ? "Estudando agora" : "Próxima sessão";
    titulo = sessao.title;
    linha = rodando ? `${horas(Math.max(1, minutos))} até agora · ${quandoSessao(sessao, agora!)}` : quandoSessao(sessao, agora ?? undefined);
  }

  return (
    <section className="next" aria-label={rotulo}>
      <div>
        <span className="next__k"><Logo forma="simbolo" />{rotulo}</span>
        <span className="next__t">{titulo}</span>
        <span className="props"><span className="prop"><Clock aria-hidden />{linha}</span></span>
        {rodando && sessao?.topic_id && (
          <label className="check-line" style={{ marginTop: 10 }}><input type="checkbox" checked={temaFeito} onChange={(e) => setTemaFeito(e.target.checked)} />Terminei este tema</label>
        )}
      </div>
      <div className="next__act">
        {sessao && rodando ? (
          <button
            type="button"
            className="btn"
            disabled={pendente}
            onClick={() => iniciar(async () => {
              const r = await concluirSessao(sessao.id, true, temaFeito);
              avisar({ texto: "Sessão concluída. O tempo já conta no ciclo.", acao: { rotulo: "Desfazer", fazer: () => iniciar(() => concluirSessao(sessao.id, false, false, r.fimAntes).then(() => undefined)) } });
            })}
          >
            <Check aria-hidden />Concluir
          </button>
        ) : sessao ? (
          <button
            type="button"
            className="btn"
            disabled={pendente}
            onClick={() => iniciar(async () => {
              const r = await comecarSessaoMarcada(sessao.id);
              if (r.ok && r.antes) avisar({ texto: "Sessão começou agora.", acao: { rotulo: "Desfazer", fazer: () => iniciar(() => restaurarSessao(sessao.id, r.antes!.starts_at, r.antes!.ends_at)) } });
            })}
          >
            <Play aria-hidden />Começar agora
          </button>
        ) : materia ? (
          <ComecarSessao cursoId={curso.id} materia={materia} tema={tema} rotulo="Começar" />
        ) : null}
      </div>
    </section>
  );
}

export function ComecarSessao({ cursoId, materia, tema = null, rotulo = "Começar sessão", variante = "btn" }: { cursoId: string; materia: Materia | null; tema?: Tema | null; rotulo?: string; variante?: string }) {
  const [pendente, iniciar] = useTransition();
  const avisar = useAvisar();
  return (
    <button
      type="button"
      className={variante}
      disabled={pendente}
      onClick={() => iniciar(async () => {
        const r = await comecarSessao(cursoId, materia?.id ?? null, tema?.id ?? null);
        if (r.ok) avisar({ texto: `Sessão começou${materia ? `: ${materia.title}` : ""}. Bom estudo.`, acao: { rotulo: "Desfazer", fazer: () => iniciar(() => apagarSessao(r.id!)) } });
      })}
    >
      <Play aria-hidden />{rotulo}
    </button>
  );
}

// ---------- registrar e marcar sessões ----------

/** Campos de matéria e tema que andam juntos: o tema muda com a matéria */
function CamposMateriaTema({ materias, temas, materiaInicial, temaInicial, aoTrocarTema }: { materias: Materia[]; temas: Tema[]; materiaInicial?: string | null; temaInicial?: string | null; aoTrocarTema?: (id: string) => void }) {
  const [materia, setMateria] = useState(materiaInicial ?? materias[0]?.id ?? "");
  const abertos = temas.filter((t) => t.subject_id === materia && !t.done_at).sort((a, b) => a.position - b.position);
  const [tema, setTema] = useState(temaInicial && abertos.some((t) => t.id === temaInicial) ? temaInicial : abertos[0]?.id ?? "");
  useEffect(() => { aoTrocarTema?.(tema); }, [tema, aoTrocarTema]);
  if (!materias.length) return null;
  return (
    <div className="fields" style={{ gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)" }}>
      <label className="field">
        Matéria
        <select className="input" name="subject_id" value={materia} onChange={(e) => { setMateria(e.target.value); setTema(temas.find((t) => t.subject_id === e.target.value && !t.done_at)?.id ?? ""); }}>
          {materias.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
          <option value="">Sem matéria</option>
        </select>
      </label>
      <label className="field">
        Tema
        <select className="input" name="topic_id" value={tema} onChange={(e) => setTema(e.target.value)} disabled={!abertos.length}>
          {abertos.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
          <option value="">{abertos.length ? "Sem tema" : "Nenhum tema em aberto"}</option>
        </select>
      </label>
    </div>
  );
}

function CampoDuracao({ padrao = 50 }: { padrao?: number }) {
  const [min, setMin] = useState(padrao);
  return (
    <div className="field">
      Duração
      <input type="hidden" name="minutos" value={min} />
      <div className="chips" role="group" aria-label="Duração">
        {DURACOES.map((m) => <button key={m} type="button" className="chip" aria-pressed={min === m} onClick={() => setMin(m)}>{horas(m)}</button>)}
        <label className="cycle-edit__h" style={{ width: 96 }}>
          <input className="input" inputMode="numeric" aria-label="Outra duração em minutos" value={DURACOES.includes(min) ? "" : String(min)} placeholder="outra" onChange={(e) => setMin(Math.max(5, Number(e.target.value.replace(/\D/g, "")) || 5))} />
          <span>min</span>
        </label>
      </div>
    </div>
  );
}

/** Painel com formulário que fecha e avisa quando a ação dá certo */
function PainelSessao({ titulo, rotulo, variante, icone, acao, aviso, children }: {
  titulo: string; rotulo: string; variante: string; icone: React.ReactNode;
  acao: (s: EstadoForm, f: FormData) => Promise<EstadoForm>; aviso: string; children: (pendente: boolean, erro?: string) => React.ReactNode;
}) {
  const [aberto, setAberto] = useState(false);
  const [r, enviar, pendente] = useActionState<EstadoForm, FormData>(acao, {});
  const ultimo = useRef<number | undefined>(undefined);
  const avisar = useAvisar();
  useEffect(() => {
    if (r.ok && r.em !== ultimo.current) {
      ultimo.current = r.em;
      setAberto(false);
      avisar({ texto: aviso });
    }
  }, [r, avisar, aviso]);
  return (
    <>
      <button type="button" className={variante} onClick={() => setAberto(true)}>{icone}{rotulo}</button>
      {aberto && (
        <Painel titulo={titulo} fechar={() => setAberto(false)}>
          <form action={enviar} className="detail" style={{ gap: 14 }}>{children(pendente, r.erro)}</form>
        </Painel>
      )}
    </>
  );
}

/** Registrar estudo que já aconteceu, sem cronômetro */
export function RegistrarEstudo({ cursoId, materias, temas, materiaInicial, variante = "btn btn--line" }: { cursoId: string; materias: Materia[]; temas: Tema[]; materiaInicial?: string | null; variante?: string }) {
  const [temOTema, setTemOTema] = useState(false);
  const aoTrocarTema = useCallback((t: string) => setTemOTema(!!t), []);
  return (
    <PainelSessao titulo="Registrar estudo" rotulo="Registrar estudo" variante={variante} icone={<PenLine aria-hidden />} acao={registrarEstudo} aviso="Estudo registrado. Já conta no ciclo e na semana.">
      {(pendente, erro) => (
        <>
          <input type="hidden" name="course_id" value={cursoId} />
          <CamposMateriaTema materias={materias} temas={temas} materiaInicial={materiaInicial} aoTrocarTema={aoTrocarTema} />
          <CampoDuracao />
          <div className="fields" style={{ gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)" }}>
            <label className="field">Dia<input className="input" type="date" name="data" defaultValue={hojeISO()} max={hojeISO()} required /></label>
            <label className="field">Começou às<input className="input" type="time" name="inicio" /><span className="field__hint">Opcional</span></label>
          </div>
          {temOTema && <label className="check-line"><input type="checkbox" name="tema_feito" value="1" />Terminei este tema</label>}
          {erro && <p className="note note--err" role="alert">{erro}</p>}
          <div className="detail__foot"><button className="btn btn--sm" type="submit" disabled={pendente}>{pendente ? "Registrando…" : "Registrar"}</button></div>
        </>
      )}
    </PainelSessao>
  );
}

/** Marcar uma sessão no calendário (vira compromisso e aparece no Hoje) */
export function MarcarSessao({ cursoId, materias, temas, materiaInicial, rotulo = "Marcar sessão", variante = "btn btn--line btn--sm" }: { cursoId: string; materias: Materia[]; temas: Tema[]; materiaInicial?: string | null; rotulo?: string; variante?: string }) {
  return (
    <PainelSessao titulo="Marcar sessão de estudo" rotulo={rotulo} variante={variante} icone={<Plus aria-hidden />} acao={agendarSessao} aviso="Sessão marcada. Está no calendário e aparece no Hoje no dia.">
      {(pendente, erro) => (
        <>
          <input type="hidden" name="course_id" value={cursoId} />
          <CamposMateriaTema materias={materias} temas={temas} materiaInicial={materiaInicial} />
          <div className="fields" style={{ gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)" }}>
            <label className="field">Dia<input className="input" type="date" name="data" defaultValue={hojeISO()} min={hojeISO()} required /></label>
            <label className="field">Hora<input className="input" type="time" name="inicio" defaultValue="19:00" required /></label>
          </div>
          <CampoDuracao />
          {erro && <p className="note note--err" role="alert">{erro}</p>}
          <div className="detail__foot"><button className="btn btn--sm" type="submit" disabled={pendente}>{pendente ? "Marcando…" : "Marcar"}</button></div>
        </>
      )}
    </PainelSessao>
  );
}

/** Sessão marcada que passou sem ser concluída: pergunta se aconteceu, sem cobrar */
export function ConfirmarSessao({ sessao }: { sessao: Sessao }) {
  const [pendente, iniciar] = useTransition();
  return (
    <li className="confirm">
      <span><b>{sessao.title}</b><small>{quandoSessao(sessao)} · Estudou?</small></span>
      <span className="confirm__act">
        <button type="button" className="btn btn--line btn--sm" disabled={pendente} onClick={() => iniciar(async () => { await concluirSessao(sessao.id, true); })}>Estudei</button>
        <button type="button" className="btn btn--ghost btn--sm" disabled={pendente} onClick={() => iniciar(() => apagarSessao(sessao.id))}>Não deu</button>
      </span>
    </li>
  );
}

// ---------- o ciclo: matérias e temas ----------

export function LinhaMateria({ linha, temas, primeira, ultima, daVez }: { linha: LinhaCiclo; temas: Tema[]; primeira: boolean; ultima: boolean; daVez: boolean }) {
  const m = linha.materia;
  const [aberto, setAberto] = useState(false);
  const [editando, setEditando] = useState(false);
  const [nome, setNome] = useState(m.title);
  const [h, setH] = useState(m.cycle_minutes ? String(m.cycle_minutes / 60).replace(".", ",") : "");
  const [pendente, iniciar] = useTransition();
  const avisar = useAvisar();
  const lista = temas.filter((t) => t.subject_id === m.id).sort((a, b) => a.position - b.position);
  const feitos = lista.filter((t) => t.done_at).length;
  const proximo = lista.find((t) => !t.done_at);

  return (
    <li className={`subj${daVez ? " subj--now" : ""}${linha.completa ? " subj--done" : ""}`} id={m.id}>
      <button type="button" className="subj__main" aria-expanded={aberto} onClick={() => setAberto(!aberto)}>
        <i className="dot" style={{ background: m.color }} />
        <span className="subj__name">
          <b>{m.title}</b>
          <small>
            {linha.completa ? "Horas do ciclo completas" : daVez ? "A vez dela no ciclo" : ""}
            {(linha.completa || daVez) && lista.length > 0 ? " · " : ""}
            {lista.length ? `${feitos} de ${lista.length} temas${proximo ? ` · próximo: ${proximo.title}` : ""}` : !linha.completa && !daVez ? "Sem temas ainda" : ""}
          </small>
        </span>
        <span className="subj__time">
          {linha.meta ? <span className="bar2" aria-hidden><i style={{ width: `${linha.pct * 100}%`, background: m.color }} /></span> : null}
          <em>{linha.meta ? `${horas(linha.feito)} de ${horas(linha.meta)}` : horas(linha.feito)}</em>
        </span>
        {linha.completa ? <Check className="subj__ok" aria-label="Completa" /> : <ChevronRight className="subj__chev" aria-hidden />}
      </button>

      {aberto && (
        <div className="subj__body">
          <ul className="topics" aria-label={`Temas de ${m.title}`}>
            {lista.map((t) => (
              <li key={t.id} className={t.done_at ? "is-done" : undefined}>
                <button type="button" role="checkbox" aria-checked={!!t.done_at} aria-label={`${t.done_at ? "Reabrir" : "Concluir"} tema: ${t.title}`} className="check" onClick={() => iniciar(() => marcarTema(t.id, !t.done_at))}>
                  {t.done_at && <Check aria-hidden />}
                </button>
                <span>{t.title}</span>
                <button type="button" className="icon-btn topics__del" aria-label={`Apagar tema ${t.title}`} onClick={() => iniciar(() => apagarTema(t.id))}><X size={14} /></button>
              </li>
            ))}
          </ul>
          <NovosTemas materia={m} vazio={!lista.length} />

          {editando ? (
            <form
              className="subj__edit"
              onSubmit={(e) => {
                e.preventDefault();
                iniciar(async () => {
                  const r = await salvarMateria(m.id, nome, hParaMin(h));
                  if (!r.ok) return avisar({ texto: r.erro ?? "Não foi possível salvar." });
                  setEditando(false);
                });
              }}
            >
              <input className="input" value={nome} onChange={(e) => setNome(e.target.value)} aria-label="Nome da matéria" maxLength={120} />
              <label className="cycle-edit__h"><input className="input" inputMode="decimal" value={h} onChange={(e) => setH(e.target.value)} aria-label="Horas no ciclo" /><span>h</span></label>
              <button className="btn btn--sm" type="submit" disabled={pendente}>Guardar</button>
            </form>
          ) : (
            <div className="subj__tools">
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setEditando(true)}>Nome e horas</button>
              <button type="button" className="icon-btn" aria-label="Subir no ciclo" disabled={primeira || pendente} onClick={() => iniciar(() => moverMateria(m.id, -1))}><ArrowUp size={15} /></button>
              <button type="button" className="icon-btn" aria-label="Descer no ciclo" disabled={ultima || pendente} onClick={() => iniciar(() => moverMateria(m.id, 1))}><ArrowDown size={15} /></button>
              <button type="button" className="btn btn--ghost btn--sm" style={{ marginLeft: "auto" }} disabled={pendente} onClick={() => { if (confirm(`Tirar ${m.title} do ciclo? Os temas dela saem junto; as sessões continuam no calendário.`)) iniciar(() => apagarMateria(m.id)); }}>
                <Trash2 aria-hidden />Tirar
              </button>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

/** Temas colados de uma vez, um por linha (como no edital) */
function NovosTemas({ materia, vazio }: { materia: Materia; vazio: boolean }) {
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
          const r = await adicionarTemas(materia.id, t);
          if (!r.ok) return avisar({ texto: r.erro ?? "Não foi possível guardar." });
          setValor("");
          avisar({ texto: r.n === 1 ? "Tema adicionado." : `${r.n} temas adicionados.` });
        });
      }}
    >
      <textarea
        className="input input--area"
        rows={vazio ? 3 : 1}
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !valor.includes("\n")) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }}
        placeholder={vazio ? "Cole os temas, um por linha (pode colar a lista do edital)" : "Novo tema"}
        aria-label={`Novos temas de ${materia.title}`}
      />
      <button className="btn btn--line btn--sm" type="submit" disabled={!valor.trim() || pendente}><Plus aria-hidden />Temas</button>
    </form>
  );
}

export function NovaMateria({ cursoId }: { cursoId: string }) {
  return <AdicionarRapido acao={(t) => adicionarMateria(cursoId, t)} placeholder="Nova matéria e horas no ciclo, ex.: Informática 2h" rotulo="Nova matéria" botao="Matéria" maxLength={130} />;
}

export function AvancarCiclo({ curso, completo }: { curso: Curso; completo: boolean }) {
  const [pendente, iniciar] = useTransition();
  const avisar = useAvisar();
  return (
    <button
      type="button"
      className={completo ? "btn btn--sm" : "btn btn--ghost btn--sm"}
      disabled={pendente}
      onClick={() => iniciar(async () => {
        if (!completo && !confirm(`Fechar o ciclo ${curso.current_cycle} agora? As horas das matérias voltam a zero; os temas continuam.`)) return;
        const r = await avancarCiclo(curso.id);
        if (r.ok && r.antes) avisar({ texto: `Ciclo ${curso.current_cycle + 1} começou.`, acao: { rotulo: "Desfazer", fazer: () => iniciar(() => restaurarCiclo(curso.id, r.antes!.ciclo, r.antes!.inicio)) } });
      })}
    >
      {completo ? `Começar o ciclo ${curso.current_cycle + 1}` : "Fechar o ciclo agora"}
    </button>
  );
}

export function MaisUmaAula({ cursoId }: { cursoId: string }) {
  const [pendente, iniciar] = useTransition();
  const avisar = useAvisar();
  return (
    <button
      type="button"
      className="btn btn--ghost btn--sm"
      disabled={pendente}
      onClick={() => iniciar(async () => {
        await registrarAula(cursoId, 1);
        avisar({ texto: "Uma aula registrada.", acao: { rotulo: "Desfazer", fazer: () => iniciar(() => registrarAula(cursoId, -1).then(() => undefined)) } });
      })}
    >
      <Plus aria-hidden />1 aula
    </button>
  );
}

export function FormCurso({ curso, contextos }: { curso: Curso; contextos: ContextItem[] }) {
  const [r, enviar, pendente] = useActionState<EstadoForm, FormData>(salvarCurso, {});
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
        <label className="field">Horas por semana<input className="input" name="weekly_hours" inputMode="decimal" defaultValue={curso.weekly_minutes ? String(curso.weekly_minutes / 60).replace(".", ",") : ""} /></label>
        <label className="field">Prova ou entrega<input className="input" type="date" name="exam_date" defaultValue={curso.exam_date ?? ""} /></label>
        <label className="field">Chamar de<input className="input" name="exam_label" defaultValue={curso.exam_label ?? ""} placeholder="prova" maxLength={60} /></label>
        <div className="fields" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <label className="field">Aulas no total<input className="input" name="total_lessons" inputMode="numeric" defaultValue={curso.total_lessons ?? ""} placeholder="Opcional" /></label>
          <label className="field">Já assistidas<input className="input" name="done_lessons" inputMode="numeric" defaultValue={curso.done_lessons || ""} placeholder="0" /></label>
        </div>
        <CampoContexto contextos={contextos} name="context_id" defaultValue={curso.context_id} />
        <label className="field">
          Estado
          <select className="input" name="status" defaultValue={curso.status}>
            <option value="ativo">Em andamento</option>
            <option value="pausado">Pausado</option>
            <option value="concluido">Concluído</option>
          </select>
        </label>
        <label className="field">Nota<textarea className="input input--area" name="note" defaultValue={curso.note ?? ""} rows={3} placeholder="Por que este estudo importa" /></label>
        {r.erro && <p className="note note--err" role="alert">{r.erro}</p>}
        <div className="detail__foot">
          <button className="btn btn--sm" type="submit" disabled={pendente}>{pendente ? "Guardando…" : "Guardar"}</button>
          {r.ok && <span className="detail__status" role="status">Guardado.</span>}
        </div>
      </form>
      <form action={apagarCurso} className="detail__danger" onSubmit={(e) => { if (!confirm("Apagar este estudo? As matérias, os temas e as sessões saem junto.")) e.preventDefault(); }}>
        <input type="hidden" name="id" value={curso.id} />
        <button type="submit" className="btn btn--ghost btn--sm"><Trash2 aria-hidden />Apagar estudo</button>
      </form>
    </>
  );
}
