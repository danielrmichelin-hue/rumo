// Estudos: o painel geral, as aulas de hoje e, por área, o roadmap e os projetos com as disciplinas
import Link from "next/link";
import { hojeISO, SEMANA_CURTA } from "@/lib/datas";
import { constancia, metaDoProjeto, nomeDaAula } from "@/lib/trilhas";
import { createClient } from "@/lib/supabase/server";
import { AulaDoDia, CriarAreas, EditarArea, EditarProjeto, LembreteEstudo, MoverFila, NovaArea, NovaDisciplina, NovoProjeto } from "@/components/Trilhas";
import { RoadmapEstudos } from "@/components/RoadmapEstudos";
import { carregarEstudos } from "./dados";

export const metadata = { title: "Estudos" };

const dm = (iso: string) => `${iso.slice(8)}/${iso.slice(5, 7)}/${iso.slice(2, 4)}`;
const horas = (min: number) => (min >= 60 ? `${Math.floor(min / 60)}h${min % 60 ? String(min % 60).padStart(2, "0") : ""}` : `${min} min`);
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
const dias = (w: number[]) => {
  const s = [...w].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
  return s.join() === "1,2,3,4,5" ? "seg a sex" : s.join() === "1,2,3,4,5,6" ? "seg a sáb" : s.length === 7 ? "todo dia" : s.map((d) => SEMANA_CURTA[d]).join(", ");
};

