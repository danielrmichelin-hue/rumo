import Link from "next/link";

/** Semana | Mês, no mesmo segmentado dos outros (o destaque desliza) */
export function AlternarVista({ vista, semana, mes }: { vista: "semana" | "mes"; semana: string; mes: string }) {
  return (
    <nav className="seg" aria-label="Ver por">
      <Link href={`/calendario?semana=${semana}`} aria-current={vista === "semana" ? "page" : undefined}>Semana</Link>
      <Link href={`/calendario?vista=mes&mes=${mes}`} aria-current={vista === "mes" ? "page" : undefined}>Mês</Link>
    </nav>
  );
}
