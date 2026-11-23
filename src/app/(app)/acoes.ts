"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { lerCaptura } from "@/lib/captura";
import { diaDaSemana, ehId, hojeISO, instante, numeroBR, somarDias, somarDiasUteis } from "@/lib/datas";
import { CAMPOS_ROTA, chegadaPorPrazo, normalizar, PREFIXO_PASSO, resumirRota, type TipoRota, TIPOS } from "@/lib/rotas";
import { CORES_CONTEXTO, type Estado } from "@/lib/tipos";
import { CORES_MATERIA, INTERVALOS, proximaRevisao, TIPOS_CURSO, type TipoCurso } from "@/lib/estudos";
import { textoFrequencia } from "@/lib/rotinas";
import { CAMPOS_LANCAMENTO, limitesDoMes, moeda, naConta, normalizarLancamento, tipoNoBanco, TIPOS_INVESTIMENTO } from "@/lib/financas";
import { TIPOS_SAUDE, type TipoMedida, MEDIDAS } from "@/lib/saude";

function atualizar() {
  revalidatePath("/", "layout");
}

/** Apaga uma linha do dono pelo id (o RLS garante que é dele) */
async function apagarPorId(tabela: string, id: string) {
  if (!ehId(id)) return;
  const supabase = await createClient();
  await supabase.from(tabela).delete().eq("id", id);
  atualizar();
}

const DATA = /^\d{4}-\d{2}-\d{2}$/;
const HORA = /^\d{2}:\d{2}(:\d{2})?$/;
const texto = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.trim() : "");

// ---------- captura ----------

/** Lê o texto como a captura (data, hora, #contexto, "Decidir…") e guarda como responsabilidade.
 *  `extra` liga ao projeto ou à Rota; `contextoPadrao` vale quando o texto não traz #contexto. */
async function inserirCaptura(original: string, extra: Record<string, unknown> = {}, contextoPadrao: string | null = null) {
  const supabase = await createClient();
  const { data: contextos } = await supabase.from("contexts").select("id, name").eq("archived", false).order("position");
  const leitura = lerCaptura(original, contextos ?? [], hojeISO());
  const { data, error } = await supabase
    .from("responsibilities")
    .insert({
      title: leitura.title, due_date: leitura.due_date, due_time: leitura.due_time, kind: leitura.kind,
      context_id: leitura.context_id ?? contextoPadrao, source: "captura", raw_capture: original, ...extra,
    })
    .select("id")
    .single();
  return { leitura, contextos: contextos ?? [], id: error ? null : data?.id ?? null };
}

export type ResultadoCaptura =
  | { ok: true; id: string; title: string; due_date: string | null; due_time: string | null; contexto: string | null }
  | { ok: false; erro: string };

/** `onde`: o contexto escolhido na etiqueta ("inbox" para a Inbox); sem escolha, vale o #contexto do texto */
export async function capturar(bruto: string, onde: string | null = null): Promise<ResultadoCaptura> {
  const original = bruto.trim();
  if (!original) return { ok: false, erro: "Escreva algo para guardar." };
  if (original.length > 1000) return { ok: false, erro: "Texto longo demais para uma captura." };

  const escolha = onde === "inbox" ? { context_id: null } : ehId(onde) ? { context_id: onde } : {};
  const { leitura, contextos, id } = await inserirCaptura(original, escolha);
  const destino = "context_id" in escolha ? escolha.context_id : leitura.context_id;
  if (!id) return { ok: false, erro: "Não foi possível guardar. Tente de novo." };

  atualizar();
  return {
    ok: true,
    id,
    title: leitura.title,
    due_date: leitura.due_date,
    due_time: leitura.due_time,
    contexto: contextos.find((c) => c.id === destino)?.name ?? null,
  };
}

// ---------- responsabilidades ----------

export async function organizar(id: string, contextId: string | null) {
  const supabase = await createClient();
  await supabase.from("responsibilities").update({ context_id: contextId || null }).eq("id", id);
  atualizar();
}

export async function concluir(id: string, feita: boolean) {
  const supabase = await createClient();
  await supabase
    .from("responsibilities")
    .update(feita ? { state: "concluida", done_at: new Date().toISOString() } : { state: "a_fazer", done_at: null })
    .eq("id", id);
  atualizar();
}

export type EstadoForm = { ok?: boolean; erro?: string; em?: number };

export async function salvarResponsabilidade(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const id = texto(form.get("id"));
  const title = texto(form.get("title"));
  const state = texto(form.get("state")) as Estado;
  const kind = texto(form.get("kind")) === "decidir" ? "decidir" : "fazer";
  const dueDate = texto(form.get("due_date"));
  const dueTime = texto(form.get("due_time"));
  const waiting = texto(form.get("waiting_note"));
  let followUp = texto(form.get("follow_up_on"));
  const note = texto(form.get("note"));
  const contextId = texto(form.get("context_id"));
  const projectId = texto(form.get("project_id"));

  if (!title) return { erro: "O título não pode ficar vazio." };
  if (title.length > 300) return { erro: "O título passa de 300 caracteres." };
  if (!["a_fazer", "aguardando", "concluida"].includes(state)) return { erro: "Estado desconhecido." };
  if (dueDate && !DATA.test(dueDate)) return { erro: "Prazo inválido." };
  if (dueTime && !HORA.test(dueTime)) return { erro: "Hora inválida." };
  if (state === "aguardando") {
    if (!waiting) return { erro: "Aguardando quem? Escreva o nome ou o que você espera." };
    if (!followUp) followUp = somarDiasUteis(hojeISO(), 3);
    if (!DATA.test(followUp)) return { erro: "Data de cobrança inválida." };
  }

  const supabase = await createClient();
  const { data: atual } = await supabase.from("responsibilities").select("state, done_at").eq("id", id).single();
  if (!atual) return { erro: "Esta responsabilidade não existe mais." };

  const { error } = await supabase
    .from("responsibilities")
    .update({
      title,
      kind,
      state,
      note: note || null,
      context_id: contextId || null,
      project_id: projectId || null,
      due_date: dueDate || null,
      due_time: dueTime ? dueTime.slice(0, 5) : null,
      today: form.get("today") === "on" && state !== "concluida",
      waiting_note: state === "aguardando" ? waiting : null,
      follow_up_on: state === "aguardando" ? followUp : null,
      done_at: state === "concluida" ? (atual.state === "concluida" ? atual.done_at : new Date().toISOString()) : null,
    })
    .eq("id", id);
  if (error) return { erro: "Não foi possível guardar. Tente de novo." };

  atualizar();
  return { ok: true, em: Date.now() };
}

export async function apagarResponsabilidade(form: FormData) {
  const id = texto(form.get("id"));
  const voltar = texto(form.get("voltar")) || "/inbox";
  const supabase = await createClient();
  await supabase.from("responsibilities").delete().eq("id", id);
  atualizar();
  redirect(voltar.startsWith("/") ? voltar : "/inbox");
}

// ---------- contextos ----------

function corValida(cor: string) {
  return /^#[0-9a-fA-F]{6}$/.test(cor) ? cor : CORES_CONTEXTO[0].cor;
}

export async function criarContexto(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const name = texto(form.get("name"));
  if (!name) return { erro: "Dê um nome ao contexto." };
  if (name.length > 60) return { erro: "Nome com mais de 60 caracteres." };
  const supabase = await createClient();
  const { data: ultimos } = await supabase.from("contexts").select("position").order("position", { ascending: false }).limit(1);
  const { error } = await supabase.from("contexts").insert({
    name,
    color: corValida(texto(form.get("color"))),
    kind: texto(form.get("kind")) === "empresa" ? "empresa" : "area",
    position: (ultimos?.[0]?.position ?? -1) + 1,
  });
  if (error) return { erro: "Não foi possível criar o contexto." };
  atualizar();
  return { ok: true, em: Date.now() };
}

export async function salvarContexto(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const id = texto(form.get("id"));
  const name = texto(form.get("name"));
  if (!name) return { erro: "Dê um nome ao contexto." };
  if (name.length > 60) return { erro: "Nome com mais de 60 caracteres." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("contexts")
    .update({ name, color: corValida(texto(form.get("color"))), kind: texto(form.get("kind")) === "empresa" ? "empresa" : "area" })
    .eq("id", id);
  if (error) return { erro: "Não foi possível guardar." };
  atualizar();
  return { ok: true, em: Date.now() };
}

export async function arquivarContexto(id: string, arquivado: boolean) {
  const supabase = await createClient();
  await supabase.from("contexts").update({ archived: arquivado }).eq("id", id);
  atualizar();
}

// As responsabilidades do contexto voltam para a Inbox (on delete set null)
export async function apagarContexto(id: string) {
  await apagarPorId("contexts", id);
}

export async function moverContexto(id: string, direcao: -1 | 1) {
  const supabase = await createClient();
  const { data } = await supabase.from("contexts").select("id, position").eq("archived", false).order("position");
  if (!data) return;
  const i = data.findIndex((c) => c.id === id);
  const j = i + direcao;
  if (i < 0 || j < 0 || j >= data.length) return;
  const ordem = [...data];
  [ordem[i], ordem[j]] = [ordem[j], ordem[i]];
  await Promise.all(ordem.map((c, pos) => (c.position === pos ? null : supabase.from("contexts").update({ position: pos }).eq("id", c.id))));
  atualizar();
}

// ---------- Hoje: cobrar, adiar, desfazer ----------

/** Registra a cobrança de um retorno: a próxima fica para daqui a 3 dias úteis. */
export async function cobrar(id: string): Promise<{ antes: string | null; depois: string }> {
  const supabase = await createClient();
  const { data } = await supabase.from("responsibilities").select("follow_up_on").eq("id", id).single();
  const depois = somarDiasUteis(hojeISO(), 3);
  await supabase.from("responsibilities").update({ follow_up_on: depois }).eq("id", id);
  atualizar();
  return { antes: data?.follow_up_on ?? null, depois };
}

export type Adiamento = "amanha" | "segunda";

/** Adia o prazo (ou a cobrança, se estiver aguardando alguém). Devolve o que era para poder desfazer. */
export async function adiar(id: string, para: Adiamento): Promise<{ campo: "due_date" | "follow_up_on"; antes: string | null; depois: string } | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("responsibilities").select("state, due_date, follow_up_on").eq("id", id).single();
  if (!data) return null;
  const hoje = hojeISO();
  const dia = diaDaSemana(hoje);
  const depois = para === "amanha" ? somarDias(hoje, 1) : somarDias(hoje, ((8 - dia) % 7) || 7);
  const campo = data.state === "aguardando" ? "follow_up_on" : "due_date";
  await supabase.from("responsibilities").update({ [campo]: depois }).eq("id", id);
  atualizar();
  return { campo, antes: (data[campo] as string | null) ?? null, depois };
}

