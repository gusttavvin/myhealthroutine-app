"use client";

import QRCode from "qrcode";
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Bell,
  Check,
  ChevronRight,
  ClipboardList,
  Clock3,
  House,
  Link2,
  LogOut,
  Package,
  PackagePlus,
  Pencil,
  Plus,
  Printer,
  ScanLine,
  Send,
  ShieldCheck,
  Smartphone,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type FormEvent } from "react";
import { MARCOS, WEEKDAYS, marco } from "@/lib/model";
import { LabelTag } from "@/components/visuals";
import { ApiError, api, fmtMin, tokens } from "./api";
import { PushCard } from "./push-card";
import { QrScanner } from "./qr-scanner";
import type { ElderView, History, LabelRow, MarcoId, Me, Med } from "./types";

/* ------------------------------------------------------------------ */

type Screen =
  | { name: "painel" }
  | { name: "prescricoes" }
  | { name: "prescricao"; medId: string | null }
  | { name: "etiquetas" }
  | { name: "etiqueta"; medId: string; done?: boolean }
  | { name: "imprimir" }
  | { name: "adesao" }
  | { name: "estoque" }
  | { name: "vincular" };

type Ctx = {
  me: Me;
  elderId: string;
  view: ElderView | null;
  reload: () => Promise<void>;
  go: (s: Screen) => void;
  notify: (msg: string, kind?: "ok" | "error") => void;
  logout: () => void;
};
const FamilyCtx = createContext<Ctx | null>(null);
const useFam = () => useContext(FamilyCtx)!;

const ELDER_KEY = "mhr-idoso-selecionado";

function daysLeft(m: Med) {
  return m.days.length ? Math.floor(m.stock / (m.days.length / 7)) : m.stock;
}

/* ------------------------------------------------------------------ */
/* Entrada                                                             */
/* ------------------------------------------------------------------ */

export function FamilyReal({ onLeave }: { onLeave: () => void }) {
  const [logged, setLogged] = useState(Boolean(tokens.session()));
  if (!logged) return <Auth onDone={() => setLogged(true)} onBack={onLeave} />;
  return (
    <FamilyApp
      onLogout={() => {
        setLogged(false);
        onLeave();
      }}
    />
  );
}

