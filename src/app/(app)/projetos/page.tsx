import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CardProjeto } from "@/components/CardProjeto";
import { NovoProjeto } from "@/components/FormsProjeto";
import { resumirProjeto, type Projeto } from "@/lib/projetos";
import { CAMPOS_LISTA, type Responsabilidade } from "@/lib/tipos";

export const metadata = { title: "Projetos" };

const ABAS = [
  { v: "ativo", r: "Ativos" },
  { v: "pausado", r: "Pausados" },
  { v: "concluido", r: "Concluídos" },
] as const;

export default async function Page({ searchParams }: { searchParams: Promise<{ estado?: string }> }) {
  const { estado } = await searchParams;
  const aba = ABAS.find((a) => a.v === estado) ?? ABAS[0];
  const supabase = await createClient();
  const [{ data: projetos }, { data: etapas }, { data: contextos }] = await Promise.all([
    supabase.from("projects").select("id, name, context_id, status, due_date, note").order("created_at", { ascending: false }),
    supabase.from("responsibilities").select(CAMPOS_LISTA).not("project_id", "is", null),
    supabase.from("contexts").select("id, name, color, kind").eq("archived", false).order("position"),
  ]);
  const todos = (projetos ?? []) as Projeto[];
  const lista = todos
    .filter((p) => p.status === aba.v)
    .sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"));
  const ctx = contextos ?? [];
  const contar = (v: string) => todos.filter((p) => p.status === v).length;

  return (
    <div className="page page--wide">
      <div className="page__head">
        <div>
          <h1 className="page__t">Projetos</h1>
          <p className="page__sub"><b>{contar("ativo")}</b> {contar("ativo") === 1 ? "ativo" : "ativos"}</p>
          <p className="page__para">Um projeto é um resultado com etapas e fim (um site, uma reforma, uma viagem). Cada um mostra o próximo passo.</p>
        </div>
        <div className="page__actions"><NovoProjeto contextos={ctx} /></div>
      </div>

      <nav className="tabs" aria-label="Estado">
        {ABAS.map((a) => (
          <Link key={a.v} href={a.v === "ativo" ? "/projetos" : `/projetos?estado=${a.v}`} aria-current={a === aba ? "page" : undefined}>
            {a.r}<em>{contar(a.v)}</em>
          </Link>
        ))}
      </nav>

      {lista.length === 0 ? (
        <div className="empty">
          <b>{aba.v === "ativo" ? "Nenhum projeto ativo." : "Nada por aqui."}</b>
          {aba.v === "ativo" && "Um projeto tem começo e fim. Crie um e comece pelo próximo passo dele."}
        </div>
      ) : (
        <div className="projects">
          {lista.map((p) => (
            <CardProjeto key={p.id} projeto={p} resumo={resumirProjeto(p, (etapas ?? []) as Responsabilidade[])} contexto={ctx.find((c) => c.id === p.context_id)} />
          ))}
        </div>
      )}
    </div>
  );
}
