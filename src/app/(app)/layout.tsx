import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Shell, type ContextItem } from "@/components/Shell";
import { agoraHora, hojeISO } from "@/lib/datas";
import { montarHoje } from "@/lib/hoje";
import { moduloLigado } from "@/lib/modulos";
import type { Perfil, Responsabilidade } from "@/lib/tipos";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: perfil }, { data: contextos }, { count: inbox }, { data: abertas }] = await Promise.all([
    supabase.from("profiles").select("user_id, display_name, modules, onboarding, onboarded_at").maybeSingle(),
    supabase.from("contexts").select("id, name, color, kind").eq("archived", false).order("position", { ascending: true }),
    supabase.from("responsibilities").select("id", { count: "exact", head: true }).is("context_id", null).neq("state", "concluida"),
    supabase.from("responsibilities").select("id, state, due_date, due_time, today, follow_up_on, created_at").neq("state", "concluida"),
  ]);

  // Primeira vez: as perguntas do começo montam o Rumo da pessoa
  const p = perfil as Perfil | null;
  if (!p?.onboarded_at) redirect("/comecar");

  const dia = montarHoje((abertas ?? []) as Responsabilidade[], [], [], hojeISO(), agoraHora());
  const nHoje = dia.atencao.length + dia.doDia.length + (dia.proximo?.tipo === "responsabilidade" ? 1 : 0);
  const nome = p.display_name || (user.email ?? "").split("@")[0];

  return (
    <Shell
      contexts={(contextos ?? []) as ContextItem[]}
      nome={nome}
      email={user.email ?? ""}
      inbox={inbox ?? 0}
      hoje={nHoje}
      atencao={dia.numeros.atrasadas + dia.numeros.cobrar}
      negocios={moduloLigado(p.modules, "negocios")}
    >
      {children}
    </Shell>
  );
}
