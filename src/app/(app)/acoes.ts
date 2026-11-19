"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { lerCaptura } from "@/lib/captura";
import { hojeISO, somarDias, somarDiasUteis } from "@/lib/datas";
import { ESCOLHAS, type ChaveEscolha } from "@/lib/modulos";
import { CAMPOS_ROTA, chegadaPorPrazo, normalizar, PREFIXO_PASSO, resumirRota, type TipoRota } from "@/lib/rotas";
import { CORES_CONTEXTO, proximaCor, type Estado } from "@/lib/tipos";
import { CORES_MATERIA, TIPOS_CURSO, type TipoCurso } from "@/lib/estudos";

function atualizar() {
  revalidatePath("/", "layout");
}

const DATA = /^\d{4}-\d{2}-\d{2}$/;
const HORA = /^\d{2}:\d{2}(:\d{2})?$/;
const texto = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.trim() : "");

// ---------- captura ----------

export type ResultadoCaptura =
  | { ok: true; id: string; title: string; due_date: string | null; due_time: string | null; contexto: string | null }
  | { ok: false; erro: string };

export async function capturar(bruto: string): Promise<ResultadoCaptura> {
  const original = bruto.trim();
  if (!original) return { ok: false, erro: "Escreva algo para guardar." };
  if (original.length > 1000) return { ok: false, erro: "Texto longo demais para uma captura." };

  const supabase = await createClient();
  const { data: contextos } = await supabase.from("contexts").select("id, name").eq("archived", false).order("position");
  const leitura = lerCaptura(original, contextos ?? [], hojeISO());

  const { data, error } = await supabase
    .from("responsibilities")
    .insert({
      title: leitura.title,
      due_date: leitura.due_date,
      due_time: leitura.due_time,
      context_id: leitura.context_id,
      kind: leitura.kind,
      source: "captura",
      raw_capture: original,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, erro: "Não foi possível guardar. Tente de novo." };

  atualizar();
  return {
    ok: true,
    id: data.id,
    title: leitura.title,
    due_date: leitura.due_date,
    due_time: leitura.due_time,
    contexto: contextos?.find((c) => c.id === leitura.context_id)?.name ?? null,
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

export async function criarContextosSugeridos() {
  const supabase = await createClient();
  const { count } = await supabase.from("contexts").select("id", { count: "exact", head: true });
  if (count) return;
  await supabase.from("contexts").insert([
    { name: "Iter Mídia", kind: "empresa", color: CORES_CONTEXTO[0].cor, position: 0 },
    { name: "Rumo", kind: "empresa", color: CORES_CONTEXTO[3].cor, position: 1 },
    { name: "Casa", kind: "area", color: CORES_CONTEXTO[2].cor, position: 2 },
  ]);
  atualizar();
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

export async function apagarContexto(id: string) {
  const supabase = await createClient();
  // As responsabilidades do contexto voltam para a Inbox (on delete set null)
  await supabase.from("contexts").delete().eq("id", id);
  atualizar();
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
  const dia = new Date(`${hoje}T12:00:00Z`).getUTCDay();
  const depois = para === "amanha" ? somarDias(hoje, 1) : somarDias(hoje, ((8 - dia) % 7) || 7);
  const campo = data.state === "aguardando" ? "follow_up_on" : "due_date";
  await supabase.from("responsibilities").update({ [campo]: depois }).eq("id", id);
  atualizar();
  return { campo, antes: (data[campo] as string | null) ?? null, depois };
}

export async function restaurarData(id: string, campo: "due_date" | "follow_up_on", valor: string | null) {
  const supabase = await createClient();
  await supabase.from("responsibilities").update({ [campo]: valor }).eq("id", id);
  atualizar();
}

// ---------- perfil e perguntas do começo ----------

export type DadosComeco = {
  nome: string;
  escolhas: ChaveEscolha[];
  respostas: Partial<Record<ChaveEscolha, string[]>>;
};

/** Grava tudo de uma vez: perfil, contextos e projetos. Não duplica o que já existe (compara pelo nome). */
export async function salvarComeco(dados: DadosComeco): Promise<{ ok: boolean; erro?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, erro: "Sua sessão terminou. Entre de novo." };

  const nome = dados.nome.trim().slice(0, 60);
  const escolhas = ESCOLHAS.filter((e) => dados.escolhas.includes(e.chave));
  const limpar = (lista?: string[]) => [...new Set((lista ?? []).map((v) => v.trim()).filter(Boolean).map((v) => v.slice(0, 60)))];

  const [{ data: contextos }, { data: projetos }] = await Promise.all([
    supabase.from("contexts").select("name, color, position"),
    supabase.from("projects").select("name"),
  ]);
  const existe = (lista: { name: string }[] | null, n: string) => (lista ?? []).some((c) => c.name.toLowerCase() === n.toLowerCase());
  const cores = (contextos ?? []).map((c) => c.color);
  let posicao = Math.max(-1, ...(contextos ?? []).map((c) => c.position)) + 1;

  const novosContextos: { name: string; kind: "empresa" | "area"; color: string; position: number }[] = [];
  const novosProjetos: { name: string }[] = [];
  const addContexto = (name: string, kind: "empresa" | "area") => {
    if (existe(contextos, name) || novosContextos.some((c) => c.name.toLowerCase() === name.toLowerCase())) return;
    const color = proximaCor([...cores, ...novosContextos.map((c) => c.color)]);
    novosContextos.push({ name, kind, color, position: posicao++ });
  };

  for (const e of escolhas) {
    const resp = limpar(dados.respostas[e.chave]);
    if (e.cria === "trabalho") addContexto("Trabalho", "area");
    if (e.cria === "contexto-area") resp.forEach((r) => addContexto(r, "area"));
    if (e.cria === "contexto-empresa") resp.forEach((r) => addContexto(r, "empresa"));
    if (e.cria === "projeto") resp.forEach((r) => { if (!existe(projetos, r) && !novosProjetos.some((p) => p.name === r)) novosProjetos.push({ name: r }); });
  }

  const modules = [...new Set(escolhas.map((e) => e.modulo).filter((m): m is NonNullable<typeof m> => !!m))];
  const onboarding = {
    escolhas: escolhas.map((e) => e.chave),
    trabalho_origens: limpar(dados.respostas.trabalho),
    vida: limpar(dados.respostas.vida),
    negocios: limpar(dados.respostas.negocios),
    projetos: limpar(dados.respostas.projetos),
    estudos: limpar(dados.respostas.estudos),
    rotinas: limpar(dados.respostas.rotinas),
    objetivo: limpar(dados.respostas.objetivos)[0] ?? null,
  };

  if (novosContextos.length) {
    const { error } = await supabase.from("contexts").insert(novosContextos);
    if (error) return { ok: false, erro: "Não foi possível criar os contextos. Tente de novo." };
  }
  if (novosProjetos.length) {
    const { error } = await supabase.from("projects").insert(novosProjetos);
    if (error) return { ok: false, erro: "Não foi possível criar os projetos. Tente de novo." };
  }
  const { error } = await supabase
    .from("profiles")
    .upsert({ user_id: user.id, display_name: nome || null, modules, onboarding, onboarded_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) return { ok: false, erro: "Não foi possível salvar. Tente de novo." };

  atualizar();
  return { ok: true };
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

/** Junta data e hora de São Paulo num instante (Brasil sem horário de verão: -03:00) */
function instante(data: string, hora: string) {
  return new Date(`${data}T${hora.slice(0, 5)}:00-03:00`).toISOString();
}

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
  const [{ data: projeto }, { data: contextos }] = await Promise.all([
    supabase.from("projects").select("id, context_id").eq("id", projetoId).single(),
    supabase.from("contexts").select("id, name").eq("archived", false).order("position"),
  ]);
  if (!projeto) return { ok: false, erro: "Este projeto não existe mais." };
  const leitura = lerCaptura(original, contextos ?? [], hojeISO());
  const { error } = await supabase.from("responsibilities").insert({
    title: leitura.title,
    due_date: leitura.due_date,
    due_time: leitura.due_time,
    context_id: leitura.context_id ?? projeto.context_id,
    project_id: projeto.id,
    kind: leitura.kind,
    source: "captura",
    raw_capture: original,
  });
  if (error) return { ok: false, erro: "Não foi possível guardar a etapa." };
  atualizar();
  return { ok: true };
}

// ---------- busca ----------

export type Achado = { tipo: "responsabilidade" | "projeto" | "rota" | "curso" | "contexto" | "compromisso" | "pessoa"; id: string; titulo: string; detalhe: string; href: string; cor?: string };

export async function buscar(termo: string): Promise<Achado[]> {
  const q = termo.trim().replace(/[%,()]/g, " ").replace(/\s+/g, " ").slice(0, 80);
  if (q.length < 2) return [];
  const like = `%${q}%`;
  const supabase = await createClient();
  const [r, p, c, e, g, ctxs, rt, cs, ms] = await Promise.all([
    supabase.from("responsibilities").select("id, title, note, state, context_id, waiting_note").or(`title.ilike.${like},note.ilike.${like},waiting_note.ilike.${like}`).order("updated_at", { ascending: false }).limit(20),
    supabase.from("projects").select("id, name, note, context_id").or(`name.ilike.${like},note.ilike.${like}`).limit(8),
    supabase.from("contexts").select("id, name, color").ilike("name", like).limit(8),
    supabase.from("events").select("id, title, starts_at, context_id").or(`title.ilike.${like},location.ilike.${like},note.ilike.${like}`).order("starts_at", { ascending: false }).limit(8),
    supabase.from("people").select("id, name").ilike("name", like).limit(8),
    supabase.from("contexts").select("id, name, color"),
    supabase.from("routes").select("id, title, kind, context_id").or(`title.ilike.${like},note.ilike.${like}`).limit(8),
    supabase.from("study_courses").select("id, title, kind, context_id").or(`title.ilike.${like},note.ilike.${like}`).limit(8),
    supabase.from("study_subjects").select("id, title, course_id, next_topic").or(`title.ilike.${like},next_topic.ilike.${like}`).limit(8),
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
    achados.push({ tipo: "curso", id: x.id, titulo: x.title, detalhe: `Matéria${curso ? ` · ${curso.title}` : ""}${x.next_topic ? ` · próxima: ${x.next_topic}` : ""}`, href: `/estudos/${x.course_id}` });
  }
  for (const x of c.data ?? []) achados.push({ tipo: "contexto", id: x.id, titulo: x.name, detalhe: "Contexto", href: `/contexto/${x.id}`, cor: x.color });
  for (const x of e.data ?? []) {
    const ctx = nomeCtx(x.context_id);
    const dia = hojeISO(new Date(x.starts_at));
    achados.push({ tipo: "compromisso", id: x.id, titulo: x.title, detalhe: `Compromisso · ${dia.split("-").reverse().slice(0, 2).join("/")}${ctx ? ` · ${ctx.name}` : ""}`, href: `/calendario/${x.id}`, cor: ctx?.color });
  }
  for (const x of g.data ?? []) achados.push({ tipo: "pessoa", id: x.id, titulo: x.name, detalhe: "Pessoa", href: `/busca?q=${encodeURIComponent(x.name)}` });
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
  if (!["financeiro", "leitura", "estudos", "negocios"].includes(d.kind)) return { ok: false, erro: "Tipo de Rota desconhecido." };
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
    const n = Number(alvo.replace(/\./g, "").replace(",", "."));
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
export async function registrarAvanco(routeId: string, quantia: number, nota?: string): Promise<{ ok: boolean; erro?: string; entradaId?: string }> {
  if (!Number.isFinite(quantia) || quantia === 0) return { ok: false, erro: "Informe quanto avançou." };
  const supabase = await createClient();
  const { data: rota } = await supabase.from("routes").select("current").eq("id", routeId).single();
  if (!rota) return { ok: false, erro: "Esta Rota não existe mais." };
  const { data: entrada, error } = await supabase.from("route_entries").insert({ route_id: routeId, amount: quantia, note: nota?.trim().slice(0, 200) || null, happened_on: hojeISO() }).select("id").single();
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
  const [{ data: rota }, { data: contextos }] = await Promise.all([
    supabase.from("routes").select("id, context_id").eq("id", routeId).single(),
    supabase.from("contexts").select("id, name").eq("archived", false).order("position"),
  ]);
  if (!rota) return { ok: false, erro: "Esta Rota não existe mais." };
  const leitura = lerCaptura(original, contextos ?? [], hojeISO());
  const { error } = await supabase.from("responsibilities").insert({
    title: leitura.title, due_date: leitura.due_date, due_time: leitura.due_time, kind: leitura.kind,
    context_id: leitura.context_id ?? rota.context_id, route_id: rota.id, milestone_id: marcoId || null,
    source: "captura", raw_capture: original,
  });
  if (error) return { ok: false, erro: "Não foi possível guardar o passo." };
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
  const supabase = await createClient();
  await supabase.from("route_milestones").delete().eq("id", id);
  atualizar();
}

// ---------- estudos (Book 6.2) ----------
// As sessões são compromissos do Core (events com course_id): aparecem no calendário, no Hoje e no Próximo passo.

export type DadosCurso = {
  title: string;
  kind: TipoCurso;
  context_id: string | null;
  total_lessons: number | null;
  done_lessons: number;
  cycles: number | null;
  current_cycle: number;
  weekly_minutes: number | null;
  exam_date: string | null;
  exam_label: string | null;
  materias: string[];
};

const TIPOS_DE_CURSO = ["graduacao", "pos", "idioma", "concurso", "curso"];
const inteiro = (v: unknown, min = 0) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= min ? n : null;
};

export async function criarCurso(d: DadosCurso): Promise<{ ok: boolean; erro?: string; id?: string }> {
  const title = d.title.trim().slice(0, 120);
  if (!title) return { ok: false, erro: "Dê um nome ao curso." };
  if (!TIPOS_DE_CURSO.includes(d.kind)) return { ok: false, erro: "Tipo de curso desconhecido." };
  if (d.exam_date && !DATA.test(d.exam_date)) return { ok: false, erro: "Data da prova inválida." };
  const total = inteiro(d.total_lessons, 1);
  const cycles = inteiro(d.cycles, 1);
  const supabase = await createClient();
  const { data: curso, error } = await supabase
    .from("study_courses")
    .insert({
      title,
      kind: d.kind,
      context_id: d.context_id || null,
      total_lessons: total,
      done_lessons: Math.min(inteiro(d.done_lessons) ?? 0, total ?? Infinity),
      cycles,
      current_cycle: Math.min(inteiro(d.current_cycle, 1) ?? 1, cycles ?? Infinity),
      cycle_started_on: hojeISO(),
      weekly_minutes: inteiro(d.weekly_minutes, 1),
      exam_date: d.exam_date || null,
      exam_label: d.exam_label?.trim().slice(0, 60) || null,
    })
    .select("id, current_cycle")
    .single();
  if (error || !curso) return { ok: false, erro: "Não foi possível criar o curso." };
  const materias = d.materias.map((m) => m.trim()).filter(Boolean).slice(0, 20);
  if (materias.length) {
    await supabase.from("study_subjects").insert(
      materias.map((t, i) => ({ course_id: curso.id, title: t.slice(0, 120), cycle: curso.current_cycle, position: i, color: CORES_MATERIA[i % CORES_MATERIA.length] })),
    );
  }
  atualizar();
  return { ok: true, id: curso.id };
}

export async function salvarCurso(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const id = texto(form.get("id"));
  const title = texto(form.get("title")).slice(0, 120);
  if (!title) return { erro: "Dê um nome ao curso." };
  const exam = texto(form.get("exam_date"));
  if (exam && !DATA.test(exam)) return { erro: "Data da prova inválida." };
  const status = texto(form.get("status"));
  const horasSemana = Number(texto(form.get("weekly_hours")).replace(",", "."));
  const supabase = await createClient();
  const { error } = await supabase
    .from("study_courses")
    .update({
      title,
      kind: TIPOS_DE_CURSO.includes(texto(form.get("kind"))) ? texto(form.get("kind")) : "curso",
      context_id: texto(form.get("context_id")) || null,
      total_lessons: inteiro(texto(form.get("total_lessons")) || null, 1),
      cycles: inteiro(texto(form.get("cycles")) || null, 1),
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

export async function adicionarMateria(courseId: string, titulo: string): Promise<{ ok: boolean; erro?: string }> {
  const title = titulo.trim().slice(0, 120);
  if (!title) return { ok: false, erro: "Dê um nome à matéria." };
  const supabase = await createClient();
  const [{ data: curso }, { data: existentes }] = await Promise.all([
    supabase.from("study_courses").select("current_cycle").eq("id", courseId).single(),
    supabase.from("study_subjects").select("id").eq("course_id", courseId),
  ]);
  if (!curso) return { ok: false, erro: "Este curso não existe mais." };
  const n = existentes?.length ?? 0;
  const { error } = await supabase.from("study_subjects").insert({ course_id: courseId, title, cycle: curso.current_cycle, position: n, color: CORES_MATERIA[n % CORES_MATERIA.length] });
  if (error) return { ok: false, erro: "Não foi possível adicionar." };
  atualizar();
  return { ok: true };
}

export async function salvarMateria(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const id = texto(form.get("id"));
  const title = texto(form.get("title")).slice(0, 120);
  if (!title) return { erro: "Dê um nome à matéria." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("study_subjects")
    .update({
      title,
      next_topic: texto(form.get("next_topic")).slice(0, 120) || null,
      total_lessons: inteiro(texto(form.get("total_lessons")) || null, 1),
      cycle: inteiro(texto(form.get("cycle")) || null, 1),
    })
    .eq("id", id);
  if (error) return { erro: "Não foi possível salvar." };
  atualizar();
  return { ok: true, em: Date.now() };
}

export async function apagarMateria(id: string) {
  const supabase = await createClient();
  await supabase.from("study_subjects").delete().eq("id", id);
  atualizar();
}

/** +1 ou −1 aula: na matéria, no curso e nas Rotas de estudos ligadas ao curso */
export async function registrarAula(courseId: string, subjectId: string | null, delta: 1 | -1 = 1): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const [{ data: curso }, { data: materia }, { data: rotas }] = await Promise.all([
    supabase.from("study_courses").select("done_lessons, total_lessons").eq("id", courseId).single(),
    subjectId ? supabase.from("study_subjects").select("title, done_lessons").eq("id", subjectId).single() : Promise.resolve({ data: null }),
    supabase.from("routes").select("id, current, target").eq("course_id", courseId).eq("kind", "estudos").eq("status", "ativa"),
  ]);
  if (!curso) return { ok: false };
  const novo = Math.max(0, curso.done_lessons + delta);
  await supabase.from("study_courses").update({ done_lessons: novo }).eq("id", courseId);
  if (materia && subjectId) await supabase.from("study_subjects").update({ done_lessons: Math.max(0, materia.done_lessons + delta) }).eq("id", subjectId);
  for (const r of rotas ?? []) {
    await supabase.from("routes").update({ current: Math.max(0, Number(r.current) + delta) }).eq("id", r.id);
    await supabase.from("route_entries").insert({ route_id: r.id, amount: delta, note: materia ? `Aula de ${materia.title}` : "Aula", happened_on: hojeISO() });
  }
  atualizar();
  return { ok: true };
}

/** Marca uma sessão de estudo no calendário (vira compromisso do Core) */
export async function agendarSessao(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const courseId = texto(form.get("course_id"));
  const subjectId = texto(form.get("subject_id")) || null;
  const data = texto(form.get("data"));
  const inicio = texto(form.get("inicio"));
  const minutos = inteiro(texto(form.get("minutos")), 5) ?? 50;
  if (!DATA.test(data)) return { erro: "Escolha o dia." };
  if (!HORA.test(inicio)) return { erro: "Escolha a hora." };
  const supabase = await createClient();
  const [{ data: curso }, { data: materia }] = await Promise.all([
    supabase.from("study_courses").select("title, context_id").eq("id", courseId).single(),
    subjectId ? supabase.from("study_subjects").select("title, next_topic").eq("id", subjectId).single() : Promise.resolve({ data: null }),
  ]);
  if (!curso) return { erro: "Este curso não existe mais." };
  const comeca = instante(data, inicio);
  const { error } = await supabase.from("events").insert({
    title: tituloSessao(curso.title, materia),
    context_id: curso.context_id,
    course_id: courseId,
    subject_id: subjectId,
    starts_at: comeca,
    ends_at: new Date(new Date(comeca).getTime() + Math.min(minutos, 600) * 60000).toISOString(),
  });
  if (error) return { erro: "Não foi possível marcar a sessão." };
  atualizar();
  return { ok: true, em: Date.now() };
}

/** "Começar sessão": abre uma sessão agora (50 min por padrão) */
export async function comecarSessao(courseId: string, subjectId: string | null, minutos = 50): Promise<{ ok: boolean; id?: string }> {
  const supabase = await createClient();
  const [{ data: curso }, { data: materia }] = await Promise.all([
    supabase.from("study_courses").select("title, context_id").eq("id", courseId).single(),
    subjectId ? supabase.from("study_subjects").select("title, next_topic").eq("id", subjectId).single() : Promise.resolve({ data: null }),
  ]);
  if (!curso) return { ok: false };
  const agora = new Date();
  agora.setSeconds(0, 0);
  const { data, error } = await supabase
    .from("events")
    .insert({ title: tituloSessao(curso.title, materia), context_id: curso.context_id, course_id: courseId, subject_id: subjectId, starts_at: agora.toISOString(), ends_at: new Date(agora.getTime() + minutos * 60000).toISOString() })
    .select("id")
    .single();
  if (error || !data) return { ok: false };
  atualizar();
  return { ok: true, id: data.id };
}

/** Concluir a sessão conta o tempo da semana; com matéria, conta também uma aula.
 *  Concluída antes do fim marcado, o fim passa a ser agora (conta só o tempo estudado); o desfazer devolve o fim. */
export async function concluirSessao(id: string, feita: boolean, contarAula: boolean, fimAntes?: string | null): Promise<{ ok: boolean; fimAntes?: string | null }> {
  const supabase = await createClient();
  const { data: s } = await supabase.from("events").select("course_id, subject_id, starts_at, ends_at").eq("id", id).single();
  if (!s?.course_id) return { ok: false };
  const agora = Date.now();
  const mudanca: Record<string, string | null> = { done_at: feita ? new Date(agora).toISOString() : null };
  const ini = new Date(s.starts_at).getTime();
  if (feita && s.ends_at && agora > ini && agora < new Date(s.ends_at).getTime()) mudanca.ends_at = new Date(Math.max(agora, ini + 5 * 60000)).toISOString();
  if (!feita && fimAntes !== undefined) mudanca.ends_at = fimAntes;
  await supabase.from("events").update(mudanca).eq("id", id);
  if (contarAula) await registrarAula(s.course_id, s.subject_id, feita ? 1 : -1);
  atualizar();
  return { ok: true, fimAntes: s.ends_at };
}

export async function avancarCiclo(courseId: string, direcao: 1 | -1 = 1): Promise<{ ok: boolean; antes?: { ciclo: number; inicio: string } }> {
  const supabase = await createClient();
  const { data: c } = await supabase.from("study_courses").select("current_cycle, cycles, cycle_started_on").eq("id", courseId).single();
  if (!c) return { ok: false };
  const novo = Math.max(1, c.current_cycle + direcao);
  if (c.cycles && novo > c.cycles) return { ok: false };
  await supabase.from("study_courses").update({ current_cycle: novo, cycle_started_on: hojeISO() }).eq("id", courseId);
  atualizar();
  return { ok: true, antes: { ciclo: c.current_cycle, inicio: c.cycle_started_on } };
}

export async function restaurarCiclo(courseId: string, ciclo: number, inicio: string) {
  const supabase = await createClient();
  await supabase.from("study_courses").update({ current_cycle: ciclo, cycle_started_on: inicio }).eq("id", courseId);
  atualizar();
}

function tituloSessao(curso: string, materia: { title: string; next_topic: string | null } | null) {
  if (!materia) return `Estudo · ${curso}`.slice(0, 200);
  return `${materia.title}${materia.next_topic ? ` · ${materia.next_topic}` : ""}`.slice(0, 200);
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
  const supabase = await createClient();
  await supabase.from("events").delete().eq("id", id);
  atualizar();
}
