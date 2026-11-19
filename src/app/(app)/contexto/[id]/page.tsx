import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarClock, ChevronRight, Scale } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { CardProjeto } from "@/components/CardProjeto";
import { NovoCompromisso } from "@/components/FormCompromisso";
import { NovoProjeto } from "@/components/FormsProjeto";
import { ListaResponsabilidades } from "@/components/ListaResponsabilidades";
import { BotaoNova } from "@/components/ProximoPasso";
import { slug } from "@/lib/captura";
import { agoraHora, dataPorExtenso, diferencaDias, hojeISO, prazoPassou, rotuloData, somarDias } from "@/lib/datas";
import { horaSP } from "@/lib/hoje";
import { resumirProjeto, type Projeto } from "@/lib/projetos";
import { CAMPOS_LISTA, ordenar, type Compromisso, type Responsabilidade } from "@/lib/tipos";

export const metadata = { title: "Contexto" };

type Aba = "responsabilidades" | "projetos" | "decisoes" | "compromissos";

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ aba?: string }> }) {
  const { id } = await params;
  const { aba: param } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const aba: Aba = (["projetos", "decisoes", "compromissos"] as const).find((a) => a === param) ?? "responsabilidades";

  const hoje = hojeISO();
  const agora = agoraHora();
  const supabase = await createClient();
  const [{ data: contexto }, { data: itens }, { data: projetos }, { data: eventos }, { data: contextos }] = await Promise.all([
    supabase.from("contexts").select("id, name, color, kind, archived").eq("id", id).maybeSingle(),
    supabase.from("responsibilities").select(CAMPOS_LISTA).eq("context_id", id),
    supabase.from("projects").select("id, name, context_id, status, due_date, note").eq("context_id", id),
    supabase.from("events").select("id, title, context_id, starts_at, ends_at, location").eq("context_id", id).gte("starts_at", new Date(`${hoje}T00:00:00-03:00`).toISOString()).order("starts_at").limit(30),
    supabase.from("contexts").select("id, name, color, kind").eq("archived", false).order("position"),
  ]);
  if (!contexto) notFound();

  const todas = (itens ?? []) as Responsabilidade[];
  const abertas = todas.filter((i) => i.state !== "concluida").sort(ordenar);
  const atrasadas = abertas.filter((i) => i.state === "a_fazer" && prazoPassou(i, hoje, agora));
  const semana = somarDias(hoje, 7);
  const estaSemana = abertas.filter((i) => i.state === "a_fazer" && !atrasadas.includes(i) && (i.today || (i.due_date && i.due_date <= semana)));
  const depois = abertas.filter((i) => i.state === "a_fazer" && !atrasadas.includes(i) && !estaSemana.includes(i));
  const aguardando = abertas.filter((i) => i.state === "aguardando").sort((a, b) => (a.follow_up_on ?? "").localeCompare(b.follow_up_on ?? ""));
  const decisoes = todas.filter((i) => i.kind === "decidir");
  const decAbertas = decisoes.filter((i) => i.state !== "concluida").sort(ordenar);
  const decFeitas = decisoes.filter((i) => i.state === "concluida").sort((a, b) => (b.done_at ?? "").localeCompare(a.done_at ?? ""));
  const projs = ((projetos ?? []) as Projeto[]).filter((p) => p.status !== "concluido");
  const evs = (eventos ?? []) as Compromisso[];
  const ctx = [{ id: contexto.id, name: contexto.name, color: contexto.color }];
  const nomesProjetos = Object.fromEntries(((projetos ?? []) as Projeto[]).map((p) => [p.id, p.name]));
  const proximo = evs.find((e) => new Date(e.starts_at) > new Date());
  const tag = slug(contexto.name.split(/\s+/)[0]);
  const url = (a: Aba) => `/contexto/${id}${a === "responsabilidades" ? "" : `?aba=${a}`}`;

  const quando = (iso: string) => {
    const d = hojeISO(new Date(iso));
    const dif = diferencaDias(hoje, d);
    return `${dif === 0 ? "hoje" : dif === 1 ? "amanhã" : rotuloData(d, hoje)}, ${horaSP(iso)}`;
  };

  return (
    <div className="page">
      <div className="page__head">
        <p className="crumb" style={{ width: "100%" }}>{contexto.kind === "empresa" ? "Negócios" : "Áreas"}<ChevronRight aria-hidden />{contexto.name}</p>
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <span className="ctx-mark" style={{ background: contexto.color }} aria-hidden>{contexto.name.charAt(0).toUpperCase()}</span>
          <div>
            <p className="field__hint" style={{ margin: 0 }}>Visão pessoal · só o que depende de você</p>
            <h1 className="page__t">{contexto.name}</h1>
          </div>
        </div>
        <div className="page__actions">
          <BotaoNova texto={`Decidir  #${tag}`} rotulo="Nova decisão" variante="btn btn--ghost" icone={<Scale aria-hidden />} />
          <span className="hide-mobile"><BotaoNova texto={` #${tag}`} /></span>
        </div>
      </div>
      {contexto.archived && <p className="note" style={{ marginBottom: 16 }}>Contexto arquivado. <Link href="/contextos" className="link">Reativar</Link></p>}

      <div className="facts">
        <span className="fact"><b>{abertas.length}</b> {abertas.length === 1 ? "aberta" : "abertas"}</span>
        <span className={`fact${atrasadas.length ? " fact--late" : ""}`}><b>{atrasadas.length}</b> {atrasadas.length === 1 ? "atrasada" : "atrasadas"}</span>
        <span className="fact"><b>{aguardando.length}</b> aguardando</span>
        <span className="fact"><CalendarClock aria-hidden />{proximo ? <>Próximo compromisso <b>{quando(proximo.starts_at)}</b></> : "Nenhum compromisso marcado"}</span>
      </div>

      <nav className="tabs" aria-label="Visão">
        <Link href={url("responsabilidades")} aria-current={aba === "responsabilidades" ? "page" : undefined}>Responsabilidades<em>{abertas.length}</em></Link>
        <Link href={url("projetos")} aria-current={aba === "projetos" ? "page" : undefined}>Projetos<em>{projs.length}</em></Link>
        <Link href={url("decisoes")} aria-current={aba === "decisoes" ? "page" : undefined}>Decisões<em>{decisoes.length}</em></Link>
        <Link href={url("compromissos")} aria-current={aba === "compromissos" ? "page" : undefined}>Compromissos<em>{evs.length}</em></Link>
      </nav>

      {aba === "responsabilidades" && (
        abertas.length === 0 ? (
          <div className="empty">
            <b>Nada pendente nesta etapa.</b>
            <span>{contexto.kind === "empresa" ? "Comece pelo que depende de você: uma decisão, um retorno, uma reunião." : "O que depende de você aqui aparece nesta lista."} Na captura, escreva <code>#{tag}</code> para guardar direto aqui.</span>
          </div>
        ) : (
          <>
            {atrasadas.length > 0 && <section className="sec"><h2 className="sec__h">Atrasada <em>{atrasadas.length}</em></h2><ListaResponsabilidades itens={atrasadas} contextos={ctx} comContexto={false} projetos={nomesProjetos} /></section>}
            {estaSemana.length > 0 && <section className="sec"><h2 className="sec__h">Esta semana <em>{estaSemana.length}</em></h2><ListaResponsabilidades itens={estaSemana} contextos={ctx} comContexto={false} projetos={nomesProjetos} /></section>}
            {depois.length > 0 && <section className="sec"><h2 className="sec__h">Sem pressa <em>{depois.length}</em></h2><ListaResponsabilidades itens={depois} contextos={ctx} comContexto={false} projetos={nomesProjetos} /></section>}
            {aguardando.length > 0 && <section className="sec"><h2 className="sec__h">Aguardando outras pessoas <em>{aguardando.length}</em></h2><ListaResponsabilidades itens={aguardando} contextos={ctx} comContexto={false} projetos={nomesProjetos} cobravel /></section>}
          </>
        )
      )}

      {aba === "projetos" && (
        <>
          <div style={{ marginBottom: 16 }}><NovoProjeto contextos={contextos ?? []} contextoPadrao={id} /></div>
          {projs.length === 0 ? (
            <div className="empty"><b>Nenhum projeto ativo aqui.</b>Um projeto tem começo e fim. Comece pelo próximo passo dele.</div>
          ) : (
            <div className="projects">{projs.map((p) => <CardProjeto key={p.id} projeto={p} resumo={resumirProjeto(p, todas)} contexto={contexto} />)}</div>
          )}
        </>
      )}

      {aba === "decisoes" && (
        decisoes.length === 0 ? (
          <div className="empty"><b>Nenhuma decisão ainda.</b>Decisões ficam registradas aqui: o que foi decidido, por quê e quando. Use Nova decisão.</div>
        ) : (
          <>
            {decAbertas.length > 0 && <section className="sec"><h2 className="sec__h">Para decidir <em>{decAbertas.length}</em></h2><ListaResponsabilidades itens={decAbertas} contextos={ctx} comContexto={false} projetos={nomesProjetos} /></section>}
            {decFeitas.length > 0 && (
              <section className="sec">
                <h2 className="sec__h">Decididas <em>{decFeitas.length}</em></h2>
                <ul className="list">
                  {decFeitas.map((d) => (
                    <li key={d.id} className="row" style={{ gridTemplateColumns: "minmax(0,1fr)" }}>
                      <div className="row__body">
                        <Link href={`/responsabilidades/${d.id}`} className="row__t">{d.title}</Link>
                        <span className="props"><span className="prop"><Scale aria-hidden />Decisão · {d.done_at ? dataPorExtenso(hojeISO(new Date(d.done_at))).split(", ")[1] : ""}</span></span>
                        {d.note ? <p className="detail__origin" style={{ whiteSpace: "pre-line" }}>{d.note}</p> : <p className="detail__origin">Sem registro do que foi decidido. <Link href={`/responsabilidades/${d.id}`} className="link">Escrever</Link></p>}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )
      )}

      {aba === "compromissos" && (
        <>
          <div style={{ marginBottom: 16 }}><NovoCompromisso contextos={contextos ?? []} data={hoje} /></div>
          {evs.length === 0 ? (
            <div className="empty"><b>Nenhum compromisso marcado.</b>Reuniões e encontros deste contexto aparecem aqui e na agenda do Hoje.</div>
          ) : (
            <div className="agenda">
              {evs.map((e) => (
                <Link key={e.id} href={`/calendario/${e.id}`} className="ag" style={{ gridTemplateColumns: "120px minmax(0,1fr)" }}>
                  <time>{quando(e.starts_at)}</time>
                  <div><b>{e.title}</b>{e.location && <small>{e.location}</small>}</div>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
