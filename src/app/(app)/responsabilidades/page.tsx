import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ListaResponsabilidades } from "@/components/ListaResponsabilidades";
import { CAMPOS_LISTA, ordenar, type Estado, type Responsabilidade } from "@/lib/tipos";

export const metadata = { title: "Responsabilidades" };

const ABAS: Array<{ estado: Estado; rotulo: string; vazio: string }> = [
  { estado: "a_fazer", rotulo: "A fazer", vazio: "Nada a fazer por aqui. O que você capturar com #contexto aparece nesta lista." },
  { estado: "aguardando", rotulo: "Aguardando", vazio: "Você não está esperando ninguém. Ao marcar algo como Aguardando, ele vem para cá com a data de cobrança." },
  { estado: "concluida", rotulo: "Concluídas", vazio: "Nada concluído ainda." },
];

export default async function Page({ searchParams }: { searchParams: Promise<{ estado?: string }> }) {
  const { estado: param } = await searchParams;
  const aba = ABAS.find((a) => a.estado === param) ?? ABAS[0];

  const supabase = await createClient();
  let consulta = supabase.from("responsibilities").select(CAMPOS_LISTA).not("context_id", "is", null).eq("state", aba.estado);
  consulta = aba.estado === "concluida" ? consulta.order("done_at", { ascending: false }).limit(100) : consulta;
  const contar = (estado: Estado) =>
    supabase.from("responsibilities").select("id", { count: "exact", head: true }).not("context_id", "is", null).eq("state", estado);
  const [{ data: itens }, { data: contextos }, { count: nAFazer }, { count: nAguardando }] = await Promise.all([
    consulta,
    // Inclui os arquivados: o que ainda está aberto neles não pode sumir
    supabase.from("contexts").select("id, name, color, archived").order("archived").order("position"),
    contar("a_fazer"),
    contar("aguardando"),
  ]);
  const contagem: Partial<Record<Estado, number>> = { a_fazer: nAFazer ?? 0, aguardando: nAguardando ?? 0 };

  const lista = (itens ?? []) as Responsabilidade[];
  const ctx = contextos ?? [];

  if (aba.estado === "aguardando") {
    lista.sort((a, b) => (a.follow_up_on ?? "").localeCompare(b.follow_up_on ?? ""));
  } else if (aba.estado === "a_fazer") {
    lista.sort(ordenar);
  }

  // A fazer: agrupado por contexto, na ordem da lateral. Os outros: uma lista só.
  const grupos =
    aba.estado === "a_fazer"
      ? ctx.map((c) => ({ contexto: c, itens: lista.filter((i) => i.context_id === c.id) })).filter((g) => g.itens.length)
      : [];

  return (
    <div className="page">
      <p className="page__k">Tudo o que depende de você</p>
      <h1 className="page__t">Responsabilidades</h1>

      <nav className="tabs" aria-label="Estado">
        {ABAS.map((a) => (
          <Link key={a.estado} href={a.estado === "a_fazer" ? "/responsabilidades" : `/responsabilidades?estado=${a.estado}`} aria-current={a === aba ? "page" : undefined}>
            {a.rotulo}
            {!!contagem[a.estado] && <span className="tabs__n">{contagem[a.estado]}</span>}
          </Link>
        ))}
      </nav>

      {ctx.length === 0 ? (
        <div className="empty">
          <b>Comece pelos contextos</b>
          Responsabilidades moram em contextos, como Iter Mídia, Rumo e Casa. <Link href="/contextos" className="link">Criar contextos</Link>
        </div>
      ) : lista.length === 0 ? (
        <div className="empty"><b>Tudo em dia</b>{aba.vazio}</div>
      ) : aba.estado === "a_fazer" ? (
        grupos.map((g) => (
          <section key={g.contexto.id} className="group" style={{ "--c": g.contexto.color } as React.CSSProperties}>
            <h2 className="group__t">
              <Link href={`/contexto/${g.contexto.id}`}><i className="dot" style={{ background: g.contexto.color }} />{g.contexto.name}</Link>
              <span className="group__n">{g.itens.length}</span>
            </h2>
            <ListaResponsabilidades itens={g.itens} contextos={ctx} />
          </section>
        ))
      ) : (
        <ListaResponsabilidades itens={lista} contextos={ctx} comContexto />
      )}
    </div>
  );
}
