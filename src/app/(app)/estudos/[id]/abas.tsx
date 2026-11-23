// Abas do estudo: Conteúdo, Exercícios, Provas e Desempenho (componentes do servidor; os formulários são do cliente)
import { EditalMateria } from "@/components/Aulas";
import { ApagarRegistro, NovaProva, RegistrarQuestoes } from "@/components/Desempenho";
import { diaMes, rotuloData } from "@/lib/datas";
import {
  acertoPorMateria, aproveitamento, constancia, duracao, horas, horasPorMateria, horasPorSemana, pctTexto, tomAcerto,
  type Materia, type Questao, type Sessao, type Simulado, type Tema,
} from "@/lib/estudos";

const nota = (v: number) => String(Math.round(v * 100) / 100).replace(".", ",");

type Base = { cursoId: string; materias: Materia[]; temas: Tema[]; questoes: Questao[] };

export function AbaEdital({ cursoId, materias, temas, questoes }: Base) {
  if (!materias.length) return <p className="empty">Crie as matérias na aba Ciclo.</p>;
  const porTema: Record<string, { pct: number | null; total: number }> = {};
  for (const t of temas) {
    const a = aproveitamento(questoes.filter((q) => q.topic_id === t.id));
    if (a.total) porTema[t.id] = a;
  }
  const vistos = temas.filter((t) => t.done_at).length;
  return (
    <div className="editais">
      <p className="edital__geral"><b>{vistos}</b> de <b>{temas.length}</b> temas vistos</p>
      {materias.map((m) => (
        <EditalMateria key={m.id} cursoId={cursoId} materia={m} temas={temas} acertoTema={porTema} acertoMateria={aproveitamento(questoes.filter((q) => q.subject_id === m.id))} />
      ))}
    </div>
  );
}

