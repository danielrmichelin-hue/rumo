"use client";

// O "filme" da tela de entrada: em quatro atos, o problema que o Rumo resolve, em loop.
// 1) tudo espalhado · 2) tudo num lugar só · 3) o que importa agora · 4) a assinatura com o símbolo oficial.
// Feito com HTML e CSS (leve, nítido, nas cores da marca). Pausa quando a aba não está visível.
// Com "reduzir movimento" no aparelho, mostra só o ato 3 parado.
import { useEffect, useState } from "react";

type Fragmento = { titulo: string; detalhe: string; cor: string; caos: [number, number, number]; destaque?: boolean };

// Na ordem da lista do ato 2; o destaque vira o próximo passo no ato 3
const FRAGMENTOS: Fragmento[] = [
  { titulo: "Revisar a proposta do cliente", detalhe: "Hoje, 10:00 · Trabalho", cor: "#7B61E8", caos: [140, 172, -3], destaque: true },
  { titulo: "Cobrar o retorno do contador", detalhe: "Aguardando há 3 dias", cor: "#E08A4A", caos: [0, 14, -5] },
  { titulo: "Pagar o condomínio", detalhe: "Dia 10 · Casa", cor: "#3E9D72", caos: [150, 60, 4] },
  { titulo: "Prova do concurso", detalhe: "Em 40 dias · Estudos", cor: "#4C8BD8", caos: [8, 262, 4] },
  { titulo: "Academia", detalhe: "3 de 4 nesta semana · Saúde", cor: "#D46AA6", caos: [150, 308, -4] },
  { titulo: "Guardar R$ 5.000", detalhe: "Rota · 62% do caminho", cor: "#6C4ED9", caos: [0, 118, 6] },
];

const ATOS = [
  { duracao: 4600, legenda: "Tudo o que depende de você fica espalhado.", apoio: "Na cabeça, no WhatsApp, em papéis soltos." },
  { duracao: 4600, legenda: "O Rumo junta tudo em um só lugar.", apoio: "Trabalho, casa, saúde, estudos e metas." },
  { duracao: 5200, legenda: "E mostra o que importa agora.", apoio: "Um próximo passo de cada vez, sem culpa." },
  { duracao: 4200, legenda: "Clareza para o seu próximo passo.", apoio: "Rumo · tudo o que depende de você, em um só lugar." },
];

export function FilmeRumo() {
  const [ato, setAto] = useState(0);
  const [volta, setVolta] = useState(0);
  const [parado, setParado] = useState(false);

  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setParado(true);
      setAto(2);
      return;
    }
    let tempo: ReturnType<typeof setTimeout>;
    let atual = 0;
    const seguir = () => {
      tempo = setTimeout(() => {
        if (document.hidden) return seguir();
        atual = (atual + 1) % ATOS.length;
        if (atual === 0) setVolta((v) => v + 1);
        setAto(atual);
        seguir();
      }, ATOS[atual].duracao);
    };
    seguir();
    return () => clearTimeout(tempo);
  }, []);

  return (
    <div className="filme" data-ato={ato} data-parado={parado || undefined} aria-hidden>
      {!parado && (
        <div className="filme__barras">
          {ATOS.map((a, i) => (
            <i key={i} className={i < ato ? "is-feito" : i === ato ? "is-agora" : undefined}>
              <b key={`${volta}-${ato}`} style={{ animationDuration: `${a.duracao}ms` }} />
            </i>
          ))}
        </div>
      )}

      <div className="filme__palco">
        <div className="filme__cartao">
          <span className="filme__cab">
            <span className="filme__cab-um">Hoje · quinta</span>
            <span className="filme__cab-dois">Próximo passo</span>
          </span>
        </div>
        {FRAGMENTOS.map((f, i) => (
          <div
            key={f.titulo}
            className={`frag${f.destaque ? " frag--destaque" : ""}`}
            style={{ "--cx": `${f.caos[0]}px`, "--cy": `${f.caos[1]}px`, "--cr": `${f.caos[2]}deg`, "--ly": `${54 + i * 48}px`, "--i": i } as React.CSSProperties}
          >
            <span className="frag__corpo">
              <span className="frag__check" />
              <span className="frag__txt">
                <b>{f.titulo}</b>
                <small><i style={{ background: f.cor }} />{f.detalhe}</small>
              </span>
            </span>
          </div>
        ))}
        <img src="/brand/rumo-symbol-light.svg" alt="" className="filme__simbolo" />
      </div>

      <div className="filme__legenda" key={`${volta}-${ato}`}>
        <p>{ATOS[ato].legenda}</p>
        <small>{ATOS[ato].apoio}</small>
      </div>
    </div>
  );
}
