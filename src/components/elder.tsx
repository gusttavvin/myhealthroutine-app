"use client";

import { BellRing, Camera, Check, Eye, HandHeart, LogOut, Phone, RotateCcw, ShieldCheck, TriangleAlert, Undo2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  ELDER_NAME,
  STATUS_TEXT,
  currentDose,
  fmt,
  marco,
  nextDose,
  todayDoses,
  trustedContact,
  type Dose,
  type Medication,
} from "@/lib/model";
import { chime, speak, stopSpeaking, success, vibrate } from "@/lib/feedback";
import { useStore } from "@/lib/store";
import { LabelTag, MedBox, Viewfinder } from "./visuals";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function boxPhrase(medOrMarco: { marco: Parameters<typeof marco>[0] }) {
  const mc = marco(medOrMarco.marco);
  return `caixa ${mc.colorName} com ${mc.iconName}`;
}

export function ElderMode() {
  const { state, dispatch } = useStore();
  const lastEvent = useRef<number | null>(state.event?.n ?? null);

  // Sons, vibração e voz quando o relógio dispara um aviso.
  useEffect(() => {
    const ev = state.event;
    if (!ev || ev.n === lastEvent.current) return;
    lastEvent.current = ev.n;
    const med = state.meds.find((m) => m.id === ev.medId);
    if (!med) return;
    const mc = marco(med.marco);
    const contact = trustedContact(state);
    if (ev.kind === "alarme") {
      chime(1, state.sound);
      vibrate([250, 150, 250]);
      setTimeout(() => speak(`Está na hora do ${mc.dose}. Pegue a ${boxPhrase(med)}.`, state.sound), 1300);
    } else if (ev.kind === "reforco") {
      chime(2, state.sound);
      vibrate([400, 150, 400, 150, 400]);
      setTimeout(() => speak(`${cap(mc.dose)}, ${mc.label.split("·").pop()?.trim()}, ainda pendente. Pegue a ${boxPhrase(med)}.`, state.sound), 2400);
    } else {
      vibrate(200);
      speak(
        state.offline
          ? `O aviso para ${contact?.name.split(" ")[0] ?? "seu contato"} não foi entregue. Se quiser, ligue para ${contact?.name.split(" ")[0] ?? "ele"}.`
          : `Mandamos um aviso sem alarme para ${contact?.name.split(" ")[0] ?? "seu contato de confiança"}. Quando puder, pegue a ${boxPhrase(med)}.`,
        state.sound,
      );
    }
  }, [state.event, state.meds, state.offline, state.sound, state]);

  useEffect(() => () => stopSpeaking(), []);

  const scene = state.elder;
  return (
    <div className="elder">
      {scene.name === "home" && <ElderHome />}
      {scene.name === "scan" && <ElderScan test={scene.test} />}
      {scene.name === "take" && <ElderTake medId={scene.medId} />}
      {scene.name === "confirmed" && <ElderConfirmed medId={scene.medId} test={scene.test} />}
      {scene.name === "reforco" && <ElderReforco medId={scene.medId} />}
      {scene.name === "aviso" && <ElderAviso medId={scene.medId} delivered={scene.delivered} byHelp={scene.byHelp} />}
      {scene.name === "ajuda" && <ElderAjuda />}
      {/* "Pedir ajuda" fica nas telas em que o idoso permanece; nas telas rápidas de tomar e confirmar sai, para não ser tocado por engano. */}
      {scene.name === "reforco" || scene.name === "aviso" ? (
        <button type="button" className="elder-help-fab" onClick={() => dispatch({ type: "elder", scene: { name: "ajuda" } })}>
          <HandHeart /> Pedir ajuda
        </button>
      ) : null}
    </div>
  );
}

function ElderTop({ title, hideExit = false }: { title?: string; hideExit?: boolean }) {
  const { dispatch } = useStore();
  return (
    <header className="elder-top">
      <span className="elder-hello">{title ?? `Sr. ${ELDER_NAME}`}</span>
      {hideExit ? null : (
        <button type="button" className="elder-exit" onClick={() => dispatch({ type: "mode", mode: "start" })}>
          <LogOut size={22} /> Sair
        </button>
      )}
    </header>
  );
}

