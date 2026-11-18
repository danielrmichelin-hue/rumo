"use client";

import { useActionState } from "react";
import { salvarNome, type EstadoForm } from "@/app/(app)/acoes";

export function FormNome({ nome }: { nome: string }) {
  const [r, enviar, pendente] = useActionState<EstadoForm, FormData>(salvarNome, {});
  return (
    <form action={enviar} style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
      <label className="field" style={{ flex: 1, minWidth: 200 }}>
        <span className="sr-only">Nome</span>
        <input className="input" name="nome" defaultValue={nome} maxLength={60} placeholder="Seu nome" />
      </label>
      <button className="btn btn--line" type="submit" disabled={pendente}>{pendente ? "Guardando…" : "Guardar"}</button>
      {r.ok && <span className="field__hint" role="status">Guardado.</span>}
      {r.erro && <span className="note note--err" role="alert">{r.erro}</span>}
    </form>
  );
}
