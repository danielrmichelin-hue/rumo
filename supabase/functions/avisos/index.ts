// Avisos do Rumo no celular (web push). Roda a cada 5 minutos (pg_cron) e manda, uma vez cada:
// resumo da manhã (7h30), compromisso 15 min antes, remédio ou rotina no horário, contas e parcelas do dia (9h).
// Com o login do app em vez do token do agendador, manda só uma notificação de teste para quem pediu.
// ?simular=1 devolve o que seria enviado, sem enviar nem registrar.
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

type Aviso = { chave: string; title: string; body: string; url: string };
const FUSO = "America/Sao_Paulo";
const moeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function agora(horaFingida: number | null = null) { // ?simular=1&hora=07:45 (só na simulação)
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: FUSO, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date()).map((x) => [x.type, x.value]));
  const dia = `${p.year}-${p.month}-${p.day}`;
  return { dia, min: horaFingida ?? Number(p.hour) * 60 + Number(p.minute), dow: new Date(`${dia}T12:00:00Z`).getUTCDay() };
}
const minutos = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
function somarMeses(iso: string, n: number) {
  const [a, m, d] = iso.split("-").map(Number);
  const alvo = new Date(Date.UTC(a, m - 1 + n, 1));
  const ultimo = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate();
  return `${alvo.getUTCFullYear()}-${String(alvo.getUTCMonth() + 1).padStart(2, "0")}-${String(Math.min(d, ultimo)).padStart(2, "0")}`;
}
const horaSP = (ts: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, hour: "2-digit", minute: "2-digit" }).format(new Date(ts)).replace(":00", "h").replace(":", "h");

// deno-lint-ignore no-explicit-any
async function avisosDe(sb: any, uid: string, fingida: number | null): Promise<Aviso[]> {
  const { dia, min, dow } = agora(fingida);
  const mes = dia.slice(0, 7);
  const avisos: Aviso[] = [];
  const [{ data: tarefas }, { data: eventos }, { data: rotinas }, { data: marcas }, { data: parcelas }] = await Promise.all([
    sb.from("responsibilities").select("id, state, due_date, today, follow_up_on").eq("user_id", uid).neq("state", "concluida"),
    sb.from("events").select("id, title, starts_at, location").eq("user_id", uid).gte("starts_at", new Date(Date.now() - 12 * 3600e3).toISOString()).lte("starts_at", new Date(Date.now() + 24 * 3600e3).toISOString()),
    sb.from("routines").select("id, title, dose, days, times_per_week, month_day, amount, at_time, ends_on").eq("user_id", uid).eq("status", "ativa"),
    sb.from("routine_checks").select("routine_id, done_on").eq("user_id", uid).gte("done_on", `${mes}-01`),
    sb.from("fin_installments").select("title, total, installments, paid_count, first_due").eq("user_id", uid),
  ]);
  const feita = (id: string, d: string) => (marcas ?? []).some((m: { routine_id: string; done_on: string }) => m.routine_id === id && m.done_on === d);

  // Parcelas vencidas ou do dia, e contas fixas do mês ainda abertas
  const vencendo = (parcelas ?? []).filter((p: { installments: number; paid_count: number; first_due: string }) => p.paid_count < p.installments && somarMeses(p.first_due, p.paid_count) <= dia);
  const contas = (rotinas ?? []).filter((r: { month_day: number | null; amount: number | null; id: string }) => r.month_day && r.amount && r.month_day <= Number(dia.slice(8)) && !(marcas ?? []).some((m: { routine_id: string; done_on: string }) => m.routine_id === r.id && m.done_on.startsWith(mes)));

  // Resumo da manhã
  if (min >= 7 * 60 + 30 && min < 10 * 60) {
    const abertas = (tarefas ?? []).filter((t: { state: string }) => t.state === "a_fazer");
    const atrasadas = abertas.filter((t: { due_date: string | null }) => t.due_date && t.due_date < dia).length;
    const hoje = abertas.filter((t: { due_date: string | null; today: boolean }) => t.due_date === dia || t.today).length;
    const cobrar = (tarefas ?? []).filter((t: { state: string; follow_up_on: string | null }) => t.state === "aguardando" && t.follow_up_on && t.follow_up_on <= dia).length;
    const agenda = (eventos ?? []).filter((e: { starts_at: string }) => new Intl.DateTimeFormat("en-CA", { timeZone: FUSO }).format(new Date(e.starts_at)) === dia).length;
    const partes = [
      hoje && `${hoje} ${hoje === 1 ? "tarefa" : "tarefas"} para hoje`,
      atrasadas && `${atrasadas} ${atrasadas === 1 ? "atrasada" : "atrasadas"}`,
      cobrar && `${cobrar} para cobrar`,
      agenda && `${agenda} ${agenda === 1 ? "compromisso" : "compromissos"}`,
      vencendo.length + contas.length && `${vencendo.length + contas.length} para pagar`,
    ].filter(Boolean);
    avisos.push({ chave: `manha:${dia}`, title: "Bom dia", body: partes.length ? partes.join(" · ") : "Nada com prazo hoje.", url: "/hoje" });
  }

  // Compromissos: 15 minutos antes
  for (const e of eventos ?? []) {
    const falta = (new Date(e.starts_at).getTime() - Date.now()) / 60000;
    if (falta > 0 && falta <= 20) avisos.push({ chave: `ev:${e.id}`, title: `Daqui a ${Math.round(falta)} min`, body: `${horaSP(e.starts_at)} · ${e.title}${e.location ? ` · ${e.location}` : ""}`, url: `/calendario/${e.id}` });
  }

  // Remédios e rotinas com horário: no horário (até 10 min depois), se ainda não foi feita hoje
  for (const r of rotinas ?? []) {
    if (!r.at_time || r.month_day || (r.ends_on && r.ends_on < dia) || feita(r.id, dia)) continue;
    if (r.days && !r.days.includes(dow)) continue;
    const h = minutos(r.at_time);
    if (min >= h && min < h + 10) avisos.push({ chave: `rot:${r.id}:${dia}`, title: r.dose ? "Remédio" : "Rotina", body: r.dose ? `${r.title} · ${r.dose}` : r.title, url: r.dose ? "/saude" : "/hoje" });
  }

  // Contas e parcelas: às 9h
  if (min >= 9 * 60 && min < 12 * 60 && (vencendo.length || contas.length)) {
    const totalP = vencendo.reduce((t: number, p: { total: number; installments: number }) => t + Math.round((Number(p.total) / p.installments) * 100) / 100, 0);
    const partes = [
      vencendo.length && (vencendo.length === 1 ? `Parcela de ${vencendo[0].title} (${moeda(totalP)})` : `${vencendo.length} parcelas (${moeda(totalP)})`),
      ...contas.map((c: { title: string; amount: number }) => `${c.title} (${moeda(Number(c.amount))})`),
    ].filter(Boolean);
    avisos.push({ chave: `contas:${dia}`, title: "Para pagar", body: partes.join(" · "), url: "/financas" });
  }
  return avisos;
}

