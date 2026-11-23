import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Shell, type ContextItem, type EntradaModulo } from "@/components/Shell";
import { agoraHora, hojeISO } from "@/lib/datas";
import { montarHoje } from "@/lib/hoje";
import type { Perfil, Responsabilidade } from "@/lib/tipos";
import { CAMPOS_ROTINA, desdeMarcas, eDoDia, feitaEm, type Marcacao, type Rotina } from "@/lib/rotinas";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const hoje = hojeISO();

  const [{ data: perfil }, { data: contextos }, { count: inbox }, { data: abertas }, { count: nRotas }, { count: nEstudos }, { data: rotinasDb }, { data: marcas }, { data: projetos }] = await Promise.all([
    supabase.from("profiles").select("display_name, hidden_areas").maybeSingle(),
    supabase.from("contexts").select("id, name, color, kind").eq("archived", false).order("position", { ascending: true }),
    supabase.from("responsibilities").select("id", { count: "exact", head: true }).is("context_id", null).is("project_id", null).is("route_id", null).neq("state", "concluida"),
    supabase.from("responsibilities").select("id, state, due_date, due_time, today, follow_up_on, created_at").neq("state", "concluida"),
    supabase.from("routes").select("id", { count: "exact", head: true }).eq("status", "ativa"),
    supabase.from("study_courses").select("id", { count: "exact", head: true }).eq("status", "ativo"),
    supabase.from("routines").select(CAMPOS_ROTINA).eq("status", "ativa").order("position"),
    supabase.from("routine_checks").select("routine_id, done_on").gte("done_on", desdeMarcas(hoje)),
    supabase.from("projects").select("id, name, context_id").eq("status", "ativo").order("name"),
  ]);

  const p = perfil as Perfil | null;
  const dia = montarHoje((abertas ?? []) as Responsabilidade[], [], [], hoje, agoraHora());
  const nHoje = dia.atencao.length + dia.doDia.length + (dia.proximo?.tipo === "responsabilidade" ? 1 : 0);
  const nome = p?.display_name || (user.email ?? "").split("@")[0];
  const rotinas = (rotinasDb ?? []) as Rotina[];
  const marcacoes = (marcas ?? []) as Marcacao[];
  const pendente = (r: Rotina) => eDoDia(r, marcacoes, hoje) && !feitaEm(r, marcacoes, hoje);
  const rotinasHoje = rotinas.filter((r) => !r.dose && pendente(r)).length;
  const remediosHoje = rotinas.filter((r) => r.dose && pendente(r)).length;

  // Lateral fixa: cada área da vida tem a sua página, com o número que importa hoje
  const modulos = ([
    { chave: "negocios", n: 0 },
    { chave: "estudos", n: nEstudos ?? 0 },
    { chave: "financas", n: 0 },
    { chave: "saude", n: remediosHoje, quente: remediosHoje > 0 },
    { chave: "rotinas", n: rotinasHoje, quente: rotinasHoje > 0 },
    { chave: "rotas", n: nRotas ?? 0 },
    { chave: "notas", n: 0 },
  ] as EntradaModulo[]).filter((m) => !(perfil?.hidden_areas ?? []).includes(m.chave));

  return (
    <Shell
      contexts={(contextos ?? []) as ContextItem[]}
      projetos={projetos ?? []}
      nome={nome}
      email={user.email ?? ""}
      inbox={inbox ?? 0}
      hoje={nHoje}
      atencao={dia.numeros.atrasadas + dia.numeros.cobrar}
      modulos={modulos}
    >
      {children}
    </Shell>
  );
}
