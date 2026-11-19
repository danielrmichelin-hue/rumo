import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { NovoCurso } from "@/components/Estudos";
import { TIPO_DO_COMECO, TIPOS_CURSO, type TipoCurso } from "@/lib/estudos";

export const metadata = { title: "Novo curso" };

export default async function Page({ searchParams }: { searchParams: Promise<{ tipo?: string }> }) {
  const { tipo } = await searchParams;
  const supabase = await createClient();
  const [{ data: contextos }, { data: perfil }, { data: cursos }] = await Promise.all([
    supabase.from("contexts").select("id, name, color, kind").eq("archived", false).order("position"),
    supabase.from("profiles").select("onboarding").maybeSingle(),
    supabase.from("study_courses").select("kind"),
  ]);
  // A resposta de "O que você estuda agora?" sugere o tipo (o que ainda não virou curso)
  const respostas = ((perfil?.onboarding as { estudos?: string[] } | null)?.estudos ?? []).map((r) => TIPO_DO_COMECO[r]).filter(Boolean);
  const jaTem = new Set((cursos ?? []).map((c) => c.kind));
  const sugeridos = respostas.filter((t) => !jaTem.has(t));
  const valido = tipo && tipo in TIPOS_CURSO ? (tipo as TipoCurso) : null;
  const inicial = valido ?? sugeridos[0] ?? null;

  return (
    <div className="page page--wide">
      <div className="page__head">
        <div>
          <p className="crumb"><Link href="/estudos">Estudos</Link><ChevronRight aria-hidden />Novo curso</p>
          <h1 className="page__t">O que você estuda?</h1>
          <p className="page__sub">
            {sugeridos.length && !valido
              ? <>Você contou que estuda <b>{sugeridos.map((t) => TIPOS_CURSO[t].toLowerCase()).join(" e ")}</b>. Ajuste os números: o Rumo mostra a semana, as matérias e a próxima sessão.</>
              : "Escolha o tipo e ajuste os números. O Rumo mostra a semana, as matérias e a próxima sessão."}
          </p>
        </div>
      </div>
      <NovoCurso contextos={contextos ?? []} tipoInicial={inicial} sugeridos={sugeridos} />
    </div>
  );
}
