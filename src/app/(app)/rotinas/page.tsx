import { createClient } from "@/lib/supabase/server";
import { LinhaRotina, NovaRotina } from "@/components/Rotinas";
import { hojeISO } from "@/lib/datas";
import { segundaDa } from "@/lib/semana";
import { CAMPOS_ROTINA, eDoDia, SUGESTOES, type Marcacao, type Rotina } from "@/lib/rotinas";
import type { ContextItem } from "@/components/Shell";

export const metadata = { title: "Rotinas" };

export default async function Page() {
  const supabase = await createClient();
  const hoje = hojeISO();
  const [{ data: rotinasDb }, { data: marcasDb }, { data: contextos }, { data: perfil }] = await Promise.all([
    supabase.from("routines").select(CAMPOS_ROTINA).order("position"),
    supabase.from("routine_checks").select("routine_id, done_on").gte("done_on", segundaDa(hoje)),
    supabase.from("contexts").select("id, name, color, kind").eq("archived", false).order("position"),
    supabase.from("profiles").select("onboarding").maybeSingle(),
  ]);
  const rotinas = (rotinasDb ?? []) as Rotina[];
  const marcas = (marcasDb ?? []) as Marcacao[];
  const ctx = (contextos ?? []) as ContextItem[];
  const ativas = rotinas.filter((r) => r.status === "ativa");
  const pausadas = rotinas.filter((r) => r.status === "pausada");

  // Sem rotinas ainda: a resposta das perguntas do começo vira a primeira sugestão
  const respostas = (perfil?.onboarding as { rotinas?: string[] } | null)?.rotinas ?? [];
  const primeira = !rotinas.length ? respostas[0] : undefined;
  const pronta = primeira ? SUGESTOES[primeira] : undefined;
  const sugestao = pronta
    ? { title: pronta.title, modo: "dias" as const, days: pronta.days, at_time: pronta.at_time, duration: String(pronta.duration_min) }
    : primeira ? { title: primeira } : undefined;

  const linha = (r: Rotina) => (
    <LinhaRotina key={r.id} rotina={r} marcas={marcas} contexto={ctx.find((c) => c.id === r.context_id)} doDia={eDoDia(r, marcas, hoje)} contextos={ctx} />
  );

  return (
    <div className="page">
      <div className="page__head">
        <div>
          <h1 className="page__t">Rotinas</h1>
          <p className="page__sub">O que se repete, no horário certo. Cada rotina aparece no Hoje nos dias dela. Um dia perdido não zera nada.</p>
        </div>
      </div>

      {sugestao && (
        <p className="field__hint" style={{ marginBottom: 12 }}>
          Você contou que tenta manter: <b>{respostas.join(", ").toLowerCase()}</b>. A primeira já vem preenchida; ajuste os dias e o horário.
        </p>
      )}
      <div style={{ marginBottom: 24 }}>
        <NovaRotina
          contextos={ctx}
          inicial={sugestao}
        />
      </div>

      {ativas.length > 0 && (
        <section className="sec">
          <h2 className="sec__h">Rotinas desta semana <em>{ativas.length}</em></h2>
          <ul className="list">{ativas.map(linha)}</ul>
          <p className="field__hint" style={{ padding: "6px 10px" }}>Esqueceu de marcar? Toque no dia, nos pontos da semana.</p>
        </section>
      )}
      {pausadas.length > 0 && (
        <section className="sec">
          <h2 className="sec__h">Pausadas <em>{pausadas.length}</em></h2>
          <ul className="list">{pausadas.map(linha)}</ul>
        </section>
      )}
      {!rotinas.length && !sugestao && (
        <div className="empty empty--box" style={{ maxWidth: 560 }}>
          <b>Primeira rotina</b>
          <span>Academia três vezes por semana, ler à noite, revisar a semana na sexta. “4 vezes por semana” é tão válido quanto “todo dia”.</span>
        </div>
      )}
    </div>
  );
}
