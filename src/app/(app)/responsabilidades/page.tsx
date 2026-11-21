import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ListaResponsabilidades } from "@/components/ListaResponsabilidades";
import { BotaoNova } from "@/components/ProximoPasso";
import { CAMPOS_LISTA, ordenar, type Estado, type Responsabilidade } from "@/lib/tipos";

export const metadata = { title: "Tarefas" };

const ABAS: Array<{ estado: Estado; rotulo: string; vazio: string }> = [
  { estado: "a_fazer", rotulo: "A fazer", vazio: "O que você capturar num contexto aparece aqui." },
  { estado: "aguardando", rotulo: "Aguardando alguém", vazio: "Quando surgir um acompanhamento, ele aparece aqui, com a data de cobrar." },
  { estado: "concluida", rotulo: "Concluídas", vazio: "O que você concluir fica guardado aqui." },
];

export default async function Page({ searchParams }: { searchParams: Promise<{ estado?: string; contexto?: string }> }) {
  const { estado: param, contexto: filtro } = await searchParams;
  const aba = ABAS.find((a) => a.estado === param) ?? ABAS[0];

  const supabase = await createClient();
  let consulta = supabase.from("responsibilities").select(CAMPOS_LISTA).not("context_id", "is", null).eq("state", aba.estado);
  if (filtro) consulta = consulta.eq("context_id", filtro);
  if (aba.estado === "concluida") consulta = consulta.order("done_at", { ascending: false }).limit(100);
  const contar = (estado: Estado) => {
    let q = supabase.from("responsibilities").select("id", { count: "exact", head: true }).not("context_id", "is", null).eq("state", estado);
    if (filtro) q = q.eq("context_id", filtro);
    return q;
  };
  const [{ data: itens }, { data: contextos }, { data: projetos }, { count: nAFazer }, { count: nAguardando }] = await Promise.all([
    consulta,
    // Inclui os arquivados: o que ainda está aberto neles não pode sumir
    supabase.from("contexts").select("id, name, color, kind, archived").order("archived").order("position"),
    supabase.from("projects").select("id, name"),
    contar("a_fazer"),
    contar("aguardando"),
  ]);
  const contagem: Partial<Record<Estado, number>> = { a_fazer: nAFazer ?? 0, aguardando: nAguardando ?? 0 };
  const nomesProjetos = Object.fromEntries((projetos ?? []).map((p) => [p.id, p.name]));

  const lista = (itens ?? []) as Responsabilidade[];
  const ctx = contextos ?? [];
  if (aba.estado === "aguardando") lista.sort((a, b) => (a.follow_up_on ?? "").localeCompare(b.follow_up_on ?? ""));
  else if (aba.estado === "a_fazer") lista.sort(ordenar);

  // A fazer, sem filtro: agrupado por contexto, na ordem da lateral
  const agrupar = aba.estado === "a_fazer" && !filtro;
  const grupos = agrupar ? ctx.map((c) => ({ contexto: c, itens: lista.filter((i) => i.context_id === c.id) })).filter((g) => g.itens.length) : [];
  const url = (estado: Estado, contexto?: string) => {
    const p = new URLSearchParams();
    if (estado !== "a_fazer") p.set("estado", estado);
    if (contexto) p.set("contexto", contexto);
    const s = p.toString();
    return `/responsabilidades${s ? `?${s}` : ""}`;
  };

  return (
    <div className="page">
      <div className="page__head">
        <div>
          <h1 className="page__t">Tarefas</h1>
          <p className="page__sub">
            <b>{contagem.a_fazer}</b> a fazer · <b>{contagem.aguardando}</b> aguardando alguém
          </p>
        </div>
        <div className="page__actions hide-mobile"><BotaoNova /></div>
      </div>

      <nav className="tabs" aria-label="Estado">
        {ABAS.map((a) => (
          <Link key={a.estado} href={url(a.estado, filtro)} aria-current={a === aba ? "page" : undefined}>
            {a.rotulo}{contagem[a.estado] !== undefined && <em>{contagem[a.estado]}</em>}
          </Link>
        ))}
      </nav>

      {ctx.length > 0 && (
        <nav className="filters" aria-label="Contexto">
          <Link href={url(aba.estado)} className="chip" aria-current={!filtro ? "page" : undefined}>Tudo</Link>
          {ctx.filter((c) => !c.archived).map((c) => (
            <Link key={c.id} href={url(aba.estado, c.id)} className="chip" aria-current={filtro === c.id ? "page" : undefined}>
              <i className="dot" style={{ background: c.color }} />{c.name}
            </Link>
          ))}
        </nav>
      )}

      {ctx.length === 0 ? (
        <div className="empty">
          <b>Responsabilidades moram em contextos.</b>
          <span>Crie os seus, como Iter Mídia, Rumo e Casa. <Link href="/contextos" className="link">Criar contextos</Link></span>
        </div>
      ) : lista.length === 0 ? (
        <div className="empty"><b>Nada pendente nesta etapa.</b>{aba.vazio}</div>
      ) : agrupar ? (
        grupos.map((g) => (
          <section key={g.contexto.id} className="sec">
            <h2 className="sec__h">
              <Link href={`/contexto/${g.contexto.id}`}><i className="dot" style={{ background: g.contexto.color }} />{g.contexto.name}</Link>
              <em>{g.itens.length}</em>
            </h2>
            <ListaResponsabilidades itens={g.itens} contextos={ctx} comContexto={false} projetos={nomesProjetos} />
          </section>
        ))
      ) : (
        <ListaResponsabilidades itens={lista} contextos={ctx} comContexto={!filtro} projetos={nomesProjetos} />
      )}
    </div>
  );
}
