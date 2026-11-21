"use client";

import { useMemo, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Check, Pencil, Trash2, X } from "lucide-react";
import { apagarLancamento, apagarParcelamento, desfazerParcela, editarLancamento, pagarParcela, salvarParcelamento } from "@/app/(app)/acoes";
import { numeroBR } from "@/lib/datas";
import { CATEGORIAS_ENTRADA, CATEGORIAS_SAIDA, mesCurto, moeda, situacaoParcelamento, somarMeses, type Lancamento, type Parcelamento } from "@/lib/financas";
import { useAvisar } from "./Avisos";
import { Painel } from "./Comuns";

const dataBR = (iso: string) => iso.split("-").reverse().join("/");

// ---------- Lançamentos: tabela editável, com filtros e totais ----------

type Ordem = { campo: "happened_on" | "description" | "category" | "amount"; desc: boolean };

export function TabelaLancamentos({ lancamentos }: { lancamentos: Lancamento[] }) {
  const [busca, setBusca] = useState("");
  const [tipo, setTipo] = useState<"todos" | "entrada" | "saida">("todos");
  const [cat, setCat] = useState("");
  const [ordem, setOrdem] = useState<Ordem>({ campo: "happened_on", desc: true });
  const [editando, setEditando] = useState<string | null>(null);
  const categorias = useMemo(() => [...new Set(lancamentos.map((l) => l.category))].sort(), [lancamentos]);

  const linhas = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return lancamentos
      .filter((l) => (tipo === "todos" || l.kind === tipo) && (!cat || l.category === cat) && (!t || l.description.toLowerCase().includes(t) || l.category.toLowerCase().includes(t)))
      .sort((a, b) => {
        const va = ordem.campo === "amount" ? (a.kind === "saida" ? -a.amount : a.amount) : a[ordem.campo];
        const vb = ordem.campo === "amount" ? (b.kind === "saida" ? -b.amount : b.amount) : b[ordem.campo];
        const c = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb));
        return ordem.desc ? -c : c;
      });
  }, [lancamentos, busca, tipo, cat, ordem]);

  const pagos = linhas.filter((l) => l.paid);
  const entrou = pagos.filter((l) => l.kind === "entrada").reduce((s, l) => s + l.amount, 0);
  const saiu = pagos.filter((l) => l.kind === "saida").reduce((s, l) => s + l.amount, 0);
  const th = (campo: Ordem["campo"], rotulo: string, cls = "") => (
    <th className={cls}>
      <button type="button" onClick={() => setOrdem({ campo, desc: ordem.campo === campo ? !ordem.desc : campo === "happened_on" })}>
        {rotulo}{ordem.campo === campo && (ordem.desc ? <ArrowDown aria-hidden /> : <ArrowUp aria-hidden />)}
      </button>
    </th>
  );

  return (
    <div className="planilha">
      <div className="planilha__filtros">
        <input className="input" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar descrição ou categoria" aria-label="Buscar" />
        <div className="seg seg--sm" role="radiogroup" aria-label="Tipo">
          {(["todos", "saida", "entrada"] as const).map((t) => (
            <label key={t}><input type="radio" checked={tipo === t} onChange={() => setTipo(t)} /><span>{t === "todos" ? "Tudo" : t === "saida" ? "Saídas" : "Entradas"}</span></label>
          ))}
        </div>
        <select className="input" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Categoria">
          <option value="">Todas as categorias</option>
          {categorias.map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>
      <div className="planilha__tot">
        <span>{linhas.length} {linhas.length === 1 ? "lançamento" : "lançamentos"}</span>
        <span>Entrou <b className="pos">{moeda(entrou)}</b></span>
        <span>Saiu <b>{moeda(saiu)}</b></span>
        <span>Saldo <b className={entrou - saiu < 0 ? "neg" : "pos"}>{moeda(entrou - saiu)}</b></span>
      </div>
      <div className="planilha__rolo">
        <table className="tabela">
          <thead>
            <tr>{th("happened_on", "Data")}{th("description", "Descrição")}{th("category", "Categoria")}{th("amount", "Valor", "num")}<th>Situação</th><th aria-label="Ações" /></tr>
          </thead>
          <tbody>
            {linhas.map((l) => (editando === l.id ? <LinhaEditando key={l.id} l={l} fechar={() => setEditando(null)} /> : (
              <tr key={l.id} onDoubleClick={() => setEditando(l.id)} className={l.paid ? undefined : "is-aberto"}>
                <td className="tabela__data">{dataBR(l.happened_on)}</td>
                <td>{l.description}{l.installment_id ? <small> · parcela</small> : l.routine_id ? <small> · conta fixa</small> : null}</td>
                <td>{l.category}</td>
                <td className={`num ${l.kind === "entrada" ? "pos" : ""}`}>{l.kind === "saida" ? "−" : "+"}{moeda(l.amount)}</td>
                <td className="tabela__sit">{l.paid ? "Pago" : l.kind === "saida" ? "A pagar" : "A receber"}</td>
                <td className="tabela__acoes"><button type="button" className="icon-btn" aria-label={`Editar ${l.description}`} onClick={() => setEditando(l.id)}><Pencil size={14} /></button></td>
              </tr>
            )))}
            {!linhas.length && <tr><td colSpan={6} className="tabela__vazio">Nada neste período.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="field__hint">Clique duas vezes numa linha para editar. Enter guarda, Esc cancela.</p>
    </div>
  );
}

function LinhaEditando({ l, fechar }: { l: Lancamento; fechar: () => void }) {
  const [v, setV] = useState({ happened_on: l.happened_on, description: l.description, category: l.category, kind: l.kind, valor: String(l.amount).replace(".", ","), paid: l.paid });
  const [pendente, iniciar] = useTransition();
  const avisar = useAvisar();
  const cats = v.kind === "saida" ? CATEGORIAS_SAIDA : CATEGORIAS_ENTRADA;
  const guardar = () => iniciar(async () => {
    const r = await editarLancamento(l.id, { kind: v.kind, amount: numeroBR(v.valor), description: v.description, category: v.category, happened_on: v.happened_on, paid: v.paid });
    if (!r.ok) return avisar({ texto: r.erro ?? "Não foi possível guardar." });
    fechar();
  });
  const teclas = (e: React.KeyboardEvent) => { if (e.key === "Enter") { e.preventDefault(); guardar(); } if (e.key === "Escape") fechar(); };
  return (
    <tr className="is-editando" onKeyDown={teclas}>
      <td><input className="input" type="date" value={v.happened_on} onChange={(e) => setV({ ...v, happened_on: e.target.value })} aria-label="Data" /></td>
      <td><input className="input" value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} aria-label="Descrição" autoFocus maxLength={120} /></td>
      <td>
        <select className="input" value={v.category} onChange={(e) => setV({ ...v, category: e.target.value })} aria-label="Categoria">
          {[...new Set([v.category, ...cats])].map((c) => <option key={c}>{c}</option>)}
        </select>
      </td>
      <td className="num">
        <span className="tabela__valor">
          <select className="input" value={v.kind} onChange={(e) => setV({ ...v, kind: e.target.value as Lancamento["kind"] })} aria-label="Tipo"><option value="saida">−</option><option value="entrada">+</option></select>
          <input className="input" inputMode="decimal" value={v.valor} onChange={(e) => setV({ ...v, valor: e.target.value })} aria-label="Valor" />
        </span>
      </td>
      <td><label className="check-line"><input type="checkbox" checked={v.paid} onChange={(e) => setV({ ...v, paid: e.target.checked })} />Pago</label></td>
      <td className="tabela__acoes">
        <button type="button" className="icon-btn" aria-label="Guardar" disabled={pendente} onClick={guardar}><Check size={15} /></button>
        <button type="button" className="icon-btn" aria-label="Cancelar" onClick={fechar}><X size={15} /></button>
        <button type="button" className="icon-btn" aria-label="Apagar" disabled={pendente} onClick={() => { if (confirm(`Apagar "${l.description}"?`)) iniciar(async () => { await apagarLancamento(l.id); fechar(); }); }}><Trash2 size={14} /></button>
      </td>
    </tr>
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
