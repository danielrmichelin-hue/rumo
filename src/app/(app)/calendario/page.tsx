import { AZUL_ESTUDO } from "@/lib/estudos";
import { CAMPOS_ROTINA, diaNoMes, type Rotina, VERDE_ROTINA } from "@/lib/rotinas";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { NovoCompromisso } from "@/components/FormCompromisso";
import { agoraHora, diaDaSemana, fimDoDia, hojeISO, horaDe, inicioDoDia, instante, prazoPassou, rotuloHora, SEMANA_CURTA, somarDias } from "@/lib/datas";
import { emColunas, numeroSemana, segundaDa, tituloDoMes } from "@/lib/semana";
import { CAMPOS_LISTA, type Compromisso, type Responsabilidade } from "@/lib/tipos";
import { AlternarVista } from "./AlternarVista";
import { VistaMes } from "./VistaMes";

export const metadata = { title: "Calendário" };

const H_INICIO = 7;
const H_FIM = 22;
const ALTURA = 52; // px por hora

const minutos = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

export default async function Page({ searchParams }: { searchParams: Promise<{ semana?: string; vista?: string; mes?: string }> }) {
  const { semana, vista, mes } = await searchParams;
  const hoje = hojeISO();
  if (vista === "mes") return <VistaMes mes={mes && /^\d{4}-(0[1-9]|1[0-2])$/.test(mes) ? mes : hoje.slice(0, 7)} />;
  const agora = agoraHora();
  const segunda = segundaDa(semana && /^\d{4}-\d{2}-\d{2}$/.test(semana) ? semana : hoje);
  const domingo = somarDias(segunda, 6);
  const de = inicioDoDia(segunda);
  const ate = fimDoDia(domingo);

  const supabase = await createClient();
  const [{ data: contextos }, { data: eventos }, { data: comPrazo }, { data: semHora }, { data: rotinasDb }, { data: marcasDb }] = await Promise.all([
    supabase.from("contexts").select("id, name, color, kind").eq("archived", false).order("position"),
    supabase.from("events").select("id, title, context_id, starts_at, ends_at, location, course_id, done_at").gte("starts_at", de).lte("starts_at", ate).order("starts_at"),
    supabase.from("responsibilities").select(CAMPOS_LISTA).gte("due_date", segunda).lte("due_date", domingo),
    supabase.from("responsibilities").select(CAMPOS_LISTA).eq("state", "a_fazer").is("due_time", null).eq("today", true),
    supabase.from("routines").select(CAMPOS_ROTINA).eq("status", "ativa").not("at_time", "is", null),
    supabase.from("routine_checks").select("routine_id, done_on").gte("done_on", segunda).lte("done_on", domingo),
  ]);
  const ctx = contextos ?? [];
  const cor = (id: string | null) => ctx.find((c) => c.id === id)?.color;
  const compromissos = (eventos ?? []) as Compromisso[];
  // Rotinas com dia e horário entram na grade como blocos (Book: "Academia · 08:00 · Rotina")
  type Bloco = Compromisso & { rotina?: string };
  const blocosRotina: Bloco[] = ((rotinasDb ?? []) as Rotina[]).flatMap((r) =>
    Array.from({ length: 7 }, (_, i) => somarDias(segunda, i))
      .filter((d) => (r.month_day ? diaNoMes(r, d) === d : !!r.days?.includes(diaDaSemana(d))))
      .map((d) => {
        const ini = new Date(instante(d, r.at_time!));
        const feita = (marcasDb ?? []).some((m) => m.routine_id === r.id && m.done_on === d);
        return { id: `${r.id}-${d}`, rotina: r.id, title: r.title, context_id: r.context_id, starts_at: ini.toISOString(), ends_at: new Date(ini.getTime() + (r.duration_min ?? 30) * 60000).toISOString(), location: null, done_at: feita ? ini.toISOString() : null };
      }),
  );
  const evs: Bloco[] = [...compromissos, ...blocosRotina].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  // Sessões de estudo em azul de estudo (Book: módulo Estudos no calendário)
  const corEv = (e: Bloco) => (e.course_id ? AZUL_ESTUDO : e.rotina ? cor(e.context_id) ?? VERDE_ROTINA : cor(e.context_id));
  const linkEv = (e: Bloco) => (e.rotina ? `/rotinas#${e.rotina}` : `/calendario/${e.id}`);
  const prazos = (comPrazo ?? []) as Responsabilidade[];

  // Semana útil; sábado e domingo só aparecem quando têm algo (ou quando hoje é fim de semana)
  const dias = Array.from({ length: 7 }, (_, i) => somarDias(segunda, i)).filter((d, i) => {
    if (i < 5) return true;
    return d === hoje || evs.some((e) => hojeISO(new Date(e.starts_at)) === d) || prazos.some((p) => p.due_date === d);
  });

  // "Sem horário": o que é para esta semana (ou marcado para hoje) e ainda não tem hora
  const vistos = new Set<string>();
  const semHorario = [...prazos.filter((p) => p.state === "a_fazer" && !p.due_time && p.due_date! >= hoje), ...((semHora ?? []) as Responsabilidade[])]
    .filter((p) => (vistos.has(p.id) ? false : (vistos.add(p.id), true)))
    .slice(0, 12);

  const porDia = (d: string) =>
    emColunas(
      evs
        .filter((e) => hojeISO(new Date(e.starts_at)) === d)
        .map((e) => {
          const ini = minutos(horaDe(e.starts_at));
          const fim = e.ends_at ? Math.max(ini + 20, minutos(horaDe(e.ends_at))) : ini + 60;
          return { e, ini, fim };
        }),
    );
  const horas = Array.from({ length: H_FIM - H_INICIO }, (_, i) => H_INICIO + i);
  const topo = (min: number) => ((Math.max(min, H_INICIO * 60) - H_INICIO * 60) / 60) * ALTURA;

  return (
    <div className="page page--wide">
      <div className="page__head">
        <div>
          <h1 className="page__t">{tituloDoMes(segunda)}</h1>
          <p className="page__sub">Semana {numeroSemana(segunda)} · <b>{compromissos.length}</b> {compromissos.length === 1 ? "compromisso" : "compromissos"} · <b>{prazos.filter((p) => p.state !== "concluida").length}</b> prazos</p>
        </div>
        <div className="page__actions">
          <AlternarVista vista="semana" semana={segunda} mes={(segunda <= hoje && hoje <= domingo ? hoje : segunda).slice(0, 7)} />
          <Link href={`/calendario?semana=${somarDias(segunda, -7)}`} className="icon-btn" aria-label="Semana anterior"><ChevronLeft size={18} /></Link>
          <Link href="/calendario" className="btn btn--line btn--sm">Hoje</Link>
          <Link href={`/calendario?semana=${somarDias(segunda, 7)}`} className="icon-btn" aria-label="Próxima semana"><ChevronRight size={18} /></Link>
          <NovoCompromisso contextos={ctx} data={segunda <= hoje && hoje <= domingo ? hoje : segunda} />
        </div>
      </div>

      <div className="cal-wrap">
        {/* computador: grade da semana */}
        <div className="cal" style={{ gridTemplateColumns: `48px repeat(${dias.length}, minmax(0, 1fr))` }}>
          <div />
          {dias.map((d) => (
            <div key={d} className={`cal__d${d === hoje ? " is-today" : ""}`}>
              {SEMANA_CURTA[diaDaSemana(d)]} <b>{Number(d.slice(8))}</b>
            </div>
          ))}

          <div className="cal__label">Prazos</div>
          {dias.map((d) => (
            <div key={`p${d}`} className="cal__dues">
              {prazos.filter((p) => p.due_date === d).map((p) => (
                <Link key={p.id} href={`/responsabilidades/${p.id}`} className={`due${p.state === "concluida" ? " is-done" : ""}${prazoPassou(p, hoje, agora) ? " is-late" : ""}`} title={p.title}>
                  <i className="dot" style={{ background: cor(p.context_id) ?? "var(--gray)" }} />
                  <span>{p.due_time && `${rotuloHora(p.due_time)} · `}{p.title}</span>
                </Link>
              ))}
            </div>
          ))}

          <div className="cal__hours" style={{ height: horas.length * ALTURA }}>
            {horas.map((h) => <span key={h} style={{ top: (h - H_INICIO) * ALTURA }}>{String(h).padStart(2, "0")}</span>)}
          </div>
          {dias.map((d) => (
            <div key={`c${d}`} className={`cal__col${d === hoje ? " is-today" : ""}`} style={{ height: horas.length * ALTURA, backgroundSize: `100% ${ALTURA}px` }}>
              {porDia(d).map(({ e, ini, fim, col, cols }) => (
                <Link
                  key={e.id}
                  href={linkEv(e)}
                  className={`ev${fim - ini < 45 ? " ev--short" : ""}${(fim < minutos(agora) && d === hoje) || e.done_at ? " is-past" : ""}`}
                  style={{
                    top: topo(ini),
                    height: Math.max(22, topo(fim) - topo(ini) - 2),
                    left: `calc(${(col / cols) * 100}% + 3px)`,
                    width: `calc(${100 / cols}% - 6px)`,
                    ["--c" as string]: corEv(e) ?? "var(--gray)",
                  }}
                >
                  {e.title}
                  <small>{horaDe(e.starts_at)}{e.rotina ? " · Rotina" : e.ends_at && `–${horaDe(e.ends_at)}`}{e.location && ` · ${e.location}`}</small>
                </Link>
              ))}
              {d === hoje && minutos(agora) >= H_INICIO * 60 && minutos(agora) <= H_FIM * 60 && (
                <i className="cal__now" style={{ top: topo(minutos(agora)) }} aria-hidden />
              )}
            </div>
          ))}
        </div>

        {/* celular: lista por dia */}
        <div className="cal-list">
          {dias.map((d) => {
            const doDia = evs.filter((e) => hojeISO(new Date(e.starts_at)) === d);
            const pz = prazos.filter((p) => p.due_date === d && p.state !== "concluida");
            return (
              <section key={d} className="sec">
                <h2 className={`sec__h${d === hoje ? " is-today" : ""}`}>{SEMANA_CURTA[diaDaSemana(d)]}, {d.slice(8)}/{d.slice(5, 7)}{d === hoje && <em>hoje</em>}</h2>
                {!doDia.length && !pz.length && <p className="empty" style={{ padding: "2px 10px 6px" }}>Nada marcado.</p>}
                <div className="agenda">
                  {doDia.map((e) => (
                    <Link key={e.id} href={linkEv(e)} className="ag">
                      <time>{horaDe(e.starts_at)}</time>
                      <div><b>{e.title}</b>{(corEv(e) || e.location) && <small>{corEv(e) && <i className="dot" style={{ background: corEv(e) }} />}{e.course_id ? "Estudo" : e.rotina ? "Rotina" : ctx.find((c) => c.id === e.context_id)?.name}{e.location && ` · ${e.location}`}</small>}</div>
                    </Link>
                  ))}
                  {pz.map((p) => (
                    <Link key={p.id} href={`/responsabilidades/${p.id}`} className="ag">
                      <time>{p.due_time ? p.due_time.slice(0, 5) : "prazo"}</time>
                      <div><b>{p.title}</b><small>{cor(p.context_id) && <i className="dot" style={{ background: cor(p.context_id) }} />}{ctx.find((c) => c.id === p.context_id)?.name ?? "Inbox"}</small></div>
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}
        </div>

        <aside className="cal-side" aria-label="Sem horário">
          <h2 className="sec__h">Sem horário {semHorario.length > 0 && <em>{semHorario.length}</em>}</h2>
          {semHorario.length === 0 ? (
            <p className="empty" style={{ paddingTop: 2 }}>Nada sem hora para esta semana.</p>
          ) : (
            <>
              <ul className="list">
                {semHorario.map((p) => (
                  <li key={p.id} className="row" style={{ gridTemplateColumns: "minmax(0,1fr) auto" }}>
                    <div className="row__body">
                      <Link href={`/responsabilidades/${p.id}`} className="row__t">{p.title}</Link>
                      <span className="props">
                        {cor(p.context_id) && <span className="prop"><i className="dot" style={{ background: cor(p.context_id) }} />{ctx.find((c) => c.id === p.context_id)?.name}</span>}
                        {p.due_date && <span className="prop"><Clock aria-hidden />{p.due_date === hoje ? "Hoje" : `${p.due_date.slice(8)}/${p.due_date.slice(5, 7)}`}</span>}
                      </span>
                    </div>
                    <NovoCompromisso contextos={ctx} data={p.due_date ?? hoje} titulo={p.title} rotulo="Reservar" variante="btn btn--line btn--sm" />
                  </li>
                ))}
              </ul>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
