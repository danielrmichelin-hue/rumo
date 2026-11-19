"use client";

import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { CHAVE_TEMA as CHAVE } from "@/lib/tema";

export type Tema = "claro" | "escuro" | "auto";

function ler(): Tema {
  try {
    const t = localStorage.getItem(CHAVE);
    return t === "claro" || t === "escuro" ? t : "auto";
  } catch {
    return "auto";
  }
}

function aplicar(tema: Tema) {
  const escuro = tema === "escuro" || (tema === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = escuro ? "dark" : "light";
  document.querySelector('meta[name="theme-color"]:not([media])')?.remove();
  const meta = document.createElement("meta");
  meta.name = "theme-color";
  meta.content = escuro ? "#120D1B" : "#F8F7F4";
  document.head.appendChild(meta);
}

export function useTema() {
  const [tema, setTema] = useState<Tema>("auto");

  useEffect(() => {
    setTema(ler());
  }, []);

  useEffect(() => {
    if (tema !== "auto") return;
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const seguir = () => aplicar("auto");
    mq.addEventListener("change", seguir);
    return () => mq.removeEventListener("change", seguir);
  }, [tema]);

  function escolher(novo: Tema) {
    try {
      localStorage.setItem(CHAVE, novo);
    } catch {}
    aplicar(novo);
    setTema(novo);
  }

  return { tema, escolher };
}

const OPCOES: Array<{ v: Tema; r: string; Icon: typeof Sun }> = [
  { v: "claro", r: "Claro", Icon: Sun },
  { v: "escuro", r: "Escuro", Icon: Moon },
  { v: "auto", r: "Automático", Icon: Monitor },
];

export function SeletorTema() {
  const { tema, escolher } = useTema();
  return (
    <div className="seg" role="group" aria-label="Tema">
      {OPCOES.map(({ v, r, Icon }) => (
        <button key={v} type="button" aria-pressed={tema === v} onClick={() => escolher(v)} title={v === "auto" ? "Segue o aparelho" : undefined}>
          <Icon aria-hidden />{r}
        </button>
      ))}
    </div>
  );
}

