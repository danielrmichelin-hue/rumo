"use client";

import { useOptimistic, useState, useTransition } from "react";
import { Check, Pause, Play, Plus, Trash2, X } from "lucide-react";
import { apagarMedida, apagarRemedio, criarRemedio, marcarRotina, pausarRemedio, registrarMedida } from "@/app/(app)/acoes";
import { hojeISO, numeroBR, rotuloData } from "@/lib/datas";
import { MEDIDAS, valorMedida, type Medida, type Remedio, type TipoMedida } from "@/lib/saude";
import { useAvisar } from "./Avisos";

/** Um horário do remédio: tocar marca a dose de hoje como tomada */
export function Dose({ id, titulo, hora, tomada }: { id: string; titulo: string; hora: string | null; tomada: boolean }) {
  const [otimista, setOtimista] = useOptimistic(tomada);
  const [, iniciar] = useTransition();
  const hoje = hojeISO();
  return (
    <button
      type="button"
      className="dose"
      aria-pressed={otimista}
      aria-label={`${titulo}${hora ? ` das ${hora}` : ""}: ${otimista ? "tomado, desmarcar" : "marcar como tomado"}`}
      onClick={() => iniciar(async () => { setOtimista(!otimista); await marcarRotina(id, hoje, !otimista); })}
    >
      {otimista ? <Check aria-hidden /> : <i aria-hidden />}
      {hora ?? "Hoje"}
    </button>
  );
}

/** Parar, voltar a tomar, apagar: valem para todos os horários do remédio */
export function AcoesRemedio({ remedio }: { remedio: Remedio }) {
  const [pendente, iniciar] = useTransition();
  const avisar = useAvisar();
  const ids = remedio.doses.map((d) => d.rotina.id);
  return (
    <span className="remedio__acoes">
      <button type="button" className="icon-btn" disabled={pendente} aria-label={remedio.ativo ? `Parar ${remedio.title}` : `Voltar a tomar ${remedio.title}`} title={remedio.ativo ? "Parei de tomar" : "Voltar a tomar"}
        onClick={() => iniciar(async () => {
          await pausarRemedio(ids, remedio.ativo);
          avisar({ texto: remedio.ativo ? `${remedio.title}: parado. Fica guardado em "Parados".` : `${remedio.title}: de volta ao Hoje.` });
        })}>
        {remedio.ativo ? <Pause size={15} /> : <Play size={15} />}
      </button>
      <button type="button" className="icon-btn" disabled={pendente} aria-label={`Apagar ${remedio.title}`} title="Apagar"
        onClick={() => { if (confirm(`Apagar ${remedio.title} e o histórico de doses?`)) iniciar(() => apagarRemedio(ids)); }}>
        <Trash2 size={15} />
      </button>
    </span>
  );
}

export function NovoRemedio({ contexto }: { contexto: string | null }) {
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [dose, setDose] = useState("");
  const [horarios, setHorarios] = useState<string[]>(["08:00"]);
  const [continuo, setContinuo] = useState(true);
  const [fim, setFim] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const avisar = useAvisar();

  if (!aberto) return <button type="button" className="btn btn--ghost btn--sm" onClick={() => setAberto(true)}><Plus aria-hidden />Remédio</button>;
  return (
    <form
      className="fin-form fin-form--conta"
      onSubmit={(e) => {
        e.preventDefault();
        setErro(null);
        iniciar(async () => {
          const r = await criarRemedio({ title: nome, dose, horarios, ends_on: continuo ? null : fim || null, context_id: contexto });
          if (!r.ok) return setErro(r.erro ?? "Não foi possível guardar.");
          avisar({ texto: `${nome.trim()} guardado. Aparece no Hoje ${horarios.length ? `às ${horarios.join(" e ")}` : "todo dia"}.` });
          setNome(""); setDose(""); setHorarios(["08:00"]); setContinuo(true); setFim(""); setAberto(false);
        });
      }}
    >
      <div className="fin-form__linha saude-form__remedio">
        <label className="field">Remédio<input className="input" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Losartana" maxLength={120} required autoFocus /></label>
        <label className="field">Dose<input className="input" value={dose} onChange={(e) => setDose(e.target.value)} placeholder="Ex.: 50 mg, 1 comprimido" maxLength={80} required /></label>
      </div>
      <div className="field">
        Horários
        <div className="chips">
          {horarios.map((h, i) => (
            <span key={i} className="hora-chip">
              <input className="input" type="time" value={h} onChange={(e) => setHorarios(horarios.map((x, j) => (j === i ? e.target.value : x)))} aria-label={`Horário ${i + 1}`} required />
              {horarios.length > 1 && <button type="button" className="icon-btn" aria-label="Tirar este horário" onClick={() => setHorarios(horarios.filter((_, j) => j !== i))}><X size={14} /></button>}
            </span>
          ))}
          {horarios.length < 6 && <button type="button" className="btn btn--ghost btn--sm" onClick={() => setHorarios([...horarios, horarios.length === 1 ? "20:00" : "12:00"])}><Plus aria-hidden />Horário</button>}
        </div>
      </div>
      <div className="field">
        Por quanto tempo
        <div className="chips" style={{ alignItems: "center" }}>
          <div className="seg" role="radiogroup" aria-label="Por quanto tempo">
            <label><input type="radio" checked={continuo} onChange={() => setContinuo(true)} /><span>Uso contínuo</span></label>
            <label><input type="radio" checked={!continuo} onChange={() => setContinuo(false)} /><span>Até uma data</span></label>
          </div>
          {!continuo && <input className="input" type="date" style={{ width: 170 }} value={fim} min={hojeISO()} onChange={(e) => setFim(e.target.value)} aria-label="Último dia" required />}
        </div>
      </div>
      {erro && <p className="note note--err" role="alert">{erro}</p>}
      <div className="fin-form__pe">
        <span className="field__hint">Cada horário aparece no Hoje. Marcar um não marca o outro.</span>
        <button className="btn btn--ghost btn--sm" type="button" onClick={() => setAberto(false)}>Cancelar</button>
        <button className="btn btn--sm" type="submit" disabled={pendente || !nome.trim() || !dose.trim()}>Guardar remédio</button>
      </div>
    </form>
  );
}