Deno.serve(async (req) => {
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const segredo = async (nome: string) => (await sb.rpc("rumo_segredo", { nome })).data as string;
  const simular = new URL(req.url).searchParams.get("simular") === "1";
  const hora = new URL(req.url).searchParams.get("hora");
  const fingida = simular && hora && /^\d{2}:\d{2}$/.test(hora) ? minutos(hora) : null;
  let teste: string | null = null;
  if (req.headers.get("x-rumo-token") !== (await segredo("rumo_avisos_token"))) {
    const jwt = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data } = await sb.auth.getUser(jwt);
    if (!data.user) return new Response("Não autorizado", { status: 401 });
    teste = data.user.id;
  }
  webpush.setVapidDetails("https://rumo-iter-midia.vercel.app", await segredo("rumo_vapid_publica"), await segredo("rumo_vapid_privada"));

  let consulta = sb.from("push_subscriptions").select("id, user_id, endpoint, p256dh, auth");
  if (teste) consulta = consulta.eq("user_id", teste);
  const { data: inscricoes } = await consulta;
  const porUsuario = new Map<string, { id: string; endpoint: string; p256dh: string; auth: string }[]>();
  for (const s of inscricoes ?? []) porUsuario.set(s.user_id, [...(porUsuario.get(s.user_id) ?? []), s]);
  if (simular && !teste) { const { data: u } = await sb.from("profiles").select("user_id"); for (const p of u ?? []) if (!porUsuario.has(p.user_id)) porUsuario.set(p.user_id, []); }

  const relatorio: { usuario: string; avisos: Aviso[]; enviados: number }[] = [];
  for (const [uid, subs] of porUsuario) {
    const avisos = teste ? [{ chave: `teste:${Date.now()}`, title: "Rumo", body: "Notificações ligadas. É assim que os avisos vão chegar.", url: "/hoje" }] : await avisosDe(sb, uid, fingida);
    let enviados = 0;
    for (const a of avisos) {
      if (simular) continue;
      if (!teste) {
        const { data: novo } = await sb.from("push_sent").upsert({ user_id: uid, chave: a.chave }, { onConflict: "user_id,chave", ignoreDuplicates: true }).select("id");
        if (!novo?.length) continue; // já avisado
      }
      for (const s of subs) {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(a), { TTL: 3600 });
          enviados++;
        } catch (e) {
          const status = (e as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) await sb.from("push_subscriptions").delete().eq("id", s.id); // aparelho saiu
        }
      }
    }
    relatorio.push({ usuario: uid.slice(0, 8), avisos: simular ? avisos : avisos.map((a) => ({ ...a, body: a.body.slice(0, 40) })), enviados });
  }
  return new Response(JSON.stringify({ agora: agora(fingida), relatorio }), { headers: { "content-type": "application/json" } });
});
