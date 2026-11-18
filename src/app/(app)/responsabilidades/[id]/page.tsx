import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { FormResponsabilidade } from "@/components/FormResponsabilidade";
import { CAMPOS_LISTA, type Contexto, type Responsabilidade } from "@/lib/tipos";

export const metadata = { title: "Responsabilidade" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const supabase = await createClient();
  const [{ data: item }, { data: contextos }, { data: esperas }] = await Promise.all([
    supabase.from("responsibilities").select(CAMPOS_LISTA).eq("id", id).maybeSingle(),
    supabase.from("contexts").select("id, name, color, kind, position, archived").order("archived").order("position"),
    supabase.from("responsibilities").select("waiting_note").not("waiting_note", "is", null).order("updated_at", { ascending: false }).limit(200),
  ]);
  if (!item) notFound();

  const r = item as Responsabilidade;
  const ctx = (contextos ?? []) as Contexto[];
  const voltar = r.context_id ? "/responsabilidades" : "/inbox";
  const pessoas = [...new Set((esperas ?? []).map((e) => e.waiting_note as string))].slice(0, 30);

  return (
    <div className="page page--narrow">
      <Link href={voltar} className="back"><ArrowLeft size={16} aria-hidden />{r.context_id ? "Responsabilidades" : "Inbox"}</Link>
      <FormResponsabilidade item={r} contextos={ctx} pessoas={pessoas} voltar={voltar} />
    </div>
  );
}
