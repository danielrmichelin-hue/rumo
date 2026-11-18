"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setState(error ? "error" : "sent");
  }

  return (
    <main className="auth">
      <form className="auth__card" onSubmit={onSubmit}>
        <img src="/brand/rumo-logo-horizontal.svg" alt="Rumo" className="logo-light" />
        <img src="/brand/rumo-logo-horizontal-light.svg" alt="Rumo" className="logo-dark" />
        <h1>Clareza para o seu próximo passo.</h1>
        <p>Entre com o seu e-mail. Mandamos um link de acesso, sem senha.</p>
        <label className="field">
          E-mail
          <input className="input" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <button className="btn" type="submit" disabled={state === "sending"}>
          {state === "sending" ? "Enviando…" : "Receber link de acesso"}
        </button>
        {state === "sent" && <p className="note" role="status">Link enviado. Abra o e-mail neste aparelho para entrar.</p>}
        {state === "error" && <p className="note note--err" role="alert">Não foi possível enviar o link. Confira o e-mail e tente de novo.</p>}
      </form>
    </main>
  );
}
