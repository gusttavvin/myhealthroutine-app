"use client";

import {
  BatteryFull,
  Clock3,
  FastForward,
  HeartHandshake,
  Info,
  RotateCcw,
  Settings2,
  SkipForward,
  Sun,
  Users,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ELDER_FULL, TODAY_LABEL, fmt, TOLERANCE_1, TOLERANCE_2 } from "@/lib/model";
import { StoreProvider, useStore } from "@/lib/store";
import { ElderMode } from "./elder";
import { FamilyMode } from "./family";

export function Prototype() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}

function Shell() {
  const { state, ready } = useStore();
  const [panelOpen, setPanelOpen] = useState(false);
  const [buzz, setBuzz] = useState(false);
  const scroller = useRef<HTMLDivElement | null>(null);

  const sceneKey = state.mode === "elder" ? `e-${state.elder.name}` : state.mode === "family" ? `f-${state.family.name}` : "start";
  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
  }, [sceneKey]);

  useEffect(() => {
    if (!state.event || state.mode !== "elder") return;
    setBuzz(true);
    const t = setTimeout(() => setBuzz(false), 900);
    return () => clearTimeout(t);
  }, [state.event, state.mode]);

  return (
    <div className="stage">
      <div className="stage-intro">
        <p className="eyebrow">Protótipo interativo · TP3 IHC · UFMG</p>
        <h1>MyHealthRoutine</h1>
        <p>Apoio à gestão autônoma de medicamentos por pessoas da terceira idade.</p>
      </div>

      <div className={`phone ${buzz ? "buzz" : ""}`}>
        <div className="phone-screen">
          <div className="status-bar">
            <span className="sb-time">{fmt(state.now)}</span>
            <span className="sb-icons">
              {state.offline ? <WifiOff size={15} aria-label="Sem internet" /> : <Wifi size={15} aria-label="Com internet" />}
              <BatteryFull size={17} />
              <button type="button" className="sb-gear" onClick={() => setPanelOpen(true)} aria-label="Abrir controles do protótipo">
                <Settings2 size={16} /> Controles
              </button>
            </span>
          </div>
          <div className="screen-scroll" ref={scroller}>
            {!ready ? null : state.mode === "start" ? <Start /> : state.mode === "elder" ? <ElderMode /> : <FamilyMode />}
          </div>
        </div>
      </div>

      <aside className={`panel ${panelOpen ? "open" : ""}`} aria-label="Controles do protótipo">
        <Panel onClose={() => setPanelOpen(false)} />
      </aside>
      {panelOpen ? <button type="button" className="panel-backdrop" aria-label="Fechar controles" onClick={() => setPanelOpen(false)} /> : null}
    </div>
  );
}

function Start() {
  const { dispatch } = useStore();
  return (
    <main className="start">
      <div className="start-brand">
        <span className="brand-mark">
          <Sun size={30} />
        </span>
        <h2>MyHealthRoutine</h2>
        <p>Seus remédios pela rotina, pelas cores e pela câmera.</p>
      </div>
      <p className="start-q">Quem vai usar agora?</p>
      <button
        type="button"
        className="start-card elder-card"
        onClick={() => {
          dispatch({ type: "elder", scene: { name: "home" } });
          dispatch({ type: "mode", mode: "elder" });
        }}
      >
        <span className="start-icon">
          <HeartHandshake size={34} />
        </span>
        <span>
          <strong>Modo Idoso</strong>
          <small>Sr. Aloísio: tomar meus remédios</small>
        </span>
      </button>
      <button type="button" className="start-card fam-card-btn" onClick={() => dispatch({ type: "mode", mode: "family" })}>
        <span className="start-icon">
          <Users size={30} />
        </span>
        <span>
          <strong>Modo Familiar / Cuidador</strong>
          <small>Cadastrar remédios e acompanhar</small>
        </span>
      </button>
      <p className="start-note">
        <Info size={15} /> Num celular de verdade, o Modo Idoso abre direto. O Modo Familiar pede identificação.
      </p>
    </main>
  );
}

