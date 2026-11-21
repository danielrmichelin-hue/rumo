"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/Logo";

function traduzir(mensagem: string): string {
  const m = mensagem.toLowerCase();
  if (m.includes("invalid login credentials")) return "E-mail ou senha não conferem.";
  if (m.includes("rate limit") || m.includes("too many")) return "Muitas tentativas seguidas. Espere um minuto e tente de novo.";
  return "Não foi possível entrar. Tente de novo.";
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [ver, setVer] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (!email.trim() || !senha) return setErro("Digite o e-mail e a senha.");
    setEnviando(true);
    const { data, error } = await createClient().auth.signInWithPassword({ email: email.trim(), password: senha });
    setEnviando(false);
    if (error || !data.session) return setErro(traduzir(error?.message ?? ""));
    router.replace("/hoje");
    router.refresh();
  }

  return (
    <main className="auth auth--simples">
      <form className="auth__card" onSubmit={onSubmit} noValidate>
        <Logo forma="horizontal" alt="Rumo" className="auth__logo" />
        <label className="field">
          E-mail
          <input className="input" type="email" required autoComplete="email" value={email} onChange={(e) => { setEmail(e.target.value); setErro(null); }} />
        </label>
        <div className="field">
          <label htmlFor="senha">Senha</label>
          <span className="password">
            <input id="senha" className="input" type={ver ? "text" : "password"} required autoComplete="current-password" value={senha} onChange={(e) => { setSenha(e.target.value); setErro(null); }} />
            <button type="button" className="icon-btn" onClick={() => setVer(!ver)} aria-label={ver ? "Esconder senha" : "Mostrar senha"}>
              {ver ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </span>
        </div>
        <button className="btn btn--lg" type="submit" disabled={enviando}>{enviando ? "Entrando…" : "Entrar"}</button>
        {erro && <p className="note note--err" role="alert">{erro}</p>}
      </form>
    </main>
  );
}
