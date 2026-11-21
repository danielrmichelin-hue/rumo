// Subtarefas: checklist dentro de uma tarefa. Nas listas, a tarefa mostra "2/5".
import type { createClient } from "./supabase/server";

export type Subtarefa = { id: string; responsibility_id: string; title: string; done_at: string | null; position: number };
export const CAMPOS_SUBTAREFA = "id, responsibility_id, title, done_at, position";
export type Passos = Record<string, { feitos: number; total: number }>;

/** Quantas subtarefas cada tarefa tem e quantas estão feitas */
export async function contarPassos(supabase: Awaited<ReturnType<typeof createClient>>, ids: string[]): Promise<Passos> {
  if (!ids.length) return {};
  const { data } = await supabase.from("subtasks").select("responsibility_id, done_at").in("responsibility_id", ids);
  const passos: Passos = {};
  for (const s of data ?? []) {
    const p = (passos[s.responsibility_id] ??= { feitos: 0, total: 0 });
    p.total++;
    if (s.done_at) p.feitos++;
  }
  return passos;
}
