"use client";

import {
  BellRing,
  Camera,
  Check,
  Eye,
  HandHeart,
  Link2,
  MoreHorizontal,
  Phone,
  RotateCcw,
  ScanLine,
  ShieldCheck,
  Smartphone,
  TriangleAlert,
  Undo2,
  UserMinus,
  Users,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { marco } from "@/lib/model";
import { chime, speak, success, vibrate } from "@/lib/feedback";
import { LabelTag } from "@/components/visuals";
import { ApiError, api, fmtMin, tokens } from "./api";
import { PushCard } from "./push-card";
import { QrScanner } from "./qr-scanner";
import type { Contact, DeviceView, ElderView, Med, ScanResult, TodayDose } from "./types";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const STATUS_TEXT: Record<TodayDose["status"], string> = {
  tomado: "Tomado",
  agora: "Pendente",
  tolerancia: "Ainda pendente",
  "nao-confirmada": "Não confirmado",
  "mais-tarde": "Mais tarde",
};

type Screen =
  | { name: "home" }
  | { name: "scan"; test?: boolean }
  | { name: "confirmed"; medId: string; min: number }
  | { name: "tested"; medId: string }
  | { name: "help" }
  | { name: "menu" }
  | { name: "code" }
  | { name: "people" };

function boxPhrase(m: { marco: Med["marco"] }) {
  const mc = marco(m.marco);
  return `caixa ${mc.colorName} com ${mc.iconName}`;
}

export function ElderReal({ onLeave: onLeaveProp, onSwitchToFamily }: { onLeave: () => void; onSwitchToFamily: () => void }) {
  const leaveRef = useRef(onLeaveProp);
  leaveRef.current = onLeaveProp;
  const onLeave = useCallback(() => leaveRef.current(), []);
  const [view, setView] = useState<DeviceView | null>(null);
  const [error, setError] = useState("");
  const [screen, setScreen] = useState<Screen>({ name: "home" });
  const prev = useRef<Record<string, TodayDose["status"]>>({});

  const load = useCallback(async () => {
    try {
      const v = await api<DeviceView>("/device/me", { as: "device" });
      setView(v);
      setError("");
      if (v.linked) announce(v);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) onLeave();
      else setError(e instanceof Error ? e.message : "Sem conexão.");
    }
  }, [onLeave]);

  // Toca o aviso quando uma dose chega na hora (com o app aberto).
  function announce(v: ElderView) {
    const rung = new Set<string>(JSON.parse(sessionStorage.getItem("mhr-rung") ?? "[]"));
    for (const d of v.today) {
      const before = prev.current[d.medId];
      const key = `${v.now.date}|${d.medId}|${d.status}`;
      if (before !== d.status && (d.status === "agora" || d.status === "tolerancia") && !rung.has(key)) {
        rung.add(key);
        const mc = marco(d.marco);
        chime(d.status === "agora" ? 1 : 2, true);
        vibrate(d.status === "agora" ? [250, 150, 250] : [400, 150, 400, 150, 400]);
        setTimeout(
          () =>
            speak(
              d.status === "agora"
                ? `Está na hora do ${mc.dose}. Pegue a caixa ${mc.colorName} com ${mc.iconName}.`
                : `${cap(mc.dose)}, ainda pendente. Pegue a caixa ${mc.colorName} com ${mc.iconName}.`,
              true,
            ),
          1400,
        );
      }
      prev.current[d.medId] = d.status;
    }
    sessionStorage.setItem("mhr-rung", JSON.stringify([...rung]));
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 30000);
    const onVis = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [load]);

  if (!view) {
    return (
      <div className="elder center-screen">
        {error ? (
          <div className="aviso-box fail">
            <TriangleAlert size={40} />
            <p className="aviso-title">Sem conexão</p>
            <p>{error}</p>
            <button type="button" className="elder-primary" onClick={load}>
              Tentar de novo
            </button>
          </div>
        ) : (
          <p className="loading-text">Carregando…</p>
        )}
      </div>
    );
  }

  if (!view.linked) return <LinkCode code={view.code} expiresAt={view.expiresAt} onRefresh={load} onLeave={onLeave} onSwitchToFamily={onSwitchToFamily} />;

  const go = (s: Screen) => setScreen(s);
  const home = () => {
    setScreen({ name: "home" });
    load();
  };

  return (
    <div className="elder">
      {error ? <p className="offline-bar">Sem internet: mostrando os últimos dados.</p> : null}
      {screen.name === "home" && <Home view={view} go={go} />}
      {screen.name === "scan" && <Scan view={view} test={screen.test} go={go} onBack={home} />}
      {screen.name === "confirmed" && <Confirmed view={view} medId={screen.medId} min={screen.min} onBack={home} />}
      {screen.name === "tested" && <Tested view={view} medId={screen.medId} onBack={home} go={go} />}
      {screen.name === "help" && <Help view={view} onBack={home} />}
      {screen.name === "menu" && <Menu go={go} onBack={home} onLeave={onLeave} onSwitchToFamily={onSwitchToFamily} />}
      {screen.name === "code" && <ShowCode onBack={home} />}
      {screen.name === "people" && <People view={view} onBack={home} reload={load} />}
      {screen.name !== "home" && screen.name !== "scan" && screen.name !== "help" && screen.name !== "menu" ? (
        <button type="button" className="elder-help-fab" onClick={() => go({ name: "help" })}>
          <HandHeart /> Pedir ajuda
        </button>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Top({ title, onBack, backLabel = "Voltar à rotina", right }: { title?: string; onBack?: () => void; backLabel?: string; right?: React.ReactNode }) {
  return (
    <header className="elder-top">
      {onBack ? (
        <button type="button" className="elder-back" onClick={onBack}>
          <Undo2 size={24} /> {backLabel}
        </button>
      ) : (
        <span className="elder-hello">{title}</span>
      )}
      {right}
    </header>
  );
}

function DoseCard({ dose, ringing }: { dose: TodayDose; ringing?: boolean }) {
  const mc = marco(dose.marco);
  return (
    <div className={`dose-card ${ringing ? "ringing" : ""}`} style={{ borderColor: mc.color }}>
      <div className="dose-card-band" style={{ background: mc.color, color: mc.ink }}>
        <LabelTag marcoId={mc.id} size="xl" showNumber={false} />
      </div>
      <div className="dose-card-body">
        <p className="dose-when">{mc.label}</p>
        <p className="dose-what">
          Pegue a <strong>caixa {mc.colorName}</strong> com <strong>{mc.iconName}</strong>
        </p>
        <span className={`status-pill ${dose.status}`}>
          {dose.status === "tomado" ? `Tomado às ${fmtMin(dose.confirmedMin ?? 0)}` : `${STATUS_TEXT[dose.status]} · ${dose.time}`}
        </span>
      </div>
    </div>
  );
}

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

/** Dose do momento: a que já chegou na hora ou, se não houver, a que começa em até 30 minutos. */
function current(view: ElderView) {
  const due = view.today.find((d) => d.status === "agora" || d.status === "tolerancia" || d.status === "nao-confirmada");
  if (due) return due;
  const soon = view.today.find((d) => d.status === "mais-tarde");
  return soon && toMin(soon.time) - view.now.min <= 30 ? soon : null;
}
function next(view: ElderView) {
  return view.today.find((d) => d.status === "mais-tarde") ?? null;
}
function trusted(view: ElderView): Contact | null {
  return view.contacts.find((c) => c.trusted) ?? view.contacts[0] ?? null;
}

function Home({ view, go }: { view: ElderView; go: (s: Screen) => void }) {
  const cur = current(view);
  const nx = next(view);
  const contact = trusted(view);
  const first = contact?.name.split(" ")[0];
  const hour = Math.floor(view.now.min / 60);
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  // Aviso ao contato enviado nas últimas 3 horas (é o da dose atrasada de agora).
  const avisoHoje = view.notices.find((n) => n.kind === "aviso" && Date.now() - Date.parse(n.createdAt) < 3 * 3600 * 1000);

  return (
    <>
      <Top
        title={`${greeting}, ${view.elder.name.split(" ")[0]}`}
        right={
          <button type="button" className="elder-exit" onClick={() => go({ name: "menu" })} aria-label="Mais opções">
            <MoreHorizontal size={24} /> Opções
          </button>
        }
      />
      <main className="elder-main">
        <PushCard as="device" big />

        {cur ? (
          <>
            {cur.status === "tolerancia" ? (
              <p className="reforco-title">
                <BellRing size={30} /> Lembrete: ainda pendente
              </p>
            ) : (
              <p className="elder-section">{cur.status === "mais-tarde" ? `Daqui a pouco, às ${cur.time}` : "Agora"}</p>
            )}
            <DoseCard dose={cur} ringing={cur.status === "agora" || cur.status === "tolerancia"} />
            {cur.status === "nao-confirmada" && first ? (
              avisoHoje?.delivered ? (
                <div className="aviso-box ok">
                  <ShieldCheck size={36} />
                  <p className="aviso-title">Avisamos {first}, sem alarme</p>
                  <p>{first} recebeu uma mensagem e pode ligar para saber se está tudo bem.</p>
                </div>
              ) : (
                <div className="aviso-box fail">
                  <TriangleAlert size={36} />
                  <p className="aviso-title">Não conseguimos avisar {first}</p>
                  {contact?.phone ? (
                    <a className="elder-secondary" href={`tel:${contact.phone}`}>
                      <Phone size={24} /> Ligar para {first}
                    </a>
                  ) : (
                    <p>Se precisar, ligue para {first}.</p>
                  )}
                </div>
              )
            ) : null}
            <button type="button" className="elder-primary" onClick={() => go({ name: "scan" })}>
              <Camera size={34} /> Pegar a caixa e abrir a câmera
            </button>
          </>
        ) : (
          <div className="all-good">
            <span className="all-good-check">
              <Check size={44} strokeWidth={3} />
            </span>
            <p className="all-good-title">Tudo em dia</p>
            {nx ? (
              <p className="all-good-next">
                Próximo: <strong>{marco(nx.marco).label}</strong>, às {nx.time}
                <span className="all-good-label">
                  <LabelTag marcoId={nx.marco} size="md" showNumber={false} /> caixa {marco(nx.marco).colorName} com {marco(nx.marco).iconName}
                </span>
              </p>
            ) : (
              <p className="all-good-next">{view.today.length ? "Não há mais remédios hoje." : "Nenhum remédio cadastrado ainda."}</p>
            )}
          </div>
        )}

        {view.today.length ? (
          <>
            <p className="elder-section">Remédios de hoje</p>
            <ul className="elder-today">
              {view.today.map((d) => (
                <li key={d.medId} className={d.status}>
                  <LabelTag marcoId={d.marco} size="sm" showNumber={false} />
                  <span className="today-text">
                    <strong>{marco(d.marco).label}</strong>
                    <span>{d.time}</span>
                  </span>
                  <span className={`status-pill ${d.status}`}>
                    {d.status === "tomado" ? <Check size={20} strokeWidth={3} /> : null}
                    {STATUS_TEXT[d.status]}
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : null}

        <section className="elder-network" aria-label="Quem acompanha você">
          <Eye size={22} />
          <p>
            <strong>Quem acompanha seus remédios:</strong>{" "}
            {view.contacts.length ? view.contacts.map((c) => `${c.name.split(" ")[0]} (${c.relation})`).join(", ") : "ninguém"}
          </p>
        </section>

        {contact ? (
          <button type="button" className="elder-secondary" onClick={() => go({ name: "help" })}>
            <HandHeart size={28} /> Pedir ajuda a {first}
          </button>
        ) : null}
      </main>
    </>
  );
}

type ScanError = { title: string; text: string };

function Scan({ view, test, go, onBack }: { view: ElderView; test?: boolean; go: (s: Screen) => void; onBack: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ScanError | null>(null);
  const cur = current(view);
  const tmc = cur ? marco(cur.marco) : null;
  const medById = (id?: string) => view.meds.find((m) => m.id === id);

  useEffect(() => {
    speak(
      test
        ? "Aproxime a câmera da etiqueta da caixa que você quer testar."
        : tmc
          ? `Aproxime a câmera da etiqueta ${tmc.colorName} com ${tmc.iconName}. Não precisa mirar.`
          : "Aproxime a câmera da etiqueta da caixa.",
      true,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function fail(e: ScanError) {
    setError(e);
    vibrate([80, 80, 80]);
    speak(`${e.title}. ${e.text}`, true);
  }

  async function read(code: string) {
    if (busy || error) return;
    setBusy(true);
    try {
      const r = await api<ScanResult>("/device/scan", { method: "POST", body: { code, test }, as: "device" });
      const med = medById(r.medId);
      const mc = med ? marco(med.marco) : null;
      const expected = tmc ? `Agora é a caixa ${tmc.colorName} com ${tmc.iconName}.` : "";
      if (r.ok) {
        success(true);
        vibrate([120, 60, 220]);
        if (r.test) go({ name: "tested", medId: r.medId });
        else go({ name: "confirmed", medId: r.medId, min: r.confirmedMin ?? view.now.min });
        return;
      }
      switch (r.reason) {
        case "unknown":
          return fail({ title: "Não reconheci esta etiqueta", text: "Ela não é das etiquetas do seu aplicativo. Procure a etiqueta colorida da caixa." });
        case "no_med":
          return fail({ title: "Esta etiqueta ainda não tem remédio", text: "Peça ao seu familiar para ligar a etiqueta ao remédio." });
        case "already":
          return fail({ title: "Este remédio já foi tomado hoje", text: `Ele foi registrado às ${fmtMin(r.confirmedMin ?? 0)}. Não tome de novo.` });
        case "future":
          return fail({ title: `Esta é a caixa ${mc?.colorName}, do ${mc?.dose}`, text: `Ela é para as ${med?.time}. ${expected || "Ainda não é a hora."}` });
        case "not_today":
          return fail({
            title: `Esta é a caixa ${mc?.colorName}`,
            text: r.startsTomorrow ? `Este remédio começa amanhã, às ${med?.time}.` : `Este remédio não é para hoje. ${expected}`,
          });
      }
    } catch (e) {
      fail({ title: "Não consegui registrar", text: e instanceof Error ? e.message : "Tente de novo." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Top onBack={onBack} right={test ? <span className="test-tag">Teste</span> : null} />
      <main className="elder-main scan">
        <p className="scan-instruction">
          {test ? (
            <span>Aproxime a câmera da etiqueta da caixa que quer testar</span>
          ) : tmc ? (
            <>
              <span>
                Aproxime a câmera da etiqueta <strong>{tmc.colorName}</strong> com <strong>{tmc.iconName}</strong>
              </span>
              <LabelTag marcoId={tmc.id} size="md" showNumber={false} />
            </>
          ) : (
            <span>Aproxime a câmera da etiqueta da caixa</span>
          )}
        </p>
        <QrScanner
          big
          onCode={read}
          paused={busy || Boolean(error)}
          hint={
            busy ? (
              <p className="camera-hint">Lendo a etiqueta…</p>
            ) : error ? (
              <div className="scan-error" role="alert">
                <TriangleAlert size={34} />
                <p className="scan-error-title">{error.title}</p>
                <p>{error.text}</p>
              </div>
            ) : (
              <p className="camera-hint small">Não precisa mirar certinho.</p>
            )
          }
        />
        {error ? (
          <button type="button" className="elder-primary" onClick={() => setError(null)}>
            <RotateCcw size={30} /> Tentar de novo
          </button>
        ) : null}
      </main>
    </>
  );
}

function Confirmed({ view, medId, min, onBack }: { view: ElderView; medId: string; min: number; onBack: () => void }) {
  const med = view.meds.find((m) => m.id === medId);
  const mc = med ? marco(med.marco) : null;
  const nx = view.today.find((d) => d.status === "mais-tarde" && d.medId !== medId);

  useEffect(() => {
    if (med && mc) {
      const t = setTimeout(
        () => speak(`${cap(mc.dose)}, etiqueta ${mc.colorName}, confirmado, ${view.elder.name.split(" ")[0]}. Tome ${med.amount} com água.`, true),
        500,
      );
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!med || !mc) return null;
  return (
    <>
      <Top title={view.elder.name.split(" ")[0]} />
      <main className="elder-main confirmed">
        <span className="big-check">
          <Check size={70} strokeWidth={3.2} />
        </span>
        <h1 className="confirmed-title">Confirmado!</h1>
        <div className="confirmed-dose">
          <LabelTag marcoId={med.marco} size="lg" showNumber={false} />
          <p>
            <strong>{cap(mc.dose)}</strong>
            <br />
            etiqueta {mc.colorName} com {mc.iconName}
          </p>
        </div>
        <p className="confirmed-take">Tome {med.amount} com água.</p>
        <p className="confirmed-info">
          Registrado às <strong>{fmtMin(min)}</strong> · status: <strong>confirmado</strong>
        </p>
        {nx ? (
          <p className="confirmed-next">
            Próxima dose: <strong>{marco(nx.marco).label}</strong>, às <strong>{nx.time}</strong>
          </p>
        ) : null}
        <button type="button" className="elder-primary" onClick={onBack}>
          Voltar à rotina
        </button>
      </main>
    </>
  );
}

function Tested({ view, medId, onBack, go }: { view: ElderView; medId: string; onBack: () => void; go: (s: Screen) => void }) {
  const med = view.meds.find((m) => m.id === medId);
  const mc = med ? marco(med.marco) : null;
  useEffect(() => {
    if (med && mc) speak(`Esta é a caixa ${mc.colorName}, do ${mc.dose}, às ${med.time}. Era só um teste: nada foi registrado.`, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!med || !mc) return null;
  return (
    <>
      <Top onBack={onBack} />
      <main className="elder-main confirmed">
        <span className="big-check">
          <Check size={70} strokeWidth={3.2} />
        </span>
        <h1 className="confirmed-title">A etiqueta funciona!</h1>
        <div className="confirmed-dose">
          <LabelTag marcoId={med.marco} size="lg" showNumber={false} />
          <p>
            <strong>{cap(mc.dose)}</strong>
            <br />
            caixa {mc.colorName} com {mc.iconName}, às {med.time}
          </p>
        </div>
        <p className="confirmed-info">Era só um teste: nada foi registrado.</p>
        <button type="button" className="elder-primary" onClick={() => go({ name: "scan", test: true })}>
          <ScanLine size={28} /> Testar outra etiqueta
        </button>
        <button type="button" className="elder-link" onClick={onBack}>
          Voltar à rotina
        </button>
      </main>
    </>
  );
}

function Help({ view, onBack }: { view: ElderView; onBack: () => void }) {
  const contact = trusted(view);
  const first = contact?.name.split(" ")[0] ?? "seu familiar";
  const [phase, setPhase] = useState<"ask" | "sending" | "ok" | "fail">("ask");
  const [msg, setMsg] = useState("");

  async function send() {
    setPhase("sending");
    try {
      const r = await api<{ delivered: boolean }>("/device/help", { method: "POST", as: "device" });
      if (r.delivered) {
        setPhase("ok");
        success(true);
        speak(`Pronto. ${first} recebeu seu pedido de ajuda.`, true);
      } else {
        setPhase("fail");
        setMsg(`O pedido foi guardado, mas o celular de ${first} não recebeu o aviso agora.`);
        speak(`Não conseguimos avisar ${first} agora. Se precisar, ligue.`, true);
      }
    } catch (e) {
      setPhase("fail");
      setMsg(e instanceof Error ? e.message : "Sem internet.");
      speak(`O aviso não foi enviado. Se precisar, ligue para ${first}.`, true);
    }
  }

  return (
    <>
      <Top onBack={onBack} backLabel="Cancelar e voltar" />
      <main className="elder-main ajuda">
        <div className="ajuda-person">
          <span className="avatar big">{first.charAt(0)}</span>
          <p>
            <strong>{contact?.name ?? "Sem contato"}</strong>
            <br />
            {contact ? `${contact.relation}, seu contato de confiança` : "Peça a um familiar para se vincular."}
          </p>
        </div>
        {phase === "ok" ? (
          <div className="aviso-box ok">
            <ShieldCheck size={46} />
            <p className="aviso-title">{first} recebeu seu pedido</p>
            <p>{first} vai entrar em contato com você.</p>
          </div>
        ) : phase === "fail" ? (
          <div className="aviso-box fail" role="alert">
            <TriangleAlert size={40} />
            <p className="aviso-title">O aviso não chegou</p>
            <p>{msg}</p>
            {contact?.phone ? (
              <a className="elder-secondary" href={`tel:${contact.phone}`}>
                <Phone size={26} /> Ligar para {first}
              </a>
            ) : null}
          </div>
        ) : (
          <p className="ajuda-text">Vamos mandar uma mensagem para {first} dizendo que você precisa de ajuda.</p>
        )}
        {phase !== "ok" && contact ? (
          <button type="button" className="elder-primary help" onClick={send} disabled={phase === "sending"}>
            <HandHeart size={34} /> {phase === "sending" ? "Avisando…" : phase === "fail" ? "Tentar avisar de novo" : `Avisar ${first}`}
          </button>
        ) : (
          <button type="button" className="elder-primary" onClick={onBack}>
            Voltar à rotina
          </button>
        )}
      </main>
    </>
  );
}

function Menu({ go, onBack, onLeave, onSwitchToFamily }: { go: (s: Screen) => void; onBack: () => void; onLeave: () => void; onSwitchToFamily: () => void }) {
  async function disconnect() {
    if (!window.confirm("Desconectar este celular do idoso? Os remédios e o histórico continuam guardados, mas será preciso vincular o celular de novo com um familiar.")) return;
    try {
      await api("/device/unlink", { method: "POST", as: "device" });
    } catch {
      /* segue mesmo sem internet */
    }
    tokens.setDevice(null);
    onLeave();
  }
  return (
    <>
      <Top onBack={onBack} />
      <main className="elder-main">
        <PushCard as="device" big when="always" />
        <button type="button" className="elder-secondary neutral" onClick={() => go({ name: "scan", test: true })}>
          <ScanLine size={28} /> Testar uma etiqueta
        </button>
        <button type="button" className="elder-secondary neutral" onClick={() => go({ name: "people" })}>
          <Eye size={28} /> Quem acompanha meus remédios
        </button>
        <button type="button" className="elder-secondary neutral" onClick={() => go({ name: "code" })}>
          <Link2 size={28} /> Vincular outro familiar
        </button>
        <button type="button" className="elder-secondary neutral" onClick={onSwitchToFamily}>
          <Users size={28} /> Usar o Modo Familiar neste aparelho
        </button>
        <button type="button" className="elder-link" onClick={disconnect}>
          Desconectar este celular
        </button>
      </main>
    </>
  );
}

function CodeDigits({ code }: { code: string }) {
  return <p className="big-code">{`${code.slice(0, 3)} ${code.slice(3)}`}</p>;
}

function ShowCode({ onBack }: { onBack: () => void }) {
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api<{ code: string }>("/device/code", { method: "POST", as: "device" })
      .then((r) => setCode(r.code))
      .catch((e) => setError(e.message));
  }, []);
  return (
    <>
      <Top onBack={onBack} />
      <main className="elder-main center">
        <Smartphone size={44} />
        <p className="ajuda-text">Mostre este código para o familiar digitar no celular dele:</p>
        {code ? <CodeDigits code={code} /> : <p>{error || "Gerando código…"}</p>}
        <p className="confirmed-info">O código vale por 10 minutos.</p>
      </main>
    </>
  );
}

function People({ view, onBack, reload }: { view: ElderView; onBack: () => void; reload: () => void }) {
  async function remove(c: Contact) {
    if (!window.confirm(`Tirar o acesso de ${c.name}? Essa pessoa não verá mais seus remédios.`)) return;
    try {
      await api(`/device/links/${c.userId}`, { method: "DELETE", as: "device" });
      reload();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Não foi possível agora.");
    }
  }
  return (
    <>
      <Top onBack={onBack} />
      <main className="elder-main">
        <p className="ajuda-text">Estas pessoas veem se você tomou seus remédios:</p>
        {view.contacts.map((c) => (
          <div key={c.userId} className="ajuda-person">
            <span className="avatar big">{c.name.charAt(0)}</span>
            <p style={{ flex: 1 }}>
              <strong>{c.name}</strong>
              <br />
              {c.relation}
              {c.trusted ? " · contato de confiança" : ""}
            </p>
            <button type="button" className="icon-btn" aria-label={`Tirar acesso de ${c.name}`} onClick={() => remove(c)}>
              <UserMinus />
            </button>
          </div>
        ))}
        {!view.contacts.length ? <p>Ninguém acompanha seus remédios agora.</p> : null}
      </main>
    </>
  );
}

function LinkCode({
  code,
  expiresAt,
  onRefresh,
  onLeave,
  onSwitchToFamily,
}: {
  code: string;
  expiresAt: string;
  onRefresh: () => void;
  onLeave: () => void;
  onSwitchToFamily: () => void;
}) {
  useEffect(() => {
    const id = setInterval(onRefresh, 4000);
    return () => clearInterval(id);
  }, [onRefresh]);
  const minutes = Math.max(0, Math.round((new Date(expiresAt).getTime() - Date.now()) / 60000));
  return (
    <div className="elder">
      <header className="elder-top">
        <span className="elder-hello">Vamos começar</span>
        <button
          type="button"
          className="elder-exit"
          onClick={() => {
            tokens.setDevice(null);
            onLeave();
          }}
        >
          <X size={22} /> Cancelar
        </button>
      </header>
      <main className="elder-main center">
        <Smartphone size={48} />
        <p className="ajuda-text">
          Peça ao seu familiar para abrir o MyHealthRoutine no celular dele, entrar no <strong>Modo Familiar</strong> e digitar este código:
        </p>
        <CodeDigits code={code} />
        <p className="confirmed-info">Vale por mais {minutes} minuto{minutes === 1 ? "" : "s"}. Esta tela muda sozinha quando o familiar terminar.</p>
        <button type="button" className="elder-secondary neutral" onClick={onSwitchToFamily}>
          <Users size={26} /> O familiar vai usar este mesmo aparelho
        </button>
        <p className="confirmed-info">Útil para testar num computador só: o código já aparece preenchido no Modo Familiar.</p>
      </main>
    </div>
  );
}
