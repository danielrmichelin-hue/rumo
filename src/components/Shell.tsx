"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CalendarDays, Folder, GraduationCap, HeartPulse, Home, Inbox, LayoutGrid, ListChecks, Menu, NotebookPen, Wallet, Plus, Repeat, Route, Search, Settings, Settings2, Shapes } from "lucide-react";
import { AvisosProvider } from "./Avisos";
import { Captura, useAtalhoCaptura } from "./Captura";
import { Logo } from "./Logo";
import { ehSaude } from "@/lib/saude";

export type EntradaModulo = { chave: "estudos" | "rotinas" | "rotas" | "notas" | "financas" | "saude"; n: number; quente?: boolean };

const MODULO: Record<EntradaModulo["chave"], { href: string; label: string; icon: typeof Home }> = {
  estudos: { href: "/estudos", label: "Estudos", icon: GraduationCap },
  rotinas: { href: "/rotinas", label: "Rotinas", icon: Repeat },
  rotas: { href: "/rotas", label: "Rotas", icon: Route },
  notas: { href: "/notas", label: "Notas", icon: NotebookPen },
  financas: { href: "/financas", label: "Finanças", icon: Wallet },
  saude: { href: "/saude", label: "Saúde", icon: HeartPulse },
};

export type ContextItem = { id: string; name: string; color: string; kind?: "empresa" | "area" };

type Props = {
  contexts: ContextItem[];
  nome: string;
  email: string;
  inbox: number;
  hoje: number;
  atencao: number;
  /** módulos ligados e disponíveis (hoje só "negocios") */
  negocios: boolean;
  /** Módulos ligados: uma entrada cada na lateral, com o número do dia */
  modulos: EntradaModulo[];
  children: React.ReactNode;
};

const CORE = [
  { href: "/hoje", label: "Hoje", icon: Home },
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/calendario", label: "Calendário", icon: CalendarDays },
  { href: "/responsabilidades", label: "Responsabilidades", icon: ListChecks },
  { href: "/projetos", label: "Projetos", icon: Folder },
];

export function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return "·";
  return (partes[0][0] + (partes.length > 1 ? partes[partes.length - 1][0] : partes[0][1] ?? "")).toUpperCase();
}

