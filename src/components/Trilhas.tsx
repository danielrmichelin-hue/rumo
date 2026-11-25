"use client";

// Estudos: o relógio da aula, os formulários (área, projeto, disciplina) e a lista de aulas de uma disciplina.
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Bell, BellOff, Check, Pause, Pencil, Play, Plus, RotateCcw, Trash2 } from "lucide-react";
import {
  apagarAreaEstudo, apagarAula, apagarDisciplina, apagarProjetoEstudo, concluirAula, criarAreaEstudo, criarAreasEstudo, criarDisciplina, criarProjetoEstudo, desfazerAula,
  moverNaFila, salvarAreaEstudo, salvarAula, salvarDisciplina, salvarLembreteEstudo, salvarProjetoEstudo,
} from "@/app/(app)/acoes";
import { hojeISO, numeroBR, SEMANA_CURTA } from "@/lib/datas";
import type { Area, Aula, Disciplina, ProjetoEstudo } from "@/lib/trilhas";
import { useAvisar } from "./Avisos";
import { Painel } from "./Comuns";

// ---------- o relógio da aula ----------

type Estado = { acumulado: number; desde: number | null };
const chave = (id: string) => `rumo:relogio:${id}`;
const ler = (id: string): Estado => {
  try { const v = JSON.parse(localStorage.getItem(chave(id)) ?? "null"); if (v && typeof v.acumulado === "number") return v; } catch { /* sem armazenamento: começa do zero */ }
  return { acumulado: 0, desde: null };
};
const gravar = (id: string, e: Estado | null) => { try { if (e) localStorage.setItem(chave(id), JSON.stringify(e)); else localStorage.removeItem(chave(id)); } catch { /* segue sem guardar */ } };
const passado = (e: Estado) => e.acumulado + (e.desde ? Date.now() - e.desde : 0);
const relogio = (ms: number) => { const s = Math.floor(ms / 1000); const h = Math.floor(s / 3600); return `${h ? `${h}:` : ""}${String(Math.floor((s % 3600) / 60)).padStart(h ? 2 : 1, "0")}:${String(s % 60).padStart(2, "0")}`; };

const MIN = 60000;
const FOCO = 25 * MIN, CICLO = 30 * MIN; // pomodoro: 25 de foco + 5 de pausa
const MODO = "rumo:relogio:modo";

/** No pomodoro: em que bloco está, quanto falta nele e quanto já foi de foco */
function pomodoro(ms: number) {
  const n = Math.floor(ms / CICLO), pos = ms % CICLO;
  const foco = pos < FOCO;
  return { numero: n + 1, foco, falta: foco ? FOCO - pos : CICLO - pos, focoMs: n * FOCO + Math.min(pos, FOCO), pct: foco ? pos / FOCO : (pos - FOCO) / (CICLO - FOCO) };
}

/** Aviso de fim de bloco: som curto, vibração e notificação (com a tela aberta) */
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

