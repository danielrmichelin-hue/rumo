import Link from "next/link";
import { CalendarDays, ChevronRight, Folder, GraduationCap, ListChecks, Repeat, Route, Search, Settings, Shapes } from "lucide-react";

export const metadata = { title: "Mais" };

const ITENS = [
  { href: "/responsabilidades", label: "Responsabilidades", Icon: ListChecks },
  { href: "/projetos", label: "Projetos", Icon: Folder },
  { href: "/rotas", label: "Rotas", Icon: Route },
  { href: "/estudos", label: "Estudos", Icon: GraduationCap },
  { href: "/rotinas", label: "Rotinas", Icon: Repeat },
  { href: "/calendario", label: "Calendário", Icon: CalendarDays },
  { href: "/busca", label: "Buscar", Icon: Search },
  { href: "/contextos", label: "Contextos", Icon: Shapes },
  { href: "/ajustes", label: "Ajustes", Icon: Settings },
];

export default function Page() {
  return (
    <div className="page page--narrow">
      <div className="page__head"><h1 className="page__t">Mais</h1></div>
      <ul className="menu">
        {ITENS.map(({ href, label, Icon }) => (
          <li key={href}><Link href={href}><Icon aria-hidden />{label}<ChevronRight aria-hidden style={{ marginLeft: "auto" }} /></Link></li>
        ))}
      </ul>
    </div>
  );
}
