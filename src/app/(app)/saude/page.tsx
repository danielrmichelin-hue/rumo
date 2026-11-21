import Link from "next/link";
import { ChevronRight, Repeat } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ListaResponsabilidades } from "@/components/ListaResponsabilidades";
import { NovoCompromisso } from "@/components/FormCompromisso";
import { AcoesRemedio, Dose, HistoricoMedida, NovaMedida, NovoRemedio } from "@/components/Saude";
import { SemanaRotina } from "@/components/Rotinas";
import type { ContextItem } from "@/components/Shell";
import { diaMes, hojeISO, horaDe, inicioDoDia, rotuloData, rotuloHora, somarDias } from "@/lib/datas";

const maiuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
import { CAMPOS_ROTINA, desdeMarcas, feitaEm, type Marcacao, type Rotina, semanaDaRotina, textoFrequencia } from "@/lib/rotinas";
import { agruparRemedios, CAMPOS_MEDIDA, dosesDeHoje, ehSaude, normalizarMedida, seriesDeMedidas, textoTratamento, TIPOS_SAUDE, valorMedida, type Serie, type TipoSaude } from "@/lib/saude";
import { CAMPOS_LISTA, ordenar, type Responsabilidade } from "@/lib/tipos";

export const metadata = { title: "Saúde" };

type Consulta = { id: string; title: string; starts_at: string; location: string | null; note: string | null; health_kind: TipoSaude };
const CAMPOS_CONSULTA = "id, title, starts_at, location, note, health_kind";

/** A medida no tempo: uma linha fina, o último ponto marcado; passar o mouse mostra o dia e o valor */
function Tendencia({ serie }: { serie: Serie }) {
  const p = serie.pontos;
  if (p.length < 2) return null;
  const L = 132, A = 36, m = 5;
  const valores = p.flatMap((x) => (x.value2 !== null ? [x.value, x.value2] : [x.value]));
  const min = Math.min(...valores), max = Math.max(...valores);
  const x = (i: number) => m + (i * (L - 2 * m)) / (p.length - 1);
  const y = (v: number) => (max === min ? A / 2 : A - m - ((v - min) * (A - 2 * m)) / (max - min));
  const linha = (f: (i: number) => number) => p.map((_, i) => `${x(i).toFixed(1)},${y(f(i)).toFixed(1)}`).join(" ");
  const u = p.length - 1;
  return (
    <svg className="tendencia" viewBox={`0 0 ${L} ${A}`} width={L} height={A} role="img" aria-label={`${serie.rotulo}: ${p.map((v) => `${rotuloData(v.measured_on)} ${valorMedida(v)}`).join(", ")}`}>
      {serie.kind === "pressao" && <polyline className="tendencia__2" points={linha((i) => p[i].value2 ?? p[i].value)} />}
      <polyline points={linha((i) => p[i].value)} />
      {p.map((v, i) => (
        <circle key={v.id} cx={x(i)} cy={y(v.value)} r={i === u ? 4 : 9} className={i === u ? "tendencia__fim" : "tendencia__alvo"}>
          <title>{`${rotuloData(v.measured_on)}: ${valorMedida(v)}`}</title>
        </circle>
      ))}
    </svg>
  );
}

