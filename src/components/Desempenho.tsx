"use client";

// Exercícios e provas: registrar em poucos toques e ver o aproveitamento na hora
import { useState, useTransition } from "react";
import { ListChecks, Trash2, Trophy } from "lucide-react";
import { apagarQuestoes, apagarSimulado, registrarQuestoes, registrarSimulado } from "@/app/(app)/acoes";
import { hojeISO, numeroBR } from "@/lib/datas";
import { pctTexto, tomAcerto, type Materia, type Tema } from "@/lib/estudos";
import { useAvisar } from "./Avisos";
import { Painel } from "./Comuns";

const inteiro = (v: string) => (v.trim() === "" ? NaN : Number(v.replace(/\D/g, "")));

/** Feitas e acertos lado a lado, com o aproveitamento aparecendo enquanto digita */
function CamposAcerto({ total, setTotal, certas, setCertas, nota = false }: { total: string; setTotal: (v: string) => void; certas: string; setCertas: (v: string) => void; nota?: boolean }) {
  const ler = nota ? (v: string) => numeroBR(v) ?? NaN : inteiro;
  const t = ler(total), c = ler(certas);
  const pct = t > 0 && c >= 0 && c <= t ? c / t : null;
  return (
    <div className="fields acerto-campos">
      <label className="field">{nota ? "Nota" : "Acertos"}<input className="input" inputMode="decimal" value={certas} onChange={(e) => setCertas(e.target.value)} placeholder={nota ? "7,5" : "15"} autoFocus={!nota} /></label>
      <label className="field">{nota ? "De (nota máxima)" : "De quantos"}<input className="input" inputMode="decimal" value={total} onChange={(e) => setTotal(e.target.value)} placeholder={nota ? "10" : "20"} /></label>
      <span className={`acerto-pct acerto-pct--${tomAcerto(pct)}`} aria-live="polite">{pctTexto(pct)}</span>
    </div>
  );
}