/** Planejar a semana: põe a tarefa num dia (ou tira a data). Devolve a data de antes, para desfazer. */
export async function moverParaDia(id: string, dia: string | null): Promise<{ ok: boolean; antes?: string | null }> {
  if (!ehId(id) || (dia !== null && !DATA.test(dia))) return { ok: false };
  const supabase = await createClient();
  const { data } = await supabase.from("responsibilities").select("due_date").eq("id", id).single();
  if (!data) return { ok: false };
  const { error } = await supabase.from("responsibilities").update({ due_date: dia, ...(dia ? {} : { due_time: null }) }).eq("id", id);
  if (error) return { ok: false };
  atualizar();
  return { ok: true, antes: data.due_date ?? null };
}

/** Nova tarefa direto num dia da semana (o texto é lido como a captura; se trouxer data, vale a do texto) */
export async function criarNoDia(bruto: string, dia: string): Promise<{ ok: boolean; erro?: string }> {
  const original = bruto.trim();
  if (!original || !DATA.test(dia)) return { ok: false, erro: "Escreva a tarefa." };
  const { leitura, id } = await inserirCaptura(original);
  if (!id) return { ok: false, erro: "Não foi possível guardar." };
  if (!leitura.due_date) {
    const supabase = await createClient();
    await supabase.from("responsibilities").update({ due_date: dia }).eq("id", id);
  }
  atualizar();
  return { ok: true };
}

export async function restaurarData(id: string, campo: "due_date" | "follow_up_on", valor: string | null) {
  const supabase = await createClient();
  await supabase.from("responsibilities").update({ [campo]: valor }).eq("id", id);
  atualizar();
}


export async function salvarNome(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const nome = texto(form.get("nome")).slice(0, 60);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { erro: "Sua sessão terminou. Entre de novo." };
  const { error } = await supabase.from("profiles").upsert({ user_id: user.id, display_name: nome || null }, { onConflict: "user_id" });
  if (error) return { erro: "Não foi possível salvar." };
  atualizar();
  return { ok: true, em: Date.now() };
}

// ---------- compromissos (calendário) ----------


function lerCompromisso(form: FormData) {
  const title = texto(form.get("title"));
  const data = texto(form.get("data"));
  const inicio = texto(form.get("inicio"));
  const fim = texto(form.get("fim"));
  if (!title) return { erro: "Dê um nome ao compromisso." };
  if (title.length > 200) return { erro: "Nome com mais de 200 caracteres." };
  if (!DATA.test(data)) return { erro: "Escolha a data." };
  if (!HORA.test(inicio)) return { erro: "Escolha a hora de início." };
  if (fim && !HORA.test(fim)) return { erro: "Hora de fim inválida." };
  if (fim && fim.slice(0, 5) <= inicio.slice(0, 5)) return { erro: "O fim precisa ser depois do início." };
  return {
    dados: {
      title,
      context_id: texto(form.get("context_id")) || null,
      starts_at: instante(data, inicio),
      ends_at: fim ? instante(data, fim) : null,
      location: texto(form.get("location")) || null,
      note: texto(form.get("note")) || null,
      // Saúde: consulta, exame… (só quando o formulário traz o campo; os outros não mexem)
      ...(form.has("health_kind") ? { health_kind: Object.hasOwn(TIPOS_SAUDE, texto(form.get("health_kind"))) ? texto(form.get("health_kind")) : null } : {}),
    },
  };
}

export async function criarCompromisso(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const r = lerCompromisso(form);
  if ("erro" in r) return { erro: r.erro };
  const supabase = await createClient();
  const { error } = await supabase.from("events").insert(r.dados);
  if (error) return { erro: "Não foi possível guardar o compromisso." };
  atualizar();
  return { ok: true, em: Date.now() };
}

export async function salvarCompromisso(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const r = lerCompromisso(form);
  if ("erro" in r) return { erro: r.erro };
  const supabase = await createClient();
  const { error } = await supabase.from("events").update(r.dados).eq("id", texto(form.get("id")));
  if (error) return { erro: "Não foi possível guardar o compromisso." };
  atualizar();
  return { ok: true, em: Date.now() };
}

export async function apagarCompromisso(form: FormData) {
  const supabase = await createClient();
  await supabase.from("events").delete().eq("id", texto(form.get("id")));
  atualizar();
  redirect(texto(form.get("voltar")).startsWith("/") ? texto(form.get("voltar")) : "/calendario");
}

// ---------- projetos ----------

