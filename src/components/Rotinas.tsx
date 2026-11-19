"use client";

import { useOptimistic, useState, useTransition } from "react";
import { Check, ChevronRight, Plus, Repeat, Trash2 } from "lucide-react";
import { apagarRotina, criarRotina, marcarRotina, salvarRotina, type DadosRotina } from "@/app/(app)/acoes";
import { diaDaSemana, hojeISO, numeroBR, SEMANA_LONGA } from "@/lib/datas";
import { hora, type Marcacao, mesDaRotina, type Rotina, SEMANA, semanaDaRotina, textoFrequencia } from "@/lib/rotinas";
import { useAvisar } from "./Avisos";
import { CampoContexto } from "./Comuns";
import type { ContextItem } from "./Shell";
import { CATEGORIAS_SAIDA, moeda } from "@/lib/financas";

const LETRAS = ["D", "S", "T", "Q", "Q", "S", "S"];

/** O círculo de concluir da rotina (Hoje e lista de rotinas) */
export function ChecarRotina({ rotina, feita, dia }: { rotina: Pick<Rotina, "id" | "title">; feita: boolean; dia?: string }) {
  const [otimista, setOtimista] = useOptimistic(feita);
  const [, iniciar] = useTransition();
  const avisar = useAvisar();
  const quando = dia ?? hojeISO();
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={otimista}
      aria-label={`${otimista ? "Desmarcar" : "Feito"}: ${rotina.title}`}
      className="check"
      onClick={() => iniciar(async () => {
        setOtimista(!otimista);
        await marcarRotina(rotina.id, quando, !otimista);
        if (!otimista) avisar({ texto: `${rotina.title}: feito.`, acao: { rotulo: "Desfazer", fazer: () => iniciar(() => marcarRotina(rotina.id, quando, false)) } });
      })}
    >
      {otimista && <Check aria-hidden />}
    </button>
  );
}

/** A semana em 7 pontos. Dias que já passaram (e hoje) podem ser marcados: às vezes a gente esquece de registrar. */
export function SemanaRotina({ rotina, marcas }: { rotina: Rotina; marcas: Marcacao[] }) {
  const s = semanaDaRotina(rotina, marcas);
  const [, iniciar] = useTransition();
  return (
    <span className="week7" aria-label={s.texto}>
      {s.dias.map((d) => (
        <button
          key={d.dia}
          type="button"
          disabled={d.futuro}
          title={`${SEMANA_LONGA[diaDaSemana(d.dia)]}${d.feito ? " · feito" : ""}`}
          aria-label={`${d.feito ? "Desmarcar" : "Marcar"} ${SEMANA_LONGA[diaDaSemana(d.dia)]}`}
          aria-pressed={d.feito}
          className={`${d.feito ? "on" : ""}${d.previsto ? " plan" : ""}${d.hoje ? " today" : ""}`}
          onClick={() => iniciar(() => marcarRotina(rotina.id, d.dia, !d.feito))}
        />
      ))}
    </span>
  );
}

// ---------- formulário (criar e editar) ----------

type Valores = { title: string; modo: "dias" | "vezes" | "mes"; days: number[]; vezes: number; diaDoMes: string; valor: string; categoria: string; at_time: string; duration: string; context_id: string };

function valoresDe(r?: Rotina): Valores {
  return {
    title: r?.title ?? "",
    modo: r?.month_day ? "mes" : r?.times_per_week ? "vezes" : "dias",
    days: r?.days ?? [1, 3, 5],
    vezes: r?.times_per_week ?? 3,
    diaDoMes: String(r?.month_day ?? 10),
    valor: r?.amount ? String(r.amount).replace(".", ",") : "",
    categoria: r?.category ?? "Contas da casa",
    at_time: hora(r?.at_time ?? null) ?? "",
    duration: r?.duration_min ? String(r.duration_min) : "",
    context_id: r?.context_id ?? "",
  };
}

