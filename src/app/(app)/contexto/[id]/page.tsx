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
import { agoraHora, diaMes, ehId, hojeISO, horaDe, inicioDoDia, prazoPassou, rotuloData, somarDias } from "@/lib/datas";
import { resumirProjeto, type Projeto } from "@/lib/projetos";
import { CAMPOS_LISTA, ordenar, type Compromisso, type Responsabilidade } from "@/lib/tipos";
import { ListaNotas, NovaNota } from "@/components/Notas";
import { CAMPOS_NOTA, type Nota } from "@/lib/notas";
import { PainelContexto } from "@/components/PainelContexto";
import { montarHoje, type ProximoPasso as PassoHoje } from "@/lib/hoje";
import { CAMPOS_ROTINA, desdeMarcas, type Marcacao, type Rotina } from "@/lib/rotinas";
import { CAMPOS_MARCO, CAMPOS_ROTA, normalizar, resumirRota, type Marco } from "@/lib/rotas";

export const metadata = { title: "Contexto" };

type Aba = "visao" | "responsabilidades" | "projetos" | "decisoes" | "notas" | "compromissos";

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ aba?: string }> }) {
  const { id } = await params;
  const { aba: param } = await searchParams;
  if (!ehId(id)) notFound();
  const aba: Aba = (["responsabilidades", "projetos", "decisoes", "notas", "compromissos"] as const).find((a) => a === param) ?? "visao";

  const hoje = hojeISO();
  const agora = agoraHora();
  const supabase = await createClient();
  const [{ data: contexto }, { data: itens }, { data: projetos }, { data: eventos }, { data: contextos }, { data: notasDb }, { data: rotinasDb }, { data: marcasDb }, { data: rotasDb }, { data: cursosDb }] = await Promise.all([
    supabase.from("contexts").select("id, name, color, kind, archived").eq("id", id).maybeSingle(),
    supabase.from("responsibilities").select(CAMPOS_LISTA).eq("context_id", id),
    supabase.from("projects").select("id, name, context_id, status, due_date, note").eq("context_id", id),
    supabase.from("events").select("id, title, context_id, starts_at, ends_at, location").eq("context_id", id).gte("starts_at", inicioDoDia(hoje)).order("starts_at").limit(30),
    supabase.from("contexts").select("id, name, color, kind").eq("archived", false).order("position"),
    supabase.from("notes").select(CAMPOS_NOTA).eq("context_id", id).order("created_at", { ascending: false }),
    supabase.from("routines").select(CAMPOS_ROTINA).eq("context_id", id).eq("status", "ativa").order("position"),
    supabase.from("routine_checks").select("routine_id, done_on").gte("done_on", desdeMarcas(hoje)),
    supabase.from("routes").select(CAMPOS_ROTA).eq("context_id", id).eq("status", "ativa").order("created_at"),
    supabase.from("study_courses").select("id, title").eq("context_id", id).neq("status", "concluido"),
  ]);
  if (!contexto) notFound();
  const notas = (notasDb ?? []) as Nota[];
  const decisoesRegistradas = notas.filter((n) => n.kind === "decisao");

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
  const url = (a: Aba) => `/contexto/${id}${a === "visao" ? "" : `?aba=${a}`}`;

  // Painel (visão geral): o próximo passo daqui, com a mesma regra do Hoje; sem urgência, o primeiro da semana
  const dia = montarHoje(abertas, [], evs.filter((e) => hojeISO(new Date(e.starts_at)) === hoje), hoje, agora);
  const primeiro = estaSemana[0] ?? depois[0];
  const proximoPasso: PassoHoje | null = dia.proximo ?? (primeiro ? { tipo: "responsabilidade", item: primeiro, porque: primeiro.due_date ? `Prazo ${rotuloData(primeiro.due_date, hoje)}` : "O próximo daqui" } : null);
  const idPasso = proximoPasso?.tipo === "responsabilidade" ? proximoPasso.item.id : null;
  const rotasCtx = (rotasDb ?? []).map(normalizar);
  const { data: marcosDb } = rotasCtx.some((r) => r.kind === "negocios") ? await supabase.from("route_milestones").select(CAMPOS_MARCO).in("route_id", rotasCtx.map((r) => r.id)) : { data: [] };

  const quando = (iso: string) => `${rotuloData(hojeISO(new Date(iso)), hoje)}, ${horaDe(iso)}`;

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
          <BotaoNova texto="Decidir " contexto={id} rotulo="Nova decisão" variante="btn btn--ghost" icone={<Scale aria-hidden />} />
          <span className="hide-mobile"><BotaoNova contexto={id} /></span>
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
        <Link href={url("visao")} aria-current={aba === "visao" ? "page" : undefined}>Visão geral</Link>
        <Link href={url("responsabilidades")} aria-current={aba === "responsabilidades" ? "page" : undefined}>Responsabilidades<em>{abertas.length}</em></Link>
        <Link href={url("projetos")} aria-current={aba === "projetos" ? "page" : undefined}>Projetos<em>{projs.length}</em></Link>
        <Link href={url("decisoes")} aria-current={aba === "decisoes" ? "page" : undefined}>Decisões<em>{decisoes.length + decisoesRegistradas.length}</em></Link>
        <Link href={url("notas")} aria-current={aba === "notas" ? "page" : undefined}>Notas<em>{notas.length}</em></Link>
        <Link href={url("compromissos")} aria-current={aba === "compromissos" ? "page" : undefined}>Compromissos<em>{evs.length}</em></Link>
      </nav>

      {aba === "visao" && (
        <PainelContexto
          contexto={{ id: contexto.id, name: contexto.name, color: contexto.color, kind: contexto.kind }}
          tag={tag}
          hoje={hoje}
          proximo={proximoPasso}
          atencao={[...atrasadas, ...aguardando.filter((i) => i.follow_up_on && i.follow_up_on <= hoje)].filter((i) => i.id !== idPasso)}
          estaSemana={estaSemana.filter((i) => i.id !== idPasso)}
          depois={depois.filter((i) => i.id !== idPasso).length}
          aguardando={aguardando.filter((i) => !(i.follow_up_on && i.follow_up_on <= hoje) && i.id !== idPasso)}
          decAbertas={decAbertas.filter((i) => i.id !== idPasso && !atrasadas.includes(i) && !estaSemana.includes(i))}
          eventos={evs}
          rotinas={(rotinasDb ?? []) as Rotina[]}
          marcas={(marcasDb ?? []) as Marcacao[]}
          projetos={projs.map((p) => { const r = resumirProjeto(p, todas); return { id: p.id, name: p.name, feitas: r.feitas, total: r.total, proximo: r.proximo?.title ?? null }; })}
          rotas={rotasCtx.map((r) => { const res = resumirRota(r, ((marcosDb ?? []) as Marco[]).filter((m) => m.route_id === r.id), hoje); return { id: r.id, title: r.title, pct: res.pct, linha: res.linha }; })}
          estudos={cursosDb ?? []}
          notas={notas}
          nomesProjetos={nomesProjetos}
        />
      )}

      {aba === "responsabilidades" && (
        abertas.length === 0 ? (
          <div className="empty">
            <b>Nada pendente nesta etapa.</b>
            <span>{contexto.kind === "empresa" ? "Comece pelo que depende de você: uma decisão, um retorno, uma reunião." : "O que depende de você aqui aparece nesta lista."} O que você anotar com Nova, aqui, já fica neste contexto.</span>
          </div>
        ) : (
          <>
            {atrasadas.length > 0 && <section className="sec"><h2 className="sec__h">Atrasada {atrasadas.length > 0 && <em>{atrasadas.length}</em>}</h2><ListaResponsabilidades itens={atrasadas} contextos={ctx} comContexto={false} projetos={nomesProjetos} /></section>}
            {estaSemana.length > 0 && <section className="sec"><h2 className="sec__h">Esta semana {estaSemana.length > 0 && <em>{estaSemana.length}</em>}</h2><ListaResponsabilidades itens={estaSemana} contextos={ctx} comContexto={false} projetos={nomesProjetos} /></section>}
            {depois.length > 0 && <section className="sec"><h2 className="sec__h">Sem pressa {depois.length > 0 && <em>{depois.length}</em>}</h2><ListaResponsabilidades itens={depois} contextos={ctx} comContexto={false} projetos={nomesProjetos} /></section>}
            {aguardando.length > 0 && <section className="sec"><h2 className="sec__h">Aguardando outras pessoas {aguardando.length > 0 && <em>{aguardando.length}</em>}</h2><ListaResponsabilidades itens={aguardando} contextos={ctx} comContexto={false} projetos={nomesProjetos} cobravel /></section>}
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

      {aba === "notas" && (
        <>
          <div style={{ marginBottom: 16 }}><NovaNota vinculo={`c:${id}`} /></div>
          {notas.length ? <ListaNotas notas={notas} /> : <div className="empty"><b>Nenhuma nota aqui.</b>O que vale lembrar sobre {contexto.name}: combinados, referências, contexto de uma decisão.</div>}
        </>
      )}

      {aba === "decisoes" && (
        decisoes.length === 0 && !decisoesRegistradas.length ? (
          <div className="empty"><b>Nenhuma decisão ainda.</b>Decisões ficam registradas aqui: o que foi decidido, por quê e quando. Use Nova decisão para o que ainda vai decidir, ou registre uma decisão já tomada.<div style={{ marginTop: 10 }}><NovaNota vinculo={`c:${id}`} decisao rotulo="Registrar decisão" /></div></div>
        ) : (
          <>
            <div style={{ marginBottom: 8 }}><NovaNota vinculo={`c:${id}`} decisao rotulo="Registrar decisão tomada" /></div>
            {decisoesRegistradas.length > 0 && <section className="sec"><h2 className="sec__h">Registradas {decisoesRegistradas.length > 0 && <em>{decisoesRegistradas.length}</em>}</h2><ListaNotas notas={decisoesRegistradas} /></section>}
            {decAbertas.length > 0 && <section className="sec"><h2 className="sec__h">Para decidir {decAbertas.length > 0 && <em>{decAbertas.length}</em>}</h2><ListaResponsabilidades itens={decAbertas} contextos={ctx} comContexto={false} projetos={nomesProjetos} /></section>}
            {decFeitas.length > 0 && (
              <section className="sec">
                <h2 className="sec__h">Decididas {decFeitas.length > 0 && <em>{decFeitas.length}</em>}</h2>
                <ul className="list">
                  {decFeitas.map((d) => (
                    <li key={d.id} className="row" style={{ gridTemplateColumns: "minmax(0,1fr)" }}>
                      <div className="row__body">
                        <Link href={`/responsabilidades/${d.id}`} className="row__t">{d.title}</Link>
                        <span className="props"><span className="prop"><Scale aria-hidden />Decisão · {d.done_at ? diaMes(hojeISO(new Date(d.done_at))) : ""}</span></span>
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
