// Os dados de Estudos (áreas, projetos, disciplinas e aulas), lidos de uma vez para a página e o Hoje
import { createClient, todasAsLinhas } from "@/lib/supabase/server";
import {
  aulasDeHoje, CAMPOS_AREA, CAMPOS_AULA, CAMPOS_DISCIPLINA, CAMPOS_PROJETO_ESTUDO, filaDaArea, normalizarArea, roadmapDaArea,
  type Aula, type Disciplina, type ProjetoEstudo,
} from "@/lib/trilhas";

export async function carregarEstudos(hoje: string) {
  const supabase = await createClient();
  const [{ data: areasDb }, { data: projDb }, { data: discDb }, { data: aulasDb }] = await Promise.all([
    supabase.from("study_areas").select(CAMPOS_AREA).order("position"),
    supabase.from("study_projects").select(CAMPOS_PROJETO_ESTUDO).order("position"),
    supabase.from("study_disciplines").select(CAMPOS_DISCIPLINA).order("position"),
    todasAsLinhas((de, ate) => supabase.from("study_lessons").select(CAMPOS_AULA).order("discipline_id").order("number").range(de, ate)),
  ]);
  const areas = (areasDb ?? []).map(normalizarArea);
  const projetos = (projDb ?? []) as ProjetoEstudo[];
  const disciplinas = (discDb ?? []) as Disciplina[];
  const aulas = (aulasDb ?? []) as Aula[];
  const porDisc = new Map<string, Aula[]>();
  for (const a of aulas) porDisc.set(a.discipline_id, [...(porDisc.get(a.discipline_id) ?? []), a]);
  const aulasDe = (id: string) => porDisc.get(id) ?? [];
  const porArea = areas.map((area) => {
    const fila = filaDaArea(area, projetos, disciplinas);
    return { area, fila, roadmap: roadmapDaArea(area, fila, aulasDe, hoje), hoje: aulasDeHoje(area, fila, aulasDe, hoje) };
  });
  return { areas, projetos, disciplinas, aulas, aulasDe, porArea };
}