export default async function Page() {
  const hoje = hojeISO();
  const supabase = await createClient();
  const [{ areas, projetos, aulas, aulasDe, porArea }, { data: perfil }] = await Promise.all([carregarEstudos(hoje), supabase.from("profiles").select("study_reminder").maybeSingle()]);
  const c = constancia(aulas, hoje, 22);
  const metaSemana = porArea.reduce((t, x) => t + x.area.daily_lessons * x.area.weekdays.length, 0); // aulas (= horas) por semana no plano
  const maiorSemana = Math.max(metaSemana * 60, ...c.porSemana.slice(-8).map((x) => x.min), 60);

  const total = aulas.length, feitas = aulas.filter((a) => a.done_on).length;
  const minutos = aulas.reduce((t, a) => t + (a.done_on ? a.minutes ?? 0 : 0), 0);
  const fimDeTudo = porArea.flatMap((x) => x.roadmap.map((r) => r.fim)).filter((f): f is string => !!f).sort().pop();
  const semana = aulas.filter((a) => a.done_on && a.done_on > new Date(Date.parse(`${hoje}T12:00:00Z`) - 7 * 86400000).toISOString().slice(0, 10)).length;
  const deHoje = porArea.flatMap((x) => x.hoje);

  return (
    <div className="page page--wide">
      <div className="page__head">
        <div><h1 className="page__t">Estudos</h1></div>
        {areas.length > 0 && <div className="page__actions"><LembreteEstudo hora={perfil?.study_reminder ?? null} /></div>}
      </div>

      {!areas.length ? (
        <section className="bloco"><p className="bloco__vazio">Profissional com 2 aulas por dia e Intelectual com 1, de segunda a sexta.</p><div style={{ padding: "0 8px 12px" }}><CriarAreas /></div></section>
      ) : (
        <>
          <div className="nums">
            <div><small>Aulas no total</small><b>{total}</b><span>{porArea.map((x) => `${x.area.name} ${x.roadmap.reduce((t, r) => t + r.total, 0)}`).join(" · ")}</span></div>
            <div><small>Concluídas</small><b className="pos">{feitas}</b><span>{pct(feitas, total)}% · faltam {total - feitas}</span></div>
            <div><small>Horas estudadas</small><b>{horas(minutos)}</b><span>{semana} {semana === 1 ? "aula" : "aulas"} nos últimos 7 dias</span></div>
            <div><small>Termina tudo em</small><b className="nums__texto">{fimDeTudo ? dm(fimDeTudo) : "—"}</b><span>No ritmo das aulas por dia</span></div>
          </div>

          {deHoje.length > 0 && (
            <section className="bloco" style={{ marginBottom: 16 }}>
              <h2 className="sec__h">Aulas de hoje<em>{deHoje.filter((x) => !x.feita).length}</em></h2>
              <ul className="aulas-dia">
                {deHoje.map(({ d, p, aula, feita }) => <AulaDoDia key={aula.id} aula={aula} titulo={nomeDaAula(d, aula)} projeto={p.name} cor={p.color} feita={feita} />)}
              </ul>
            </section>
          )}

          {aulas.some((a) => a.done_on) && (
            <div className="estudo-ritmo">
              <section className="bloco">
                <h2 className="sec__h">Constância<span className="sec__act">{c.ultimos30} {c.ultimos30 === 1 ? "dia" : "dias"} de estudo nos últimos 30</span></h2>
                <div className="mapa" role="img" aria-label={`${c.ultimos30} dias de estudo nos últimos 30`}>
                  {c.dias.map((d) => <i key={d.dia} data-n={d.futuro ? undefined : Math.min(4, d.aulas)} className={d.futuro ? "is-futuro" : undefined} title={`${dm(d.dia)}${d.aulas ? ` · ${d.aulas} ${d.aulas === 1 ? "aula" : "aulas"}${d.min ? ` · ${horas(d.min)}` : ""}` : ""}`} />)}
                </div>
                <p className="mapa__leg"><span>Menos</span>{[0, 1, 2, 3, 4].map((n) => <i key={n} data-n={n} />)}<span>Mais</span></p>
              </section>
              <section className="bloco">
                <h2 className="sec__h">Horas por semana<span className="sec__act">plano: {metaSemana}h</span></h2>
                <div className="colunas">
                  {metaSemana > 0 && <i className="colunas__meta" style={{ bottom: `calc(26px + (100% - 48px) * ${(metaSemana * 60) / maiorSemana})` }} />}
                  {c.porSemana.slice(-8).map((s) => (
                    <div key={s.ini} className={s.atual ? "is-atual" : undefined} title={`${s.aulas} ${s.aulas === 1 ? "aula" : "aulas"} · ${horas(s.min)}`}>
                      <span style={{ height: `${(s.min / maiorSemana) * 100}%` }}>{s.min > 0 && <em>{horas(s.min)}</em>}</span>
                      <small>{dm(s.ini).slice(0, 5)}</small>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}

          {porArea.map(({ area, roadmap, ritmo, fila }) => {
            const projs = projetos.filter((p) => p.area_id === area.id).sort((a, b) => Number(a.archived) - Number(b.archived) || a.position - b.position);
            const tot = roadmap.reduce((t, r) => t + r.total, 0), fe = roadmap.reduce((t, r) => t + r.feitas, 0);
            const fim = roadmap.map((r) => r.fim).filter((f): f is string => !!f).sort().pop();
            return (
              <section key={area.id} className="estudo-area">
                <header className="estudo-area__cab">
                  <div>
                    <h2>{area.name}</h2>
                    <small>{area.daily_lessons} {area.daily_lessons === 1 ? "aula" : "aulas"} por dia · {dias(area.weekdays)} · {fe}/{tot} aulas ({pct(fe, tot)}%){fim ? ` · termina em ${dm(fim)}` : ""}</small>
                    {ritmo && <span className={`ritmo ritmo--${ritmo.diferenca < 0 ? "atras" : ritmo.diferenca > 0 ? "frente" : "em-dia"}`}>{ritmo.diferenca < 0 ? `${-ritmo.diferenca} ${ritmo.diferenca === -1 ? "aula atrasada" : "aulas atrasadas"}` : ritmo.diferenca > 0 ? `${ritmo.diferenca} ${ritmo.diferenca === 1 ? "aula adiantada" : "aulas adiantadas"}` : "No ritmo"}<small> · desde {dm(ritmo.desde)}: {ritmo.feitas} de {ritmo.esperado} até ontem</small></span>}
                  </div>
                  <EditarArea area={area} />
                </header>

                <section className="bloco">
                  <h2 className="sec__h">Roadmap<span className="sec__act">{area.daily_lessons} em paralelo</span></h2>
                  <RoadmapEstudos linhas={roadmap} hoje={hoje} />
                </section>

                <div className="estudo-projetos">
                  {projs.map((p) => {
                    const discs = roadmap.filter((r) => r.p.id === p.id);
                    const t = discs.reduce((s, r) => s + r.total, 0), f = discs.reduce((s, r) => s + r.feitas, 0);
                    const fimP = discs.map((r) => r.fim).filter((x): x is string => !!x).sort().pop();
                    const ativos = projs.filter((x) => !x.archived);
                    const meta = p.archived ? null : metaDoProjeto(area, fila, aulasDe, hoje, p);
                    return (
                      <section key={p.id} className={`bloco estudo-proj${p.archived ? " is-pausado" : ""}`}>
                        <header className="estudo-proj__cab">
                          <i style={{ background: p.color }} aria-hidden />
                          <div><b>{p.name}</b><small>{p.archived ? "Pausado" : `${f}/${t} aulas · ${pct(f, t)}%${fimP ? ` · termina em ${dm(fimP)}` : ""}`}</small></div>
                          {!p.archived && <MoverFila tabela="study_projects" id={p.id} primeiro={ativos.indexOf(p) === 0} ultimo={ativos.indexOf(p) === ativos.length - 1} />}
                          <EditarProjeto projeto={p} areas={areas} />
                        </header>
                        <span className="estudo-proj__barra"><i style={{ width: `${pct(f, t)}%`, background: p.color }} /></span>
                        {meta && (
                          <p className={`estudo-meta estudo-meta--${meta.cabe ? "ok" : "nao"}`}>
                            <b>Meta {dm(meta.alvo)}: {meta.cabe ? "cabe" : "não cabe"}</b>
                            <span>{meta.fim ? `No ritmo atual termina em ${dm(meta.fim)}.` : "Sem previsão (a área está sem aulas por dia)."}{!meta.cabe && meta.aulasPorDia ? ` Com ${meta.aulasPorDia.n} aulas por dia em ${area.name}, termina em ${dm(meta.aulasPorDia.fim)}.` : ""}{!meta.cabe && meta.primeiro ? ` Se for o primeiro da fila, termina em ${dm(meta.primeiro)}${meta.primeiro <= meta.alvo ? " e cabe" : ""}.` : ""}{!meta.cabe && !meta.aulasPorDia && !(meta.primeiro && meta.primeiro <= meta.alvo) ? " Mais aulas por dia não adiantam (cada disciplina dá uma aula por dia): vale mudar a data." : ""}</span>
                          </p>
                        )}
                        <ul className="estudo-discs">
                          {discs.map((r, k) => (
                            <li key={r.d.id}>
                              <Link href={`/estudos/d/${r.d.id}`} className="estudo-disc">
                                <b>{r.d.name}</b>
                                <span className="estudo-disc__barra"><i style={{ width: `${pct(r.feitas, r.total)}%`, background: p.color }} /></span>
                                <small>{r.feitas}/{r.total}{r.feitas >= r.total && r.total ? " · concluída" : r.inicio && r.inicio > hoje ? ` · começa ${dm(r.inicio)}` : r.fim ? ` · termina ${dm(r.fim)}` : ""}</small>
                              </Link>
                              <MoverFila tabela="study_disciplines" id={r.d.id} primeiro={k === 0} ultimo={k === discs.length - 1} />
                            </li>
                          ))}
                        </ul>
                        <NovaDisciplina projetoId={p.id} />
                      </section>
                    );
                  })}
                </div>
                <NovoProjeto areaId={area.id} />
              </section>
            );
          })}
          <section className="estudo-area"><NovaArea /></section>
        </>
      )}
    </div>
  );
}