export async function criarProjeto(_: EstadoForm, form: FormData): Promise<EstadoForm & { id?: string }> {
  const name = texto(form.get("name"));
  if (!name) return { erro: "Dê um nome ao projeto." };
  if (name.length > 120) return { erro: "Nome com mais de 120 caracteres." };
  const due = texto(form.get("due_date"));
  if (due && !DATA.test(due)) return { erro: "Data de entrega inválida." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .insert({ name, context_id: texto(form.get("context_id")) || null, due_date: due || null })
    .select("id")
    .single();
  if (error || !data) return { erro: "Não foi possível criar o projeto." };
  atualizar();
  redirect(`/projetos/${data.id}`);
}

export async function salvarProjeto(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const name = texto(form.get("name"));
  const status = texto(form.get("status"));
  const due = texto(form.get("due_date"));
  if (!name) return { erro: "Dê um nome ao projeto." };
  if (!["ativo", "pausado", "concluido"].includes(status)) return { erro: "Estado desconhecido." };
  if (due && !DATA.test(due)) return { erro: "Data de entrega inválida." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("projects")
    .update({ name: name.slice(0, 120), status, due_date: due || null, context_id: texto(form.get("context_id")) || null, note: texto(form.get("note")) || null })
    .eq("id", texto(form.get("id")));
  if (error) return { erro: "Não foi possível guardar o projeto." };
  atualizar();
  return { ok: true, em: Date.now() };
}

/** Ativo, pausado ou concluído, num toque */
export async function mudarEstadoProjeto(id: string, status: "ativo" | "pausado" | "concluido") {
  if (!ehId(id) || !["ativo", "pausado", "concluido"].includes(status)) return;
  const supabase = await createClient();
  await supabase.from("projects").update({ status }).eq("id", id);
  atualizar();
}

export async function apagarProjeto(form: FormData) {
  const supabase = await createClient();
  // As responsabilidades do projeto continuam (on delete set null)
  await supabase.from("projects").delete().eq("id", texto(form.get("id")));
  atualizar();
  redirect("/projetos");
}

/** Adiciona uma etapa ao projeto lendo o texto como a captura (data, hora, #contexto) */
export async function adicionarNoProjeto(projetoId: string, bruto: string): Promise<{ ok: boolean; erro?: string }> {
  const original = bruto.trim();
  if (!original) return { ok: false, erro: "Escreva a etapa." };
  const supabase = await createClient();
  const { data: projeto } = await supabase.from("projects").select("id, context_id").eq("id", projetoId).single();
  if (!projeto) return { ok: false, erro: "Este projeto não existe mais." };
  const { id } = await inserirCaptura(original, { project_id: projeto.id }, projeto.context_id);
  if (!id) return { ok: false, erro: "Não foi possível guardar a etapa." };
  atualizar();
  return { ok: true };
}

// ---------- busca ----------

export type Achado = { tipo: "responsabilidade" | "projeto" | "rota" | "curso" | "rotina" | "nota" | "contexto" | "compromisso" | "lancamento"; id: string; titulo: string; detalhe: string; href: string; cor?: string };

export async function buscar(termo: string): Promise<Achado[]> {
  const q = termo.trim().replace(/[%,()]/g, " ").replace(/\s+/g, " ").slice(0, 80);
  if (q.length < 2) return [];
  const like = `%${q}%`;
  const supabase = await createClient();
  const [r, p, c, e, ctxs, rt, cs, ms, rn, nt, fin] = await Promise.all([
    supabase.from("responsibilities").select("id, title, note, state, context_id, waiting_note").or(`title.ilike.${like},note.ilike.${like},waiting_note.ilike.${like}`).order("updated_at", { ascending: false }).limit(20),
    supabase.from("projects").select("id, name, note, context_id").or(`name.ilike.${like},note.ilike.${like}`).limit(8),
    supabase.from("contexts").select("id, name, color").ilike("name", like).limit(8),
    supabase.from("events").select("id, title, starts_at, context_id").or(`title.ilike.${like},location.ilike.${like},note.ilike.${like}`).order("starts_at", { ascending: false }).limit(8),
    supabase.from("contexts").select("id, name, color"),
    supabase.from("routes").select("id, title, kind, context_id").or(`title.ilike.${like},note.ilike.${like}`).limit(8),
    supabase.from("study_courses").select("id, title, kind, context_id").or(`title.ilike.${like},note.ilike.${like}`).limit(8),
    supabase.from("study_subjects").select("id, title, course_id").ilike("title", like).limit(8),
    supabase.from("routines").select("id, title, days, times_per_week, month_day, at_time").or(`title.ilike.${like},note.ilike.${like}`).limit(8),
    supabase.from("notes").select("id, kind, title, context_id").or(`title.ilike.${like},body.ilike.${like},why.ilike.${like}`).order("created_at", { ascending: false }).limit(8),
    supabase.from("fin_entries").select(CAMPOS_LANCAMENTO).or(`description.ilike.${like},category.ilike.${like}`).order("happened_on", { ascending: false }).limit(12),
  ]);
  const nomeCtx = (id: string | null) => (ctxs.data ?? []).find((x) => x.id === id);
  const estados: Record<string, string> = { a_fazer: "A fazer", aguardando: "Aguardando alguém", concluida: "Concluída" };
  const achados: Achado[] = [];
  for (const x of r.data ?? []) {
    const ctx = nomeCtx(x.context_id);
    const naNota = x.note && !x.title.toLowerCase().includes(q.toLowerCase()) ? " · na nota" : "";
    achados.push({ tipo: "responsabilidade", id: x.id, titulo: x.title, detalhe: `${estados[x.state] ?? ""}${ctx ? ` · ${ctx.name}` : " · Inbox"}${naNota}`, href: `/responsabilidades/${x.id}`, cor: ctx?.color });
  }
  for (const x of p.data ?? []) {
    const ctx = nomeCtx(x.context_id);
    achados.push({ tipo: "projeto", id: x.id, titulo: x.name, detalhe: `Projeto${ctx ? ` · ${ctx.name}` : ""}`, href: `/projetos/${x.id}`, cor: ctx?.color });
  }
  for (const x of rt.data ?? []) {
    const ctx = nomeCtx(x.context_id);
    achados.push({ tipo: "rota", id: x.id, titulo: x.title, detalhe: `Rota${ctx ? ` · ${ctx.name}` : ""}`, href: `/rotas/${x.id}`, cor: ctx?.color });
  }
  for (const x of cs.data ?? []) {
    const ctx = nomeCtx(x.context_id);
    achados.push({ tipo: "curso", id: x.id, titulo: x.title, detalhe: `${TIPOS_CURSO[x.kind as TipoCurso] ?? "Curso"}${ctx ? ` · ${ctx.name}` : ""}`, href: `/estudos/${x.id}`, cor: ctx?.color });
  }
  for (const x of ms.data ?? []) {
    const curso = (cs.data ?? []).find((k) => k.id === x.course_id);
    achados.push({ tipo: "curso", id: x.id, titulo: x.title, detalhe: `Matéria${curso ? ` · ${curso.title}` : ""}`, href: `/estudos/${x.course_id}#${x.id}` });
  }
  for (const x of rn.data ?? []) achados.push({ tipo: "rotina", id: x.id, titulo: x.title, detalhe: `Rotina · ${textoFrequencia(x)}${x.at_time ? ` · ${x.at_time.slice(0, 5)}` : ""}`, href: `/rotinas#${x.id}` });
  for (const x of (fin.data ?? []).map(normalizarLancamento)) {
    const sinal = naConta(x) < 0 ? "−" : "+";
    achados.push({ tipo: "lancamento", id: x.id, titulo: x.description, detalhe: `${sinal}${moeda(x.amount)} · ${x.happened_on.split("-").reverse().join("/")} · ${x.category}`, href: `/financas?mes=${x.happened_on.slice(0, 7)}` });
  }
  for (const x of nt.data ?? []) {
    const ctx = nomeCtx(x.context_id);
    achados.push({ tipo: "nota", id: x.id, titulo: x.title, detalhe: `${x.kind === "decisao" ? "Decisão" : "Nota"}${ctx ? ` · ${ctx.name}` : ""}`, href: `/notas#${x.id}`, cor: ctx?.color });
  }
  for (const x of c.data ?? []) achados.push({ tipo: "contexto", id: x.id, titulo: x.name, detalhe: "Contexto", href: `/contexto/${x.id}`, cor: x.color });
  for (const x of e.data ?? []) {
    const ctx = nomeCtx(x.context_id);
    const dia = hojeISO(new Date(x.starts_at));
    achados.push({ tipo: "compromisso", id: x.id, titulo: x.title, detalhe: `Compromisso · ${dia.split("-").reverse().slice(0, 2).join("/")}${ctx ? ` · ${ctx.name}` : ""}`, href: `/calendario/${x.id}`, cor: ctx?.color });
  }
  return achados;
}

// ---------- Rotas ----------

export type DadosRota = {
  kind: TipoRota;
  title: string;
  context_id: string | null;
  target: number | null;
  current: number;
  /** prazo na unidade do tipo: meses (financeiro), dias (leitura), semanas (estudos) */
  prazo: number | null;
  /** negócios: data de chegada */
  target_date: string | null;
  marcos: string[];
  passoNoHoje: boolean;
  /** curso ligado (módulo Estudos) */
  course_id?: string | null;
};

export async function criarRota(d: DadosRota): Promise<{ ok: boolean; erro?: string; id?: string }> {
  const title = d.title.trim().slice(0, 120);
  if (!title) return { ok: false, erro: "Dê um nome ao destino." };
  if (!(d.kind in TIPOS)) return { ok: false, erro: "Tipo de Rota desconhecido." };
  const hoje = hojeISO();
  let target_date: string | null = null;
  if (d.kind === "negocios") {
    if (!d.target_date || !DATA.test(d.target_date)) return { ok: false, erro: "Escolha quando quer chegar." };
    if (!d.marcos.filter((m) => m.trim()).length) return { ok: false, erro: "Defina pelo menos um marco." };
    target_date = d.target_date;
  } else {
    if (!d.target || d.target <= 0) return { ok: false, erro: "Informe o tamanho do destino." };
    if (!d.prazo || d.prazo <= 0) return { ok: false, erro: "Informe o prazo." };
    target_date = chegadaPorPrazo(d.kind, d.prazo, hoje);
  }
  const current = Math.max(0, Math.min(d.current || 0, d.target ?? Infinity));

  const supabase = await createClient();
  const { data: rota, error } = await supabase
    .from("routes")
    .insert({ title, kind: d.kind, context_id: d.context_id || null, target: d.kind === "negocios" ? null : d.target, current, start_value: current, start_date: hoje, target_date, course_id: d.course_id || null })
    .select(CAMPOS_ROTA)
    .single();
  if (error || !rota) return { ok: false, erro: "Não foi possível criar a Rota." };

  if (d.kind === "negocios") {
    const marcos = d.marcos.map((m) => m.trim()).filter(Boolean).slice(0, 20).map((t, i) => ({ route_id: rota.id, title: t.slice(0, 120), position: i }));
    await supabase.from("route_milestones").insert(marcos);
  } else if (d.passoNoHoje) {
    const s = resumirRota(normalizar(rota), [], hoje).sugestao;
    if (s) await supabase.from("responsibilities").insert({ title: s.title, due_date: s.due_date, today: s.today, context_id: d.context_id || null, route_id: rota.id, source: "manual" });
  }
  atualizar();
  return { ok: true, id: rota.id };
}

export async function salvarRota(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const id = texto(form.get("id"));
  const title = texto(form.get("title")).slice(0, 120);
  const due = texto(form.get("target_date"));
  const status = texto(form.get("status"));
  const alvo = texto(form.get("target"));
  if (!title) return { erro: "Dê um nome ao destino." };
  if (due && !DATA.test(due)) return { erro: "Data de chegada inválida." };
  if (!["ativa", "pausada", "concluida"].includes(status)) return { erro: "Estado desconhecido." };
  const mudancas: Record<string, unknown> = { title, target_date: due || null, status, context_id: texto(form.get("context_id")) || null, note: texto(form.get("note")) || null };
  if (alvo) {
    const n = numeroBR(alvo);
    if (!(n > 0)) return { erro: "O destino precisa ser maior que zero." };
    mudancas.target = n;
  }
  const supabase = await createClient();
  const { error } = await supabase.from("routes").update(mudancas).eq("id", id);
  if (error) return { erro: "Não foi possível guardar." };
  atualizar();
  return { ok: true, em: Date.now() };
}

export async function apagarRota(form: FormData) {
  const supabase = await createClient();
  // Os passos continuam como responsabilidades (on delete set null)
  await supabase.from("routes").delete().eq("id", texto(form.get("id")));
  atualizar();
  redirect("/rotas");
}

/** Registra um avanço ("guardei R$ 400") e atualiza quanto já tem */
export async function registrarAvanco(routeId: string, quantia: number): Promise<{ ok: boolean; erro?: string; entradaId?: string }> {
  if (!Number.isFinite(quantia) || quantia === 0) return { ok: false, erro: "Informe quanto avançou." };
  const supabase = await createClient();
  const { data: rota } = await supabase.from("routes").select("current").eq("id", routeId).single();
  if (!rota) return { ok: false, erro: "Esta Rota não existe mais." };
  const { data: entrada, error } = await supabase.from("route_entries").insert({ route_id: routeId, amount: quantia, happened_on: hojeISO() }).select("id").single();
  if (error || !entrada) return { ok: false, erro: "Não foi possível registrar." };
  await supabase.from("routes").update({ current: Math.max(0, Number(rota.current) + quantia) }).eq("id", routeId);
  atualizar();
  return { ok: true, entradaId: entrada.id };
}

export async function desfazerAvanco(entradaId: string) {
  const supabase = await createClient();
  const { data: e } = await supabase.from("route_entries").select("route_id, amount").eq("id", entradaId).single();
  if (!e) return;
  const { data: rota } = await supabase.from("routes").select("current").eq("id", e.route_id).single();
  await supabase.from("route_entries").delete().eq("id", entradaId);
  if (rota) await supabase.from("routes").update({ current: Math.max(0, Number(rota.current) - Number(e.amount)) }).eq("id", e.route_id);
  atualizar();
}

/** Quando o novo ritmo pesa demais: manter a chegada (aceita o novo ritmo) ou mover a chegada (mantém o ritmo) */
export async function decidirRecalculo(routeId: string, opcao: "manter" | "mover", novaData?: string) {
  const supabase = await createClient();
  const { data: rota } = await supabase.from("routes").select("current").eq("id", routeId).single();
  if (!rota) return;
  const base = { start_value: Number(rota.current), start_date: hojeISO() };
  await supabase.from("routes").update(opcao === "mover" && novaData && DATA.test(novaData) ? { ...base, target_date: novaData } : base).eq("id", routeId);
  atualizar();
}

/** Coloca no Hoje o próximo passo sugerido pela Rota */
export async function criarPassoSugerido(routeId: string): Promise<{ ok: boolean; titulo?: string }> {
  const supabase = await createClient();
  const { data: rota } = await supabase.from("routes").select(CAMPOS_ROTA).eq("id", routeId).single();
  if (!rota) return { ok: false };
  const r = normalizar(rota);
  const s = resumirRota(r, [], hojeISO()).sugestao;
  if (!s) return { ok: false };
  // Se já existe o passo sugerido de antes (outro valor), atualiza em vez de duplicar
  const prefixo = PREFIXO_PASSO[r.kind];
  const { data: abertos } = await supabase.from("responsibilities").select("id, title").eq("route_id", r.id).neq("state", "concluida");
  const antigo = prefixo ? (abertos ?? []).find((p) => p.title.startsWith(prefixo)) : null;
  if (antigo) await supabase.from("responsibilities").update({ title: s.title, due_date: s.due_date, today: s.today }).eq("id", antigo.id);
  else await supabase.from("responsibilities").insert({ title: s.title, due_date: s.due_date, today: s.today, context_id: r.context_id, route_id: r.id, source: "manual" });
  atualizar();
  return { ok: true, titulo: s.title };
}

/** Adiciona um passo à Rota (e ao marco atual, nas Rotas de negócio), lido como a captura */
export async function adicionarPassoRota(routeId: string, bruto: string, marcoId?: string | null): Promise<{ ok: boolean; erro?: string }> {
  const original = bruto.trim();
  if (!original) return { ok: false, erro: "Escreva o passo." };
  const supabase = await createClient();
  const { data: rota } = await supabase.from("routes").select("id, context_id").eq("id", routeId).single();
  if (!rota) return { ok: false, erro: "Esta Rota não existe mais." };
  const { id } = await inserirCaptura(original, { route_id: rota.id, milestone_id: marcoId || null }, rota.context_id);
  if (!id) return { ok: false, erro: "Não foi possível guardar o passo." };
  atualizar();
  return { ok: true };
}

export async function adicionarMarco(routeId: string, titulo: string) {
  const t = titulo.trim().slice(0, 120);
  if (!t) return;
  const supabase = await createClient();
  const { data: ultimos } = await supabase.from("route_milestones").select("position").eq("route_id", routeId).order("position", { ascending: false }).limit(1);
  await supabase.from("route_milestones").insert({ route_id: routeId, title: t, position: (ultimos?.[0]?.position ?? -1) + 1 });
  atualizar();
}

export async function concluirMarco(id: string, feito: boolean) {
  const supabase = await createClient();
  await supabase.from("route_milestones").update({ done_at: feito ? new Date().toISOString() : null }).eq("id", id);
  atualizar();
}

export async function apagarMarco(id: string) {
  await apagarPorId("route_milestones", id);
}

// ---------- estudos (Book 6.2): ciclo de estudos ----------
// Matérias com horas no ciclo e temas. As sessões são compromissos do Core (events com course_id):
// aparecem no calendário, no Hoje e no Próximo passo; concluídas, contam no ciclo e na semana.

export type DadosCurso = {
  title: string;
  kind: TipoCurso;
  context_id: string | null;
  weekly_minutes: number | null;
  exam_date: string | null;
  exam_label: string | null;
  materias: { title: string; minutos: number | null }[];
};

const inteiro = (v: unknown, min = 0) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= min ? n : null;
};
const minutosValidos = (m: number | null | undefined) => (m && m >= 5 ? Math.min(6000, Math.round(m)) : null);

export async function criarCurso(d: DadosCurso): Promise<{ ok: boolean; erro?: string; id?: string }> {
  const title = d.title.trim().slice(0, 120);
  if (!title) return { ok: false, erro: "Dê um nome ao estudo." };
  if (!(d.kind in TIPOS_CURSO)) return { ok: false, erro: "Tipo desconhecido." };
  if (d.exam_date && !DATA.test(d.exam_date)) return { ok: false, erro: "Data da prova inválida." };
  const supabase = await createClient();
  const { data: curso, error } = await supabase
    .from("study_courses")
    .insert({
      title,
      kind: d.kind,
      context_id: d.context_id || null,
      current_cycle: 1,
      cycle_started_on: hojeISO(),
      weekly_minutes: minutosValidos(d.weekly_minutes),
      exam_date: d.exam_date || null,
      exam_label: d.exam_label?.trim().slice(0, 60) || null,
    })
    .select("id")
    .single();
  if (error || !curso) return { ok: false, erro: "Não foi possível criar." };
  const materias = d.materias.filter((m) => m.title.trim()).slice(0, 30);
  if (materias.length) {
    await supabase.from("study_subjects").insert(
      materias.map((m, i) => ({ course_id: curso.id, title: m.title.trim().slice(0, 120), cycle_minutes: minutosValidos(m.minutos), position: i, color: CORES_MATERIA[i % CORES_MATERIA.length] })),
    );
  }
  atualizar();
  return { ok: true, id: curso.id };
}

export async function salvarCurso(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const id = texto(form.get("id"));
  const title = texto(form.get("title")).slice(0, 120);
  if (!title) return { erro: "Dê um nome ao estudo." };
  const exam = texto(form.get("exam_date"));
  if (exam && !DATA.test(exam)) return { erro: "Data da prova inválida." };
  const status = texto(form.get("status"));
  const horasSemana = numeroBR(texto(form.get("weekly_hours")));
  const total = inteiro(texto(form.get("total_lessons")) || null, 1);
  const supabase = await createClient();
  const { error } = await supabase
    .from("study_courses")
    .update({
      title,
      kind: texto(form.get("kind")) in TIPOS_CURSO ? texto(form.get("kind")) : "curso",
      context_id: texto(form.get("context_id")) || null,
      total_lessons: total,
      done_lessons: Math.min(inteiro(texto(form.get("done_lessons")) || 0) ?? 0, total ?? Infinity),
      weekly_minutes: horasSemana > 0 ? Math.round(horasSemana * 60) : null,
      exam_date: exam || null,
      exam_label: texto(form.get("exam_label")).slice(0, 60) || null,
      status: ["ativo", "pausado", "concluido"].includes(status) ? status : "ativo",
      note: texto(form.get("note")) || null,
    })
    .eq("id", id);
  if (error) return { erro: "Não foi possível salvar." };
  atualizar();
  return { ok: true, em: Date.now() };
}

export async function apagarCurso(form: FormData) {
  const id = texto(form.get("id"));
  const supabase = await createClient();
  await supabase.from("study_courses").delete().eq("id", id);
  atualizar();
  redirect("/estudos");
}

/** "Português 4h", "Redação 1h30", "Inglês 90 min" ou só "Português" (fica com 2h) */
function lerMateria(texto: string): { title: string; minutos: number } {
  const m = texto.trim().match(/^(.*?)[\s·,-]+(\d+(?:[.,]\d+)?)\s*h(?:\s*(\d{1,2}))?\s*$/i);
  if (m) return { title: m[1].trim(), minutos: Math.round(numeroBR(m[2]) * 60) + Number(m[3] ?? 0) };
  const min = texto.trim().match(/^(.*?)[\s·,-]+(\d+)\s*min\s*$/i);
  if (min) return { title: min[1].trim(), minutos: Number(min[2]) };
  return { title: texto.trim(), minutos: 120 };
}

export async function adicionarMateria(courseId: string, bruto: string): Promise<{ ok: boolean; erro?: string }> {
  const { title, minutos } = lerMateria(bruto);
  if (!title) return { ok: false, erro: "Dê um nome à matéria." };
  const supabase = await createClient();
  const { data: existentes } = await supabase.from("study_subjects").select("position").eq("course_id", courseId);
  const n = existentes?.length ?? 0;
  const pos = Math.max(-1, ...(existentes ?? []).map((x) => x.position)) + 1;
  const { error } = await supabase.from("study_subjects").insert({ course_id: courseId, title: title.slice(0, 120), cycle_minutes: minutosValidos(minutos), position: pos, color: CORES_MATERIA[n % CORES_MATERIA.length] });
  if (error) return { ok: false, erro: "Não foi possível adicionar." };
  atualizar();
  return { ok: true };
}

export async function salvarMateria(id: string, titulo: string, minutos: number | null): Promise<{ ok: boolean; erro?: string }> {
  const title = titulo.trim().slice(0, 120);
  if (!title) return { ok: false, erro: "Dê um nome à matéria." };
  const supabase = await createClient();
  const { error } = await supabase.from("study_subjects").update({ title, cycle_minutes: minutosValidos(minutos) }).eq("id", id);
  if (error) return { ok: false, erro: "Não foi possível salvar." };
  atualizar();
  return { ok: true };
}

export async function apagarMateria(id: string) {
  await apagarPorId("study_subjects", id);
}

/** Sobe ou desce a matéria na ordem do ciclo */
export async function moverMateria(id: string, direcao: -1 | 1) {
  const supabase = await createClient();
  const { data: m } = await supabase.from("study_subjects").select("course_id").eq("id", id).single();
  if (!m) return;
  const { data: todas } = await supabase.from("study_subjects").select("id, position").eq("course_id", m.course_id).order("position");
  const lista = todas ?? [];
  const i = lista.findIndex((x) => x.id === id);
  const j = i + direcao;
  if (i < 0 || j < 0 || j >= lista.length) return;
  [lista[i], lista[j]] = [lista[j], lista[i]];
  await Promise.all(lista.map((x, k) => supabase.from("study_subjects").update({ position: k }).eq("id", x.id)));
  atualizar();
}

/** Temas colados de uma vez (um por linha, como no edital); números e marcadores do começo da linha saem */
export async function adicionarTemas(subjectId: string, bruto: string, moduleId: string | null = null): Promise<{ ok: boolean; erro?: string; n?: number }> {
  const linhas = bruto
    .split(/\n|;/)
    .map((l) => l.replace(/^\s*(?:[-•*·]|\d+(?:\.\d+)*[.)]?)\s*/, "").trim())
    .filter(Boolean)
    .slice(0, 200);
  if (!linhas.length) return { ok: false, erro: "Escreva ao menos um tema." };
  const supabase = await createClient();
  const { data: existentes } = await supabase.from("study_topics").select("position").eq("subject_id", subjectId);
  const base = Math.max(-1, ...(existentes ?? []).map((x) => x.position)) + 1;
  const { error } = await supabase.from("study_topics").insert(linhas.map((t, i) => ({ subject_id: subjectId, module_id: moduleId, title: t.slice(0, 200), position: base + i })));
  if (error) return { ok: false, erro: "Não foi possível guardar os temas." };
  atualizar();
  return { ok: true, n: linhas.length };
}

