import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, ChevronRight, Folder } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AdicionarEtapa, FormProjeto } from "@/components/FormsProjeto";
import { ListaResponsabilidades } from "@/components/ListaResponsabilidades";
import { resumirProjeto, type Projeto } from "@/lib/projetos";
import { CAMPOS_LISTA, ordenar, type Responsabilidade } from "@/lib/tipos";

export const metadata = { title: "Projeto" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const [{ data: projeto }, { data: etapas }, { data: contextos }] = await Promise.all([
    supabase.from("projects").select("id, name, context_id, status, due_date, note").eq("id", id).maybeSingle(),
    supabase.from("responsibilities").select(CAMPOS_LISTA).eq("project_id", id),
    supabase.from("contexts").select("id, name, color, kind").eq("archived", false).order("position"),
  ]);
  if (!projeto) notFound();
  const p = projeto as Projeto;
  const lista = ((etapas ?? []) as Responsabilidade[]).sort(ordenar);
  const resumo = resumirProjeto(p, lista);
  const ctx = contextos ?? [];
  const contexto = ctx.find((c) => c.id === p.context_id);
  const aFazer = lista.filter((r) => r.state === "a_fazer");
  const aguardando = lista.filter((r) => r.state === "aguardando");
  const feitas = lista.filter((r) => r.state === "concluida");
  const pct = resumo.total ? Math.round((resumo.feitas / resumo.total) * 100) : 0;

  return (
    <div className="page">
      <div className="page__head">
        <div style={{ flex: 1, minWidth: 0 }}>
          <p className="crumb"><Link href="/projetos">Projetos</Link><ChevronRight aria-hidden />{p.name}</p>
          <p className="project__k" style={{ margin: "10px 0 4px" }}>
            <span><Folder aria-hidden />Projeto{contexto && <> · <i className="dot" style={{ background: contexto.color }} /><Link href={`/contexto/${contexto.id}`}>{contexto.name}</Link></>}</span>
            <span className={`status status--${resumo.situacao.tom}`}>{resumo.situacao.texto}</span>
          </p>
          <h1 className="page__t">{p.name}</h1>
          <div className="progress-bar" style={{ marginTop: 12, maxWidth: 520 }}>
            <i><b style={{ width: `${pct}%` }} /></i>
            {resumo.total ? `${resumo.feitas} de ${resumo.total} ${resumo.total === 1 ? "etapa" : "etapas"}` : "Sem etapas"}
            {resumo.entrega && <> · Entrega {resumo.entrega}</>}
          </div>
        </div>
      </div>

      {resumo.proximo && (
        <p className="project__next" style={{ borderRadius: "var(--r-lg)", marginBottom: 20 }}>
          <ArrowRight aria-hidden />
          <span>Próximo passo: <Link href={`/responsabilidades/${resumo.proximo.id}`}><b>{resumo.proximo.title}</b></Link></span>
        </p>
      )}

      <AdicionarEtapa projetoId={p.id} />

      {aFazer.length > 0 && (
        <section className="sec">
          <h2 className="sec__h">A fazer <em>{aFazer.length}</em></h2>
          <ListaResponsabilidades itens={aFazer} contextos={ctx} comContexto={false} />
        </section>
      )}
      {aguardando.length > 0 && (
        <section className="sec">
          <h2 className="sec__h">Aguardando alguém <em>{aguardando.length}</em></h2>
          <ListaResponsabilidades itens={aguardando} contextos={ctx} comContexto={false} cobravel />
        </section>
      )}
      {feitas.length > 0 && (
        <details className="sec fold">
          <summary className="sec__h"><ChevronRight aria-hidden />Concluídas <em>{feitas.length}</em></summary>
          <ListaResponsabilidades itens={feitas} contextos={ctx} comContexto={false} />
        </details>
      )}
      {lista.length === 0 && (
        <div className="empty"><b>Nenhuma etapa ainda.</b>Comece pelo próximo passo: escreva acima e aperte Enter.</div>
      )}

      <section className="card" style={{ marginTop: 12 }}>
        <h2 className="card__t">Detalhes do projeto</h2>
        <FormProjeto projeto={p} contextos={ctx} />
      </section>
    </div>
  );
}
