import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { NovaRota } from "@/components/NovaRota";
import type { TipoRota } from "@/lib/rotas";

export const metadata = { title: "Nova Rota" };

// A resposta de "Qual é o primeiro destino?" (perguntas do começo) já escolhe o tipo
const DO_COMECO: Record<string, TipoRota> = {
  "Guardar dinheiro": "financeiro",
  "Terminar um livro": "leitura",
  "Concluir um curso": "estudos",
  "Abrir um negócio": "negocios",
};

export default async function Page({ searchParams }: { searchParams: Promise<{ tipo?: string }> }) {
  const { tipo } = await searchParams;
  const supabase = await createClient();
  const [{ data: contextos }, { data: perfil }, { count }] = await Promise.all([
    supabase.from("contexts").select("id, name, color, kind").eq("archived", false).order("position"),
    supabase.from("profiles").select("onboarding").maybeSingle(),
    supabase.from("routes").select("id", { count: "exact", head: true }),
  ]);
  const objetivo = (perfil?.onboarding as { objetivo?: string } | null)?.objetivo ?? null;
  const valido = ["financeiro", "leitura", "estudos", "negocios"].includes(tipo ?? "") ? (tipo as TipoRota) : null;
  const sugerido = !count && objetivo ? DO_COMECO[objetivo] ?? null : null;

  return (
    <div className="page page--wide">
      <div className="page__head">
        <div>
          <p className="crumb"><Link href="/rotas">Rotas</Link><ChevronRight aria-hidden />Nova Rota</p>
          <h1 className="page__t">Para onde você quer ir?</h1>
          <p className="page__sub">
            {sugerido && !valido
              ? <>Você contou que o primeiro destino é <b>{objetivo?.toLowerCase()}</b>. Escolha o tipo e ajuste os números: o Rumo calcula o ritmo e traz o próximo passo para o Hoje.</>
              : "Escolha um tipo e ajuste os números. O Rumo calcula o ritmo e traz o próximo passo para o Hoje."}
          </p>
        </div>
      </div>
      <NovaRota contextos={contextos ?? []} tipoInicial={valido ?? sugerido} />
    </div>
  );
}