/** Uma aula do dia: o relógio (livre ou pomodoro; continua contando se trocar de tela) e o "Concluí", que grava os minutos */
export function AulaDoDia({ aula, titulo, projeto, cor, feita, minutosMeta = 60 }: { aula: Aula; titulo: string; projeto: string; cor: string; feita: boolean; minutosMeta?: number }) {
  const [e, setE] = useState<Estado>({ acumulado: 0, desde: null });
  const [modoPomodoro, setModoPomodoro] = useState(false);
  const [agora, setAgora] = useState(0);
  const [pendente, iniciar] = useTransition();
  const avisar = useAvisar();
  const ultimo = useRef<string | null>(null);
  useEffect(() => { setE(ler(aula.id)); try { setModoPomodoro(localStorage.getItem(MODO) === "pomodoro"); } catch { /* livre */ } }, [aula.id]);
  useEffect(() => {
    if (!e.desde) return;
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [e.desde]);
  void agora;
  const ms = passado(e);
  const po = pomodoro(ms);
  const focoMs = modoPomodoro ? po.focoMs : ms;
  // Avisos: troca de bloco no pomodoro e 1 hora de aula (uma vez cada)
  useEffect(() => {
    if (!e.desde) return;
    const marca = `${modoPomodoro ? `${po.numero}-${po.foco ? "foco" : "pausa"}` : "livre"}|${focoMs >= minutosMeta * MIN ? "hora" : ""}`;
    if (ultimo.current === null) { ultimo.current = marca; return; }
    if (marca === ultimo.current) return;
    const [antes, horaAntes] = ultimo.current.split("|");
    const [fase, hora] = marca.split("|");
    ultimo.current = marca;
    if (hora && !horaAntes) alertar("1 hora de aula", `${titulo}: dá para concluir.`);
    else if (modoPomodoro && fase !== antes) alertar(po.foco ? `Foco ${po.numero}` : "Pausa de 5 min", po.foco ? `De volta: ${titulo}` : "Levanta, toma água.");
  });
  const mudar = (n: Estado) => { setE(n); gravar(aula.id, n); if (!n.desde) ultimo.current = null; };
  const trocarModo = () => { const v = !modoPomodoro; setModoPomodoro(v); ultimo.current = null; try { localStorage.setItem(MODO, v ? "pomodoro" : "livre"); } catch { /* segue */ } };
  const pct = modoPomodoro ? (ms > 0 ? po.pct : 0) : Math.min(1, ms / (minutosMeta * MIN));
  const comecar = () => {
    try { if ("Notification" in window && Notification.permission === "default") void Notification.requestPermission(); } catch { /* segue */ }
    ultimo.current = null;
    mudar({ acumulado: e.acumulado, desde: Date.now() });
  };

  if (feita) {
    return (
      <li className="aula-dia is-feita">
        <span className="aula-dia__marca" style={{ background: cor }}><Check aria-hidden /></span>
        <div className="aula-dia__t"><Link href={`/estudos/d/${aula.discipline_id}`}><b>{titulo}</b></Link><small>{projeto} · feita{aula.minutes ? ` em ${aula.minutes} min` : ""}</small></div>
        <button type="button" className="icon-btn" aria-label="Desfazer" disabled={pendente} onClick={() => iniciar(() => desfazerAula(aula.id))}><RotateCcw size={15} /></button>
      </li>
    );
  }
  return (
    <li className={`aula-dia${e.desde ? " is-rodando" : ""}${modoPomodoro && ms > 0 && !po.foco ? " is-pausa" : ""}`}>
      <span className="aula-dia__anel" style={{ "--p": pct, "--c": modoPomodoro && ms > 0 && !po.foco ? "var(--ok)" : cor } as React.CSSProperties} aria-hidden />
      <div className="aula-dia__t"><Link href={`/estudos/d/${aula.discipline_id}`}><b>{titulo}</b></Link><small>{projeto}{modoPomodoro && ms > 0 ? ` · ${po.foco ? `foco ${po.numero}` : "pausa"} · ${relogio(focoMs)} de foco` : ""}</small></div>
      <span className="aula-dia__tempo" aria-live="off">{ms > 0 ? (modoPomodoro ? relogio(po.falta) : relogio(ms)) : ""}</span>
      <span className="aula-dia__acoes">
        <button type="button" className="chip aula-dia__modo" aria-pressed={modoPomodoro} title={modoPomodoro ? "Pomodoro: 25 min de foco + 5 de pausa" : "Relógio livre"} onClick={trocarModo}>25/5</button>
        {ms > 0 && <button type="button" className="icon-btn" aria-label="Zerar o relógio" title="Zerar" onClick={() => { if (confirm("Zerar o relógio desta aula?")) mudar({ acumulado: 0, desde: null }); }}><RotateCcw size={15} /></button>}
        {e.desde
          ? <button type="button" className="icon-btn" aria-label="Pausar" onClick={() => mudar({ acumulado: passado(e), desde: null })}><Pause size={16} /></button>
          : <button type="button" className="btn btn--line btn--sm" onClick={comecar}><Play aria-hidden />{ms > 0 ? "Continuar" : "Começar"}</button>}
        <button type="button" className="btn btn--sm" disabled={pendente} onClick={() => iniciar(async () => {
          const minutos = focoMs > 0 ? Math.max(1, Math.round(focoMs / MIN)) : null;
          const r = await concluirAula(aula.id, minutos);
          if (!r.ok) return avisar({ texto: "Não foi possível registrar." });
          gravar(aula.id, null); setE({ acumulado: 0, desde: null });
          avisar({ texto: `${titulo} concluída${minutos ? ` em ${minutos} min` : ""}.`, acao: { rotulo: "Desfazer", fazer: () => iniciar(() => desfazerAula(aula.id)) } });
        })}><Check aria-hidden />Concluí</button>
      </span>
    </li>
  );
}

// ---------- começar, áreas, projetos, disciplinas ----------

export function CriarAreas() {
  const [pendente, iniciar] = useTransition();
  return <button type="button" className="btn" disabled={pendente} onClick={() => iniciar(() => criarAreasEstudo())}><Plus aria-hidden />Criar Profissional e Intelectual</button>;
}

export function EditarArea({ area }: { area: Area }) {
  const [aberto, setAberto] = useState(false);
  const [v, setV] = useState({ name: area.name, aulas: String(area.daily_lessons), dias: area.weekdays });
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  return (
    <>
      <button type="button" className="icon-btn" aria-label={`Ajustar ${area.name}`} onClick={() => setAberto(true)}><Pencil size={15} /></button>
      {aberto && (
        <Painel titulo={area.name} fechar={() => setAberto(false)}>
          <form className="detail" style={{ gap: 14 }} onSubmit={(e) => { e.preventDefault(); iniciar(async () => { const r = await salvarAreaEstudo(area.id, { name: v.name, daily_lessons: Number(v.aulas), weekdays: v.dias }); if (!r.ok) return setErro(r.erro ?? "Erro."); setAberto(false); }); }}>
            <label className="field">Nome<input className="input" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} maxLength={60} /></label>
            <label className="field">Aulas por dia (1 aula = 1 hora)<input className="input" inputMode="numeric" value={v.aulas} onChange={(e) => setV({ ...v, aulas: e.target.value.replace(/\D/g, "").slice(0, 2) })} /></label>
            <div className="field">Dias de estudo
              <span className="chips">{[1, 2, 3, 4, 5, 6, 0].map((d) => (
                <button key={d} type="button" className="chip" aria-pressed={v.dias.includes(d)} onClick={() => setV({ ...v, dias: v.dias.includes(d) ? v.dias.filter((x) => x !== d) : [...v.dias, d] })}>{SEMANA_CURTA[d]}</button>
              ))}</span>
            </div>
            {erro && <p className="note note--err" role="alert">{erro}</p>}
            <div className="detail__foot">
              <button className="btn btn--ghost btn--sm" type="button" onClick={() => { if (confirm(`Apagar a área "${area.name}" com todos os projetos, disciplinas e aulas dela?`)) iniciar(async () => { await apagarAreaEstudo(area.id); setAberto(false); }); }}><Trash2 aria-hidden />Apagar</button>
              <button className="btn" type="submit" disabled={pendente} style={{ marginLeft: "auto" }}>{pendente ? "Guardando…" : "Guardar"}</button>
            </div>
          </form>
        </Painel>
      )}
    </>
  );
}

