// Cópia de segurança: todos os dados do Daniel num arquivo JSON (só o que é dele: o banco filtra pelo dono).
import { createClient } from "@/lib/supabase/server";
import { hojeISO } from "@/lib/datas";

const TABELAS = [
  "profiles", "contexts", "people", "projects", "responsibilities", "subtasks", "events", "notes",
  "routes", "route_milestones", "route_entries", "routines", "routine_checks",
  "study_courses", "study_subjects", "study_modules", "study_topics", "health_measures",
  "fin_settings", "fin_entries", "fin_budgets", "fin_installments", "fin_investments", "fin_inv_moves",
];

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Entre de novo.", { status: 401 });
  const partes = await Promise.all(TABELAS.map(async (t) => [t, (await supabase.from(t).select("*")).data ?? []] as const));
  const corpo = JSON.stringify({ gerado_em: new Date().toISOString(), tabelas: Object.fromEntries(partes) }, null, 1);
  return new Response(corpo, {
    headers: { "content-type": "application/json; charset=utf-8", "content-disposition": `attachment; filename="rumo-copia-${hojeISO()}.json"` },
  });
}
