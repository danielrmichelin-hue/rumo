"use client";

// O símbolo oficial do Rumo montado peça por peça na tela de entrada.
// As três formas são as do arquivo oficial public/brand/rumo-symbol-light.svg, copiadas sem nenhuma alteração:
// só a entrada e a posição mudam, nunca o desenho. Book 10.7: a montagem acontece uma vez; depois o símbolo só
// responde ao movimento do ponteiro (até 8 px). Com "reduzir movimento" no aparelho, fica parado.
import { useEffect, useRef } from "react";

const PECAS = [
  // haste, cuia de cima e perna, na ordem em que entram
  { classe: "peca peca--haste", fator: 0.35, d: "M44.75 68.01L42.78 68.13L41.13 68.35L39.51 68.67L38.56 68.90L37.63 69.17L36.10 69.69L34.63 70.30L33.21 71.00L32.38 71.45L31.58 71.94L30.28 72.81L29.53 73.37L28.81 73.95L27.65 74.98L26.99 75.64L26.35 76.31L25.74 77.01L25.16 77.73L24.25 78.98L23.74 79.76L23.26 80.56L22.53 81.93L22.01 83.07L21.54 84.23L21.13 85.43L20.87 86.34L20.56 87.58L20.32 88.85L20.15 90.14L20.06 91.12L20.00 92.78L20.00 116.71L20.02 116.98L46.70 97.27L46.80 97.00L46.80 88.04L46.05 87.00L45.21 85.69L44.49 84.37L43.87 83.03L43.35 81.67L42.95 80.30L42.67 78.92L42.50 77.53L42.45 76.19L42.48 75.23L42.62 73.89L42.79 72.98L43.14 71.62L43.62 70.28L44.22 68.96Z" },
  { classe: "peca peca--topo", fator: 0.6, d: "M18 19H75.5C90.7 19 102 30.1 102 44.8C102 59.3 90.7 70 75.7 70H52.1L18 19Z" },
  { classe: "peca peca--perna", fator: 1, d: "M46.4 68H69.8L108.5 116.5H79.3C74.7 116.5 71.3 114.8 68.4 111.4L48.8 88.3C43.3 81.8 42.2 74.4 46.4 68Z" },
];

export function SimboloAnimado() {
  const raiz = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const svg = raiz.current;
    const painel = svg?.closest("section");
    if (!svg || !painel || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let quadro = 0;
    const mover = (e: PointerEvent) => {
      const r = painel.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width - 0.5) * 2; // -1 a 1
      const y = ((e.clientY - r.top) / r.height - 0.5) * 2;
      cancelAnimationFrame(quadro);
      quadro = requestAnimationFrame(() => {
        svg.style.setProperty("--px", x.toFixed(3));
        svg.style.setProperty("--py", y.toFixed(3));
      });
    };
    const sair = () => {
      svg.style.setProperty("--px", "0");
      svg.style.setProperty("--py", "0");
    };
    painel.addEventListener("pointermove", mover);
    painel.addEventListener("pointerleave", sair);
    return () => {
      cancelAnimationFrame(quadro);
      painel.removeEventListener("pointermove", mover);
      painel.removeEventListener("pointerleave", sair);
    };
  }, []);

  return (
    <svg ref={raiz} className="auth__symbol simbolo" viewBox="0 0 128 128" aria-hidden focusable="false">
      <defs>
        <linearGradient id="simbolo-luz" x1="18" y1="19" x2="108" y2="117" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#DCCEF6" />
          <stop offset="0.55" stopColor="#B9A6EE" />
          <stop offset="1" stopColor="#F8F7F4" />
        </linearGradient>
      </defs>
      {PECAS.map((p) => (
        <g key={p.classe} className="peca-pos" style={{ "--f": p.fator } as React.CSSProperties}>
          <path className={p.classe} d={p.d} fill="url(#simbolo-luz)" />
        </g>
      ))}
    </svg>
  );
}
