export type Estado = "a_fazer" | "aguardando" | "concluida";

export type Contexto = {
  id: string;
  name: string;
  color: string;
  kind: "empresa" | "area";
  position: number;
  archived: boolean;
};

export type Responsabilidade = {
  id: string;
  title: string;
  note: string | null;
  kind: "fazer" | "decidir";
  context_id: string | null;
  state: Estado;
  due_date: string | null;
  due_time: string | null;
  waiting_note: string | null;
  follow_up_on: string | null;
  done_at: string | null;
  source: "captura" | "manual";
  raw_capture: string | null;
  created_at: string;
};

export const CAMPOS_LISTA =
  "id, title, note, kind, context_id, state, due_date, due_time, waiting_note, follow_up_on, done_at, source, raw_capture, created_at";

/** Cores das bolinhas de contexto. O roxo da marca fica para ação. */
export const CORES_CONTEXTO = [
  { cor: "#3D7BE0", nome: "Azul" },
  { cor: "#2E9A6A", nome: "Verde" },
  { cor: "#D9962B", nome: "Âmbar" },
  { cor: "#D9645B", nome: "Coral" },
  { cor: "#2FA3B5", nome: "Turquesa" },
  { cor: "#C0569E", nome: "Rosa" },
  { cor: "#8A6A4F", nome: "Terra" },
  { cor: "#7D7590", nome: "Cinza" },
];

/** Ordem das listas: com prazo primeiro (mais cedo antes), depois sem prazo, por criação. */
export function ordenar(a: Responsabilidade, b: Responsabilidade): number {
  if (a.due_date && b.due_date && a.due_date !== b.due_date) return a.due_date < b.due_date ? -1 : 1;
  if (a.due_date && !b.due_date) return -1;
  if (!a.due_date && b.due_date) return 1;
  if (a.due_time && b.due_time && a.due_time !== b.due_time) return a.due_time < b.due_time ? -1 : 1;
  if (a.due_time && !b.due_time) return -1;
  if (!a.due_time && b.due_time) return 1;
  return a.created_at < b.created_at ? -1 : 1;
}
