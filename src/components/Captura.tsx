"use client";

import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, Inbox, ListChecks, Scale, X } from "lucide-react";
import { capturar } from "@/app/(app)/acoes";
import { lerCaptura } from "@/lib/captura";
import { hojeISO, rotuloData, rotuloHora } from "@/lib/datas";
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

export function Captura({ aberta, abrir, fechar, contextos, textoInicial = "", contextoInicial = null }: { aberta: boolean; abrir: () => void; fechar: () => void; contextos: ContextItem[]; textoInicial?: string; contextoInicial?: string | null }) {
  const [valor, setValor] = useState("");
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
    setValor("");
    setEscolhido(null);
    fechar();
    avisar({ texto: "Guardando…", fixo: true });
    let r: Awaited<ReturnType<typeof capturar>>;
    try {
      r = await capturar(texto, onde);
    } catch {
      r = { ok: false, erro: "Não foi possível guardar. Verifique a conexão e tente de novo." };
    }
    if (!r.ok) {
      avisar({ texto: r.erro, fixo: true, acao: { rotulo: "Reabrir", fazer: () => { setValor(texto); abrir(); } } });
      return;
    }
    const lugar = r.contexto ? `em ${r.contexto}` : "na Inbox";
    const quando = r.due_date ? ` · ${rotuloData(r.due_date, hoje)}${r.due_time ? ` ${rotuloHora(r.due_time)}` : ""}` : "";
    avisar({ texto: `Guardado ${lugar}${quando}.`, link: { rotulo: "Abrir", href: `/responsabilidades/${r.id}` } });
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

        <div id="capture-leitura" aria-live="polite">
          {leitura ? (
            <div className="capture__chips">
              {leitura.due_date && (
                <span className="chip">
                  <CalendarDays aria-hidden />
                  {primeiraMaiuscula(rotuloData(leitura.due_date, hoje))}{leitura.due_time ? `, ${leitura.due_time}` : ""}
                </span>
              )}
              <span className="chip">
                {leitura.kind === "decidir" ? <><Scale aria-hidden />Decisão</> : <><ListChecks aria-hidden />Responsabilidade</>}
              </span>
            </div>
          ) : (
            <p className="capture__hint">
              Escreva como fala: <em>Ligar para o contador sexta 10h</em>. Data e hora o Rumo entende sozinho.
            </p>
          )}
        </div>

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

        <div className="capture__foot">
          <span className="capture__keys"><kbd>Enter</kbd> adiciona <kbd>Esc</kbd> fecha</span>
          <button className="btn" type="submit" disabled={!valor.trim()}>Adicionar</button>
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