function Switch({ on, onChange, label, help }: { on: boolean; onChange: () => void; label: string; help: string }) {
  return (
    <label className="switch-row">
      <span>
        <strong>{label}</strong>
        <small>{help}</small>
      </span>
      <button type="button" role="switch" aria-checked={on} className={`switch ${on ? "on" : ""}`} onClick={onChange}>
        <i />
      </button>
    </label>
  );
}

function Panel({ onClose }: { onClose: () => void }) {
  const { state, dispatch } = useStore();
  return (
    <div className="panel-inner">
      <header className="panel-head">
        <div>
          <p className="eyebrow">Fora do aplicativo</p>
          <h2>Controles do protótipo</h2>
        </div>
        <button type="button" className="icon-btn panel-close" onClick={onClose} aria-label="Fechar">
          <X size={20} />
        </button>
      </header>
      <p className="panel-help">Servem para simular o passar do tempo e falhas. Não fazem parte da interface avaliada.</p>

      <section className="panel-box clock">
        <p className="panel-label">
          <Clock3 size={15} /> Relógio simulado
        </p>
        <p className="clock-time">{fmt(state.now)}</p>
        <p className="clock-day">{TODAY_LABEL}</p>
        <div className="clock-btns">
          <button type="button" onClick={() => dispatch({ type: "advance", minutes: 5 })}>
            <FastForward size={15} /> +5 min
          </button>
          <button type="button" onClick={() => dispatch({ type: "advance", minutes: 20 })}>
            <FastForward size={15} /> +20 min
          </button>
          <button type="button" onClick={() => dispatch({ type: "nextDose" })}>
            <SkipForward size={15} /> Próxima dose
          </button>
        </div>
        <p className="panel-small">
          No horário: aviso com som e vibração. +{TOLERANCE_1} min sem leitura: lembrete reforçado. +{TOLERANCE_2} min: aviso silencioso ao contato de confiança.
        </p>
      </section>

      <section className="panel-box">
        <Switch
          on={state.offline}
          onChange={() => dispatch({ type: "toggle", key: "offline" })}
          label="Sem internet"
          help="Avisos, pedido de ajuda e relatório falham."
        />
        <Switch
          on={state.nextReadFails}
          onChange={() => dispatch({ type: "toggle", key: "nextReadFails" })}
          label="Próxima leitura falha"
          help="Simula reflexo na etiqueta."
        />
        <Switch on={state.sound} onChange={() => dispatch({ type: "toggle", key: "sound" })} label="Som e voz" help="Aviso sonoro e fala do aplicativo." />
      </section>

      <section className="panel-box">
        <p className="panel-label">Mensagens enviadas pelo sistema</p>
        {state.notices.length === 0 ? (
          <p className="panel-small">Nenhuma ainda.</p>
        ) : (
          <ul className="notice-list">
            {state.notices.map((n) => (
              <li key={n.id} className={n.delivered ? "" : "fail"}>
                <small>
                  {fmt(n.at)} → {n.to}
                  {n.delivered ? "" : " · não entregue"}
                </small>
                {n.text}
              </li>
            ))}
          </ul>
        )}
      </section>

      <details className="panel-box tasks">
        <summary>Tarefas da avaliação (Percurso Cognitivo)</summary>
        <ol>
          <li>
            <strong>Sr. Aloísio confirma o remédio da manhã</strong> lendo a etiqueta da caixa certa (Modo Idoso).
          </li>
          <li>
            <strong>Beatriz cadastra o Omeprazol 20 mg</strong> no amanhecer (06:30) e associa a etiqueta laranja à caixa (Modo Familiar, senha 1234).
          </li>
          <li>
            <strong>Marcos consulta a adesão da semana, gera o relatório</strong> e avisa a reposição da Varfarina (Modo Familiar, senha 1234).
          </li>
        </ol>
      </details>

      <button
        type="button"
        className="panel-reset"
        onClick={() => {
          if (window.confirm("Recomeçar o protótipo do zero? Tudo o que foi feito neste navegador será apagado.")) dispatch({ type: "reset" });
        }}
      >
        <RotateCcw size={16} /> Recomeçar do zero
      </button>
      <p className="panel-foot">Dados fictícios de {ELDER_FULL}. Ficam só neste navegador.</p>
    </div>
  );
}
