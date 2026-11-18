"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sun, Inbox, CalendarDays, ListChecks, FolderKanban, Search, Plus, LogOut, Settings2 } from "lucide-react";
import { Captura, useAtalhoCaptura } from "./Captura";

export type ContextItem = { id: string; name: string; color: string };

const CORE = [
  { href: "/hoje", label: "Hoje", icon: Sun },
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/calendario", label: "Calendário", icon: CalendarDays },
  { href: "/responsabilidades", label: "Responsabilidades", icon: ListChecks },
  { href: "/projetos", label: "Projetos", icon: FolderKanban },
];

export function Shell({
  contexts,
  email,
  inbox,
  children,
}: {
  contexts: ContextItem[];
  email: string;
  inbox: number;
  children: React.ReactNode;
}) {
  const path = usePathname();
  const on = (href: string) => (path === href || path.startsWith(href + "/") ? "page" : undefined);
  const [captura, setCaptura] = useState(false);
  const abrir = useCallback(() => setCaptura(true), []);
  const fechar = useCallback(() => setCaptura(false), []);
  useAtalhoCaptura(abrir);

  return (
    <div className="shell">
      <aside className="side" aria-label="Navegação">
        <div className="side__brand">
          <img src="/brand/rumo-logo-horizontal.svg" alt="Rumo" className="logo-light" />
          <img src="/brand/rumo-logo-horizontal-light.svg" alt="Rumo" className="logo-dark" />
        </div>
        <Link href="/busca" className="side__search"><Search size={16} aria-hidden />Buscar<kbd>⌘ K</kbd></Link>
        {CORE.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className="nav" aria-current={on(href)}>
            <Icon aria-hidden />{label}
            {href === "/inbox" && inbox > 0 && <span className="nav__count" aria-label={`${inbox} a organizar`}>{inbox}</span>}
          </Link>
        ))}
        <div className="side__group">
          <span>Contextos</span>
          <Link href="/contextos" aria-label="Organizar contextos" title="Organizar contextos" aria-current={on("/contextos")}><Settings2 size={14} /></Link>
        </div>
        {contexts.length === 0 && <Link href="/contextos" className="nav nav--quiet"><Plus aria-hidden />Criar contextos</Link>}
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
      <button className="capture-fab" type="button" onClick={abrir} aria-keyshortcuts="C">
        <Plus aria-hidden />Capturar<kbd>C</kbd>
      </button>
      <nav className="tabbar" aria-label="Navegação">
        <Link href="/hoje" aria-current={on("/hoje")} aria-label="Hoje"><Sun /></Link>
        <Link href="/responsabilidades" aria-current={on("/responsabilidades")} aria-label="Responsabilidades"><ListChecks /></Link>
        <button type="button" className="add" aria-label="Capturar" onClick={abrir}><Plus /></button>
        <Link href="/inbox" aria-current={on("/inbox")} aria-label={inbox ? `Inbox, ${inbox} a organizar` : "Inbox"} className="tabbar__inbox">
          <Inbox />{inbox > 0 && <span className="tabbar__badge" aria-hidden />}
        </Link>
        <Link href="/busca" aria-current={on("/busca")} aria-label="Buscar"><Search /></Link>
      </nav>
      <Captura aberta={captura} abrir={abrir} fechar={fechar} contextos={contexts} />
    </div>
  );
}
