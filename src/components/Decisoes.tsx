"use client";

// Decisões: quitar uma dívida antes do prazo ou deixar o dinheiro rendendo (a conta da aba Decisões da planilha)
import { useState } from "react";
import { Scale } from "lucide-react";
import { numeroBR } from "@/lib/datas";
import { moeda, quitarOuManter, type Parcelamento } from "@/lib/financas";

const pct = (v: number) => String(Math.round(v * 10000) / 100).replace(".", ",");
const taxa = (v: string) => { const n = numeroBR(v); return Number.isFinite(n) && n >= 0 && n < 100 ? n / 100 : 0; };

export function Decisoes({ parcelamentos, investido, rende, porMes }: { parcelamentos: Parcelamento[]; investido: number; rende: number; porMes: number }) {
  const [id, setId] = useState(parcelamentos[0]?.id ?? "");
  const [juros, setJuros] = useState("0");
  const [rendimento, setRendimento] = useState(pct(rende));
  const p = parcelamentos.find((x) => x.id === id) ?? parcelamentos[0];
  if (!p) return null;
  const c = quitarOuManter(p, investido, taxa(juros), taxa(rendimento));
  const empate = Math.abs(c.diferenca) < 0.01;
  const melhor = empate ? "Dá no mesmo" : c.diferenca > 0 ? "Quitar agora é melhor" : "Manter as parcelas é melhor";
  const reserva = c.sobraInvestido >= porMes;

  return (
    <section className="bloco decisao">
      <h2 className="sec__h"><Scale size={14} aria-hidden />Quitar antes ou deixar rendendo?</h2>
      <div className="decisao__campos">
        <label className="field">Qual dívida
          <select className="input" value={p.id} onChange={(e) => setId(e.target.value)}>
            {parcelamentos.map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}
          </select>
        </label>
        <label className="field">Juros da dívida (% ao mês)<input className="input" inputMode="decimal" value={juros} onChange={(e) => setJuros(e.target.value)} /></label>
        <label className="field">Meu investimento rende (% ao mês)<input className="input" inputMode="decimal" value={rendimento} onChange={(e) => setRendimento(e.target.value)} /></label>
      </div>
      <p className="consultor__base">Falta pagar {moeda(c.restante)} em {c.n} {c.n === 1 ? "parcela" : "parcelas"} · investido hoje {moeda(investido)}{c.economia > 0 ? ` · quitando hoje sai ${moeda(c.custo)} (desconto de ${moeda(c.economia)})` : ""}</p>
      <div className="decisao__lados">
        <div className={!empate && c.diferenca > 0 ? "is-melhor" : undefined}>
          <small>Se eu quitar agora</small>
          <p>Sai hoje <b>{moeda(c.custo)}</b></p>
          <p>Fica investido <b>{moeda(c.sobraInvestido)}</b></p>
          <p>Libera por mês <b>{moeda(c.restante / c.n)}</b>, que vai para o investimento</p>
          <p className="decisao__fim">No fim das parcelas <b>{moeda(c.quitar)}</b></p>
        </div>
        <div className={!empate && c.diferenca < 0 ? "is-melhor" : undefined}>
          <small>Se eu mantiver as parcelas</small>
          <p>Sai hoje <b>{moeda(0)}</b></p>
          <p>Continua investido <b>{moeda(investido)}</b></p>
          <p>Pago por mês <b>{moeda(c.restante / c.n)}</b>, do salário</p>
          <p className="decisao__fim">No fim das parcelas <b>{moeda(c.manter)}</b></p>
        </div>
      </div>
      <div className={`consultor__veredito consultor__veredito--${c.sobraInvestido < 0 ? "nao" : "cabe"}`}>
        <b>{melhor}{empate ? "" : `: ${moeda(Math.abs(c.diferenca))} a mais no fim`}</b>
        <span>
          {c.sobraInvestido < 0 ? "O investido não cobre a quitação." : reserva ? `Mesmo quitando, sobram ${moeda(c.sobraInvestido)} investidos, mais de um mês de parcelas (${moeda(porMes)}).` : `Quitando, sobram ${moeda(c.sobraInvestido)} investidos: menos que um mês de parcelas (${moeda(porMes)}).`}
          {taxa(juros) === 0 && c.diferenca < 0 ? " Parcelado sem juros é dinheiro emprestado de graça: enquanto o seu rende, adiantar só faz você perder o rendimento." : ""}
        </span>
      </div>
    </section>
  );
}
