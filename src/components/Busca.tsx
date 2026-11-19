"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, CircleCheck, Folder, GraduationCap, NotebookPen, Repeat, Route, Search, Shapes, User } from "lucide-react";
import { buscar, type Achado } from "@/app/(app)/acoes";

const ICONE = { responsabilidade: CircleCheck, projeto: Folder, rota: Route, curso: GraduationCap, rotina: Repeat, nota: NotebookPen, contexto: Shapes, compromisso: CalendarDays, pessoa: User };
const GRUPO: Record<Achado["tipo"], string> = { responsabilidade: "Responsabilidades", projeto: "Projetos", rota: "Rotas", curso: "Estudos", rotina: "Rotinas", nota: "Notas", contexto: "Contextos", compromisso: "Compromissos", pessoa: "Pessoas" };

function destacar(texto: string, termo: string) {
  const i = texto.toLowerCase().indexOf(termo.toLowerCase());
  if (!termo || i < 0) return texto;
  return <>{texto.slice(0, i)}<mark>{texto.slice(i, i + termo.length)}</mark>{texto.slice(i + termo.length)}</>;
}

export function Busca({ inicial }: { inicial: string }) {
  const [q, setQ] = useState(inicial);
  const [achados, setAchados] = useState<Achado[]>([]);
  const [buscou, setBuscou] = useState(false);
  const [sel, setSel] = useState(0);
  const [pendente, iniciar] = useTransition();
  const router = useRouter();
  const campo = useRef<HTMLInputElement>(null);

  useEffect(() => { campo.current?.focus(); }, []);

  // Busca enquanto digita, com uma pequena pausa
  useEffect(() => {
    const termo = q.trim();
    if (termo.length < 2) { setAchados([]); setBuscou(false); return; }
    const t = setTimeout(() => {
      iniciar(async () => {
        const r = await buscar(termo);
        setAchados(r);
        setSel(0);
        setBuscou(true);
        window.history.replaceState(null, "", `/busca?q=${encodeURIComponent(termo)}`);
      });
    }, 180);
    return () => clearTimeout(t);
  }, [q]);

  const grupos = (Object.keys(GRUPO) as Achado["tipo"][]).map((tipo) => ({ tipo, itens: achados.filter((a) => a.tipo === tipo) })).filter((g) => g.itens.length);
  const ordem = grupos.flatMap((g) => g.itens);

  return (
    <>
      <div className="search">
        <Search aria-hidden />
        <input
          ref={campo}
          className="input"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(s + 1, ordem.length - 1)); }
            if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
            if (e.key === "Enter" && ordem[sel]) router.push(ordem[sel].href);
          }}
          placeholder="Onde eu anotei isso?"
          aria-label="Buscar"
          role="combobox"
          aria-expanded={achados.length > 0}
          aria-controls="resultados"
        />
      </div>

      <div id="resultados" role="listbox" aria-busy={pendente}>
        {q.trim().length < 2 && <p className="empty">Procure em responsabilidades, notas, projetos, contextos, compromissos e pessoas.</p>}
        {buscou && !achados.length && !pendente && <p className="empty"><b>Nada encontrado para “{q.trim()}”.</b>Tente outra palavra ou parte do nome.</p>}
        {grupos.map((g) => (
          <section key={g.tipo} className="sec" style={{ marginBottom: 20 }}>
            <h2 className="sec__h">{GRUPO[g.tipo]} {g.itens.length > 0 && <em>{g.itens.length}</em>}</h2>
            {g.itens.map((a) => {
              const Icon = ICONE[a.tipo];
              const i = ordem.indexOf(a);
              return (
                <Link key={`${a.tipo}${a.id}`} href={a.href} className="hit" role="option" aria-selected={i === sel} onMouseEnter={() => setSel(i)}>
                  <Icon aria-hidden />
                  <span>
                    <b>{destacar(a.titulo, q.trim())}</b>
                    <span className="props">{a.cor && <i className="dot" style={{ background: a.cor }} />}{a.detalhe}</span>
                  </span>
                </Link>
              );
            })}
          </section>
        ))}
        {achados.length > 0 && <p className="list-foot hide-mobile"><span><kbd>↑</kbd><kbd>↓</kbd> navegar</span><span><kbd>Enter</kbd> abrir</span></p>}
      </div>
    </>
  );
}
