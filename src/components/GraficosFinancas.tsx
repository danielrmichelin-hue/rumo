// Gráficos de Finanças (só para ver): a linha do tempo das parcelas, quanto sai por mês e a evolução do investimento.
// Componentes do servidor, em CSS e SVG; a dica de cada marca vem no title (passar o mouse ou tocar e segurar).
import { mesCurto, moeda, valorParcela, type LinhaPlano, type Parcelamento } from "@/lib/financas";
import { somarMeses } from "@/lib/datas";

const MAX_SERIES = 8; // a paleta tem 8 cores; o resto vira "Outros"

type Serie = { id: string; nome: string; cor: string; parcela: number; restante: number; pagas: number; total: number; ini: number; fim: number; ultima: string };

/** Os parcelamentos em curso no tempo: do mês da próxima parcela até o da última, e quanto sai em cada mês */
export function prepararParcelas(emCurso: Parcelamento[], mesDe: (dia: string) => string, atual: string) {
  const ultimoMes = (p: Parcelamento) => mesDe(somarMeses(p.first_due, p.installments - 1));
  const ordem = [...emCurso].sort((a, b) => ultimoMes(a).localeCompare(ultimoMes(b)) || a.title.localeCompare(b.title));
  const fimGeral = ordem.length ? ordem.map(ultimoMes).sort().pop()! : atual;
  const meses: string[] = [];
  for (let m = atual; m <= fimGeral && meses.length < 60; ) {
    meses.push(m);
    const [a, mm] = m.split("-").map(Number);
    m = `${mm === 12 ? a + 1 : a}-${String(mm === 12 ? 1 : mm + 1).padStart(2, "0")}`;
  }
  const idx = (m: string) => Math.max(0, meses.indexOf(m) === -1 ? (m < meses[0] ? 0 : meses.length - 1) : meses.indexOf(m));
  const series: Serie[] = ordem.map((p, i) => {
    const proxima = mesDe(somarMeses(p.first_due, p.paid_count));
    const restante = Array.from({ length: p.installments - p.paid_count }, (_, k) => valorParcela(p, p.paid_count + k)).reduce((t, v) => t + v, 0);
    return { id: p.id, nome: p.title, cor: `var(--serie-${Math.min(i, MAX_SERIES - 1) + 1})`, parcela: valorParcela(p, p.paid_count), restante, pagas: p.paid_count, total: p.installments, ini: idx(proxima < atual ? atual : proxima), fim: idx(ultimoMes(p)), ultima: ultimoMes(p) };
  });
  // Quanto sai em cada mês, por parcelamento (todas as parcelas que vencem no mês, pagas ou não)
  const porMes = meses.map((m) => ({
    m,
    partes: ordem.map((p, i) => ({
      serie: Math.min(i, MAX_SERIES - 1),
      valor: Array.from({ length: p.installments }, (_, k) => k).filter((k) => mesDe(somarMeses(p.first_due, k)) === m).reduce((t, k) => t + valorParcela(p, k), 0),
    })).filter((x) => x.valor > 0),
  })).map((x) => ({ ...x, total: Math.round(x.partes.reduce((t, p) => t + p.valor, 0) * 100) / 100 }));
  return { meses, series, porMes };
}

const rotuloMes = (m: string) => mesCurto(`${m}-01`);

