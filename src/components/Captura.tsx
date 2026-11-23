"use client";

import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { CalendarClock, CalendarDays, ChevronDown, Hourglass, Inbox, ListChecks, Scale, X } from "lucide-react";
import { capturar, type EscolhasCaptura } from "@/app/(app)/acoes";
import { lerCaptura } from "@/lib/captura";
import { diaDaSemana, hojeISO, rotuloData, rotuloHora, somarDias, somarDiasUteis } from "@/lib/datas";
import { useAvisar } from "./Avisos";
import type { ContextItem } from "./Shell";

/** Atalho global: C (ou N) abre a captura quando não se está digitando. */
export function useAtalhoCaptura(abrir: () => void) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      const alvo = e.target as HTMLElement | null;
      if (alvo && (alvo.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(alvo.tagName))) return;
      if (e.key.toLowerCase() === "c" || e.key.toLowerCase() === "n") {
        e.preventDefault();
        abrir();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [abrir]);
}

function primeiraMaiuscula(s: string) {
  return s.charAt(0).toLocaleUpperCase("pt-BR") + s.slice(1);
}

type Tipo = NonNullable<EscolhasCaptura["tipo"]>;
const TIPOS: [Tipo, string, typeof ListChecks][] = [["tarefa", "Tarefa", ListChecks], ["decisao", "Decisão", Scale], ["compromisso", "Compromisso", CalendarClock], ["aguardando", "Aguardando", Hourglass]];
const DURACOES: [number, string][] = [[30, "30 min"], [60, "1h"], [90, "1h30"], [120, "2h"]];

