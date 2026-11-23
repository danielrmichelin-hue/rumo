"use client";

// Consultor: "posso comprar isto parcelado?" — o impacto, mês a mês, nas parcelas, na renda e no que sobra
import { useState } from "react";
import { Calculator } from "lucide-react";
import { numeroBR } from "@/lib/datas";
import { moeda } from "@/lib/financas";

export type BaseConsultor = {
  /** renda média e gasto do dia a dia (sem parcelas) dos últimos meses */
  renda: number;
  gasto: number;
  pctParcelas: number;
  pctInvestir: number;
  /** os próximos 12 meses: o nome e quanto já sai em parcelas em cada um */
  meses: { rotulo: string; parcelas: number }[];
};

export function Consultor({ base }: { base: BaseConsultor }) {
  const [valor, setValor] = useState("");
  const [vezes, setVezes] = useState("10");
  const [comeca, setComeca] = useState(1); // a partir de qual dos próximos meses (0 = este)
  const total = numeroBR(valor);
  const n = Math.max(1, Math.min(48, Number(vezes) || 1));
  const parcela = total > 0 ? Math.round((total / n) * 100) / 100 : 0;
  const limite = (base.renda * base.pctParcelas) / 100;
  const investir = (base.renda * base.pctInvestir) / 100;
  const linhas = base.meses.map((m, i) => {
    const nova = total > 0 && i >= comeca && i < comeca + n ? parcela : 0;
    const parcelas = m.parcelas + nova;
    const sobra = base.renda - parcelas - base.gasto;
    return { ...m, nova, total: parcelas, pct: base.renda ? parcelas / base.renda : 0, sobra };
  });
  const pior = linhas.reduce((a, b) => (b.sobra < a.sobra ? b : a), linhas[0]);
  const passaLimite = linhas.filter((l) => l.total > limite + 0.005).length;
  const veredito = !total ? null
    : pior.sobra < 0 ? { tom: "nao", t: "Não cabe", p: `Em ${pior.rotulo} faltariam ${moeda(-pior.sobra)}: as parcelas e os gastos de sempre passam da renda.` }
    : pior.sobra < investir || passaLimite ? { tom: "aperta", t: "Cabe, mas aperta", p: `${passaLimite ? `As parcelas passam de ${base.pctParcelas}% da renda em ${passaLimite} ${passaLimite === 1 ? "mês" : "meses"}. ` : ""}No pior mês (${pior.rotulo}) sobram ${moeda(pior.sobra)} para investir, de ${moeda(investir)} planejados.` }
    : { tom: "cabe", t: "Cabe", p: `As parcelas ficam dentro de ${base.pctParcelas}% da renda e ainda sobra o que você planeja investir. No pior mês sobram ${moeda(pior.sobra)}.` };
  const maior = Math.max(base.renda, ...linhas.map((l) => l.total + Math.max(0, base.gasto)), 1);

  return (
    <section className="bloco consultor">
      <h2 className="sec__h"><Calculator size={14} aria-hidden />Posso comprar parcelado?</h2>
      <div className="consultor__campos">
        <label className="field">Valor total<input className="input" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" /></label>
        <label className="field">Em quantas vezes<input className="input" inputMode="numeric" value={vezes} onChange={(e) => setVezes(e.target.value.replace(/\D/g, "").slice(0, 2))} /></label>
        <label className="field">1ª parcela em
          <select className="input" value={comeca} onChange={(e) => setComeca(Number(e.target.value))}>{base.meses.slice(0, 6).map((m, i) => <option key={m.rotulo} value={i}>{m.rotulo}</option>)}</select>
        </label>
      </div>
      <p className="consultor__base">Renda média {moeda(base.renda)} · gastos do dia a dia {moeda(base.gasto)} · limite de parcelas {moeda(limite)} ({base.pctParcelas}%)</p>
      {veredito && (
        <div className={`consultor__veredito consultor__veredito--${veredito.tom}`}>
          <b>{veredito.t}{parcela ? ` · ${n}x de ${moeda(parcela)}` : ""}</b>
          <span>{veredito.p}</span>
        </div>
      )}
      <ul className="consultor__meses" aria-label="Mês a mês">
        {linhas.map((l) => (
          <li key={l.rotulo} className={l.sobra < 0 ? "is-nao" : l.total > limite + 0.005 ? "is-aperta" : undefined}>
            <span className="consultor__barra" title={`Parcelas ${moeda(l.total)} · gastos ${moeda(base.gasto)} · renda ${moeda(base.renda)}`}>
              <i className="consultor__ja" style={{ height: `${(l.parcelas / maior) * 100}%` }} />
              <i className="consultor__nova" style={{ height: `${(l.nova / maior) * 100}%` }} />
              <i className="consultor__gasto" style={{ height: `${(Math.max(0, base.gasto) / maior) * 100}%` }} />
              <u style={{ bottom: `${(base.renda / maior) * 100}%` }} />
            </span>
            <small>{l.rotulo}</small>
            <em>{Math.round(l.pct * 100)}%</em>
          </li>
        ))}
      </ul>
      <p className="consultor__leg"><span><i className="consultor__ja" />Parcelas que já tem</span><span><i className="consultor__nova" />A nova</span><span><i className="consultor__gasto" />Gastos de sempre</span><span><u />Renda</span></p>
    </section>
  );
}
