"use client";

import { useEffect, useState, useTransition } from "react";
import { Bell, BellOff, Send } from "lucide-react";
import { apagarInscricao, salvarInscricao, testarAviso } from "@/app/(app)/acoes";
import { CHAVE_AVISOS, chaveEmBytes } from "@/lib/avisos";
import { useAvisar } from "./Avisos";

type Estado = "carregando" | "instalar" | "sem-suporte" | "bloqueado" | "desligado" | "ligado";

/** Liga os avisos neste aparelho: resumo da manhã, compromissos, remédios e rotinas, contas e parcelas */
export function Notificacoes() {
  const [estado, setEstado] = useState<Estado>("carregando");
  const [pendente, iniciar] = useTransition();
  const avisar = useAvisar();

  useEffect(() => {
    (async () => {
      const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
      const instalado = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) return setEstado(ios && !instalado ? "instalar" : "sem-suporte");
      if (Notification.permission === "denied") return setEstado("bloqueado");
      const reg = await navigator.serviceWorker.register("/sw.js");
      setEstado((await reg.pushManager.getSubscription()) ? "ligado" : "desligado");
    })().catch(() => setEstado("sem-suporte"));
  }, []);

  const ligar = () => iniciar(async () => {
    if ((await Notification.requestPermission()) !== "granted") { setEstado("bloqueado"); return; }
    const reg = await navigator.serviceWorker.ready;
    const s = await reg.pushManager.getSubscription().then((x) => x ?? reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chaveEmBytes(CHAVE_AVISOS) })).catch(() => null);
    if (!s) { avisar({ texto: "O aparelho não aceitou a inscrição. Tente de novo." }); return; }
    const j = s.toJSON();
    const r = await salvarInscricao({ endpoint: s.endpoint, p256dh: j.keys?.p256dh ?? "", auth: j.keys?.auth ?? "" });
    if (!r.ok) { avisar({ texto: "Não foi possível ligar." }); return; }
    setEstado("ligado");
    await testarAviso();
  });

  const desligar = () => iniciar(async () => {
    const s = await (await navigator.serviceWorker.ready).pushManager.getSubscription();
    if (s) { await apagarInscricao(s.endpoint); await s.unsubscribe(); }
    setEstado("desligado");
  });

  const testar = () => iniciar(async () => { const r = await testarAviso(); avisar({ texto: r.ok ? "Enviado. Deve chegar em instantes." : "Não foi possível enviar." }); });

  return (
    <>
      <p className="field__hint">Resumo às 7h30, compromissos 15 min antes, remédios e rotinas no horário, contas e parcelas às 9h.</p>
      <div className="avisos__acoes">
        {estado === "desligado" && <button type="button" className="btn" onClick={ligar} disabled={pendente}><Bell aria-hidden />Ligar neste aparelho</button>}
        {estado === "ligado" && (
          <>
            <span className="avisos__ok"><Bell aria-hidden />Ligadas neste aparelho</span>
            <button type="button" className="btn btn--line" onClick={testar} disabled={pendente}><Send aria-hidden />Enviar teste</button>
            <button type="button" className="btn btn--ghost" onClick={desligar} disabled={pendente}><BellOff aria-hidden />Desligar</button>
          </>
        )}
        {estado === "instalar" && <p className="avisos__msg">No iPhone, os avisos só funcionam com o Rumo na Tela de Início: no Safari, toque em Compartilhar e depois em “Adicionar à Tela de Início”. Abra pelo ícone e volte aqui.</p>}
        {estado === "bloqueado" && <p className="avisos__msg">As notificações do Rumo estão bloqueadas. Libere nos ajustes do aparelho (Notificações › Rumo) e volte aqui.</p>}
        {estado === "sem-suporte" && <p className="avisos__msg">Este navegador não recebe notificações.</p>}
      </div>
    </>
  );
}
