import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ListaResponsabilidades } from "@/components/ListaResponsabilidades";
import { CAMPOS_LISTA, type Responsabilidade } from "@/lib/tipos";

export const metadata = { title: "Inbox" };

export default async function Page() {
  const supabase = await createClient();
  const [{ data: itens }, { data: contextos }] = await Promise.all([
    supabase
      .from("responsibilities")
      .select(CAMPOS_LISTA)
      .is("context_id", null)
      .neq("state", "concluida")
      .order("created_at", { ascending: false }),
    supabase.from("contexts").select("id, name, color").eq("archived", false).order("position"),
  ]);
  const lista = (itens ?? []) as Responsabilidade[];
  const ctx = contextos ?? [];

  return (
    <div className="page">
      <p className="page__k">Capturado, a organizar</p>
      <h1 className="page__t">Inbox</h1>

      {lista.length === 0 ? (
        <div className="empty">
          <b>Nada a organizar</b>
          Tudo o que você capturou já tem um contexto. Para anotar algo, aperte <kbd>C</kbd> ou o botão Capturar.
        </div>
      ) : (
        <>
          <p className="page__lead">
            {lista.length === 1 ? "1 item sem contexto." : `${lista.length} itens sem contexto.`} Dê um lugar a cada um
            {ctx.length === 0 && <> depois de <Link href="/contextos" className="link">criar seus contextos</Link></>}.
          </p>
          <ListaResponsabilidades itens={lista} contextos={ctx} organizavel />
        </>
      )}
    </div>
  );
}
