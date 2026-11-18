import { createClient } from "@/lib/supabase/server";
import { GerirContextos } from "@/components/GerirContextos";
import type { Contexto } from "@/lib/tipos";

export const metadata = { title: "Contextos" };

export default async function Page() {
  const supabase = await createClient();
  const [{ data: contextos }, { data: abertas }] = await Promise.all([
    supabase.from("contexts").select("id, name, color, kind, position, archived").order("position"),
    supabase.from("responsibilities").select("context_id").not("context_id", "is", null).neq("state", "concluida"),
  ]);

  const contagem: Record<string, number> = {};
  for (const r of abertas ?? []) contagem[r.context_id as string] = (contagem[r.context_id as string] ?? 0) + 1;

  return (
    <div className="page page--narrow">
      <p className="page__k">Onde as coisas moram</p>
      <h1 className="page__t">Contextos</h1>
      <p className="page__lead">
        Empresas e áreas da sua vida. Na captura, escreva <code>#nome</code> para guardar direto num contexto.
      </p>
      <GerirContextos contextos={(contextos ?? []) as Contexto[]} abertas={contagem} />
    </div>
  );
}
