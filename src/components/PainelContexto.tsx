// Painel do contexto (fase 6 revista): uma tela só, igual para todos, que se monta pelo que existe ali.
// Partes vazias não aparecem. Empresa: retornos e decisões primeiro. Área (saúde, casa, finanças): rotinas e lembretes.
import Link from "next/link";
import { ArrowRight, Folder, GraduationCap, Repeat, Scale } from "lucide-react";
import { Anel } from "./Caminho";
import { Lista } from "./Lista";
import { BotaoNova, ProximoPasso } from "./ProximoPasso";
import { ChecarRotina } from "./Rotinas";
import type { ContextItem } from "./Shell";
import { hojeISO, horaDe, rotuloData } from "@/lib/datas";
import type { ProximoPasso as Passo } from "@/lib/hoje";
import { dataDaNota, type Nota } from "@/lib/notas";
import { eDoDia, feitaEm, hora, mesDaRotina, semanaDaRotina, type Marcacao, type Rotina } from "@/lib/rotinas";
import type { Compromisso, Responsabilidade } from "@/lib/tipos";

export type DadosPainel = {
  contexto: ContextItem & { kind?: "empresa" | "area" };
  tag: string;
  hoje: string;
  proximo: Passo | null;
  atencao: Responsabilidade[];
  estaSemana: Responsabilidade[];
  depois: number;
  aguardando: Responsabilidade[];
  decAbertas: Responsabilidade[];
  eventos: Compromisso[];
  rotinas: Rotina[];
  marcas: Marcacao[];
  projetos: { id: string; name: string; feitas: number; total: number; proximo: string | null }[];
  rotas: { id: string; title: string; pct: number; linha: string }[];
  estudos: { id: string; title: string }[];
  notas: Nota[];
  nomesProjetos: Record<string, string>;
};

const LIMITE = 5;

