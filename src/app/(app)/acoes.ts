"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { lerCaptura } from "@/lib/captura";
import { hojeISO, somarDiasUteis } from "@/lib/datas";
import { CORES_CONTEXTO, type Estado } from "@/lib/tipos";

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
      due_date: dueDate || null,
      due_time: dueTime ? dueTime.slice(0, 5) : null,
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
    { name: "Rumo", kind: "empresa", color: CORES_CONTEXTO[1].cor, position: 1 },
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
