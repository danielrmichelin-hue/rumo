import Link from "next/link";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Caminho } from "@/components/Caminho";
import { CAMPOS_MARCO, CAMPOS_ROTA, ICONES_ROTA, type Marco, normalizar, resumirRota, TIPOS } from "@/lib/rotas";

export const metadata = { title: "Rotas" };


export default async function Page() {
  const supabase = await createClient();
  const [{ data: rotas }, { data: marcos }, { data: contextos }] = await Promise.all([
    supabase.from("routes").select(CAMPOS_ROTA).order("created_at", { ascending: false }),
    supabase.from("route_milestones").select(CAMPOS_MARCO),
    supabase.from("contexts").select("id, name, color"),
  ]);
  const lista = (rotas ?? []).map(normalizar);
  const ativas = lista.filter((r) => r.status !== "concluida");
  const concluidas = lista.filter((r) => r.status === "concluida");
  const ms = (marcos ?? []) as Marco[];
  const ctx = contextos ?? [];

  const cartao = (r: ReturnType<typeof normalizar>) => {
    const resumo = resumirRota(r, ms.filter((m) => m.route_id === r.id));
    const Icon = ICONES_ROTA[r.kind];
    const c = ctx.find((x) => x.id === r.context_id);
    return (
      <article key={r.id} className="route">
        <p className="route__k"><Icon aria-hidden />{TIPOS[r.kind].nome}{c && <> · <i className="dot" style={{ background: c.color }} />{c.name}</>}{r.status === "pausada" && " · pausada"}</p>
        <Link href={`/rotas/${r.id}`} className="route__t">{r.title}</Link>
        <Caminho pct={resumo.pct} />
        <p className="route__line"><b>{Math.round(resumo.pct * 100)}%</b> · {resumo.linha}</p>
        {resumo.recalculo && <p className="field__hint">Recalculada. Veja o novo ritmo.</p>}
      </article>
    );
  };

  return (
    <div className="page page--wide">
      <div className="page__head">
        <div>
          <h1 className="page__t">Rotas</h1>
          <p className="page__sub">Do destino ao próximo passo. O Rumo não pune desvios: recalcula o caminho.</p>
        </div>
        <div className="page__actions"><Link href="/rotas/nova" className="btn"><Plus aria-hidden />Nova Rota</Link></div>
      </div>

      {!lista.length ? (
        <div className="empty empty--box" style={{ maxWidth: 560 }}>
          <b>Primeira Rota</b>
          <span>Defina onde quer chegar: guardar dinheiro, terminar um livro, concluir um curso, abrir um negócio. O Rumo calcula o ritmo e traz o próximo passo para o Hoje.</span>
          <div style={{ marginTop: 10 }}><Link href="/rotas/nova" className="btn btn--sm">Criar a primeira Rota</Link></div>
        </div>
      ) : (
        <>
          <section className="sec">
            <h2 className="sec__h">Em andamento <em>{ativas.length}</em></h2>
            <div className="routes">{ativas.map(cartao)}</div>
          </section>
          {concluidas.length > 0 && (
            <section className="sec">
              <h2 className="sec__h">Destinos alcançados <em>{concluidas.length}</em></h2>
              <div className="routes">{concluidas.map(cartao)}</div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
