import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ListaResponsabilidades } from "@/components/ListaResponsabilidades";
import { slug } from "@/lib/captura";
import { CAMPOS_LISTA, ordenar, type Responsabilidade } from "@/lib/tipos";

export const metadata = { title: "Contexto" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const supabase = await createClient();
  const [{ data: contexto }, { data: itens }] = await Promise.all([
    supabase.from("contexts").select("id, name, color, kind, archived").eq("id", id).maybeSingle(),
    supabase.from("responsibilities").select(CAMPOS_LISTA).eq("context_id", id).neq("state", "concluida"),
  ]);
  if (!contexto) notFound();

  const lista = ((itens ?? []) as Responsabilidade[]).sort(ordenar);
  const aFazer = lista.filter((i) => i.state === "a_fazer");
  const aguardando = lista
    .filter((i) => i.state === "aguardando")
    .sort((a, b) => (a.follow_up_on ?? "").localeCompare(b.follow_up_on ?? ""));
  const ctx = [{ id: contexto.id, name: contexto.name, color: contexto.color }];

  return (
    <div className="page">
      <p className="page__k">
        {contexto.kind === "empresa" ? "Empresa" : "Área"}
        {contexto.archived && " · arquivado"} · <Link href="/contextos" className="link">editar</Link>
      </p>
      <h1 className="page__t page__t--ctx" style={{ "--c": contexto.color } as React.CSSProperties}><i className="dot" style={{ background: contexto.color }} />{contexto.name}</h1>

      {lista.length === 0 ? (
        <div className="empty">
          <b>Nada em aberto</b>
          Para guardar algo aqui, capture com <code>#{slug(contexto.name.split(/\s+/)[0])}</code> no texto.
        </div>
      ) : (
        <>
          {aFazer.length > 0 && (
            <section className="group" style={{ "--c": contexto.color } as React.CSSProperties}>
              <h2 className="group__t"><span>A fazer</span><span className="group__n">{aFazer.length}</span></h2>
              <ListaResponsabilidades itens={aFazer} contextos={ctx} />
            </section>
          )}
          {aguardando.length > 0 && (
            <section className="group" style={{ "--c": contexto.color } as React.CSSProperties}>
              <h2 className="group__t"><span>Aguardando alguém</span><span className="group__n">{aguardando.length}</span></h2>
              <ListaResponsabilidades itens={aguardando} contextos={ctx} />
            </section>
          )}
        </>
      )}
    </div>
  );
}
