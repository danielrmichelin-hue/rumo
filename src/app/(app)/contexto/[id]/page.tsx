import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarClock, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ListaResponsabilidades } from "@/components/ListaResponsabilidades";
import { BotaoNova } from "@/components/ProximoPasso";
import { slug } from "@/lib/captura";
import { agoraHora, hojeISO, prazoPassou, rotuloData } from "@/lib/datas";
import { horaSP } from "@/lib/hoje";
import { CAMPOS_LISTA, ordenar, type Responsabilidade } from "@/lib/tipos";

export const metadata = { title: "Contexto" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const hoje = hojeISO();
  const agora = agoraHora();
  const supabase = await createClient();
  const [{ data: contexto }, { data: itens }, { data: projetos }, { data: eventos }] = await Promise.all([
    supabase.from("contexts").select("id, name, color, kind, archived").eq("id", id).maybeSingle(),
    supabase.from("responsibilities").select(CAMPOS_LISTA).eq("context_id", id).neq("state", "concluida"),
    supabase.from("projects").select("id, name"),
    supabase.from("events").select("title, starts_at").eq("context_id", id).gte("starts_at", new Date().toISOString()).order("starts_at").limit(1),
  ]);
  if (!contexto) notFound();

  const lista = ((itens ?? []) as Responsabilidade[]).sort(ordenar);
  const atrasadas = lista.filter((i) => i.state === "a_fazer" && prazoPassou(i, hoje, agora));
  const aFazer = lista.filter((i) => i.state === "a_fazer" && !atrasadas.includes(i));
  const aguardando = lista.filter((i) => i.state === "aguardando").sort((a, b) => (a.follow_up_on ?? "").localeCompare(b.follow_up_on ?? ""));
  const ctx = [{ id: contexto.id, name: contexto.name, color: contexto.color }];
  const nomesProjetos = Object.fromEntries((projetos ?? []).map((p) => [p.id, p.name]));
  const proximo = eventos?.[0];
  const grupo = contexto.kind === "empresa" ? "Negócios" : "Áreas";

  return (
    <div className="page">
      <div className="page__head">
        <div>
          <p className="crumb">{grupo}<ChevronRight aria-hidden />{contexto.name}</p>
          <p className="overline" style={{ margin: "10px 0 4px" }}>Visão pessoal · só o que depende de você</p>
          <h1 className="page__t"><i className="dot" style={{ background: contexto.color }} />{contexto.name}</h1>
          {contexto.archived && <p className="page__sub">Arquivado. <Link href="/contextos" className="link">Reativar</Link></p>}
        </div>
        <div className="page__actions">
          <Link href="/contextos" className="btn btn--ghost">Editar</Link>
          <span className="hide-mobile"><BotaoNova /></span>
        </div>
      </div>

      <div className="facts">
        <span className="fact"><b>{lista.length}</b> {lista.length === 1 ? "aberta" : "abertas"}</span>
        <span className={`fact${atrasadas.length ? " fact--late" : ""}`}><b>{atrasadas.length}</b> {atrasadas.length === 1 ? "atrasada" : "atrasadas"}</span>
        <span className="fact"><b>{aguardando.length}</b> aguardando</span>
        <span className="fact">
          <CalendarClock aria-hidden />
          {proximo ? <>Próximo compromisso <b>{rotuloData(hojeISO(new Date(proximo.starts_at)), hoje)}, {horaSP(proximo.starts_at)}</b></> : "Nenhum compromisso marcado"}
        </span>
      </div>

      {lista.length === 0 ? (
        <div className="empty">
          <b>Nada pendente nesta etapa.</b>
          <span>
            {contexto.kind === "empresa" ? "Comece pelo que depende de você: uma decisão, um retorno, uma reunião." : "O que depende de você aqui aparece nesta lista."}{" "}
            Na captura, escreva <code>#{slug(contexto.name.split(/\s+/)[0])}</code> para guardar direto neste contexto.
          </span>
        </div>
      ) : (
        <>
          {atrasadas.length > 0 && (
            <section className="sec">
              <h2 className="sec__h">Atrasadas <em>{atrasadas.length}</em></h2>
              <ListaResponsabilidades itens={atrasadas} contextos={ctx} comContexto={false} projetos={nomesProjetos} />
            </section>
          )}
          {aFazer.length > 0 && (
            <section className="sec">
              <h2 className="sec__h">A fazer <em>{aFazer.length}</em></h2>
              <ListaResponsabilidades itens={aFazer} contextos={ctx} comContexto={false} projetos={nomesProjetos} />
            </section>
          )}
          {aguardando.length > 0 && (
            <section className="sec">
              <h2 className="sec__h">Aguardando outras pessoas <em>{aguardando.length}</em></h2>
              <ListaResponsabilidades itens={aguardando} contextos={ctx} comContexto={false} projetos={nomesProjetos} cobravel />
            </section>
          )}
        </>
      )}
    </div>
  );
}
