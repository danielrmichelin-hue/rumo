import { createClient } from "@/lib/supabase/server";
import { contarPassos } from "@/lib/subtarefas";
import { ListaResponsabilidades } from "./ListaResponsabilidades";

/** A lista de tarefas com o progresso das subtarefas (busca as contagens no servidor) */
export async function Lista(props: Omit<React.ComponentProps<typeof ListaResponsabilidades>, "passos">) {
  const passos = await contarPassos(await createClient(), props.itens.map((i) => i.id));
  return <ListaResponsabilidades {...props} passos={passos} />;
}