/** Linha do tempo: uma barra por parcelamento, até o mês em que acaba (uma grade só: cada mês é uma coluna) */
export function LinhaDoTempoParcelas({ meses, series }: ReturnType<typeof prepararParcelas>) {
  if (!series.length) return null;
  return (
    <div className="gantt__rolo">
      <div className="gantt" style={{ "--n": meses.length } as React.CSSProperties} role="img" aria-label="Quando cada parcelamento acaba">
        <span className="gantt__canto" />
        {meses.map((m, i) => <small key={m} className="gantt__mes" style={{ gridColumn: i + 2 }}>{i % 3 === 0 || i === meses.length - 1 ? rotuloMes(m) : ""}</small>)}
        {series.map((s, k) => (
          <div key={s.id} className="gantt__linha" style={{ gridRow: k + 2 }}>
            <div className="gantt__nome"><i style={{ background: s.cor }} aria-hidden /><b>{s.nome}</b><small>{moeda(s.parcela)} · {s.total - s.pagas === 1 ? "falta 1" : `faltam ${s.total - s.pagas}`} de {s.total}</small></div>
            <span className="gantt__trilha" aria-hidden />
            <span className="gantt__barra" style={{ gridColumn: `${s.ini + 2} / ${s.fim + 3}`, background: s.cor }} title={`${s.nome}: faltam ${s.total - s.pagas} parcelas (${moeda(s.restante)}), a última em ${rotuloMes(s.ultima)}`} />
            {s.fim + 1 < meses.length && <em className="gantt__fim" style={{ gridColumn: `${s.fim + 3} / span 3` }}>{rotuloMes(s.ultima)}</em>}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Quanto sai em parcelas a cada mês, empilhado por parcelamento, com o limite da renda */
export function SaiPorMes({ porMes, series, limite }: ReturnType<typeof prepararParcelas> & { limite: number }) {
  if (!porMes.length) return null;
  const maior = Math.max(limite, ...porMes.map((m) => m.total), 1);
  return (
    <div className="saipormes">
      <div className="saipormes__colunas" role="img" aria-label="Quanto sai em parcelas por mês" style={{ "--n": porMes.length } as React.CSSProperties}>
        {limite > 0 && <i className="saipormes__limite" style={{ bottom: `${(limite / maior) * 100}%` }} title={`Limite de parcelas: ${moeda(limite)}`}><span>limite {moeda(limite)}</span></i>}
        {porMes.map((m, i) => (
          <div key={m.m} className="saipormes__col" title={`${rotuloMes(m.m)}: ${moeda(m.total)}${m.partes.length ? "\n" + m.partes.map((p) => `${series[p.serie]?.nome ?? "Outros"}: ${moeda(p.valor)}`).join("\n") : ""}`}>
            <em>{i === 0 || m.total !== porMes[i - 1].total ? moeda(m.total).replace("R$", "").trim() : ""}</em>
            <span className="saipormes__pilha" style={{ height: `${(m.total / maior) * 100}%` }}>
              {m.partes.map((p, k) => <i key={k} style={{ flexGrow: p.valor, background: `var(--serie-${p.serie + 1})` }} />)}
            </span>
            <small>{rotuloMes(m.m)}</small>
          </div>
        ))}
      </div>
    </div>
  );
}

/** A evolução do investimento: o saldo real até hoje, a previsão depois e onde estaria só pelo plano */
export function EvolucaoInvestimento({ linhas }: { linhas: LinhaPlano[] }) {
  if (linhas.length < 2) return null;
  const W = 720, H = 220, PX = 56, PY = 18;
  // Eixo com números redondos: 4 marcas (1; 1,5; 2; 2,5; 3; 4; 5; 6; 8 × 10ⁿ)
  const bruto = Math.max(...linhas.map((l) => Math.max(l.saldo, l.noPlano)), 1);
  const mag = Math.pow(10, Math.floor(Math.log10(bruto / 4)));
  const passoY = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].map((k) => k * mag).find((v) => v * 4 >= bruto) ?? 10 * mag;
  const max = passoY * 4;
  const curto = (v: number) => (v >= 1000 ? `${String(Math.round((v / 1000) * 10) / 10).replace(".", ",")} mil` : String(Math.round(v)));
  const x = (i: number) => PX + (i * (W - PX - 12)) / (linhas.length - 1);
  const y = (v: number) => H - PY - (Math.max(0, v) / max) * (H - 2 * PY);
  const pontos = (f: (l: LinhaPlano) => number, filtro: (l: LinhaPlano, i: number) => boolean) => linhas.map((l, i) => (filtro(l, i) ? `${x(i).toFixed(1)},${y(f(l)).toFixed(1)}` : null)).filter(Boolean).join(" ");
  const iAtual = Math.max(0, linhas.findIndex((l) => l.atual));
  const grade = [1, 2, 3, 4].map((g) => g * passoY);
  const passo = Math.max(1, Math.ceil(linhas.length / 8));
  return (
    <figure className="evolucao">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Saldo do investimento mês a mês">
        {grade.map((g) => <g key={g}><line x1={PX} x2={W - 12} y1={y(g)} y2={y(g)} className="evolucao__grade" /><text x={PX - 8} y={y(g) + 4} className="evolucao__eixo" textAnchor="end">{curto(g)}</text></g>)}
        <line x1={PX} x2={W - 12} y1={y(0)} y2={y(0)} className="evolucao__base" />
        {linhas.map((l, i) => (i % passo === 0 || i === linhas.length - 1) && <text key={l.m} x={x(i)} y={H - 2} className="evolucao__eixo" textAnchor={i === 0 ? "start" : i === linhas.length - 1 ? "end" : "middle"}>{rotuloMes(l.m)}</text>)}
        <polyline points={pontos((l) => l.noPlano, () => true)} className="evolucao__plano" />
        <polyline points={pontos((l) => l.saldo, (l, i) => i >= iAtual)} className="evolucao__previsto" />
        <polyline points={pontos((l) => l.saldo, (l, i) => i <= iAtual)} className="evolucao__real" />
        <line x1={x(iAtual)} x2={x(iAtual)} y1={PY} y2={H - PY} className="evolucao__hoje" />
        {linhas.map((l, i) => (
          <rect key={l.m} x={x(i) - (W - PX) / linhas.length / 2} y={PY} width={(W - PX) / linhas.length} height={H - 2 * PY} className="evolucao__alvo">
            <title>{`${rotuloMes(l.m)}: ${moeda(l.saldo)}${l.previsto ? " (previsto)" : ""} · só pelo plano ${moeda(l.noPlano)}${l.feito !== null ? ` · pôs ${moeda(l.feito)} de ${moeda(l.planejado)}` : ` · plano: pôr ${moeda(l.planejado)}`}`}</title>
          </rect>
        ))}
        <circle cx={x(iAtual)} cy={y(linhas[iAtual].saldo)} r={5} className="evolucao__ponto" />
      </svg>
      <figcaption className="evolucao__leg">
        <span><i className="evolucao__leg-real" />Saldo real</span>
        <span><i className="evolucao__leg-previsto" />Previsto</span>
        <span><i className="evolucao__leg-plano" />Só pelo plano</span>
      </figcaption>
    </figure>
  );
}