export function Shell({ contexts, nome, email, inbox, hoje, atencao, negocios, modulos, children }: Props) {
  const path = usePathname();
  const router = useRouter();
  const on = (href: string) => (path === href || path.startsWith(href + "/") ? "page" : undefined);
  const [captura, setCaptura] = useState(false);
  const [textoInicial, setTextoInicial] = useState("");
  const [contextoInicial, setContextoInicial] = useState<string | null>(null);
  // Dentro de um contexto, a captura já abre com ele escolhido
  const contextoDaPagina = path.match(/^\/contexto\/([0-9a-f-]{36})/)?.[1] ?? null;
  const abrir = useCallback(() => setCaptura(true), []);
  const fechar = useCallback(() => setCaptura(false), []);
  useAtalhoCaptura(abrir);

  // Botões "Nova" das páginas abrem a captura
  useEffect(() => {
    function onCapturar(e: Event) {
      const d = (e as CustomEvent<{ texto?: string; contexto?: string }>).detail;
      setTextoInicial(d?.texto ?? "");
      setContextoInicial(d?.contexto ?? null);
      abrir();
    }
    window.addEventListener("rumo:capturar", onCapturar);
    return () => window.removeEventListener("rumo:capturar", onCapturar);
  }, [abrir]);

  // ⌘K / Ctrl+K: busca
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        router.push("/busca");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  // Grupos da lateral: Negócios (contextos tipo empresa) e Áreas (tipo área). Grupo vazio não aparece.
  const empresas = contexts.filter((c) => c.kind === "empresa");
  // Com o módulo Finanças ou Saúde ligado, a área de mesmo nome não se repete na lateral (o módulo é a porta de entrada)
  const temFinancas = modulos.some((m) => m.chave === "financas");
  const temSaude = modulos.some((m) => m.chave === "saude");
  const areas = contexts.filter((c) => c.kind !== "empresa" && !(temFinancas && /finan/i.test(c.name)) && !(temSaude && ehSaude(c.name)));
  const grupos = [
    { titulo: negocios || empresas.length ? "Negócios" : "Contextos", itens: empresas },
    { titulo: "Áreas", itens: areas },
  ].filter((g) => g.itens.length);

  const contagem: Record<string, { n: number; hot?: boolean }> = {
    "/hoje": { n: hoje, hot: atencao > 0 },
    "/inbox": { n: inbox },
  };

  return (
    <AvisosProvider>
      <div className="shell">
        <aside className="side" aria-label="Navegação">
          <Link href="/hoje" className="side__brand" aria-label="Rumo, ir para o Hoje">
            <img src="/brand/rumo-logo-horizontal-light.svg" alt="Rumo" />
          </Link>
          <button type="button" className="side__capture" onClick={abrir} aria-keyshortcuts="C">
            <Plus aria-hidden />Capturar<kbd>C</kbd>
          </button>
          <Link href="/busca" className="side__search"><Search aria-hidden />Buscar<kbd>⌘K</kbd></Link>

          {CORE.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className="nav" aria-current={on(href)}>
              <Icon aria-hidden />
              <span className="nav__label">{label}</span>
              {!!contagem[href]?.n && (
                <span className={`nav__count${contagem[href].hot ? " nav__count--hot" : ""}`}>{contagem[href].n}</span>
              )}
            </Link>
          ))}

          {modulos.length > 0 && <div className="side__group"><span>Módulos</span></div>}
          {modulos.map((m) => {
            const { href, label, icon: Icon } = MODULO[m.chave];
            return (
              <Link key={m.chave} href={href} className="nav" aria-current={on(href)}>
                <Icon aria-hidden />
                <span className="nav__label">{label}</span>
                {m.n > 0 && <span className={`nav__count${m.quente ? " nav__count--hot" : ""}`}>{m.n}</span>}
              </Link>
            );
          })}

          {grupos.map((g, i) => (
            <div key={g.titulo}>
              <div className="side__group">
                <span>{g.titulo}</span>
                {i === 0 && <Link href="/contextos" aria-label="Organizar contextos" title="Organizar contextos"><Settings2 size={14} /></Link>}
              </div>
              {g.titulo === "Negócios" && g.itens.length > 1 && (
                <Link href="/negocios" className="nav" aria-current={on("/negocios")}><LayoutGrid aria-hidden /><span className="nav__label">Todas as empresas</span></Link>
              )}
              {g.itens.map((c) => (
                <Link key={c.id} href={`/contexto/${c.id}`} className="nav" aria-current={on(`/contexto/${c.id}`)}>
                  <i className="nav__dot" style={{ background: c.color }} />
                  <span className="nav__label">{c.name}</span>
                </Link>
              ))}
            </div>
          ))}
          {!grupos.length && (
            <>
              <div className="side__group"><span>Contextos</span></div>
              <Link href="/contextos" className="nav"><Plus aria-hidden /><span className="nav__label">Criar contextos</span></Link>
            </>
          )}

          <div className="side__foot">
            <Link href="/ajustes" className="side__me" aria-current={on("/ajustes")} title={email}>
              <i className="avatar" aria-hidden>{iniciais(nome)}</i>
              <span><b>{nome}</b><small>Ajustes</small></span>
              <Settings aria-hidden />
            </Link>
          </div>
        </aside>

        <header className="topbar">
          <Link href="/hoje" aria-label="Rumo, ir para o Hoje">
            <Logo forma="simbolo" alt="Rumo" />
          </Link>
          <Link href="/ajustes" className="avatar" aria-label="Ajustes">{iniciais(nome)}</Link>
        </header>

        <main className="main">{children}</main>

        <nav className="tabbar" aria-label="Navegação">
          <Link href="/hoje" aria-current={on("/hoje")}><Home aria-hidden />Hoje</Link>
          <Link href="/inbox" aria-current={on("/inbox")}>
            <Inbox aria-hidden />Inbox{inbox > 0 && <i className="tabbar__dot" aria-label={`${inbox} a organizar`} />}
          </Link>
          <button type="button" className="tabbar__add" onClick={abrir}><span><Plus aria-hidden /></span>Capturar</button>
          <Link href="/contextos" aria-current={on("/contextos") ?? on("/contexto")}><Shapes aria-hidden />Contextos</Link>
          <Link href="/mais" aria-current={on("/mais") ?? on("/responsabilidades") ?? on("/ajustes")}><Menu aria-hidden />Mais</Link>
        </nav>

        <Captura aberta={captura} abrir={abrir} fechar={() => { setTextoInicial(""); setContextoInicial(null); fechar(); }} contextos={contexts} textoInicial={textoInicial} contextoInicial={contextoInicial ?? contextoDaPagina} />
      </div>
    </AvisosProvider>
  );
}
