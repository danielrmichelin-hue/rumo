// Captura pelo atalho da Siri (app Atalhos do iPhone): grava no Rumo sem abrir o app.
// Recebe a chave pessoal (Ajustes › Atalho da Siri) e o texto ditado; entende data, hora e #contexto como a captura.
import { createClient } from "@supabase/supabase-js";
import { lerCaptura } from "@/lib/captura";
import { hojeISO, rotuloData } from "@/lib/datas";

async function capturar(chave: string, texto: string) {
  const original = texto.trim().slice(0, 1000);
  if (chave.length < 24 || !original) return new Response("Faltou o texto.", { status: 400 });
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  const { data: contextos } = await sb.rpc("rumo_contextos_por_chave", { p_chave: chave });
  const l = lerCaptura(original, (contextos ?? []) as { id: string; name: string }[], hojeISO());
  const { data: id } = await sb.rpc("rumo_capturar_por_chave", { p_chave: chave, p_titulo: l.title, p_data: l.due_date, p_hora: l.due_time, p_tipo: l.kind, p_contexto: l.context_id, p_original: original });
  if (!id) return new Response("Chave inválida. Gere de novo em Ajustes.", { status: 401 });
  const quando = l.due_date ? ` · ${rotuloData(l.due_date)}${l.due_time ? ` ${l.due_time.slice(0, 5)}` : ""}` : "";
  return new Response(`Anotado: ${l.title}${quando}`, { headers: { "content-type": "text/plain; charset=utf-8" } });
}

export async function GET(req: Request) {
  const u = new URL(req.url);
  return capturar(u.searchParams.get("chave") ?? "", u.searchParams.get("texto") ?? "");
}

export async function POST(req: Request) {
  const u = new URL(req.url);
  let texto = u.searchParams.get("texto") ?? "";
  const tipo = req.headers.get("content-type") ?? "";
  if (tipo.includes("json")) texto = String((await req.json().catch(() => ({}))).texto ?? texto);
  else if (tipo.includes("form")) texto = String((await req.formData()).get("texto") ?? texto);
  else if (!texto) texto = await req.text();
  return capturar(u.searchParams.get("chave") ?? "", texto);
}