/** Vista: agenda a 1ª revisão para amanhã. Desmarcar zera as revisões. */
export async function marcarTema(id: string, feito: boolean) {
  const supabase = await createClient();
  await supabase.from("study_topics").update(feito ? { done_at: new Date().toISOString(), review_step: 0, next_review_on: proximaRevisao(0) } : { done_at: null, review_step: 0, next_review_on: null }).eq("id", id);
  atualizar();
}

/** "Revisei": agenda a próxima (7 e depois 30 dias); depois da 3ª, acabou */
export async function revisarTema(id: string): Promise<{ feitas: number; proxima: string | null } | null> {
  const supabase = await createClient();
  const { data: t } = await supabase.from("study_topics").select("review_step").eq("id", id).single();
  if (!t) return null;
  const feitas = Math.min(INTERVALOS.length, t.review_step + 1);
  const proxima = proximaRevisao(feitas);
  await supabase.from("study_topics").update({ review_step: feitas, next_review_on: proxima }).eq("id", id);
  atualizar();
  return { feitas, proxima };
}

export async function desfazerRevisao(id: string, passo: number, proxima: string | null) {
  const supabase = await createClient();
  await supabase.from("study_topics").update({ review_step: passo, next_review_on: proxima }).eq("id", id);
  atualizar();
}

