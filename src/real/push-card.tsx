"use client";

import { Bell, BellOff, Share } from "lucide-react";
import { useEffect, useState } from "react";
import { enablePush, pushState, type PushState } from "./push";

function isIos() {
  return typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent);
}
function isStandalone() {
  return typeof window !== "undefined" && (window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true);
}

/** Cartão para ligar os avisos (notificações) neste aparelho. Some quando já estão ligados. */
export function PushCard({ as, big = false }: { as: "device" | "user"; big?: boolean }) {
  const [state, setState] = useState<PushState | "loading">("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    pushState().then(setState);
  }, []);

  if (state === "loading" || state === "on") return null;

  if (state === "unsupported") {
    if (isIos() && !isStandalone()) {
      return (
        <div className={`push-card ${big ? "big" : ""}`}>
          <Share size={big ? 30 : 20} />
          <p>
            Para receber os avisos no iPhone, toque em <strong>Compartilhar</strong> e depois em <strong>Adicionar à Tela de Início</strong>. Abra o aplicativo pelo ícone novo.
          </p>
        </div>
      );
    }
    return null;
  }

  if (state === "denied") {
    return (
      <div className={`push-card warn ${big ? "big" : ""}`}>
        <BellOff size={big ? 30 : 20} />
        <p>Os avisos estão bloqueados neste navegador. Libere as notificações deste site nas configurações do navegador.</p>
      </div>
    );
  }

  return (
    <div className={`push-card ${big ? "big" : ""}`}>
      <Bell size={big ? 30 : 20} />
      <p>
        {as === "device"
          ? "Ligue os avisos para o celular tocar na hora do remédio, mesmo com o aplicativo fechado."
          : "Ligue os avisos para saber quando um remédio não for confirmado ou estiver acabando."}
      </p>
      {error ? <em className="field-error">{error}</em> : null}
      <button
        type="button"
        className={big ? "elder-primary" : "btn primary wide"}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            setState(await enablePush(as));
          } catch (e) {
            setError(e instanceof Error ? e.message : "Não foi possível ligar os avisos.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <Bell size={big ? 28 : 18} /> {busy ? "Ligando…" : "Ligar os avisos"}
      </button>
    </div>
  );
}
