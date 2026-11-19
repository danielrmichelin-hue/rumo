/** O caminho da Rota em pontos (Book: vazios para o que falta, cheio para o que passou, anel no ponto atual) */
export function Caminho({ pct }: { pct: number }) {
  const feitos = Math.min(5, Math.floor(pct * 5 + 1e-9));
  return (
    <div className="path" style={{ "--done": `${Math.min(100, pct * 100)}%` } as React.CSSProperties} aria-label={`${Math.round(pct * 100)}% do caminho`}>
      {Array.from({ length: 6 }, (_, i) => (
        <i key={i} className={i < feitos ? "done" : i === feitos && i < 5 ? "now" : i === 5 ? (pct >= 1 ? "done" : "end") : ""} />
      ))}
    </div>
  );
}

export function Anel({ pct }: { pct: number }) {
  return <i className="ring" style={{ "--p": Math.round(pct * 100) } as React.CSSProperties} aria-hidden />;
}