export async function criarModulo(subjectId: string, titulo: string): Promise<{ ok: boolean; erro?: string }> {
  const title = titulo.trim().slice(0, 120);
  if (!title) return { ok: false, erro: "Dê um nome ao módulo." };
  const supabase = await createClient();
  const { data: existentes } = await supabase.from("study_modules").select("position").eq("subject_id", subjectId);
  const { error } = await supabase.from("study_modules").insert({ subject_id: subjectId, title, position: Math.max(-1, ...(existentes ?? []).map((x) => x.position)) + 1 });
  if (error) return { ok: false, erro: "Não foi possível criar o módulo." };
  atualizar();
  return { ok: true };
}

export async function renomearModulo(id: string, titulo: string) {
  const title = titulo.trim().slice(0, 120);
  if (!title) return;
  const supabase = await createClient();
  await supabase.from("study_modules").update({ title }).eq("id", id);
  atualizar();
}

/** As aulas do módulo continuam na matéria, sem módulo */
export async function apagarModulo(id: string) {
  await apagarPorId("study_modules", id);
}

/** Fim de um foco (pomodoro): o tempo estudado vira sessão concluída; pode dar a aula por vista */
export async function registrarFoco(courseId: string, subjectId: string | null, topicId: string | null, minutos: number, vista: boolean): Promise<{ ok: boolean }> {
  const min = Math.round(minutos);
  if (min < 1) return { ok: false };
  const supabase = await createClient();
  const id = await inserirSessao(supabase, courseId, subjectId, topicId, new Date(Date.now() - min * 60000), Math.max(1, Math.min(600, min)), true);
  if (!id) return { ok: false };
  if (topicId && vista) await supabase.from("study_topics").update({ done_at: new Date().toISOString(), review_step: 0, next_review_on: proximaRevisao(0) }).eq("id", topicId);
  atualizar();
  return { ok: true };
}

export async function apagarTema(id: string) {
  await apagarPorId("study_topics", id);
}

/** +1 ou −1 aula no curso (quando ele tem aulas contadas) e nas Rotas de estudos ligadas */
export async function registrarAula(courseId: string, delta: 1 | -1 = 1): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const [{ data: curso }, { data: rotas }] = await Promise.all([
    supabase.from("study_courses").select("done_lessons").eq("id", courseId).single(),
    supabase.from("routes").select("id, current").eq("course_id", courseId).eq("kind", "estudos").eq("status", "ativa"),
  ]);
  if (!curso) return { ok: false };
  await supabase.from("study_courses").update({ done_lessons: Math.max(0, curso.done_lessons + delta) }).eq("id", courseId);
  for (const r of rotas ?? []) {
    await supabase.from("routes").update({ current: Math.max(0, Number(r.current) + delta) }).eq("id", r.id);
    await supabase.from("route_entries").insert({ route_id: r.id, amount: delta, note: "Aula", happened_on: hojeISO() });
  }
  atualizar();
  return { ok: true };
}

/** Sessão de estudo = compromisso do Core com o estudo, a matéria e o tema */
async function inserirSessao(supabase: Awaited<ReturnType<typeof createClient>>, courseId: string, subjectId: string | null, topicId: string | null, inicio: Date, minutos: number, feita = false) {
  const [{ data: curso }, { data: materia }, { data: tema }] = await Promise.all([
    supabase.from("study_courses").select("title, context_id").eq("id", courseId).single(),
    subjectId ? supabase.from("study_subjects").select("title").eq("id", subjectId).single() : Promise.resolve({ data: null }),
    topicId ? supabase.from("study_topics").select("title").eq("id", topicId).single() : Promise.resolve({ data: null }),
  ]);
  if (!curso) return null;
  const fim = new Date(inicio.getTime() + minutos * 60000).toISOString();
  const title = (materia ? `${materia.title}${tema ? ` · ${tema.title}` : ""}` : `Estudo · ${curso.title}`).slice(0, 200);
  const { data } = await supabase
    .from("events")
    .insert({ title, context_id: curso.context_id, course_id: courseId, subject_id: subjectId, topic_id: tema ? topicId : null, starts_at: inicio.toISOString(), ends_at: fim, done_at: feita ? fim : null })
    .select("id")
    .single();
  return data?.id ?? null;
}

function lerSessao(form: FormData) {
  return {
    courseId: texto(form.get("course_id")),
    subjectId: texto(form.get("subject_id")) || null,
    topicId: texto(form.get("topic_id")) || null,
    data: texto(form.get("data")),
    inicio: texto(form.get("inicio")),
    minutos: Math.min(600, inteiro(texto(form.get("minutos")), 5) ?? 50),
  };
}

/** Marca uma sessão de estudo no calendário */
export async function agendarSessao(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const s = lerSessao(form);
  if (!DATA.test(s.data)) return { erro: "Escolha o dia." };
  if (!HORA.test(s.inicio)) return { erro: "Escolha a hora." };
  const supabase = await createClient();
  const id = await inserirSessao(supabase, s.courseId, s.subjectId, s.topicId, new Date(instante(s.data, s.inicio)), s.minutos);
  if (!id) return { erro: "Não foi possível marcar a sessão." };
  atualizar();
  return { ok: true, em: Date.now() };
}

/** Registrar estudo que já aconteceu (sem cronômetro): conta no ciclo e na semana na hora */
export async function registrarEstudo(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const s = lerSessao(form);
  if (!DATA.test(s.data) || s.data > hojeISO()) return { erro: "Escolha um dia até hoje." };
  // Sem hora: hoje termina agora; outro dia, fica às 19:00
  const fimHoje = s.data === hojeISO() && !s.inicio;
  const inicio = fimHoje ? new Date(Date.now() - s.minutos * 60000) : new Date(instante(s.data, HORA.test(s.inicio) ? s.inicio : "19:00"));
  const supabase = await createClient();
  const id = await inserirSessao(supabase, s.courseId, s.subjectId, s.topicId, inicio, s.minutos, true);
  if (!id) return { erro: "Não foi possível registrar." };
  // No primeiro ciclo, estudo registrado de antes do começo puxa o começo para trás (conta no ciclo)
  const { data: c } = await supabase.from("study_courses").select("current_cycle, cycle_started_on").eq("id", s.courseId).single();
  if (c && c.current_cycle === 1 && s.data < c.cycle_started_on) await supabase.from("study_courses").update({ cycle_started_on: s.data }).eq("id", s.courseId);
  if (s.topicId && form.get("tema_feito")) await supabase.from("study_topics").update({ done_at: new Date().toISOString(), review_step: 0, next_review_on: proximaRevisao(0) }).eq("id", s.topicId);
  atualizar();
  return { ok: true, em: Date.now() };
}

/** "Começar sessão": abre uma sessão de 50 min agora */
/** Concluir a sessão conta o tempo no ciclo e na semana; pode dar o tema por terminado.
 *  Concluída antes do fim marcado, o fim passa a ser agora (conta só o tempo estudado); o desfazer devolve o fim. */
export async function concluirSessao(id: string, feita: boolean, temaFeito = false, fimAntes?: string | null): Promise<{ ok: boolean; fimAntes?: string | null }> {
  const supabase = await createClient();
  const { data: s } = await supabase.from("events").select("course_id, topic_id, starts_at, ends_at").eq("id", id).single();
  if (!s?.course_id) return { ok: false };
  const agora = Date.now();
  const mudanca: Record<string, string | null> = { done_at: feita ? new Date(agora).toISOString() : null };
  const ini = new Date(s.starts_at).getTime();
  if (feita && s.ends_at && agora > ini && agora < new Date(s.ends_at).getTime()) mudanca.ends_at = new Date(Math.max(agora, ini + 5 * 60000)).toISOString();
  if (!feita && fimAntes !== undefined) mudanca.ends_at = fimAntes;
  await supabase.from("events").update(mudanca).eq("id", id);
  if (s.topic_id && temaFeito) await supabase.from("study_topics").update(feita ? { done_at: new Date(agora).toISOString(), review_step: 0, next_review_on: proximaRevisao(0) } : { done_at: null, review_step: 0, next_review_on: null }).eq("id", s.topic_id);
  atualizar();
  return { ok: true, fimAntes: s.ends_at };
}

/** Fecha o ciclo e começa o próximo: as horas das matérias voltam a zero, os temas continuam */
export async function avancarCiclo(courseId: string): Promise<{ ok: boolean; antes?: { ciclo: number; inicio: string } }> {
  const supabase = await createClient();
  const { data: c } = await supabase.from("study_courses").select("current_cycle, cycle_started_on").eq("id", courseId).single();
  if (!c) return { ok: false };
  await supabase.from("study_courses").update({ current_cycle: c.current_cycle + 1, cycle_started_on: hojeISO() }).eq("id", courseId);
  atualizar();
  return { ok: true, antes: { ciclo: c.current_cycle, inicio: c.cycle_started_on } };
}

export async function restaurarCiclo(courseId: string, ciclo: number, inicio: string) {
  const supabase = await createClient();
  await supabase.from("study_courses").update({ current_cycle: ciclo, cycle_started_on: inicio }).eq("id", courseId);
  atualizar();
}

