// O mês inteiro: compromissos, prazos e lembretes do mês em cada dia. Tocar no dia abre a semana dele.
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { NovoCompromisso } from "@/components/FormCompromisso";
import { fimDoDia, hojeISO, horaDe, inicioDoDia, mesAno, montarISO, SEMANA_CURTA, somarDias } from "@/lib/datas";
import { AZUL_ESTUDO } from "@/lib/estudos";
import { CAMPOS_ROTINA, diaNoMes, type Rotina } from "@/lib/rotinas";
import { segundaDa } from "@/lib/semana";
import type { Compromisso } from "@/lib/tipos";
import { AlternarVista } from "./AlternarVista";

type Item = { id: string; dia: string; hora: string | null; titulo: string; cor: string; href: string; tipo: "evento" | "prazo" | "lembrete"; feito?: boolean };

const MAX_POR_DIA = 3;

export async function VistaMes({ mes }: { mes: string }) {
  const hoje = hojeISO();
  const [a, m] = mes.split("-").map(Number);
  const primeiro = montarISO(a, m, 1);
  const ultimo = montarISO(a, m, new Date(Date.UTC(a, m, 0)).getUTCDate());
  const inicio = segundaDa(primeiro);
  const fim = somarDias(segundaDa(ultimo), 6);
  const anterior = montarISO(m === 1 ? a - 1 : a, m === 1 ? 12 : m - 1, 1).slice(0, 7);
  const proximo = montarISO(m === 12 ? a + 1 : a, m === 12 ? 1 : m + 1, 1).slice(0, 7);

  const supabase = await createClient();
  const [{ data: contextos }, { data: eventos }, { data: prazos }, { data: rotinas }] = await Promise.all([
    supabase.from("contexts").select("id, name, color, kind").eq("archived", false).order("position"),
    supabase.from("events").select("id, title, context_id, starts_at, ends_at, location, course_id, done_at").gte("starts_at", inicioDoDia(inicio)).lte("starts_at", fimDoDia(fim)).order("starts_at"),
    supabase.from("responsibilities").select("id, title, context_id, due_date, due_time, state").gte("due_date", inicio).lte("due_date", fim).neq("state", "concluida"),
    supabase.from("routines").select(CAMPOS_ROTINA).eq("status", "ativa").not("month_day", "is", null),
  ]);
  const ctx = contextos ?? [];
  const cor = (id: string | null) => ctx.find((c) => c.id === id)?.color ?? "var(--gray)";

  const itens: Item[] = [
    ...((eventos ?? []) as Compromisso[]).map((e) => ({ id: e.id, dia: hojeISO(new Date(e.starts_at)), hora: horaDe(e.starts_at), titulo: e.title, cor: e.course_id ? AZUL_ESTUDO : cor(e.context_id), href: `/calendario/${e.id}`, tipo: "evento" as const, feito: !!e.done_at })),
    ...(prazos ?? []).map((p) => ({ id: p.id, dia: p.due_date!, hora: p.due_time ? p.due_time.slice(0, 5) : null, titulo: p.title, cor: cor(p.context_id), href: `/responsabilidades/${p.id}`, tipo: "prazo" as const })),
    // Lembretes do mês (condomínio, DAS…) no dia deles, neste mês e nos dias visíveis do mês vizinho
    ...((rotinas ?? []) as Rotina[]).flatMap((r) =>
      [inicio, primeiro, fim].map((d) => diaNoMes(r, d)).filter((d, i, l) => l.indexOf(d) === i && d >= inicio && d <= fim)
        .map((d) => ({ id: `${r.id}-${d}`, dia: d, hora: r.at_time ? r.at_time.slice(0, 5) : null, titulo: r.title, cor: cor(r.context_id), href: `/rotinas#${r.id}`, tipo: "lembrete" as const })),
    ),
  ].sort((x, y) => (x.hora ?? "99").localeCompare(y.hora ?? "99"));

  const dias = Array.from({ length: Math.round((new Date(fim).getTime() - new Date(inicio).getTime()) / 86400000) + 1 }, (_, i) => somarDias(inicio, i));
  const titulo = mesAno(primeiro);

  return (
    <div className="page page--wide">
      <div className="page__head">
        <div>
          <h1 className="page__t">{titulo[0].toUpperCase() + titulo.slice(1)}</h1>
        </div>
        <div className="page__actions">
          <AlternarVista vista="mes" semana={primeiro <= hoje && hoje <= ultimo ? hoje : primeiro} mes={mes} />
          <Link href={`/calendario?vista=mes&mes=${anterior}`} className="icon-btn" aria-label="Mês anterior"><ChevronLeft size={18} /></Link>
          <Link href="/calendario?vista=mes" className="btn btn--line btn--sm">Hoje</Link>
          <Link href={`/calendario?vista=mes&mes=${proximo}`} className="icon-btn" aria-label="Próximo mês"><ChevronRight size={18} /></Link>
          <NovoCompromisso contextos={ctx} data={primeiro <= hoje && hoje <= ultimo ? hoje : primeiro} />
        </div>
      </div>

      <div className="month" role="grid" aria-label={titulo}>
        {[1, 2, 3, 4, 5, 6, 0].map((d) => <div key={d} className="month__h" role="columnheader">{SEMANA_CURTA[d]}</div>)}
        {dias.map((d) => {
          const doDia = itens.filter((x) => x.dia === d);
          const fora = d < primeiro || d > ultimo;
          return (
            <Link key={d} href={`/calendario?semana=${d}`} role="gridcell" className={`month__d${fora ? " is-out" : ""}${d === hoje ? " is-today" : ""}${d < hoje ? " is-past" : ""}`} aria-label={`${Number(d.slice(8))}: ${doDia.length} ${doDia.length === 1 ? "item" : "itens"}`}>
              <b>{Number(d.slice(8))}</b>
              <span className="month__itens">
                {doDia.slice(0, MAX_POR_DIA).map((x) => (
                  <span key={x.id} className={`month__i month__i--${x.tipo}${x.feito ? " is-done" : ""}`} style={{ "--c": x.cor } as React.CSSProperties}>
                    {x.hora && <time>{x.hora}</time>}{x.titulo}
                  </span>
                ))}
                {doDia.length > MAX_POR_DIA && <small>+{doDia.length - MAX_POR_DIA}</small>}
              </span>
              {doDia.length > 0 && <span className="month__dots" aria-hidden>{doDia.slice(0, 4).map((x) => <i key={x.id} style={{ background: x.cor }} />)}</span>}
            </Link>
          );
        })}
      </div>
      <p className="field__hint" style={{ marginTop: 12 }}>
        <span className="month__leg month__leg--evento">Compromisso</span>
        <span className="month__leg month__leg--prazo">Prazo</span>
        <span className="month__leg month__leg--lembrete">Lembrete do mês</span>
      </p>
    </div>
  );
}
