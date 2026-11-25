"use client";

// O relógio do canto: aparece quando se começa uma aula e fica em todas as telas. Livre ou pomodoro (25 de foco + 5 de pausa),
// pausar, zerar, concluir (grava os minutos de foco), minimizar numa pílula e tirar do canto. Os avisos de fim de bloco saem daqui.
import Link from "next/link";
import { useEffect, useRef, useTransition } from "react";
import { Check, ChevronDown, Pause, Play, RotateCcw, X } from "lucide-react";
import { concluirAula, desfazerAula } from "@/app/(app)/acoes";
import * as R from "@/lib/relogio";
import { useAvisar } from "./Avisos";

/** Aviso de fim de bloco: som curto, vibração e notificação */
function alertar(titulo: string, corpo: string) {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AC();
    [0, 0.25].forEach((t, k) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = k ? 880 : 660; o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.0001, ctx.currentTime + t); g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.2);
      o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.22);
    });
  } catch { /* sem som */ }
  try { navigator.vibrate?.([200, 100, 200]); } catch { /* sem vibração */ }
  try {
    if ("Notification" in window && Notification.permission === "granted") {
      navigator.serviceWorker?.ready.then((r) => r.showNotification(titulo, { body: corpo, tag: "rumo-relogio" })).catch(() => new Notification(titulo, { body: corpo }));
    }
  } catch { /* sem notificação */ }
}

export function RelogioDoCanto() {
  const f = R.useRelogio();
  const a = f.ativo;
  const e = a ? R.lerEstado(a.id) : { acumulado: 0, desde: null };
  R.useTique(!!e.desde);
  const [pendente, iniciar] = useTransition();
  const avisar = useAvisar();
  const ms = R.passado(e);
  const po = R.pomodoro(ms);
  const focoMs = f.pomodoro ? po.focoMs : ms;

  // Marca a tela para deixar espaço embaixo (o conteúdo não fica escondido atrás do relógio)
  useEffect(() => {
    const d = document.documentElement;
    if (a) d.dataset.relogio = f.mini ? "mini" : "aberto"; else delete d.dataset.relogio;
    return () => { delete d.dataset.relogio; };
  }, [a, f.mini]);

  // Avisos: troca de bloco no pomodoro e 1 hora de aula no relógio livre (uma vez cada)
  const ultimo = useRef<string | null>(null);
  const marca = a && e.desde ? `${a.id}|${f.pomodoro ? `${po.numero}-${po.foco ? "foco" : "pausa"}` : "livre"}|${!f.pomodoro && ms >= 60 * R.MIN ? "hora" : ""}` : null;
  useEffect(() => {
    const antes = ultimo.current; ultimo.current = marca;
    if (!marca || !antes || !a) return; // começou agora (ou pausou): só marca o ponto de partida
    const [idAntes, faseAntes, horaAntes] = antes.split("|"), [id, fase, hora] = marca.split("|");
    if (idAntes !== id) return;
    if (hora && !horaAntes) alertar("1 hora de aula", `${a.titulo}: dá para concluir.`);
    else if (fase !== faseAntes && fase !== "livre" && faseAntes !== "livre") alertar(po.foco ? `Foco ${po.numero}` : "Pausa de 5 min", po.foco ? `De volta: ${a.titulo}` : "Levanta, toma água.");
  }, [marca, a, po.foco, po.numero]);

  if (!f.pronto || !a) return null;
  const rodando = !!e.desde;
  const emPausa = f.pomodoro && ms > 0 && !po.foco;
  const pct = f.pomodoro ? (ms > 0 ? po.pct : 0) : Math.min(1, ms / (60 * R.MIN));
  const tempo = f.pomodoro ? R.formatar(ms > 0 ? po.falta : 25 * R.MIN) : R.formatar(ms);
  const fase = f.pomodoro ? (ms === 0 ? "Pomodoro 25/5" : po.foco ? `Foco ${po.numero}` : "Pausa") : "Relógio livre";
  const estilo = { "--c": emPausa ? "#3ECF8E" : a.cor, "--p": pct } as React.CSSProperties;
  const playPause = rodando
    ? <button type="button" className="relogio__play" aria-label="Pausar" onClick={() => R.pausar(a.id)}><Pause aria-hidden /></button>
    : <button type="button" className="relogio__play" aria-label={ms > 0 ? "Continuar" : "Começar"} onClick={() => R.continuar(a.id)}><Play aria-hidden /></button>;

  const concluir = () => iniciar(async () => {
    const minutos = R.minutosDeFoco(ms, f.pomodoro);
    const r = await concluirAula(a.id, minutos);
    if (!r.ok) return avisar({ texto: "Não foi possível registrar." });
    R.concluida(a.id);
    avisar({ texto: `${a.titulo} concluída${minutos ? ` em ${minutos} min` : ""}.`, acao: { rotulo: "Desfazer", fazer: () => void desfazerAula(a.id) } });
  });

  if (f.mini) {
    return (
      <div className={`relogio relogio--mini${rodando ? " is-rodando" : ""}${emPausa ? " is-pausa" : ""}`} style={estilo} role="region" aria-label="Relógio da aula">
        <button type="button" className="relogio__abrir" onClick={() => R.minimizar(false)} aria-label={`Abrir o relógio: ${a.titulo}`}>
          <span className="relogio__anel relogio__anel--mini" aria-hidden />
          <b className="relogio__tempo">{tempo}</b>
          <small>{fase}</small>
        </button>
        {playPause}
      </div>
    );
  }

  return (
    <aside className={`relogio${rodando ? " is-rodando" : ""}${emPausa ? " is-pausa" : ""}`} style={estilo} aria-label="Relógio da aula">
      <header className="relogio__cab">
        <span className="relogio__fase"><i aria-hidden />{fase}</span>
        <button type="button" className="relogio__icone" aria-label="Zerar o relógio" title="Zerar" disabled={ms === 0} onClick={() => { if (confirm("Zerar o relógio desta aula?")) R.zerar(a.id); }}><RotateCcw aria-hidden /></button>
        <button type="button" className="relogio__icone" aria-label="Minimizar o relógio" title="Minimizar" onClick={() => R.minimizar(true)}><ChevronDown aria-hidden /></button>
        <button type="button" className="relogio__icone" aria-label="Tirar do canto" title="Tirar do canto (o tempo fica guardado na aula)" onClick={() => R.fechar()}><X aria-hidden /></button>
      </header>
      <div className="relogio__corpo">
        <div className="relogio__anel">
          <b className="relogio__tempo" aria-live="off">{tempo}</b>
          <small>{f.pomodoro ? (ms > 0 ? (po.foco ? "para a pausa" : "de pausa") : "de foco") : ms > 0 ? "de aula" : "pronto"}</small>
        </div>
        <div className="relogio__info">
          <Link href={`/estudos/d/${a.disciplina}`} className="relogio__t">{a.titulo}</Link>
          <small>{a.projeto}{focoMs > 0 ? ` · ${Math.floor(focoMs / R.MIN)} min de foco` : ""}</small>
          <div className="relogio__acoes">
            <button type="button" className="relogio__modo" aria-pressed={f.pomodoro} title={f.pomodoro ? "Pomodoro: 25 min de foco + 5 de pausa" : "Relógio livre"} onClick={() => R.trocarModo()}>25/5</button>
            {playPause}
            <button type="button" className="relogio__concluir" disabled={pendente} onClick={concluir}><Check aria-hidden />Concluí</button>
          </div>
        </div>
      </div>
    </aside>
  );
}