/** Formata o celular enquanto digita: (31) 99999-9999. Aceita só números. */
function maskPhone(value: string) {
  const d = value.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** E-mail sem espaços e em letras minúsculas. */
function cleanEmail(value: string) {
  return value.replace(/\s/g, "").toLowerCase();
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;

function Auth({ onDone, onBack }: { onDone: () => void; onBack: () => void }) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setFields((f) => ({ ...f, [k]: "" }));
    setError("");
  };

  function checkEmail() {
    if (form.email && !EMAIL_RE.test(form.email)) setFields((f) => ({ ...f, email: "Confira o e-mail. Exemplo: nome@gmail.com" }));
  }
  function checkPhone() {
    const digits = form.phone.replace(/\D/g, "");
    if (digits && digits.length < 10) setFields((f) => ({ ...f, phone: "Digite o celular com DDD. Exemplo: (31) 99999-9999" }));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const local: Record<string, string> = {};
    if (!EMAIL_RE.test(form.email)) local.email = "Confira o e-mail. Exemplo: nome@gmail.com";
    const digits = form.phone.replace(/\D/g, "");
    if (mode === "signup" && digits && digits.length < 10) local.phone = "Digite o celular com DDD. Exemplo: (31) 99999-9999";
    if (Object.keys(local).length) {
      setFields(local);
      setError("Confira os campos marcados.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const r = await api<{ token: string }>(mode === "login" ? "/auth/login" : "/auth/signup", { method: "POST", body: { ...form, phone: digits } });
      tokens.setSession(r.token);
      onDone();
    } catch (err) {
      if (err instanceof ApiError) {
        setFields(err.fields);
        setError(err.message);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="family">
      <header className="fam-top">
        <button type="button" className="icon-btn" aria-label="Voltar" onClick={onBack}>
          <ArrowLeft size={22} />
        </button>
        <h1>Modo Familiar / Cuidador</h1>
      </header>
      <main className="fam-main">
        <div className="segmented" role="tablist">
          <button type="button" className={mode === "login" ? "on" : ""} onClick={() => setMode("login")}>
            Entrar
          </button>
          <button type="button" className={mode === "signup" ? "on" : ""} onClick={() => setMode("signup")}>
            Criar conta
          </button>
        </div>
        <form className="fam-form" onSubmit={submit} noValidate>
          {mode === "signup" ? (
            <label className="field">
              <span>Seu nome</span>
              <input value={form.name} onChange={(e) => set("name", e.target.value)} autoComplete="name" aria-invalid={Boolean(fields.name)} />
              {fields.name ? <em className="field-error">{fields.name}</em> : null}
            </label>
          ) : null}
          <label className="field">
            <span>E-mail</span>
            <input
              type="email"
              inputMode="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              maxLength={120}
              value={form.email}
              onChange={(e) => set("email", cleanEmail(e.target.value))}
              onBlur={checkEmail}
              autoComplete="email"
              placeholder="nome@gmail.com"
              aria-invalid={Boolean(fields.email)}
            />
            {fields.email ? <em className="field-error">{fields.email}</em> : null}
          </label>
          {mode === "signup" ? (
            <label className="field">
              <span>Celular (opcional)</span>
              <input
                type="tel"
                inputMode="numeric"
                value={form.phone}
                onChange={(e) => set("phone", maskPhone(e.target.value))}
                onBlur={checkPhone}
                autoComplete="tel-national"
                placeholder="(31) 99999-9999"
                aria-invalid={Boolean(fields.phone)}
              />
              {fields.phone ? (
                <em className="field-error">{fields.phone}</em>
              ) : (
                <small className="hint">Aparece para o idoso no botão “Ligar” quando um aviso não chega.</small>
              )}
            </label>
          ) : null}
          <label className="field">
            <span>Senha</span>
            <input
              type="password"
              value={form.password}
              onChange={(e) => set("password", e.target.value)}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              aria-invalid={Boolean(fields.password)}
            />
            {fields.password ? <em className="field-error">{fields.password}</em> : mode === "signup" ? <small className="hint">Pelo menos 8 caracteres.</small> : null}
          </label>
          {error && !Object.values(fields).some(Boolean) ? (
            <p className="form-alert" role="alert">
              <AlertTriangle size={18} /> {error}
            </p>
          ) : null}
          <button type="submit" className="btn primary wide" disabled={busy}>
            {busy ? "Aguarde…" : mode === "login" ? "Entrar" : "Criar conta"}
          </button>
        </form>
      </main>
    </div>
  );
}

function FamilyApp({ onLogout: onLogoutProp }: { onLogout: () => void }) {
  const logoutRef = useRef(onLogoutProp);
  logoutRef.current = onLogoutProp;
  const onLogout = useCallback(() => logoutRef.current(), []);
  const [me, setMe] = useState<Me | null>(null);
  const [elderId, setElderId] = useState<string | null>(null);
  const [view, setView] = useState<ElderView | null>(null);
  const [screen, setScreen] = useState<Screen>({ name: "painel" });
  const [toast, setToast] = useState<{ msg: string; kind: "ok" | "error" } | null>(null);
  const [loadError, setLoadError] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const logout = useCallback(async () => {
    try {
      await api("/auth/logout", { method: "POST" });
    } catch {
      /* ignora */
    }
    tokens.setSession(null);
    onLogout();
  }, [onLogout]);

  const loadMe = useCallback(async () => {
    try {
      const m = await api<Me>("/me");
      setMe(m);
      const saved = localStorage.getItem(ELDER_KEY);
      const pick = m.elders.find((e) => e.id === saved)?.id ?? m.elders[0]?.id ?? null;
      setElderId(pick);
      setLoadError("");
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) onLogout();
      else setLoadError(e instanceof Error ? e.message : "Sem conexão.");
    }
  }, [onLogout]);

  const reload = useCallback(async () => {
    if (!elderId) return;
    try {
      setView(await api<ElderView>(`/elders/${elderId}`));
      setLoadError("");
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) onLogout();
      else if (e instanceof ApiError && (e.status === 403 || e.status === 404)) {
        // O idoso tirou o acesso: volta para a lista de idosos acompanhados.
        localStorage.removeItem(ELDER_KEY);
        await loadMe();
      } else setLoadError(e instanceof Error ? e.message : "Sem conexão.");
    }
  }, [elderId, onLogout, loadMe]);

  useEffect(() => {
    loadMe();
  }, [loadMe]);

  useEffect(() => {
    if (elderId) localStorage.setItem(ELDER_KEY, elderId);
    setView(null);
    reload();
    const id = setInterval(reload, 60000);
    return () => clearInterval(id);
  }, [elderId, reload]);

  function notify(msg: string, kind: "ok" | "error" = "ok") {
    setToast({ msg, kind });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 3800);
  }

  function go(s: Screen) {
    setScreen(s);
    window.scrollTo({ top: 0 });
    if (s.name === "painel") reload();
  }

  if (!me) {
    return (
      <div className="family center-screen">
        {loadError ? (
          <>
            <p className="form-alert">{loadError}</p>
            <button type="button" className="btn primary" onClick={loadMe}>
              Tentar de novo
            </button>
          </>
        ) : (
          <p className="loading-text">Carregando…</p>
        )}
      </div>
    );
  }

  const ctx: Ctx = { me, elderId: elderId ?? "", view, reload, go, notify, logout };

  return (
    <FamilyCtx.Provider value={ctx}>
      <div className="family">
        {!elderId || screen.name === "vincular" ? (
          <LinkElder
            first={!elderId}
            onLinked={async (id) => {
              await loadMe();
              setElderId(id);
              setScreen({ name: "painel" });
              notify("Vínculo feito. O idoso já vê seu nome na tela dele.");
            }}
          />
        ) : !view ? (
          <div className="center-screen">
            {loadError ? (
              <>
                <p className="form-alert">{loadError}</p>
                <button type="button" className="btn primary" onClick={reload}>
                  Tentar de novo
                </button>
              </>
            ) : (
              <p className="loading-text">Carregando…</p>
            )}
          </div>
        ) : (
          <>
            {loadError ? <p className="offline-bar">Sem internet: mostrando os últimos dados.</p> : null}
            {screen.name === "painel" && <Dashboard onPickElder={setElderId} />}
            {screen.name === "prescricoes" && <Prescriptions />}
            {screen.name === "prescricao" && <PrescriptionForm medId={screen.medId} />}
            {screen.name === "etiquetas" && <Labels />}
            {screen.name === "etiqueta" && <Associate medId={screen.medId} done={screen.done} />}
            {screen.name === "imprimir" && <PrintLabels />}
            {screen.name === "adesao" && <Adherence />}
            {screen.name === "estoque" && <Stock />}
          </>
        )}
        {toast ? (
          <div className={`toast ${toast.kind}`} role="status">
            {toast.kind === "ok" ? <Check size={18} /> : <AlertTriangle size={18} />} {toast.msg}
          </div>
        ) : null}
      </div>
    </FamilyCtx.Provider>
  );
}

