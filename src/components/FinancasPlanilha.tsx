"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Check, Trash2, X } from "lucide-react";
import { apagarLancamento, editarLancamento } from "@/app/(app)/acoes";
import { numeroBR, somarMeses } from "@/lib/datas";
import { ehTransferencia, mesCurto, ordemDoDia, moeda, naConta, ROTULO_TIPO, situacaoParcelamento, type Investimento, type Lancamento, type Parcelamento } from "@/lib/financas";
import { CampoCategoria, CampoConta } from "./FinancasContexto";
import { useAvisar } from "./Avisos";

const dataBR = (iso: string) => iso.split("-").reverse().join("/");

// ---------- Lançamentos: o extrato do mês, dia a dia ----------

const SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const MESES_LONGOS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const rotuloDia = (iso: string, hoje: string) => {
  const d = new Date(iso + "T12:00:00Z");
  const base = `${SEMANA[d.getUTCDay()]}, ${d.getUTCDate()} de ${MESES_LONGOS[d.getUTCMonth()]}`;
  return iso === hoje ? `Hoje · ${base}` : base;
};

/** Os lançamentos de um mês: com `saldos`, uma lista só como extrato de banco; sem, agrupados por tipo ou por dia. Tocar abre a edição. */
const diaCurto = (iso: string) => `${Number(iso.slice(8))}/${iso.slice(5, 7)}`;

