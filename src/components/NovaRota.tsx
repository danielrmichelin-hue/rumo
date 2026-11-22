"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Route, X } from "lucide-react";
import { criarRota } from "@/app/(app)/acoes";
import { hojeISO, numeroBR } from "@/lib/datas";
import { brl, chegadaPorPrazo, ICONES_ROTA, resumirRota, TIPOS, type Marco, type Rota, type TipoRota } from "@/lib/rotas";
import { Caminho } from "./Caminho";
import { CampoContexto } from "./Comuns";
import type { ContextItem } from "./Shell";

const MARCOS_SUGERIDOS = ["Orçamento", "Imóvel", "Contratação", "Documentação", "Implantação", "Lançamento"];

const PADRAO: Record<Exclude<TipoRota, "negocios">, { alvo: number; tem: number; prazo: number; rotulos: [string, string, string]; unidadePrazo: string; passo: number }> = {
  financeiro: { alvo: 5000, tem: 0, prazo: 8, rotulos: ["Quanto quer juntar", "Quanto já tem", "Prazo"], unidadePrazo: "meses", passo: 100 },
  leitura: { alvo: 320, tem: 0, prazo: 30, rotulos: ["Páginas do livro", "Já leu", "Terminar em"], unidadePrazo: "dias", passo: 10 },
  estudos: { alvo: 60, tem: 0, prazo: 10, rotulos: ["Aulas do curso", "Já concluiu", "Terminar em"], unidadePrazo: "semanas", passo: 1 },
};

/** Valores de partida de cada tipo, também quando a tela já abre com um tipo escolhido */
function padroesDo(t: TipoRota | null) {
  const vazio = { alvo: "", tem: "", prazo: "", chegada: "", marcos: [] as string[] };
  if (!t) return vazio;
  if (t === "negocios") {
    const daqui = new Date();
    daqui.setUTCMonth(daqui.getUTCMonth() + 8);
    return { ...vazio, chegada: daqui.toISOString().slice(0, 7), marcos: MARCOS_SUGERIDOS.slice(0, 3) };
  }
  const p = PADRAO[t];
  return { ...vazio, alvo: String(p.alvo), tem: String(p.tem), prazo: String(p.prazo) };
}

/** Curso ligado (módulo Estudos): a Rota de estudos parte das aulas do curso; a de leitura fica no curso */
export type CursoDaRota = { id: string; title: string; context_id: string | null; total_lessons: number | null; done_lessons: number };

