import Link from "next/link";
import { ArrowRight, Folder } from "lucide-react";
import type { Projeto, ResumoProjeto } from "@/lib/projetos";

export function CardProjeto({ projeto, resumo, contexto }: { projeto: Projeto; resumo: ResumoProjeto; contexto?: { name: string; color: string } }) {
  const pct = resumo.total ? Math.round((resumo.feitas / resumo.total) * 100) : 0;
  return (
    <article className="project">
      <div className="project__body">
        <div className="project__k">
          <span><Folder aria-hidden />Projeto{contexto && <> · <i className="dot" style={{ background: contexto.color }} />{contexto.name}</>}</span>
          <span className={`status status--${resumo.situacao.tom}`}>{resumo.situacao.texto}</span>
        </div>
        <Link href={`/projetos/${projeto.id}`} className="project__t">{projeto.name}</Link>
        <div className="progress-bar" aria-label={`${resumo.feitas} de ${resumo.total} etapas`}>
          <i><b style={{ width: `${pct}%` }} /></i>
          {resumo.total ? `${resumo.feitas} de ${resumo.total} ${resumo.total === 1 ? "etapa" : "etapas"}` : "Sem etapas"}
        </div>
        {resumo.entrega && (
          <dl className="kv"><dt>Entrega</dt><dd>{resumo.entrega}</dd></dl>
        )}
      </div>
      <div className="project__next">
        <ArrowRight aria-hidden />
        {resumo.proximo ? <span>Próximo passo: <b>{resumo.proximo.title}</b></span> : <span>Defina o próximo passo deste projeto.</span>}
      </div>
    </article>
  );
}
