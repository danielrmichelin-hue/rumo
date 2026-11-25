// O roadmap de uma área de estudos: uma barra por disciplina, da semana em que começa à semana em que termina,
// com a parte já feita mais forte. Componente do servidor (CSS grid, uma coluna por semana).
import Link from "next/link";
import { diferencaDias, diaDaSemana, somarDias } from "@/lib/datas";
import type { Disciplina, ProjetoEstudo } from "@/lib/trilhas";

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const dm = (iso: string) => `${iso.slice(8)}/${iso.slice(5, 7)}`;
const segunda = (iso: string) => somarDias(iso, -((diaDaSemana(iso) + 6) % 7));

export type LinhaRoadmap = { d: Disciplina; p: ProjetoEstudo; total: number; feitas: number; inicio: string | null; fim: string | null };

export function RoadmapEstudos({ linhas, hoje }: { linhas: LinhaRoadmap[]; hoje: string }) {
  const comData = linhas.filter((l) => l.total > 0 && l.inicio && l.fim);
  if (!comData.length) return <p className="bloco__vazio">O roadmap aparece quando houver disciplinas com aulas.</p>;
  const ini = segunda([hoje, ...comData.map((l) => l.inicio!)].sort()[0]);
  const fimGeral = comData.map((l) => l.fim!).sort().pop()!;
  const n = Math.min(156, Math.floor(diferencaDias(ini, fimGeral) / 7) + 1);
  const semana = (iso: string) => Math.max(0, Math.min(n - 1, Math.floor(diferencaDias(ini, iso) / 7)));
  const semanas = Array.from({ length: n }, (_, i) => somarDias(ini, i * 7));
  const hojeCol = semana(hoje);
  return (
    <div className="gantt__rolo">
      <div className="gantt gantt--estudos" style={{ "--n": n } as React.CSSProperties} role="img" aria-label="Roadmap das disciplinas">
        <span className="gantt__canto" />
        {semanas.map((s, i) => {
          const novoMes = i === 0 || s.slice(5, 7) !== semanas[i - 1].slice(5, 7);
          return <small key={s} className="gantt__mes" style={{ gridColumn: i + 2 }}>{novoMes ? `${MESES[Number(s.slice(5, 7)) - 1]}${s.slice(0, 4) !== hoje.slice(0, 4) || i === 0 ? `/${s.slice(2, 4)}` : ""}` : ""}</small>;
        })}
        {comData.map((l, k) => {
          const a = semana(l.inicio!), b = semana(l.fim!);
          const pct = Math.round((l.feitas / l.total) * 100);
          const acabou = l.feitas >= l.total;
          return (
            <div key={l.d.id} className="gantt__linha" style={{ gridRow: k + 2 }}>
              <div className="gantt__nome"><i style={{ background: l.p.color }} aria-hidden /><Link href={`/estudos/d/${l.d.id}`}><b>{l.d.name}</b></Link><small>{l.p.name} · {l.feitas}/{l.total}</small></div>
              <span className="gantt__trilha" aria-hidden />
              {k === 0 && <span className="gantt__hoje" style={{ gridColumn: hojeCol + 2, gridRow: `2 / span ${comData.length}` }} aria-hidden />}
              <span className="gantt__barra gantt__barra--progresso" style={{ gridColumn: `${a + 2} / ${b + 3}`, "--c": l.p.color, "--p": `${pct}%` } as React.CSSProperties}
                title={`${l.d.name}: ${l.feitas} de ${l.total} aulas (${pct}%) · ${acabou ? `terminou em ${dm(l.fim!)}` : `${l.inicio! > hoje ? `começa em ${dm(l.inicio!)} · ` : ""}termina em ${dm(l.fim!)}`}`} />
              {b + 1 < n && <em className="gantt__fim" style={{ gridColumn: `${b + 3} / span 4` }}>{acabou ? "✓" : dm(l.fim!)}</em>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
