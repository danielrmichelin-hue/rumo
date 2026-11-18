"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CalendarDays, Clock, Inbox, Scale, X } from "lucide-react";
import { capturar } from "@/app/(app)/acoes";
import { lerCaptura } from "@/lib/captura";
import { hojeISO, rotuloData, rotuloHora } from "@/lib/datas";
import type { ContextItem } from "./Shell";

type Aviso = { texto: string; id?: string; falhou?: string };

/** Atalho global: C ou N abre a captura quando não se está digitando. */
export function useAtalhoCaptura(abrir: () => void) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      const alvo = e.target as HTMLElement | null;
      if (alvo && (alvo.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(alvo.tagName))) return;
      if (e.key === "c" || e.key === "n" || e.key === "C" || e.key === "N") {
        e.preventDefault();
        abrir();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [abrir]);
}

export function Captura({ aberta, abrir, fechar, contextos }: { aberta: boolean; abrir: () => void; fechar: () => void; contextos: ContextItem[] }) {
  const [valor, setValor] = useState("");
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const campo = useRef<HTMLInputElement>(null);
  const hoje = hojeISO();

  const leitura = useMemo(() => (valor.trim() ? lerCaptura(valor, contextos, hoje) : null), [valor, contextos, hoje]);
  const contexto = contextos.find((c) => c.id === leitura?.context_id);

  useEffect(() => {
    if (aberta) requestAnimationFrame(() => campo.current?.focus());
  }, [aberta]);

  useEffect(() => {
    if (!aviso || aviso.texto === "Guardando…") return;
    const t = setTimeout(() => setAviso(null), aviso.falhou ? 10000 : 5000);
    return () => clearTimeout(t);
  }, [aviso]);

  // Fecha na hora e guarda em segundo plano: dá para capturar a próxima sem esperar
  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    const texto = valor.trim();
    if (!texto) return;
    setValor("");
    fechar();
    setAviso({ texto: "Guardando…" });
    let r: Awaited<ReturnType<typeof capturar>>;
    try {
      r = await capturar(texto);
    } catch {
      r = { ok: false, erro: "Sem conexão. Nada foi perdido: reabra e guarde de novo." };
    }
    if (!r.ok) {
      setAviso({ texto: r.erro, falhou: texto });
      return;
    }
    const onde = r.contexto ? `em ${r.contexto}` : "na Inbox";
    const quando = r.due_date ? ` · ${rotuloData(r.due_date, hoje)}${r.due_time ? ` ${rotuloHora(r.due_time)}` : ""}` : "";
    setAviso({ id: r.id, texto: `Guardado ${onde}${quando}` });
  }

  function reabrir(texto: string) {
    setAviso(null);
    setValor(texto);
    abrir();
  }

  return (
    <>
      {aberta && (
        <div className="capture" role="dialog" aria-modal="true" aria-label="Captura rápida" onMouseDown={(e) => e.target === e.currentTarget && fechar()}>
          <form className="capture__box" onSubmit={guardar} onKeyDown={(e) => e.key === "Escape" && fechar()}>
            <div className="capture__row">
              <input
                ref={campo}
                className="capture__input"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder="O que depende de você?"
                aria-label="O que depende de você?"
                aria-describedby="capture-preview"
                autoComplete="off"
                enterKeyHint="done"
                maxLength={1000}
              />
              <button type="button" className="icon-btn" onClick={fechar} aria-label="Fechar"><X size={18} /></button>
            </div>

            <div id="capture-preview" className="capture__preview" aria-live="polite">
              {leitura ? (
                <>
                  <span className="capture__title">{leitura.title}</span>
                  <span className="props">
                    {leitura.kind === "decidir" && <span className="prop"><Scale size={14} aria-hidden />Decisão</span>}
                    {contexto ? (
                      <span className="prop"><i className="dot" style={{ background: contexto.color }} />{contexto.name}</span>
                    ) : (
                      <span className="prop"><Inbox size={14} aria-hidden />Inbox</span>
                    )}
                    {leitura.due_date && (
                      <span className="prop"><CalendarDays size={14} aria-hidden />{rotuloData(leitura.due_date, hoje)}</span>
                    )}
                    {leitura.due_time && <span className="prop"><Clock size={14} aria-hidden />{rotuloHora(leitura.due_time)}</span>}
                  </span>
                  {leitura.tagDesconhecida && (
                    <span className="capture__hint">#{leitura.tagDesconhecida} não é um contexto seu e fica no título.</span>
                  )}
                </>
              ) : (
                <span className="capture__hint">
                  Escreva como fala: <em>Enviar proposta sexta 10h #{contextos[0] ? exemploTag(contextos[0].name) : "trabalho"}</em>
                </span>
              )}
            </div>

            <div className="capture__foot">
              <span className="capture__keys"><kbd>Enter</kbd> guarda <kbd>Esc</kbd> fecha</span>
              <button className="btn btn--sm" type="submit" disabled={!valor.trim()}>Guardar</button>
            </div>
          </form>
        </div>
      )}

      {aviso && (
        <div className="toast" role="status">
          {aviso.texto}
          {aviso.id && <Link href={`/responsabilidades/${aviso.id}`} onClick={() => setAviso(null)}>Abrir</Link>}
          {aviso.falhou && <button type="button" onClick={() => reabrir(aviso.falhou!)}>Reabrir</button>}
        </div>
      )}
    </>
  );
}

function exemploTag(nome: string) {
  return nome.split(/\s+/)[0].normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}