function CamposRotina({ v, set, contextos }: { v: Valores; set: (v: Valores) => void; contextos: ContextItem[] }) {
  const alternar = (d: number) => set({ ...v, days: v.days.includes(d) ? v.days.filter((x) => x !== d) : [...v.days, d] });
  return (
    <>
      <label className="field">
        Rotina
        <input className="input" value={v.title} onChange={(e) => set({ ...v, title: e.target.value })} placeholder="Ex.: Academia" maxLength={120} required />
      </label>
      <div className="field">
        Frequência
        <div className="seg" role="radiogroup" aria-label="Frequência" style={{ justifySelf: "start" }}>
          <label><input type="radio" checked={v.modo === "dias"} onChange={() => set({ ...v, modo: "dias" })} /><span>Dias da semana</span></label>
          <label><input type="radio" checked={v.modo === "vezes"} onChange={() => set({ ...v, modo: "vezes" })} /><span>Vezes por semana</span></label>
          <label><input type="radio" checked={v.modo === "mes"} onChange={() => set({ ...v, modo: "mes" })} /><span>Todo mês</span></label>
        </div>
        {v.modo === "mes" ? (
          <div className="chips" style={{ alignItems: "center" }}>
            <span className="field__hint">Todo dia</span>
            <input className="input" style={{ width: 72 }} inputMode="numeric" value={v.diaDoMes} onChange={(e) => set({ ...v, diaDoMes: e.target.value.replace(/\D/g, "").slice(0, 2) })} aria-label="Dia do mês" />
            <span className="field__hint">do mês. Aparece no Hoje nesse dia e fica até ser feita.</span>
            <span className="rotina__conta">
              <input className="input" style={{ width: 120 }} inputMode="decimal" value={v.valor} onChange={(e) => set({ ...v, valor: e.target.value })} placeholder="R$ (opcional)" aria-label="Valor da conta" />
              {v.valor && (
                <select className="input" style={{ width: 170 }} value={v.categoria} onChange={(e) => set({ ...v, categoria: e.target.value })} aria-label="Categoria">
                  {CATEGORIAS_SAIDA.map((c) => <option key={c}>{c}</option>)}
                </select>
              )}
              <span className="field__hint">Com valor, vira conta fixa em Finanças: marcar como feita lança o pagamento.</span>
            </span>
          </div>
        ) : v.modo === "dias" ? (
          <div className="chips" role="group" aria-label="Dias">
            {SEMANA.map((d) => (
              <button key={d} type="button" className="chip chip--day" aria-pressed={v.days.includes(d)} aria-label={SEMANA_LONGA[d]} title={SEMANA_LONGA[d]} onClick={() => alternar(d)}>{LETRAS[d]}</button>
            ))}
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => set({ ...v, days: [0, 1, 2, 3, 4, 5, 6] })}>Todo dia</button>
          </div>
        ) : (
          <div className="chips" role="group" aria-label="Vezes por semana">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <button key={n} type="button" className="chip chip--day" aria-pressed={v.vezes === n} onClick={() => set({ ...v, vezes: n })}>{n}</button>
            ))}
            <span className="field__hint" style={{ alignSelf: "center" }}>vezes, nos dias que der</span>
          </div>
        )}
      </div>
      <div className="fields">
        <label className="field">Horário<input className="input" type="time" value={v.at_time} onChange={(e) => set({ ...v, at_time: e.target.value })} /></label>
        <label className="field">Duração (min)<input className="input" inputMode="numeric" value={v.duration} onChange={(e) => set({ ...v, duration: e.target.value })} placeholder="Opcional" /></label>
        <CampoContexto contextos={contextos} value={v.context_id} onChange={(id) => set({ ...v, context_id: id })} />
      </div>
    </>
  );
}

const paraDados = (v: Valores): DadosRotina => ({
  title: v.title,
  context_id: v.context_id || null,
  days: v.modo === "dias" ? v.days : null,
  times_per_week: v.modo === "vezes" ? v.vezes : null,
  month_day: v.modo === "mes" ? Number(v.diaDoMes) || null : null,
  amount: v.modo === "mes" ? numeroBR(v.valor) || null : null,
  category: v.modo === "mes" && v.valor ? v.categoria : null,
  at_time: v.at_time || null,
  duration_min: Number(v.duration) || null,
});