/** "Começar" numa sessão marcada para mais tarde: ela passa a ser agora, com a mesma duração */
export async function comecarSessaoMarcada(id: string): Promise<{ ok: boolean; antes?: { starts_at: string; ends_at: string | null } }> {
  const supabase = await createClient();
  const { data: s } = await supabase.from("events").select("starts_at, ends_at").eq("id", id).single();
  if (!s) return { ok: false };
  const dur = s.ends_at ? new Date(s.ends_at).getTime() - new Date(s.starts_at).getTime() : 50 * 60000;
  const agora = new Date();
  agora.setSeconds(0, 0);
  await supabase.from("events").update({ starts_at: agora.toISOString(), ends_at: new Date(agora.getTime() + dur).toISOString() }).eq("id", id);
  atualizar();
  return { ok: true, antes: { starts_at: s.starts_at, ends_at: s.ends_at } };
}

export async function restaurarSessao(id: string, starts_at: string, ends_at: string | null) {
  const supabase = await createClient();
  await supabase.from("events").update({ starts_at, ends_at }).eq("id", id);
  atualizar();
}

export async function apagarSessao(id: string) {
  await apagarPorId("events", id);
}

// ---------- rotinas (Book 6.3) ----------

export type DadosRotina = {
  title: string;
  context_id: string | null;
  days: number[] | null;
  times_per_week: number | null;
  month_day: number | null;
  at_time: string | null;
  duration_min: number | null;
  /** conta fixa (só para "todo mês"): valor e categoria */
  amount?: number | null;
  category?: string | null;
};

function validarRotina(d: DadosRotina): { erro: string } | { dados: DadosRotina } {
  const title = d.title.trim().slice(0, 120);
  if (!title) return { erro: "Dê um nome à rotina." };
  const days = d.days ? [...new Set(d.days.filter((x) => Number.isInteger(x) && x >= 0 && x <= 6))].sort() : null;
  const vezes = d.times_per_week && d.times_per_week >= 1 && d.times_per_week <= 7 ? Math.round(d.times_per_week) : null;
  const diaMes = d.month_day && d.month_day >= 1 && d.month_day <= 31 ? Math.round(d.month_day) : null;
  if (d.month_day !== null && d.month_day !== undefined && !diaMes) return { erro: "Escolha um dia do mês entre 1 e 31." };
  if (days && !days.length) return { erro: "Escolha ao menos um dia." };
  if (!days && !vezes && !diaMes) return { erro: "Escolha os dias, quantas vezes por semana ou o dia do mês." };
  if (d.at_time && !HORA.test(d.at_time)) return { erro: "Hora inválida." };
  const dur = d.duration_min && d.duration_min >= 5 ? Math.min(600, Math.round(d.duration_min)) : null;
  return { dados: { title, context_id: d.context_id || null, days: diaMes ? null : days ?? null, times_per_week: diaMes || days ? null : vezes, month_day: diaMes, amount: diaMes && d.amount && d.amount > 0 ? Math.round(d.amount * 100) / 100 : null, category: diaMes && d.amount ? (d.category?.trim().slice(0, 40) || "Contas da casa") : null, at_time: d.at_time || null, duration_min: dur } };
}

export async function criarRotina(d: DadosRotina): Promise<{ ok: boolean; erro?: string }> {
  const v = validarRotina(d);
  if ("erro" in v) return { ok: false, erro: v.erro };
  const supabase = await createClient();
  const { count } = await supabase.from("routines").select("id", { count: "exact", head: true });
  const { error } = await supabase.from("routines").insert({ ...v.dados, position: count ?? 0 });
  if (error) return { ok: false, erro: "Não foi possível criar a rotina." };
  atualizar();
  return { ok: true };
}

export async function salvarRotina(id: string, d: DadosRotina & { status: "ativa" | "pausada" }): Promise<{ ok: boolean; erro?: string }> {
  const v = validarRotina(d);
  if ("erro" in v) return { ok: false, erro: v.erro };
  const supabase = await createClient();
  const { error } = await supabase.from("routines").update({ ...v.dados, status: d.status === "pausada" ? "pausada" : "ativa" }).eq("id", id);
  if (error) return { ok: false, erro: "Não foi possível salvar." };
  atualizar();
  return { ok: true };
}

export async function apagarRotina(id: string) {
  await apagarPorId("routines", id);
}

/** Marca ou desmarca a rotina num dia (hoje ou um dia que já passou nesta semana) */
export async function marcarRotina(id: string, dia: string, feita: boolean) {
  if (!DATA.test(dia) || dia > hojeISO()) return;
  const supabase = await createClient();
  if (feita) await supabase.from("routine_checks").upsert({ routine_id: id, done_on: dia }, { onConflict: "routine_id,done_on", ignoreDuplicates: true });
  else await supabase.from("routine_checks").delete().eq("routine_id", id).eq("done_on", dia);
  // Conta fixa (rotina mensal com valor): pagar lança a saída do mês; desmarcar tira
  const { data: r } = await supabase.from("routines").select("title, amount, category, month_day, context_id").eq("id", id).single();
  if (r?.month_day && r.amount) {
    const { inicio, fim } = limitesDoMes(dia.slice(0, 7));
    const { data: ja } = await supabase.from("fin_entries").select("id").eq("routine_id", id).gte("happened_on", inicio).lte("happened_on", fim);
    if (feita && !ja?.length) await supabase.from("fin_entries").insert({ kind: "saida", amount: r.amount, description: r.title, category: r.category ?? "Contas da casa", happened_on: dia, paid: true, routine_id: id, context_id: r.context_id });
    if (!feita && ja?.length) await supabase.from("fin_entries").delete().in("id", ja.map((x) => x.id));
  }
  atualizar();
}

// ---------- notas (Book 6.4) ----------

export type DadosNota = { id?: string; kind: "nota" | "decisao"; title: string; body: string; why: string; decided_on: string; vinculo: string };

/** Cria ou altera a nota. O vínculo ("c:", "p:" ou "e:" + id) diz onde ela mora; projeto e curso levam o contexto junto. */
export async function salvarNota(d: DadosNota): Promise<{ ok: boolean; erro?: string }> {
  const title = d.title.trim().slice(0, 200);
  if (!title) return { ok: false, erro: d.kind === "decisao" ? "Escreva o que foi decidido." : "Dê um título à nota." };
  const [tipo, id] = d.vinculo.split(":");
  if (!ehId(id) || !["c", "p", "e"].includes(tipo)) return { ok: false, erro: "Escolha onde a nota mora." };
  if (d.kind === "decisao" && d.decided_on && !DATA.test(d.decided_on)) return { ok: false, erro: "Data inválida." };
  const supabase = await createClient();
  let context_id: string | null = tipo === "c" ? id : null;
  if (tipo !== "c") {
    const { data } = await supabase.from(tipo === "p" ? "projects" : "study_courses").select("context_id").eq("id", id).single();
    context_id = data?.context_id ?? null;
  }
  const decisao = d.kind === "decisao";
  const linha = {
    kind: decisao ? "decisao" : "nota",
    title,
    body: d.body.trim() || null,
    why: decisao ? d.why.trim() || null : null,
    decided_on: decisao ? d.decided_on || hojeISO() : null,
    context_id,
    project_id: tipo === "p" ? id : null,
    course_id: tipo === "e" ? id : null,
  };
  const { error } = d.id ? await supabase.from("notes").update(linha).eq("id", d.id) : await supabase.from("notes").insert(linha);
  if (error) return { ok: false, erro: "Não foi possível guardar a nota." };
  atualizar();
  return { ok: true };
}

export async function apagarNota(id: string) {
  await apagarPorId("notes", id);
}

// ---------- finanças (o mês numa tela) ----------

export type DadosLancamento = { kind: "entrada" | "saida" | "aporte" | "resgate"; amount: number; description: string; category: string; happened_on: string; paid: boolean; context_id: string | null; investment_id?: string | null };

/** Tipo e investimento válidos: investir e resgatar exigem o investimento */
function tipoLancamento(kind: string, investimento?: string | null): { erro: string } | { kind: "entrada" | "saida" | "aporte" | "resgate"; investment_id: string | null } {
  if (kind === "aporte" || kind === "resgate") {
    if (!ehId(investimento)) return { erro: "Escolha o investimento." };
    return { kind, investment_id: investimento };
  }
  return { kind: kind === "entrada" ? "entrada" : "saida", investment_id: null };
}

export async function lancar(d: DadosLancamento): Promise<{ ok: boolean; erro?: string; id?: string }> {
  const description = d.description.trim().slice(0, 120);
  if (!(d.amount > 0)) return { ok: false, erro: "Informe o valor." };
  if (!description) return { ok: false, erro: "Diga o que foi." };
  if (!DATA.test(d.happened_on)) return { ok: false, erro: "Data inválida." };
  const t = tipoLancamento(d.kind, d.investment_id);
  if ("erro" in t) return { ok: false, erro: t.erro };
  const transferencia = t.kind === "aporte" || t.kind === "resgate";
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("fin_entries")
    .insert({ kind: tipoNoBanco(t.kind), investment_id: t.investment_id, amount: Math.round(d.amount * 100) / 100, description, category: transferencia ? "Investimentos" : d.category.trim().slice(0, 40) || "Outros", happened_on: d.happened_on, paid: transferencia ? true : d.paid, context_id: d.context_id || null })
    .select("id")
    .single();
  if (error || !data) return { ok: false, erro: "Não foi possível lançar." };
  atualizar();
  return { ok: true, id: data.id };
}

export async function apagarLancamento(id: string) {
  await apagarPorId("fin_entries", id);
}

/** A pagar → pago (ou volta); a data passa a ser hoje quando é pago */
export async function marcarLancamentoPago(id: string, pago: boolean) {
  const supabase = await createClient();
  await supabase.from("fin_entries").update(pago ? { paid: true, happened_on: hojeISO() } : { paid: false }).eq("id", id);
  atualizar();
}

export async function salvarOrcamento(categoria: string, limite: number): Promise<{ ok: boolean; erro?: string }> {
  const category = categoria.trim().slice(0, 40);
  if (!category) return { ok: false, erro: "Escolha a categoria." };
  const supabase = await createClient();
  if (!(limite > 0)) {
    await supabase.from("fin_budgets").delete().eq("category", category);
  } else {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("fin_budgets").upsert({ user_id: user?.id, category, monthly_limit: Math.round(limite * 100) / 100 }, { onConflict: "user_id,category" });
    if (error) return { ok: false, erro: "Não foi possível guardar o limite." };
  }
  atualizar();
  return { ok: true };
}

// ---------- subtarefas ----------