export function Captura({ aberta, abrir, fechar, contextos, projetos = [], textoInicial = "", contextoInicial = null }: { aberta: boolean; abrir: () => void; fechar: () => void; contextos: ContextItem[]; projetos?: { id: string; name: string; context_id: string | null }[]; textoInicial?: string; contextoInicial?: string | null }) {
  const [valor, setValor] = useState("");
  // Escolhas: undefined = vale o que o texto disse
  const [tipo, setTipo] = useState<Tipo | undefined>();
  const [data, setData] = useState<string | null | undefined>();
  const [hora, setHora] = useState<string | null | undefined>();
  const [duracao, setDuracao] = useState(60);
  const [local, setLocal] = useState("");
  const [quem, setQuem] = useState("");
  const [cobrar, setCobrar] = useState("");
  const [projeto, setProjeto] = useState("");
  const [nota, setNota] = useState("");
  const [mais, setMais] = useState(false);
  const campo = useRef<HTMLTextAreaElement>(null);
  const avisar = useAvisar();
  const hoje = hojeISO();

  const leitura = useMemo(() => (valor.trim() ? lerCaptura(valor, contextos, hoje) : null), [valor, contextos, hoje]);
  // Onde guardar: a etiqueta tocada vale mais que o #; sem nenhum dos dois, o Rumo sugere pelo texto
  const [escolhido, setEscolhido] = useState<string | null>(null);
  useEffect(() => {
    if (aberta) setEscolhido((e) => e ?? contextoInicial);
  }, [aberta, contextoInicial]);
  const sugerido = useMemo(() => (leitura && !leitura.context_id && !escolhido ? sugerirContexto(valor, contextos) : null), [leitura, escolhido, valor, contextos]);
  const idContexto = escolhido === "inbox" ? null : escolhido ?? leitura?.context_id ?? null;
  const contexto = contextos.find((c) => c.id === idContexto);
  const tipoEf: Tipo = tipo ?? (leitura?.kind === "decidir" ? "decisao" : "tarefa");
  const dataEf = data !== undefined ? data : leitura?.due_date ?? (tipoEf === "compromisso" ? hoje : null);
  const horaEf = hora !== undefined ? hora : leitura?.due_time ?? null;
  const cobrarEf = cobrar || somarDiasUteis(hoje, 3);
  const proxSegunda = somarDias(hoje, ((8 - diaDaSemana(hoje)) % 7) || 7);
  const atalhosData: [string, string | null][] = [...(tipoEf === "compromisso" ? [] : [["Sem data", null] as [string, null]]), ["Hoje", hoje], ["Amanhã", somarDias(hoje, 1)], ["Próx. segunda", proxSegunda]];
  function limparEscolhas() { setTipo(undefined); setData(undefined); setHora(undefined); setDuracao(60); setLocal(""); setQuem(""); setCobrar(""); setProjeto(""); setNota(""); setMais(false); }

  // Botões como "Nova decisão" abrem a captura já com um começo de texto
  // O cursor vai para o espaço reservado do texto pronto ("Decidir  #iter" → depois de "Decidir ";
  // " #iter" → no começo). Aplicado depois que o texto já está na caixa.
  const cursor = useRef<number | null>(null);
  useEffect(() => {
    if (!aberta || !textoInicial) return;
    const i = textoInicial.indexOf("  ");
    cursor.current = textoInicial.startsWith(" ") ? 0 : i >= 0 ? i + 1 : textoInicial.length;
    setValor((v) => {
      // Mesmo texto já na caixa: não haverá nova renderização, então posiciona agora
      if (v === textoInicial) requestAnimationFrame(() => {
        const el = campo.current;
        if (el && cursor.current !== null) { el.focus(); el.setSelectionRange(cursor.current, cursor.current); cursor.current = null; }
      });
      return textoInicial;
    });
  }, [aberta, textoInicial]);
  useLayoutEffect(() => {
    const el = campo.current;
    if (cursor.current === null || !el || el.value !== valor) return;
    el.focus();
    el.setSelectionRange(cursor.current, cursor.current);
    cursor.current = null;
  }, [valor]);

  useEffect(() => {
    if (!aberta) return;
    requestAnimationFrame(() => {
      const el = campo.current;
      if (!el) return;
      if (cursor.current !== null) return; // o texto pronto posiciona o cursor
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    });
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") fechar();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [aberta, fechar]);

  // Fecha na hora e guarda em segundo plano: dá para capturar a próxima sem esperar
  async function guardar() {
    const texto = valor.trim();
    if (!texto) return;
    const onde = escolhido;
    if (tipoEf === "compromisso" && !horaEf) { avisar({ texto: "Compromisso precisa de hora." }); return; }
    if (tipoEf === "aguardando" && !quem.trim()) { avisar({ texto: "Aguardando quem?" }); return; }
    const escolhas: EscolhasCaptura = {
      tipo: tipoEf, ...(data !== undefined || tipoEf === "compromisso" ? { data: dataEf } : {}), ...(hora !== undefined ? { hora } : {}),
      ...(tipoEf === "compromisso" ? { duracao, local: local || null } : {}),
      ...(tipoEf === "aguardando" ? { quem, cobrar: cobrarEf } : {}),
      projeto: projeto || null, nota: nota || null,
    };
    setValor("");
    setEscolhido(null);
    limparEscolhas();
    fechar();
    avisar({ texto: "Guardando…", fixo: true });
    let r: Awaited<ReturnType<typeof capturar>>;
    try {
      r = await capturar(texto, onde, escolhas);
    } catch {
      r = { ok: false, erro: "Não foi possível guardar. Verifique a conexão e tente de novo." };
    }
    if (!r.ok) {
      avisar({ texto: r.erro, fixo: true, acao: { rotulo: "Reabrir", fazer: () => { setValor(texto); abrir(); } } });
      return;
    }
    const lugar = r.contexto ? `em ${r.contexto}` : "na Inbox";
    const quando = r.due_date ? ` · ${rotuloData(r.due_date, hoje)}${r.due_time ? ` ${rotuloHora(r.due_time)}` : ""}` : "";
    avisar({ texto: `${r.compromisso ? "Na agenda" : `Guardado ${lugar}`}${quando}.`, link: { rotulo: "Abrir", href: r.compromisso ? `/calendario/${r.id}` : `/responsabilidades/${r.id}` } });
  }

  if (!aberta) return null;

  // Texto com os trechos entendidos marcados (camada atrás da caixa de texto)
  const espelho: React.ReactNode[] = [];
  let pos = 0;
  for (const m of leitura?.marcas ?? []) {
    espelho.push(<Fragment key={`t${pos}`}>{valor.slice(pos, m.inicio)}</Fragment>);
    espelho.push(<mark key={`m${m.inicio}`}>{valor.slice(m.inicio, m.fim)}</mark>);
    pos = m.fim;
  }
  espelho.push(<Fragment key="fim">{valor.slice(pos)}{"​"}</Fragment>);

  const destino = !leitura ? "" : contexto ? `vai para ${contexto.name}` : "vai para a Inbox";

  return (
    <div className="capture" role="dialog" aria-modal="true" aria-label="Capturar" onMouseDown={(e) => e.target === e.currentTarget && fechar()}>
      <form className="capture__box" onSubmit={(e) => { e.preventDefault(); guardar(); }}>
        <i className="capture__grab" aria-hidden />
        <div className="capture__head">
          <b>Capturar</b>
          <span>{destino}</span>
          <button type="button" className="icon-btn hide-mobile" onClick={fechar} aria-label="Fechar"><X size={18} /></button>
        </div>

        <div className="capture__field">
          <div className="capture__mirror" aria-hidden>{espelho}</div>
          <textarea
            ref={campo}
            className="capture__input"
            value={valor}
            rows={1}
            onChange={(e) => setValor(e.target.value.replace(/\n/g, " "))}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                guardar();
              }
            }}
            placeholder="O que depende de você?"
            aria-label="O que depende de você?"
            aria-describedby="capture-leitura"
            autoComplete="off"
            enterKeyHint="done"
            maxLength={1000}
          />
        </div>

        <div className="cap-tipo seg" role="group" aria-label="Tipo">
          {TIPOS.map(([v, r, Icone]) => <button key={v} type="button" aria-pressed={tipoEf === v} onClick={() => setTipo(v)}><Icone aria-hidden />{r}</button>)}
        </div>

        {tipoEf === "aguardando" ? (
          <div className="cap-linha">
            <span>De quem</span>
            <input className="input cap-curto" value={quem} onChange={(e) => setQuem(e.target.value)} placeholder="Nome ou o que espera" aria-label="Aguardando quem" />
            <span>Cobrar</span>
            <input className="input cap-data" type="date" value={cobrarEf} min={hoje} onChange={(e) => setCobrar(e.target.value)} aria-label="Cobrar em" />
          </div>
        ) : (
          <div className="cap-linha" role="group" aria-label="Quando">
            <span>{tipoEf === "compromisso" ? "Quando" : "Prazo"}</span>
            {atalhosData.map(([r, d]) => <button key={r} type="button" className="chip" aria-pressed={dataEf === d} onClick={() => setData(d)}>{r}</button>)}
            <input className="input cap-data" type="date" value={dataEf ?? ""} onChange={(e) => setData(e.target.value || null)} aria-label="Escolher o dia" />
            <input className="input cap-hora" type="time" value={horaEf?.slice(0, 5) ?? ""} onChange={(e) => setHora(e.target.value || null)} aria-label="Hora" />
          </div>
        )}

        {tipoEf === "compromisso" && (
          <div className="cap-linha" role="group" aria-label="Duração">
            <span>Duração</span>
            {DURACOES.map(([m, r]) => <button key={m} type="button" className="chip" aria-pressed={duracao === m} onClick={() => setDuracao(m)}>{r}</button>)}
            <input className="input cap-curto" value={local} onChange={(e) => setLocal(e.target.value)} placeholder="Local ou link" aria-label="Local" />
          </div>
        )}

        {dataEf && tipoEf !== "aguardando" && (
          <p className="cap-resumo"><CalendarDays aria-hidden />{primeiraMaiuscula(rotuloData(dataEf, hoje))}{horaEf ? `, ${rotuloHora(horaEf)}` : ""}{tipoEf === "compromisso" ? ` · ${DURACOES.find(([m]) => m === duracao)?.[1] ?? `${duracao} min`}` : ""}</p>
        )}
        {!valor.trim() && <p className="capture__hint">Escreva como fala: <em>Ligar para o contador sexta 10h #iter</em>.</p>}

        {contextos.length > 0 && (
          <div className="capture__where" role="group" aria-label="Onde guardar">
            <span>Onde guardar</span>
            <button type="button" className="chip" aria-pressed={!idContexto} onClick={() => setEscolhido("inbox")}><Inbox aria-hidden />Inbox</button>
            {contextos.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`chip${sugerido?.id === c.id ? " chip--sugestao" : ""}`}
                aria-pressed={idContexto === c.id}
                onClick={() => setEscolhido(idContexto === c.id ? "inbox" : c.id)}
                title={sugerido?.id === c.id ? "Sugestão pelo que você escreveu" : undefined}
              >
                <i className="dot" style={{ background: c.color }} />{c.name}{sugerido?.id === c.id && <small>?</small>}
              </button>
            ))}
          </div>
        )}

        <button type="button" className="cap-mais" aria-expanded={mais} onClick={() => setMais(!mais)}><ChevronDown aria-hidden />Projeto e nota{projeto ? " · 1 projeto" : ""}{nota ? " · nota" : ""}</button>
        {mais && (
          <div className="cap-extra">
            <select className="input" value={projeto} onChange={(e) => setProjeto(e.target.value)} aria-label="Projeto" disabled={tipoEf === "compromisso"}>
              <option value="">Sem projeto</option>
              {projetos.filter((p) => !idContexto || !p.context_id || p.context_id === idContexto).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <textarea className="input input--area" rows={2} value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Nota, links, o que foi combinado" aria-label="Nota" />
          </div>
        )}

        <div className="capture__foot">
          <span className="capture__keys"><kbd>Enter</kbd> adiciona <kbd>Esc</kbd> fecha</span>
          <button className="btn" type="submit" disabled={!valor.trim()}>{tipoEf === "compromisso" ? "Pôr na agenda" : "Adicionar"}</button>
        </div>
      </form>
    </div>
  );
}

const sem = (t: string) => t.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/** "proposta da iter" → Iter Mídia: uma palavra do texto igual ao começo do nome de um contexto (3+ letras) */
function sugerirContexto(texto: string, contextos: ContextItem[]): ContextItem | null {
  const palavras = new Set(sem(texto).split(/[^\p{L}\p{N}]+/u).filter((p) => p.length >= 3));
  return contextos.find((c) => sem(c.name).split(/\s+/).some((p) => p.length >= 3 && palavras.has(p))) ?? null;
}
