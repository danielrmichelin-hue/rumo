"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import Link from "next/link";

// Aviso do Book: toast em Deep, uma frase, com desfazer por 5 segundos quando houver.
export type Aviso = {
  texto: string;
  acao?: { rotulo: string; fazer: () => void };
  link?: { rotulo: string; href: string };
  /** não some sozinho (ex.: "Guardando…") */
  fixo?: boolean;
};

const Ctx = createContext<(a: Aviso | null) => void>(() => {});

export function useAvisar() {
  return useContext(Ctx);
}

export function AvisosProvider({ children }: { children: React.ReactNode }) {
  const [aviso, setAviso] = useState<(Aviso & { id: number }) | null>(null);
  const avisar = useCallback((a: Aviso | null) => setAviso(a ? { ...a, id: Date.now() } : null), []);

  useEffect(() => {
    if (!aviso || aviso.fixo) return;
    const t = setTimeout(() => setAviso(null), aviso.acao ? 5000 : 4000);
    return () => clearTimeout(t);
  }, [aviso]);

  return (
    <Ctx.Provider value={avisar}>
      {children}
      {aviso && (
        <div className="toast" role="status" key={aviso.id}>
          <span>{aviso.texto}</span>
          {aviso.acao && (
            <button type="button" onClick={() => { aviso.acao!.fazer(); setAviso(null); }}>{aviso.acao.rotulo}</button>
          )}
          {aviso.link && <Link href={aviso.link.href} onClick={() => setAviso(null)}>{aviso.link.rotulo}</Link>}
        </div>
      )}
    </Ctx.Provider>
  );
}
