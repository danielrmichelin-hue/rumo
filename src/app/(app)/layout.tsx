import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Shell, type ContextItem, type EntradaModulo } from "@/components/Shell";
import { agoraHora, hojeISO } from "@/lib/datas";
import { montarHoje } from "@/lib/hoje";
import { moduloLigado } from "@/lib/modulos";
import type { Perfil, Responsabilidade } from "@/lib/tipos";
import { CAMPOS_ROTINA, desdeMarcas, eDoDia, feitaEm, type Marcacao, type Rotina } from "@/lib/rotinas";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const hoje = hojeISO();

  const [{ data: perfil }, { data: contextos }, { count: inbox }, { data: abertas }, { count: nRotas }, { count: nEstudos }, { data: rotinasDb }, { data: marcas }, { count: nNotas }] = await Promise.all([
    supabase.from("profiles").select("user_id, display_name, modules, onboarding, onboarded_at").maybeSingle(),
    supabase.from("contexts").select("id, name, color, kind").eq("archived", false).order("position", { ascending: true }),
    supabase.from("responsibilities").select("id", { count: "exact", head: true }).is("context_id", null).neq("state", "concluida"),
    supabase.from("responsibilities").select("id, state, due_date, due_time, today, follow_up_on, created_at").neq("state", "concluida"),
    supabase.from("routes").select("id", { count: "exact", head: true }).eq("status", "ativa"),
    supabase.from("study_courses").select("id", { count: "exact", head: true }).eq("status", "ativo"),
    supabase.from("routines").select(CAMPOS_ROTINA).eq("status", "ativa").order("position"),
    supabase.from("routine_checks").select("routine_id, done_on").gte("done_on", desdeMarcas(hoje)),
    supabase.from("notes").select("id", { count: "exact", head: true }),
  ]);

  // Primeira vez: as perguntas do começo montam o Rumo da pessoa
  const p = perfil as Perfil | null;
  if (!p?.onboarded_at) redirect("/comecar");

  const dia = montarHoje((abertas ?? []) as Responsabilidade[], [], [], hoje, agoraHora());
  const nHoje = dia.atencao.length + dia.doDia.length + (dia.proximo?.tipo === "responsabilidade" ? 1 : 0);
  const nome = p.display_name || (user.email ?? "").split("@")[0];
  const rotinas = (rotinasDb ?? []) as Rotina[];
  const marcacoes = (marcas ?? []) as Marcacao[];
  const rotinasHoje = rotinas.filter((r) => eDoDia(r, marcacoes, hoje) && !feitaEm(r, marcacoes, hoje)).length;

  // Lateral: uma entrada por módulo (a página dele é o lugar central), com o número que importa
  const liga = (chave: Parameters<typeof moduloLigado>[1], tem: boolean) => moduloLigado(p.modules, chave) || tem;
  const modulos: EntradaModulo[] = [];
  if (liga("estudos", !!nEstudos)) modulos.push({ chave: "estudos", n: nEstudos ?? 0 });
  if (liga("rotinas", rotinas.length > 0)) modulos.push({ chave: "rotinas", n: rotinasHoje, quente: rotinasHoje > 0 });
  if (liga("rotas", !!nRotas)) modulos.push({ chave: "rotas", n: nRotas ?? 0 });
  if (liga("notas", !!nNotas)) modulos.push({ chave: "notas", n: 0 });

  return (
    <Shell
      contexts={(contextos ?? []) as ContextItem[]}
      nome={nome}
      email={user.email ?? ""}
      inbox={inbox ?? 0}
      hoje={nHoje}
      atencao={dia.numeros.atrasadas + dia.numeros.cobrar}
      negocios={moduloLigado(p.modules, "negocios")}
      modulos={modulos}
    >
      {children}
    </Shell>
  );
}
