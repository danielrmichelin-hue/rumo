import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ListaNotas, NovaNota } from "@/components/Notas";
import { CAMPOS_NOTA, lugaresDasNotas, type Nota } from "@/lib/notas";

export const metadata = { title: "Notas" };

const FILTROS = [{ v: "", r: "Todas" }, { v: "decisao", r: "Decisões" }, { v: "nota", r: "Notas" }] as const;

export default async function Page({ searchParams }: { searchParams: Promise<{ tipo?: string }> }) {
  const { tipo } = await searchParams;
  const filtro = tipo === "decisao" || tipo === "nota" ? tipo : "";
  const supabase = await createClient();
  const [{ data: notasDb }, { data: contextos }, { data: projetos }, { data: cursos }] = await Promise.all([
    supabase.from("notes").select(CAMPOS_NOTA).order("created_at", { ascending: false }).limit(200),
    supabase.from("contexts").select("id, name, color").eq("archived", false).order("position"),
    supabase.from("projects").select("id, name, context_id").eq("status", "ativo").order("name"),
    supabase.from("study_courses").select("id, title, context_id").neq("status", "concluido").order("created_at"),
  ]);
  const todas = (notasDb ?? []) as Nota[];
  const notas = filtro ? todas.filter((n) => n.kind === filtro) : todas;
  const { lugares, rotulos } = lugaresDasNotas(todas, contextos ?? [], projetos ?? [], cursos ?? []);

  return (
    <div className="page">
      <div className="page__head">
        <div>
          <h1 className="page__t">Notas</h1>
        </div>
        <div className="page__actions">
          <NovaNota lugares={lugares} rotulo="Registrar decisão" decisao variante="btn btn--line" />
          <NovaNota lugares={lugares} variante="btn" />
        </div>
      </div>

      {todas.length > 0 && (
        <nav className="chips" aria-label="Filtrar notas" style={{ marginBottom: 16 }}>
          {FILTROS.map((f) => (
            <Link key={f.v} href={f.v ? `/notas?tipo=${f.v}` : "/notas"} className="chip" aria-current={filtro === f.v ? "page" : undefined}>{f.r}</Link>
          ))}
        </nav>
      )}

      {notas.length ? (
        <ListaNotas notas={notas} rotulos={rotulos} lugares={lugares} />
      ) : (
        <div className="empty empty--box" style={{ maxWidth: 560 }}>
          <b>{todas.length ? "Nada neste filtro." : "Primeira nota"}</b>
          <span>O Rumo não é um editor de documentos: a nota existe para dar contexto ao que precisa ser feito. Registre também as decisões, para lembrar meses depois por que foram tomadas.</span>
        </div>
      )}
    </div>
  );
}
