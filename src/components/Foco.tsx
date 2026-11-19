"use client";

// Modo foco (pomodoro): tela cheia com a matéria e a aula na frente, foco e pausa, e o tempo de foco
// vira sessão concluída sozinho (conta no ciclo e na semana). Sem pontos nem sequência: só o tempo.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Pause, Play, Square, Timer, X } from "lucide-react";
import { marcarTema, registrarFoco } from "@/app/(app)/acoes";
import type { Materia, Tema } from "@/lib/estudos";
import { useAvisar } from "./Avisos";

type Fase = "pronto" | "foco" | "pausa";
const FOCOS = [25, 50];
const PAUSAS = [5, 10];

const mmss = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

/** Um toque curto e baixo ao fim de cada fase (sem arquivo de som) */
function tocar() {
  try {
    const ctx = new AudioContext();
    [0, 0.22].forEach((t, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = i ? 784 : 659;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.35);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + 0.4);
    });
  } catch {
    // sem som disponível
  }
}

export function Foco({ cursoId, materias, temas, materiaInicial, temaInicial, rotulo = "Começar foco", variante = "btn" }: {
  cursoId: string;
  materias: Materia[];
  temas: Tema[];
  materiaInicial?: string | null;
  temaInicial?: string | null;
  rotulo?: string;
  variante?: string;
}) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <button type="button" className={variante} onClick={() => setAberto(true)}><Timer aria-hidden />{rotulo}</button>
      {aberto && <TelaFoco cursoId={cursoId} materias={materias} temas={temas} materiaInicial={materiaInicial} temaInicial={temaInicial} fechar={() => setAberto(false)} />}
    </>
  );
}

