// Planilha do mês (CSV para Excel/Planilhas): separador ";" e vírgula decimal, como o Excel em português abre.
import { createClient } from "@/lib/supabase/server";
import { hojeISO } from "@/lib/datas";
import { CAMPOS_LANCAMENTO, datasDeSalario, limitesDoMes, mesDoDia, naConta, normalizarLancamento, ROTULO_TIPO } from "@/lib/financas";

export async function GET(req: Request) {
  const param = new URL(req.url).searchParams.get("mes") ?? "";
  const supabase = await createClient();
  const [{ data: aj }, { data: sal }] = await Promise.all([
    supabase.from("fin_settings").select("pay_day").maybeSingle(),
    supabase.from("fin_entries").select("kind, category, happened_on").eq("kind", "entrada").eq("category", "Salário"),
  ]);
  const dr = aj?.pay_day ?? 1;
  const salarios = datasDeSalario((sal ?? []) as { kind: "entrada"; category: string; happened_on: string }[]);
  const mes = /^\d{4}-(0[1-9]|1[0-2])$/.test(param) ? param : mesDoDia(hojeISO(), dr, salarios);
  const { inicio, fim } = limitesDoMes(mes, dr, salarios);
  const [{ data }, { data: contextos }] = await Promise.all([
    supabase.from("fin_entries").select(CAMPOS_LANCAMENTO).gte("happened_on", inicio).lte("happened_on", fim).order("happened_on"),
    supabase.from("contexts").select("id, name"),
  ]);
  const campo = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const linhas = [
    ["Data", "Tipo", "Descrição", "Categoria", "Valor", "Situação", "Contexto"].join(";"),
    ...(data ?? []).map(normalizarLancamento).map((l) =>
      [
        l.happened_on.split("-").reverse().join("/"),
        ROTULO_TIPO[l.kind],
        campo(l.description),
        campo(l.category),
        naConta(l).toFixed(2).replace(".", ","),
        l.paid ? "Pago" : l.kind === "saida" ? "A pagar" : "A receber",
        campo((contextos ?? []).find((c) => c.id === l.context_id)?.name ?? ""),
      ].join(";"),
    ),
  ];
  return new Response("﻿" + linhas.join("\r\n"), {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="rumo-financas-${mes}.csv"` },
  });
}
