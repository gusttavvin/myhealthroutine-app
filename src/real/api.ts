"use client";

const DEVICE_KEY = "mhr-celular-idoso";
const SESSION_KEY = "mhr-sessao";

function read(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    /* sem armazenamento */
  }
}

export const tokens = {
  device: () => read(DEVICE_KEY),
  session: () => read(SESSION_KEY),
  setDevice: (t: string | null) => write(DEVICE_KEY, t),
  setSession: (t: string | null) => write(SESSION_KEY, t),
};

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public fields: Record<string, string> = {},
    public status = 0,
  ) {
    super(message);
  }
}

type Options = { method?: string; body?: unknown; as?: "device" | "user" };

export async function api<T>(path: string, { method = "GET", body, as = "user" }: Options = {}): Promise<T> {
  const token = as === "device" ? tokens.device() : tokens.session();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `${as === "device" ? "Device" : "Bearer"} ${token}`;
  if (body !== undefined) headers["content-type"] = "application/json";
  let res: Response;
  try {
    res = await fetch(`/api${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), cache: "no-store" });
  } catch {
    throw new ApiError("offline", "Sem internet. Confira a conexão e tente de novo.");
  }
  const data = (await res.json().catch(() => ({}))) as { message?: string; error?: string; fields?: Record<string, string> };
  if (!res.ok) {
    if (res.status === 401) {
      if (as === "device") tokens.setDevice(null);
      else tokens.setSession(null);
    }
    throw new ApiError(data.error ?? "server", data.message ?? "Algo deu errado. Tente de novo.", data.fields ?? {}, res.status);
  }
  return data as T;
}

export function fmtMin(min: number) {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}
