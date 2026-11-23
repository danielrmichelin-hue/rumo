import Link from "next/link";
import { agendaExterna } from "@/lib/ical";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PlanoSemana, type CartaoTarefa, type EventoSemana } from "@/components/PlanoSemana";
import type { ContextItem } from "@/components/Shell";
import { diaMes, fimDoDia, hojeISO, horaDe, inicioDoDia, somarDias } from "@/lib/datas";
import { numeroSemana, segundaDa } from "@/lib/semana";
import { contarPassos } from "@/lib/subtarefas";

export const metadata = { title: "Semana" };

export default async function Page({ searchParams }: { searchParams: Promise<{ d?: string }> }) {
  const { d } = await searchParams;
  const hoje = hojeISO();
  const seg = segundaDa(d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : hoje);
  const dom = somarDias(seg, 6);
  const supabase = await createClient();
  const [{ data: abertas }, { data: feitas }, { data: eventosDb }, { data: contextos }, { data: perfil }] = await Promise.all([
    // Em aberto: as da semana, as sem data e as atrasadas (para replanejar)
    supabase.from("responsibilities").select("id, title, context_id, due_date, due_time, state").eq("state", "a_fazer").or(`due_date.is.null,due_date.lte.${dom}`),
    supabase.from("responsibilities").select("id, title, context_id, due_date, due_time, state").eq("state", "concluida").gte("due_date", seg).lte("due_date", dom),
    supabase.from("events").select("id, title, starts_at, ends_at").gte("starts_at", inicioDoDia(seg)).lte("starts_at", fimDoDia(dom)).order("starts_at"),
    supabase.from("contexts").select("id, name, color, kind").eq("archived", false).order("position"),
    supabase.from("profiles").select("ical_url").maybeSingle(),
  ]);
  const eventos = [...(eventosDb ?? []), ...(await agendaExterna(perfil?.ical_url, inicioDoDia(seg), fimDoDia(dom)))].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const lista = [...(abertas ?? []), ...(feitas ?? [])];
  const passos = await contarPassos(supabase, lista.map((t) => t.id));
  const tarefas: CartaoTarefa[] = lista
    .map((t) => ({
      id: t.id, title: t.title, context_id: t.context_id, due_date: t.due_date, due_time: t.due_time,
      feita: t.state === "concluida", atrasada: t.state !== "concluida" && !!t.due_date && t.due_date < hoje,
      passos: passos[t.id]?.total ? `${passos[t.id].feitos}/${passos[t.id].total}` : undefined,
    }))
    .sort((a, b) => Number(a.feita) - Number(b.feita) || (a.due_time ?? "99").localeCompare(b.due_time ?? "99") || a.title.localeCompare(b.title));
  const evs: EventoSemana[] = eventos.map((e) => ({
    id: e.id, title: e.title, dia: hojeISO(new Date(e.starts_at)), hora: horaDe(e.starts_at),
    minutos: e.ends_at ? Math.max(0, Math.round((new Date(e.ends_at).getTime() - new Date(e.starts_at).getTime()) / 60000)) : 30,
  }));
  const dias = Array.from({ length: 7 }, (_, i) => { const dia = somarDias(seg, i); return { dia, hoje: dia === hoje, passado: dia < hoje }; });

  return (
    <div className="page page--full">
      <div className="page__head">
        <div>
          <h1 className="page__t">Semana</h1>
          <p className="page__sub">Semana {numeroSemana(seg)} · {diaMes(seg)} a {diaMes(dom)}</p>
        </div>
        <div className="page__actions">
          <Link href={`/semana?d=${somarDias(seg, -7)}`} className="icon-btn" aria-label="Semana anterior"><ChevronLeft size={18} /></Link>
          {seg !== segundaDa(hoje) && <Link href="/semana" className="btn btn--line btn--sm">Esta semana</Link>}
          <Link href={`/semana?d=${somarDias(seg, 7)}`} className="icon-btn" aria-label="Próxima semana"><ChevronRight size={18} /></Link>
        </div>
      </div>
      <PlanoSemana dias={dias} tarefas={tarefas} eventos={evs} contextos={(contextos ?? []) as ContextItem[]} hoje={hoje} />
    </div>
  );
}
