import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ListaResponsabilidades } from "@/components/ListaResponsabilidades";
import { BotaoNova } from "@/components/ProximoPasso";
import { CAMPOS_LISTA, type Responsabilidade } from "@/lib/tipos";

export const metadata = { title: "Inbox" };

export default async function Page() {
  const supabase = await createClient();
  const [{ data: itens }, { data: contextos }] = await Promise.all([
    supabase.from("responsibilities").select(CAMPOS_LISTA).is("context_id", null).is("project_id", null).is("route_id", null).neq("state", "concluida").order("created_at", { ascending: false }),
    supabase.from("contexts").select("id, name, color, kind").eq("archived", false).order("position"),
  ]);
  const lista = (itens ?? []) as Responsabilidade[];
  const ctx = contextos ?? [];

  return (
    <div className="page">
      <div className="page__head">
        <div>
          <h1 className="page__t">Inbox</h1>
          <p className="page__sub">
            {lista.length === 0
              ? "Nada a organizar."
              : <><b>{lista.length}</b> {lista.length === 1 ? "item capturado espera" : "itens capturados esperam"} um contexto.</>}
          </p>
          <p className="page__para">O que você anotou sem lugar. Dê um contexto e o item sai daqui.</p>
        </div>
        <div className="page__actions hide-mobile"><BotaoNova /></div>
      </div>

      {lista.length === 0 ? (
        <div className="empty">
          <b>Nada pendente nesta etapa.</b>
          O que você capturar sem escolher um contexto espera aqui até ganhar um lugar.
        </div>
      ) : (
        <>
          {ctx.length === 0 && (
            <p className="note" style={{ marginBottom: 16 }}>Para organizar, <Link href="/contextos" className="link">crie seus contextos</Link>.</p>
          )}
          <ListaResponsabilidades itens={lista} contextos={ctx} comContexto={false} organizavel />
        </>
      )}
    </div>
  );
}