export function RegistrarQuestoes({ cursoId, materias, temas, materiaInicial, variante = "btn btn--line" }: { cursoId: string; materias: Materia[]; temas: Tema[]; materiaInicial?: string | null; variante?: string }) {
  const [aberto, setAberto] = useState(false);
  const [materia, setMateria] = useState(materiaInicial ?? materias[0]?.id ?? "");
  const [tema, setTema] = useState("");
  const [total, setTotal] = useState("");
  const [certas, setCertas] = useState("");
  const [dia, setDia] = useState(hojeISO());
  const [nota, setNota] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const avisar = useAvisar();
  const daMateria = temas.filter((t) => t.subject_id === materia).sort((a, b) => a.position - b.position);

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    const t = inteiro(total), c = inteiro(certas);
    iniciar(async () => {
      const r = await registrarQuestoes({ course_id: cursoId, subject_id: materia || null, topic_id: tema || null, done_on: dia, total: t, correct: c, note: nota || null });
      if (!r.ok) return setErro(r.erro ?? "Não foi possível guardar.");
      setAberto(false); setTotal(""); setCertas(""); setNota(""); setErro(null);
      avisar({ texto: `${c} de ${t} · ${pctTexto(c / t)} de acerto.`, acao: { rotulo: "Desfazer", fazer: () => iniciar(() => apagarQuestoes(r.id!)) } });
    });
  }

  return (
    <>
      <button type="button" className={variante} onClick={() => setAberto(true)}><ListChecks aria-hidden />Exercícios</button>
      {aberto && (
        <Painel titulo="Registrar exercícios" fechar={() => setAberto(false)}>
          <form onSubmit={enviar} className="detail" style={{ gap: 14 }}>
            <CamposAcerto total={total} setTotal={setTotal} certas={certas} setCertas={setCertas} />
            <div className="fields" style={{ gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)" }}>
              <label className="field">
                Matéria
                <select className="input" value={materia} onChange={(e) => { setMateria(e.target.value); setTema(""); }}>
                  {materias.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
                  <option value="">Várias / sem matéria</option>
                </select>
              </label>
              <label className="field">
                Tema
                <select className="input" value={tema} onChange={(e) => setTema(e.target.value)} disabled={!daMateria.length}>
                  <option value="">{daMateria.length ? "A matéria toda" : "Sem temas"}</option>
                  {daMateria.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
                </select>
              </label>
            </div>
            <div className="fields" style={{ gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.4fr)" }}>
              <label className="field">Dia<input className="input" type="date" value={dia} max={hojeISO()} onChange={(e) => setDia(e.target.value)} /></label>
              <label className="field">Observação<input className="input" value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Lista 3, o que errei…" /></label>
            </div>
            {erro && <p className="note note--err" role="alert">{erro}</p>}
            <div className="detail__foot"><button className="btn" type="submit" disabled={pendente || !total || certas === ""}>{pendente ? "Guardando…" : "Guardar"}</button></div>
          </form>
        </Painel>
      )}
    </>
  );
}

export function NovaProva({ cursoId, variante = "btn" }: { cursoId: string; variante?: string }) {
  const [aberto, setAberto] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [total, setTotal] = useState("10");
  const [certas, setCertas] = useState("");
  const [minutos, setMinutos] = useState("");
  const [dia, setDia] = useState(hojeISO());
  const [nota, setNota] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const avisar = useAvisar();

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    const t = numeroBR(total) ?? NaN, c = numeroBR(certas) ?? NaN, m = inteiro(minutos);
    iniciar(async () => {
      const r = await registrarSimulado({ course_id: cursoId, title: titulo, done_on: dia, total: t, correct: c, minutes: Number.isNaN(m) ? null : m, note: nota || null });
      if (!r.ok) return setErro(r.erro ?? "Não foi possível guardar.");
      setAberto(false); setTitulo(""); setTotal("10"); setCertas(""); setMinutos(""); setNota(""); setErro(null);
      avisar({ texto: `Nota guardada: ${String(c).replace(".", ",")} de ${String(t).replace(".", ",")}.`, acao: { rotulo: "Desfazer", fazer: () => iniciar(() => apagarSimulado(r.id!)) } });
    });
  }

  return (
    <>
      <button type="button" className={variante} onClick={() => setAberto(true)}><Trophy aria-hidden />Nota</button>
      {aberto && (
        <Painel titulo="Prova, trabalho ou simulado" fechar={() => setAberto(false)}>
          <form onSubmit={enviar} className="detail" style={{ gap: 14 }}>
            <label className="field">Nome<input className="input" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Prova 1 de Cálculo" autoFocus /></label>
            <CamposAcerto total={total} setTotal={setTotal} certas={certas} setCertas={setCertas} nota />
            <div className="fields" style={{ gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)" }}>
              <label className="field">Dia<input className="input" type="date" value={dia} max={hojeISO()} onChange={(e) => setDia(e.target.value)} /></label>
              <label className="field">Duração (min)<input className="input" inputMode="numeric" value={minutos} onChange={(e) => setMinutos(e.target.value)} placeholder="Opcional" /></label>
            </div>
            <label className="field">Observação<input className="input" value={nota} onChange={(e) => setNota(e.target.value)} placeholder="O que caiu, o que revisar" /></label>
            {erro && <p className="note note--err" role="alert">{erro}</p>}
            <div className="detail__foot"><button className="btn" type="submit" disabled={pendente || !titulo.trim() || !total || certas === ""}>{pendente ? "Guardando…" : "Guardar"}</button></div>
          </form>
        </Painel>
      )}
    </>
  );
}

export function ApagarRegistro({ id, tipo }: { id: string; tipo: "questoes" | "simulado" }) {
  const [pendente, iniciar] = useTransition();
  return (
    <button type="button" className="icon-btn" aria-label="Apagar registro" disabled={pendente} onClick={() => { if (confirm("Apagar este registro?")) iniciar(() => (tipo === "questoes" ? apagarQuestoes(id) : apagarSimulado(id))); }}>
      <Trash2 size={15} />
    </button>
  );
}
