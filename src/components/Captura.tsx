"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
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

export function Captura({ aberta, abrir, fechar, contextos }: { aberta: boolean; abrir: () => void; fechar: () => void; contextos: ContextItem[] }) {
  const [valor, setValor] = useState("");
  const campo = useRef<HTMLTextAreaElement>(null);
  const avisar = useAvisar();
  const hoje = hojeISO();

  const leitura = useMemo(() => (valor.trim() ? lerCaptura(valor, contextos, hoje) : null), [valor, contextos, hoje]);
  const contexto = contextos.find((c) => c.id === leitura?.context_id);

  useEffect(() => {
    if (!aberta) return;
    requestAnimationFrame(() => {
      const el = campo.current;
      if (!el) return;
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
    setValor("");
    fechar();
    avisar({ texto: "Guardando…", fixo: true });
    let r: Awaited<ReturnType<typeof capturar>>;
    try {
      r = await capturar(texto);
    } catch {
      r = { ok: false, erro: "Não foi possível guardar. Verifique a conexão e tente de novo." };
    }
    if (!r.ok) {
      avisar({ texto: r.erro, fixo: true, acao: { rotulo: "Reabrir", fazer: () => { setValor(texto); abrir(); } } });
      return;
    }
    const onde = r.contexto ? `em ${r.contexto}` : "na Inbox";
    const quando = r.due_date ? ` · ${rotuloData(r.due_date, hoje)}${r.due_time ? ` ${rotuloHora(r.due_time)}` : ""}` : "";
    avisar({ texto: `Guardado ${onde}${quando}.`, link: { rotulo: "Abrir", href: `/responsabilidades/${r.id}` } });
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
              {contexto ? (
                <span className="chip"><i className="dot" style={{ background: contexto.color }} />{contexto.name}</span>
              ) : (
                <span className="chip"><Inbox aria-hidden />Inbox</span>
              )}
              <span className="chip">
                {leitura.kind === "decidir" ? <><Scale aria-hidden />Decisão</> : <><ListChecks aria-hidden />Responsabilidade</>}
              </span>
            </div>
          ) : (
            <p className="capture__hint">
              Escreva como fala: <em>Ligar para o contador sexta 10h #{contextos[0] ? exemploTag(contextos[0].name) : "trabalho"}</em>
            </p>
          )}
          {leitura?.tagDesconhecida && (
            <p className="capture__hint" style={{ marginTop: 8 }}>#{leitura.tagDesconhecida} não é um dos seus contextos e fica no título.</p>
          )}
        </div>

        <div className="capture__foot">
          <span className="capture__keys"><kbd>Enter</kbd> adiciona <kbd>Esc</kbd> fecha</span>
          <button className="btn" type="submit" disabled={!valor.trim()}>Adicionar</button>
        </div>
      </form>
    </div>
  );
}

function exemploTag(nome: string) {
  return nome.split(/\s+/)[0].normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}
