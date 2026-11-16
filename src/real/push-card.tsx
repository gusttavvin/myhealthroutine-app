"use client";

import { Bell, BellOff, BellRing, Check, Share } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "./api";
import { enablePush, pushState, type PushState } from "./push";

function ua() {
  return typeof navigator === "undefined" ? "" : navigator.userAgent;
}
const isIos = () => /iphone|ipad|ipod/i.test(ua());
const isAndroid = () => /android/i.test(ua());
const isStandalone = () =>
  typeof window !== "undefined" &&
  (window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true);

/** Passo a passo para liberar as notificações, conforme o aparelho. */
function unblockSteps() {
  if (isAndroid()) return "No Chrome do celular: toque no ícone à esquerda do endereço do site → Permissões → Notificações → Permitir.";
  if (isIos()) return "No iPhone: abra Ajustes → Notificações → MyHealth e ligue “Permitir Notificações”.";
  return "No computador: clique no cadeado (ou no ícone de ajustes) à esquerda do endereço do site → Notificações → Permitir. No Windows, confira também se as notificações do navegador estão ligadas em Configurações → Sistema → Notificações.";
}

/**
 * Cartão dos avisos (notificações) neste aparelho: ligar, explicar como liberar
 * quando estão bloqueados e enviar um aviso de teste.
 */
export function PushCard({ as, big = false, when = "off" }: { as: "device" | "user"; big?: boolean; when?: "off" | "on" | "always" }) {
  const showWhenOn = when !== "off";
  const [state, setState] = useState<PushState | "loading">("loading");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    pushState().then(setState);
  }, []);

  async function turnOn() {
    setBusy(true);
    setMsg(null);
    try {
      const s = await enablePush(as);
      setState(s);
      if (s === "off") setMsg({ ok: false, text: "O pedido de permissão foi fechado. Toque de novo e escolha “Permitir”." });
      if (s === "on") setMsg({ ok: true, text: "Avisos ligados neste aparelho." });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Não foi possível ligar os avisos." });
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await api<{ delivered: number }>("/push/test", { method: "POST", as });
      setMsg(
        r.delivered > 0
          ? { ok: true, text: "Aviso de teste enviado. Ele deve aparecer em alguns segundos." }
          : { ok: false, text: "O aviso não chegou. Toque em “Ligar os avisos de novo”." },
      );
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Tente de novo." });
    } finally {
      setBusy(false);
    }
  }

  const btnClass = big ? "elder-primary" : "btn primary wide";
  const linkClass = big ? "elder-link" : "btn ghost wide";
  const feedback = msg ? <em className={msg.ok ? "push-ok" : "field-error"}>{msg.text}</em> : null;

  if (state === "loading") return null;
  if (when === "on" && state !== "on") return null;

  if (state === "on") {
    if (!showWhenOn) return null;
    return (
      <div className={`push-card on ${big ? "big" : ""}`}>
        <BellRing size={big ? 30 : 20} />
        <p>
          <Check size={16} /> Os avisos estão ligados neste aparelho.
        </p>
        {feedback}
        <button type="button" className={btnClass} onClick={test} disabled={busy}>
          <Bell size={big ? 26 : 16} /> {busy ? "Enviando…" : "Enviar aviso de teste"}
        </button>
        <button type="button" className={linkClass} onClick={turnOn} disabled={busy}>
          Ligar os avisos de novo
        </button>
      </div>
    );
  }

  if (state === "unsupported") {
    if (isIos() && !isStandalone()) {
      return (
        <div className={`push-card ${big ? "big" : ""}`}>
          <Share size={big ? 30 : 20} />
          <p>
            Para receber os avisos no iPhone, toque em <strong>Compartilhar</strong> e depois em <strong>Adicionar à Tela de Início</strong>. Abra o aplicativo
            pelo ícone novo.
          </p>
        </div>
      );
    }
    return showWhenOn ? (
      <div className={`push-card warn ${big ? "big" : ""}`}>
        <BellOff size={big ? 30 : 20} />
        <p>Este navegador não recebe avisos. Use o Google Chrome, o Edge ou o Firefox.</p>
      </div>
    ) : null;
  }

  if (state === "denied") {
    return (
      <div className={`push-card warn ${big ? "big" : ""}`}>
        <BellOff size={big ? 30 : 20} />
        <p>
          <strong>Os avisos estão bloqueados neste navegador.</strong> {unblockSteps()}
        </p>
        {feedback}
        <button
          type="button"
          className={btnClass}
          disabled={busy}
          onClick={async () => {
            const s = await pushState();
            if (s === "denied") setMsg({ ok: false, text: "Ainda está bloqueado. Depois de liberar, recarregue a página." });
            else await turnOn();
          }}
        >
          <Check size={big ? 26 : 16} /> Já liberei
        </button>
      </div>
    );
  }

  return (
    <div className={`push-card ${big ? "big" : ""}`}>
      <Bell size={big ? 30 : 20} />
      <p>
        {as === "device"
          ? "Ligue os avisos para o aparelho tocar na hora do remédio, mesmo com o aplicativo fechado."
          : "Ligue os avisos para saber quando um remédio não for confirmado ou estiver acabando."}
      </p>
      {feedback}
      <button type="button" className={btnClass} disabled={busy} onClick={turnOn}>
        <Bell size={big ? 28 : 18} /> {busy ? "Ligando…" : "Ligar os avisos"}
      </button>
      <small className="push-note">O navegador vai perguntar: escolha “Permitir”.</small>
    </div>
  );
}