function DoseCard({ dose, ringing }: { dose: Dose; ringing?: boolean }) {
  const mc = dose.marco;
  return (
    <div className={`dose-card ${ringing ? "ringing" : ""}`} style={{ borderColor: mc.color }}>
      <div className="dose-card-band" style={{ background: mc.color, color: mc.ink }}>
        {ringing ? (
          <span className="ring-badge">
            <BellRing size={22} /> Está na hora
          </span>
        ) : null}
        <LabelTag marcoId={mc.id} size="xl" showNumber={false} />
      </div>
      <div className="dose-card-body">
        <p className="dose-when">{mc.label}</p>
        <p className="dose-what">
          Pegue a <strong>caixa {mc.colorName}</strong> com <strong>{mc.iconName}</strong>
        </p>
        <span className={`status-pill ${dose.status}`}>
          {dose.status === "tomado" ? `Tomado às ${fmt(dose.confirmedAt ?? 0)}` : STATUS_TEXT[dose.status]}
        </span>
      </div>
    </div>
  );
}

function ElderHome() {
  const { state, dispatch } = useStore();
  const doses = todayDoses(state);
  const current = currentDose(state);
  const next = nextDose(state);
  const contact = trustedContact(state);
  const ringing = Boolean(current && current.status === "agora");

  // Aviso do horário ao abrir o Modo Idoso, se a dose está na hora e ainda não tocou.
  useEffect(() => {
    if (current && current.status === "agora" && !state.rung.includes(current.med.id)) {
      dispatch({ type: "ring", medId: current.med.id });
      chime(1, state.sound);
      vibrate([250, 150, 250]);
      const t = setTimeout(() => speak(`Está na hora do ${current.marco.dose}. Pegue a ${boxPhrase(current.med)}.`, state.sound), 1300);
      return () => clearTimeout(t);
    }
  }, [current, state.rung, state.sound, dispatch]);

  const hour = Math.floor(state.now / 60);
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";

  return (
    <>
      <ElderTop title={`${greeting}, Sr. ${ELDER_NAME}`} />
      <main className="elder-main">
        {current ? (
          <>
            <p className="elder-section">Agora</p>
            <DoseCard dose={current} ringing={ringing} />
            <button type="button" className="elder-primary" onClick={() => dispatch({ type: "elder", scene: { name: "scan" } })}>
              <Camera size={34} />
              <span className="btn-two">
                <b>Tomar o remédio agora</b>
                <small>abre a câmera para ler a etiqueta da caixa</small>
              </span>
            </button>
          </>
        ) : (
          <div className="all-good">
            <span className="all-good-check">
              <Check size={44} strokeWidth={3} />
            </span>
            <p className="all-good-title">Tudo em dia</p>
            {next ? (
              <p className="all-good-next">
                Próximo: <strong>{next.marco.label}</strong>, às {next.med.time}
                <span className="all-good-label">
                  <LabelTag marcoId={next.marco.id} size="md" showNumber={false} /> caixa {next.marco.colorName} com {next.marco.iconName}
                </span>
              </p>
            ) : (
              <p className="all-good-next">Não há mais remédios hoje.</p>
            )}
          </div>
        )}

        <p className="elder-section">Remédios de hoje</p>
        <ul className="elder-today">
          {doses.map((d) => (
            <li key={d.med.id} className={d.status}>
              <LabelTag marcoId={d.marco.id} size="sm" showNumber={false} />
              <span className="today-text">
                <strong>{d.marco.label}</strong>
                <span>{d.med.time}</span>
              </span>
              <span className={`status-pill ${d.status}`}>
                {d.status === "tomado" ? <Check size={20} strokeWidth={3} /> : null}
                {STATUS_TEXT[d.status]}
              </span>
            </li>
          ))}
        </ul>

        <section className="elder-network" aria-label="Quem acompanha você">
          <Eye size={22} />
          <p>
            <strong>Quem acompanha seus remédios:</strong>{" "}
            {state.contacts.map((c) => `${c.name.split(" ")[0]} (${c.relation})`).join(", ")}
          </p>
        </section>

        {contact ? (
          <button type="button" className="elder-secondary" onClick={() => dispatch({ type: "elder", scene: { name: "ajuda" } })}>
            <HandHeart size={28} /> Pedir ajuda a {contact.name.split(" ")[0]}
          </button>
        ) : null}
      </main>
    </>
  );
}

