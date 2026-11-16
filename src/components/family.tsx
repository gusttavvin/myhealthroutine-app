"use client";

import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Bell,
  Check,
  ChevronRight,
  ClipboardList,
  Clock3,
  Fingerprint,
  House,
  KeyRound,
  Link2,
  LogOut,
  Package,
  Pencil,
  Plus,
  ScanLine,
  Send,
  Smartphone,
  Tag,
  UserPlus,
  X,
} from "lucide-react";
import { createContext, useContext, useEffect, useRef, useState, type FormEvent } from "react";
import {
  DEMO_PIN,
  ELDER_FULL,
  ELDER_NAME,
  LINK_CODE,
  MARCOS,
  STATUS_TEXT,
  TODAY_LABEL,
  WEEKDAYS,
  adherence,
  dayLabel,
  fmt,
  freeLabels,
  labelFromCode,
  labelName,
  marco,
  suggestedLabel,
  todayDoses,
  toMinutes,
  uid,
  type Contact,
  type MarcoId,
  type Medication,
} from "@/lib/model";
import { useStore } from "@/lib/store";
import { LabelTag, MedBox, Viewfinder } from "./visuals";

/* ------------------------------------------------------------------ */
/* Aviso rápido (toast)                                                */
/* ------------------------------------------------------------------ */

type ToastKind = "ok" | "error";
const ToastContext = createContext<(message: string, kind?: ToastKind) => void>(() => {});
const useToast = () => useContext(ToastContext);

export function FamilyMode() {
  const { state } = useStore();
  const [toast, setToast] = useState<{ message: string; kind: ToastKind } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function notify(message: string, kind: ToastKind = "ok") {
    setToast({ message, kind });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 3600);
  }

  const scene = state.family;
  const logged = Boolean(state.user);

  return (
    <ToastContext.Provider value={notify}>
      <div className="family">
        {!logged || scene.name === "login" ? (
          scene.name === "senha" ? (
            <Identify contactId={scene.contactId} />
          ) : scene.name === "novo" ? (
            <NewProfile />
          ) : (
            <Login />
          )
        ) : (
          <>
            {scene.name === "painel" && <Dashboard />}
            {scene.name === "prescricoes" && <Prescriptions />}
            {scene.name === "prescricao" && <PrescriptionForm medId={scene.medId} />}
            {scene.name === "etiquetas" && <Labels />}
            {scene.name === "etiqueta" && <Associate medId={scene.medId} done={scene.done} />}
            {scene.name === "adesao" && <Adherence />}
            {scene.name === "estoque" && <Stock />}
            {(scene.name === "senha" || scene.name === "novo" || scene.name === "vincular") && <Dashboard />}
          </>
        )}
        {toast ? (
          <div className={`toast ${toast.kind}`} role="status">
            {toast.kind === "ok" ? <Check size={18} /> : <AlertTriangle size={18} />} {toast.message}
          </div>
        ) : null}
      </div>
    </ToastContext.Provider>
  );
}

function FamilyTop({ title, back = true }: { title: string; back?: boolean }) {
  const { dispatch } = useStore();
  return (
    <header className="fam-top">
      {back ? (
        <button type="button" className="icon-btn" aria-label="Voltar ao painel" onClick={() => dispatch({ type: "family", scene: { name: "painel" } })}>
          <ArrowLeft size={22} />
        </button>
      ) : (
        <span className="fam-logo">
          <Tag size={18} />
        </span>
      )}
      <h1>{title}</h1>
      <nav className="fam-ubiq" aria-label="Acesso rápido">
        {back ? (
          <button type="button" className="icon-btn" aria-label="Ir ao painel" title="Painel" onClick={() => dispatch({ type: "family", scene: { name: "painel" } })}>
            <House size={20} />
          </button>
        ) : null}
        <button type="button" className="icon-btn" aria-label="Sair do modo" title="Sair do modo" onClick={() => dispatch({ type: "logout" })}>
          <LogOut size={20} />
        </button>
      </nav>
    </header>
  );
}

/* ------------------------------------------------------------------ */
/* Identificação e vínculo                                             */
/* ------------------------------------------------------------------ */

function Login() {
  const { state, dispatch } = useStore();
  return (
    <>
      <header className="fam-top">
        <button type="button" className="icon-btn" aria-label="Voltar" onClick={() => dispatch({ type: "mode", mode: "start" })}>
          <ArrowLeft size={22} />
        </button>
        <h1>Modo Familiar / Cuidador</h1>
      </header>
      <main className="fam-main">
        <p className="fam-lead">Identifique-se para acompanhar a rotina de remédios de {ELDER_FULL}.</p>
        <p className="fam-label">Perfis vinculados</p>
        <ul className="person-list">
          {state.contacts.map((c) => (
            <li key={c.id}>
              <button type="button" onClick={() => dispatch({ type: "family", scene: { name: "senha", contactId: c.id } })}>
                <span className="avatar">{c.name.charAt(0)}</span>
                <span>
                  <strong>{c.name}</strong>
                  <small>
                    {c.relation}
                    {c.trusted ? " · contato de confiança" : ""}
                  </small>
                </span>
                <ChevronRight size={20} />
              </button>
            </li>
          ))}
        </ul>
        <button type="button" className="btn ghost wide" onClick={() => dispatch({ type: "family", scene: { name: "novo" } })}>
          <UserPlus size={18} /> Sou novo: vincular meu perfil
        </button>
      </main>
    </>
  );
}