/** Uma ou várias (uma por linha, para colar uma lista) */
export async function adicionarSubtarefas(tarefaId: string, bruto: string): Promise<{ ok: boolean; erro?: string }> {
  if (!ehId(tarefaId)) return { ok: false };
  const titulos = bruto.split(/\n/).map((t) => t.replace(/^\s*([-*•]|\[ ?\]|\d+[.)])\s*/, "").trim()).filter(Boolean).map((t) => t.slice(0, 200)).slice(0, 50);
  if (!titulos.length) return { ok: false, erro: "Escreva a subtarefa." };
  const supabase = await createClient();
  const { count } = await supabase.from("subtasks").select("id", { count: "exact", head: true }).eq("responsibility_id", tarefaId);
  const { error } = await supabase.from("subtasks").insert(titulos.map((title, i) => ({ responsibility_id: tarefaId, title, position: (count ?? 0) + i })));
  if (error) return { ok: false, erro: "Não foi possível guardar." };
  atualizar();
  return { ok: true };
}

export async function marcarSubtarefa(id: string, feita: boolean) {
  if (!ehId(id)) return;
  const supabase = await createClient();
  await supabase.from("subtasks").update({ done_at: feita ? new Date().toISOString() : null }).eq("id", id);
  atualizar();
}

export async function renomearSubtarefa(id: string, titulo: string) {
  const title = titulo.trim().slice(0, 200);
  if (!ehId(id) || !title) return;
  const supabase = await createClient();
  await supabase.from("subtasks").update({ title }).eq("id", id);
  atualizar();
}

export async function apagarSubtarefa(id: string) {
  await apagarPorId("subtasks", id);
}

// ---------- finanças: ajustes, parcelamentos, investimentos ----------

export type DadosAjustes = { pct_parcelas: number; pct_investir: number; pct_livre: number; cash_balance: number | null };

export async function salvarAjustesFinancas(d: DadosAjustes): Promise<{ ok: boolean; erro?: string }> {
  const pct = [d.pct_parcelas, d.pct_investir, d.pct_livre].map((x) => Math.round(Number(x) || 0));
  if (pct.some((x) => x < 0 || x > 100) || pct[0] + pct[1] + pct[2] !== 100) return { ok: false, erro: "As três partes precisam somar 100%." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, erro: "Entre de novo." };
  const { data: antes } = await supabase.from("fin_settings").select("cash_balance").maybeSingle();
  // Saldo informado vale a partir de hoje (o Rumo soma o que vier depois)
  const saldoMudou = d.cash_balance !== null && Number(antes?.cash_balance ?? NaN) !== d.cash_balance;
  const { error } = await supabase.from("fin_settings").upsert({
    user_id: user.id, pay_day: null, pct_parcelas: pct[0], pct_investir: pct[1], pct_livre: pct[2],
    ...(d.cash_balance === null ? { cash_balance: null, cash_on: null } : saldoMudou ? { cash_balance: Math.round(d.cash_balance * 100) / 100, cash_on: hojeISO() } : {}),
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });
  if (error) return { ok: false, erro: "Não foi possível guardar." };
  atualizar();
  return { ok: true };
}

export type DadosParcelamento = { title: string; category: string; total: number; installments: number; paid_count: number; first_due: string; creditor: string | null; context_id: string | null };

export async function criarParcelamento(d: DadosParcelamento): Promise<{ ok: boolean; erro?: string }> {
  const title = d.title.trim().slice(0, 120);
  if (!title) return { ok: false, erro: "O que foi comprado?" };
  if (!(d.total > 0)) return { ok: false, erro: "Informe o valor total." };
  const n = Math.round(d.installments);
  if (!(n >= 1 && n <= 120)) return { ok: false, erro: "Em quantas vezes? De 1 a 120." };
  const pagas = Math.max(0, Math.min(n, Math.round(d.paid_count) || 0));
  if (!DATA.test(d.first_due)) return { ok: false, erro: "Quando vence a primeira parcela?" };
  const supabase = await createClient();
  const { error } = await supabase.from("fin_installments").insert({
    title, category: d.category.trim().slice(0, 40) || "Compras", total: Math.round(d.total * 100) / 100, installments: n, paid_count: pagas,
    first_due: d.first_due, creditor: d.creditor?.trim().slice(0, 60) || null, context_id: d.context_id || null,
  });
  if (error) return { ok: false, erro: "Não foi possível guardar." };
  atualizar();
  return { ok: true };
}

/** Paguei a próxima parcela: lança a saída de hoje e conta a parcela como paga */
export async function pagarParcela(id: string): Promise<{ ok: boolean; lancamento?: string }> {
  if (!ehId(id)) return { ok: false };
  const supabase = await createClient();
  const { data: p } = await supabase.from("fin_installments").select("title, category, total, installments, paid_count, context_id").eq("id", id).single();
  if (!p || p.paid_count >= p.installments) return { ok: false };
  const parcela = Math.round((Number(p.total) / p.installments) * 100) / 100;
  const numero = p.paid_count + 1;
  const { data: l } = await supabase.from("fin_entries").insert({
    kind: "saida", amount: parcela, description: `${p.title.trim()} · parcela ${numero} de ${p.installments}`.slice(0, 120), category: p.category,
    happened_on: hojeISO(), paid: true, installment_id: id, context_id: p.context_id,
  }).select("id").single();
  await supabase.from("fin_installments").update({ paid_count: numero }).eq("id", id);
  atualizar();
  return { ok: true, lancamento: l?.id };
}

/** Desfaz o último pagamento (tira o lançamento dele, se houver, e volta uma parcela) */
export async function desfazerParcela(id: string, lancamento?: string) {
  if (!ehId(id)) return;
  const supabase = await createClient();
  const { data: p } = await supabase.from("fin_installments").select("paid_count").eq("id", id).single();
  if (!p || p.paid_count <= 0) return;
  let alvo = lancamento && ehId(lancamento) ? lancamento : null;
  if (!alvo) {
    const { data: ultimo } = await supabase.from("fin_entries").select("id").eq("installment_id", id).order("happened_on", { ascending: false }).order("created_at", { ascending: false }).limit(1);
    alvo = ultimo?.[0]?.id ?? null;
  }
  if (alvo) await supabase.from("fin_entries").delete().eq("id", alvo).eq("installment_id", id);
  await supabase.from("fin_installments").update({ paid_count: p.paid_count - 1 }).eq("id", id);
  atualizar();
}

/** Corrigir um parcelamento (nome, valores, quantas pagas, datas) */
export async function salvarParcelamento(id: string, d: DadosParcelamento): Promise<{ ok: boolean; erro?: string }> {
  if (!ehId(id)) return { ok: false };
  const title = d.title.trim().slice(0, 120);
  const n = Math.round(d.installments);
  if (!title) return { ok: false, erro: "Dê um nome." };
  if (!(d.total > 0)) return { ok: false, erro: "Valor total inválido." };
  if (!(n >= 1 && n <= 120)) return { ok: false, erro: "De 1 a 120 parcelas." };
  if (!DATA.test(d.first_due)) return { ok: false, erro: "Data da primeira parcela inválida." };
  const supabase = await createClient();
  const { error } = await supabase.from("fin_installments").update({
    title, category: d.category.trim().slice(0, 40) || "Compras", total: Math.round(d.total * 100) / 100, installments: n,
    paid_count: Math.max(0, Math.min(n, Math.round(d.paid_count) || 0)), first_due: d.first_due, creditor: d.creditor?.trim().slice(0, 60) || null,
  }).eq("id", id);
  if (error) return { ok: false, erro: "Não foi possível guardar." };
  atualizar();
  return { ok: true };
}

/** Editar um lançamento na tabela (como numa planilha) */
export async function editarLancamento(id: string, d: { kind: DadosLancamento["kind"]; amount: number; description: string; category: string; happened_on: string; paid: boolean; investment_id?: string | null }): Promise<{ ok: boolean; erro?: string }> {
  if (!ehId(id)) return { ok: false };
  const description = d.description.trim().slice(0, 120);
  if (!description) return { ok: false, erro: "Descrição vazia." };
  if (!(d.amount > 0)) return { ok: false, erro: "Valor inválido." };
  if (!DATA.test(d.happened_on)) return { ok: false, erro: "Data inválida." };
  const t = tipoLancamento(d.kind, d.investment_id);
  if ("erro" in t) return { ok: false, erro: t.erro };
  const transferencia = t.kind === "aporte" || t.kind === "resgate";
  const supabase = await createClient();
  const { error } = await supabase.from("fin_entries").update({
    kind: tipoNoBanco(t.kind), investment_id: t.investment_id, amount: Math.round(d.amount * 100) / 100, description,
    category: transferencia ? "Investimentos" : d.category.trim().slice(0, 40) || "Outros", happened_on: d.happened_on, paid: transferencia ? true : !!d.paid,
  }).eq("id", id);
  if (error) return { ok: false, erro: "Não foi possível guardar." };
  atualizar();
  return { ok: true };
}

export async function apagarParcelamento(id: string) {
  await apagarPorId("fin_installments", id);
}

export type DadosInvestimento = { name: string; kind: string; institution: string | null; balance: number; monthly_rate: number | null; monthly_plan: number | null };

export async function criarInvestimento(d: DadosInvestimento): Promise<{ ok: boolean; erro?: string }> {
  const name = d.name.trim().slice(0, 80);
  if (!name) return { ok: false, erro: "Dê um nome (ex.: Caixinha Nubank)." };
  if (!(d.balance >= 0)) return { ok: false, erro: "Saldo inválido." };
  const supabase = await createClient();
  const { error } = await supabase.from("fin_investments").insert({
    name, kind: Object.hasOwn(TIPOS_INVESTIMENTO, d.kind) ? d.kind : "outro", institution: d.institution?.trim().slice(0, 60) || null,
    balance: Math.round(d.balance * 100) / 100, balance_on: hojeISO(),
    monthly_rate: d.monthly_rate && d.monthly_rate > 0 && d.monthly_rate <= 0.2 ? d.monthly_rate : null,
    monthly_plan: d.monthly_plan && d.monthly_plan > 0 ? Math.round(d.monthly_plan * 100) / 100 : null,
  });
  if (error) return { ok: false, erro: "Não foi possível guardar." };
  atualizar();
  return { ok: true };
}