export function NovaArea() {
  const [nome, setNome] = useState("");
  const [aulas, setAulas] = useState("1");
  const [pendente, iniciar] = useTransition();
  const avisar = useAvisar();
  return (
    <form className="trilha-novo trilha-novo--disc" onSubmit={(e) => { e.preventDefault(); iniciar(async () => { const r = await criarAreaEstudo(nome, Number(aulas)); if (!r.ok) return avisar({ texto: r.erro ?? "Erro." }); setNome(""); }); }}>
      <input className="input" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nova área (ex.: Idiomas)" maxLength={60} aria-label="Nova área" />
      <label className="trilha-novo__n"><input className="input" inputMode="numeric" value={aulas} onChange={(e) => setAulas(e.target.value.replace(/\D/g, "").slice(0, 2))} aria-label="Aulas por dia" /><small>por dia</small></label>
      <button className="btn btn--line btn--sm" type="submit" disabled={pendente || !nome.trim()}><Plus aria-hidden />Área</button>
    </form>
  );
}

export function NovoProjeto({ areaId }: { areaId: string }) {
  const [nome, setNome] = useState("");
  const [pendente, iniciar] = useTransition();
  const avisar = useAvisar();
  return (
    <form className="trilha-novo" onSubmit={(e) => { e.preventDefault(); iniciar(async () => { const r = await criarProjetoEstudo(areaId, nome); if (!r.ok) return avisar({ texto: r.erro ?? "Erro." }); setNome(""); }); }}>
      <input className="input" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Novo projeto (ex.: Marketing, História)" maxLength={80} aria-label="Novo projeto" />
      <button className="btn btn--line btn--sm" type="submit" disabled={pendente || !nome.trim()}><Plus aria-hidden />Projeto</button>
    </form>
  );
}