function Identify({ contactId }: { contactId: string }) {
  const { state, dispatch } = useStore();
  const contact = state.contacts.find((c) => c.id === contactId);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [bio, setBio] = useState(false);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (pin !== DEMO_PIN) {
      setError("Senha não reconhecida. Confira e tente de novo.");
      return;
    }
    dispatch({ type: "login", contactId });
  }

  function biometric() {
    setBio(true);
    setTimeout(() => dispatch({ type: "login", contactId }), 900);
  }

  if (!contact) return <Login />;
  return (
    <>
      <header className="fam-top">
        <button type="button" className="icon-btn" aria-label="Voltar" onClick={() => dispatch({ type: "family", scene: { name: "login" } })}>
          <ArrowLeft size={22} />
        </button>
        <h1>Identificação</h1>
      </header>
      <main className="fam-main">
        <div className="who">
          <span className="avatar big">{contact.name.charAt(0)}</span>
          <p>
            <strong>{contact.name}</strong>
            <br />
            <small>{contact.relation}</small>
          </p>
        </div>
        <button type="button" className="btn primary wide" onClick={biometric} disabled={bio}>
          <Fingerprint size={20} /> {bio ? "Lendo digital…" : "Entrar com biometria"}
        </button>
        <p className="or">ou use a senha</p>
        <form onSubmit={submit} className="fam-form">
          <label className="field">
            <span>Senha de 4 números</span>
            <input
              inputMode="numeric"
              maxLength={4}
              type="password"
              value={pin}
              onChange={(e) => {
                setPin(e.target.value.replace(/\D/g, ""));
                setError("");
              }}
              aria-invalid={Boolean(error)}
              placeholder="••••"
            />
            {error ? <em className="field-error">{error}</em> : <small className="hint">No protótipo, a senha é {DEMO_PIN}.</small>}
          </label>
          <button type="submit" className="btn ghost wide">
            <KeyRound size={18} /> Confirmar identificação
          </button>
        </form>
      </main>
    </>
  );
}

function NewProfile() {
  const { state, dispatch } = useStore();
  const notify = useToast();
  const [step, setStep] = useState<"id" | "vinculo">("id");
  const [name, setName] = useState("");
  const [relation, setRelation] = useState("filho(a)");
  const [pin, setPin] = useState("");
  const [code, setCode] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  function confirmId(e: FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (name.trim().length < 3) errs.name = "Escreva seu nome.";
    if (pin.length !== 4) errs.pin = "Crie uma senha com 4 números.";
    setErrors(errs);
    if (Object.keys(errs).length === 0) setStep("vinculo");
  }

  function confirmLink(e: FormEvent) {
    e.preventDefault();
    if (code !== LINK_CODE) {
      setErrors({ code: "Código inválido ou expirado. Confira o código no celular do Sr. Aloísio." });
      return;
    }
    const contact: Contact = { id: uid(), name: name.trim(), relation, trusted: state.contacts.length === 0 };
    dispatch({ type: "link", contact });
    notify(`Perfil vinculado e autorizado por ${ELDER_NAME}.`);
  }

  return (
    <>
      <header className="fam-top">
        <button
          type="button"
          className="icon-btn"
          aria-label="Voltar"
          onClick={() => (step === "vinculo" ? setStep("id") : dispatch({ type: "family", scene: { name: "login" } }))}
        >
          <ArrowLeft size={22} />
        </button>
        <h1>{step === "id" ? "Novo perfil" : "Vincular ao idoso"}</h1>
      </header>
      <main className="fam-main">
        {step === "id" ? (
          <form className="fam-form" onSubmit={confirmId}>
            <p className="fam-lead">Primeiro, diga quem você é.</p>
            <label className="field">
              <span>Seu nome</span>
              <input value={name} onChange={(e) => setName(e.target.value)} aria-invalid={Boolean(errors.name)} placeholder="Ex.: Beatriz Mendes" />
              {errors.name ? <em className="field-error">{errors.name}</em> : null}
            </label>
            <label className="field">
              <span>Relação com o Sr. Aloísio</span>
              <select value={relation} onChange={(e) => setRelation(e.target.value)}>
                <option>filho(a)</option>
                <option>neto(a)</option>
                <option>cônjuge</option>
                <option>cuidador(a) formal</option>
                <option>outro</option>
              </select>
            </label>
            <label className="field">
              <span>Crie uma senha de 4 números</span>
              <input
                inputMode="numeric"
                maxLength={4}
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                aria-invalid={Boolean(errors.pin)}
                placeholder="••••"
              />
              {errors.pin ? <em className="field-error">{errors.pin}</em> : null}
            </label>
            <button type="submit" className="btn primary wide">
              Confirmar identificação
            </button>
          </form>
        ) : (
          <form className="fam-form" onSubmit={confirmLink}>
            <p className="fam-lead">
              No celular do Sr. Aloísio, abra o aplicativo e toque em <strong>“Mostrar código”</strong>. Digite aqui o código que aparecer.
            </p>
            <div className="phone-mini" aria-label="Simulação do celular do idoso">
              <span className="proto-chip">Simulação: celular do Sr. Aloísio</span>
              <Smartphone size={22} />
              <p>Código para vincular:</p>
              <strong className="mini-code">{LINK_CODE.split("").join(" ")}</strong>
              <small>vale por 10 minutos</small>
            </div>
            <label className="field">
              <span>Código rápido</span>
              <input
                inputMode="numeric"
                maxLength={4}
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.replace(/\D/g, ""));
                  setErrors({});
                }}
                aria-invalid={Boolean(errors.code)}
                placeholder="0000"
                className="code-input"
              />
              {errors.code ? <em className="field-error">{errors.code}</em> : null}
            </label>
            <div className="link-preview">
              <span className="avatar">{name.charAt(0) || "?"}</span>
              <Link2 size={18} />
              <span className="avatar avatar-idoso">A</span>
              <p>
                <strong>{name}</strong> ({relation}) será vinculado(a) a <strong>{ELDER_FULL}</strong>. Ele verá seu nome na tela inicial.
              </p>
            </div>
            <button type="submit" className="btn primary wide">
              <Link2 size={18} /> Confirmar vínculo
            </button>
          </form>
        )}
      </main>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Painel                                                              */
