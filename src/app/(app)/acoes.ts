"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { lerCaptura } from "@/lib/captura";
import { diaDaSemana, ehId, hojeISO, instante, numeroBR, somarDias, somarDiasUteis } from "@/lib/datas";
import { ESCOLHAS, type ChaveEscolha } from "@/lib/modulos";
import { CAMPOS_ROTA, chegadaPorPrazo, normalizar, PREFIXO_PASSO, resumirRota, type TipoRota, TIPOS } from "@/lib/rotas";
import { CORES_CONTEXTO, proximaCor, type Estado } from "@/lib/tipos";
import { CORES_MATERIA, TIPOS_CURSO, type TipoCurso } from "@/lib/estudos";
import { textoFrequencia } from "@/lib/rotinas";

function atualizar() {
  revalidatePath("/", "layout");
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

export async function capturar(bruto: string): Promise<ResultadoCaptura> {
  const original = bruto.trim();
  if (!original) return { ok: false, erro: "Escreva algo para guardar." };
  if (original.length > 1000) return { ok: false, erro: "Texto longo demais para uma captura." };

  const { leitura, contextos, id } = await inserirCaptura(original);
  if (!id) return { ok: false, erro: "Não foi possível guardar. Tente de novo." };

  atualizar();
  return {
    ok: true,
    id,
    title: leitura.title,
    due_date: leitura.due_date,
    due_time: leitura.due_time,
    contexto: contextos.find((c) => c.id === leitura.context_id)?.name ?? null,
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
  const dia = diaDaSemana(hoje);
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
  const { data: projeto } = await supabase.from("projects").select("id, context_id").eq("id", projetoId).single();
  if (!projeto) return { ok: false, erro: "Este projeto não existe mais." };
  const { id } = await inserirCaptura(original, { project_id: projeto.id }, projeto.context_id);
  if (!id) return { ok: false, erro: "Não foi possível guardar a etapa." };
  atualizar();
  return { ok: true };
}

// ---------- busca ----------

export type Achado = { tipo: "responsabilidade" | "projeto" | "rota" | "curso" | "rotina" | "nota" | "contexto" | "compromisso" | "pessoa"; id: string; titulo: string; detalhe: string; href: string; cor?: string };

export async function buscar(termo: string): Promise<Achado[]> {
  const q = termo.trim().replace(/[%,()]/g, " ").replace(/\s+/g, " ").slice(0, 80);
  if (q.length < 2) return [];
  const like = `%${q}%`;
  const supabase = await createClient();
  const [r, p, c, e, g, ctxs, rt, cs, ms, rn, nt] = await Promise.all([
    supabase.from("responsibilities").select("id, title, note, state, context_id, waiting_note").or(`title.ilike.${like},note.ilike.${like},waiting_note.ilike.${like}`).order("updated_at", { ascending: false }).limit(20),
    supabase.from("projects").select("id, name, note, context_id").or(`name.ilike.${like},note.ilike.${like}`).limit(8),
    supabase.from("contexts").select("id, name, color").ilike("name", like).limit(8),
    supabase.from("events").select("id, title, starts_at, context_id").or(`title.ilike.${like},location.ilike.${like},note.ilike.${like}`).order("starts_at", { ascending: false }).limit(8),
    supabase.from("people").select("id, name").ilike("name", like).limit(8),
    supabase.from("contexts").select("id, name, color"),
    supabase.from("routes").select("id, title, kind, context_id").or(`title.ilike.${like},note.ilike.${like}`).limit(8),
    supabase.from("study_courses").select("id, title, kind, context_id").or(`title.ilike.${like},note.ilike.${like}`).limit(8),
    supabase.from("study_subjects").select("id, title, course_id").ilike("title", like).limit(8),
    supabase.from("routines").select("id, title, days, times_per_week, at_time").or(`title.ilike.${like},note.ilike.${like}`).limit(8),
    supabase.from("notes").select("id, kind, title, context_id").or(`title.ilike.${like},body.ilike.${like},why.ilike.${like}`).order("created_at", { ascending: false }).limit(8),
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
  const supabase = await createClient();
  await supabase.from("route_milestones").delete().eq("id", id);
  atualizar();
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
  const supabase = await createClient();
  await supabase.from("study_subjects").delete().eq("id", id);
  atualizar();
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
export async function adicionarTemas(subjectId: string, bruto: string): Promise<{ ok: boolean; erro?: string; n?: number }> {
  const linhas = bruto
    .split(/\n|;/)
    .map((l) => l.replace(/^\s*(?:[-•*·]|\d+(?:\.\d+)*[.)]?)\s*/, "").trim())
    .filter(Boolean)
    .slice(0, 200);
  if (!linhas.length) return { ok: false, erro: "Escreva ao menos um tema." };
  const supabase = await createClient();
  const { data: existentes } = await supabase.from("study_topics").select("position").eq("subject_id", subjectId);
  const base = Math.max(-1, ...(existentes ?? []).map((x) => x.position)) + 1;
  const { error } = await supabase.from("study_topics").insert(linhas.map((t, i) => ({ subject_id: subjectId, title: t.slice(0, 200), position: base + i })));
  if (error) return { ok: false, erro: "Não foi possível guardar os temas." };
  atualizar();
  return { ok: true, n: linhas.length };
}

export async function marcarTema(id: string, feito: boolean) {
  const supabase = await createClient();
  await supabase.from("study_topics").update({ done_at: feito ? new Date().toISOString() : null }).eq("id", id);
  atualizar();
}

export async function apagarTema(id: string) {
  const supabase = await createClient();
  await supabase.from("study_topics").delete().eq("id", id);
  atualizar();
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
  if (s.topicId && form.get("tema_feito")) await supabase.from("study_topics").update({ done_at: new Date().toISOString() }).eq("id", s.topicId);
  atualizar();
  return { ok: true, em: Date.now() };
}

/** "Começar sessão": abre uma sessão de 50 min agora */
export async function comecarSessao(courseId: string, subjectId: string | null, topicId: string | null = null): Promise<{ ok: boolean; id?: string }> {
  const supabase = await createClient();
  const agora = new Date();
  agora.setSeconds(0, 0);
  const id = await inserirSessao(supabase, courseId, subjectId, topicId, agora, 50);
  if (!id) return { ok: false };
  atualizar();
  return { ok: true, id };
}

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
  if (s.topic_id && (temaFeito || !feita)) await supabase.from("study_topics").update({ done_at: feita ? new Date(agora).toISOString() : null }).eq("id", s.topic_id);
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
  const supabase = await createClient();
  await supabase.from("events").delete().eq("id", id);
  atualizar();
}

// ---------- rotinas (Book 6.3) ----------

export type DadosRotina = {
  title: string;
  context_id: string | null;
  days: number[] | null;
  times_per_week: number | null;
  at_time: string | null;
  duration_min: number | null;
};

function validarRotina(d: DadosRotina): { erro: string } | { dados: DadosRotina } {
  const title = d.title.trim().slice(0, 120);
  if (!title) return { erro: "Dê um nome à rotina." };
  const days = d.days ? [...new Set(d.days.filter((x) => Number.isInteger(x) && x >= 0 && x <= 6))].sort() : null;
  const vezes = d.times_per_week && d.times_per_week >= 1 && d.times_per_week <= 7 ? Math.round(d.times_per_week) : null;
  if (days && !days.length) return { erro: "Escolha ao menos um dia." };
  if (!days && !vezes) return { erro: "Escolha os dias ou quantas vezes por semana." };
  if (d.at_time && !HORA.test(d.at_time)) return { erro: "Hora inválida." };
  const dur = d.duration_min && d.duration_min >= 5 ? Math.min(600, Math.round(d.duration_min)) : null;
  return { dados: { title, context_id: d.context_id || null, days: days ?? null, times_per_week: days ? null : vezes, at_time: d.at_time || null, duration_min: dur } };
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
  const supabase = await createClient();
  await supabase.from("routines").delete().eq("id", id);
  atualizar();
}

/** Marca ou desmarca a rotina num dia (hoje ou um dia que já passou nesta semana) */
export async function marcarRotina(id: string, dia: string, feita: boolean) {
  if (!DATA.test(dia) || dia > hojeISO()) return;
  const supabase = await createClient();
  if (feita) await supabase.from("routine_checks").upsert({ routine_id: id, done_on: dia }, { onConflict: "routine_id,done_on", ignoreDuplicates: true });
  else await supabase.from("routine_checks").delete().eq("routine_id", id).eq("done_on", dia);
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
  const supabase = await createClient();
  await supabase.from("notes").delete().eq("id", id);
  atualizar();
}
