import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Comeco } from "@/components/Comeco";
import type { ChaveEscolha } from "@/lib/modulos";

export const metadata = { title: "Começar" };

export default async function Page() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: perfil }, { data: contextos }] = await Promise.all([
    supabase.from("profiles").select("display_name, onboarding, onboarded_at").maybeSingle(),
    supabase.from("contexts").select("name, kind").eq("archived", false).order("position"),
  ]);

  const o = (perfil?.onboarding ?? {}) as Record<string, unknown>;
  const lista = (v: unknown) => (Array.isArray(v) ? (v as string[]) : []);
  const empresas = (contextos ?? []).filter((c) => c.kind === "empresa").map((c) => c.name);
  const areas = (contextos ?? []).filter((c) => c.kind === "area" && c.name !== "Trabalho").map((c) => c.name);

  // Refazer (em Ajustes) começa com as respostas atuais marcadas; o que já existe aparece marcado também
  const inicial = {
    nome: perfil?.display_name || (user.email ?? "").split("@")[0],
    escolhas: lista(o.escolhas) as ChaveEscolha[],
    respostas: {
      trabalho: lista(o.trabalho_origens),
      vida: [...new Set([...lista(o.vida), ...areas])],
      negocios: [...new Set([...lista(o.negocios), ...empresas])],
      projetos: lista(o.projetos),
      estudos: lista(o.estudos),
      rotinas: lista(o.rotinas),
      objetivos: typeof o.objetivo === "string" ? [o.objetivo] : [],
    },
  };
  if (!inicial.escolhas.length) {
    if (empresas.length) inicial.escolhas.push("negocios");
    if (areas.length) inicial.escolhas.push("vida");
  }

  return <Comeco inicial={inicial} refazendo={!!perfil?.onboarded_at} />;
}
