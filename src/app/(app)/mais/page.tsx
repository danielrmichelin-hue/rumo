import Link from "next/link";
import { Building2, CalendarDays, CalendarRange, ChevronRight, Folder, GraduationCap, HeartPulse, ListChecks, NotebookPen, Repeat, Wallet, Route, Search, Settings, Shapes } from "lucide-react";

export const metadata = { title: "Mais" };

const ITENS = [
  { href: "/semana", label: "Planejar a semana", Icon: CalendarRange },
  { href: "/responsabilidades", label: "Tarefas", Icon: ListChecks },
  { href: "/projetos", label: "Projetos", Icon: Folder },
  { href: "/rotas", label: "Rotas", Icon: Route },
  { href: "/estudos", label: "Estudos", Icon: GraduationCap },
  { href: "/rotinas", label: "Rotinas", Icon: Repeat },
  { href: "/notas", label: "Notas", Icon: NotebookPen },
  { href: "/financas", label: "Finanças", Icon: Wallet },
  { href: "/saude", label: "Saúde", Icon: HeartPulse },
  { href: "/negocios", label: "Negócios", Icon: Building2 },
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
