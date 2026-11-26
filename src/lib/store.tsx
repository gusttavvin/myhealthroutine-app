"use client";

import { createContext, useContext, useEffect, useReducer, useState, type Dispatch } from "react";
import {
  ELDER_NAME,
  TOLERANCE_1,
  TOLERANCE_2,
  fmt,
  initialState,
  marco,
  takesToday,
  toMinutes,
  trustedContact,
  uid,
  type Contact,
  type ElderScene,
  type FamilyScene,
  type Medication,
  type Mode,
  type Notice,
  type State,
} from "./model";

export type Action =
  | { type: "advance"; minutes: number }
  | { type: "nextDose" }
  | { type: "mode"; mode: Mode }
  | { type: "elder"; scene: ElderScene }
  | { type: "family"; scene: FamilyScene }
  | { type: "login"; contactId: string }
  | { type: "logout" }
  | { type: "link"; contact: Contact }
  | { type: "confirm"; medId: string }
  | { type: "ring"; medId: string }
  | { type: "help" }
  | { type: "saveMed"; med: Medication }
  | { type: "associate"; medId: string; code: string }
  | { type: "notice"; notice: Omit<Notice, "id" | "at"> }
  | { type: "consumeReadFail" }
  | { type: "testDone"; medId: string }
  | { type: "clearFlash" }
  | { type: "toggle"; key: "offline" | "nextReadFails" | "sound" }
  | { type: "reset" }
  | { type: "load"; state: State };

const STORAGE_KEY = "myhealthroutine-prototipo";

function addNotice(state: State, notice: Omit<Notice, "id" | "at">): Notice[] {
  return [{ ...notice, id: uid(), at: state.now }, ...state.notices].slice(0, 30);
}

/** Avança o relógio e dispara os eventos de tempo (aviso, reforço de 20 min, aviso ao contato de 40 min). */
function advanceTo(state: State, target: number): State {
  const from = state.now;
  const to = Math.min(target, 24 * 60 - 1);
  if (to <= from) return state;

  let next: State = { ...state, now: to };
  const contact = trustedContact(state);
  let strongest: { kind: "alarme" | "reforco" | "aviso"; medId: string; time: number } | null = null;
  const rank = { alarme: 1, reforco: 2, aviso: 3 };

  const due = state.meds
    .filter((m) => takesToday(m) && state.today[m.id] === undefined)
    .sort((a, b) => toMinutes(a.time) - toMinutes(b.time));

  for (const med of due) {
    const t = toMinutes(med.time);
    const crossed = (x: number) => x > from && x <= to;
    let kind: "alarme" | "reforco" | "aviso" | null = null;
    if (crossed(t)) kind = "alarme";
    if (crossed(t + TOLERANCE_1)) kind = "reforco";
    if (crossed(t + TOLERANCE_2)) {
      kind = "aviso";
      const mc = marco(med.marco);
      next = {
        ...next,
        notices: addNotice(next, {
          kind: "aviso",
          to: contact ? contact.name : "contato de confiança",
          text: `Aviso silencioso: o ${mc.dose} de ${ELDER_NAME} (${med.time}, caixa ${mc.colorName}) ainda não foi confirmado às ${fmt(t + TOLERANCE_2)}.`,
          delivered: !state.offline,
        }),
      };
    }
    if (kind && (!strongest || rank[kind] > rank[strongest.kind])) strongest = { kind, medId: med.id, time: t };
  }

  if (strongest) {
    const n = (state.event?.n ?? 0) + 1;
    next = { ...next, event: { n, kind: strongest.kind, medId: strongest.medId } };
    // Leitura de teste não é interrompida pelos avisos.
    const inTest = state.elder.name === "scan" && state.elder.test;
    if (!inTest) {
      if (strongest.kind === "alarme") {
        next.elder = { name: "home" };
        next.rung = [...next.rung, strongest.medId];
      } else if (strongest.kind === "reforco") {
        next.elder = { name: "reforco", medId: strongest.medId };
      } else {
        next.elder = { name: "aviso", medId: strongest.medId, delivered: !state.offline };
      }
    }
  }
  return next;
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "load":
      return action.state;
    case "reset":
      return initialState();
    case "advance":
      return advanceTo(state, state.now + action.minutes);
    case "nextDose": {
      const upcoming = state.meds
        .filter((m) => takesToday(m) && state.today[m.id] === undefined)
        .map((m) => toMinutes(m.time))
        .filter((t) => t > state.now)
        .sort((a, b) => a - b)[0];
      return upcoming === undefined ? state : advanceTo(state, upcoming);
    }
    case "mode":
      return { ...state, mode: action.mode };
    case "elder":
      return { ...state, elder: action.scene };
    case "family":
      return { ...state, family: action.scene };
    case "login":
      return { ...state, user: action.contactId, family: { name: "painel" } };
    case "logout":
      return { ...state, user: null, family: { name: "login" }, mode: "start" };
    case "link":
      return {
        ...state,
        contacts: [...state.contacts, action.contact],
        user: action.contact.id,
        family: { name: "painel" },
      };
    case "ring":
      return state.rung.includes(action.medId) ? state : { ...state, rung: [...state.rung, action.medId] };
    case "confirm": {
      return {
        ...state,
        today: { ...state.today, [action.medId]: state.now },
        meds: state.meds.map((m) => (m.id === action.medId ? { ...m, stock: Math.max(0, m.stock - 1) } : m)),
        elder: { name: "confirmed", medId: action.medId },
      };
    }
    case "help": {
      const contact = trustedContact(state);
      return {
        ...state,
        notices: addNotice(state, {
          kind: "ajuda",
          to: contact?.name ?? "contato de confiança",
          text: `${ELDER_NAME} pediu ajuda pelo aplicativo às ${fmt(state.now)}.`,
          delivered: true,
        }),
        elder: { name: "aviso", medId: null, delivered: true, byHelp: true },
      };
    }
    case "saveMed": {
      const exists = state.meds.some((m) => m.id === action.med.id);
      return {
        ...state,
        meds: exists
          ? state.meds.map((m) => (m.id === action.med.id ? action.med : m))
          : [...state.meds, action.med],
      };
    }
    case "associate":
      return {
        ...state,
        meds: state.meds.map((m) => (m.id === action.medId ? { ...m, label: action.code, labelTested: false } : m)),
      };
    case "testDone": {
      const med = state.meds.find((m) => m.id === action.medId);
      return {
        ...state,
        meds: state.meds.map((m) => (m.id === action.medId ? { ...m, labelTested: true } : m)),
        mode: "family",
        family: { name: "painel" },
        flash: med ? `Leitura de teste feita: a etiqueta da caixa de ${med.name} funciona.` : null,
      };
    }
    case "clearFlash":
      return { ...state, flash: null };
    case "notice":
      return { ...state, notices: addNotice(state, action.notice) };
    case "consumeReadFail":
      return { ...state, nextReadFails: false };
    case "toggle":
      return { ...state, [action.key]: !state[action.key] };
  }
}

type Store = { state: State; dispatch: Dispatch<Action>; ready: boolean };
const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as State;
        if (saved.version === initialState().version) dispatch({ type: "load", state: { ...saved, event: null } });
      }
    } catch {
      /* sem armazenamento: começa do zero */
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* ignora */
    }
  }, [state, ready]);

  return <StoreContext.Provider value={{ state, dispatch, ready }}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const store = useContext(StoreContext);
  if (!store) throw new Error("StoreProvider ausente");
  return store;
}
