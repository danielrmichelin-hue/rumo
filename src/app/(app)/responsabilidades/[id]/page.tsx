import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { FormResponsabilidade } from "@/components/FormResponsabilidade";
import { CAMPOS_LISTA, type Contexto, type Responsabilidade } from "@/lib/tipos";
import { ehId } from "@/lib/datas";

export const metadata = { title: "Responsabilidade" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ehId(id)) notFound();

  const supabase = await createClient();
  const [{ data: item }, { data: contextos }, { data: esperas }, { data: projetos }] = await Promise.all([
    supabase.from("responsibilities").select(CAMPOS_LISTA).eq("id", id).maybeSingle(),
    supabase.from("contexts").select("id, name, color, kind, position, archived").order("archived").order("position"),
    supabase.from("responsibilities").select("waiting_note").not("waiting_note", "is", null).order("updated_at", { ascending: false }).limit(200),
    supabase.from("projects").select("id, name, status").order("created_at", { ascending: false }),
  ]);
  if (!item) notFound();

  const r = item as Responsabilidade;
  const ctx = (contextos ?? []) as Contexto[];
  const projeto = (projetos ?? []).find((p) => p.id === r.project_id);
  const voltar = projeto ? `/projetos/${projeto.id}` : r.context_id ? "/responsabilidades" : "/inbox";
  const rotuloVoltar = projeto ? projeto.name : r.context_id ? "Responsabilidades" : "Inbox";
  const pessoas = [...new Set((esperas ?? []).map((e) => e.waiting_note as string))].slice(0, 30);

  return (
    <div className="page page--narrow">
      <Link href={voltar} className="back"><ArrowLeft size={16} aria-hidden />{rotuloVoltar}</Link>
      <FormResponsabilidade item={r} contextos={ctx} pessoas={pessoas} voltar={voltar} projetos={(projetos ?? []).filter((p) => p.status !== "concluido" || p.id === r.project_id)} />
    </div>
  );
}
