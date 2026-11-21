"use client";

import { useOptimistic, useTransition } from "react";
import Link from "next/link";
import { Check, Clock, FileText, Folder, Hourglass, ListChecks, Scale } from "lucide-react";
import { cobrar, concluir, organizar, restaurarData } from "@/app/(app)/acoes";
import { agoraHora, hojeISO, prazoPassou, rotuloData, rotuloHora, rotuloVencido } from "@/lib/datas";
import type { Responsabilidade } from "@/lib/tipos";
import { useAvisar } from "./Avisos";
import type { ContextItem } from "./Shell";
import { Anel } from "./Caminho";

type Props = {
  itens: Responsabilidade[];
  contextos: ContextItem[];
  /** Mostra a bolinha e o nome do contexto em cada linha */
  comContexto?: boolean;
  /** Inbox: mostra o seletor "Organizar em…" */
  organizavel?: boolean;
  /** Hoje: retornos no dia de cobrar ganham a ação "Cobrar" */
  cobravel?: boolean;
  /** Nome do projeto, quando houver (id → nome) */
  projetos?: Record<string, string>;
  /** Na seção Hoje do Hoje, a palavra "Hoje" em cada linha sobra */
  semHoje?: boolean;
  /** Rotas (id → título e progresso), para o anel nos passos de uma Rota */
  rotas?: Record<string, { title: string; pct: number }>;
  /** Subtarefas de cada tarefa (feitas / total) */
  passos?: Record<string, { feitos: number; total: number }>;
};

export function ListaResponsabilidades({ itens, contextos, comContexto = true, organizavel = false, cobravel = false, projetos, semHoje = false, rotas, passos }: Props) {
  const hoje = hojeISO();
  const agora = agoraHora();
  return (
    <ul className="list">
      {itens.map((item) => (
        <Linha key={item.id} item={item} contextos={contextos} comContexto={comContexto} organizavel={organizavel} cobravel={cobravel} semHoje={semHoje} rota={item.route_id ? rotas?.[item.route_id] : undefined} hoje={hoje} agora={agora} projeto={item.project_id ? projetos?.[item.project_id] : undefined} passo={passos?.[item.id]} />
      ))}
    </ul>
  );
}

type LinhaProps = {
  item: Responsabilidade;
  contextos: ContextItem[];
  comContexto: boolean;
  organizavel: boolean;
  cobravel: boolean;
  semHoje: boolean;
  rota?: { title: string; pct: number };
  hoje: string;
  agora: string;
  projeto?: string;
  passo?: { feitos: number; total: number };
};

function Linha({ item, contextos, comContexto, organizavel, cobravel, semHoje, rota, hoje, agora, projeto, passo }: LinhaProps) {
  const [, iniciar] = useTransition();
  const [feita, setFeita] = useOptimistic(item.state === "concluida");
  const [saiu, setSaiu] = useOptimistic(false);
  const avisar = useAvisar();
  const contexto = contextos.find((c) => c.id === item.context_id);
  const aguardando = item.state === "aguardando";
  const vencida = !feita && prazoPassou(item, hoje, agora);
  const cobrarHoje = aguardando && !!item.follow_up_on && item.follow_up_on <= hoje;

  function alternar() {
    const agoraFeita = !feita;
    iniciar(async () => {
      setFeita(agoraFeita);
      await concluir(item.id, agoraFeita);
    });
    if (agoraFeita) {
      avisar({ texto: "Concluída.", acao: { rotulo: "Desfazer", fazer: () => iniciar(() => concluir(item.id, false)) } });
    }
  }

  function mover(contextId: string) {
    if (!contextId) return;
    const destino = contextos.find((c) => c.id === contextId)?.name ?? "o contexto";
    iniciar(async () => {
      setSaiu(true);
      await organizar(item.id, contextId);
    });
    avisar({ texto: `Organizada em ${destino}.`, acao: { rotulo: "Desfazer", fazer: () => iniciar(() => organizar(item.id, null)) } });
  }

  function registrarCobranca() {
    iniciar(async () => {
      setSaiu(true);
      const r = await cobrar(item.id);
      avisar({
        texto: `Cobrança registrada. A próxima fica para ${rotuloData(r.depois, hoje)}.`,
        acao: { rotulo: "Desfazer", fazer: () => iniciar(() => restaurarData(item.id, "follow_up_on", r.antes)) },
      });
    });
  }

  if (saiu) return null;

  return (
    <li className="row" data-feita={feita || undefined} data-atrasada={vencida || undefined}>
      <button
        type="button"
        className={`check${aguardando && !feita ? " check--wait" : ""}`}
        role="checkbox"
        aria-checked={feita}
        aria-label={feita ? `Reabrir: ${item.title}` : `Concluir: ${item.title}`}
        onClick={alternar}
      >
        {feita && <Check aria-hidden />}
      </button>
      <div className="row__body">
        <Link href={`/responsabilidades/${item.id}`} className="row__t">{item.title}</Link>
        <span className="props">
          {comContexto && contexto && (
            <span className="prop"><i className="dot" style={{ background: contexto.color }} />{contexto.name}</span>
          )}
          {projeto && <span className="prop"><Folder aria-hidden />{projeto}</span>}
          {rota && <span className="prop"><Anel pct={rota.pct} />Rota · {rota.title}</span>}
          {item.kind === "decidir" && <span className="prop"><Scale aria-hidden />Decisão</span>}
          {passo && passo.total > 0 && <span className={`prop${passo.feitos === passo.total ? " prop--ok" : ""}`}><ListChecks aria-hidden />{passo.feitos}/{passo.total}</span>}
          {aguardando ? (
            <span className={`prop${cobrarHoje ? " prop--warn" : ""}`}>
              <Hourglass aria-hidden />
              {item.waiting_note ? `${item.waiting_note} · ` : ""}
              {cobrarHoje ? (item.follow_up_on === hoje ? "cobrar hoje" : `cobrar desde ${rotuloData(item.follow_up_on!, hoje)}`) : `cobrar ${rotuloData(item.follow_up_on!, hoje)}`}
            </span>
          ) : item.due_date && vencida ? (
            <span className="prop prop--late"><Clock aria-hidden />{rotuloVencido(item.due_date, item.due_time, hoje)}</span>
          ) : (
            <>
              {item.due_date && !(semHoje && item.due_date === hoje) && (
                <span className={`prop${item.due_date === hoje && !feita ? " prop--today" : ""}`}>
                  {item.due_date === hoje ? "Hoje" : rotuloData(item.due_date, hoje)}
                </span>
              )}
              {item.due_time && <span className="prop"><Clock aria-hidden />{rotuloHora(item.due_time)}</span>}
            </>
          )}
          {item.note && <span className="prop" title="Tem nota"><FileText aria-label="Tem nota" /></span>}
        </span>
      </div>
      {(organizavel && contextos.length > 0) || (cobravel && cobrarHoje) ? (
        <div className="row__r">
          {cobravel && cobrarHoje && (
            <button type="button" className="btn btn--line btn--sm" onClick={registrarCobranca}>Cobrar</button>
          )}
          {organizavel && contextos.length > 0 && (
            <label className="organize">
              <span className="sr-only">Organizar em</span>
              <select defaultValue="" onChange={(e) => mover(e.target.value)} aria-label={`Organizar "${item.title}" em um contexto`}>
                <option value="" disabled>Organizar em…</option>
                {contextos.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
          )}
        </div>
      ) : null}
    </li>
  );
}