/** Saldo de hoje (olhou no app do banco): passa a valer daqui para frente */
export async function atualizarSaldoInvestimento(id: string, saldo: number, taxa?: number | null, plano?: number | null) {
  if (!ehId(id) || !(saldo >= 0)) return;
  const supabase = await createClient();
  await supabase.from("fin_investments").update({
    balance: Math.round(saldo * 100) / 100, balance_on: hojeISO(),
    ...(taxa !== undefined ? { monthly_rate: taxa && taxa > 0 && taxa <= 0.2 ? taxa : null } : {}),
    ...(plano !== undefined ? { monthly_plan: plano && plano > 0 ? Math.round(plano * 100) / 100 : null } : {}),
  }).eq("id", id);
  atualizar();
}

/** Na aba Investimentos: investir e resgatar viram lançamentos (a base de tudo); rendimento fica só no investimento */
export async function movimentarInvestimento(id: string, kind: "aporte" | "resgate" | "rendimento", valor: number, dia: string): Promise<{ ok: boolean; erro?: string; id?: string; origem?: "lancamento" | "rendimento" }> {
  if (!ehId(id)) return { ok: false };
  if (!["aporte", "resgate", "rendimento"].includes(kind)) return { ok: false, erro: "Escolha o tipo." };
  if (!(valor > 0)) return { ok: false, erro: "Informe o valor." };
  if (!DATA.test(dia) || dia > hojeISO()) return { ok: false, erro: "Data inválida." };
  const supabase = await createClient();
  if (kind !== "rendimento") {
    const { data: inv } = await supabase.from("fin_investments").select("name").eq("id", id).single();
    const r = await lancar({ kind, amount: valor, description: `${kind === "aporte" ? "Investi" : "Resgatei"} · ${inv?.name ?? "investimento"}`, category: "Investimentos", happened_on: dia, paid: true, context_id: null, investment_id: id });
    return { ...r, origem: "lancamento" };
  }
  const { data, error } = await supabase.from("fin_inv_moves").insert({ investment_id: id, kind, amount: Math.round(valor * 100) / 100, happened_on: dia }).select("id").single();
  if (error || !data) return { ok: false, erro: "Não foi possível guardar." };
  atualizar();
  return { ok: true, id: data.id, origem: "rendimento" };
}

export async function apagarMovimento(id: string) {
  await apagarPorId("fin_inv_moves", id);
}

export async function apagarInvestimento(id: string) {
  await apagarPorId("fin_investments", id);
}

// ---------- saúde ----------

export type DadosRemedio = { title: string; dose: string; horarios: string[]; ends_on: string | null; context_id: string | null };

/** Remédio novo: uma rotina diária por horário, com a dose (aparece no Hoje em cada horário) */
export async function criarRemedio(d: DadosRemedio): Promise<{ ok: boolean; erro?: string }> {
  const title = d.title.trim().slice(0, 120);
  const dose = d.dose.trim().slice(0, 80);
  if (!title) return { ok: false, erro: "Qual remédio?" };
  if (!dose) return { ok: false, erro: "Qual a dose? Ex.: 50 mg, 1 comprimido." };
  const horarios = [...new Set(d.horarios.filter((h) => HORA.test(h)).map((h) => h.slice(0, 5)))].sort();
  if (d.ends_on && (!DATA.test(d.ends_on) || d.ends_on < hojeISO())) return { ok: false, erro: "A data de fim já passou." };
  const supabase = await createClient();
  const { count } = await supabase.from("routines").select("id", { count: "exact", head: true });
  const base = { title, dose, ends_on: d.ends_on || null, context_id: d.context_id || null, days: [0, 1, 2, 3, 4, 5, 6] };
  const linhas = (horarios.length ? horarios : [null]).map((h, i) => ({ ...base, at_time: h, position: (count ?? 0) + i }));
  const { error } = await supabase.from("routines").insert(linhas);
  if (error) return { ok: false, erro: "Não foi possível guardar o remédio." };
  atualizar();
  return { ok: true };
}

/** Parar (ou voltar a tomar) um remédio: todos os horários juntos */
export async function pausarRemedio(ids: string[], parar: boolean) {
  const supabase = await createClient();
  await supabase.from("routines").update({ status: parar ? "pausada" : "ativa" }).in("id", ids.filter(ehId));
  atualizar();
}

export async function apagarRemedio(ids: string[]) {
  const supabase = await createClient();
  await supabase.from("routines").delete().in("id", ids.filter(ehId));
  atualizar();
}

export type DadosMedida = { kind: TipoMedida; value: number; value2: number | null; label: string | null; measured_on: string; note: string | null };

export async function registrarMedida(d: DadosMedida): Promise<{ ok: boolean; erro?: string; id?: string }> {
  if (!Object.hasOwn(MEDIDAS, d.kind)) return { ok: false, erro: "Escolha a medida." };
  if (!Number.isFinite(d.value) || d.value <= 0 || d.value >= 100000) return { ok: false, erro: "Valor inválido." };
  if (d.kind === "pressao" && (!d.value2 || d.value2 <= 0 || d.value2 >= 1000)) return { ok: false, erro: "Escreva a pressão assim: 120/80." };
  if (d.kind === "outro" && !d.label?.trim()) return { ok: false, erro: "Dê um nome à medida." };
  if (!DATA.test(d.measured_on) || d.measured_on > hojeISO()) return { ok: false, erro: "Data inválida." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("health_measures")
    .insert({ kind: d.kind, value: d.value, value2: d.kind === "pressao" ? d.value2 : null, label: d.kind === "outro" ? d.label!.trim().slice(0, 60) : null, measured_on: d.measured_on, note: d.note?.trim().slice(0, 300) || null })
    .select("id")
    .single();
  if (error) return { ok: false, erro: "Não foi possível guardar a medida." };
  atualizar();
  return { ok: true, id: data.id };
}

export async function apagarMedida(id: string) {
  await apagarPorId("health_measures", id);
}

/* Notificações no celular (web push): o aparelho guarda a inscrição; o envio é da função "avisos" do Supabase */
export async function salvarInscricao(s: { endpoint: string; p256dh: string; auth: string }) {
  if (!/^https:\/\//.test(s.endpoint) || !s.p256dh || !s.auth) return { ok: false };
  const supabase = await createClient();
  const { error } = await supabase.from("push_subscriptions").upsert({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth }, { onConflict: "endpoint" });
  return { ok: !error };
}

export async function apagarInscricao(endpoint: string) {
  const supabase = await createClient();
  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
}

export async function testarAviso(): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { ok: false };
  const r = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/avisos`, { method: "POST", headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" }, body: "{}" }).catch(() => null);
  return { ok: !!r?.ok };
}

/* Estudos: questões resolvidas e simulados */
export type DadosQuestoes = { course_id: string; subject_id: string | null; topic_id: string | null; done_on: string; total: number; correct: number; note: string | null };

export async function registrarQuestoes(d: DadosQuestoes): Promise<{ ok: boolean; erro?: string; id?: string }> {
  if (!ehId(d.course_id) || (d.subject_id && !ehId(d.subject_id)) || (d.topic_id && !ehId(d.topic_id))) return { ok: false, erro: "Escolha a matéria." };
  if (!Number.isInteger(d.total) || d.total < 1 || d.total > 2000) return { ok: false, erro: "Quantos exercícios você fez?" };
  if (!Number.isInteger(d.correct) || d.correct < 0 || d.correct > d.total) return { ok: false, erro: "Os acertos passam do total." };
  if (!DATA.test(d.done_on) || d.done_on > hojeISO()) return { ok: false, erro: "Escolha um dia até hoje." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("study_questions").insert({ ...d, note: d.note?.trim().slice(0, 500) || null }).select("id").single();
  if (error) return { ok: false, erro: "Não foi possível guardar." };
  atualizar();
  return { ok: true, id: data.id };
}

export async function apagarQuestoes(id: string) {
  await apagarPorId("study_questions", id);
}

export type DadosSimulado = { course_id: string; title: string; done_on: string; total: number; correct: number; minutes: number | null; note: string | null };

export async function registrarSimulado(d: DadosSimulado): Promise<{ ok: boolean; erro?: string; id?: string }> {
  if (!ehId(d.course_id)) return { ok: false };
  const title = d.title.trim().slice(0, 120);
  if (!title) return { ok: false, erro: "Dê um nome à prova." };
  if (!(d.total >= 1 && d.total <= 2000)) return { ok: false, erro: "Qual é a nota máxima?" };
  if (!(d.correct >= 0 && d.correct <= d.total)) return { ok: false, erro: "A nota passa da máxima." };
  if (!DATA.test(d.done_on) || d.done_on > hojeISO()) return { ok: false, erro: "Escolha um dia até hoje." };
  const minutes = d.minutes && d.minutes > 0 && d.minutes <= 1440 ? Math.round(d.minutes) : null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("study_mocks").insert({ course_id: d.course_id, title, done_on: d.done_on, total: Math.round(d.total * 100) / 100, correct: Math.round(d.correct * 100) / 100, minutes, note: d.note?.trim().slice(0, 1000) || null }).select("id").single();
  if (error) return { ok: false, erro: "Não foi possível guardar." };
  atualizar();
  return { ok: true, id: data.id };
}

export async function apagarSimulado(id: string) {
  await apagarPorId("study_mocks", id);
}

/* Ajustes: áreas escondidas da lateral e a chave do atalho da Siri */
const AREAS = ["negocios", "estudos", "financas", "saude", "rotinas", "rotas", "notas"];

export async function salvarAreasEscondidas(escondidas: string[]) {
  const supabase = await createClient();
  await supabase.from("profiles").update({ hidden_areas: escondidas.filter((a) => AREAS.includes(a)) }).not("user_id", "is", null);
  atualizar();
}

export async function gerarChaveAtalho(): Promise<{ chave: string | null }> {
  const chave = (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, "").slice(0, 40);
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ capture_token: chave }).not("user_id", "is", null);
  atualizar();
  return { chave: error ? null : chave };
}

export async function salvarAgendaExterna(url: string): Promise<{ ok: boolean; erro?: string }> {
  const u = url.trim();
  if (u && (!/^https:\/\/\S+$/.test(u) || u.length > 1000)) return { ok: false, erro: "Cole o endereço que começa com https://" };
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ ical_url: u || null }).not("user_id", "is", null);
  atualizar();
  return { ok: !error };
}
