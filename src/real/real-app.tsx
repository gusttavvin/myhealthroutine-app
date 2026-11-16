"use client";

import { HeartHandshake, Info, Sun, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { ApiError, api, tokens } from "./api";
import { ElderReal } from "./elder-real";
import { FamilyReal } from "./family-real";
import { registerServiceWorker } from "./push";

type Role = "loading" | "welcome" | "elder" | "family";

// Modo escolhido neste aparelho. Trocar de modo não apaga o vínculo do celular do idoso.
const MODE_KEY = "mhr-modo";
function savedMode() {
  try {
    return localStorage.getItem(MODE_KEY);
  } catch {
    return null;
  }
}
function saveMode(mode: "idoso" | "familiar") {
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch {
    /* sem armazenamento */
  }
}

export function RealApp() {
  const [role, setRole] = useState<Role>("loading");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    registerServiceWorker();
    const mode = savedMode();
    if (mode === "familiar") setRole("family");
    else setRole(tokens.device() ? "elder" : tokens.session() ? "family" : "welcome");
  }, []);

  function toFamily() {
    saveMode("familiar");
    setRole("family");
  }

  function toElder() {
    saveMode("idoso");
    setRole("elder");
  }

  async function startElder() {
    // Este aparelho já é o celular do idoso: só volta para ele, sem criar outro.
    if (tokens.device()) return toElder();
    setBusy(true);
    setError("");
    try {
      const r = await api<{ deviceToken: string }>("/device/register", { method: "POST" });
      tokens.setDevice(r.deviceToken);
      toElder();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Não foi possível agora. Tente de novo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="real-shell">
      {role === "elder" ? (
        <ElderReal onLeave={() => setRole(tokens.device() ? "elder" : "welcome")} onSwitchToFamily={toFamily} />
      ) : role === "family" ? (
        <FamilyReal
          onLeave={() => {
            saveMode(tokens.device() ? "idoso" : "familiar");
            setRole("welcome");
          }}
          onSwitchToElder={tokens.device() ? toElder : undefined}
        />
      ) : role === "welcome" ? (
        <main className="start">
          <div className="start-brand">
            <span className="brand-mark">
              <Sun size={30} />
            </span>
            <h2>MyHealthRoutine</h2>
            <p>Seus remédios pela rotina, pelas cores e pela câmera.</p>
          </div>
          <p className="start-q">Quem vai usar este celular?</p>
          <button type="button" className="start-card elder-card" onClick={startElder} disabled={busy}>
            <span className="start-icon">
              <HeartHandshake size={34} />
            </span>
            <span>
              <strong>Este é o celular do idoso</strong>
              <small>{busy ? "Preparando…" : tokens.device() ? "Voltar ao Modo Idoso" : "Para tomar os remédios"}</small>
            </span>
          </button>
          <button type="button" className="start-card fam-card-btn" onClick={toFamily}>
            <span className="start-icon">
              <Users size={30} />
            </span>
            <span>
              <strong>Sou familiar ou cuidador</strong>
              <small>Cadastrar remédios e acompanhar</small>
            </span>
          </button>
          {error ? <p className="form-alert">{error}</p> : null}
          <p className="start-note">
            <Info size={15} /> Projeto acadêmico. Não substitui orientação médica ou farmacêutica.
          </p>
        </main>
      ) : null}
    </div>
  );
}
