// Monta o Hoje na ordem fixa do MVP (docs/mvp.md, "O Hoje se monta sempre nesta ordem"):
// 1) Próximo passo: o próximo compromisso se for em menos de 2 horas; senão, o primeiro item de Atenção
//    (e, na falta dele, o primeiro do dia);
// 2) Atenção: atrasadas e retornos no dia de cobrar;
// 3) Hoje: prazo hoje ou marcadas para hoje, por horário;
// 4) Agenda do dia;
// 5) Aguardando alguém (recolhido).

import { prazoPassou, rotuloVencido } from "./datas";
import type { Compromisso, Responsabilidade } from "./tipos";

export type ProximoPasso =
  | { tipo: "responsabilidade"; item: Responsabilidade; porque: string }
  | { tipo: "compromisso"; evento: Compromisso; minutos: number };

export type MontagemHoje = {
  proximo: ProximoPasso | null;
  atencao: Responsabilidade[];
  doDia: Responsabilidade[];
  concluidasHoje: Responsabilidade[];
  aguardando: Responsabilidade[];
  agenda: Compromisso[];
  numeros: { atrasadas: number; cobrar: number; doDia: number; aguardando: number };
};

/** "HH:MM" do horário de um timestamp no fuso de São Paulo */
export function horaSP(timestamp: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(timestamp));
}

function minutosEntre(de: Date, ate: Date) {
  return Math.round((ate.getTime() - de.getTime()) / 60000);
}

const porHorario = (a: Responsabilidade, b: Responsabilidade) => {
  if (a.due_time && b.due_time) return a.due_time.localeCompare(b.due_time);
  if (a.due_time) return -1;
  if (b.due_time) return 1;
  return a.created_at.localeCompare(b.created_at);
};

export function montarHoje(abertas: Responsabilidade[], concluidasHoje: Responsabilidade[], eventos: Compromisso[], hoje: string, agora: string, agoraData: Date = new Date()): MontagemHoje {
  const atrasadas = abertas
    .filter((r) => r.state === "a_fazer" && prazoPassou(r, hoje, agora))
    .sort((a, b) => (a.due_date! + (a.due_time ?? "")).localeCompare(b.due_date! + (b.due_time ?? "")));
  const cobrar = abertas
    .filter((r) => r.state === "aguardando" && r.follow_up_on && r.follow_up_on <= hoje)
    .sort((a, b) => a.follow_up_on!.localeCompare(b.follow_up_on!));
  const atencao = [...atrasadas, ...cobrar];
  const naAtencao = new Set(atencao.map((r) => r.id));

  const doDia = abertas
    .filter((r) => r.state === "a_fazer" && !naAtencao.has(r.id) && (r.due_date === hoje || r.today))
    .sort(porHorario);
  const aguardando = abertas
    .filter((r) => r.state === "aguardando" && !naAtencao.has(r.id))
    .sort((a, b) => (a.follow_up_on ?? "").localeCompare(b.follow_up_on ?? ""));

  const agenda = [...eventos].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const proximoEvento = agenda.find((e) => {
    if (e.done_at) return false;
    const m = minutosEntre(agoraData, new Date(e.starts_at));
    return m >= 0 && m < 120;
  });

  let proximo: ProximoPasso | null = null;
  if (proximoEvento) {
    proximo = { tipo: "compromisso", evento: proximoEvento, minutos: minutosEntre(agoraData, new Date(proximoEvento.starts_at)) };
  } else if (atencao[0]) {
    const item = atencao[0];
    proximo = { tipo: "responsabilidade", item, porque: item.state === "aguardando" ? "Dia de cobrar o retorno" : rotuloVencido(item.due_date!, item.due_time, hoje) };
  } else if (doDia[0]) {
    const item = doDia[0];
    proximo = { tipo: "responsabilidade", item, porque: item.due_time ? `Hoje às ${item.due_time.slice(0, 5)}` : "Para hoje" };
  }

  // O próximo passo é o único destaque: não se repete nas listas
  const tirar = (lista: Responsabilidade[]) => (proximo?.tipo === "responsabilidade" ? lista.filter((r) => r.id !== proximo.item.id) : lista);

  return {
    proximo,
    atencao: tirar(atencao),
    doDia: tirar(doDia),
    concluidasHoje,
    aguardando,
    agenda,
    numeros: { atrasadas: atrasadas.length, cobrar: cobrar.length, doDia: doDia.length, aguardando: aguardando.length },
  };
}

/** "1 compromisso em 40 minutos, 2 responsabilidades atrasadas e 1 retorno para cobrar." */
export function resumoDoDia(m: MontagemHoje): string {
  const partes: string[] = [];
  if (m.proximo?.tipo === "compromisso") {
    const min = m.proximo.minutos;
    partes.push(min < 1 ? "1 compromisso começando agora" : `1 compromisso em ${min} ${min === 1 ? "minuto" : "minutos"}`);
  }
  const n = m.numeros;
  if (n.atrasadas) partes.push(`${n.atrasadas} ${n.atrasadas === 1 ? "responsabilidade atrasada" : "responsabilidades atrasadas"}`);
  if (n.cobrar) partes.push(`${n.cobrar} ${n.cobrar === 1 ? "retorno para cobrar" : "retornos para cobrar"}`);
  if (n.doDia) partes.push(`${n.doDia} para hoje`);
  if (n.aguardando) partes.push(`${n.aguardando} ${n.aguardando === 1 ? "retorno aguardando" : "retornos aguardando"}`);
  if (!partes.length) return "Nada pendente nesta etapa.";
  const frase = partes.length === 1 ? partes[0] : `${partes.slice(0, -1).join(", ")} e ${partes[partes.length - 1]}`;
  return frase.charAt(0).toUpperCase() + frase.slice(1) + ".";
}