export function NovaRota({ contextos, tipoInicial, tituloInicial, curso }: { contextos: ContextItem[]; tipoInicial: TipoRota | null; tituloInicial?: string; curso?: CursoDaRota | null }) {
  const router = useRouter();
  const [tipo, setTipo] = useState<TipoRota | null>(tipoInicial);
  const tituloDoCurso = curso && tipoInicial === "estudos" ? `Concluir ${curso.title}` : undefined;
  const [titulo, setTitulo] = useState(tituloInicial ?? tituloDoCurso ?? "");
  const [tituloMexido, setTituloMexido] = useState(!!(tituloInicial ?? tituloDoCurso));
  const inicial = padroesDo(tipoInicial);
  if (curso && tipoInicial === "estudos") {
    if (curso.total_lessons) inicial.alvo = String(curso.total_lessons);
    inicial.tem = String(curso.done_lessons);
  }
  const [alvo, setAlvo] = useState(inicial.alvo);
  const [tem, setTem] = useState(inicial.tem);
  const [prazo, setPrazo] = useState(inicial.prazo);
  const [chegada, setChegada] = useState(inicial.chegada); // AAAA-MM (negócios)
  const [marcos, setMarcos] = useState<string[]>(inicial.marcos);
  const [novoMarco, setNovoMarco] = useState("");
  const [contexto, setContexto] = useState(curso?.context_id ?? "");
  const [passoNoHoje, setPassoNoHoje] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, iniciar] = useTransition();
  const hoje = hojeISO();

  function escolher(t: TipoRota) {
    setTipo(t);
    setErro(null);
    const d = padroesDo(t);
    setAlvo(d.alvo);
    setTem(d.tem);
    setPrazo(d.prazo);
    setChegada(d.chegada);
    setMarcos(d.marcos);
  }

  // Título sugerido enquanto a pessoa não escreve o dela
  const tituloSugerido = !tipo ? "" : tipo === "financeiro" ? `Reserva de ${brl(numeroBR(alvo) || 0)}` : tipo === "leitura" ? "Terminar o livro" : tipo === "estudos" ? `Concluir o curso de ${numeroBR(alvo) || 0} aulas` : "Abrir a segunda unidade";
  const nomeFinal = tituloMexido ? titulo : tituloSugerido;

  // Prévia ao vivo, com o mesmo cálculo da Rota de verdade
  const previa = useMemo(() => {
    if (!tipo) return null;
    const target_date = tipo === "negocios" ? (chegada ? `${chegada}-28` : null) : numeroBR(prazo) > 0 ? chegadaPorPrazo(tipo, numeroBR(prazo), hoje) : null;
    const rota: Rota = {
      id: "previa", title: nomeFinal || "Destino", kind: tipo, context_id: null,
      target: tipo === "negocios" ? null : numeroBR(alvo) || null, current: numeroBR(tem), start_value: numeroBR(tem),
      start_date: hoje, target_date, status: "ativa", note: null,
    };
    const ms: Marco[] = marcos.map((m, i) => ({ id: String(i), route_id: "previa", title: m, position: i, due_date: null, done_at: null }));
    return { rota, resumo: resumirRota(rota, ms, hoje) };
  }, [tipo, alvo, tem, prazo, chegada, marcos, nomeFinal, hoje]);

  function criar() {
    if (!tipo) return;
    setErro(null);
    iniciar(async () => {
      const r = await criarRota({
        kind: tipo, title: nomeFinal, context_id: contexto || null,
        target: tipo === "negocios" ? null : numeroBR(alvo), current: numeroBR(tem),
        prazo: tipo === "negocios" ? null : numeroBR(prazo),
        target_date: tipo === "negocios" && chegada ? `${chegada}-28` : null,
        marcos, passoNoHoje, course_id: curso?.id ?? null,
      });
      if (!r.ok || !r.id) { setErro(r.erro ?? "Não foi possível criar a Rota."); return; }
      router.push(curso ? `/estudos/${curso.id}` : `/rotas/${r.id}`);
      router.refresh();
    });
  }

  if (!tipo) {
    return (
      <div className="opts" style={{ maxWidth: 720 }}>
        {(Object.keys(TIPOS) as TipoRota[]).map((t) => {
          const Icon = ICONES_ROTA[t];
          return (
            <button key={t} type="button" className="opt" onClick={() => escolher(t)}>
              <Icon aria-hidden />{TIPOS[t].nome} · {TIPOS[t].exemplo}
            </button>
          );
        })}
      </div>
    );
  }

  const p = tipo !== "negocios" ? PADRAO[tipo] : null;
  const Icon = ICONES_ROTA[tipo];

  return (
    <div className="sim">
      <form className="sim__form" onSubmit={(e) => { e.preventDefault(); criar(); }}>
        <div className="seg" role="radiogroup" aria-label="Tipo de Rota" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)" }}>
          {(Object.keys(TIPOS) as TipoRota[]).map((t) => (
            <label key={t}>
              <input type="radio" name="tipo" checked={tipo === t} onChange={() => escolher(t)} />
              <span style={{ padding: "0 6px", fontSize: 13 }}>{TIPOS[t].nome}</span>
            </label>
          ))}
        </div>

        <label className="field">
          Destino
          <input className="input" value={nomeFinal} onChange={(e) => { setTitulo(e.target.value); setTituloMexido(true); }} maxLength={120} placeholder={TIPOS[tipo].exemplo} />
        </label>

        {p && (
          <>
            <label className="field">
              {p.rotulos[0]}
              <input className="input" inputMode="decimal" value={alvo} onChange={(e) => setAlvo(e.target.value)} />
            </label>
            <label className="field">
              {p.rotulos[1]}
              <input className="input" inputMode="decimal" value={tem} onChange={(e) => setTem(e.target.value)} />
            </label>
            <label className="field">
              {p.rotulos[2]} ({p.unidadePrazo})
              <input className="input" inputMode="numeric" value={prazo} onChange={(e) => setPrazo(e.target.value)} />
            </label>
          </>
        )}

        {tipo === "negocios" && (
          <>
            <label className="field">
              Quando quer chegar
              <input className="input" type="month" value={chegada} onChange={(e) => setChegada(e.target.value)} />
            </label>
            <div className="field">
              <span>Marcos, na ordem</span>
              <div className="chips">
                {marcos.map((m) => (
                  <button key={m} type="button" className="chip" aria-pressed onClick={() => setMarcos(marcos.filter((x) => x !== m))} title="Tirar">{m}<X aria-hidden /></button>
                ))}
                {MARCOS_SUGERIDOS.filter((m) => !marcos.includes(m)).map((m) => (
                  <button key={m} type="button" className="chip" onClick={() => setMarcos([...marcos, m])}><Plus aria-hidden />{m}</button>
                ))}
              </div>
              <div className="ask__add">
                <input className="input" value={novoMarco} onChange={(e) => setNovoMarco(e.target.value)} placeholder="Outro marco" aria-label="Outro marco"
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (novoMarco.trim()) { setMarcos([...marcos, novoMarco.trim()]); setNovoMarco(""); } } }} />
              </div>
            </div>
          </>
        )}

        <CampoContexto contextos={contextos} value={contexto} onChange={setContexto} />

        {tipo !== "negocios" && (
          <label className="field" style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 400 }}>
            <input type="checkbox" checked={passoNoHoje} onChange={(e) => setPassoNoHoje(e.target.checked)} style={{ width: 18, height: 18, accentColor: "var(--accent)" }} />
            Colocar o próximo passo no Hoje
          </label>
        )}

        {erro && <p className="note note--err" role="alert">{erro}</p>}
        <button className="btn btn--lg" type="submit" disabled={salvando}><Route aria-hidden />{salvando ? "Criando…" : "Criar Rota"}</button>
      </form>

      {previa && (
        <section className="sim__preview" aria-live="polite" aria-label="Prévia da Rota">
          <p className="route__k"><Icon aria-hidden />{previa.resumo.destino ?? "Destino"}</p>
          <h2 className="page__t" style={{ fontSize: 24, lineHeight: "30px" }}>{nomeFinal || TIPOS[tipo].exemplo}</h2>
          <p className="route-pct"><b>{Math.round(previa.resumo.pct * 100)}%</b><span>{previa.resumo.agora}</span></p>
          {tipo === "negocios" ? (
            <div className="miles" style={{ "--done": "0%" } as React.CSSProperties}>
              {marcos.map((m, i) => <span key={m} className={`mile${i === 0 ? " is-now" : ""}`}><i /><b>{m}</b></span>)}
            </div>
          ) : (
            <Caminho pct={previa.resumo.pct} />
          )}
          <div className="route-cards">
            <div className="route-card"><small>Ritmo necessário</small><b>{previa.resumo.ritmo ?? "—"}</b></div>
            <div className="route-card"><small>Previsão</small><b>{previa.resumo.previsao ?? "—"}</b></div>
          </div>
          {previa.resumo.sugestao && (
            <div>
              <p className="sec__h" style={{ padding: "0 0 6px" }}>Próximo passo · vai para o Hoje</p>
              <div className="sim__next">
                <span className="check" aria-hidden />
                <span><b>{previa.resumo.sugestao.title}</b><small>{previa.resumo.sugestao.quando}</small></span>
              </div>
            </div>
          )}
          {tipo === "negocios" && <p className="field__hint">Cada marco ganha os próprios passos. Só o passo que cabe agora vai para o Hoje.</p>}
        </section>
      )}
    </div>
  );
}
