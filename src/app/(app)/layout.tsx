import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Shell, type ContextItem } from "@/components/Shell";
import { agoraHora, hojeISO } from "@/lib/datas";
import { montarHoje } from "@/lib/hoje";
import { moduloLigado } from "@/lib/modulos";
import type { Perfil, Responsabilidade } from "@/lib/tipos";
import { CAMPOS_ROTA, normalizar, resumirRota, rotuloAnel, type Marco } from "@/lib/rotas";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: perfil }, { data: contextos }, { count: inbox }, { data: abertas }, { data: rotas }, { data: marcos }] = await Promise.all([
    supabase.from("profiles").select("user_id, display_name, modules, onboarding, onboarded_at").maybeSingle(),
    supabase.from("contexts").select("id, name, color, kind").eq("archived", false).order("position", { ascending: true }),
    supabase.from("responsibilities").select("id", { count: "exact", head: true }).is("context_id", null).neq("state", "concluida"),
    supabase.from("responsibilities").select("id, state, due_date, due_time, today, follow_up_on, created_at").neq("state", "concluida"),
    supabase.from("routes").select(CAMPOS_ROTA).eq("status", "ativa").order("created_at"),
    supabase.from("route_milestones").select("id, route_id, title, position, due_date, done_at"),
  ]);

  // Primeira vez: as perguntas do começo montam o Rumo da pessoa
  const p = perfil as Perfil | null;
  if (!p?.onboarded_at) redirect("/comecar");

  const dia = montarHoje((abertas ?? []) as Responsabilidade[], [], [], hojeISO(), agoraHora());
  const nHoje = dia.atencao.length + dia.doDia.length + (dia.proximo?.tipo === "responsabilidade" ? 1 : 0);
  const nome = p.display_name || (user.email ?? "").split("@")[0];
  const listaRotas = (rotas ?? []).map((x) => {
    const r = normalizar(x);
    const ms = ((marcos ?? []) as Marco[]).filter((m) => m.route_id === r.id);
    const resumo = resumirRota(r, ms);
    return { id: r.id, title: r.title, pct: Math.round(resumo.pct * 100), rotulo: rotuloAnel(r, resumo, ms) };
  });

  return (
    <Shell
      contexts={(contextos ?? []) as ContextItem[]}
      nome={nome}
      email={user.email ?? ""}
      inbox={inbox ?? 0}
      hoje={nHoje}
      atencao={dia.numeros.atrasadas + dia.numeros.cobrar}
      negocios={moduloLigado(p.modules, "negocios")}
      rotas={moduloLigado(p.modules, "rotas") || listaRotas.length ? listaRotas : null}
    >
      {children}
    </Shell>
  );
}
