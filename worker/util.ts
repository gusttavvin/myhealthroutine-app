import type { DoseStatus, LocalNow, MarcoId, Med } from "../src/real/types";

export type Env = {
  DB: D1Database;
  ASSETS: Fetcher;
  VAPID_PUBLIC_KEY: string;
  VAPID_PRIVATE_JWK: string;
  VAPID_SUBJECT: string;
};

const enc = new TextEncoder();

export function b64url(data: ArrayBuffer | Uint8Array | string) {
  const bytes = typeof data === "string" ? enc.encode(data) : data instanceof Uint8Array ? data : new Uint8Array(data);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function randomId(len = 12) {
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

export function randomToken() {
  return b64url(crypto.getRandomValues(new Uint8Array(32)));
}

export function randomDigits(n: number) {
  const bytes = crypto.getRandomValues(new Uint8Array(n));
  return Array.from(bytes, (b) => String(b % 10)).join("");
}

export async function sha256(text: string) {
  return b64url(await crypto.subtle.digest("SHA-256", enc.encode(text)));
}

// PBKDF2 com poucas iterações para caber no limite de CPU do plano gratuito.
const PBKDF2_ITERATIONS = 10000;

export async function hashPassword(password: string, salt: string) {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: enc.encode(salt), iterations: PBKDF2_ITERATIONS },
    key,
    256,
  );
  return b64url(bits);
}

export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export const nowIso = () => new Date().toISOString();

/* --------------------------- horário local do idoso --------------------------- */

const WEEKDAY: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function localNow(tz: string, at = new Date()): LocalNow {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      weekday: "short",
      hourCycle: "h23",
    })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    min: Number(parts.hour) * 60 + Number(parts.minute),
    weekday: WEEKDAY[parts.weekday] ?? 0,
  };
}

export function toMin(time: string) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function fmtMin(min: number) {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

/** O remédio tem dose nesta data? Remédio cadastrado hoje só começa no próximo horário. */
export function takesOn(med: Med, date: string, weekday: number) {
  if (!med.days.includes(weekday)) return false;
  if (med.createdDate > date) return false;
  if (med.createdDate === date && toMin(med.time) <= med.createdMin) return false;
  return true;
}

export function doseStatus(scheduled: number, confirmedMin: number | null, now: number): DoseStatus {
  if (confirmedMin !== null) return "tomado";
  const diff = now - scheduled;
  if (diff < 0) return "mais-tarde";
  if (diff < 20) return "agora";
  if (diff < 40) return "tolerancia";
  return "nao-confirmada";
}

export const MARCO_TEXT: Record<MarcoId, { dose: string; color: string; icon: string; label: string }> = {
  amanhecer: { dose: "remédio do amanhecer", color: "laranja", icon: "nascer do sol", label: "Amanhecer · Jejum" },
  cafe: { dose: "remédio da manhã", color: "amarela", icon: "sol", label: "Manhã · Café" },
  almoco: { dose: "remédio do almoço", color: "vermelha", icon: "prato", label: "Almoço" },
  cha: { dose: "remédio da tarde", color: "verde", icon: "xícara", label: "Tarde · Chá" },
  jantar: { dose: "remédio da noite", color: "azul-escura", icon: "lua", label: "Noite · Jantar" },
  dormir: { dose: "remédio de antes de dormir", color: "roxa", icon: "cama", label: "Antes de dormir" },
};

export const MARCO_IDS = Object.keys(MARCO_TEXT) as MarcoId[];