export function NovaDisciplina({ projetoId }: { projetoId: string }) {
  const [nome, setNome] = useState("");
  const [aulas, setAulas] = useState("28");
  const [pendente, iniciar] = useTransition();
  const avisar = useAvisar();
  return (
    <form className="trilha-novo trilha-novo--disc" onSubmit={(e) => { e.preventDefault(); iniciar(async () => { const r = await criarDisciplina(projetoId, nome, Number(aulas)); if (!r.ok) return avisar({ texto: r.erro ?? "Erro." }); setNome(""); }); }}>
      <input className="input" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nova disciplina" maxLength={80} aria-label="Nova disciplina" />
      <label className="trilha-novo__n"><input className="input" inputMode="numeric" value={aulas} onChange={(e) => setAulas(e.target.value.replace(/\D/g, "").slice(0, 4))} aria-label="Quantas aulas" /><small>aulas</small></label>
      <button className="btn btn--line btn--sm" type="submit" disabled={pendente || !nome.trim() || !Number(aulas)}><Plus aria-hidden />Disciplina</button>
    </form>
  );
}

export function MoverFila({ tabela, id, primeiro, ultimo }: { tabela: "study_projects" | "study_disciplines"; id: string; primeiro: boolean; ultimo: boolean }) {
  const [pendente, iniciar] = useTransition();
  return (
    <span className="trilha-mover">
      <button type="button" className="icon-btn" aria-label="Subir na fila" disabled={pendente || primeiro} onClick={() => iniciar(() => moverNaFila(tabela, id, -1))}><ArrowUp size={14} /></button>
      <button type="button" className="icon-btn" aria-label="Descer na fila" disabled={pendente || ultimo} onClick={() => iniciar(() => moverNaFila(tabela, id, 1))}><ArrowDown size={14} /></button>
    </span>
  );
}

export function EditarProjeto({ projeto, areas }: { projeto: ProjetoEstudo; areas: Area[] }) {
  const [aberto, setAberto] = useState(false);
  const [v, setV] = useState({ name: projeto.name, area_id: projeto.area_id, archived: projeto.archived, target_on: projeto.target_on ?? "" });
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  return (
    <>
      <button type="button" className="icon-btn" aria-label={`Ajustar ${projeto.name}`} onClick={() => setAberto(true)}><Pencil size={14} /></button>
      {aberto && (
        <Painel titulo={projeto.name} fechar={() => setAberto(false)}>
          <form className="detail" style={{ gap: 14 }} onSubmit={(e) => { e.preventDefault(); iniciar(async () => { const r = await salvarProjetoEstudo(projeto.id, v); if (!r.ok) return setErro(r.erro ?? "Erro."); setAberto(false); }); }}>
            <label className="field">Nome<input className="input" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} maxLength={80} /></label>
            <label className="field">Área<select className="input" value={v.area_id} onChange={(e) => setV({ ...v, area_id: e.target.value })}>{areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
            <label className="field">Meta: terminar até (opcional)<input className="input" type="date" value={v.target_on} onChange={(e) => setV({ ...v, target_on: e.target.value })} /></label>
            <label className="check-line"><input type="checkbox" checked={v.archived} onChange={(e) => setV({ ...v, archived: e.target.checked })} />Pausado (sai da fila e do roadmap)</label>
            {erro && <p className="note note--err" role="alert">{erro}</p>}
            <div className="detail__foot">
              <button className="btn btn--ghost btn--sm" type="button" onClick={() => { if (confirm(`Apagar o projeto "${projeto.name}" com todas as disciplinas e aulas?`)) iniciar(async () => { await apagarProjetoEstudo(projeto.id); setAberto(false); }); }}><Trash2 aria-hidden />Apagar</button>
              <button className="btn" type="submit" disabled={pendente} style={{ marginLeft: "auto" }}>{pendente ? "Guardando…" : "Guardar"}</button>
            </div>
          </form>
        </Painel>
      )}
    </>
  );
}