export function AbaQuestoes({ cursoId, materias, temas, questoes }: Base) {
  const geral = aproveitamento(questoes);
  const linhas = acertoPorMateria(materias, questoes).filter((l) => l.total);
  const foco = linhas.filter((l) => l.pct !== null && l.pct < 0.7).slice(0, 2);
  const nomeMateria = (id: string | null) => materias.find((m) => m.id === id);
  const nomeTema = (id: string | null) => temas.find((t) => t.id === id)?.title;
  return (
    <div className="estudo-cols">
      <div className="estudo-col">
        <section className="bloco">
          <h2 className="sec__h">Acerto por matéria {linhas.length > 0 && <em>{linhas.length}</em>}<span className="sec__act"><RegistrarQuestoes cursoId={cursoId} materias={materias} temas={temas} variante="btn btn--sm" /></span></h2>
          {!linhas.length ? (
            <p className="bloco__vazio">Nenhum exercício registrado.</p>
          ) : (
            <ul className="barras">
              {linhas.map((l) => (
                <li key={l.materia.id}>
                  <span className="barras__t"><i className="dot" style={{ background: l.materia.color }} />{l.materia.title}<small>{l.certas}/{l.total}</small></span>
                  <span className={`barras__b barras__b--${tomAcerto(l.pct)}`}><i style={{ width: `${(l.pct ?? 0) * 100}%` }} /></span>
                  <b className={`acerto acerto--${tomAcerto(l.pct)}`}>{pctTexto(l.pct)}</b>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="bloco">
          <h2 className="sec__h">Registros {questoes.length > 0 && <em>{questoes.length}</em>}</h2>
          {!questoes.length ? <p className="bloco__vazio">Os registros aparecem aqui.</p> : (
            <ul className="regs">
              {[...questoes].sort((a, b) => b.done_on.localeCompare(a.done_on)).slice(0, 40).map((q) => {
                const m = nomeMateria(q.subject_id);
                const pct = q.correct / q.total;
                return (
                  <li key={q.id}>
                    <time>{rotuloData(q.done_on)}</time>
                    <span className="regs__d"><b>{m ? <><i className="dot" style={{ background: m.color }} />{m.title}</> : "Várias matérias"}</b><small>{[nomeTema(q.topic_id), q.note].filter(Boolean).join(" · ") || `${q.total} exercícios`}</small></span>
                    <span className="regs__v">{q.correct}/{q.total} <b className={`acerto acerto--${tomAcerto(pct)}`}>{pctTexto(pct)}</b></span>
                    <ApagarRegistro id={q.id} tipo="questoes" />
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <aside className="estudo-col">
        <section className="bloco destaque">
          <h2 className="sec__h">No geral</h2>
          <p className="destaque__n"><b className={`acerto--${tomAcerto(geral.pct)}`}>{pctTexto(geral.pct)}</b><span>{geral.certas} de {geral.total} exercícios</span></p>
          {foco.length > 0 && <p className="destaque__p">Onde focar: <b>{foco.map((f) => f.materia.title).join(" e ")}</b>, abaixo de 70%.</p>}
          {geral.pct !== null && !foco.length && linhas.length > 0 && <p className="destaque__p">Todas as matérias com 70% ou mais.</p>}
        </section>
      </aside>
    </div>
  );
}

export function AbaProvas({ cursoId, simulados }: { cursoId: string; simulados: Simulado[] }) {
  const lista = [...simulados].sort((a, b) => a.done_on.localeCompare(b.done_on));
  const pcts = lista.map((s) => s.correct / s.total);
  const melhor = pcts.length ? Math.max(...pcts) : null;
  const media = pcts.length ? pcts.reduce((t, p) => t + p, 0) / pcts.length : null;
  const ultimo = pcts.length ? pcts[pcts.length - 1] : null;
  const anterior = pcts.length > 1 ? pcts[pcts.length - 2] : null;
  // gráfico de linha (0 a 100%)
  const W = 640, H = 180, P = 24;
  const x = (i: number) => (lista.length < 2 ? W / 2 : P + (i * (W - 2 * P)) / (lista.length - 1));
  const y = (p: number) => H - P - p * (H - 2 * P);
  return (
    <div className="estudo-col">
      <div className="nums">
        <div><small>Último</small><b className={`acerto--${tomAcerto(ultimo)}`}>{pctTexto(ultimo)}</b><span>{ultimo !== null && anterior !== null ? `${ultimo >= anterior ? "+" : "−"}${Math.abs(Math.round((ultimo - anterior) * 100))} pontos sobre o anterior` : lista.length ? lista[lista.length - 1].title : "Nenhum ainda"}</span></div>
        <div><small>Melhor</small><b>{pctTexto(melhor)}</b><span>{lista.length} {lista.length === 1 ? "registro" : "registros"}</span></div>
        <div><small>Média</small><b>{pctTexto(media)}</b><span>De todas as notas</span></div>
        <div className="nums__acao"><NovaProva cursoId={cursoId} /></div>
      </div>

      {lista.length > 0 && (
        <section className="bloco">
          <h2 className="sec__h">Evolução</h2>
          <svg className="grafico" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Evolução das notas">
            {[0.5, 0.7, 0.9].map((g) => <g key={g}><line x1={P} x2={W - P} y1={y(g)} y2={y(g)} className="grafico__g" /><text x={4} y={y(g) + 4} className="grafico__r">{g * 100}%</text></g>)}
            {lista.length > 1 && <polyline points={lista.map((_, i) => `${x(i)},${y(pcts[i])}`).join(" ")} className="grafico__l" />}
            {lista.map((s, i) => <circle key={s.id} cx={x(i)} cy={y(pcts[i])} r={5} className="grafico__p"><title>{`${s.title}: ${pctTexto(pcts[i])}`}</title></circle>)}
          </svg>
        </section>
      )}

      {lista.length > 0 && (
        <section className="bloco">
          <h2 className="sec__h">Provas e notas <em>{lista.length}</em></h2>
          <ul className="regs">
            {[...lista].reverse().map((s) => {
              const pct = s.correct / s.total;
              return (
                <li key={s.id}>
                  <time>{diaMes(s.done_on)}</time>
                  <span className="regs__d"><b>{s.title}</b><small>{[s.minutes ? horas(s.minutes) : null, s.note].filter(Boolean).join(" · ") || `nota máxima ${nota(s.total)}`}</small></span>
                  <span className="regs__v">{nota(s.correct)} de {nota(s.total)} <b className={`acerto acerto--${tomAcerto(pct)}`}>{pctTexto(pct)}</b></span>
                  <ApagarRegistro id={s.id} tipo="simulado" />
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

export function AbaDesempenho({ materias, sessoes, questoes, metaSemana }: { materias: Materia[]; sessoes: Sessao[]; questoes: Questao[]; metaSemana: number | null }) {
  const semanas = horasPorSemana(sessoes, 8);
  const maiorSemana = Math.max(metaSemana ?? 0, ...semanas.map((s) => s.min), 60);
  const porMateria = horasPorMateria(materias, sessoes).filter((l) => l.min > 0);
  const maiorMateria = Math.max(1, ...porMateria.map((l) => l.min));
  const mapa = constancia(sessoes, questoes, 18);
  const total = sessoes.filter((s) => s.done_at).reduce((t, s) => t + duracao(s), 0);
  const diasComEstudo = mapa.dias.filter((d) => d.min > 0).length;
  return (
    <div className="estudo-col">
      <div className="nums">
        <div><small>Estudado</small><b>{horas(total)}</b><span>Nas últimas 18 semanas</span></div>
        <div><small>Dias de estudo</small><b>{mapa.ultimos30}</b><span>Nos últimos 30 dias</span></div>
        <div><small>Por dia estudado</small><b>{diasComEstudo ? horas(total / diasComEstudo) : "—"}</b><span>Em média</span></div>
        <div><small>Exercícios</small><b>{aproveitamento(questoes).total}</b><span>{pctTexto(aproveitamento(questoes).pct)} de acerto</span></div>
      </div>

      <section className="bloco">
        <h2 className="sec__h">Constância<span className="sec__act">cada quadrado é um dia</span></h2>
        <div className="mapa" role="img" aria-label={`${mapa.ultimos30} dias de estudo nos últimos 30`}>
          {mapa.dias.map((d) => <i key={d.dia} data-n={d.nivel} title={d.min ? `${diaMes(d.dia)} · ${d.min > 1 ? horas(d.min) : "questões"}` : diaMes(d.dia)} />)}
        </div>
        <p className="mapa__leg"><span>Menos</span>{[0, 1, 2, 3, 4].map((n) => <i key={n} data-n={n} />)}<span>Mais</span></p>
      </section>

      <div className="estudo-cols estudo-cols--meio">
        <section className="bloco">
          <h2 className="sec__h">Horas por semana{metaSemana ? <span className="sec__act">meta {horas(metaSemana)}</span> : null}</h2>
          <div className="colunas">
            {metaSemana ? <i className="colunas__meta" style={{ bottom: `${(metaSemana / maiorSemana) * 100}%` }} /> : null}
            {semanas.map((s) => (
              <div key={s.ini} className={s.atual ? "is-atual" : undefined} title={horas(s.min)}>
                <span style={{ height: `${(s.min / maiorSemana) * 100}%` }}>{s.min > 0 && <em>{horas(s.min)}</em>}</span>
                <small>{diaMes(s.ini).replace(/ de (\w{3})\w*/, "/$1")}</small>
              </div>
            ))}
          </div>
        </section>

        <section className="bloco">
          <h2 className="sec__h">Horas por matéria</h2>
          {!porMateria.length ? <p className="bloco__vazio">Nada estudado nas últimas semanas.</p> : (
            <ul className="barras">
              {porMateria.map((l) => (
                <li key={l.materia.id}>
                  <span className="barras__t"><i className="dot" style={{ background: l.materia.color }} />{l.materia.title}</span>
                  <span className="barras__b" style={{ "--c": l.materia.color } as React.CSSProperties}><i style={{ width: `${(l.min / maiorMateria) * 100}%` }} /></span>
                  <b>{horas(l.min)}</b>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