/** "120/80", "120x80", "12/8" ou "12 por 8" → máxima e mínima em mmHg */
function lerPressao(v: string): [number, number] | null {
  const m = v.match(/(\d{1,3})(?:[.,](\d))?\s*(?:[/x×]|por)\s*(\d{1,3})(?:[.,](\d))?/i);
  if (!m) return null;
  let a = Number(`${m[1]}.${m[2] ?? 0}`), b = Number(`${m[3]}.${m[4] ?? 0}`);
  if (a < 30) { a *= 10; b *= 10; } // "12 por 8"
  return [Math.round(a), Math.round(b)];
}

export function NovaMedida() {
  const [tipo, setTipo] = useState<TipoMedida>("peso");
  const [valor, setValor] = useState("");
  const [nome, setNome] = useState("");
  const [dia, setDia] = useState(hojeISO());
  const [pendente, iniciar] = useTransition();
  const avisar = useAvisar();
  const t = MEDIDAS[tipo];
  return (
    <form
      className="medida-form"
      onSubmit={(e) => {
        e.preventDefault();
        const p = tipo === "pressao" ? lerPressao(valor) : null;
        if (tipo === "pressao" && !p) return avisar({ texto: "Escreva a pressão assim: 120/80." });
        iniciar(async () => {
          const r = await registrarMedida({ kind: tipo, value: p ? p[0] : numeroBR(valor), value2: p ? p[1] : null, label: tipo === "outro" ? nome : null, measured_on: dia, note: null });
          if (!r.ok) return avisar({ texto: r.erro ?? "Não foi possível guardar." });
          avisar({ texto: `${tipo === "outro" ? nome : t.rotulo}: ${valorMedida({ kind: tipo, value: p ? p[0] : numeroBR(valor), value2: p ? p[1] : null })} guardado.`, acao: { rotulo: "Desfazer", fazer: () => iniciar(() => apagarMedida(r.id!)) } });
          setValor("");
        });
      }}
    >
      <select className="input" value={tipo} onChange={(e) => setTipo(e.target.value as TipoMedida)} aria-label="Medida">
        {(Object.keys(MEDIDAS) as TipoMedida[]).map((k) => <option key={k} value={k}>{MEDIDAS[k].rotulo}</option>)}
      </select>
      {tipo === "outro" && <input className="input" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome" aria-label="Nome da medida" maxLength={60} required />}
      <span className="medida-form__valor">
        <input className="input" inputMode={tipo === "pressao" ? "text" : "decimal"} value={valor} onChange={(e) => setValor(e.target.value)} placeholder={tipo === "pressao" ? "120/80" : "0"} aria-label={`Valor${t.unidade ? ` em ${t.unidade}` : ""}`} required />
        {t.unidade && <small>{t.unidade}</small>}
      </span>
      <input className="input" type="date" value={dia} max={hojeISO()} onChange={(e) => setDia(e.target.value)} aria-label="Dia" required />
      <button className="btn btn--sm" type="submit" disabled={pendente || !valor.trim()}>Guardar</button>
    </form>
  );
}

/** Histórico de uma medida, com apagar (lançou errado) */
export function HistoricoMedida({ pontos }: { pontos: Medida[] }) {
  const [pendente, iniciar] = useTransition();
  return (
    <ul className="medida__hist">
      {[...pontos].reverse().map((m) => (
        <li key={m.id}>
          <time>{rotuloData(m.measured_on)}</time>
          <b>{valorMedida(m)}</b>
          <button type="button" className="icon-btn" disabled={pendente} aria-label={`Apagar a medida de ${rotuloData(m.measured_on)}`} onClick={() => iniciar(() => apagarMedida(m.id))}><Trash2 size={14} /></button>
        </li>
      ))}
    </ul>
  );
}