export function NovaRotina({ contextos, inicial }: { contextos: ContextItem[]; inicial?: Partial<Valores> }) {
  const [aberto, setAberto] = useState(!!inicial);
  const [v, setV] = useState<Valores>({ ...valoresDe(), ...inicial });
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, iniciar] = useTransition();
  const avisar = useAvisar();

  if (!aberto) return <button type="button" className="btn" onClick={() => setAberto(true)}><Plus aria-hidden />Nova rotina</button>;
  return (
    <form
      className="course-form"
      onSubmit={(e) => {
        e.preventDefault();
        setErro(null);
        iniciar(async () => {
          const r = await criarRotina(paraDados(v));
          if (!r.ok) return setErro(r.erro ?? "Não foi possível criar.");
          avisar({ texto: `Rotina criada: ${v.title.trim()}. Aparece no Hoje nos dias dela.` });
          setV(valoresDe());
          setAberto(false);
        });
      }}
    >
      <CamposRotina v={v} set={setV} contextos={contextos} />
      {erro && <p className="note note--err" role="alert">{erro}</p>}
      <div className="detail__foot">
        <button className="btn btn--sm" type="submit" disabled={salvando || !v.title.trim()}>{salvando ? "Criando…" : "Criar rotina"}</button>
        <button className="btn btn--ghost btn--sm" type="button" onClick={() => setAberto(false)}>Cancelar</button>
      </div>
    </form>
  );
}

/** Linha da rotina: concluir hoje, frequência, a semana em pontos e o ajuste embaixo */
export function LinhaRotina({ rotina, marcas, contexto, doDia, contextos }: { rotina: Rotina; marcas: Marcacao[]; contexto?: ContextItem; doDia: boolean; contextos: ContextItem[] }) {
  const [aberto, setAberto] = useState(false);
  const [v, setV] = useState<Valores>(valoresDe(rotina));
  const [pausada, setPausada] = useState(rotina.status === "pausada");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const s = semanaDaRotina(rotina, marcas);
  const hoje = hojeISO();

  return (
    <li className="routine" id={rotina.id}>
      {doDia ? <ChecarRotina rotina={rotina} feita={marcas.some((m) => m.routine_id === rotina.id && m.done_on === hoje)} /> : <span aria-hidden />}
      <div className="row__body">
        <span className="row__t">{rotina.title}</span>
        <span className="props">
          <span className="prop"><Repeat aria-hidden />{textoFrequencia(rotina)}</span>
          {rotina.amount ? <span className="prop">{moeda(Number(rotina.amount))}</span> : null}
          {rotina.at_time && <span className="prop">{hora(rotina.at_time)}{rotina.duration_min ? ` · ${rotina.duration_min} min` : ""}</span>}
          {contexto && <span className="prop"><i className="dot" style={{ background: contexto.color }} />{contexto.name}</span>}
          {rotina.status === "pausada" && <span className="prop">Pausada</span>}
        </span>
      </div>
      <span className="routine__week">
        {rotina.month_day ? <small className="routine__mes">{mesDaRotina(rotina, marcas).texto}</small> : <><SemanaRotina rotina={rotina} marcas={marcas} /><small>{s.feitas} de {s.meta}</small></>}
      </span>
      <button type="button" className="icon-btn subj__toggle" aria-expanded={aberto} aria-label={`Ajustar ${rotina.title}`} title="Ajustar" onClick={() => setAberto(!aberto)}>
        <ChevronRight size={15} aria-hidden />
      </button>
      {aberto && (
        <form
          className="detail subj__form"
          onSubmit={(e) => {
            e.preventDefault();
            setErro(null);
            iniciar(async () => {
              const r = await salvarRotina(rotina.id, { ...paraDados(v), status: pausada ? "pausada" : "ativa" });
              if (!r.ok) return setErro(r.erro ?? "Não foi possível salvar.");
              setAberto(false);
            });
          }}
        >
          <CamposRotina v={v} set={setV} contextos={contextos} />
          <label className="check-line"><input type="checkbox" checked={pausada} onChange={(e) => setPausada(e.target.checked)} />Pausar (some do Hoje até você retomar)</label>
          {erro && <p className="note note--err" role="alert">{erro}</p>}
          <div className="detail__foot">
            <button className="btn btn--sm" type="submit" disabled={pendente}>{pendente ? "Guardando…" : "Guardar"}</button>
            <button type="button" className="btn btn--ghost btn--sm" style={{ marginLeft: "auto" }} disabled={pendente} onClick={() => { if (confirm(`Apagar a rotina ${rotina.title}? O que já foi registrado sai junto.`)) iniciar(() => apagarRotina(rotina.id)); }}>
              <Trash2 aria-hidden />Apagar
            </button>
          </div>
        </form>
      )}
    </li>
  );
}