function Top({ title, back = true }: { title: string; back?: boolean }) {
  const { go, logout } = useFam();
  return (
    <header className="fam-top no-print">
      {back ? (
        <button type="button" className="icon-btn" aria-label="Voltar ao painel" onClick={() => go({ name: "painel" })}>
          <ArrowLeft size={22} />
        </button>
      ) : (
        <span className="fam-logo">
          <Tag size={18} />
        </span>
      )}
      <h1>{title}</h1>
      <nav className="fam-ubiq">
        {back ? (
          <button type="button" className="icon-btn" aria-label="Ir ao painel" title="Painel" onClick={() => go({ name: "painel" })}>
            <House size={20} />
          </button>
        ) : null}
        <button
          type="button"
          className="icon-btn"
          aria-label="Sair"
          title="Sair"
          onClick={() => {
            if (window.confirm("Sair da sua conta neste aparelho?")) logout();
          }}
        >
          <LogOut size={20} />
        </button>
      </nav>
    </header>
  );
}

/* ------------------------------------------------------------------ */
/* Vínculo                                                             */
/* ------------------------------------------------------------------ */

function LinkElder({ first, onLinked }: { first: boolean; onLinked: (elderId: string) => void }) {
  const { me, go, logout } = useFam();
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"code" | "confirm">("code");
  const [status, setStatus] = useState<{ status: "new" | "existing" | "already"; elderName?: string } | null>(null);
  const [elderName, setElderName] = useState("");
  const [relation, setRelation] = useState("filho(a)");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function check(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await api<{ status: "new" | "existing" | "already"; elderName?: string }>("/link/check", { method: "POST", body: { code } });
      if (r.status === "already") setError(`Você já acompanha ${r.elderName}.`);
      else {
        setStatus(r);
        setStep("confirm");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tente de novo.");
    } finally {
      setBusy(false);
    }
  }

  async function confirm(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await api<{ elderId: string }>("/link", { method: "POST", body: { code, relation, elderName } });
      onLinked(r.elderId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tente de novo.");
      if (err instanceof ApiError && err.code === "bad_code") setStep("code");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <header className="fam-top">
        {first ? (
          <span className="fam-logo">
            <Tag size={18} />
          </span>
        ) : (
          <button type="button" className="icon-btn" aria-label="Voltar" onClick={() => (step === "confirm" ? setStep("code") : go({ name: "painel" }))}>
            <ArrowLeft size={22} />
          </button>
        )}
        <h1>Vincular ao celular do idoso</h1>
        <nav className="fam-ubiq">
          <button type="button" className="icon-btn" aria-label="Sair" onClick={logout}>
            <LogOut size={20} />
          </button>
        </nav>
      </header>
      <main className="fam-main">
        {step === "code" ? (
          <form className="fam-form" onSubmit={check}>
            {first ? <p className="fam-lead">Olá, {me.user.name.split(" ")[0]}! Agora vamos ligar sua conta ao celular do idoso.</p> : null}
            <div className="tip">
              <Smartphone size={22} />
              <p>
                No celular do idoso, abra o MyHealthRoutine e toque em <strong>“Este é o celular do idoso”</strong>. Se ele já usa o aplicativo, toque em{" "}
                <strong>Opções → Vincular outro familiar</strong>. Vai aparecer um código de 6 números.
              </p>
            </div>
            <label className="field">
              <span>Código que aparece no celular do idoso</span>
              <input
                inputMode="numeric"
                maxLength={7}
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                  setError("");
                }}
                className="code-input"
                placeholder="000000"
                aria-invalid={Boolean(error)}
              />
              {error ? <em className="field-error">{error}</em> : null}
            </label>
            <button type="submit" className="btn primary wide" disabled={code.length !== 6 || busy}>
              {busy ? "Conferindo…" : "Continuar"}
            </button>
          </form>
        ) : (
          <form className="fam-form" onSubmit={confirm}>
            {status?.status === "new" ? (
              <label className="field">
                <span>Nome do idoso</span>
                <input value={elderName} onChange={(e) => setElderName(e.target.value)} placeholder="Ex.: Aloísio Mendes" />
                <small className="hint">É como o aplicativo vai chamar o idoso.</small>
              </label>
            ) : (
              <p className="fam-lead">
                Este celular é de <strong>{status?.elderName}</strong>.
              </p>
            )}
            <label className="field">
              <span>Sua relação com o idoso</span>
              <select value={relation} onChange={(e) => setRelation(e.target.value)}>
                <option>filho(a)</option>
                <option>neto(a)</option>
                <option>cônjuge</option>
                <option>cuidador(a) formal</option>
                <option>outro</option>
              </select>
            </label>
            <div className="link-preview">
              <span className="avatar">{me.user.name.charAt(0)}</span>
              <Link2 size={18} />
              <span className="avatar avatar-idoso">{(status?.elderName || elderName || "?").charAt(0)}</span>
              <p>
                <strong>{me.user.name}</strong> ({relation}) vai acompanhar os remédios de <strong>{status?.elderName || elderName || "…"}</strong>. Seu nome
                aparece na tela inicial do idoso.
              </p>
            </div>
            {error ? (
              <p className="form-alert" role="alert">
                <AlertTriangle size={18} /> {error}
              </p>
            ) : null}
            <button type="submit" className="btn primary wide" disabled={busy}>
              <Link2 size={18} /> {busy ? "Vinculando…" : "Confirmar vínculo"}
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

const STATUS_TEXT = { tomado: "Tomado", agora: "Pendente", tolerancia: "Em tolerância", "nao-confirmada": "Não confirmada", "mais-tarde": "Mais tarde" };

function timeOf(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function Dashboard({ onPickElder }: { onPickElder: (id: string) => void }) {
  const { me, view, go, elderId, reload, notify } = useFam();
  if (!view) return null;
  const medById = new Map(view.meds.map((m) => [m.id, m]));
  const low = view.meds.filter((m) => daysLeft(m) <= 7);
  const notToday = view.meds.filter((m) => !view.today.some((d) => d.medId === m.id));
  const noLabel = view.meds.filter((m) => !m.label);
  const counts = {
    ok: view.today.filter((d) => d.status === "tomado").length,
    pend: view.today.filter((d) => d.status === "agora" || d.status === "tolerancia").length,
    bad: view.today.filter((d) => d.status === "nao-confirmada").length,
  };
  // Lido da lista atual de contatos (que é recarregada), e não do login.
  const myLink = view.contacts.find((c) => c.userId === me.user.id);
  const trustedContact = view.contacts.find((c) => c.trusted);

  return (
    <>
      <Top title={`Olá, ${me.user.name.split(" ")[0]}`} back={false} />
      <main className="fam-main">
        {me.elders.length > 1 ? (
          <label className="field">
            <span>Acompanhando</span>
            <select value={elderId} onChange={(e) => onPickElder(e.target.value)}>
              {me.elders.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <PushCard as="user" />

        <section className="fam-card">
          <p className="fam-card-title">
            Hoje de {view.elder.name.split(" ")[0]} · <span className="muted">{fmtMin(view.now.min)}</span>
          </p>
          <div className="counts">
            <span className="count ok">
              <b>{counts.ok}</b> confirmadas
            </span>
            <span className="count pend">
              <b>{counts.pend}</b> pendentes
            </span>
            <span className="count bad">
              <b>{counts.bad}</b> não confirmadas
            </span>
          </div>
          {view.today.length ? (
            <ul className="fam-doses">
              {view.today.map((d) => {
                const m = medById.get(d.medId);
                return (
                  <li key={d.medId}>
                    <LabelTag marcoId={d.marco} size="sm" showNumber={false} />
                    <span className="fam-dose-text">
                      <strong>
                        {m?.name} {m?.dosage}
                      </strong>
                      <small>
                        {marco(d.marco).label} · {d.time}
                      </small>
                    </span>
                    <span className={`status-pill sm ${d.status}`}>{d.status === "tomado" ? `✓ ${fmtMin(d.confirmedMin ?? 0)}` : STATUS_TEXT[d.status]}</span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="muted small">{view.meds.length ? "Nenhuma dose para hoje." : "Nenhum remédio cadastrado. Comece por “Prescrições”."}</p>
          )}
          {notToday.length ? (
            <p className="not-today">
              {notToday.map((m) => `${m.name} ${m.dosage} (${marco(m.marco).label}, ${m.time})`).join("; ")}: sem dose hoje
              {notToday.some((m) => m.createdDate === view.now.date) ? ", começa no próximo horário." : "."}
            </p>
          ) : null}
        </section>

        {low.length || noLabel.length || view.notices.length ? (
          <section className="fam-card alerts">
            <p className="fam-card-title">
              <Bell size={16} /> Alertas
            </p>
            {low.map((m) => (
              <button key={m.id} type="button" className="alert-row warn" onClick={() => go({ name: "estoque" })}>
                <Package size={18} />
                <span>
                  <strong>Estoque baixo:</strong> restam {m.stock} comprimidos de {m.name} {m.dosage}
                </span>
                <ChevronRight size={16} />
              </button>
            ))}
            {noLabel.map((m) => (
              <button key={m.id} type="button" className="alert-row info" onClick={() => go({ name: "etiqueta", medId: m.id })}>
                <Tag size={18} />
                <span>
                  <strong>Sem etiqueta:</strong> {m.name} ainda não tem etiqueta na caixa
                </span>
                <ChevronRight size={16} />
              </button>
            ))}
            {view.notices.slice(0, 5).map((n) => (
              <div key={n.id} className={`alert-row ${n.kind === "aviso" || n.kind === "ajuda" ? "bad" : "info"}`}>
                <Bell size={18} />
                <span>
                  <small>{timeOf(n.createdAt)}</small> {n.text}
                  {!n.delivered ? <em> (aviso não chegou a nenhum celular)</em> : null}
                </span>
              </div>
            ))}
          </section>
        ) : null}

        <p className="fam-label">Próximo passo</p>
        <div className="action-grid">
          <button type="button" onClick={() => go({ name: "prescricoes" })}>
            <ClipboardList /> <span>Prescrições</span>
            <small>cadastrar ou editar</small>
          </button>
          <button type="button" onClick={() => go({ name: "etiquetas" })}>
            <Tag /> <span>Etiquetas</span>
            <small>imprimir e associar</small>
          </button>
          <button type="button" onClick={() => go({ name: "adesao" })}>
            <BarChart3 /> <span>Adesão</span>
            <small>pontualidade e relatório</small>
          </button>
          <button type="button" onClick={() => go({ name: "estoque" })}>
            <Package /> <span>Estoque</span>
            <small>avisar reposição</small>
          </button>
        </div>

        <section className="fam-card">
          <p className="fam-card-title">
            <ShieldCheck size={16} /> Quem acompanha
          </p>
          <p className="small">
            {view.contacts.map((c) => `${c.name} (${c.relation})${c.trusted ? " — recebe os avisos de dose não confirmada" : ""}`).join("; ")}
          </p>
          {myLink && !myLink.trusted ? (
            <button
              type="button"
              className="btn ghost wide"
              onClick={async () => {
                try {
                  await api(`/elders/${elderId}/trusted`, { method: "POST" });
                  notify("Agora você é o contato de confiança.");
                  reload();
                } catch (e) {
                  notify(e instanceof Error ? e.message : "Tente de novo.", "error");
                }
              }}
            >
              Ser o contato de confiança {trustedContact ? `(no lugar de ${trustedContact.name.split(" ")[0]})` : ""}
            </button>
          ) : null}
          <button type="button" className="btn ghost wide" onClick={() => go({ name: "vincular" })}>
            <Link2 size={16} /> Acompanhar outro idoso
          </button>
        </section>

        <PushCard as="user" when="on" />
      </main>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Prescrições                                                         */
/* ------------------------------------------------------------------ */

function Prescriptions() {
  const { view, go } = useFam();
  if (!view) return null;
  return (
    <>
      <Top title="Prescrições" />
      <main className="fam-main">
        <button type="button" className="btn primary wide" onClick={() => go({ name: "prescricao", medId: null })}>
          <Plus size={18} /> Nova prescrição
        </button>
        {view.meds.length ? <p className="fam-label">Já cadastradas · toque para editar</p> : null}
        <ul className="med-list">
          {view.meds.map((m) => (
            <li key={m.id}>
              <button type="button" onClick={() => go({ name: "prescricao", medId: m.id })}>
                <LabelTag marcoId={m.marco} size="sm" showNumber={false} />
                <span>
                  <strong>
                    {m.name} {m.dosage}
                  </strong>
                  <small>
                    {m.amount} · {marco(m.marco).label} · {m.time} · {m.days.length === 7 ? "todos os dias" : m.days.map((d) => WEEKDAYS[d].label.slice(0, 3)).join(", ")}
                  </small>
                </span>
                <Pencil size={16} />
              </button>
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}

type FormData = { name: string; dosage: string; amount: string; marco: MarcoId | ""; time: string; days: number[]; stock: string; lot: string };

function PrescriptionForm({ medId }: { medId: string | null }) {
  const { view, elderId, go, notify, reload } = useFam();
  const existing = medId ? view?.meds.find((m) => m.id === medId) : null;
  const [form, setForm] = useState<FormData>(
    existing
      ? { name: existing.name, dosage: existing.dosage, amount: existing.amount, marco: existing.marco, time: existing.time, days: existing.days, stock: String(existing.stock), lot: existing.lot === "—" ? "" : existing.lot }
      : { name: "", dosage: "", amount: "1 comprimido", marco: "", time: "", days: [0, 1, 2, 3, 4, 5, 6], stock: "", lot: "" },
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const set = <K extends keyof FormData>(k: K, v: FormData[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: "" }));
  };

  function pickMarco(id: MarcoId) {
    setForm((f) => ({ ...f, marco: id, time: f.time && f.marco === id ? f.time : marco(id).defaultTime }));
    setErrors((e) => ({ ...e, marco: "", time: "" }));
  }

  async function save(ev: FormEvent) {
    ev.preventDefault();
    setBusy(true);
    setError("");
    try {
      const payload = { ...form, stock: Number(form.stock || "-1") };
      if (existing) {
        const r = await api<{ labelRemoved: boolean }>(`/elders/${elderId}/meds/${existing.id}`, { method: "PUT", body: payload });
        await reload();
        if (r.labelRemoved) {
          notify("Prescrição salva. O marco mudou: troque a etiqueta da caixa.");
          go({ name: "etiqueta", medId: existing.id });
        } else {
          notify("Prescrição atualizada.");
          go({ name: "prescricoes" });
        }
      } else {
        const r = await api<{ id: string }>(`/elders/${elderId}/meds`, { method: "POST", body: payload });
        await reload();
        notify("Prescrição salva. Agora cole a etiqueta na caixa.");
        go({ name: "etiqueta", medId: r.id });
      }
    } catch (e) {
      if (e instanceof ApiError) {
        setErrors(e.fields);
        setError(e.message);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!existing || !window.confirm(`Remover ${existing.name} da rotina? O histórico continua guardado.`)) return;
    try {
      await api(`/elders/${elderId}/meds/${existing.id}`, { method: "DELETE" });
      await reload();
      notify("Prescrição removida.");
      go({ name: "prescricoes" });
    } catch (e) {
      notify(e instanceof Error ? e.message : "Tente de novo.", "error");
    }
  }

  const errorCount = Object.values(errors).filter(Boolean).length;

  return (
    <>
      <Top title={existing ? "Editar prescrição" : "Nova prescrição"} />
      <main className="fam-main">
        <form className="fam-form" onSubmit={save} noValidate>
          {error ? (
            <p className="form-alert" role="alert">
              <AlertTriangle size={18} /> {errorCount ? `Confira ${errorCount === 1 ? "o campo marcado" : `os ${errorCount} campos marcados`}.` : error}
            </p>
          ) : null}
          <label className="field">
            <span>Medicamento</span>
            <input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Ex.: Losartana" aria-invalid={Boolean(errors.name)} />
            {errors.name ? <em className="field-error">{errors.name}</em> : null}
          </label>
          <div className="field-row">
            <label className="field">
              <span>Dosagem</span>
              <input value={form.dosage} onChange={(e) => set("dosage", e.target.value)} placeholder="Ex.: 50 mg" aria-invalid={Boolean(errors.dosage)} />
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
            <small className="hint">O idoso reconhece o remédio pelo momento do dia, pela cor e pelo ícone da etiqueta.</small>
            <div className="marco-grid" role="radiogroup" aria-invalid={Boolean(errors.marco)}>
              {MARCOS.map((mc) => (
                <button key={mc.id} type="button" role="radio" aria-checked={form.marco === mc.id} className={`marco-opt ${form.marco === mc.id ? "on" : ""}`} onClick={() => pickMarco(mc.id)}>
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
                  onClick={() => set("days", form.days.includes(d.value) ? form.days.filter((x) => x !== d.value) : [...form.days, d.value])}
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
              <span>{existing ? "Comprimidos em casa" : "Comprimidos na caixa"}</span>
              <input inputMode="numeric" value={form.stock} onChange={(e) => set("stock", e.target.value.replace(/\D/g, ""))} placeholder="Ex.: 30" aria-invalid={Boolean(errors.stock)} />
              {errors.stock ? <em className="field-error">{errors.stock}</em> : null}
            </label>
            <label className="field">
              <span>Lote (opcional)</span>
              <input value={form.lot} onChange={(e) => set("lot", e.target.value.toUpperCase())} placeholder="Ex.: LS2291" />
            </label>
          </div>
          <button type="submit" className="btn primary wide" disabled={busy}>
            <Check size={18} /> {busy ? "Salvando…" : "Salvar prescrição"}
          </button>
          {existing ? (
            <button type="button" className="btn ghost wide danger" onClick={remove}>
              <Trash2 size={16} /> Remover da rotina
            </button>
          ) : null}
        </form>
      </main>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Etiquetas                                                           */
/* ------------------------------------------------------------------ */

function Labels() {
  const { view, go } = useFam();
  if (!view) return null;
  return (
    <>
      <Top title="Etiquetas" />
      <main className="fam-main">
        <div className="tip">
          <Printer size={22} />
          <p>
            Primeiro, imprima as etiquetas coloridas com código (QR). Depois, cole uma em cada caixa e leia o código com a câmera para ligar a etiqueta ao remédio.
          </p>
        </div>
        <button type="button" className="btn ghost wide" onClick={() => go({ name: "imprimir" })}>
          <Printer size={18} /> Imprimir etiquetas
        </button>
        <p className="fam-label">Escolha o medicamento</p>
        <ul className="med-list">
          {view.meds.map((m) => {
            const mc = marco(m.marco);
            return (
              <li key={m.id}>
                <button type="button" onClick={() => go({ name: "etiqueta", medId: m.id })}>
                  <LabelTag marcoId={m.marco} size="sm" showNumber={false} />
                  <span>
                    <strong>
                      {m.name} {m.dosage}
                    </strong>
                    <small className={m.label ? "" : "warn-text"}>
                      {m.label ? `etiqueta ${mc.colorName} nº ${m.label.n} colada` : `sem etiqueta — colar uma ${mc.colorName}`}
                    </small>
                  </span>
                  <ChevronRight size={16} />
                </button>
              </li>
            );
          })}
        </ul>
        {!view.meds.length ? <p className="muted small">Cadastre uma prescrição primeiro.</p> : null}
      </main>
    </>
  );
}

function Associate({ medId, done }: { medId: string; done?: boolean }) {
  const { view, elderId, go, reload, notify } = useFam();
  const [camera, setCamera] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const med = view?.meds.find((m) => m.id === medId);
  if (!view || !med) return <Labels />;
  const mc = marco(med.marco);

  async function read(code: string) {
    if (busy || error) return;
    setBusy(true);
    try {
      await api(`/elders/${elderId}/meds/${med!.id}/label`, { method: "POST", body: { code } });
      await reload();
      notify("Etiqueta associada.");
      go({ name: "etiqueta", medId: med!.id, done: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Tente de novo.");
    } finally {
      setBusy(false);
    }
  }

  if (done && med.label) {
    return (
      <>
        <Top title="Etiqueta associada" />
        <main className="fam-main center">
          <span className="done-check">
            <Check size={40} strokeWidth={3} />
          </span>
          <LabelTag marcoId={med.marco} size="xl" showNumber={false} />
          <p className="fam-lead">
            <strong>
              {med.name} {med.dosage}
            </strong>{" "}
            agora tem a etiqueta <strong>{mc.colorName}</strong> nº {med.label.n} ({mc.label}, {med.time}).
          </p>
          <div className="tip">
            <Smartphone size={20} />
            <p>
              Façam juntos uma leitura de teste: no celular do idoso, toque em <strong>Opções → Testar uma etiqueta</strong> e aproxime a câmera da caixa. Nada é registrado.
            </p>
          </div>
          <button type="button" className="btn primary wide" onClick={() => go({ name: "etiquetas" })}>
            Associar outra etiqueta
          </button>
          <button type="button" className="btn ghost wide" onClick={() => go({ name: "painel" })}>
            Voltar ao painel
          </button>
        </main>
      </>
    );
  }

  return (
    <>
      <Top title={med.label ? "Trocar etiqueta" : "Associar etiqueta"} />
      <main className="fam-main">
        <label className="field">
          <span>Medicamento que receberá a etiqueta</span>
          <select
            value={med.id}
            onChange={(e) => {
              setCamera(false);
              setError("");
              go({ name: "etiqueta", medId: e.target.value });
            }}
          >
            {view.meds.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} {m.dosage} — {marco(m.marco).label}
              </option>
            ))}
          </select>
        </label>
        <section className="fam-card indicate">
          <p className="step-n">1. Cole uma etiqueta nesta caixa</p>
          <div className="indicate-row">
            <LabelTag marcoId={med.marco} size="xl" showNumber={false} />
            <p>
              Pegue uma etiqueta <strong>{mc.colorName}</strong> com <strong>{mc.iconName}</strong> das etiquetas impressas e cole na lateral da caixa de{" "}
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
        <section className="fam-card">
          <p className="step-n">2. Leia o código da etiqueta com a câmera</p>
          {camera ? (
            <>
              <QrScanner
                onCode={read}
                paused={busy || Boolean(error)}
                hint={
                  busy ? (
                    <p className="camera-hint small">Lendo o código…</p>
                  ) : error ? (
                    <div className="scan-error small" role="alert">
                      <AlertTriangle size={26} />
                      <p>{error}</p>
                    </div>
                  ) : (
                    <p className="camera-hint small">Aponte para o código da etiqueta</p>
                  )
                }
              />
              {error ? (
                <button type="button" className="btn primary wide" onClick={() => setError("")}>
                  Tentar de novo
                </button>
              ) : null}
            </>
          ) : (
            <button type="button" className="btn primary wide" onClick={() => setCamera(true)}>
              <ScanLine size={18} /> Abrir a câmera
            </button>
          )}
        </section>
      </main>
    </>
  );
}

function PrintLabels() {
  const { view, elderId } = useFam();
  const [labels, setLabels] = useState<LabelRow[] | null>(null);
  const [qr, setQr] = useState<Record<string, string>>({});
  const [error, setError] = useState("");

  useEffect(() => {
    api<LabelRow[]>(`/elders/${elderId}/labels`)
      .then(async (rows) => {
        setLabels(rows);
        const entries = await Promise.all(rows.map(async (l) => [l.code, await QRCode.toDataURL(`MHR:${l.code}`, { margin: 1, width: 240 })] as const));
        setQr(Object.fromEntries(entries));
      })
      .catch((e) => setError(e.message));
  }, [elderId]);

  const free = labels?.filter((l) => !l.medId) ?? [];

  return (
    <>
      <Top title="Imprimir etiquetas" />
      <main className="fam-main">
        <div className="no-print">
          <p className="fam-lead">
            Etiquetas livres de {view?.elder.name}: duas de cada cor. Imprima em papel adesivo (ou papel comum e fita), recorte e cole na lateral das caixas.
          </p>
          <button type="button" className="btn primary wide" onClick={() => window.print()} disabled={!free.length}>
            <Printer size={18} /> Imprimir
          </button>
        </div>
        {error ? <p className="form-alert">{error}</p> : null}
        {!labels ? <p className="loading-text">Preparando etiquetas…</p> : null}
        <div className="print-sheet">
          {free.map((l) => {
            const mc = marco(l.marco);
            const Icon = mc.icon;
            return (
              <div key={l.code} className="print-label" style={{ background: mc.color, color: mc.ink }}>
                <Icon className="print-icon" strokeWidth={2.4} />
                {qr[l.code] ? <img src={qr[l.code]} alt={`Código ${l.code}`} /> : <span className="qr-placeholder" />}
                <span className="print-text">
                  {mc.label} · nº {l.n}
                  <br />
                  <b>{l.code}</b>
                </span>
              </div>
            );
          })}
        </div>
      </main>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Adesão                                                              */
/* ------------------------------------------------------------------ */

function addDays(date: string, n: number) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function weekdayOf(date: string) {
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}
function takesOn(m: Med, date: string) {
  if (!m.days.includes(weekdayOf(date))) return false;
  if (m.createdDate > date) return false;
  const [h, mi] = m.time.split(":").map(Number);
  if (m.createdDate === date && h * 60 + mi <= m.createdMin) return false;
  return true;
}
function dayLabel(date: string) {
  return new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`)).replace(".", "");
}

function Adherence() {
  const { elderId, view, notify } = useFam();
  const [period, setPeriod] = useState<7 | 30>(7);
  const [hist, setHist] = useState<History | null>(null);
  const [error, setError] = useState("");
  const [report, setReport] = useState<string | null>(null);

  const load = useCallback(() => {
    setHist(null);
    setError("");
    api<History>(`/elders/${elderId}/history?days=${period}`)
      .then(setHist)
      .catch((e) => setError(e.message));
  }, [elderId, period]);
  useEffect(load, [load]);

  if (!view) return null;

  const rows: { date: string; cells: { med: Med; delay: number | null; at: number | null; expected: boolean }[] }[] = [];
  let onTime = 0;
  let late = 0;
  let missed = 0;
  if (hist) {
    const byKey = new Map(hist.doses.map((d) => [`${d.medId}|${d.date}`, d]));
    for (let i = 1; i <= hist.days; i++) {
      const date = addDays(hist.now.date, -i);
      const cells = hist.meds.map((m) => {
        if (!takesOn(m, date)) return { med: m, delay: null, at: null, expected: false };
        const d = byKey.get(`${m.id}|${date}`);
        if (d?.confirmedMin == null) {
          missed++;
          return { med: m, delay: null, at: null, expected: true };
        }
        const delay = d.confirmedMin - d.scheduledMin;
        if (delay < 20) onTime++;
        else late++;
        return { med: m, delay, at: d.confirmedMin, expected: true };
      });
      rows.push({ date, cells });
    }
  }
  const total = onTime + late + missed;
  const pct = total ? Math.round((onTime / total) * 100) : 0;
  const range = hist ? `${dayLabel(addDays(hist.now.date, -hist.days))} a ${dayLabel(addDays(hist.now.date, -1))}` : "";

  function generate() {
    if (!hist) return;
    const lines = [
      `Relatório de adesão — ${view!.elder.name}`,
      `Período: últimos ${hist.days} dias (${range})`,
      total ? `Pontualidade: ${pct}% (${onTime} de ${total} doses confirmadas em até 20 min)` : "Ainda não há doses no período.",
      `Com atraso: ${late} · Não confirmadas: ${missed}`,
      "",
      ...hist.meds.map((m) => {
        const cells = rows.map((r) => r.cells.find((c) => c.med.id === m.id)!).filter((c) => c.expected);
        const ok = cells.filter((c) => c.delay !== null && c.delay < 20).length;
        return `• ${m.name} ${m.dosage} (${marco(m.marco).label}, ${m.time}): ${ok}/${cells.length} no horário`;
      }),
    ];
    setReport(lines.join("\n"));
  }

  async function share() {
    if (!report) return;
    try {
      if (navigator.share) await navigator.share({ title: "Relatório de adesão", text: report });
      else {
        await navigator.clipboard.writeText(report);
        notify("Relatório copiado. Cole na mensagem para o médico.");
      }
    } catch {
      /* cancelado */
    }
  }

  return (
    <>
      <Top title="Adesão ao tratamento" />
      <main className="fam-main">
        <div className="segmented" role="radiogroup" aria-label="Período">
          {([7, 30] as const).map((p) => (
            <button key={p} type="button" role="radio" aria-checked={period === p} className={period === p ? "on" : ""} onClick={() => setPeriod(p)}>
              Últimos {p} dias
            </button>
          ))}
        </div>
        {error ? (
          <>
            <p className="form-alert" role="alert">
              <AlertTriangle size={18} /> {error}
            </p>
            <button type="button" className="btn primary wide" onClick={load}>
              Tentar de novo
            </button>
          </>
        ) : !hist ? (
          <p className="loading-text">Calculando…</p>
        ) : (
          <>
            <section className="fam-card adh-summary">
              <div className="ring" style={{ ["--p" as string]: `${pct}` }}>
                <b>{total ? `${pct}%` : "–"}</b>
              </div>
              <div>
                <p className="fam-card-title">Pontualidade</p>
                <p className="muted small">{range} · dose confirmada pela leitura da etiqueta em até 20 min</p>
                <p className="adh-counts">
                  <span className="ok">✓ {onTime} no horário</span>
                  <span className="late">⏱ {late} com atraso</span>
                  <span className="miss">✗ {missed} não confirmadas</span>
                </p>
              </div>
            </section>
            {hist.meds.length ? (
              <section className="fam-card">
                <p className="fam-card-title">Histórico de confirmações</p>
                <div className="hist" style={{ ["--cols" as string]: hist.meds.length }}>
                  <div className="hist-row head">
                    <span>Dia</span>
                    {hist.meds.map((m) => (
                      <span key={m.id} title={m.name}>
                        <LabelTag marcoId={m.marco} size="sm" showNumber={false} />
                      </span>
                    ))}
                  </div>
                  {rows.map((r) => (
                    <div className="hist-row" key={r.date}>
                      <span className="hist-day">{dayLabel(r.date)}</span>
                      {r.cells.map((c) =>
                        !c.expected ? (
                          <span key={c.med.id} className="cell none">
                            –
                          </span>
                        ) : c.delay === null ? (
                          <span key={c.med.id} className="cell miss" title="Não confirmada">
                            ✗
                          </span>
                        ) : (
                          <span key={c.med.id} className={`cell ${c.delay < 20 ? "ok" : "late"}`} title={`Confirmada às ${fmtMin(c.at!)}`}>
                            {c.delay < 20 ? "✓" : "⏱"} <small>{fmtMin(c.at!)}</small>
                          </span>
                        ),
                      )}
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
            <button type="button" className="btn primary wide" onClick={generate}>
              <BarChart3 size={18} /> Gerar relatório
            </button>
          </>
        )}
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
  const { view, elderId, me, reload, notify } = useFam();
  const [open, setOpen] = useState<{ medId: string; kind: "aviso" | "compra" } | null>(null);
  const [qty, setQty] = useState("30");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!view) return null;
  const others = view.contacts.filter((c) => c.userId !== me.user.id).map((c) => c.name.split(" ")[0]);

  async function sendNotice(m: Med) {
    setBusy(true);
    setError("");
    try {
      await api(`/elders/${elderId}/meds/${m.id}/restock-notice`, { method: "POST" });
      setOpen(null);
      notify(others.length ? "Aviso enviado à família, com lote e dosagem." : "Aviso registrado. Ninguém mais acompanha este idoso ainda.");
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Tente de novo.");
    } finally {
      setBusy(false);
    }
  }

  async function addStock(m: Med) {
    setBusy(true);
    setError("");
    try {
      await api(`/elders/${elderId}/meds/${m.id}/stock`, { method: "POST", body: { add: Number(qty) } });
      setOpen(null);
      notify(`Estoque de ${m.name} atualizado.`);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Tente de novo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Top title="Estoque" />
      <main className="fam-main">
        <p className="fam-lead small">A contagem começa no cadastro e diminui a cada leitura da etiqueta.</p>
        <ul className="stock-list">
          {[...view.meds]
            .sort((a, b) => daysLeft(a) - daysLeft(b))
            .map((m) => {
              const left = daysLeft(m);
              const low = left <= 7;
              const isOpen = open?.medId === m.id;
              return (
                <li key={m.id} className={low ? "low" : ""}>
                  <div className="stock-head">
                    <LabelTag marcoId={m.marco} size="sm" showNumber={false} />
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
                  {isOpen && open.kind === "aviso" ? (
                    <div className="composer">
                      <p className="muted small">Mensagem para a família {others.length ? `(${others.join(", ")})` : ""}:</p>
                      <p className="composer-msg">
                        Repor {m.name} {m.dosage} (lote {m.lot}). Restam {m.stock} comprimidos, o que dá para cerca de {left} dia{left === 1 ? "" : "s"}.
                      </p>
                      {error ? <em className="field-error">{error}</em> : null}
                      <div className="composer-actions">
                        <button type="button" className="btn ghost" onClick={() => setOpen(null)}>
                          Cancelar
                        </button>
                        <button type="button" className="btn primary" onClick={() => sendNotice(m)} disabled={busy}>
                          <Send size={16} /> {busy ? "Enviando…" : error ? "Tentar de novo" : "Enviar aviso"}
                        </button>
                      </div>
                    </div>
                  ) : isOpen && open.kind === "compra" ? (
                    <div className="composer">
                      <label className="field">
                        <span>Quantos comprimidos chegaram?</span>
                        <input inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value.replace(/\D/g, ""))} />
                      </label>
                      {error ? <em className="field-error">{error}</em> : null}
                      <div className="composer-actions">
                        <button type="button" className="btn ghost" onClick={() => setOpen(null)}>
                          Cancelar
                        </button>
                        <button type="button" className="btn primary" onClick={() => addStock(m)} disabled={busy || !qty}>
                          <Check size={16} /> {busy ? "Salvando…" : "Somar ao estoque"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="stock-actions">
                      <button type="button" className={`btn ${low ? "primary" : "ghost"}`} onClick={() => (setOpen({ medId: m.id, kind: "aviso" }), setError(""))}>
                        <Bell size={16} /> Avisar reposição
                      </button>
                      <button type="button" className="btn ghost" onClick={() => (setOpen({ medId: m.id, kind: "compra" }), setError(""), setQty("30"))}>
                        <PackagePlus size={16} /> Chegou caixa nova
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
        </ul>
      </main>
    </>
  );
}