export function EditarDisciplina({ disciplina, total, projetos, voltar }: { disciplina: Disciplina; total: number; projetos: ProjetoEstudo[]; voltar?: string }) {
  const [aberto, setAberto] = useState(false);
  const [v, setV] = useState({ name: disciplina.name, aulas: String(total), project_id: disciplina.project_id });
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  return (
    <>
      <button type="button" className="btn btn--line btn--sm" onClick={() => setAberto(true)}><Pencil aria-hidden />Ajustar</button>
      {aberto && (
        <Painel titulo={disciplina.name} fechar={() => setAberto(false)}>
          <form className="detail" style={{ gap: 14 }} onSubmit={(e) => { e.preventDefault(); iniciar(async () => { const r = await salvarDisciplina(disciplina.id, { name: v.name, aulas: Number(v.aulas), project_id: v.project_id }); if (!r.ok) return setErro(r.erro ?? "Erro."); setAberto(false); }); }}>
            <label className="field">Nome<input className="input" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} maxLength={80} /></label>
            <label className="field">Quantas aulas<input className="input" inputMode="numeric" value={v.aulas} onChange={(e) => setV({ ...v, aulas: e.target.value.replace(/\D/g, "").slice(0, 4) })} /></label>
            <label className="field">Projeto<select className="input" value={v.project_id} onChange={(e) => setV({ ...v, project_id: e.target.value })}>{projetos.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
            {erro && <p className="note note--err" role="alert">{erro}</p>}
            <div className="detail__foot">
              <button className="btn btn--ghost btn--sm" type="button" onClick={() => { if (confirm(`Apagar "${disciplina.name}" e as aulas dela?`)) iniciar(async () => { await apagarDisciplina(disciplina.id); setAberto(false); if (voltar) location.assign(voltar); }); }}><Trash2 aria-hidden />Apagar</button>
              <button className="btn" type="submit" disabled={pendente} style={{ marginLeft: "auto" }}>{pendente ? "Guardando…" : "Guardar"}</button>
            </div>
          </form>
        </Painel>
      )}
    </>
  );
}

// ---------- as aulas de uma disciplina ----------

