// Notas (Book 6.4): anotações que pertencem a algo. Vinculada, não solta; decisão com o quê, por quê e quando.
import { diaMes, hojeISO } from "./datas";

export type Nota = {
  id: string;
  kind: "nota" | "decisao";
  title: string;
  body: string | null;
  why: string | null;
  decided_on: string | null;
  context_id: string | null;
  project_id: string | null;
  course_id: string | null;
  created_at: string;
};

export const CAMPOS_NOTA = "id, kind, title, body, why, decided_on, context_id, project_id, course_id, created_at";

/** Onde a nota mora, como valor de formulário: "c:<id>" contexto, "p:<id>" projeto, "e:<id>" curso */
export const valorVinculo = (n: Pick<Nota, "context_id" | "project_id" | "course_id">) =>
  n.project_id ? `p:${n.project_id}` : n.course_id ? `e:${n.course_id}` : n.context_id ? `c:${n.context_id}` : "";

/** "19 de novembro": quando foi decidida, ou quando a nota foi escrita */
export const dataDaNota = (n: Pick<Nota, "decided_on" | "created_at">) => diaMes(n.decided_on ?? hojeISO(new Date(n.created_at)));

type Nome = { id: string; name?: string; title?: string; color?: string; context_id?: string | null };

/** Onde as notas podem morar (para o formulário) e o rótulo de cada nota ("Iter Mídia", "Site novo", "Pós em Marketing") */
export function lugaresDasNotas(notas: Nota[], contextos: Nome[], projetos: Nome[], cursos: Nome[]) {
  const cor = (id: string | null | undefined) => contextos.find((c) => c.id === id)?.color;
  const lugares = [
    { grupo: "Contextos", itens: contextos.map((c) => ({ valor: `c:${c.id}`, nome: c.name ?? "" })) },
    { grupo: "Projetos", itens: projetos.map((p) => ({ valor: `p:${p.id}`, nome: p.name ?? "" })) },
    { grupo: "Cursos", itens: cursos.map((c) => ({ valor: `e:${c.id}`, nome: c.title ?? "" })) },
  ];
  const rotulos: Record<string, { nome: string; cor?: string }> = {};
  for (const n of notas) {
    const p = projetos.find((x) => x.id === n.project_id);
    const e = cursos.find((x) => x.id === n.course_id);
    const c = contextos.find((x) => x.id === n.context_id);
    const nome = p?.name ?? e?.title ?? c?.name;
    if (nome) rotulos[n.id] = { nome, cor: cor(n.context_id) };
  }
  return { lugares, rotulos };
}