type ScanError = { title: string; text: string; expected?: Medication | null };

const EXTRA_BOX = { id: "dipirona", name: "Dipirona", dosage: "500 mg", label: null } as const;

function ElderScan({ test }: { test?: string }) {
  const { state, dispatch } = useStore();
  const [phase, setPhase] = useState<"idle" | "reading" | "error">("idle");
  const [picked, setPicked] = useState<string | null>(null);
  const [error, setError] = useState<ScanError | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const current = currentDose(state);
  const target: Medication | null = test ? state.meds.find((m) => m.id === test) ?? null : current?.med ?? null;
  const tmc = target ? marco(target.marco) : null;

  useEffect(() => {
    if (tmc) speak(`Aproxime a câmera da etiqueta ${tmc.colorName} com ${tmc.iconName}. Não precisa mirar.`, state.sound);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // fala só ao abrir a câmera
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const boxes = [...state.meds].sort((a, b) => a.name.localeCompare(b.name));

  function fail(e: ScanError) {
    setError(e);
    setPhase("error");
    vibrate([80, 80, 80]);
    speak(`${e.title}. ${e.text}`, state.sound);
  }

  function read(boxId: string) {
    if (phase === "reading") return;
    setPicked(boxId);
    setPhase("reading");
    setError(null);
    timer.current = setTimeout(() => evaluate(boxId), 1300);
  }

  function evaluate(boxId: string) {
    const med = state.meds.find((m) => m.id === boxId) ?? null;
    if (state.nextReadFails) {
      dispatch({ type: "consumeReadFail" });
      return fail({
        title: "Não consegui ler a etiqueta",
        text: "Pode ser reflexo da luz. Incline um pouco a caixa e aproxime de novo.",
        expected: target,
      });
    }
    if (!med || !med.label) {
      return fail({
        title: "Esta caixa não tem etiqueta",
        text: target && tmc ? `Procure a caixa ${tmc.colorName} com ${tmc.iconName}.` : "Use uma caixa com etiqueta colorida.",
        expected: target,
      });
    }
    const mc = marco(med.marco);
    if (test) {
      if (med.id === test) {
        success(state.sound);
        vibrate(200);
        return dispatch({ type: "elder", scene: { name: "confirmed", medId: med.id, test: true } });
      }
      return fail({ title: `Esta é a caixa ${mc.colorName}`, text: `Para o teste, use a caixa ${tmc?.colorName} com ${tmc?.iconName}.`, expected: target });
    }
    const confirmedAt = state.today[med.id];
    if (confirmedAt !== undefined) {
      return fail({
        title: "Este remédio já foi tomado hoje",
        text: `Ele foi registrado às ${fmt(confirmedAt)}. Não tome de novo.`,
        expected: target,
      });
    }
    const dose = todayDoses(state).find((d) => d.med.id === med.id);
    if (!dose || dose.status === "mais-tarde") {
      return fail({
        title: `Esta é a caixa ${mc.colorName}, do ${mc.dose}`,
        text: dose ? `Ela é para as ${med.time}. ${target && tmc ? `Agora é a caixa ${tmc.colorName} com ${tmc.iconName}.` : "Ainda não é a hora."}` : med.createdAt !== undefined
            ? `Ela começa amanhã, às ${med.time}.`
            : "Ela não é para hoje.",
        expected: target,
      });
    }
    success(state.sound);
    vibrate([120, 60, 220]);
    dispatch({ type: "elder", scene: { name: "take", medId: med.id } });
  }

  const pickedMed = picked ? state.meds.find((m) => m.id === picked) ?? (picked === EXTRA_BOX.id ? EXTRA_BOX : null) : null;

  return (
    <>
      <header className="elder-top">
        <button type="button" className="elder-back" onClick={() => dispatch(test ? { type: "mode", mode: "family" } : { type: "elder", scene: { name: "home" } })}>
          <Undo2 size={24} /> {test ? "Voltar" : "Voltar à rotina"}
        </button>
        {test ? <span className="test-tag">Leitura de teste</span> : null}
      </header>
      <main className="elder-main scan">
        {tmc ? (
          <p className="scan-instruction">
            <span>
              Aproxime a câmera da etiqueta <strong>{tmc.colorName}</strong> com <strong>{tmc.iconName}</strong>
            </span>
            <span className="look-for">
              <LabelTag marcoId={tmc.id} size="md" showNumber={false} />
              <small>procure esta</small>
            </span>
          </p>
        ) : (
          <p className="scan-instruction">Nenhum remédio pendente agora.</p>
        )}

        <Viewfinder state={phase === "reading" ? "reading" : phase === "error" ? "error" : "idle"}>
          {phase === "reading" && pickedMed ? (
            <div className="in-camera">
              {pickedMed.label ? <LabelTag code={pickedMed.label} size="xl" /> : <span className="no-label big">sem etiqueta</span>}
              <p>Lendo a etiqueta…</p>
            </div>
          ) : phase === "error" && error ? (
            <div className="scan-error" role="alert">
              <TriangleAlert size={34} />
              <p className="scan-error-title">{error.title}</p>
              <p>{error.text}</p>
            </div>
          ) : (
            <p className="camera-hint">
              <Camera size={30} />
              Não precisa mirar certinho.
              <br />
              Pode deixar o celular apoiado na mesa e aproximar a caixa.
            </p>
          )}
        </Viewfinder>

        {phase === "error" ? (
          <button type="button" className="elder-primary" onClick={() => setPhase("idle")}>
            <RotateCcw size={30} /> Tentar de novo
          </button>
        ) : null}

        <div className="table-area">
          <p className="table-title">
            <span className="proto-chip">Simulação</span> Toque na caixa que você pegou para aproximá-la da câmera:
          </p>
          <div className="table-boxes">
            {boxes.map((m) => (
              <MedBox key={m.id} med={m} onClick={() => read(m.id)} disabled={phase === "reading"} />
            ))}
            <MedBox med={EXTRA_BOX} onClick={() => read(EXTRA_BOX.id)} disabled={phase === "reading"} />
          </div>
        </div>
      </main>
    </>
  );
}

/** Etiqueta certa: o idoso toma o remédio e só então confirma (a dose não é registrada antes). */
function ElderTake({ medId }: { medId: string }) {
  const { state, dispatch } = useStore();
  const med = state.meds.find((m) => m.id === medId);
  const mc = med ? marco(med.marco) : null;

  useEffect(() => {
    if (!med || !mc) return;
    const t = setTimeout(
      () => speak(`Etiqueta certa. ${cap(mc.dose)}. Tome ${med.amount} com água e depois toque em Já tomei.`, state.sound),
      400,
    );
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!med || !mc) return null;
  return (
    <>
      <ElderTop hideExit />
      <main className="elder-main take">
        <p className="take-ok">
          <Check size={26} strokeWidth={3} /> Etiqueta certa
        </p>
        <div className="confirmed-dose">
          <LabelTag code={med.label} size="lg" />
          <p>
            <strong>{cap(mc.dose)}</strong>
            <br />
            caixa {mc.colorName} com {mc.iconName}
          </p>
        </div>
        <p className="take-now">Tome agora {med.amount} com água.</p>
        <button
          type="button"
          className="elder-primary"
          onClick={() => {
            success(state.sound);
            vibrate([120, 60, 220]);
            dispatch({ type: "confirm", medId: med.id });
          }}
        >
          <Check size={34} strokeWidth={3} /> Já tomei
        </button>
        <button type="button" className="elder-link" onClick={() => dispatch({ type: "elder", scene: { name: "home" } })}>
          Ainda não tomei
        </button>
        <p className="take-note">O remédio só fica registrado quando você toca em “Já tomei”.</p>
      </main>
    </>
  );
}

function ElderConfirmed({ medId, test }: { medId: string; test?: boolean }) {
  const { state, dispatch } = useStore();
  const med = state.meds.find((m) => m.id === medId);
  const mc = med ? marco(med.marco) : null;
  const next = nextDose(state);
  const pending = currentDose(state);
  const at = state.today[medId];
  const [left, setLeft] = useState(10);

  useEffect(() => {
    if (!med || !mc) return;
    const text = test
      ? `Leitura de teste funcionou. Etiqueta ${mc.colorName}, ${mc.dose}. Nada foi registrado.`
      : `Pronto, Sr. ${ELDER_NAME}. ${cap(mc.dose)} registrado.`;
    const t = setTimeout(() => speak(text, state.sound), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Depois de confirmar, volta sozinho para a rotina: para o idoso, a tarefa acaba aqui.
  useEffect(() => {
    if (test) return;
    if (left <= 0) {
      dispatch({ type: "elder", scene: { name: "home" } });
      return;
    }
    const t = setTimeout(() => setLeft((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [left, test, dispatch]);

  if (!med || !mc) return null;
  return (
    <>
      <ElderTop hideExit />
      <main className="elder-main confirmed">
        <span className="big-check">
          <Check size={70} strokeWidth={3.2} />
        </span>
        <h1 className="confirmed-title">{test ? "Leitura de teste funcionou!" : "Pronto, remédio registrado!"}</h1>
        {test ? (
          <>
            <div className="confirmed-dose">
              <LabelTag code={med.label} size="lg" />
              <p>
                <strong>{cap(mc.dose)}</strong>
                <br />
                etiqueta {mc.colorName} com {mc.iconName}
              </p>
            </div>
            <p className="confirmed-info">Era só um teste: nada foi registrado no histórico.</p>
            <button type="button" className="elder-primary" onClick={() => dispatch({ type: "testDone", medId: med.id })}>
              Concluir e voltar ao painel
            </button>
          </>
        ) : (
          <>
            <p className="confirmed-info">
              {cap(mc.dose)} registrado às <strong>{fmt(at ?? state.now)}</strong>.
            </p>
            <button type="button" className="elder-primary" onClick={() => dispatch({ type: "elder", scene: { name: "home" } })}>
              Voltar à rotina
            </button>
            <p className="auto-back">Voltando sozinho em {left} s</p>
            {pending ? (
              <p className="confirmed-next warn">
                Ainda falta: <strong>{pending.marco.label}</strong> ({pending.med.time})
              </p>
            ) : next ? (
              <p className="confirmed-next">
                Próxima dose: <strong>{next.marco.label}</strong>, às <strong>{next.med.time}</strong>
                <span>
                  <LabelTag marcoId={next.marco.id} size="sm" showNumber={false} /> caixa {next.marco.colorName}
                </span>
              </p>
            ) : (
              <p className="confirmed-next">Não há mais remédios hoje.</p>
            )}
          </>
        )}
      </main>
    </>
  );
}

function ElderReforco({ medId }: { medId: string }) {
  const { state, dispatch } = useStore();
  const dose = todayDoses(state).find((d) => d.med.id === medId);
  if (!dose) return null;
  return (
    <>
      <ElderTop />
      <main className="elder-main reforco">
        <p className="reforco-title">
          <BellRing size={34} /> Lembrete: ainda pendente
        </p>
        <DoseCard dose={dose} ringing />
        <button type="button" className="elder-primary" onClick={() => dispatch({ type: "elder", scene: { name: "scan" } })}>
          <Camera size={34} />
              <span className="btn-two">
                <b>Tomar o remédio agora</b>
                <small>abre a câmera para ler a etiqueta da caixa</small>
              </span>
        </button>
        <button type="button" className="elder-link" onClick={() => dispatch({ type: "elder", scene: { name: "home" } })}>
          Voltar à rotina
        </button>
      </main>
    </>
  );
}

function ElderAviso({ medId, delivered, byHelp }: { medId: string | null; delivered: boolean; byHelp?: boolean }) {
  const { state, dispatch } = useStore();
  const contact = trustedContact(state);
  const first = contact?.name.split(" ")[0] ?? "seu contato";
  const dose = medId ? todayDoses(state).find((d) => d.med.id === medId) : null;
  const pending = currentDose(state);
  const [calling, setCalling] = useState(false);

  useEffect(() => {
    if (byHelp) speak(`Pronto. ${first} recebeu seu pedido de ajuda.`, state.sound);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <ElderTop />
      <main className="elder-main aviso">
        {delivered ? (
          <div className="aviso-box ok">
            <ShieldCheck size={46} />
            <p className="aviso-title">{byHelp ? `${first} recebeu seu pedido` : `Avisamos ${first}, sem alarme`}</p>
            <p>
              {byHelp
                ? `${first} vai entrar em contato com você.`
                : `${first} recebeu uma mensagem silenciosa e pode ligar para saber se está tudo bem.`}
            </p>
          </div>
        ) : (
          <div className="aviso-box fail" role="alert">
            <TriangleAlert size={46} />
            <p className="aviso-title">O aviso não chegou até {first}</p>
            <p>O celular está sem internet. Se quiser, ligue para {first}.</p>
            <button type="button" className="elder-secondary" onClick={() => setCalling(true)}>
              <Phone size={26} /> Ligar para {first}
            </button>
          </div>
        )}

        {dose && dose.status !== "tomado" ? (
          <>
            <p className="elder-section">O remédio continua esperando</p>
            <DoseCard dose={{ ...dose, status: "nao-confirmada" }} />
          </>
        ) : null}

        {pending ? (
          <button type="button" className="elder-primary" onClick={() => dispatch({ type: "elder", scene: { name: "scan" } })}>
            <Camera size={34} />
              <span className="btn-two">
                <b>Tomar o remédio agora</b>
                <small>abre a câmera para ler a etiqueta da caixa</small>
              </span>
          </button>
        ) : null}
        <button type="button" className={pending ? "elder-link" : "elder-primary"} onClick={() => dispatch({ type: "elder", scene: { name: "home" } })}>
          Voltar à rotina
        </button>
      </main>
      {calling ? <CallSim name={contact?.name ?? "contato"} onClose={() => setCalling(false)} /> : null}
    </>
  );
}

function ElderAjuda() {
  const { state, dispatch } = useStore();
  const contact = trustedContact(state);
  const first = contact?.name.split(" ")[0] ?? "contato";
  const [phase, setPhase] = useState<"ask" | "sending" | "fail">("ask");
  const [calling, setCalling] = useState(false);

  function send() {
    setPhase("sending");
    setTimeout(() => {
      if (state.offline) {
        setPhase("fail");
        vibrate([80, 80, 80]);
        speak(`Sem internet. O aviso não foi enviado. Você pode ligar para ${first}.`, state.sound);
      } else {
        success(state.sound);
        dispatch({ type: "help" });
      }
    }, 1000);
  }

  return (
    <>
      <ElderTop title="Pedir ajuda" />
      <main className="elder-main ajuda">
        <div className="ajuda-person">
          <span className="avatar big">{first.charAt(0)}</span>
          <p>
            <strong>{contact?.name}</strong>
            <br />
            {contact?.relation}, seu contato de confiança
          </p>
        </div>
        {phase === "fail" ? (
          <div className="aviso-box fail" role="alert">
            <TriangleAlert size={40} />
            <p className="aviso-title">O aviso não foi enviado</p>
            <p>O celular está sem internet. Você pode ligar para {first}.</p>
            <button type="button" className="elder-secondary" onClick={() => setCalling(true)}>
              <Phone size={26} /> Ligar para {first}
            </button>
          </div>
        ) : (
          <p className="ajuda-text">Vamos mandar uma mensagem para {first} dizendo que você precisa de ajuda.</p>
        )}
        <button type="button" className="elder-primary help" onClick={send} disabled={phase === "sending"}>
          <HandHeart size={34} /> {phase === "sending" ? "Avisando…" : phase === "fail" ? "Tentar avisar de novo" : `Avisar ${first}`}
        </button>
        <button type="button" className="elder-link" onClick={() => dispatch({ type: "elder", scene: { name: "home" } })}>
          Cancelar e voltar à rotina
        </button>
      </main>
      {calling ? <CallSim name={contact?.name ?? "contato"} onClose={() => setCalling(false)} /> : null}
    </>
  );
}

function CallSim({ name, onClose }: { name: string; onClose: () => void }) {
  return (
    <div className="call-sim" role="dialog" aria-label="Ligação simulada">
      <span className="avatar big">{name.charAt(0)}</span>
      <p className="call-name">{name}</p>
      <p>Chamando… (ligação simulada no protótipo)</p>
      <button type="button" className="call-end" onClick={onClose}>
        <Phone size={28} /> Encerrar
      </button>
    </div>
  );
}