export function ExtratoMes({ lancamentos, hoje, investimentos = [], saldos }: { lancamentos: Lancamento[]; hoje: string; investimentos?: Investimento[]; /** saldo da conta no fim de cada dia: vira um extrato de banco, só por dia */ saldos?: Record<string, number> }) {
  const [busca, setBusca] = useState("");
  const [cat, setCat] = useState("");
  const [editando, setEditando] = useState<string | null>(null);
  const [vista, setVista] = useState<"tipo" | "dia">("tipo");
  const categorias = useMemo(() => [...new Set(lancamentos.map((l) => l.category))].sort(), [lancamentos]);
  const filtrados = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return lancamentos.filter((l) => (!cat || l.category === cat) && (!t || l.description.toLowerCase().includes(t) || l.category.toLowerCase().includes(t)));
  }, [lancamentos, busca, cat]);
  // Por dia (do mais recente) ou por tipo: o que entrou, parcelas, contas fixas, o dia a dia e investimentos
  const grupos = useMemo(() => {
    const ordem = [...filtrados].sort((a, b) => b.happened_on.localeCompare(a.happened_on));
    const mapa = new Map<string, Lancamento[]>();
    const chave = (l: Lancamento) => vista === "dia" ? l.happened_on
      : l.kind === "entrada" ? "Entradas" : ehTransferencia(l) ? "Investimentos" : l.installment_id ? "Parcelas" : l.routine_id || l.category === "Assinaturas" ? "Contas fixas e assinaturas" : "Dia a dia";
    if (vista === "tipo") for (const g of ["Entradas", "Parcelas", "Contas fixas e assinaturas", "Dia a dia", "Investimentos"]) mapa.set(g, []);
    for (const l of ordem) mapa.set(chave(l), [...(mapa.get(chave(l)) ?? []), l]);
    return [...mapa.entries()].filter(([, lista]) => lista.length);
  }, [filtrados, vista]);

  // Extrato de banco: uma lista só, do dia 1 ao fim do mês, com a data em cada linha e o saldo depois de cada lançamento
  const lista = useMemo(() => {
    if (!saldos) return [];
    const ordem = [...lancamentos].sort(ordemDoDia);
    if (!ordem.length) return [];
    const d0 = ordem[0].happened_on;
    let saldo = (saldos[d0] ?? 0) - ordem.filter((l) => l.paid && l.happened_on === d0).reduce((t, l) => t + naConta(l), 0);
    return ordem.map((l) => { if (l.paid) saldo += naConta(l); return { l, saldo: Math.round(saldo * 100) / 100 }; });
  }, [lancamentos, saldos]);
  const visiveis = new Set(filtrados.map((l) => l.id));
  const comFiltro = filtrados.length !== lancamentos.length;

  const linha = (l: Lancamento, saldo?: number) => {
    const inv = ehTransferencia(l);
    const nomeInv = investimentos.find((i) => i.id === l.investment_id)?.name;
    return editando === l.id ? <EditarLinha key={l.id} l={l} investimentos={investimentos} fechar={() => setEditando(null)} /> : (
      <li key={l.id}>
        <button type="button" className={`extrato__l${saldos ? " extrato__l--banco" : ""}${l.paid ? "" : " is-aberto"}${inv ? " is-inv" : ""}${l.happened_on === hoje ? " is-hoje" : ""}`} onClick={() => setEditando(l.id)} aria-label={`Editar ${l.description}`}>
          {saldos && <time className="extrato__data" dateTime={l.happened_on}>{diaCurto(l.happened_on)}<small>{SEMANA[new Date(l.happened_on + "T12:00:00Z").getUTCDay()]}</small></time>}
          <span className="extrato__d">
            <b>{l.description}</b>
            <small>{vista === "tipo" && !saldos && <>{diaCurto(l.happened_on)} · </>}{inv ? (l.kind === "aporte" ? `Da conta para ${nomeInv ?? "o investimento"}` : `De ${nomeInv ?? "o investimento"} para a conta`) : l.category}{l.installment_id ? " · parcela" : l.routine_id ? " · conta fixa" : ""}{!l.paid ? (l.kind === "saida" ? " · a pagar" : " · a receber") : ""}</small>
          </span>
          <span className={`extrato__v${l.kind === "entrada" ? " pos" : inv ? " transf" : ""}`}>{naConta(l) < 0 ? "−" : "+"}{moeda(l.amount)}</span>
          {saldos && <span className={`extrato__s${saldo !== undefined && saldo < 0 ? " neg" : ""}`}>{saldo !== undefined && l.paid ? moeda(saldo) : ""}</span>}
        </button>
      </li>
    );
  };

  if (saldos) return (
    <div className="extrato">
      {lancamentos.length > 0 && (
        <div className="extrato__filtros extrato__filtros--banco">
          <input className="input" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar neste mês" aria-label="Buscar neste mês" />
          <select className="input" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Categoria">
            <option value="">Todas as categorias</option>
            {categorias.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
      )}
      {!filtrados.length ? <p className="empty">{lancamentos.length ? "Nada com esse filtro." : "Nada lançado neste mês."}</p> : (
        <section className="extrato__dia">
          <h3 className="extrato__cab"><span>Data</span><span>Lançamento</span><span>Valor</span><span>{comFiltro ? "" : "Saldo"}</span></h3>
          <ul>{lista.filter(({ l }) => visiveis.has(l.id)).map(({ l, saldo }) => linha(l, comFiltro ? undefined : saldo))}</ul>
        </section>
      )}
    </div>
  );

  return (
    <div className="extrato">
      {lancamentos.length > 0 && (
        <div className="extrato__filtros">
          <div className="seg seg--sm" role="group" aria-label="Agrupar">
            <button type="button" aria-pressed={vista === "tipo"} onClick={() => setVista("tipo")}>Por tipo</button>
            <button type="button" aria-pressed={vista === "dia"} onClick={() => setVista("dia")}>Por dia</button>
          </div>
          <input className="input" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar neste mês" aria-label="Buscar neste mês" />
          <select className="input" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Categoria">
            <option value="">Todas as categorias</option>
            {categorias.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
      )}
      {!grupos.length && <p className="empty">{lancamentos.length ? "Nada com esse filtro." : "Nada lançado neste mês."}</p>}
      {grupos.map(([grupo, lista]) => {
        const saldo = lista.filter((l) => l.paid).reduce((t, l) => t + naConta(l), 0);
        return (
          <section key={grupo} className="extrato__dia">
            <h3><span>{vista === "dia" ? rotuloDia(grupo, hoje) : <>{grupo} <em>{lista.length}</em></>}</span><b className={saldo >= 0 ? "pos" : undefined}>{saldo >= 0 ? "+" : "−"}{moeda(Math.abs(saldo))}</b></h3>
            <ul>{lista.map((l) => linha(l))}</ul>
          </section>
        );
      })}
    </div>
  );
}

function EditarLinha({ l, fechar, investimentos }: { l: Lancamento; fechar: () => void; investimentos: Investimento[] }) {
  const [v, setV] = useState({ happened_on: l.happened_on, description: l.description, category: l.category, kind: l.kind, valor: String(l.amount).replace(".", ","), paid: l.paid, investment_id: l.investment_id ?? investimentos[0]?.id ?? "", account_id: l.account_id ?? "" });
  const transferencia = v.kind === "aporte" || v.kind === "resgate";
  const [pendente, iniciar] = useTransition();
  const avisar = useAvisar();
  const guardar = () => iniciar(async () => {
    const r = await editarLancamento(l.id, { kind: v.kind, amount: numeroBR(v.valor), description: v.description, category: v.category, happened_on: v.happened_on, paid: v.paid, investment_id: transferencia ? v.investment_id : null, account_id: v.account_id || null });
    if (!r.ok) return avisar({ texto: r.erro ?? "Não foi possível guardar." });
    fechar();
  });
  return (
    <li>
      <form className="extrato__edit" onSubmit={(e) => { e.preventDefault(); guardar(); }} onKeyDown={(e) => e.key === "Escape" && fechar()}>
        <input className="input extrato__edit-d" value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} aria-label="Descrição" autoFocus maxLength={120} />
        <select className="input" value={v.kind} onChange={(e) => setV({ ...v, kind: e.target.value as Lancamento["kind"] })} aria-label="Tipo">
          {(["saida", "entrada", "aporte", "resgate"] as const).map((k) => <option key={k} value={k} disabled={(k === "aporte" || k === "resgate") && !investimentos.length}>{ROTULO_TIPO[k]}</option>)}
        </select>
        <input className="input" inputMode="decimal" value={v.valor} onChange={(e) => setV({ ...v, valor: e.target.value })} aria-label="Valor" />
        {transferencia ? (
          <select className="input" value={v.investment_id} onChange={(e) => setV({ ...v, investment_id: e.target.value })} aria-label="Investimento">
            {investimentos.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
        ) : (
          <CampoCategoria kind={v.kind === "entrada" ? "entrada" : "saida"} value={v.category} onChange={(c) => setV({ ...v, category: c })} rotulo="" />
        )}
        <input className="input" type="date" value={v.happened_on} onChange={(e) => setV({ ...v, happened_on: e.target.value })} aria-label="Data" />
        {transferencia ? <span /> : <label className="check-line"><input type="checkbox" checked={v.paid} onChange={(e) => setV({ ...v, paid: e.target.checked })} />{v.kind === "saida" ? "Pago" : "Recebido"}</label>}
        <CampoConta value={v.account_id} onChange={(c) => setV({ ...v, account_id: c })} />
        <span className="extrato__edit-a">
          <button type="button" className="btn btn--ghost btn--sm" disabled={pendente} onClick={() => { if (confirm(`Apagar "${l.description}"?`)) iniciar(async () => { await apagarLancamento(l.id); fechar(); }); }}><Trash2 aria-hidden />Apagar</button>
          <button type="button" className="btn btn--ghost btn--sm" onClick={fechar}><X aria-hidden />Cancelar</button>
          <button type="submit" className="btn btn--sm" disabled={pendente}><Check aria-hidden />Guardar</button>
        </span>
      </form>
    </li>
  );
}

// ---------- Parcelas: a grade de cada parcelamento, parcela por parcela ----------

/** A grade de cada parcelamento, parcela por parcela (só para ver: as parcelas pagas vêm da planilha) */
export function GradeParcelas({ parcelamentos, hoje }: { parcelamentos: Parcelamento[]; hoje: string; somenteVer?: boolean }) {
  const max = Math.max(1, ...parcelamentos.map((p) => p.installments));
  return (
    <div className="planilha__rolo">
      <table className="tabela tabela--grade">
        <thead>
          <tr>
            <th>O que é</th><th className="num">Parcela</th><th className="num">Pagas</th><th className="num">Falta</th><th>Última</th>
            {Array.from({ length: max }, (_, i) => <th key={i} className="grade__n">{i + 1}</th>)}
          </tr>
        </thead>
        <tbody>
          {parcelamentos.map((p) => {
            const s = situacaoParcelamento(p, hoje);
            return (
              <tr key={p.id} className={s.estado === "quitado" ? "is-quitado" : undefined}>
                <td><span className="tabela__nome">{p.title}</span><small>{p.creditor ?? p.category}</small></td>
                <td className="num">{moeda(s.parcela)}</td>
                <td className="num">{p.paid_count}/{p.installments}</td>
                <td className="num">{s.restante > 0 ? moeda(s.restante) : "—"}</td>
                <td>{s.estado === "quitado" ? "Quitado" : mesCurto(s.ultima)}</td>
                {Array.from({ length: max }, (_, i) => {
                  if (i >= p.installments) return <td key={i} className="grade__c grade__c--fora" />;
                  const vence = somarMeses(p.first_due, i);
                  const paga = i < p.paid_count, proxima = i === p.paid_count, devida = proxima && vence <= hoje;
                  return (
                    <td key={i} className="grade__c">
                      <span className={`grade__b${paga ? " is-paga" : ""}${proxima ? " is-proxima" : ""}${devida ? " is-devida" : ""}`} title={`Parcela ${i + 1} · vence ${dataBR(vence)}${paga ? " · paga" : ""}`}>
                        {paga ? <Check aria-hidden /> : <small>{mesCurto(vence).split("/")[0]}</small>}
                      </span>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** No celular, a faixa dos meses rola até o mês escolhido */
export function RolarAteMes() {
  useEffect(() => {
    const el = document.querySelector<HTMLElement>(".meses__lista .is-atual");
    const faixa = el?.parentElement;
    if (el && faixa && faixa.scrollWidth > faixa.clientWidth) faixa.scrollLeft = el.offsetLeft - faixa.clientWidth / 2 + el.clientWidth / 2;
  }, []);
  return null;
}