/** Uma aula na lista: marcar feita (hoje) e abrir para o título, a anotação, a data e os minutos */
export function LinhaAula({ aula, proxima }: { aula: Aula; proxima: boolean }) {
  const [aberto, setAberto] = useState(false);
  const [v, setV] = useState({ title: aula.title ?? "", note: aula.note ?? "", done_on: aula.done_on ?? "", minutes: aula.minutes ? String(aula.minutes) : "" });
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const hoje = hojeISO();
  return (
    <li className={`aula${aula.done_on ? " is-feita" : ""}${proxima ? " is-proxima" : ""}`}>
      <button type="button" role="checkbox" aria-checked={!!aula.done_on} aria-label={`Aula ${aula.number}${aula.done_on ? ", feita" : ""}`} className="check" disabled={pendente}
        onClick={() => iniciar(async () => { if (aula.done_on) await desfazerAula(aula.id); else await concluirAula(aula.id, null); })}>
        {aula.done_on && <Check aria-hidden />}
      </button>
      <button type="button" className="aula__t" onClick={() => setAberto(true)}>
        <b>Aula {aula.number}{aula.title ? `: ${aula.title}` : ""}</b>
        <small>{aula.done_on ? `Feita em ${aula.done_on.split("-").reverse().join("/")}${aula.minutes ? ` · ${aula.minutes} min` : ""}` : proxima ? "A próxima" : ""}{aula.note ? " · com anotação" : ""}</small>
      </button>
      {aberto && (
        <Painel titulo={`Aula ${aula.number}`} fechar={() => setAberto(false)}>
          <form className="detail" style={{ gap: 14 }} onSubmit={(e) => { e.preventDefault(); iniciar(async () => {
            const r = await salvarAula(aula.id, { title: v.title, note: v.note, done_on: v.done_on || null, minutes: v.minutes ? numeroBR(v.minutes) : null });
            if (!r.ok) return setErro(r.erro ?? "Erro."); setAberto(false);
          }); }}>
            <label className="field">Título (opcional)<input className="input" value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} placeholder="Ex.: Vieses cognitivos" maxLength={160} /></label>
            <label className="field">Anotação<textarea className="input" rows={6} value={v.note} onChange={(e) => setV({ ...v, note: e.target.value })} placeholder="O que ficou da aula, o link da conversa com a IA…" maxLength={4000} /></label>
            <div className="fields" style={{ gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)" }}>
              <label className="field">Feita em<input className="input" type="date" value={v.done_on} max={hoje} onChange={(e) => setV({ ...v, done_on: e.target.value })} /></label>
              <label className="field">Minutos<input className="input" inputMode="numeric" value={v.minutes} onChange={(e) => setV({ ...v, minutes: e.target.value.replace(/\D/g, "").slice(0, 4) })} disabled={!v.done_on} /></label>
            </div>
            {erro && <p className="note note--err" role="alert">{erro}</p>}
            <div className="detail__foot">
              <button className="btn btn--ghost btn--sm" type="button" onClick={() => { if (confirm(`Apagar a aula ${aula.number}? As seguintes sobem um número.`)) iniciar(async () => { const r = await apagarAula(aula.id); if (!r.ok) return setErro(r.erro ?? "Erro."); setAberto(false); }); }}><Trash2 aria-hidden />Apagar aula</button>
              <button className="btn" type="submit" disabled={pendente} style={{ marginLeft: "auto" }}>{pendente ? "Guardando…" : "Guardar"}</button>
            </div>
          </form>
        </Painel>
      )}
    </li>
  );
}

/** O horário do aviso das aulas do dia no celular */
export function LembreteEstudo({ hora }: { hora: string | null }) {
  const [v, setV] = useState(hora?.slice(0, 5) ?? "");
  const [pendente, iniciar] = useTransition();
  const avisar = useAvisar();
  const guardar = (h: string | null) => iniciar(async () => {
    const r = await salvarLembreteEstudo(h);
    avisar({ texto: r.ok ? (h ? `Aviso das aulas às ${h}, nos dias de estudo.` : "Aviso das aulas desligado.") : r.erro ?? "Erro." });
  });
  return (
    <form className="lembrete" onSubmit={(e) => { e.preventDefault(); guardar(v || null); }}>
      <label><Bell size={15} aria-hidden /><span>Aviso das aulas</span><input className="input" type="time" value={v} onChange={(e) => setV(e.target.value)} aria-label="Horário do aviso das aulas" /></label>
      {v !== (hora?.slice(0, 5) ?? "") && <button className="btn btn--sm" type="submit" disabled={pendente}>Guardar</button>}
      {hora && v === hora.slice(0, 5) && <button className="icon-btn" type="button" aria-label="Desligar o aviso" disabled={pendente} onClick={() => { setV(""); guardar(null); }}><BellOff size={15} /></button>}
    </form>
  );
}
