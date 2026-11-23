"use client";

// Ajustes: quais áreas aparecem na lateral e o atalho da Siri para anotar sem abrir o app
import { useState, useTransition } from "react";
import { Copy, KeyRound } from "lucide-react";
import { gerarChaveAtalho, salvarAreasEscondidas } from "@/app/(app)/acoes";
import { useAvisar } from "./Avisos";

const AREAS: [string, string][] = [["negocios", "Negócios"], ["estudos", "Estudos"], ["financas", "Finanças"], ["saude", "Saúde"], ["rotinas", "Rotinas"], ["rotas", "Rotas"], ["notas", "Notas"]];

export function AreasDaLateral({ escondidas: inicial }: { escondidas: string[] }) {
  const [escondidas, setEscondidas] = useState(inicial);
  const [, iniciar] = useTransition();
  function alternar(a: string) {
    const novas = escondidas.includes(a) ? escondidas.filter((x) => x !== a) : [...escondidas, a];
    setEscondidas(novas);
    iniciar(() => salvarAreasEscondidas(novas));
  }
  return (
    <div className="chips" role="group" aria-label="Áreas na lateral">
      {AREAS.map(([v, r]) => <button key={v} type="button" className="chip" aria-pressed={!escondidas.includes(v)} onClick={() => alternar(v)}>{r}</button>)}
    </div>
  );
}

export function AtalhoSiri({ chave: inicial, site }: { chave: string | null; site: string }) {
  const [chave, setChave] = useState(inicial);
  const [pendente, iniciar] = useTransition();
  const avisar = useAvisar();
  const endereco = chave ? `${site}/api/capturar?chave=${chave}` : "";
  return (
    <>
      {chave ? (
        <div className="atalho">
          <code className="atalho__url">{endereco}</code>
          <button type="button" className="btn btn--line btn--sm" onClick={() => navigator.clipboard?.writeText(endereco).then(() => avisar({ texto: "Endereço copiado." }))}><Copy aria-hidden />Copiar</button>
        </div>
      ) : null}
      <ol className="atalho__passos">
        <li>No app <b>Atalhos</b>, crie um atalho com <b>Ditar texto</b>.</li>
        <li>Depois, <b>Obter conteúdo do URL</b>: cole o endereço, método <b>POST</b>, corpo <b>Formulário</b> com o campo <code>texto</code> = Texto ditado.</li>
        <li>Chame de <b>Anotar no Rumo</b> e diga: “E aí Siri, anotar no Rumo”.</li>
      </ol>
      <button type="button" className={chave ? "btn btn--ghost btn--sm" : "btn btn--sm"} disabled={pendente} onClick={() => { if (!chave || confirm("Gerar outra chave? O atalho antigo para de funcionar.")) iniciar(async () => { const r = await gerarChaveAtalho(); if (r.chave) setChave(r.chave); }); }}>
        <KeyRound aria-hidden />{chave ? "Gerar outra chave" : "Criar a chave do atalho"}
      </button>
    </>
  );
}
