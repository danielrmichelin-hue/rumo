"use client";

// Conferir com o extrato do banco: envia o arquivo do Nubank (CSV ou OFX) e vê, linha a linha,
// o que já está nos lançamentos, o que falta lançar (e lança daqui) e o que está no Rumo e não no banco.
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { Check, FileUp } from "lucide-react";
import { lancarVarios, type DadosLancamento } from "@/app/(app)/acoes";
import { conciliar, descricaoDaLinha, lerExtrato, tipoDaLinha, type LinhaExtrato } from "@/lib/extrato";
import { moeda, nomesCategorias, ROTULO_TIPO, sugerirCategoria, type Investimento, type Lancamento } from "@/lib/financas";
import { CampoCategoria, useFinancas } from "./FinancasContexto";
import { useAvisar } from "./Avisos";
import { Painel } from "./Comuns";

const dm = (iso: string) => `${iso.slice(8)}/${iso.slice(5, 7)}`;
const sinal = (v: number) => `${v < 0 ? "−" : "+"}${moeda(Math.abs(v))}`;

type Rascunho = { marcado: boolean; kind: DadosLancamento["kind"]; description: string; category: string; investment_id: string };

export function ConferirExtrato({ lancamentos, investimentos }: { lancamentos: Lancamento[]; investimentos: Investimento[] }) {
  const [aberto, setAberto] = useState(false);
  const [linhas, setLinhas] = useState<LinhaExtrato[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [rascunhos, setRascunhos] = useState<Record<number, Rascunho>>({});
  const [pendente, iniciar] = useTransition();
  const { regras, categorias } = useFinancas();
  const avisar = useAvisar();
  const ativos = investimentos.filter((i) => i.status === "ativo");
  const c = useMemo(() => (linhas ? conciliar(linhas, lancamentos) : null), [linhas, lancamentos]);

  const rascunhoDe = (l: LinhaExtrato): Rascunho => {
    const kind = tipoDaLinha(l);
    const description = descricaoDaLinha(l);
    const k = l.valor < 0 ? "saida" : "entrada";
    const s = sugerirCategoria(regras, description, k);
    const category = s && s.k === k && nomesCategorias(categorias, k).includes(s.c) ? s.c : nomesCategorias(categorias, k).includes("Outros") ? "Outros" : nomesCategorias(categorias, k)[0] ?? "Outros";
    return { marcado: true, kind: (kind === "aporte" || kind === "resgate") && !ativos.length ? k : kind, description, category, investment_id: ativos[0]?.id ?? "" };
  };

  async function ler(arquivo: File) {
    setErro(null);
    const r = lerExtrato(await arquivo.text());
    if (r.erro) { setLinhas(null); return setErro(r.erro); }
    setLinhas(r.linhas);
    setRascunhos(Object.fromEntries(r.linhas.map((l) => [l.n, rascunhoDe(l)])));
  }

  const faltam = c?.faltam ?? [];
  const marcadas = faltam.filter((l) => rascunhos[l.n]?.marcado);
  const mudar = (n: number, v: Partial<Rascunho>) => setRascunhos((r) => ({ ...r, [n]: { ...r[n], ...v } }));

  function lancarMarcadas() {
    const lista: DadosLancamento[] = marcadas.map((l) => {
      const r = rascunhos[l.n];
      const transf = r.kind === "aporte" || r.kind === "resgate";
      return { kind: r.kind, amount: Math.abs(l.valor), description: r.description, category: r.category, happened_on: l.dia, paid: true, context_id: null, investment_id: transf ? r.investment_id : null };
    });
    iniciar(async () => {
      const res = await lancarVarios(lista);
      if (!res.ok) return avisar({ texto: res.erro ?? "Não foi possível lançar." });
      avisar({ texto: `${lista.length} ${lista.length === 1 ? "lançamento entrou" : "lançamentos entraram"} do extrato.` });
    });
  }

  return (
    <>
      <button type="button" className="btn btn--line btn--sm" onClick={() => setAberto(true)}><FileUp aria-hidden />Conferir com o extrato</button>
      {aberto && (
        <Painel titulo="Conferir com o extrato do banco" fechar={() => setAberto(false)}>
          <div className="detail extrato-banco" style={{ gap: 14 }}>
            <label className="field">
              Arquivo do Nubank (CSV ou OFX)
              <input className="input" type="file" accept=".csv,.ofx,.txt,text/csv" onChange={(e) => { const f = e.target.files?.[0]; if (f) void ler(f); }} />
            </label>
            {!linhas && !erro && <p className="field__hint">No app do Nubank: Extrato › Exportar extrato › escolha o período. O arquivo é só lido aqui, para conferir; nada entra sem você mandar.</p>}
            {erro && <p className="note note--err" role="alert">{erro}</p>}
            {c && (
              <>
                <p className="extrato-banco__periodo">De {dm(c.de)} a {dm(c.ate)} · {linhas!.length} {linhas!.length === 1 ? "linha" : "linhas"} no extrato</p>
                <div className="nums nums--3">
                  <div><small>Já estão no Rumo</small><b className="pos">{c.casados.length}</b></div>
                  <div><small>Faltam lançar</small><b className={faltam.length ? "neg" : undefined}>{faltam.length}</b><span>{faltam.length ? sinal(faltam.reduce((t, l) => t + l.valor, 0)) : "Nada"}</span></div>
                  <div><small>No Rumo e não no banco</small><b className={c.sobram.length ? "neg" : undefined}>{c.sobram.length}</b><span>{c.sobram.length ? "Confira a data ou o valor" : "Nada"}</span></div>
                </div>
                <p className={`extrato-banco__total${Math.abs(c.totalExtrato - c.totalRumo) < 0.005 ? " is-ok" : ""}`}>
                  No período, o extrato soma {sinal(c.totalExtrato)} e os lançamentos somam {sinal(c.totalRumo)}
                  {Math.abs(c.totalExtrato - c.totalRumo) < 0.005 ? ": batem." : `: diferença de ${moeda(Math.abs(c.totalExtrato - c.totalRumo))}.`}
                </p>

                {faltam.length > 0 && (
                  <section>
                    <h3 className="sec__h">Faltam lançar <em>{faltam.length}</em></h3>
                    <ul className="extrato-banco__lista">
                      {faltam.map((l) => {
                        const r = rascunhos[l.n];
                        const transf = r.kind === "aporte" || r.kind === "resgate";
                        const opcoes: DadosLancamento["kind"][] = l.valor < 0 ? ["saida", "aporte"] : ["entrada", "resgate"];
                        return (
                          <li key={l.n} className={r.marcado ? undefined : "is-fora"}>
                            <label className="extrato-banco__marca"><input type="checkbox" checked={r.marcado} onChange={(e) => mudar(l.n, { marcado: e.target.checked })} aria-label={`Lançar ${l.descricao}`} /></label>
                            <div className="extrato-banco__info">
                              <span><b>{dm(l.dia)}</b><span className={l.valor > 0 ? "pos" : undefined}>{sinal(l.valor)}</span></span>
                              <small title={l.descricao}>{l.descricao}</small>
                            </div>
                            <div className="extrato-banco__campos">
                              <input className="input" value={r.description} onChange={(e) => mudar(l.n, { description: e.target.value })} aria-label="Descrição" maxLength={120} />
                              <select className="input" value={r.kind} onChange={(e) => mudar(l.n, { kind: e.target.value as Rascunho["kind"] })} aria-label="Tipo">
                                {opcoes.map((k) => <option key={k} value={k} disabled={(k === "aporte" || k === "resgate") && !ativos.length}>{ROTULO_TIPO[k]}</option>)}
                              </select>
                              {transf ? (
                                <select className="input" value={r.investment_id} onChange={(e) => mudar(l.n, { investment_id: e.target.value })} aria-label="Investimento">
                                  {ativos.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                                </select>
                              ) : (
                                <CampoCategoria kind={l.valor < 0 ? "saida" : "entrada"} value={r.category} onChange={(v) => mudar(l.n, { category: v })} rotulo="" />
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                    <div className="detail__foot">
                      <button type="button" className="btn" disabled={pendente || !marcadas.length || marcadas.some((l) => !rascunhos[l.n].description.trim())} onClick={lancarMarcadas}>
                        <Check aria-hidden />{pendente ? "Lançando…" : `Lançar ${marcadas.length} · ${sinal(marcadas.reduce((t, l) => t + l.valor, 0))}`}
                      </button>
                    </div>
                  </section>
                )}

                {c.sobram.length > 0 && (
                  <section>
                    <h3 className="sec__h">No Rumo e não no extrato <em>{c.sobram.length}</em></h3>
                    <ul className="extrato-banco__sobra">
                      {c.sobram.map((l) => (
                        <li key={l.id}><Link href={`/financas?lm=${l.happened_on.slice(0, 7)}`} onClick={() => setAberto(false)}>{dm(l.happened_on)} · {l.description}</Link><span>{sinal(l.kind === "entrada" || l.kind === "resgate" ? l.amount : -l.amount)}</span></li>
                      ))}
                    </ul>
                    <p className="field__hint">Pode ser data ou valor diferente do banco, um lançamento repetido ou algo de outra conta. Abra e corrija nos Lançamentos.</p>
                  </section>
                )}

                {c.casados.length > 0 && (
                  <details className="fold">
                    <summary className="sec__h">Já estão no Rumo <em>{c.casados.length}</em></summary>
                    <ul className="extrato-banco__sobra">
                      {c.casados.map((x) => (
                        <li key={x.linha.n}><span>{dm(x.linha.dia)} · {x.lancamentos.length > 1 ? `${x.lancamentos.length} parcelas num Pix só` : x.lancamentos[0].description}</span><span>{sinal(x.linha.valor)}</span></li>
                      ))}
                    </ul>
                  </details>
                )}
              </>
            )}
          </div>
        </Painel>
      )}
    </>
  );
}
