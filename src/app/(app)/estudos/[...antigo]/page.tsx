// Endereços das telas antigas de Estudos (cursos, matérias, ciclo): levam para a área nova
import { redirect } from "next/navigation";

export default function Page() {
  redirect("/estudos");
}
