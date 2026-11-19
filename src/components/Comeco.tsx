"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Briefcase, Building2, CalendarDays, Check, Folder, GraduationCap, HeartPulse, Home, Inbox, ListChecks, Plus, Repeat, Route,
} from "lucide-react";
import { salvarComeco } from "@/app/(app)/acoes";
import { ESCOLHAS, MODULOS, ORDEM_OPCOES, type ChaveEscolha } from "@/lib/modulos";
import { CORES_CONTEXTO } from "@/lib/tipos";
import { Logo } from "./Logo";

const ICONES: Record<ChaveEscolha, typeof Briefcase> = {
  trabalho: Briefcase, negocios: Building2, estudos: GraduationCap, vida: HeartPulse, rotinas: Repeat, objetivos: Route, projetos: Folder,
};

type Inicial = { nome: string; escolhas: ChaveEscolha[]; respostas: Partial<Record<ChaveEscolha, string[]>> };

export function Comeco({ inicial, refazendo }: { inicial: Inicial; refazendo: boolean }) {
  const router = useRouter();
  const [passo, setPasso] = useState(1);
  const [nome, setNome] = useState(inicial.nome);
  const [escolhas, setEscolhas] = useState<ChaveEscolha[]>(inicial.escolhas);
  const [respostas, setRespostas] = useState(inicial.respostas);
  const [pergunta, setPergunta] = useState(0);
  const [novo, setNovo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, iniciar] = useTransition();

  const perguntas = ESCOLHAS.filter((e) => escolhas.includes(e.chave));
  const atual = perguntas[pergunta];
  const total = 3 + Math.max(perguntas.length, 0);
  const feitoAte = passo === 1 ? 1 : passo === 2 ? 2 : passo === 3 ? 3 + pergunta : total;

  function alternarEscolha(c: ChaveEscolha) {
    setEscolhas((e) => (e.includes(c) ? e.filter((x) => x !== c) : [...e, c]));
  }
  function alternarResposta(c: ChaveEscolha, v: string) {
    setRespostas((r) => {
      const lista = r[c] ?? [];
      return { ...r, [c]: lista.includes(v) ? lista.filter((x) => x !== v) : [...lista, v] };
    });
  }
  function adicionar(c: ChaveEscolha) {
    const v = novo.trim().slice(0, 60);
    if (!v) return;
    setRespostas((r) => ({ ...r, [c]: [...new Set([...(r[c] ?? []), v])] }));
    setNovo("");
  }

  function avancarPergunta() {
    setNovo("");
    if (pergunta + 1 < perguntas.length) setPergunta(pergunta + 1);
    else concluir();
  }

  function concluir() {
    setErro(null);
    iniciar(async () => {
      const r = await salvarComeco({ nome, escolhas, respostas });
      if (!r.ok) {
        setErro(r.erro ?? "Não foi possível salvar. Tente de novo.");
        return;
      }
      setPasso(4);
    });
  }

  // Prévia da navegação, montada ao vivo
  const previa = useMemo(() => {
    const empresas = escolhas.includes("negocios") ? respostas.negocios ?? [] : [];
    const areas = [
      ...(escolhas.includes("trabalho") ? ["Trabalho"] : []),
      ...(escolhas.includes("vida") ? respostas.vida ?? [] : []),
    ];
    const projetos = escolhas.includes("projetos") ? (respostas.projetos ?? []).length : 0;
    return { empresas, areas, projetos };
  }, [escolhas, respostas]);

  const emBreve = MODULOS.filter((m) => !m.disponivel && escolhas.some((e) => ESCOLHAS.find((x) => x.chave === e)?.modulo === m.chave)).map((m) => m.nome.split(" ")[0]);
  const nContextos = new Set([...previa.empresas, ...previa.areas]).size;

  let cor = 0;
  const proxCor = () => CORES_CONTEXTO[cor++ % CORES_CONTEXTO.length].cor;

  return (
    <main className="onb">
      <section className="onb__q">
        <div className="onb__top">
          <span>
            <Logo forma="horizontal" alt="Rumo" />
          </span>
          <span className="progress" aria-label={`Passo ${feitoAte} de ${total}`}>
            {Array.from({ length: total }, (_, i) => <i key={i} className={i < feitoAte ? "on" : ""} />)}
          </span>
        </div>

        {passo === 1 && (
          <form className="onb__q" style={{ padding: 0, width: "100%" }} onSubmit={(e) => { e.preventDefault(); setPasso(2); }}>
            <h1>Como você quer ser chamado?</h1>
            <label className="field">
              Nome
              <input className="input" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={60} autoFocus autoComplete="given-name" />
            </label>
            <div className="onb__foot">
              {refazendo && <button type="button" className="btn btn--ghost" onClick={() => router.push("/ajustes")}>Cancelar</button>}
              <button type="submit" className="btn">Continuar</button>
            </div>
          </form>
        )}

        {passo === 2 && (
          <>
            <h1>O que você quer organizar com o Rumo?</h1>
            <p className="onb__lead">Escolha quantos quiser. O Rumo monta a sua navegação a partir disso, e você pode mudar depois.</p>
            <div className="opts">
              {ORDEM_OPCOES.map((c) => {
                const e = ESCOLHAS.find((x) => x.chave === c)!;
                const Icon = ICONES[c];
                const on = escolhas.includes(c);
                return (
                  <button key={c} type="button" className="opt" aria-pressed={on} onClick={() => alternarEscolha(c)}>
                    <Icon aria-hidden />{e.rotulo}
                    <span className="tick" aria-hidden>{on && <Check />}</span>
                  </button>
                );
              })}
            </div>
            {!escolhas.length && (
              <p className="capture__hint">Só o Core. Hoje, Inbox, Calendário, Responsabilidades e Projetos. Módulos podem ser ativados depois.</p>
            )}
            <div className="onb__foot">
              <button type="button" className="btn btn--ghost" onClick={() => setPasso(1)}>Voltar</button>
              <button type="button" className="btn" disabled={salvando} onClick={() => { setPergunta(0); if (perguntas.length) setPasso(3); else concluir(); }}>
                {salvando ? "Montando…" : "Continuar"}
              </button>
            </div>
          </>
        )}

        {passo === 3 && atual && (
          <>
            <h1>{atual.pergunta}</h1>
            <div className="ask">
              {atual.sugestoes.length > 0 && (
                <div className="chips" role="group" aria-label="Sugestões">
                  {[...new Set([...atual.sugestoes, ...(respostas[atual.chave] ?? [])])].map((s) => (
                    <button key={s} type="button" className="chip" aria-pressed={(respostas[atual.chave] ?? []).includes(s)} onClick={() => alternarResposta(atual.chave, s)}>{s}</button>
                  ))}
                </div>
              )}
              {atual.sugestoes.length === 0 && (respostas[atual.chave] ?? []).length > 0 && (
                <div className="chips">
                  {(respostas[atual.chave] ?? []).map((s) => (
                    <button key={s} type="button" className="chip" aria-pressed onClick={() => alternarResposta(atual.chave, s)} title="Tirar">{s}</button>
                  ))}
                </div>
              )}
              <form className="ask__add" onSubmit={(e) => { e.preventDefault(); adicionar(atual.chave); }}>
                <input
                  className="input"
                  value={novo}
                  onChange={(e) => setNovo(e.target.value)}
                  placeholder={atual.chave === "negocios" ? "Nome da empresa, ex.: Iter Mídia" : "Outro"}
                  aria-label="Adicionar"
                  maxLength={60}
                  autoFocus={atual.sugestoes.length === 0}
                />
                <button type="submit" className="btn btn--line" disabled={!novo.trim()}><Plus aria-hidden />Adicionar</button>
              </form>
            </div>
            {erro && <p className="note note--err" role="alert">{erro}</p>}
            <div className="onb__foot">
              <button type="button" className="btn btn--ghost" onClick={() => (pergunta > 0 ? setPergunta(pergunta - 1) : setPasso(2))}>Voltar</button>
              <button type="button" className="btn btn--line" disabled={salvando} onClick={() => { setRespostas((r) => ({ ...r, [atual.chave]: [] })); avancarPergunta(); }}>Pular</button>
              <button type="button" className="btn" disabled={salvando} onClick={avancarPergunta}>{salvando ? "Montando…" : "Continuar"}</button>
            </div>
          </>
        )}

        {passo === 4 && (
          <>
            <h1>Seu Rumo está pronto.</h1>
            <div className="onb__done">
              <p style={{ margin: 0 }}>
                {nContextos || previa.projetos
                  ? [nContextos ? `${nContextos} ${nContextos === 1 ? "contexto" : "contextos"}` : "", previa.projetos ? `${previa.projetos} ${previa.projetos === 1 ? "projeto" : "projetos"}` : ""].filter(Boolean).join(", ") + "."
                  : "Só o Core, por enquanto."}
                {emBreve.length > 0 && ` ${emBreve.join(" e ")} ${emBreve.length === 1 ? "chega" : "chegam"} em breve.`}
              </p>
            </div>
            <div className="onb__foot">
              <button type="button" className="btn btn--lg" onClick={() => { router.push("/hoje"); router.refresh(); }}>Ir para o Hoje</button>
            </div>
          </>
        )}
      </section>

      <aside className="onb__preview" aria-label="Sua navegação">
        <p className="onb__label">Sua navegação</p>
        {[
          { label: "Hoje", Icon: Home },
          { label: "Inbox", Icon: Inbox },
          { label: "Calendário", Icon: CalendarDays },
          { label: "Responsabilidades", Icon: ListChecks },
          { label: "Projetos", Icon: Folder },
        ].map(({ label, Icon }) => (
          <span key={label} className="nav"><Icon aria-hidden /><span className="nav__label">{label}</span></span>
        ))}
        {previa.empresas.length > 0 && <div className="side__group"><span>Negócios</span></div>}
        {previa.empresas.map((n) => <span key={`e${n}`} className="nav"><i className="nav__dot" style={{ background: proxCor() }} /><span className="nav__label">{n}</span></span>)}
        {previa.areas.length > 0 && <div className="side__group"><span>Áreas</span></div>}
        {previa.areas.map((n) => <span key={`a${n}`} className="nav"><i className="nav__dot" style={{ background: proxCor() }} /><span className="nav__label">{n}</span></span>)}
      </aside>
    </main>
  );
}
