// Tipos trocados entre o servidor (worker/) e as telas (src/real/).

export type MarcoId = "amanhecer" | "cafe" | "almoco" | "cha" | "jantar" | "dormir";

export type DoseStatus = "tomado" | "agora" | "tolerancia" | "nao-confirmada" | "mais-tarde";

export type Med = {
  id: string;
  name: string;
  dosage: string;
  amount: string;
  marco: MarcoId;
  time: string;
  days: number[];
  stock: number;
  lot: string;
  label: { code: string; n: number } | null;
  createdDate: string;
  createdMin: number;
};

export type TodayDose = {
  medId: string;
  time: string;
  marco: MarcoId;
  status: DoseStatus;
  confirmedMin: number | null;
};

export type Contact = { userId: string; name: string; relation: string; trusted: boolean; phone: string | null };

export type Notice = { id: string; kind: string; text: string; delivered: boolean; createdAt: string };

export type LocalNow = { date: string; min: number; weekday: number };

export type ElderView = {
  linked: true;
  elder: { id: string; name: string };
  contacts: Contact[];
  meds: Med[];
  today: TodayDose[];
  notices: Notice[];
  now: LocalNow;
};

export type DeviceView = ElderView | { linked: false; code: string; expiresAt: string };

export type FamilyElder = { id: string; name: string; relation: string; trusted: boolean };

export type Me = { user: { id: string; name: string; email: string; phone: string | null }; elders: FamilyElder[] };

export type LabelRow = { code: string; marco: MarcoId; n: number; medId: string | null };

export type HistoryDose = { medId: string; date: string; scheduledMin: number; confirmedMin: number | null };

export type History = { meds: Med[]; doses: HistoryDose[]; now: LocalNow; days: number };

export type ScanResult =
  | { ok: true; medId: string; confirmedMin?: number; test?: boolean }
  | {
      ok: false;
      reason: "unknown" | "no_med" | "not_today" | "already" | "future";
      medId?: string;
      confirmedMin?: number;
      startsTomorrow?: boolean;
    };
