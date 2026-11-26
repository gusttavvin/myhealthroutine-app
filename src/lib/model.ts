import {
  Bed,
  Coffee,
  Moon,
  Sun,
  Sunrise,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Marcos da rotina: cada marco tem cor e ícone próprios na etiqueta   */
/* ------------------------------------------------------------------ */

export type MarcoId = "amanhecer" | "cafe" | "almoco" | "cha" | "jantar" | "dormir";

export type Marco = {
  id: MarcoId;
  label: string; // "Manhã · Café"
  dose: string; // "remédio da manhã"
  colorName: string; // "amarela"
  iconName: string; // "sol"
  color: string;
  ink: string;
  icon: LucideIcon;
  defaultTime: string;
  range: [number, number]; // minutos do dia aceitos para o marco
};

export const MARCOS: Marco[] = [
  {
    id: "amanhecer",
    label: "Amanhecer · Jejum",
    dose: "remédio do amanhecer",
    colorName: "laranja",
    iconName: "nascer do sol",
    color: "#F28C28",
    ink: "#2b1600",
    icon: Sunrise,
    defaultTime: "06:30",
    range: [5 * 60, 8 * 60 - 1],
  },
  {
    id: "cafe",
    label: "Manhã · Café",
    dose: "remédio da manhã",
    colorName: "amarela",
    iconName: "sol",
    color: "#FFD23F",
    ink: "#2e2300",
    icon: Sun,
    defaultTime: "08:00",
    range: [6 * 60, 11 * 60 - 1],
  },
  {
    id: "almoco",
    label: "Almoço",
    dose: "remédio do almoço",
    colorName: "vermelha",
    iconName: "prato",
    color: "#C62828",
    ink: "#ffffff",
    icon: UtensilsCrossed,
    defaultTime: "12:00",
    range: [11 * 60, 15 * 60 - 1],
  },
  {
    id: "cha",
    label: "Tarde · Chá",
    dose: "remédio da tarde",
    colorName: "verde",
    iconName: "xícara",
    color: "#1E9E5A",
    ink: "#ffffff",
    icon: Coffee,
    defaultTime: "16:00",
    range: [15 * 60, 18 * 60 - 1],
  },
  {
    id: "jantar",
    label: "Noite · Jantar",
    dose: "remédio da noite",
    colorName: "azul-escura",
    iconName: "lua",
    color: "#1F3A93",
    ink: "#ffffff",
    icon: Moon,
    defaultTime: "20:00",
    range: [18 * 60, 22 * 60 - 1],
  },
  {
    id: "dormir",
    label: "Antes de dormir",
    dose: "remédio de antes de dormir",
    colorName: "roxa",
    iconName: "cama",
    color: "#7B4BC4",
    ink: "#ffffff",
    icon: Bed,
    defaultTime: "22:30",
    range: [21 * 60, 24 * 60 - 1],
  },
];

export function marco(id: MarcoId): Marco {
  return MARCOS.find((m) => m.id === id) ?? MARCOS[1];
}

/* ------------------------------------------------------------------ */
/* Tipos                                                               */
/* ------------------------------------------------------------------ */

export type Medication = {
  id: string;
  name: string;
  dosage: string; // "50 mg"
  amount: string; // "1 comprimido"
  marco: MarcoId;
  time: string; // "08:00"
  days: number[]; // 0 = domingo
  stock: number;
  lot: string;
  label: string | null; // código da etiqueta, ex. "cafe-1"
  labelTested?: boolean; // leitura de teste feita com o idoso
  createdAt?: number; // minuto do dia em que foi cadastrado hoje (remédio novo)
};

/** O remédio tem dose hoje? Remédio cadastrado hoje só conta a partir do próximo horário. */
export function takesToday(med: Medication) {
  if (!med.days.includes(TODAY_WEEKDAY)) return false;
  return med.createdAt === undefined || toMinutes(med.time) > med.createdAt;
}

export type Contact = {
  id: string;
  name: string;
  relation: string;
  trusted: boolean; // contato de confiança (recebe os avisos)
};

export type HistoryEntry = {
  day: number; // -1 = ontem, -2 = anteontem...
  medId: string;
  delay: number | null; // minutos de atraso; null = não confirmada
};

export type Notice = {
  id: string;
  at: number;
  to: string;
  text: string;
  delivered: boolean;
  kind: "aviso" | "ajuda" | "reposicao" | "relatorio";
  medId?: string;
};

export type ElderScene =
  | { name: "home" }
  | { name: "scan"; test?: string }
  | { name: "take"; medId: string }
  | { name: "confirmed"; medId: string; test?: boolean }
  | { name: "reforco"; medId: string }
  | { name: "aviso"; medId: string | null; delivered: boolean; byHelp?: boolean }
  | { name: "ajuda" };

export type FamilyScene =
  | { name: "login" }
  | { name: "senha"; contactId: string }
  | { name: "novo" }
  | { name: "vincular" }
  | { name: "painel" }
  | { name: "prescricoes" }
  | { name: "prescricao"; medId: string | null }
  | { name: "etiquetas" }
  | { name: "etiqueta"; medId: string; done?: boolean; saved?: boolean }
  | { name: "adesao" }
  | { name: "estoque" };

export type Mode = "start" | "elder" | "family";

export type SimEvent = { n: number; kind: "alarme" | "reforco" | "aviso"; medId: string };

export type State = {
  version: number;
  now: number; // minutos desde 00:00 do dia simulado
  meds: Medication[];
  today: Record<string, number>; // medId -> minuto em que foi confirmado
  rung: string[]; // doses que já tocaram o aviso inicial
  history: HistoryEntry[];
  contacts: Contact[];
  notices: Notice[];
  offline: boolean;
  nextReadFails: boolean;
  sound: boolean;
  mode: Mode;
  elder: ElderScene;
  family: FamilyScene;
  user: string | null; // contato logado no Modo Familiar
  event: SimEvent | null;
  flash: string | null; // mensagem a mostrar ao entrar no Modo Familiar
};

/* ------------------------------------------------------------------ */
/* Dia simulado: terça-feira, 17/11/2026                               */
/* ------------------------------------------------------------------ */

export const TODAY_WEEKDAY = 2; // terça
export const TODAY_LABEL = "terça-feira, 17 de novembro";
export const ELDER_NAME = "Aloísio";
export const ELDER_FULL = "Aloísio Mendes";
export const LINK_CODE = "4829";
export const DEMO_PIN = "1234";
export const TOLERANCE_1 = 20;
export const TOLERANCE_2 = 40;

export const WEEKDAYS = [
  { value: 0, short: "D", label: "Domingo" },
  { value: 1, short: "S", label: "Segunda" },
  { value: 2, short: "T", label: "Terça" },
  { value: 3, short: "Q", label: "Quarta" },
  { value: 4, short: "Q", label: "Quinta" },
  { value: 5, short: "S", label: "Sexta" },
  { value: 6, short: "S", label: "Sábado" },
] as const;

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

export function toMinutes(time: string) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function fmt(minutes: number) {
  const m = Math.max(0, Math.min(24 * 60 - 1, Math.round(minutes)));
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

function seedHistory(): HistoryEntry[] {
  // Padrão fixo (não aleatório) para que todos os avaliadores vejam os mesmos números.
  const late: Record<string, number> = { "-3|varfarina": 32, "-12|sinvastatina": 45, "-19|losartana": 28 };
  const missed = new Set(["-9|varfarina", "-23|sinvastatina"]);
  const out: HistoryEntry[] = [];
  for (let day = -29; day <= -1; day++) {
    for (const medId of ["losartana", "varfarina", "sinvastatina"]) {
      const key = `${day}|${medId}`;
      if (missed.has(key)) out.push({ day, medId, delay: null });
      else out.push({ day, medId, delay: late[key] ?? ((day * 7 + medId.length * 3) % 13) });
    }
  }
  return out;
}

export function initialState(): State {
  return {
    version: 4,
    now: 8 * 60,
    meds: [
      {
        id: "losartana",
        name: "Losartana",
        dosage: "50 mg",
        amount: "1 comprimido",
        marco: "cafe",
        time: "08:00",
        days: ALL_DAYS,
        stock: 22,
        lot: "LS2291",
        label: "cafe-1",
      },
      {
        id: "varfarina",
        name: "Varfarina (anticoagulante)",
        dosage: "5 mg",
        amount: "1 comprimido",
        marco: "cha",
        time: "16:00",
        days: ALL_DAYS,
        stock: 4,
        lot: "VF8834",
        label: "cha-1",
      },
      {
        id: "sinvastatina",
        name: "Sinvastatina",
        dosage: "20 mg",
        amount: "1 comprimido",
        marco: "jantar",
        time: "20:00",
        days: ALL_DAYS,
        stock: 18,
        lot: "SV1102",
        label: "jantar-1",
      },
    ],
    today: {},
    rung: [],
    history: seedHistory(),
    contacts: [
      { id: "beatriz", name: "Beatriz Mendes", relation: "filha", trusted: true },
      { id: "marcos", name: "Marcos Vinícius", relation: "técnico de enfermagem", trusted: false },
    ],
    notices: [],
    offline: false,
    nextReadFails: false,
    sound: true,
    mode: "start",
    elder: { name: "home" },
    family: { name: "login" },
    user: null,
    event: null,
    flash: null,
  };
}

/* ------------------------------------------------------------------ */
/* Doses do dia                                                        */
/* ------------------------------------------------------------------ */

export type DoseStatus = "tomado" | "agora" | "tolerancia" | "nao-confirmada" | "mais-tarde";

export type Dose = {
  med: Medication;
  marco: Marco;
  time: number;
  status: DoseStatus;
  confirmedAt: number | null;
};

export function todayDoses(state: State): Dose[] {
  return state.meds
    .filter(takesToday)
    .map((med) => {
      const time = toMinutes(med.time);
      const confirmedAt = state.today[med.id] ?? null;
      const diff = state.now - time;
      let status: DoseStatus;
      if (confirmedAt !== null) status = "tomado";
      else if (diff < 0) status = "mais-tarde";
      else if (diff < TOLERANCE_1) status = "agora";
      else if (diff < TOLERANCE_2) status = "tolerancia";
      else status = "nao-confirmada";
      return { med, marco: marco(med.marco), time, status, confirmedAt };
    })
    .sort((a, b) => a.time - b.time);
}

/** Dose do momento: a mais antiga do dia que já chegou na hora e ainda não foi confirmada. */
export function currentDose(state: State): Dose | null {
  return todayDoses(state).find((d) => d.status !== "tomado" && d.status !== "mais-tarde") ?? null;
}

export function nextDose(state: State): Dose | null {
  return todayDoses(state).find((d) => d.status === "mais-tarde") ?? null;
}

export function trustedContact(state: State): Contact | null {
  return state.contacts.find((c) => c.trusted) ?? state.contacts[0] ?? null;
}

export const STATUS_TEXT: Record<DoseStatus, string> = {
  tomado: "Tomado",
  agora: "Pendente",
  tolerancia: "Em tolerância",
  "nao-confirmada": "Não confirmada",
  "mais-tarde": "Mais tarde",
};

/* ------------------------------------------------------------------ */
/* Etiquetas                                                           */
/* ------------------------------------------------------------------ */

export type Label = { code: string; marco: MarcoId; n: number };

export function labelFromCode(code: string): Label {
  const [m, n] = code.split("-");
  return { code, marco: m as MarcoId, n: Number(n) };
}

export function labelName(code: string) {
  const l = labelFromCode(code);
  const mc = marco(l.marco);
  return `etiqueta ${mc.colorName} com ${mc.iconName} nº ${l.n}`;
}

/** Etiquetas ainda livres na cartela (3 por cor). */
export function freeLabels(state: State): Label[] {
  const used = new Set(state.meds.map((m) => m.label).filter(Boolean));
  const out: Label[] = [];
  for (const mc of MARCOS) {
    for (let n = 1; n <= 3; n++) {
      const code = `${mc.id}-${n}`;
      if (!used.has(code)) out.push({ code, marco: mc.id, n });
    }
  }
  return out;
}

/** Etiqueta que o sistema indica para o medicamento (primeira livre da cor do marco). */
export function suggestedLabel(state: State, med: Medication): string | null {
  return freeLabels(state).find((l) => l.marco === med.marco)?.code ?? null;
}

/* ------------------------------------------------------------------ */
/* Adesão                                                              */
/* ------------------------------------------------------------------ */

export type AdherenceDay = { day: number; entries: { medId: string; delay: number | null }[] };

export function adherence(state: State, period: number) {
  const days: AdherenceDay[] = [];
  for (let day = -period; day <= -1; day++) {
    days.push({ day, entries: state.history.filter((h) => h.day === day) });
  }
  const all = days.flatMap((d) => d.entries);
  const onTime = all.filter((e) => e.delay !== null && e.delay < TOLERANCE_1).length;
  const late = all.filter((e) => e.delay !== null && e.delay >= TOLERANCE_1).length;
  const missed = all.filter((e) => e.delay === null).length;
  const pct = all.length ? Math.round((onTime / all.length) * 100) : 0;
  return { days, total: all.length, onTime, late, missed, pct };
}

export function dayLabel(day: number) {
  const date = new Date(2026, 10, 17 + day);
  return new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" })
    .format(date)
    .replace(".", "");
}

export function uid() {
  return Math.random().toString(36).slice(2, 9);
}