/* ------------------------------------------------------------------ */

function daysLeft(med: Medication) {
  return med.days.length ? Math.floor(med.stock / (med.days.length / 7)) : med.stock;
}

function Dashboard() {
  const { state, dispatch } = useStore();
  const user = state.contacts.find((c) => c.id === state.user);
  const doses = todayDoses(state);
  const lowStock = state.meds.filter((m) => daysLeft(m) <= 7);
  const noLabel = state.meds.filter((m) => !m.label);
  const notToday = state.meds.filter((m) => !doses.some((d) => d.med.id === m.id));
  const counts = {
    tomado: doses.filter((d) => d.status === "tomado").length,
    pend: doses.filter((d) => d.status === "agora" || d.status === "tolerancia").length,
    nao: doses.filter((d) => d.status === "nao-confirmada").length,
  };

  const go = (name: "prescricoes" | "etiquetas" | "adesao" | "estoque") => dispatch({ type: "family", scene: { name } });

  return (
    <>
      <FamilyTop title={`Olá, ${user?.name.split(" ")[0] ?? ""}`} back={false} />
      <main className="fam-main">
        <section className="fam-card">
          <p className="fam-card-title">
            Rotina de {ELDER_NAME} · <span className="muted">{TODAY_LABEL}</span>
          </p>
          <div className="counts">
            <span className="count ok">
              <b>{counts.tomado}</b> confirmadas
            </span>
            <span className="count pend">
              <b>{counts.pend}</b> pendentes
            </span>
            <span className="count bad">
              <b>{counts.nao}</b> não confirmadas
            </span>
          </div>
          <ul className="fam-doses">
            {doses.map((d) => (
              <li key={d.med.id}>
                <LabelTag code={d.med.label} marcoId={d.marco.id} size="sm" showNumber={false} />
                <span className="fam-dose-text">
                  <strong>
                    {d.med.name} {d.med.dosage}
                  </strong>
                  <small>
                    {d.marco.label} · {d.med.time}
                  </small>
                </span>
                <span className={`status-pill sm ${d.status}`}>
                  {d.status === "tomado" ? `✓ ${fmt(d.confirmedAt ?? 0)}` : STATUS_TEXT[d.status]}
                </span>
              </li>
            ))}
          </ul>
          {notToday.length ? (
            <p className="not-today">
              {notToday.map((m) => `${m.name} ${m.dosage} (${marco(m.marco).label}, ${m.time})`).join("; ")}: sem dose hoje
              {notToday.some((m) => m.createdAt !== undefined) ? ", começa no próximo horário." : "."}
            </p>
          ) : null}
        </section>

        {lowStock.length || noLabel.length || state.notices.length ? (
          <section className="fam-card alerts">
            <p className="fam-card-title">
              <Bell size={16} /> Alertas
            </p>
            {lowStock.map((m) => (
              <button key={m.id} type="button" className="alert-row warn" onClick={() => go("estoque")}>
                <Package size={18} />
                <span>
                  <strong>Estoque baixo:</strong> restam {m.stock} comprimidos de {m.name.split(" (")[0]} {m.dosage}
                </span>
                <ChevronRight size={16} />
              </button>
            ))}
            {noLabel.map((m) => (
              <button key={m.id} type="button" className="alert-row info" onClick={() => dispatch({ type: "family", scene: { name: "etiqueta", medId: m.id } })}>
                <Tag size={18} />
                <span>
                  <strong>Sem etiqueta:</strong> {m.name} ainda não tem etiqueta na caixa
                </span>
                <ChevronRight size={16} />
              </button>
            ))}
            {state.notices.slice(0, 4).map((n) => (
              <div key={n.id} className={`alert-row ${n.kind === "aviso" || n.kind === "ajuda" ? "bad" : "info"}`}>
                <Bell size={18} />
                <span>
                  <small>{fmt(n.at)}</small> {n.text}
                  {!n.delivered ? <em> (não entregue)</em> : null}
                </span>
              </div>
            ))}
          </section>
        ) : null}

        <p className="fam-label">Próximo passo</p>
        <div className="action-grid">
          <button type="button" onClick={() => go("prescricoes")}>
            <ClipboardList /> <span>Prescrições</span>
            <small>cadastrar ou editar</small>
          </button>
          <button type="button" onClick={() => go("etiquetas")}>
            <Tag /> <span>Etiquetas</span>
            <small>associar à caixa</small>
          </button>
          <button type="button" onClick={() => go("adesao")}>
            <BarChart3 /> <span>Adesão</span>
            <small>pontualidade e relatório</small>
          </button>
          <button type="button" onClick={() => go("estoque")}>
            <Package /> <span>Estoque</span>
            <small>avisar reposição</small>
          </button>
        </div>
      </main>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Prescrições                                                         */
/* ------------------------------------------------------------------ */

function Prescriptions() {
  const { state, dispatch } = useStore();
  return (
    <>
      <FamilyTop title="Prescrições" />
      <main className="fam-main">
        <button type="button" className="btn primary wide" onClick={() => dispatch({ type: "family", scene: { name: "prescricao", medId: null } })}>
          <Plus size={18} /> Nova prescrição
        </button>
        <p className="fam-label">Já cadastradas · toque para editar</p>
        <ul className="med-list">
          {state.meds.map((m) => {
            const mc = marco(m.marco);
            return (
              <li key={m.id}>
                <button type="button" onClick={() => dispatch({ type: "family", scene: { name: "prescricao", medId: m.id } })}>
                  <LabelTag code={m.label} marcoId={m.marco} size="sm" showNumber={false} />
                  <span>
                    <strong>
                      {m.name} {m.dosage}
                    </strong>
                    <small>
                      {m.amount} · {mc.label} · {m.time} · {m.days.length === 7 ? "todos os dias" : m.days.map((d) => WEEKDAYS[d].label.slice(0, 3)).join(", ")}
                    </small>
                  </span>
                  <Pencil size={16} />
                </button>
              </li>
            );
          })}
        </ul>
      </main>
    </>
  );
}

type FormData = {
  name: string;
  dosage: string;
  amount: string;
  marco: MarcoId | "";
  time: string;
  days: number[];
  stock: string;
  lot: string;
};

function PrescriptionForm({ medId }: { medId: string | null }) {
  const { state, dispatch } = useStore();
  const notify = useToast();
  const existing = medId ? state.meds.find((m) => m.id === medId) : null;
  const [form, setForm] = useState<FormData>(
    existing
      ? {
          name: existing.name,
          dosage: existing.dosage,
          amount: existing.amount,
          marco: existing.marco,
          time: existing.time,
          days: existing.days,
          stock: String(existing.stock),
          lot: existing.lot,
        }
      : { name: "", dosage: "", amount: "1 comprimido", marco: "", time: "", days: [0, 1, 2, 3, 4, 5, 6], stock: "", lot: "" },
  );
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const firstError = useRef<HTMLDivElement | null>(null);

  const set = <K extends keyof FormData>(key: K, value: FormData[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  function pickMarco(id: MarcoId) {
    const mc = marco(id);
    setForm((f) => ({ ...f, marco: id, time: f.time && f.marco === id ? f.time : mc.defaultTime }));
    setErrors((e) => ({ ...e, marco: undefined, time: undefined }));
  }

  function validate() {
    const e: Partial<Record<keyof FormData, string>> = {};
    if (!form.name.trim()) e.name = "Informe o nome do medicamento.";
    if (!form.dosage.trim()) e.dosage = "Informe a dosagem (ex.: 50 mg).";
    else if (!/\d/.test(form.dosage)) e.dosage = "A dosagem precisa ter um número (ex.: 50 mg).";
    if (!form.marco) e.marco = "Escolha o marco da rotina.";
    if (!form.time) e.time = "Informe o horário.";
    if (form.marco && form.time) {
      const mc = marco(form.marco);
      const t = toMinutes(form.time);
      if (t < mc.range[0] || t > mc.range[1]) {
        e.time = `O horário ${form.time} não combina com “${mc.label}” (de ${fmt(mc.range[0])} a ${fmt(mc.range[1])}).`;
      }
    }
    if (!form.days.length) e.days = "Escolha pelo menos um dia.";
    const stock = Number(form.stock);
    if (!form.stock || !Number.isInteger(stock) || stock < 1) e.stock = "Informe quantos comprimidos há na caixa.";
    const dup = state.meds.find(
      (m) => m.id !== medId && m.name.trim().toLowerCase() === form.name.trim().toLowerCase() && m.marco === form.marco,
    );
    if (dup && !e.name) e.name = `${dup.name} já está cadastrado em “${marco(dup.marco).label}”.`;
    return e;
  }

  function save(ev: FormEvent) {
    ev.preventDefault();
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) {
      setTimeout(() => firstError.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
      return;
    }
    const marcoChanged = existing && existing.marco !== form.marco;
    const med: Medication = {
      id: existing?.id ?? uid(),
      name: form.name.trim(),
      dosage: form.dosage.trim(),
      amount: form.amount,
      marco: form.marco as MarcoId,
      time: form.time,
      days: [...form.days].sort(),
      stock: Number(form.stock),
      lot: form.lot.trim() || "—",
      label: marcoChanged ? null : existing?.label ?? null,
      createdAt: existing ? existing.createdAt : state.now,
    };
    dispatch({ type: "saveMed", med });
    if (!med.label) {
      notify(marcoChanged ? "Prescrição salva. O marco mudou: troque a etiqueta da caixa." : "Prescrição salva. Agora associe a etiqueta.");
      dispatch({ type: "family", scene: { name: "etiqueta", medId: med.id } });
    } else {
      notify("Prescrição atualizada.");
      dispatch({ type: "family", scene: { name: "prescricoes" } });
    }
  }

  const errorCount = Object.values(errors).filter(Boolean).length;

  return (
    <>
      <FamilyTop title={existing ? "Editar prescrição" : "Nova prescrição"} />
      <main className="fam-main">
        <form className="fam-form" onSubmit={save} noValidate>
          <div ref={firstError} />
          {errorCount ? (
            <p className="form-alert" role="alert">
              <AlertTriangle size={18} /> Confira {errorCount === 1 ? "o campo marcado" : `os ${errorCount} campos marcados`}.
            </p>
          ) : null}
          <label className="field">
            <span>Medicamento</span>
            <input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Ex.: Omeprazol" aria-invalid={Boolean(errors.name)} />
            {errors.name ? <em className="field-error">{errors.name}</em> : null}
          </label>
          <div className="field-row">
            <label className="field">
              <span>Dosagem</span>
              <input value={form.dosage} onChange={(e) => set("dosage", e.target.value)} placeholder="Ex.: 20 mg" aria-invalid={Boolean(errors.dosage)} />
              {errors.dosage ? <em className="field-error">{errors.dosage}</em> : null}
            </label>
            <label className="field">
              <span>Quanto tomar</span>
              <select value={form.amount} onChange={(e) => set("amount", e.target.value)}>
                <option>1 comprimido</option>
                <option>2 comprimidos</option>
                <option>meio comprimido</option>
                <option>1 cápsula</option>
                <option>10 gotas</option>
              </select>
            </label>
          </div>

          <div className="field">
            <span>Marco da rotina</span>
            <small className="hint">O Sr. Aloísio vai reconhecer o remédio pelo momento do dia, pela cor e pelo ícone.</small>
            <div className="marco-grid" role="radiogroup" aria-invalid={Boolean(errors.marco)}>
              {MARCOS.map((mc) => (
                <button
                  key={mc.id}
                  type="button"
                  role="radio"
                  aria-checked={form.marco === mc.id}
                  className={`marco-opt ${form.marco === mc.id ? "on" : ""}`}
                  onClick={() => pickMarco(mc.id)}
                >
                  <LabelTag marcoId={mc.id} size="sm" showNumber={false} />
                  <span>
                    {mc.label}
                    <small>
                      {mc.colorName} · {mc.iconName}
                    </small>
                  </span>
                </button>
              ))}
            </div>
            {errors.marco ? <em className="field-error">{errors.marco}</em> : null}
          </div>

          <label className="field">
            <span>Horário</span>
            <input type="time" value={form.time} onChange={(e) => set("time", e.target.value)} aria-invalid={Boolean(errors.time)} />
            {errors.time ? <em className="field-error">{errors.time}</em> : null}
          </label>

          <div className="field">
            <span>Frequência</span>
            <div className="weekdays">
              {WEEKDAYS.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  aria-pressed={form.days.includes(d.value)}
                  aria-label={d.label}
                  title={d.label}
                  className={form.days.includes(d.value) ? "on" : ""}
                  onClick={() =>
                    set("days", form.days.includes(d.value) ? form.days.filter((x) => x !== d.value) : [...form.days, d.value])
                  }
                >
                  {d.short}
                </button>
              ))}
              <button type="button" className="all-days" onClick={() => set("days", [0, 1, 2, 3, 4, 5, 6])}>
                todos
              </button>
            </div>
            {errors.days ? <em className="field-error">{errors.days}</em> : null}
          </div>

          <div className="field-row">
            <label className="field">
              <span>Comprimidos na caixa</span>
              <input inputMode="numeric" value={form.stock} onChange={(e) => set("stock", e.target.value.replace(/\D/g, ""))} placeholder="Ex.: 30" aria-invalid={Boolean(errors.stock)} />
              {errors.stock ? <em className="field-error">{errors.stock}</em> : null}
            </label>
            <label className="field">
              <span>Lote (opcional)</span>
              <input value={form.lot} onChange={(e) => set("lot", e.target.value.toUpperCase())} placeholder="Ex.: OM5521" />
            </label>
          </div>

          <button type="submit" className="btn primary wide">
            <Check size={18} /> Salvar prescrição
          </button>
        </form>
      </main>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Etiquetas                                                           */
/* ------------------------------------------------------------------ */

function Labels() {
  const { state, dispatch } = useStore();
  return (
    <>
      <FamilyTop title="Etiquetas" />
      <main className="fam-main">
        <p className="fam-lead">Cada caixa recebe uma etiqueta com a cor e o ícone do seu marco. Escolha o medicamento:</p>
        <ul className="med-list">
          {state.meds.map((m) => (
            <li key={m.id}>
              <button type="button" onClick={() => dispatch({ type: "family", scene: { name: "etiqueta", medId: m.id } })}>
                <LabelTag code={m.label} marcoId={m.marco} size="sm" />
                <span>
                  <strong>
                    {m.name} {m.dosage}
                  </strong>
                  <small className={m.label ? "" : "warn-text"}>{m.label ? labelName(m.label) : "sem etiqueta — associar agora"}</small>
                </span>
                <ChevronRight size={16} />
              </button>
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}

function Associate({ medId, done }: { medId: string; done?: boolean }) {
  const { state, dispatch } = useStore();
  const notify = useToast();
  const med = state.meds.find((m) => m.id === medId);
  const [phase, setPhase] = useState<"indicate" | "camera" | "reading" | "read" | "error">("indicate");
  const [readCode, setReadCode] = useState<string | null>(null);
  const [error, setError] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  if (!med) return <Labels />;
  const mc = marco(med.marco);
  const suggested = suggestedLabel(state, med);
  const free = freeLabels(state);
  const labeledBoxes = state.meds.filter((m) => m.label && m.id !== med.id);

  function read(code: string) {
    setReadCode(code);
    setPhase("reading");
    timer.current = setTimeout(() => {
      if (state.nextReadFails) {
        dispatch({ type: "consumeReadFail" });
        setError("Não foi possível ler o código. Evite reflexo e aproxime de novo.");
        return setPhase("error");
      }
      const owner = state.meds.find((m) => m.label === code);
      if (owner) {
        setError(`Esta etiqueta já está associada a ${owner.name} ${owner.dosage}. Use a ${suggested ? labelName(suggested) : "etiqueta indicada"}.`);
        return setPhase("error");
      }
      if (code !== suggested) {
        const l = labelFromCode(code);
        const other = marco(l.marco);
        setError(
          other.id === mc.id
            ? `Esta é a etiqueta nº ${l.n}. Use a nº ${suggested ? labelFromCode(suggested).n : "?"}, indicada acima.`
            : `Esta é a etiqueta ${other.colorName} (${other.label}). Para “${mc.label}” use a ${mc.colorName} com ${mc.iconName}.`,
        );
        return setPhase("error");
      }
      setPhase("read");
    }, 1000);
  }

  function confirm() {
    if (!readCode) return;
    dispatch({ type: "associate", medId: med!.id, code: readCode });
    dispatch({ type: "family", scene: { name: "etiqueta", medId: med!.id, done: true } });
    notify("Etiqueta associada.");
  }

  function testRead() {
    dispatch({ type: "elder", scene: { name: "scan", test: med!.id } });
    dispatch({ type: "mode", mode: "elder" });
  }

  if (done && med.label) {
    return (
      <>
        <FamilyTop title="Etiqueta associada" />
        <main className="fam-main center">
          <span className="done-check">
            <Check size={40} strokeWidth={3} />
          </span>
          <LabelTag code={med.label} size="xl" />
          <p className="fam-lead">
            <strong>
              {med.name} {med.dosage}
            </strong>{" "}
            agora tem a <strong>{labelName(med.label)}</strong> ({mc.label}, {med.time}).
          </p>
          <div className="tip">
            <Smartphone size={20} />
            <p>Entregue o celular ao Sr. Aloísio e façam juntos uma leitura de teste. Nada será registrado.</p>
          </div>
          <button type="button" className="btn primary wide" onClick={testRead}>
            <ScanLine size={18} /> Fazer leitura de teste com o Sr. Aloísio
          </button>
          <button type="button" className="btn ghost wide" onClick={() => dispatch({ type: "family", scene: { name: "painel" } })}>
            Voltar ao painel
          </button>
        </main>
      </>
    );
  }

  return (
    <>
      <FamilyTop title={med.label ? "Trocar etiqueta" : "Associar etiqueta"} />
      <main className="fam-main">
        <label className="field">
          <span>Medicamento que receberá a etiqueta</span>
          <select
            value={med.id}
            onChange={(e) => {
              setPhase("indicate");
              dispatch({ type: "family", scene: { name: "etiqueta", medId: e.target.value } });
            }}
          >
            {state.meds.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} {m.dosage} — {marco(m.marco).label}
              </option>
            ))}
          </select>
        </label>

        {suggested ? (
          <section className="fam-card indicate">
            <p className="step-n">1. Cole esta etiqueta na caixa</p>
            <div className="indicate-row">
              <LabelTag code={suggested} size="xl" />
              <p>
                Pegue na cartela a <strong>{labelName(suggested)}</strong> e cole na lateral da caixa de{" "}
                <strong>
                  {med.name} {med.dosage}
                </strong>
                .
                <small>
                  {mc.label} · {med.time}
                </small>
              </p>
            </div>
          </section>
        ) : (
          <p className="form-alert">
            <AlertTriangle size={18} /> Acabaram as etiquetas {mc.colorName}s da cartela.
          </p>
        )}

        <section className="fam-card">
          <p className="step-n">2. Leia o código da etiqueta com a câmera</p>
          {phase === "indicate" ? (
            <button type="button" className="btn primary wide" onClick={() => setPhase("camera")} disabled={!suggested}>
              <ScanLine size={18} /> Abrir a câmera
            </button>
          ) : phase === "read" && readCode ? (
            <div className="read-result">
              <p className="muted">Etiqueta lida:</p>
              <div className="assoc-preview">
                <LabelTag code={readCode} size="lg" />
                <ChevronRight />
                <span>
                  <strong>
                    {med.name} {med.dosage}
                  </strong>
                  <small>
                    {mc.label} · {med.time} · {med.amount}
                  </small>
                </span>
              </div>
              <button type="button" className="btn primary wide" onClick={confirm}>
                <Check size={18} /> Confirmar associação
              </button>
              <button type="button" className="btn ghost wide" onClick={() => setPhase("camera")}>
                Ler outra etiqueta
              </button>
            </div>
          ) : (
            <>
              <Viewfinder state={phase === "reading" ? "reading" : phase === "error" ? "error" : "idle"}>
                {phase === "reading" && readCode ? (
                  <div className="in-camera small">
                    <LabelTag code={readCode} size="lg" />
                    <p>Lendo o código…</p>
                  </div>
                ) : phase === "error" ? (
                  <div className="scan-error small" role="alert">
                    <AlertTriangle size={26} />
                    <p>{error}</p>
                  </div>
                ) : (
                  <p className="camera-hint small">Aponte para o código da etiqueta</p>
                )}
              </Viewfinder>
              {phase === "error" ? (
                <button type="button" className="btn primary wide" onClick={() => setPhase("camera")}>
                  Tentar de novo
                </button>
              ) : null}
              <div className="table-area fam">
                <p className="table-title">
                  <span className="proto-chip">Simulação</span> Cartela de etiquetas livres — toque na que você colou:
                </p>
                <div className="sheet">
                  {free.map((l) => (
                    <button key={l.code} type="button" className="sheet-label" onClick={() => read(l.code)} disabled={phase === "reading"}>
                      <LabelTag code={l.code} size="sm" />
                    </button>
                  ))}
                </div>
                {labeledBoxes.length ? (
                  <>
                    <p className="table-title">Caixas que já têm etiqueta:</p>
                    <div className="table-boxes small">
                      {labeledBoxes.map((m) => (
                        <MedBox key={m.id} med={m} onClick={() => read(m.label!)} disabled={phase === "reading"} />
                      ))}
                    </div>
                  </>
                ) : null}
              </div>
            </>
          )}
        </section>
      </main>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Adesão                                                              */
/* ------------------------------------------------------------------ */

function Adherence() {
  const { state, dispatch } = useStore();
  const notify = useToast();
  const [period, setPeriod] = useState(7);
  const [report, setReport] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const data = adherence(state, period);
  const histMeds = state.meds.filter((m) => state.history.some((h) => h.medId === m.id));
  const range = `${dayLabel(-period)} a ${dayLabel(-1)}`;

  function generate() {
    setGenerating(true);
    setError("");
    setTimeout(() => {
      setGenerating(false);
      if (state.offline) {
        setError("O relatório não foi gerado porque o celular está sem internet. Tente de novo.");
        return;
      }
      const lines = [
        `Relatório de adesão — ${ELDER_FULL}`,
        `Período: últimos ${period} dias (${range})`,
        `Pontualidade: ${data.pct}% (${data.onTime} de ${data.total} doses no horário, até ${20} min)`,
        `Com atraso: ${data.late} · Não confirmadas: ${data.missed}`,
        "",
        ...histMeds.map((m) => {
          const es = data.days.flatMap((d) => d.entries.filter((e) => e.medId === m.id));
          const ok = es.filter((e) => e.delay !== null && e.delay < 20).length;
          return `• ${m.name} ${m.dosage} (${marco(m.marco).label}, ${m.time}): ${ok}/${es.length} no horário`;
        }),
      ];
      setReport(lines.join("\n"));
      dispatch({ type: "notice", notice: { kind: "relatorio", to: "você", text: `Relatório de adesão gerado (${period} dias, ${data.pct}%).`, delivered: true } });
    }, 900);
  }

  async function share() {
    if (!report) return;
    try {
      if (navigator.share) await navigator.share({ title: "Relatório de adesão", text: report });
      else {
        await navigator.clipboard.writeText(report);
        notify("Relatório copiado. Cole na mensagem para o geriatra.");
      }
    } catch {
      /* cancelado */
    }
  }

  return (
    <>
      <FamilyTop title="Adesão ao tratamento" />
      <main className="fam-main">
        <div className="segmented" role="radiogroup" aria-label="Período">
          {[7, 30].map((p) => (
            <button key={p} type="button" role="radio" aria-checked={period === p} className={period === p ? "on" : ""} onClick={() => setPeriod(p)}>
              Últimos {p} dias
            </button>
          ))}
        </div>

        <section className="fam-card adh-summary">
          <div className="ring" style={{ ["--p" as string]: `${data.pct}` }}>
            <b>{data.pct}%</b>
          </div>
          <div>
            <p className="fam-card-title">Pontualidade</p>
            <p className="muted small">
              {range} · dose confirmada pela leitura da etiqueta em até 20 min
            </p>
            <p className="adh-counts">
              <span className="ok">✓ {data.onTime} no horário</span>
              <span className="late">⏱ {data.late} com atraso</span>
              <span className="miss">✗ {data.missed} não confirmadas</span>
            </p>
          </div>
        </section>

        <section className="fam-card">
          <p className="fam-card-title">Histórico de confirmações</p>
          <div className="hist" style={{ ["--cols" as string]: histMeds.length }}>
            <div className="hist-row head">
              <span>Dia</span>
              {histMeds.map((m) => (
                <span key={m.id} title={m.name}>
                  <LabelTag code={m.label} marcoId={m.marco} size="sm" showNumber={false} />
                </span>
              ))}
            </div>
            {[...data.days].reverse().map((d) => (
              <div className="hist-row" key={d.day}>
                <span className="hist-day">{dayLabel(d.day)}</span>
                {histMeds.map((m) => {
                  const e = d.entries.find((x) => x.medId === m.id);
                  if (!e) return <span key={m.id} className="cell none">–</span>;
                  if (e.delay === null)
                    return (
                      <span key={m.id} className="cell miss" title="Não confirmada">
                        ✗
                      </span>
                    );
                  const time = fmt(toMinutes(m.time) + e.delay);
                  return (
                    <span key={m.id} className={`cell ${e.delay < 20 ? "ok" : "late"}`} title={`Confirmada às ${time}`}>
                      {e.delay < 20 ? "✓" : "⏱"} <small>{time}</small>
                    </span>
                  );
                })}
              </div>
            ))}
          </div>
        </section>

        {error ? (
          <p className="form-alert" role="alert">
            <AlertTriangle size={18} /> {error}
          </p>
        ) : null}
        <button type="button" className="btn primary wide" onClick={generate} disabled={generating}>
          <BarChart3 size={18} /> {generating ? "Gerando…" : error ? "Tentar gerar de novo" : "Gerar relatório"}
        </button>
      </main>

      {report ? (
        <div className="sheet-modal" role="dialog" aria-label="Relatório gerado">
          <div className="sheet-modal-card">
            <header>
              <strong>Relatório gerado</strong>
              <button type="button" className="icon-btn" aria-label="Fechar" onClick={() => setReport(null)}>
                <X size={20} />
              </button>
            </header>
            <pre>{report}</pre>
            <button type="button" className="btn primary wide" onClick={share}>
              <Send size={18} /> Compartilhar
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Estoque                                                             */
/* ------------------------------------------------------------------ */

function Stock() {
  const { state, dispatch } = useStore();
  const notify = useToast();
  const [open, setOpen] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const user = state.contacts.find((c) => c.id === state.user);
  const recipients = state.contacts.filter((c) => c.id !== state.user).map((c) => c.name.split(" ")[0]);

  function send(med: Medication) {
    setSending(true);
    setError("");
    setTimeout(() => {
      setSending(false);
      if (state.offline) {
        setError("Aviso não enviado: sem internet. Tente de novo.");
        return;
      }
      dispatch({
        type: "notice",
        notice: {
          kind: "reposicao",
          to: "família",
          text: `Reposição: ${med.name} ${med.dosage}, lote ${med.lot}. Restam ${med.stock} comprimidos. (enviado por ${user?.name.split(" ")[0] ?? "você"})`,
          delivered: true,
        },
      });
      setOpen(null);
      notify("Aviso enviado à família, com lote e dosagem.");
    }, 900);
  }

  return (
    <>
      <FamilyTop title="Estoque" />
      <main className="fam-main">
        <p className="fam-lead small">A contagem começa no cadastro da caixa e diminui a cada leitura da etiqueta.</p>
        <ul className="stock-list">
          {[...state.meds]
            .sort((a, b) => daysLeft(a) - daysLeft(b))
            .map((m) => {
              const left = daysLeft(m);
              const low = left <= 7;
              const msg = `Precisamos repor ${m.name} ${m.dosage} (lote ${m.lot}). Restam ${m.stock} comprimidos, o que dá para cerca de ${left} dia${left === 1 ? "" : "s"}.`;
              return (
                <li key={m.id} className={low ? "low" : ""}>
                  <div className="stock-head">
                    <LabelTag code={m.label} marcoId={m.marco} size="sm" showNumber={false} />
                    <span>
                      <strong>
                        {m.name} {m.dosage}
                      </strong>
                      <small>lote {m.lot}</small>
                    </span>
                    <span className="stock-qty">
                      <b>{m.stock}</b>
                      <small>restam</small>
                    </span>
                  </div>
                  <div className="bar">
                    <i style={{ width: `${Math.min(100, (m.stock / 30) * 100)}%` }} />
                  </div>
                  {low ? (
                    <p className="stock-alert">
                      <AlertTriangle size={16} /> Alerta: restam {m.stock} comprimidos (≈ {left} dias)
                    </p>
                  ) : (
                    <p className="muted small">
                      <Clock3 size={14} /> dura cerca de {left} dias
                    </p>
                  )}
                  {open === m.id ? (
                    <div className="composer">
                      <p className="muted small">Mensagem para a família {recipients.length ? `(${recipients.join(", ")})` : ""}:</p>
                      <p className="composer-msg">{msg}</p>
                      {error ? <em className="field-error">{error}</em> : null}
                      <div className="composer-actions">
                        <button type="button" className="btn ghost" onClick={() => setOpen(null)}>
                          Cancelar
                        </button>
                        <button type="button" className="btn primary" onClick={() => send(m)} disabled={sending}>
                          <Send size={16} /> {sending ? "Enviando…" : error ? "Tentar de novo" : "Enviar aviso"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className={`btn ${low ? "primary" : "ghost"} wide`}
                      onClick={() => {
                        setOpen(m.id);
                        setError("");
                      }}
                    >
                      <Bell size={16} /> Avisar reposição
                    </button>
                  )}
                </li>
              );
            })}
        </ul>
      </main>
    </>
  );
}
