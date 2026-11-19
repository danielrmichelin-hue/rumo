"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/Logo";

type Modo = "entrar" | "criar";

/** Mensagens do Supabase traduzidas para a voz do Rumo. */
function traduzir(mensagem: string, modo: Modo): string {
  const m = mensagem.toLowerCase();
  if (m.includes("invalid login credentials")) return "E-mail ou senha não conferem.";
  if (m.includes("already registered") || m.includes("already been registered")) return "Já existe uma conta com este e-mail. Entre com a sua senha.";
  if (m.includes("email not confirmed")) return "Este e-mail ainda não foi confirmado. Abra a mensagem de confirmação que o Supabase enviou.";
  if (m.includes("password") && (m.includes("at least") || m.includes("weak") || m.includes("short"))) return "A senha precisa ter pelo menos 8 caracteres.";
  if (m.includes("signups not allowed") || m.includes("signup is disabled")) return "Novos cadastros estão fechados.";
  if (m.includes("rate limit") || m.includes("too many")) return "Muitas tentativas seguidas. Espere um minuto e tente de novo.";
  if (m.includes("invalid") && m.includes("email")) return "Confira o e-mail digitado.";
  return modo === "entrar" ? "Não foi possível entrar. Tente de novo." : "Não foi possível criar a conta. Tente de novo.";
}

export default function LoginPage() {
  const router = useRouter();
  const [modo, setModo] = useState<Modo>("entrar");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [ver, setVer] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  function trocar(novo: Modo) {
    setModo(novo);
    setErro(null);
    setAviso(null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setAviso(null);
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setErro("Confira o e-mail digitado.");
      return;
    }
    if (!senha) {
      setErro("Digite a sua senha.");
      return;
    }
    if (modo === "criar" && senha.length < 8) {
      setErro("A senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    setEnviando(true);
    const supabase = createClient();
    const { data, error } =
      modo === "entrar"
        ? await supabase.auth.signInWithPassword({ email: email.trim(), password: senha })
        : await supabase.auth.signUp({ email: email.trim(), password: senha, options: { emailRedirectTo: `${window.location.origin}/auth/callback` } });
    setEnviando(false);

    if (error) {
      setErro(traduzir(error.message, modo));
      return;
    }
    if (data.session) {
      router.replace("/hoje");
      router.refresh();
      return;
    }
    // Conta criada, mas o Supabase ainda pede confirmação por e-mail
    setAviso("Conta criada. Falta confirmar o e-mail: abra a mensagem que chegou e depois entre aqui com a sua senha.");
    setModo("entrar");
  }

  return (
    <main className="auth">
      <section className="auth__brand" aria-hidden>
        <img src="/brand/rumo-logo-horizontal-light.svg" alt="" />
        <img src="/brand/rumo-symbol-light.svg" alt="" className="auth__symbol" />
        <p className="auth__promise">Clareza para o seu próximo passo.</p>
      </section>

      <form className="auth__card" onSubmit={onSubmit} noValidate>
        <Logo forma="horizontal" alt="Rumo" className="auth__logo" />
        <h1>{modo === "entrar" ? "Que bom te ver de novo." : "Boas-vindas ao Rumo."}</h1>
        <p>{modo === "entrar" ? "Continue de onde parou." : "Crie sua conta com e-mail e senha."}</p>

        <div className="seg" role="radiogroup" aria-label="Entrar ou criar conta">
          {(["entrar", "criar"] as const).map((m) => (
            <label key={m}>
              <input type="radio" name="modo" checked={modo === m} onChange={() => trocar(m)} />
              <span>{m === "entrar" ? "Entrar" : "Criar conta"}</span>
            </label>
          ))}
        </div>

        <label className="field">
          E-mail
          <input className="input" type="email" required autoComplete="email" value={email} onChange={(e) => { setEmail(e.target.value); setErro(null); }} />
        </label>

        <div className="field">
          <label htmlFor="senha">Senha</label>
          <span className="password">
            <input
              id="senha"
              className="input"
              type={ver ? "text" : "password"}
              required
              minLength={modo === "criar" ? 8 : undefined}
              autoComplete={modo === "entrar" ? "current-password" : "new-password"}
              value={senha}
              onChange={(e) => { setSenha(e.target.value); setErro(null); }}
            />
            <button type="button" className="icon-btn" onClick={() => setVer(!ver)} aria-label={ver ? "Esconder senha" : "Mostrar senha"}>
              {ver ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </span>
          {modo === "criar" && <span className="field__hint">Pelo menos 8 caracteres.</span>}
        </div>

        <button className="btn btn--lg" type="submit" disabled={enviando}>
          {enviando ? (modo === "entrar" ? "Entrando…" : "Criando…") : modo === "entrar" ? "Entrar" : "Criar conta"}
        </button>

        {aviso && <p className="note" role="status">{aviso}</p>}
        {erro && <p className="note note--err" role="alert">{erro}</p>}
      </form>
    </main>
  );
}
