// O relógio das aulas: o tempo de cada aula e a aula que está no relógio do canto, guardados no navegador (localStorage),
// para continuar contando ao trocar de tela. Quem muda avisa com o evento "rumo:relogio"; outras abas ouvem "storage".

import { useEffect, useState } from "react";

export type Estado = { acumulado: number; desde: number | null };
export type NoRelogio = { id: string; titulo: string; projeto: string; cor: string; disciplina: string };

export const MIN = 60000;
const FOCO = 25 * MIN, CICLO = 30 * MIN; // pomodoro: 25 de foco + 5 de pausa
const chave = (id: string) => `rumo:relogio:${id}`;
const ATIVO = "rumo:relogio:ativo", MODO = "rumo:relogio:modo", MINI = "rumo:relogio:mini";
const EVENTO = "rumo:relogio";

const lerJSON = <T,>(k: string): T | null => { try { return JSON.parse(localStorage.getItem(k) ?? "null"); } catch { return null; } };
const gravarJSON = (k: string, v: unknown) => { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch { /* segue sem guardar */ } };
const avisar = () => window.dispatchEvent(new Event(EVENTO));

export const lerEstado = (id: string): Estado => { const v = lerJSON<Estado>(chave(id)); return v && typeof v.acumulado === "number" ? v : { acumulado: 0, desde: null }; };
export const passado = (e: Estado) => e.acumulado + (e.desde ? Date.now() - e.desde : 0);
export const formatar = (ms: number) => { const s = Math.floor(ms / 1000); const h = Math.floor(s / 3600); return `${h ? `${h}:` : ""}${String(Math.floor((s % 3600) / 60)).padStart(h ? 2 : 1, "0")}:${String(s % 60).padStart(2, "0")}`; };

/** No pomodoro: em que bloco está, quanto falta nele e quanto já foi de foco */
export function pomodoro(ms: number) {
  const n = Math.floor(ms / CICLO), pos = ms % CICLO;
  const foco = pos < FOCO;
  return { numero: n + 1, foco, falta: foco ? FOCO - pos : CICLO - pos, focoMs: n * FOCO + Math.min(pos, FOCO), pct: foco ? pos / FOCO : (pos - FOCO) / (CICLO - FOCO) };
}
/** Minutos que vão para a aula ao concluir: no pomodoro, só o foco */
export const minutosDeFoco = (ms: number, modoPomodoro: boolean) => { const f = modoPomodoro ? pomodoro(ms).focoMs : ms; return f > 0 ? Math.max(1, Math.round(f / MIN)) : null; };

// ---------- mudanças ----------

const pausado = (e: Estado): Estado => ({ acumulado: passado(e), desde: null });

/** Põe a aula no relógio do canto e começa a contar (se outra estava contando, ela pausa) */
export function comecar(aula: NoRelogio) {
  const atual = lerJSON<NoRelogio>(ATIVO);
  if (atual && atual.id !== aula.id) gravarJSON(chave(atual.id), pausado(lerEstado(atual.id)));
  const e = lerEstado(aula.id);
  gravarJSON(chave(aula.id), { acumulado: e.acumulado, desde: e.desde ?? Date.now() });
  gravarJSON(ATIVO, aula); gravarJSON(MINI, null);
  try { if ("Notification" in window && Notification.permission === "default") void Notification.requestPermission(); } catch { /* segue */ }
  avisar();
}
export function pausar(id: string) { gravarJSON(chave(id), pausado(lerEstado(id))); avisar(); }
export function continuar(id: string) { const e = lerEstado(id); if (!e.desde) gravarJSON(chave(id), { acumulado: e.acumulado, desde: Date.now() }); avisar(); }
export function zerar(id: string) { gravarJSON(chave(id), null); avisar(); }
/** Tira do canto: pausa e guarda o tempo na aula */
export function fechar() { const a = lerJSON<NoRelogio>(ATIVO); if (a) gravarJSON(chave(a.id), pausado(lerEstado(a.id))); gravarJSON(ATIVO, null); avisar(); }
/** A aula foi concluída (em qualquer lugar): some o tempo e sai do canto */
export function concluida(id: string) { gravarJSON(chave(id), null); if (lerJSON<NoRelogio>(ATIVO)?.id === id) gravarJSON(ATIVO, null); avisar(); }
export function trocarModo() { gravarJSON(MODO, lerJSON<string>(MODO) === "pomodoro" ? "livre" : "pomodoro"); avisar(); }
export function minimizar(v: boolean) { gravarJSON(MINI, v ? true : null); avisar(); }

// ---------- leitura nos componentes ----------

export type Foto = { pronto: boolean; ativo: NoRelogio | null; pomodoro: boolean; mini: boolean; versao: number };

/** O relógio como está agora; muda quando alguém mexe (nesta ou em outra aba) */
export function useRelogio(): Foto {
  const [f, setF] = useState<Foto>({ pronto: false, ativo: null, pomodoro: false, mini: false, versao: 0 });
  useEffect(() => {
    const ler = () => setF((x) => ({ pronto: true, ativo: lerJSON<NoRelogio>(ATIVO), pomodoro: lerJSON<string>(MODO) === "pomodoro", mini: !!lerJSON<boolean>(MINI), versao: x.versao + 1 }));
    ler();
    window.addEventListener(EVENTO, ler); window.addEventListener("storage", ler);
    return () => { window.removeEventListener(EVENTO, ler); window.removeEventListener("storage", ler); };
  }, []);
  return f;
}

/** Faz o componente desenhar de novo a cada segundo enquanto o relógio corre */
export function useTique(rodando: boolean) {
  const [, setT] = useState(0);
  useEffect(() => {
    if (!rodando) return;
    const t = setInterval(() => setT((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [rodando]);
}
