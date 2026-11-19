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
  project_id: string | null;
  route_id?: string | null;
  state: Estado;
  due_date: string | null;
  due_time: string | null;
  today: boolean;
  waiting_note: string | null;
  follow_up_on: string | null;
  done_at: string | null;
  source: "captura" | "manual";
  raw_capture: string | null;
  created_at: string;
  updated_at: string;
};

export const CAMPOS_LISTA =
  "id, title, note, kind, context_id, project_id, route_id, state, due_date, due_time, today, waiting_note, follow_up_on, done_at, source, raw_capture, created_at, updated_at";

/** Cores de contexto (bolinha). Tons das telas conceituais do Book; o roxo da marca fica para ação. */
export const CORES_CONTEXTO = [
  { cor: "#7B61E8", nome: "Violeta" },
  { cor: "#4C8BD8", nome: "Azul" },
  { cor: "#3E9D72", nome: "Verde" },
  { cor: "#E08A4A", nome: "Laranja" },
  { cor: "#D46AA6", nome: "Rosa" },
  { cor: "#2FA3B5", nome: "Turquesa" },
  { cor: "#C49A2C", nome: "Âmbar" },
  { cor: "#8A8299", nome: "Cinza" },
];

/** Próxima cor da paleta que ainda não está em uso */
export function proximaCor(usadas: string[]): string {
  const livre = CORES_CONTEXTO.find((c) => !usadas.map((u) => u.toLowerCase()).includes(c.cor.toLowerCase()));
  return (livre ?? CORES_CONTEXTO[usadas.length % CORES_CONTEXTO.length]).cor;
}

export type Perfil = {
  user_id: string;
  display_name: string | null;
  modules: string[];
  onboarding: Record<string, unknown>;
  onboarded_at: string | null;
};

export type Compromisso = {
  id: string;
  title: string;
  context_id: string | null;
  starts_at: string;
  ends_at: string | null;
  location: string | null;
};

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
