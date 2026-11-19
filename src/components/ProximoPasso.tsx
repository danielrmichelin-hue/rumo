"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarClock, Check, Clock, Folder, Hourglass, MapPin } from "lucide-react";
import { adiar, cobrar, concluir, restaurarData, type Adiamento } from "@/app/(app)/acoes";
import { hojeISO, rotuloData } from "@/lib/datas";
import type { ProximoPasso as Tipo } from "@/lib/hoje";
import { useAvisar } from "./Avisos";
import type { ContextItem } from "./Shell";

/** Abre a captura de qualquer lugar (a casca escuta este evento). `texto` já vem escrito na caixa. */
export function BotaoNova({ texto, rotulo = "Nova", variante = "btn", icone }: { texto?: string; rotulo?: string; variante?: string; icone?: React.ReactNode }) {
  return (
    <button type="button" className={variante} onClick={() => window.dispatchEvent(new CustomEvent("rumo:capturar", { detail: { texto } }))}>
      {icone}{rotulo}{variante === "btn" && <kbd>C</kbd>}
    </button>
  );
}

export function ProximoPasso({ proximo, contextos, projeto, rota }: { proximo: Tipo; contextos: ContextItem[]; projeto?: string; rota?: { title: string; pct: number } }) {
  const [pendente, iniciar] = useTransition();
  const [menu, setMenu] = useState(false);
  const avisar = useAvisar();
  const router = useRouter();
  const hoje = hojeISO();

  const simbolo = (
    <span className="next__k">
      <img src="/brand/rumo-symbol.svg" alt="" className="logo-light" />
      <img src="/brand/rumo-symbol-light.svg" alt="" className="logo-dark" />
      Próximo passo
    </span>
  );

  if (proximo.tipo === "compromisso") {
    const e = proximo.evento;
    const ctx = contextos.find((c) => c.id === e.context_id);
    return (
      <section className="next" aria-label="Próximo passo">
        <div>
          {simbolo}
          <span className="next__t">{e.title}</span>
          <span className="props">
            <span className="prop"><CalendarClock aria-hidden />{proximo.minutos < 1 ? "Começa agora" : `Em ${proximo.minutos} min`}</span>
            {ctx && <span className="prop"><i className="dot" style={{ background: ctx.color }} />{ctx.name}</span>}
            {e.location && <span className="prop"><MapPin aria-hidden />{e.location}</span>}
          </span>
        </div>
      </section>
    );
  }

  const item = proximo.item;
  const ctx = contextos.find((c) => c.id === item.context_id);
  const aguardando = item.state === "aguardando";

  function feito() {
    iniciar(async () => {
      await concluir(item.id, true);
      avisar({ texto: "Concluída.", acao: { rotulo: "Desfazer", fazer: () => iniciar(() => concluir(item.id, false)) } });
    });
  }
  function cobrado() {
    iniciar(async () => {
      const r = await cobrar(item.id);
      avisar({ texto: `Cobrança registrada. A próxima fica para ${rotuloData(r.depois, hoje)}.`, acao: { rotulo: "Desfazer", fazer: () => iniciar(() => restaurarData(item.id, "follow_up_on", r.antes)) } });
    });
  }
  function adiado(para: Adiamento) {
    setMenu(false);
    iniciar(async () => {
      const r = await adiar(item.id, para);
      if (!r) return;
      avisar({ texto: `Adiada para ${rotuloData(r.depois, hoje)}.`, acao: { rotulo: "Desfazer", fazer: () => iniciar(() => restaurarData(item.id, r.campo, r.antes)) } });
      router.refresh();
    });
  }

  return (
    <section className="next" aria-label="Próximo passo">
      <div>
        {simbolo}
        <Link href={`/responsabilidades/${item.id}`} className="next__t">{item.title}</Link>
        <span className="props">
          <span className="prop">{aguardando ? <Hourglass aria-hidden /> : <Clock aria-hidden />}{proximo.porque}</span>
          {aguardando && item.waiting_note && <span className="prop">{item.waiting_note}</span>}
          {ctx && <span className="prop"><i className="dot" style={{ background: ctx.color }} />{ctx.name}</span>}
          {projeto && <span className="prop"><Folder aria-hidden />{projeto}</span>}
          {rota && <span className="prop"><i className="ring" style={{ "--p": Math.round(rota.pct * 100) } as React.CSSProperties} aria-hidden />Rota · {rota.title}</span>}
        </span>
      </div>
      <div className="next__act">
        <div style={{ position: "relative" }}>
          <button type="button" className="btn btn--line" onClick={() => setMenu(!menu)} aria-expanded={menu} disabled={pendente}>Adiar</button>
          {menu && (
            <div className="popover" role="menu">
              <button type="button" role="menuitem" onClick={() => adiado("amanha")}>Amanhã</button>
              <button type="button" role="menuitem" onClick={() => adiado("segunda")}>Próxima semana</button>
            </div>
          )}
        </div>
        {aguardando ? (
          <button type="button" className="btn" onClick={cobrado} disabled={pendente}>Cobrar</button>
        ) : (
          <button type="button" className="btn" onClick={feito} disabled={pendente}><Check aria-hidden />Concluir</button>
        )}
      </div>
    </section>
  );
}
