import { createClient } from "@/lib/supabase/server";
import { LinhaRotina, NovaRotina } from "@/components/Rotinas";
import { hojeISO } from "@/lib/datas";
import { CAMPOS_ROTINA, desdeMarcas, eDoDia, type Marcacao, type Rotina } from "@/lib/rotinas";
import type { ContextItem } from "@/components/Shell";

export const metadata = { title: "Rotinas" };

export default async function Page() {
  const supabase = await createClient();
  const hoje = hojeISO();
  const [{ data: rotinasDb }, { data: marcasDb }, { data: contextos }] = await Promise.all([
    supabase.from("routines").select(CAMPOS_ROTINA).order("position"),
    supabase.from("routine_checks").select("routine_id, done_on").gte("done_on", desdeMarcas(hoje)),
    supabase.from("contexts").select("id, name, color, kind").eq("archived", false).order("position"),
  ]);
  // Remédios (rotinas com dose) moram em Saúde
  const rotinas = ((rotinasDb ?? []) as Rotina[]).filter((r) => !r.dose);
  const marcas = (marcasDb ?? []) as Marcacao[];
  const ctx = (contextos ?? []) as ContextItem[];
  const ativas = rotinas.filter((r) => r.status === "ativa");
  const pausadas = rotinas.filter((r) => r.status === "pausada");

  const linha = (r: Rotina) => (
    <LinhaRotina key={r.id} rotina={r} marcas={marcas} contexto={ctx.find((c) => c.id === r.context_id)} doDia={eDoDia(r, marcas, hoje)} contextos={ctx} />
  );

  return (
    <div className="page">
      <div className="page__head">
        <div>
          <h1 className="page__t">Rotinas</h1>
        </div>
      </div>

      <div style={{ marginBottom: 24 }}>
        <NovaRotina contextos={ctx} />
      </div>

      {ativas.length > 0 && (
        <section className="sec">
          <h2 className="sec__h">Suas rotinas {ativas.length > 0 && <em>{ativas.length}</em>}</h2>
          <ul className="list">{ativas.map(linha)}</ul>
          <p className="field__hint" style={{ padding: "6px 10px" }}>Esqueceu de marcar? Toque no dia, nos pontos da semana.</p>
        </section>
      )}
      {pausadas.length > 0 && (
        <section className="sec">
          <h2 className="sec__h">Pausadas {pausadas.length > 0 && <em>{pausadas.length}</em>}</h2>
          <ul className="list">{pausadas.map(linha)}</ul>
        </section>
      )}
      {!rotinas.length && <p className="empty">Nenhuma rotina ainda.</p>}
    </div>
  );
}
