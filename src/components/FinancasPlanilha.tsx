"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Check, Trash2, X } from "lucide-react";
import { apagarLancamento, apagarParcelamento, desfazerParcela, editarLancamento, pagarParcela, salvarParcelamento } from "@/app/(app)/acoes";
import { numeroBR } from "@/lib/datas";
import { CATEGORIAS_ENTRADA, CATEGORIAS_SAIDA, ehTransferencia, mesCurto, moeda, naConta, ROTULO_TIPO, situacaoParcelamento, somarMeses, type Investimento, type Lancamento, type Parcelamento } from "@/lib/financas";
import { useAvisar } from "./Avisos";
import { Painel } from "./Comuns";

const dataBR = (iso: string) => iso.split("-").reverse().join("/");

// ---------- Lançamentos: o extrato do mês, dia a dia ----------

const SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const MESES_LONGOS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const rotuloDia = (iso: string, hoje: string) => {
  const d = new Date(iso + "T12:00:00Z");
  const base = `${SEMANA[d.getUTCDay()]}, ${d.getUTCDate()} de ${MESES_LONGOS[d.getUTCMonth()]}`;
  return iso === hoje ? `Hoje · ${base}` : base;
};

/** Os lançamentos de um mês, agrupados por dia (como o extrato do banco). Tocar num lançamento abre a edição. */
export function ExtratoMes({ lancamentos, hoje, investimentos = [] }: { lancamentos: Lancamento[]; hoje: string; investimentos?: Investimento[] }) {
  const [busca, setBusca] = useState("");
  const [cat, setCat] = useState("");
  const [editando, setEditando] = useState<string | null>(null);
  const categorias = useMemo(() => [...new Set(lancamentos.map((l) => l.category))].sort(), [lancamentos]);
  const filtrados = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return lancamentos.filter((l) => (!cat || l.category === cat) && (!t || l.description.toLowerCase().includes(t) || l.category.toLowerCase().includes(t)));
  }, [lancamentos, busca, cat]);
  const dias = useMemo(() => {
    const mapa = new Map<string, Lancamento[]>();
    for (const l of [...filtrados].sort((a, b) => b.happened_on.localeCompare(a.happened_on))) mapa.set(l.happened_on, [...(mapa.get(l.happened_on) ?? []), l]);
    return [...mapa.entries()];
  }, [filtrados]);

  return (
    <div className="extrato">
      {lancamentos.length > 0 && (
        <div className="extrato__filtros">
          <input className="input" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar neste mês" aria-label="Buscar neste mês" />
          <select className="input" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Categoria">
            <option value="">Todas as categorias</option>
            {categorias.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
      )}
      {!dias.length && <p className="empty">{lancamentos.length ? "Nada com esse filtro." : "Nada lançado neste mês."}</p>}
      {dias.map(([dia, lista]) => {
        const saldo = lista.filter((l) => l.paid).reduce((t, l) => t + naConta(l), 0);
        return (
          <section key={dia} className="extrato__dia">
            <h3><span>{rotuloDia(dia, hoje)}</span><b className={saldo >= 0 ? "pos" : undefined}>{saldo >= 0 ? "+" : "−"}{moeda(Math.abs(saldo))}</b></h3>
            <ul>
              {lista.map((l) => {
                const inv = ehTransferencia(l);
                const nomeInv = investimentos.find((i) => i.id === l.investment_id)?.name;
                return editando === l.id ? <EditarLinha key={l.id} l={l} investimentos={investimentos} fechar={() => setEditando(null)} /> : (
                  <li key={l.id}>
                    <button type="button" className={`extrato__l${l.paid ? "" : " is-aberto"}${inv ? " is-inv" : ""}`} onClick={() => setEditando(l.id)} aria-label={`Editar ${l.description}`}>
                      <span className="extrato__d">
                        <b>{l.description}</b>
                        <small>{inv ? (l.kind === "aporte" ? `Da conta para ${nomeInv ?? "o investimento"}` : `De ${nomeInv ?? "o investimento"} para a conta`) : l.category}{l.installment_id ? " · parcela" : l.routine_id ? " · conta fixa" : ""}{!l.paid ? (l.kind === "saida" ? " · a pagar" : " · a receber") : ""}</small>
                      </span>
                      <span className={`extrato__v${l.kind === "entrada" ? " pos" : inv ? " transf" : ""}`}>{naConta(l) < 0 ? "−" : "+"}{moeda(l.amount)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function EditarLinha({ l, fechar, investimentos }: { l: Lancamento; fechar: () => void; investimentos: Investimento[] }) {
  const [v, setV] = useState({ happened_on: l.happened_on, description: l.description, category: l.category, kind: l.kind, valor: String(l.amount).replace(".", ","), paid: l.paid, investment_id: l.investment_id ?? investimentos[0]?.id ?? "" });
  const transferencia = v.kind === "aporte" || v.kind === "resgate";
  const [pendente, iniciar] = useTransition();
  const avisar = useAvisar();
  const cats = v.kind === "saida" ? CATEGORIAS_SAIDA : CATEGORIAS_ENTRADA;
  const guardar = () => iniciar(async () => {
    const r = await editarLancamento(l.id, { kind: v.kind, amount: numeroBR(v.valor), description: v.description, category: v.category, happened_on: v.happened_on, paid: v.paid, investment_id: transferencia ? v.investment_id : null });
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
          <select className="input" value={v.category} onChange={(e) => setV({ ...v, category: e.target.value })} aria-label="Categoria">
            {[...new Set([v.category, ...cats])].map((c) => <option key={c}>{c}</option>)}
          </select>
        )}
        <input className="input" type="date" value={v.happened_on} onChange={(e) => setV({ ...v, happened_on: e.target.value })} aria-label="Data" />
        {transferencia ? <span /> : <label className="check-line"><input type="checkbox" checked={v.paid} onChange={(e) => setV({ ...v, paid: e.target.checked })} />{v.kind === "saida" ? "Pago" : "Recebido"}</label>}
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

export function GradeParcelas({ parcelamentos, hoje }: { parcelamentos: Parcelamento[]; hoje: string }) {
  const [pendente, iniciar] = useTransition();
  const [editar, setEditar] = useState<Parcelamento | null>(null);
  const avisar = useAvisar();
  const max = Math.max(1, ...parcelamentos.map((p) => p.installments));

  return (
    <>
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
                  <td><button type="button" className="tabela__nome" onClick={() => setEditar(p)}>{p.title}</button><small>{p.creditor ?? p.category}</small></td>
                  <td className="num">{moeda(s.parcela)}</td>
                  <td className="num">{p.paid_count}/{p.installments}</td>
                  <td className="num">{s.restante > 0 ? moeda(s.restante) : "—"}</td>
                  <td>{s.estado === "quitado" ? "Quitado" : mesCurto(s.ultima)}</td>
                  {Array.from({ length: max }, (_, i) => {
                    if (i >= p.installments) return <td key={i} className="grade__c grade__c--fora" />;
                    const vence = somarMeses(p.first_due, i);
                    const paga = i < p.paid_count;
                    const proxima = i === p.paid_count;
                    const ultimaPaga = i === p.paid_count - 1;
                    const devida = proxima && vence <= hoje;
                    return (
                      <td key={i} className="grade__c">
                        <button
                          type="button"
                          className={`grade__b${paga ? " is-paga" : ""}${proxima ? " is-proxima" : ""}${devida ? " is-devida" : ""}`}
                          title={`Parcela ${i + 1} · vence ${dataBR(vence)}${paga ? " · paga" : ""}`}
                          aria-label={`${p.title}, parcela ${i + 1}${paga ? ", paga" : ""}`}
                          disabled={pendente || !(proxima || ultimaPaga)}
                          onClick={() => iniciar(async () => {
                            if (proxima) {
                              const r = await pagarParcela(p.id);
                              if (r.ok) avisar({ texto: `${p.title}: parcela ${i + 1} paga.`, acao: { rotulo: "Desfazer", fazer: () => iniciar(() => desfazerParcela(p.id, r.lancamento)) } });
                            } else if (confirm(`Desmarcar a parcela ${i + 1} de ${p.title}?`)) {
                              await desfazerParcela(p.id);
                            }
                          })}
                        >
                          {paga ? <Check aria-hidden /> : <small>{mesCurto(vence).split("/")[0]}</small>}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="field__hint">Toque na próxima parcela para marcar como paga (o pagamento entra nos lançamentos de hoje). Toque na última paga para desmarcar. Clique no nome para corrigir.</p>
      {editar && <EditarParcelamento p={editar} fechar={() => setEditar(null)} />}
    </>
  );
}

function EditarParcelamento({ p, fechar }: { p: Parcelamento; fechar: () => void }) {
  const [v, setV] = useState({ title: p.title, total: String(p.total).replace(".", ","), n: String(p.installments), pagas: String(p.paid_count), first_due: p.first_due, creditor: p.creditor ?? "", category: p.category });
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  return (
    <Painel titulo="Corrigir parcelamento" fechar={fechar}>
      <form className="detail" style={{ gap: 14 }} onSubmit={(e) => {
        e.preventDefault(); setErro(null);
        iniciar(async () => {
          const r = await salvarParcelamento(p.id, { title: v.title, category: v.category, total: numeroBR(v.total), installments: Number(v.n), paid_count: Number(v.pagas), first_due: v.first_due, creditor: v.creditor || null, context_id: null });
          if (!r.ok) return setErro(r.erro ?? "Não foi possível guardar.");
          fechar();
        });
      }}>
        <label className="field">O que foi<input className="input" value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} maxLength={120} required /></label>
        <div className="fields">
          <label className="field">Valor total<input className="input" inputMode="decimal" value={v.total} onChange={(e) => setV({ ...v, total: e.target.value })} required /></label>
          <label className="field">Parcelas<input className="input" inputMode="numeric" value={v.n} onChange={(e) => setV({ ...v, n: e.target.value.replace(/\D/g, "") })} required /></label>
          <label className="field">Já pagas<input className="input" inputMode="numeric" value={v.pagas} onChange={(e) => setV({ ...v, pagas: e.target.value.replace(/\D/g, "") })} /></label>
        </div>
        <div className="fields">
          <label className="field">1ª parcela<input className="input" type="date" value={v.first_due} onChange={(e) => setV({ ...v, first_due: e.target.value })} required /></label>
          <label className="field">Onde ou com quem<input className="input" value={v.creditor} onChange={(e) => setV({ ...v, creditor: e.target.value })} maxLength={60} /></label>
          <label className="field">Categoria<select className="input" value={v.category} onChange={(e) => setV({ ...v, category: e.target.value })}>{[...new Set([v.category, ...CATEGORIAS_SAIDA])].map((c) => <option key={c}>{c}</option>)}</select></label>
        </div>
        {erro && <p className="note note--err" role="alert">{erro}</p>}
        <div className="detail__foot">
          <button className="btn" type="submit" disabled={pendente}>Guardar</button>
          <button className="btn btn--ghost" type="button" onClick={fechar}>Cancelar</button>
          <button className="btn btn--ghost btn--sm" type="button" style={{ marginLeft: "auto" }} onClick={() => { if (confirm(`Apagar o parcelamento "${p.title}"? Os pagamentos já lançados continuam.`)) iniciar(async () => { await apagarParcelamento(p.id); fechar(); }); }}><Trash2 aria-hidden />Apagar</button>
        </div>
      </form>
    </Painel>
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