function TelaFoco({ cursoId, materias, temas, materiaInicial, temaInicial, fechar }: {
  cursoId: string; materias: Materia[]; temas: Tema[]; materiaInicial?: string | null; temaInicial?: string | null; fechar: () => void;
}) {
  const avisar = useAvisar();
  const [materia, setMateria] = useState(materiaInicial ?? materias[0]?.id ?? "");
  const abertos = useMemo(() => temas.filter((t) => t.subject_id === materia && !t.done_at).sort((a, b) => a.position - b.position), [temas, materia]);
  const [tema, setTema] = useState(temaInicial && temas.some((t) => t.id === temaInicial) ? temaInicial : abertos[0]?.id ?? "");
  const [foco, setFoco] = useState(25);
  const [pausa, setPausa] = useState(5);
  const [fase, setFase] = useState<Fase>("pronto");
  const [fimEm, setFimEm] = useState<number | null>(null); // rodando: quando a fase termina
  const [restante, setRestante] = useState(25 * 60000); // parado: quanto falta
  const [agora, setAgora] = useState(Date.now());
  const [feitos, setFeitos] = useState(0);
  const [minutosHoje, setMinutosHoje] = useState(0);
  const [vista, setVista] = useState(false);
  const registrando = useRef(false);

  const nomeMateria = materias.find((m) => m.id === materia);
  const nomeTema = temas.find((t) => t.id === tema);
  const duracao = (fase === "pausa" ? pausa : foco) * 60000;
  const falta = fimEm ? fimEm - agora : restante;
  const pct = 1 - falta / duracao;

  // Relógio: um tique a cada meio segundo; o tempo vem do relógio do aparelho (aba em segundo plano não atrasa)
  useEffect(() => {
    if (!fimEm) return;
    const t = setInterval(() => setAgora(Date.now()), 500);
    return () => clearInterval(t);
  }, [fimEm]);

  const guardarFoco = useCallback(async (minutos: number) => {
    if (registrando.current || minutos < 1) return;
    registrando.current = true;
    const r = await registrarFoco(cursoId, materia || null, tema || null, minutos, false);
    registrando.current = false;
    if (r.ok) setMinutosHoje((m) => m + Math.round(minutos));
  }, [cursoId, materia, tema]);

  // Fim de fase: foco vira sessão concluída e começa a pausa; fim da pausa volta para o próximo foco (parado)
  useEffect(() => {
    if (!fimEm || falta > 0) return;
    tocar();
    if (fase === "foco") {
      guardarFoco(foco);
      setFeitos((n) => n + 1);
      setFase("pausa");
      setFimEm(Date.now() + pausa * 60000);
    } else {
      setFase("pronto");
      setFimEm(null);
      setRestante(foco * 60000);
    }
  }, [falta, fimEm, fase, foco, pausa, guardarFoco]);

  useEffect(() => {
    const titulo = document.title;
    if (fimEm) document.title = `${mmss(falta)} · ${fase === "pausa" ? "Pausa" : "Foco"}`;
    return () => { document.title = titulo; };
  }, [falta, fimEm, fase]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !fimEm) fechar(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fimEm, fechar]);

  function comecar() {
    setFase((f) => (f === "pausa" ? "pausa" : "foco"));
    setFimEm(Date.now() + (fase === "pronto" ? foco * 60000 : restante));
    setAgora(Date.now());
  }
  function pausar() {
    setRestante(Math.max(0, (fimEm ?? Date.now()) - Date.now()));
    setFimEm(null);
  }
  /** Encerrar: o tempo de foco já feito conta; a pausa não conta */
  async function encerrar() {
    if (fase === "foco") await guardarFoco((foco * 60000 - falta) / 60000);
    if (vista && tema) await marcarTema(tema, true);
    const total = minutosHoje + (fase === "foco" ? Math.round((foco * 60000 - falta) / 60000) : 0);
    avisar({ texto: total >= 1 ? `Foco encerrado: ${total} min estudados${vista ? ", aula vista (revisão amanhã)" : ""}.` : "Foco encerrado." });
    fechar();
  }

  const rodando = !!fimEm;
  const R = 120;
  const C = 2 * Math.PI * R;

  return (
    <div className="foco" role="dialog" aria-modal="true" aria-label="Modo foco">
      <div className="foco__topo">
        <span className="foco__marca"><Timer aria-hidden />Modo foco{feitos > 0 && ` · ${feitos} ${feitos === 1 ? "pomodoro" : "pomodoros"}`}</span>
        {!rodando && <button type="button" className="foco__x" onClick={fase === "pronto" && !minutosHoje ? fechar : encerrar} aria-label="Fechar"><X size={20} /></button>}
      </div>

      <div className="foco__centro">
        {fase === "pronto" && !rodando && feitos === 0 ? (
          <div className="foco__escolha">
            <label>
              <span>Matéria</span>
              <select value={materia} onChange={(e) => { setMateria(e.target.value); setTema(temas.find((t) => t.subject_id === e.target.value && !t.done_at)?.id ?? ""); }}>
                {materias.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
                <option value="">Sem matéria</option>
              </select>
            </label>
            <label>
              <span>Aula ou tema</span>
              <select value={tema} onChange={(e) => setTema(e.target.value)} disabled={!abertos.length}>
                {abertos.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
                <option value="">{abertos.length ? "Sem tema" : "Nenhuma em aberto"}</option>
              </select>
            </label>
          </div>
        ) : (
          <p className="foco__materia">
            <i style={{ background: nomeMateria?.color ?? "#DCCEF6" }} />{nomeMateria?.title ?? "Estudo"}{nomeTema && <> · <b>{nomeTema.title}</b></>}
          </p>
        )}

        <div className={`foco__relogio${fase === "pausa" ? " is-pausa" : ""}`}>
          <svg viewBox="0 0 280 280" aria-hidden>
            <circle cx="140" cy="140" r={R} className="foco__trilho" />
            <circle cx="140" cy="140" r={R} className="foco__arco" strokeDasharray={C} strokeDashoffset={C * (1 - Math.min(1, Math.max(0, pct)))} />
          </svg>
          <div className="foco__tempo">
            <small>{fase === "pausa" ? "Pausa" : "Foco"}</small>
            <b aria-live="off">{mmss(falta)}</b>
            {minutosHoje > 0 && <small>{minutosHoje} min nesta sessão</small>}
          </div>
        </div>

        {fase === "pronto" && !rodando && (
          <div className="foco__ajustes">
            <div className="foco__op" role="group" aria-label="Tempo de foco">
              {FOCOS.map((m) => <button key={m} type="button" aria-pressed={foco === m} onClick={() => { setFoco(m); setRestante(m * 60000); }}>{m} min</button>)}
            </div>
            <div className="foco__op" role="group" aria-label="Tempo de pausa">
              {PAUSAS.map((m) => <button key={m} type="button" aria-pressed={pausa === m} onClick={() => setPausa(m)}>pausa {m}</button>)}
            </div>
          </div>
        )}

        <div className="foco__acoes">
          {rodando ? (
            <button type="button" className="foco__btn" onClick={pausar}><Pause aria-hidden />Pausar</button>
          ) : (
            <button type="button" className="foco__btn foco__btn--principal" onClick={comecar}><Play aria-hidden />{fase === "pronto" && feitos === 0 && restante === foco * 60000 ? "Começar" : fase === "pausa" ? "Retomar a pausa" : "Continuar"}</button>
          )}
          {fase === "pausa" && <button type="button" className="foco__btn" onClick={() => { setFase("pronto"); setFimEm(null); setRestante(foco * 60000); }}>Pular a pausa</button>}
          {(rodando || feitos > 0 || minutosHoje > 0) && <button type="button" className="foco__btn" onClick={encerrar}><Square aria-hidden />Encerrar</button>}
        </div>

        {tema && (fase !== "pronto" || feitos > 0) && (
          <label className="foco__vista"><input type="checkbox" checked={vista} onChange={(e) => setVista(e.target.checked)} /><Check aria-hidden />Terminei esta aula (revisão amanhã)</label>
        )}
      </div>

      <p className="foco__rodape">O tempo de foco entra sozinho no ciclo e na semana. A pausa não conta.</p>
    </div>
  );
}