export function PainelContexto(d: DadosPainel) {
  const ctx = [d.contexto];
  const empresa = d.contexto.kind === "empresa";
  const url = (aba: string) => `/contexto/${d.contexto.id}?aba=${aba}`;
  const vazio = !d.proximo && !d.atencao.length && !d.estaSemana.length && !d.depois && !d.aguardando.length && !d.eventos.length
    && !d.rotinas.length && !d.projetos.length && !d.rotas.length && !d.estudos.length && !d.notas.length;

  if (vazio) {
    return (
      <div className="empty empty--box" style={{ maxWidth: 620 }}>
        <b>O que depende de você em {d.contexto.name}?</b>
        <span>
          {empresa
            ? "Aprovar, decidir, cobrar um retorno, uma reunião. O que é da empresa fica no sistema dela; aqui entra só a sua parte."
            : "Consultas, contas do mês, o que se repete e o que você precisa lembrar."}{" "}
          O que você anotar daqui já fica em {d.contexto.name}.
        </span>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
          <BotaoNova contexto={d.contexto.id} rotulo="Anotar algo" variante="btn btn--sm" />
          <Link href="/rotinas" className="btn btn--line btn--sm"><Repeat aria-hidden />Criar uma rotina</Link>
        </div>
      </div>
    );
  }

  const lista = (itens: Responsabilidade[], cobravel = false) => (
    <Lista itens={itens} contextos={ctx} comContexto={false} projetos={d.nomesProjetos} cobravel={cobravel} />
  );

  const atencao = d.atencao.length > 0 && (
    <section className="sec" key="atencao">
      <h2 className="sec__h">Atenção {d.atencao.length > 0 && <em>{d.atencao.length}</em>}</h2>
      {lista(d.atencao, true)}
    </section>
  );
  const semana = d.estaSemana.length > 0 && (
    <section className="sec" key="semana">
      <h2 className="sec__h">Esta semana {d.estaSemana.length > 0 && <em>{d.estaSemana.length}</em>}{d.estaSemana.length > LIMITE || d.depois ? <Link href={url("responsabilidades")} className="sec__act">Ver todas</Link> : null}</h2>
      {lista(d.estaSemana.slice(0, LIMITE))}
    </section>
  );
  const aguardando = d.aguardando.length > 0 && (
    <section className="sec" key="aguardando">
      <h2 className="sec__h">Aguardando outras pessoas {d.aguardando.length > 0 && <em>{d.aguardando.length}</em>}</h2>
      {lista(d.aguardando.slice(0, LIMITE), true)}
    </section>
  );
  const decisoes = d.decAbertas.length > 0 && (
    <section className="sec" key="decisoes">
      <h2 className="sec__h">Para decidir {d.decAbertas.length > 0 && <em>{d.decAbertas.length}</em>}<Link href={url("decisoes")} className="sec__act">Decisões</Link></h2>
      {lista(d.decAbertas.slice(0, 3))}
    </section>
  );
  const rotinas = d.rotinas.length > 0 && (
    <section className="sec" key="rotinas">
      <h2 className="sec__h">{empresa ? "O que você faz sempre aqui" : "Rotinas e lembretes"} {d.rotinas.length > 0 && <em>{d.rotinas.length}</em>}<Link href="/rotinas" className="sec__act">Rotinas</Link></h2>
      <ul className="list">
        {d.rotinas.map((r) => {
          const doDia = eDoDia(r, d.marcas, d.hoje);
          const situacao = r.month_day ? mesDaRotina(r, d.marcas, d.hoje).texto : semanaDaRotina(r, d.marcas, d.hoje).texto;
          return (
            <li key={r.id} className="row" data-feita={(doDia && feitaEm(r, d.marcas, d.hoje)) || undefined}>
              {doDia ? <ChecarRotina rotina={r} feita={feitaEm(r, d.marcas, d.hoje)} /> : <Repeat className="row__ic" aria-hidden style={{ color: "var(--text-3)" }} />}
              <div className="row__body">
                <Link href={`/rotinas#${r.id}`} className="row__t">{r.title}</Link>
                <span className="props">
                  <span className="prop">{situacao}</span>
                  {r.at_time && <span className="prop">{hora(r.at_time)}</span>}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );

  const agenda = d.eventos.length > 0 && (
    <section className="sec" key="agenda" style={{ margin: 0 }}>
      <h2 className="sec__h">Agenda<Link href={url("compromissos")} className="sec__act">Todos</Link></h2>
      <div className="agenda">
        {d.eventos.slice(0, 4).map((e) => (
          <Link key={e.id} href={`/calendario/${e.id}`} className="ag" style={{ gridTemplateColumns: "118px minmax(0,1fr)" }}>
            <time>{rotuloData(hojeISO(new Date(e.starts_at)), d.hoje)}, {horaDe(e.starts_at)}</time>
            <div><b>{e.title}</b>{e.location && <small>{e.location}</small>}</div>
          </Link>
        ))}
      </div>
    </section>
  );
  const rotas = d.rotas.length > 0 && (
    <section className="sec" key="rotas" style={{ margin: 0 }}>
      <h2 className="sec__h">Rotas</h2>
      <div className="agenda">
        {d.rotas.map((r) => (
          <Link key={r.id} href={`/rotas/${r.id}`} className="ag" style={{ gridTemplateColumns: "20px minmax(0,1fr)" }}>
            <span style={{ paddingTop: 3 }}><Anel pct={r.pct} /></span>
            <div><b>{r.title}</b><small>{r.linha}</small></div>
          </Link>
        ))}
      </div>
    </section>
  );
  const projetos = d.projetos.length > 0 && (
    <section className="sec" key="projetos" style={{ margin: 0 }}>
      <h2 className="sec__h">Projetos<Link href={url("projetos")} className="sec__act">Todos</Link></h2>
      <div className="agenda">
        {d.projetos.slice(0, 4).map((p) => (
          <Link key={p.id} href={`/projetos/${p.id}`} className="ag" style={{ gridTemplateColumns: "20px minmax(0,1fr)" }}>
            <span style={{ paddingTop: 2 }}><Folder size={15} aria-hidden /></span>
            <div><b>{p.name}</b><small>{p.total ? `${p.feitas} de ${p.total} etapas` : "Sem etapas"}{p.proximo ? <> · <ArrowRight size={12} aria-hidden /> {p.proximo}</> : ""}</small></div>
          </Link>
        ))}
      </div>
    </section>
  );
  const estudos = d.estudos.length > 0 && (
    <section className="sec" key="estudos" style={{ margin: 0 }}>
      <h2 className="sec__h">Estudos</h2>
      <div className="agenda">
        {d.estudos.map((c) => (
          <Link key={c.id} href={`/estudos/${c.id}`} className="ag" style={{ gridTemplateColumns: "20px minmax(0,1fr)" }}>
            <span style={{ paddingTop: 2 }}><GraduationCap size={15} aria-hidden /></span>
            <div><b>{c.title}</b></div>
          </Link>
        ))}
      </div>
    </section>
  );
  const notas = d.notas.length > 0 && (
    <section className="sec" key="notas" style={{ margin: 0 }}>
      <h2 className="sec__h">Notas recentes<Link href={url("notas")} className="sec__act">Todas</Link></h2>
      <div className="agenda">
        {d.notas.slice(0, 3).map((n) => (
          <Link key={n.id} href={url("notas")} className="ag" style={{ gridTemplateColumns: "20px minmax(0,1fr)" }}>
            <span style={{ paddingTop: 2 }}>{n.kind === "decisao" ? <Scale size={15} aria-hidden /> : null}</span>
            <div><b>{n.title}</b><small>{n.kind === "decisao" ? "Decisão" : "Nota"} · {dataDaNota(n)}</small></div>
          </Link>
        ))}
      </div>
    </section>
  );

  // A ordem muda com o tipo: empresa começa pelos retornos e decisões; área, pelas rotinas e lembretes
  const principal = empresa ? [atencao, semana, aguardando, decisoes, rotinas] : [atencao, rotinas, semana, aguardando, decisoes];
  const lado = empresa ? [agenda, projetos, rotas, estudos, notas] : [agenda, rotas, estudos, projetos, notas];

  return (
    <div className="today">
      <div className="today__main">
        {d.proximo && <ProximoPasso proximo={d.proximo} contextos={ctx} projeto={d.proximo.tipo === "responsabilidade" && d.proximo.item.project_id ? d.nomesProjetos[d.proximo.item.project_id] : undefined} />}
        {principal}
        {d.depois > 0 && (
          <p className="field__hint" style={{ padding: "4px 10px" }}>
            {!d.atencao.length && !d.estaSemana.length ? "Nada para esta semana. " : ""}
            {d.depois} {d.depois === 1 ? "coisa sem prazo" : "coisas sem prazo"} em <Link href={url("responsabilidades")} className="link">Responsabilidades</Link>.
          </p>
        )}
      </div>
      {lado.some(Boolean) && <aside className="today__aside">{lado}</aside>}
    </div>
  );
}