export default async function Page() {
  const hoje = hojeISO();
  const supabase = await createClient();
  const { data: contextos } = await supabase.from("contexts").select("id, name, color, kind").eq("archived", false).order("position");
  const ctx = (contextos ?? []) as ContextItem[];
  const saude = ctx.find((c) => ehSaude(c.name)) ?? null;

  const [{ data: rotinasDb }, { data: marcasDb }, { data: proximasDb }, { data: anterioresDb }, { data: medidasDb }, { data: tarefasDb }] = await Promise.all([
    supabase.from("routines").select(CAMPOS_ROTINA).order("position"),
    supabase.from("routine_checks").select("routine_id, done_on").gte("done_on", desdeMarcas(hoje)),
    supabase.from("events").select(CAMPOS_CONSULTA).not("health_kind", "is", null).gte("starts_at", inicioDoDia(hoje)).order("starts_at").limit(12),
    supabase.from("events").select(CAMPOS_CONSULTA).not("health_kind", "is", null).lt("starts_at", inicioDoDia(hoje)).order("starts_at", { ascending: false }).limit(12),
    supabase.from("health_measures").select(CAMPOS_MEDIDA).gte("measured_on", somarDias(hoje, -400)).order("measured_on"),
    saude ? supabase.from("responsibilities").select(CAMPOS_LISTA).eq("context_id", saude.id).neq("state", "concluida") : Promise.resolve({ data: [] }),
  ]);

  // Remédios (com dose) e hábitos do contexto Saúde
  const rotinas = ((rotinasDb ?? []) as Rotina[]).filter((r) => r.dose || (saude && r.context_id === saude.id));
  const marcas = (marcasDb ?? []) as Marcacao[];
  const remedios = agruparRemedios(rotinas);
  const emUso = remedios.filter((m) => m.ativo && (!m.ends_on || m.ends_on >= hoje));
  const parados = remedios.filter((m) => !emUso.includes(m));
  const doses = dosesDeHoje(remedios, marcas, hoje);
  const habitos = rotinas.filter((r) => !r.dose && r.status === "ativa");
  const proximas = (proximasDb ?? []) as Consulta[];
  const anteriores = (anterioresDb ?? []) as Consulta[];
  const series = seriesDeMedidas((medidasDb ?? []).map(normalizarMedida), hoje);
  const peso = series.find((s) => s.kind === "peso");
  const pressao = series.find((s) => s.kind === "pressao");
  const tarefas = ((tarefasDb ?? []) as Responsabilidade[]).sort(ordenar);
  const proxima = proximas[0];
  const quando = (c: Consulta) => {
    const dia = hojeISO(new Date(c.starts_at));
    return `${maiuscula(rotuloData(dia, hoje))} · ${rotuloHora(horaDe(c.starts_at))}`;
  };
  const quandoMedida = (dia: string) => {
    const r = rotuloData(dia, hoje);
    return /^\d/.test(r) || r.includes(",") ? `Em ${r}` : maiuscula(r);
  };

  return (
    <div className="page page--wide">
      <div className="page__head">
        <div>
          <h1 className="page__t">Saúde</h1>
        </div>
        <div className="page__actions">
          <NovoCompromisso contextos={ctx} data={hoje} saude contexto={saude?.id ?? null} rotulo="Consulta ou exame" />
        </div>
      </div>

      <div className="nums">
        <div>
          <small>Remédios hoje</small>
          {doses.total ? <b>{doses.tomadas} de {doses.total}</b> : <b className="nums__vazio">Nenhum</b>}
          <span>{doses.total ? (doses.tomadas === doses.total ? "Tudo tomado" : `${doses.total - doses.tomadas} ${doses.total - doses.tomadas === 1 ? "dose a tomar" : "doses a tomar"}`) : "Guarde os que você toma"}</span>
        </div>
        <div>
          <small>Próxima consulta ou exame</small>
          {proxima ? <><b className="nums__texto">{proxima.title}</b><span>{quando(proxima)}</span></> : <><b className="nums__vazio">Nada marcado</b><span>Marque a próxima aqui</span></>}
        </div>
        <div>
          <small>Peso</small>
          {peso ? <><b>{valorMedida(peso.ultima)}</b><span>{peso.variacao ?? quandoMedida(peso.ultima.measured_on)}</span></> : <><b className="nums__vazio">Sem registro</b><span>Registre ao lado</span></>}
        </div>
        <div>
          <small>Pressão</small>
          {pressao ? <><b>{valorMedida(pressao.ultima)}</b><span>{quandoMedida(pressao.ultima.measured_on)}</span></> : <><b className="nums__vazio">Sem registro</b><span>Escreva assim: 120/80</span></>}
        </div>
      </div>

      <div className="fin-cols">
        <div>
          <section className="bloco">
            <h2 className="sec__h">Remédios {emUso.length > 0 && <em>{emUso.length}</em>}<span className="sec__act"><NovoRemedio contexto={saude?.id ?? null} /></span></h2>
            {emUso.length === 0 ? (
              <p className="bloco__vazio">Nenhum remédio.</p>
            ) : (
              <ul className="remedios">
                {emUso.map((m) => (
                  <li key={m.chave} className="remedio">
                    <span className="remedio__t"><b>{m.title}</b><small>{m.dose} · {textoTratamento(m.ends_on, hoje)}</small></span>
                    <span className="remedio__doses">
                      {m.doses.map((d) => <Dose key={d.rotina.id} id={d.rotina.id} titulo={m.title} hora={d.hora} tomada={feitaEm(d.rotina, marcas, hoje)} />)}
                    </span>
                    <AcoesRemedio remedio={m} />
                  </li>
                ))}
              </ul>
            )}
            {parados.length > 0 && (
              <details className="fold remedios__parados">
                <summary className="sec__h"><ChevronRight aria-hidden />Parados ou terminados {parados.length > 0 && <em>{parados.length}</em>}</summary>
                <ul className="remedios">
                  {parados.map((m) => (
                    <li key={m.chave} className="remedio remedio--parado">
                      <span className="remedio__t"><b>{m.title}</b><small>{m.dose} · {m.ativo ? textoTratamento(m.ends_on, hoje) : "Parado"}</small></span>
                      <span className="remedio__doses">{m.doses.map((d) => d.hora).filter(Boolean).join(" · ")}</span>
                      <AcoesRemedio remedio={m} />
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </section>

          <section className="bloco">
            <h2 className="sec__h">Consultas e exames {proximas.length > 0 && <em>{proximas.length}</em>}<span className="sec__act"><NovoCompromisso contextos={ctx} data={hoje} saude contexto={saude?.id ?? null} rotulo="Marcar" variante="btn btn--ghost btn--sm" /></span></h2>
            {proximas.length === 0 ? (
              <p className="bloco__vazio">Nada marcado.</p>
            ) : (
              <div className="agenda">
                {proximas.map((c) => (
                  <Link key={c.id} href={`/calendario/${c.id}`} className="consulta">
                    <span className="consulta__dia"><b>{Number(hojeISO(new Date(c.starts_at)).slice(8))}</b><small>{diaMes(hojeISO(new Date(c.starts_at))).split(" de ")[1].slice(0, 3)}</small></span>
                    <span className="consulta__t"><b>{c.title}</b><small>{TIPOS_SAUDE[c.health_kind]} · {quando(c)}{c.location ? ` · ${c.location}` : ""}</small></span>
                  </Link>
                ))}
              </div>
            )}
            {anteriores.length > 0 && (
              <details className="fold">
                <summary className="sec__h"><ChevronRight aria-hidden />Anteriores {anteriores.length > 0 && <em>{anteriores.length}</em>}</summary>
                <div className="agenda">
                  {anteriores.map((c) => (
                    <Link key={c.id} href={`/calendario/${c.id}`} className="consulta consulta--antiga">
                      <span className="consulta__dia"><b>{Number(hojeISO(new Date(c.starts_at)).slice(8))}</b><small>{diaMes(hojeISO(new Date(c.starts_at))).split(" de ")[1].slice(0, 3)}</small></span>
                      <span className="consulta__t"><b>{c.title}</b><small>{TIPOS_SAUDE[c.health_kind]}{c.note ? ` · ${c.note.split("\n")[0].slice(0, 90)}` : " · Sem anotação do que foi dito"}</small></span>
                    </Link>
                  ))}
                </div>
              </details>
            )}
          </section>

          {saude && (
            <section className="bloco">
              <h2 className="sec__h">Para resolver {tarefas.length > 0 && <em>{tarefas.length}</em>}<Link href={`/contexto/${saude.id}`} className="sec__act">{saude.name}</Link></h2>
              {tarefas.length === 0 ? (
                <p className="bloco__vazio">Nada para resolver.</p>
              ) : (
                <ListaResponsabilidades itens={tarefas} contextos={ctx} comContexto={false} />
              )}
            </section>
          )}
        </div>

        <aside className="fin-lado">
          <section className="bloco">
            <h2 className="sec__h">Medidas</h2>
            <NovaMedida />
            {series.length === 0 ? (
              <p className="bloco__vazio">Nenhuma medida ainda.</p>
            ) : (
              <ul className="medidas">
                {series.map((s) => (
                  <li key={s.chave} className="medida">
                    <span className="medida__t"><small>{s.rotulo}</small><b>{valorMedida(s.ultima)}</b><span>{s.variacao ?? quandoMedida(s.ultima.measured_on)}</span></span>
                    <Tendencia serie={s} />
                    <details className="medida__mais">
                      <summary>{s.pontos.length} {s.pontos.length === 1 ? "registro" : "registros"}</summary>
                      <HistoricoMedida pontos={s.pontos} />
                    </details>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="bloco">
            <h2 className="sec__h">Hábitos<Link href="/rotinas" className="sec__act">Rotinas</Link></h2>
            {habitos.length === 0 ? (
              <p className="bloco__vazio">Nenhum hábito no contexto Saúde.</p>
            ) : (
              <ul className="habitos">
                {habitos.map((r) => (
                  <li key={r.id}>
                    <span><b>{r.title}</b><small><Repeat aria-hidden />{textoFrequencia(r)} · {semanaDaRotina(r, marcas, hoje).texto}</small></span>
                    <SemanaRotina rotina={r} marcas={marcas} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
