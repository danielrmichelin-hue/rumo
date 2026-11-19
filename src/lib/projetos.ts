// Resumo de um projeto como no componente Projeto do Book: progresso, entrega, situação e próximo passo.
import { dataPorExtenso, diferencaDias, hojeISO } from "./datas";
import { ordenar, type Responsabilidade } from "./tipos";

export type Projeto = {
  id: string;
  name: string;
  context_id: string | null;
  status: "ativo" | "pausado" | "concluido";
  due_date: string | null;
  note: string | null;
};

export type ResumoProjeto = {
  total: number;
  feitas: number;
  proximo: Responsabilidade | null;
  situacao: { texto: string; tom: "ok" | "warn" | "late" | "quiet" };
  entrega: string | null;
};

export function resumirProjeto(p: Projeto, etapas: Responsabilidade[], hoje: string = hojeISO()): ResumoProjeto {
  const doProjeto = etapas.filter((r) => r.project_id === p.id);
  const feitas = doProjeto.filter((r) => r.state === "concluida").length;
  const abertas = doProjeto.filter((r) => r.state !== "concluida").sort(ordenar);
  const proximo = abertas.find((r) => r.state === "a_fazer") ?? abertas[0] ?? null;

  let entrega: string | null = null;
  let situacao: ResumoProjeto["situacao"] = { texto: "Ativo", tom: "quiet" };
  if (p.due_date) {
    const dias = diferencaDias(hoje, p.due_date);
    const [, m, d] = p.due_date.split("-").map(Number);
    const extenso = dataPorExtenso(p.due_date).split(", ")[1] ?? `${d}/${m}`;
    entrega = dias === 0 ? `${extenso} · hoje` : dias > 0 ? `${extenso} · em ${dias} ${dias === 1 ? "dia" : "dias"}` : `${extenso} · venceu há ${-dias} ${-dias === 1 ? "dia" : "dias"}`;
    situacao = dias < 0 ? { texto: "Atrasado", tom: "late" } : dias <= 3 && abertas.length > 0 ? { texto: "Entrega próxima", tom: "warn" } : { texto: "No prazo", tom: "ok" };
  }
  if (p.status === "pausado") situacao = { texto: "Pausado", tom: "quiet" };
  if (p.status === "concluido") situacao = { texto: "Concluído", tom: "ok" };

  return { total: doProjeto.length, feitas, proximo, situacao, entrega };
}
