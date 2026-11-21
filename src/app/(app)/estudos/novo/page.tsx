import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { NovoCurso } from "@/components/Estudos";
import { TIPOS_CURSO, type TipoCurso } from "@/lib/estudos";

export const metadata = { title: "Novo estudo" };

export default async function Page({ searchParams }: { searchParams: Promise<{ tipo?: string }> }) {
  const { tipo } = await searchParams;
  const supabase = await createClient();
  const { data: contextos } = await supabase.from("contexts").select("id, name, color, kind").eq("archived", false).order("position");
  const inicial = tipo && Object.hasOwn(TIPOS_CURSO, tipo) ? (tipo as TipoCurso) : null;

  return (
    <div className="page page--wide">
      <div className="page__head">
        <div>
          <p className="crumb"><Link href="/estudos">Estudos</Link><ChevronRight aria-hidden />Novo estudo</p>
          <h1 className="page__t">O que você estuda?</h1>
        </div>
      </div>
      <NovoCurso contextos={contextos ?? []} tipoInicial={inicial} sugeridos={[]} />
    </div>
  );
}
