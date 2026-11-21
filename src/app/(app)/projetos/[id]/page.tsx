import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AdicionarEtapa, EditarProjeto, EstadoProjeto } from "@/components/FormsProjeto";
import { Lista } from "@/components/Lista";
import { ProximoPasso } from "@/components/ProximoPasso";
import { resumirProjeto, type Projeto } from "@/lib/projetos";
import { CAMPOS_LISTA, ordenar, type Responsabilidade } from "@/lib/tipos";
import { ehId, hojeISO, rotuloData, rotuloVencido } from "@/lib/datas";
import { ListaNotas, NovaNota } from "@/components/Notas";
import { CAMPOS_NOTA, type Nota } from "@/lib/notas";

export const metadata = { title: "Projeto" };

/** Por que esta etapa é a próxima: o prazo dela, ou ser a primeira em aberto */
function porque(r: Responsabilidade, hoje: string) {
  if (r.state === "aguardando") return r.waiting_note ? `Aguardando ${r.waiting_note}` : "Aguardando retorno";
  if (r.due_date && r.due_date < hoje) return rotuloVencido(r.due_date, r.due_time, hoje);
  if (r.due_date) return `Prazo ${rotuloData(r.due_date, hoje)}`;
  return "Primeira etapa em aberto";
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ehId(id)) notFound();
  const supabase = await createClient();
  const [{ data: projeto }, { data: etapas }, { data: contextos }, { data: notas }] = await Promise.all([
    supabase.from("projects").select("id, name, context_id, status, due_date, note").eq("id", id).maybeSingle(),
    supabase.from("responsibilities").select(CAMPOS_LISTA).eq("project_id", id),
    supabase.from("contexts").select("id, name, color, kind").eq("archived", false).order("position"),
    supabase.from("notes").select(CAMPOS_NOTA).eq("project_id", id).order("created_at", { ascending: false }),
  ]);
  if (!projeto) notFound();
  const hoje = hojeISO();
  const p = projeto as Projeto;
  const lista = ((etapas ?? []) as Responsabilidade[]).sort(ordenar);
  const resumo = resumirProjeto(p, lista, hoje);
  const ctx = contextos ?? [];
  const contexto = ctx.find((c) => c.id === p.context_id);
  const proximo = p.status === "ativo" ? resumo.proximo : null;
  // O próximo passo fica em destaque e não se repete na lista
  const abertas = lista.filter((r) => r.state !== "concluida" && r.id !== proximo?.id);
  const feitas = lista.filter((r) => r.state === "concluida");
  const pct = resumo.total ? Math.round((resumo.feitas / resumo.total) * 100) : 0;
  const listaNotas = (notas ?? []) as Nota[];

  return (
    <div className="page page--wide">
      <p className="crumb"><Link href="/projetos">Projetos</Link><ChevronRight aria-hidden />{p.name}</p>
      <div className="page__head">
        <div>
          <h1 className="page__t">{p.name}</h1>
          <p className="projeto__meta">
            {contexto && <Link href={`/contexto/${contexto.id}`}><i className="dot" style={{ background: contexto.color }} />{contexto.name}</Link>}
            <span className={`status status--${resumo.situacao.tom}`}>{resumo.situacao.texto}</span>
          </p>
        </div>
        <div className="page__actions"><EditarProjeto projeto={p} contextos={ctx} /></div>
      </div>

      <div className="projeto">
        <div className="projeto__main">
          {proximo ? (
            <ProximoPasso proximo={{ tipo: "responsabilidade", item: proximo, porque: porque(proximo, hoje) }} contextos={ctx} />
          ) : p.status === "ativo" && (
            <section className="next next--calmo" aria-label="Próximo passo">
              <div>
                <span className="next__t">{resumo.total ? "Todas as etapas feitas." : "Qual é o primeiro passo?"}</span>
                <p className="next__p">{resumo.total ? "Se o projeto terminou, marque como concluído ao lado. Se falta algo, escreva a próxima etapa abaixo." : "Escreva a primeira etapa abaixo. A de cima vira o próximo passo, e o projeto passa a aparecer no Hoje quando ela tiver data."}</p>
              </div>
            </section>
          )}

          <section className="sec">
            <h2 className="sec__h">Etapas <em>{resumo.total ? `${resumo.feitas} de ${resumo.total} feitas` : "nenhuma ainda"}</em></h2>
            {abertas.length > 0 && <Lista itens={abertas} contextos={ctx} comContexto={false} cobravel />}
            <AdicionarEtapa projetoId={p.id} />
            <p className="field__hint" style={{ marginTop: 6 }}>Dá para escrever o prazo junto: “Mandar o orçamento sexta”, “Ligar para o pedreiro amanhã 10h”.</p>
          </section>

          {feitas.length > 0 && (
            <details className="sec fold">
              <summary className="sec__h"><ChevronRight aria-hidden />Feitas {feitas.length > 0 && <em>{feitas.length}</em>}</summary>
              <Lista itens={feitas} contextos={ctx} comContexto={false} />
            </details>
          )}
        </div>

        <aside className="projeto__lado">
          <section className="bloco">
            <h2 className="sec__h">Andamento</h2>
            <div className="projeto__pct">
              <b>{pct}%</b>
              <span>{resumo.total ? `${resumo.feitas} de ${resumo.total} ${resumo.total === 1 ? "etapa" : "etapas"}` : "Sem etapas"}</span>
            </div>
            <div className="progress-bar projeto__barra" aria-hidden><i><b style={{ width: `${pct}%` }} /></i></div>
            <dl className="kv projeto__kv">
              <dt>Entrega</dt><dd>{resumo.entrega ?? <span className="projeto__sem">Sem data</span>}</dd>
              <dt>Contexto</dt><dd>{contexto ? <><i className="dot" style={{ background: contexto.color }} /> {contexto.name}</> : <span className="projeto__sem">Nenhum</span>}</dd>
            </dl>
            <EstadoProjeto id={p.id} status={p.status} />
          </section>

          <section className="bloco">
            <h2 className="sec__h">Sobre</h2>
            {p.note ? <p className="projeto__nota">{p.note}</p> : <p className="bloco__vazio">Objetivo, de quem depende, links. Escreva em Editar.</p>}
          </section>

          <section className="bloco">
            <h2 className="sec__h">Notas {listaNotas.length > 0 && <em>{listaNotas.length}</em>}<span className="sec__act"><NovaNota vinculo={`p:${p.id}`} rotulo="Nova" variante="btn btn--ghost btn--sm" /></span></h2>
            {listaNotas.length > 0 ? <ListaNotas notas={listaNotas} /> : <p className="bloco__vazio">Combinados, referências e decisões deste projeto.</p>}
          </section>
        </aside>
      </div>
    </div>
  );
}
