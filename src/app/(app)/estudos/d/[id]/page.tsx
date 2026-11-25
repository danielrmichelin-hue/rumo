// Uma disciplina: o andamento, quando começa e termina, e as aulas (marcar, título, anotação)
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { ehId, hojeISO } from "@/lib/datas";
import { nomeDaAula } from "@/lib/trilhas";
import { AulaDoDia, EditarDisciplina, LinhaAula } from "@/components/Trilhas";
import { carregarEstudos } from "../../dados";

export const metadata = { title: "Disciplina" };

const dm = (iso: string) => `${iso.slice(8)}/${iso.slice(5, 7)}/${iso.slice(2, 4)}`;

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ehId(id)) notFound();
  const hoje = hojeISO();
  const { projetos, aulasDe, porArea } = await carregarEstudos(hoje);
  const doArea = porArea.find((x) => x.roadmap.some((r) => r.d.id === id));
  const r = doArea?.roadmap.find((x) => x.d.id === id);
  if (!doArea || !r) notFound();
  const aulas = [...aulasDe(id)].sort((a, b) => a.number - b.number);
  const minutos = aulas.reduce((t, a) => t + (a.done_on ? a.minutes ?? 0 : 0), 0);
  const deHoje = doArea.hoje.find((x) => x.d.id === id);
  const pct = r.total ? Math.round((r.feitas / r.total) * 100) : 0;
  return (
    <div className="page">
      <Link href="/estudos" className="back"><ChevronLeft size={16} aria-hidden />Estudos</Link>
      <div className="page__head">
        <div>
          <h1 className="page__t">{r.d.name}</h1>
          <p className="page__sub"><i className="dot" style={{ background: r.p.color }} />{r.p.name} · {doArea.area.name}</p>
        </div>
        <div className="page__actions"><EditarDisciplina disciplina={r.d} total={r.total} projetos={projetos.filter((p) => p.area_id === doArea.area.id || p.id === r.p.id)} voltar="/estudos" /></div>
      </div>

      <div className="nums">
        <div><small>Concluídas</small><b className="pos">{r.feitas}/{r.total}</b><span>{pct}%</span></div>
        <div><small>Faltam</small><b>{r.restantes}</b><span>{r.restantes === 1 ? "aula" : "aulas"}</span></div>
        <div><small>{r.inicio && r.inicio <= hoje ? "Começou" : "Começa"}</small><b className="nums__texto">{r.inicio ? dm(r.inicio) : "—"}</b><span>{r.feitas >= r.total && r.total ? "Concluída" : r.fim ? `Termina em ${dm(r.fim)}` : "Fora do roadmap"}</span></div>
        <div><small>Tempo</small><b>{minutos >= 60 ? `${Math.floor(minutos / 60)}h${minutos % 60 ? String(minutos % 60).padStart(2, "0") : ""}` : `${minutos} min`}</b><span>Nas aulas com o relógio</span></div>
      </div>

      {deHoje && (
        <section className="bloco" style={{ marginBottom: 16 }}>
          <h2 className="sec__h">Hoje</h2>
          <ul className="aulas-dia"><AulaDoDia aula={deHoje.aula} titulo={nomeDaAula(r.d, deHoje.aula)} projeto={r.p.name} cor={r.p.color} feita={deHoje.feita} /></ul>
        </section>
      )}

      <section className="bloco">
        <h2 className="sec__h">Aulas<em>{r.total}</em></h2>
        <ul className="aulas">
          {aulas.map((a) => <LinhaAula key={a.id} aula={a} proxima={a.id === r.proxima?.id} />)}
        </ul>
      </section>
    </div>
  );
}
