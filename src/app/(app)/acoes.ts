"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { lerCaptura } from "@/lib/captura";
import { hojeISO, somarDias, somarDiasUteis } from "@/lib/datas";
import { ESCOLHAS, type ChaveEscolha } from "@/lib/modulos";
import { CORES_CONTEXTO, proximaCor, type Estado } from "@/lib/tipos";

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

export type Achado = { tipo: "responsabilidade" | "projeto" | "contexto" | "compromisso" | "pessoa"; id: string; titulo: string; detalhe: string; href: string; cor?: string };

export async function buscar(termo: string): Promise<Achado[]> {
  const q = termo.trim().replace(/[%,()]/g, " ").replace(/\s+/g, " ").slice(0, 80);
  if (q.length < 2) return [];
  const like = `%${q}%`;
  const supabase = await createClient();
  const [r, p, c, e, g, ctxs] = await Promise.all([
    supabase.from("responsibilities").select("id, title, note, state, context_id, waiting_note").or(`title.ilike.${like},note.ilike.${like},waiting_note.ilike.${like}`).order("updated_at", { ascending: false }).limit(20),
    supabase.from("projects").select("id, name, note, context_id").or(`name.ilike.${like},note.ilike.${like}`).limit(8),
    supabase.from("contexts").select("id, name, color").ilike("name", like).limit(8),
    supabase.from("events").select("id, title, starts_at, context_id").or(`title.ilike.${like},location.ilike.${like},note.ilike.${like}`).order("starts_at", { ascending: false }).limit(8),
    supabase.from("people").select("id, name").ilike("name", like).limit(8),
    supabase.from("contexts").select("id, name, color"),
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
  for (const x of c.data ?? []) achados.push({ tipo: "contexto", id: x.id, titulo: x.name, detalhe: "Contexto", href: `/contexto/${x.id}`, cor: x.color });
  for (const x of e.data ?? []) {
    const ctx = nomeCtx(x.context_id);
    const dia = hojeISO(new Date(x.starts_at));
    achados.push({ tipo: "compromisso", id: x.id, titulo: x.title, detalhe: `Compromisso · ${dia.split("-").reverse().slice(0, 2).join("/")}${ctx ? ` · ${ctx.name}` : ""}`, href: `/calendario/${x.id}`, cor: ctx?.color });
  }
  for (const x of g.data ?? []) achados.push({ tipo: "pessoa", id: x.id, titulo: x.name, detalhe: "Pessoa", href: `/busca?q=${encodeURIComponent(x.name)}` });
  return achados;
}
