import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, GraduationCap } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { FormCompromisso } from "@/components/FormCompromisso";
import { hojeISO } from "@/lib/datas";
import { horaSP } from "@/lib/hoje";

export const metadata = { title: "Compromisso" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const [{ data: ev }, { data: contextos }] = await Promise.all([
    supabase.from("events").select("id, title, context_id, starts_at, ends_at, location, note, course_id, done_at").eq("id", id).maybeSingle(),
    supabase.from("contexts").select("id, name, color, kind").eq("archived", false).order("position"),
  ]);
  if (!ev) notFound();
  const data = hojeISO(new Date(ev.starts_at));
  const { data: curso } = ev.course_id ? await supabase.from("study_courses").select("id, title").eq("id", ev.course_id).maybeSingle() : { data: null };

  return (
    <div className="page page--narrow">
      <Link href={`/calendario?semana=${data}`} className="back"><ArrowLeft size={16} aria-hidden />Calendário</Link>
      <div className="page__head">
        <div>
          <h1 className="page__t">{ev.title}</h1>
          {curso && (
            <p className="page__sub">
              <GraduationCap size={15} aria-hidden style={{ verticalAlign: -2, marginRight: 6 }} />
              Sessão de estudo · <Link href={`/estudos/${curso.id}`}>{curso.title}</Link>{ev.done_at && " · concluída"}
            </p>
          )}
        </div>
      </div>
      <FormCompromisso
        contextos={contextos ?? []}
        inicial={{
          id: ev.id,
          title: ev.title,
          context_id: ev.context_id,
          data,
          inicio: horaSP(ev.starts_at),
          fim: ev.ends_at ? horaSP(ev.ends_at) : "",
          location: ev.location,
          note: ev.note,
        }}
      />
    </div>
  );
}
