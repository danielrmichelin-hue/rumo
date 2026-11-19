import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { NovaRota } from "@/components/NovaRota";
import type { TipoRota } from "@/lib/rotas";
import { ehId } from "@/lib/datas";

export const metadata = { title: "Nova Rota" };

// A resposta de "Qual é o primeiro destino?" (perguntas do começo) já escolhe o tipo
const DO_COMECO: Record<string, TipoRota> = {
  "Guardar dinheiro": "financeiro",
  "Terminar um livro": "leitura",
  "Concluir um curso": "estudos",
  "Abrir um negócio": "negocios",
};

export default async function Page({ searchParams }: { searchParams: Promise<{ tipo?: string; curso?: string }> }) {
  const { tipo, curso: cursoId } = await searchParams;
  const supabase = await createClient();
  const [{ data: contextos }, { data: perfil }, { count }] = await Promise.all([
    supabase.from("contexts").select("id, name, color, kind").eq("archived", false).order("position"),
    supabase.from("profiles").select("onboarding").maybeSingle(),
    supabase.from("routes").select("id", { count: "exact", head: true }),
  ]);
  const { data: curso } = ehId(cursoId)
    ? await supabase.from("study_courses").select("id, title, context_id, total_lessons, done_lessons").eq("id", cursoId).maybeSingle()
    : { data: null };
  const objetivo = (perfil?.onboarding as { objetivo?: string } | null)?.objetivo ?? null;
  const valido = ["financeiro", "leitura", "estudos", "negocios"].includes(tipo ?? "") ? (tipo as TipoRota) : null;
  const sugerido = !count && objetivo ? DO_COMECO[objetivo] ?? null : null;

  return (
    <div className="page page--wide">
      <div className="page__head">
        <div>
          {curso ? (
            <p className="crumb"><Link href="/estudos">Estudos</Link><ChevronRight aria-hidden /><Link href={`/estudos/${curso.id}`}>{curso.title}</Link><ChevronRight aria-hidden />{valido === "leitura" ? "Nova leitura" : "Nova Rota"}</p>
          ) : (
            <p className="crumb"><Link href="/rotas">Rotas</Link><ChevronRight aria-hidden />Nova Rota</p>
          )}
          <h1 className="page__t">{curso && valido === "leitura" ? "O que você vai ler?" : curso ? "Quando você quer terminar?" : "Para onde você quer ir?"}</h1>
          <p className="page__sub">
            {curso
              ? `Fica ligada a ${curso.title}${valido === "estudos" ? ": cada aula registrada no curso conta na Rota." : "."}`
              : sugerido && !valido
              ? <>Você contou que o primeiro destino é <b>{objetivo?.toLowerCase()}</b>. Escolha o tipo e ajuste os números: o Rumo calcula o ritmo e traz o próximo passo para o Hoje.</>
              : "Escolha um tipo e ajuste os números. O Rumo calcula o ritmo e traz o próximo passo para o Hoje."}
          </p>
        </div>
      </div>
      <NovaRota contextos={contextos ?? []} tipoInicial={valido ?? sugerido} curso={curso} />
    </div>
  );
}
