"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sun, Inbox, CalendarDays, ListChecks, FolderKanban, Search, Plus, LogOut } from "lucide-react";

export type ContextItem = { id: string; name: string; color: string };

const CORE = [
  { href: "/hoje", label: "Hoje", icon: Sun },
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/calendario", label: "Calendário", icon: CalendarDays },
  { href: "/responsabilidades", label: "Responsabilidades", icon: ListChecks },
  { href: "/projetos", label: "Projetos", icon: FolderKanban },
];

export function Shell({ contexts, email, children }: { contexts: ContextItem[]; email: string; children: React.ReactNode }) {
  const path = usePathname();
  const on = (href: string) => (path === href || path.startsWith(href + "/") ? "page" : undefined);

  return (
    <div className="shell">
      <aside className="side" aria-label="Navegação">
        <div className="side__brand">
          <img src="/brand/rumo-logo-horizontal.svg" alt="Rumo" className="logo-light" />
          <img src="/brand/rumo-logo-horizontal-light.svg" alt="Rumo" className="logo-dark" />
        </div>
        <Link href="/busca" className="side__search"><Search size={16} aria-hidden />Buscar<kbd>⌘ K</kbd></Link>
        {CORE.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className="nav" aria-current={on(href)}><Icon aria-hidden />{label}</Link>
        ))}
        <p className="side__group">Contextos</p>
        {contexts.length === 0 && <p className="nav" style={{ color: "var(--text-3)" }}>Nenhum ainda</p>}
        {contexts.map((c) => (
          <Link key={c.id} href={`/contexto/${c.id}`} className="nav" aria-current={on(`/contexto/${c.id}`)}>
            <i className="nav__dot" style={{ background: c.color }} />{c.name}
          </Link>
        ))}
        <div className="side__foot">
          <span title={email}>{email.split("@")[0]}</span>
          <form action="/auth/sair" method="post"><button type="submit" aria-label="Sair"><LogOut size={16} /></button></form>
        </div>
      </aside>
      <main className="main">{children}</main>
      <button className="capture-fab" type="button"><Plus aria-hidden />Capturar</button>
      <nav className="tabbar" aria-label="Navegação">
        <Link href="/hoje" aria-current={on("/hoje")} aria-label="Hoje"><Sun /></Link>
        <Link href="/calendario" aria-current={on("/calendario")} aria-label="Calendário"><CalendarDays /></Link>
        <button type="button" className="add" aria-label="Capturar"><Plus /></button>
        <Link href="/inbox" aria-current={on("/inbox")} aria-label="Inbox"><Inbox /></Link>
        <Link href="/busca" aria-current={on("/busca")} aria-label="Buscar"><Search /></Link>
      </nav>
    </div>
  );
}
