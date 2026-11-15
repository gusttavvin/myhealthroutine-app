import type {
  Contact,
  DeviceView,
  ElderView,
  HistoryDose,
  LabelRow,
  MarcoId,
  Me,
  Med,
  Notice,
  ScanResult,
  TodayDose,
} from "../src/real/types";
import { pushTo, saveSubscription } from "./push";
import {
  HttpError,
  MARCO_IDS,
  MARCO_TEXT,
  doseStatus,
  fmtMin,
  hashPassword,
  json,
  localNow,
  nowIso,
  randomDigits,
  randomId,
  randomToken,
  sha256,
  takesOn,
  toMin,
  type Env,
} from "./util";

/* ================================================================== */
/* Leitura do banco                                                    */
/* ================================================================== */

type MedRow = {
  id: string;
  name: string;
  dosage: string;
  amount: string;
  marco: MarcoId;
  time: string;
  days: string;
  stock: number;
  lot: string;
  created_date: string;
  created_min: number;
  code: string | null;
  n: number | null;
};

function toMed(r: MedRow): Med {
  return {
    id: r.id,
    name: r.name,
    dosage: r.dosage,
    amount: r.amount,
    marco: r.marco,
    time: r.time,
    days: JSON.parse(r.days) as number[],
    stock: r.stock,
    lot: r.lot,
    label: r.code ? { code: r.code, n: r.n ?? 1 } : null,
    createdDate: r.created_date,
    createdMin: r.created_min,
  };
}

async function readMeds(env: Env, elderId: string): Promise<Med[]> {
  const { results } = await env.DB.prepare(
    `SELECT m.*, l.code AS code, l.n AS n FROM meds m
     LEFT JOIN labels l ON l.med_id = m.id
     WHERE m.elder_id = ? AND m.active = 1 ORDER BY m.time`,
  )
    .bind(elderId)
    .all<MedRow>();
  return results.map(toMed);
}

async function readMed(env: Env, elderId: string, medId: string) {
  const med = (await readMeds(env, elderId)).find((m) => m.id === medId);
  if (!med) throw new HttpError(404, "not_found", "Remédio não encontrado.");
  return med;
}

async function getElder(env: Env, elderId: string) {
  const elder = await env.DB.prepare("SELECT id, name, tz FROM elders WHERE id = ?").bind(elderId).first<{ id: string; name: string; tz: string }>();
  if (!elder) throw new HttpError(404, "not_found", "Idoso não encontrado.");
  return elder;
}

async function readContacts(env: Env, elderId: string): Promise<Contact[]> {
  const { results } = await env.DB.prepare(
    `SELECT u.id AS userId, u.name, u.phone, l.relation, l.trusted FROM links l
     JOIN users u ON u.id = l.user_id WHERE l.elder_id = ? ORDER BY l.trusted DESC, l.created_at`,
  )
    .bind(elderId)
    .all<{ userId: string; name: string; phone: string | null; relation: string; trusted: number }>();
  return results.map((r) => ({ userId: r.userId, name: r.name, phone: r.phone, relation: r.relation, trusted: r.trusted === 1 }));
}

async function readNotices(env: Env, elderId: string, limit = 15): Promise<Notice[]> {
  const { results } = await env.DB.prepare(
    "SELECT id, kind, text, delivered, created_at FROM notices WHERE elder_id = ? ORDER BY created_at DESC LIMIT ?",
  )
    .bind(elderId, limit)
    .all<{ id: string; kind: string; text: string; delivered: number; created_at: string }>();
  return results.map((r) => ({ id: r.id, kind: r.kind, text: r.text, delivered: r.delivered === 1, createdAt: r.created_at }));
}

async function addNotice(env: Env, elderId: string, kind: string, text: string, delivered: boolean) {
  await env.DB.prepare("INSERT INTO notices (id, elder_id, kind, text, delivered, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(randomId(), elderId, kind, text, delivered ? 1 : 0, nowIso())
    .run();
}

async function elderView(env: Env, elderId: string): Promise<ElderView> {
  const elder = await getElder(env, elderId);
  const now = localNow(elder.tz);
  const [meds, contacts, notices, doseRows] = await Promise.all([
    readMeds(env, elderId),
    readContacts(env, elderId),
    readNotices(env, elderId),
    env.DB.prepare("SELECT med_id, confirmed_min FROM doses WHERE elder_id = ? AND date = ?")
      .bind(elderId, now.date)
      .all<{ med_id: string; confirmed_min: number | null }>(),
  ]);
  const confirmed = new Map(doseRows.results.map((d) => [d.med_id, d.confirmed_min]));
  const today: TodayDose[] = meds
    .filter((m) => takesOn(m, now.date, now.weekday))
    .map((m) => {
      const confirmedMin = confirmed.get(m.id) ?? null;
      return { medId: m.id, time: m.time, marco: m.marco, confirmedMin, status: doseStatus(toMin(m.time), confirmedMin, now.min) };
    })
    .sort((a, b) => toMin(a.time) - toMin(b.time));
  return { linked: true, elder: { id: elder.id, name: elder.name }, contacts, meds, today, notices, now };
}

/* ================================================================== */
/* Autenticação                                                        */
/* ================================================================== */

type User = { id: string; name: string; email: string; phone: string | null };
type Device = { id: string; elder_id: string | null; link_code: string | null; link_expires: string | null };

function bearer(req: Request, scheme: "Bearer" | "Device") {
  const h = req.headers.get("Authorization") ?? "";
  return h.startsWith(`${scheme} `) ? h.slice(scheme.length + 1).trim() : null;
}

async function authUser(env: Env, req: Request): Promise<User> {
  const token = bearer(req, "Bearer");
  if (!token) throw new HttpError(401, "auth", "Entre de novo na sua conta.");
  const row = await env.DB.prepare(
    `SELECT u.id, u.name, u.email, u.phone, s.expires_at FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?`,
  )
    .bind(await sha256(token))
    .first<User & { expires_at: string }>();
  if (!row || row.expires_at < nowIso()) throw new HttpError(401, "auth", "Sua sessão expirou. Entre de novo.");
  return { id: row.id, name: row.name, email: row.email, phone: row.phone };
}

async function authDevice(env: Env, req: Request): Promise<Device> {
  const token = bearer(req, "Device");
  if (!token) throw new HttpError(401, "auth", "Este celular não está cadastrado.");
  const device = await env.DB.prepare("SELECT id, elder_id, link_code, link_expires FROM devices WHERE token_hash = ?")
    .bind(await sha256(token))
    .first<Device>();
  if (!device) throw new HttpError(401, "auth", "Este celular não está cadastrado.");
  return device;
}

async function requireLink(env: Env, userId: string, elderId: string) {
  const link = await env.DB.prepare("SELECT relation, trusted FROM links WHERE user_id = ? AND elder_id = ?")
    .bind(userId, elderId)
    .first<{ relation: string; trusted: number }>();
  if (!link) throw new HttpError(403, "forbidden", "Você não acompanha este idoso.");
  return link;
}

async function newSession(env: Env, userId: string) {
  const token = randomToken();
  const expires = new Date(Date.now() + 60 * 24 * 3600 * 1000).toISOString();
  await env.DB.prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)").bind(await sha256(token), userId, expires).run();
  return token;
}

async function newLinkCode(env: Env, deviceId: string) {
  let code = randomDigits(6);
  for (let i = 0; i < 5; i++) {
    const clash = await env.DB.prepare("SELECT 1 FROM devices WHERE link_code = ? AND link_expires > ?").bind(code, nowIso()).first();
    if (!clash) break;
    code = randomDigits(6);
  }
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  await env.DB.prepare("UPDATE devices SET link_code = ?, link_expires = ? WHERE id = ?").bind(code, expiresAt, deviceId).run();
  return { code, expiresAt };
}

async function deviceByCode(env: Env, code: string) {
  const device = await env.DB.prepare("SELECT id, elder_id FROM devices WHERE link_code = ? AND link_expires > ?")
    .bind(String(code).replace(/\D/g, ""), nowIso())
    .first<{ id: string; elder_id: string | null }>();
  if (!device) throw new HttpError(400, "bad_code", "Código inválido ou expirado. Confira o código no celular do idoso.");
  return device;
}

/* ================================================================== */
/* Validação da prescrição (P3)                                        */
/* ================================================================== */

const RANGES: Record<MarcoId, [number, number]> = {
  amanhecer: [300, 479],
  cafe: [360, 659],
  almoco: [660, 899],
  cha: [900, 1079],
  jantar: [1080, 1319],
  dormir: [1260, 1439],
};
const AMOUNTS = ["1 comprimido", "2 comprimidos", "meio comprimido", "1 cápsula", "10 gotas"];

type MedInput = { name: string; dosage: string; amount: string; marco: MarcoId; time: string; days: number[]; stock: number; lot: string };

function validateMed(body: Record<string, unknown>, others: Med[], creating: boolean): MedInput {
  const fields: Record<string, string> = {};
  const name = String(body.name ?? "").trim().slice(0, 80);
  const dosage = String(body.dosage ?? "").trim().slice(0, 30);
  const amount = String(body.amount ?? "");
  const marco = String(body.marco ?? "") as MarcoId;
  const time = String(body.time ?? "");
  const days = Array.isArray(body.days) ? [...new Set(body.days.map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort() : [];
  const stock = Number(body.stock);
  const lot = String(body.lot ?? "").trim().toUpperCase().slice(0, 30) || "—";

  if (!name) fields.name = "Informe o nome do medicamento.";
  if (!dosage) fields.dosage = "Informe a dosagem (ex.: 50 mg).";
  else if (!/\d/.test(dosage)) fields.dosage = "A dosagem precisa ter um número (ex.: 50 mg).";
  if (!AMOUNTS.includes(amount)) fields.amount = "Escolha quanto tomar.";
  if (!MARCO_IDS.includes(marco)) fields.marco = "Escolha o marco da rotina.";
  if (!/^\d{2}:\d{2}$/.test(time)) fields.time = "Informe o horário.";
  else if (MARCO_IDS.includes(marco)) {
    const [a, b] = RANGES[marco];
    const t = toMin(time);
    if (t < a || t > b) fields.time = `O horário ${time} não combina com “${MARCO_TEXT[marco].label}” (de ${fmtMin(a)} a ${fmtMin(b)}).`;
  }
  if (!days.length) fields.days = "Escolha pelo menos um dia.";
  if (!Number.isInteger(stock) || stock < (creating ? 1 : 0) || stock > 10000) fields.stock = "Informe quantos comprimidos há na caixa.";
  const dup = others.find((m) => m.name.toLowerCase() === name.toLowerCase() && m.marco === marco);
  if (dup && !fields.name) fields.name = `${dup.name} já está cadastrado em “${MARCO_TEXT[marco].label}”.`;

  if (Object.keys(fields).length) {
    throw Object.assign(new HttpError(400, "invalid", "Confira os campos marcados."), { fields });
  }
  return { name, dosage, amount, marco, time, days, stock, lot };
}

/* ================================================================== */
/* Rotas                                                               */
/* ================================================================== */

async function body(req: Request): Promise<Record<string, unknown>> {
  try {
    return (await req.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function normalizeLabel(raw: unknown) {
  return String(raw ?? "")
    .trim()
    .toUpperCase()
    .replace(/^MHR:/, "")
    .replace(/[^A-Z0-9]/g, "");
}

async function route(req: Request, env: Env, url: URL): Promise<Response> {
  const path = url.pathname.replace(/\/+$/, "");
  const method = req.method;
  const seg = path.split("/").filter(Boolean); // ["api", ...]

  /* ---------- público ---------- */

  if (path === "/api/config" && method === "GET") {
    return json({ vapidPublicKey: env.VAPID_PUBLIC_KEY ?? null });
  }

  if (path === "/api/auth/signup" && method === "POST") {
    const b = await body(req);
    const name = String(b.name ?? "").trim().slice(0, 80);
    const email = String(b.email ?? "").trim().toLowerCase();
    const phone = String(b.phone ?? "").replace(/[^\d+]/g, "").slice(0, 20) || null;
    const password = String(b.password ?? "");
    const fields: Record<string, string> = {};
    if (name.length < 2) fields.name = "Escreva seu nome.";
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fields.email = "Confira o e-mail.";
    if (password.length < 8) fields.password = "A senha precisa ter pelo menos 8 caracteres.";
    if (!fields.email && (await env.DB.prepare("SELECT 1 FROM users WHERE email = ?").bind(email).first())) {
      fields.email = "Já existe uma conta com este e-mail. Use “Entrar”.";
    }
    if (Object.keys(fields).length) throw Object.assign(new HttpError(400, "invalid", "Confira os campos marcados."), { fields });
    const id = randomId();
    const salt = randomToken();
    await env.DB.prepare("INSERT INTO users (id, email, name, phone, pass_hash, salt, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .bind(id, email, name, phone, await hashPassword(password, salt), salt, nowIso())
      .run();
    return json({ token: await newSession(env, id) });
  }

  if (path === "/api/auth/login" && method === "POST") {
    const b = await body(req);
    const email = String(b.email ?? "").trim().toLowerCase();
    const user = await env.DB.prepare("SELECT id, pass_hash, salt FROM users WHERE email = ?")
      .bind(email)
      .first<{ id: string; pass_hash: string; salt: string }>();
    if (!user || (await hashPassword(String(b.password ?? ""), user.salt)) !== user.pass_hash) {
      throw new HttpError(401, "login", "E-mail ou senha não conferem. Tente de novo.");
    }
    return json({ token: await newSession(env, user.id) });
  }

  if (path === "/api/auth/logout" && method === "POST") {
    const token = bearer(req, "Bearer");
    if (token) await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await sha256(token)).run();
    return json({ ok: true });
  }

  if (path === "/api/device/register" && method === "POST") {
    const token = randomToken();
    const id = randomId();
    await env.DB.prepare("INSERT INTO devices (id, token_hash, created_at) VALUES (?, ?, ?)").bind(id, await sha256(token), nowIso()).run();
    const code = await newLinkCode(env, id);
    return json({ deviceToken: token, ...code });
  }

  if (path === "/api/push/latest" && method === "POST") {
    const b = await body(req);
    const row = await env.DB.prepare("SELECT last_title, last_body FROM push_subs WHERE endpoint = ?")
      .bind(String(b.endpoint ?? ""))
      .first<{ last_title: string | null; last_body: string | null }>();
    return json({ title: row?.last_title ?? "MyHealthRoutine", body: row?.last_body ?? "Abra o aplicativo para ver o aviso." });
  }

  if (path === "/api/push/subscribe" && method === "POST") {
    const b = await body(req);
    const endpoint = String(b.endpoint ?? "");
    if (!endpoint.startsWith("https://")) throw new HttpError(400, "invalid", "Inscrição inválida.");
    if (bearer(req, "Device")) {
      const device = await authDevice(env, req);
      await saveSubscription(env, "device", device.id, endpoint);
    } else {
      const user = await authUser(env, req);
      await saveSubscription(env, "user", user.id, endpoint);
    }
    return json({ ok: true });
  }

  /* ---------- celular do idoso ---------- */

  if (seg[1] === "device") {
    const device = await authDevice(env, req);

    if (path === "/api/device/me" && method === "GET") {
      if (!device.elder_id) {
        let code = device.link_code;
        let expiresAt = device.link_expires;
        if (!code || !expiresAt || expiresAt < nowIso()) ({ code, expiresAt } = await newLinkCode(env, device.id));
        const view: DeviceView = { linked: false, code: code!, expiresAt: expiresAt! };
        return json(view);
      }
      return json(await elderView(env, device.elder_id));
    }

    if (!device.elder_id) throw new HttpError(409, "not_linked", "Este celular ainda não foi vinculado a um familiar.");
    const elderId = device.elder_id;

    if (path === "/api/device/code" && method === "POST") {
      return json(await newLinkCode(env, device.id));
    }

    if (path === "/api/device/scan" && method === "POST") {
      const b = await body(req);
      return json(await scan(env, elderId, normalizeLabel(b.code), b.test === true));
    }

    if (path === "/api/device/help" && method === "POST") {
      const elder = await getElder(env, elderId);
      const contacts = await readContacts(env, elderId);
      const targets = contacts.filter((c) => c.trusted).map((c) => c.userId);
      const now = localNow(elder.tz);
      const delivered = await pushTo(
        env,
        "user",
        targets.length ? targets : contacts.map((c) => c.userId),
        `${elder.name} pediu ajuda`,
        `${elder.name} tocou em “Pedir ajuda” às ${fmtMin(now.min)}. Ligue para saber se está tudo bem.`,
      );
      await addNotice(env, elderId, "ajuda", `${elder.name} pediu ajuda pelo aplicativo às ${fmtMin(now.min)}.`, delivered > 0);
      return json({ delivered: delivered > 0 });
    }

    if (seg[2] === "links" && seg[3] && method === "DELETE") {
      await env.DB.prepare("DELETE FROM links WHERE elder_id = ? AND user_id = ?").bind(elderId, seg[3]).run();
      return json({ ok: true });
    }

    if (path === "/api/device/unlink" && method === "POST") {
      await env.DB.prepare("DELETE FROM devices WHERE id = ?").bind(device.id).run();
      await env.DB.prepare("DELETE FROM push_subs WHERE owner_kind = 'device' AND owner_id = ?").bind(device.id).run();
      return json({ ok: true });
    }
    throw new HttpError(404, "not_found", "Endereço não encontrado.");
  }

  /* ---------- familiar / cuidador ---------- */

  const user = await authUser(env, req);

  if (path === "/api/me" && method === "GET") {
    const { results } = await env.DB.prepare(
      "SELECT e.id, e.name, l.relation, l.trusted FROM links l JOIN elders e ON e.id = l.elder_id WHERE l.user_id = ? ORDER BY l.created_at",
    )
      .bind(user.id)
      .all<{ id: string; name: string; relation: string; trusted: number }>();
    const me: Me = { user, elders: results.map((r) => ({ id: r.id, name: r.name, relation: r.relation, trusted: r.trusted === 1 })) };
    return json(me);
  }

  if (path === "/api/link/check" && method === "POST") {
    const b = await body(req);
    const device = await deviceByCode(env, String(b.code ?? ""));
    if (!device.elder_id) return json({ status: "new" });
    const elder = await getElder(env, device.elder_id);
    const already = await env.DB.prepare("SELECT 1 FROM links WHERE user_id = ? AND elder_id = ?").bind(user.id, elder.id).first();
    return json({ status: already ? "already" : "existing", elderName: elder.name });
  }

  if (path === "/api/link" && method === "POST") {
    const b = await body(req);
    const device = await deviceByCode(env, String(b.code ?? ""));
    const relation = String(b.relation ?? "familiar").slice(0, 40);
    let elderId = device.elder_id;
    if (!elderId) {
      const elderName = String(b.elderName ?? "").trim().slice(0, 60);
      if (elderName.length < 2) throw Object.assign(new HttpError(400, "invalid", "Escreva o nome do idoso."), { fields: { elderName: "Escreva o nome do idoso." } });
      elderId = randomId();
      await env.DB.prepare("INSERT INTO elders (id, name, created_at) VALUES (?, ?, ?)").bind(elderId, elderName, nowIso()).run();
      await env.DB.prepare("UPDATE devices SET elder_id = ? WHERE id = ?").bind(elderId, device.id).run();
    }
    const hasTrusted = await env.DB.prepare("SELECT 1 FROM links WHERE elder_id = ? AND trusted = 1").bind(elderId).first();
    await env.DB.prepare(
      "INSERT OR IGNORE INTO links (user_id, elder_id, relation, trusted, created_at) VALUES (?, ?, ?, ?, ?)",
    )
      .bind(user.id, elderId, relation, hasTrusted ? 0 : 1, nowIso())
      .run();
    await env.DB.prepare("UPDATE devices SET link_code = NULL, link_expires = NULL WHERE id = ?").bind(device.id).run();
    return json({ elderId });
  }

  if (seg[1] === "elders" && seg[2]) {
    const elderId = seg[2];
    const link = await requireLink(env, user.id, elderId);

    if (seg.length === 3 && method === "GET") return json(await elderView(env, elderId));

    if (seg[3] === "trusted" && method === "POST") {
      await env.DB.prepare("UPDATE links SET trusted = CASE WHEN user_id = ? THEN 1 ELSE 0 END WHERE elder_id = ?").bind(user.id, elderId).run();
      return json({ ok: true });
    }

    if (seg[3] === "labels" && method === "GET") return json(await ensureLabels(env, elderId));

    if (seg[3] === "history" && method === "GET") {
      const days = url.searchParams.get("days") === "30" ? 30 : 7;
      const elder = await getElder(env, elderId);
      const now = localNow(elder.tz);
      const start = new Date(`${now.date}T12:00:00Z`);
      start.setUTCDate(start.getUTCDate() - days);
      const { results } = await env.DB.prepare(
        "SELECT med_id, date, scheduled_min, confirmed_min FROM doses WHERE elder_id = ? AND date >= ? AND date < ?",
      )
        .bind(elderId, start.toISOString().slice(0, 10), now.date)
        .all<{ med_id: string; date: string; scheduled_min: number; confirmed_min: number | null }>();
      const doses: HistoryDose[] = results.map((r) => ({ medId: r.med_id, date: r.date, scheduledMin: r.scheduled_min, confirmedMin: r.confirmed_min }));
      return json({ meds: await readMeds(env, elderId), doses, now, days });
    }

    if (seg[3] === "meds") {
      const meds = await readMeds(env, elderId);
      const medId = seg[4];

      if (!medId && method === "POST") {
        const input = validateMed(await body(req), meds, true);
        const elder = await getElder(env, elderId);
        const now = localNow(elder.tz);
        const id = randomId();
        await env.DB.prepare(
          `INSERT INTO meds (id, elder_id, name, dosage, amount, marco, time, days, stock, lot, created_date, created_min)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
          .bind(id, elderId, input.name, input.dosage, input.amount, input.marco, input.time, JSON.stringify(input.days), input.stock, input.lot, now.date, now.min)
          .run();
        return json({ id });
      }

      if (medId && !seg[5]) {
        const med = await readMed(env, elderId, medId);
        if (method === "PUT") {
          const input = validateMed(await body(req), meds.filter((m) => m.id !== medId), false);
          await env.DB.prepare("UPDATE meds SET name = ?, dosage = ?, amount = ?, marco = ?, time = ?, days = ?, stock = ?, lot = ? WHERE id = ?")
            .bind(input.name, input.dosage, input.amount, input.marco, input.time, JSON.stringify(input.days), input.stock, input.lot, medId)
            .run();
          const labelRemoved = input.marco !== med.marco && med.label !== null;
          if (labelRemoved) await env.DB.prepare("UPDATE labels SET med_id = NULL WHERE med_id = ?").bind(medId).run();
          return json({ id: medId, labelRemoved });
        }
        if (method === "DELETE") {
          await env.DB.prepare("UPDATE meds SET active = 0 WHERE id = ?").bind(medId).run();
          await env.DB.prepare("UPDATE labels SET med_id = NULL WHERE med_id = ?").bind(medId).run();
          return json({ ok: true });
        }
      }

      if (medId && seg[5] === "label" && method === "POST") {
        const med = await readMed(env, elderId, medId);
        const code = normalizeLabel((await body(req)).code);
        const label = await env.DB.prepare("SELECT code, marco, n, med_id FROM labels WHERE code = ? AND elder_id = ?")
          .bind(code, elderId)
          .first<{ code: string; marco: MarcoId; n: number; med_id: string | null }>();
        if (!label) throw new HttpError(400, "label_unknown", "Esta etiqueta não é das etiquetas impressas para este idoso.");
        if (label.med_id && label.med_id !== medId) {
          const owner = meds.find((m) => m.id === label.med_id);
          throw new HttpError(400, "label_used", `Esta etiqueta já está na caixa de ${owner ? `${owner.name} ${owner.dosage}` : "outro remédio"}.`);
        }
        if (label.marco !== med.marco) {
          const got = MARCO_TEXT[label.marco];
          const want = MARCO_TEXT[med.marco];
          throw new HttpError(400, "label_color", `Esta é uma etiqueta ${got.color} (${got.label}). Para “${want.label}” use uma ${want.color} com ${want.icon}.`);
        }
        await env.DB.prepare("UPDATE labels SET med_id = NULL WHERE med_id = ?").bind(medId).run();
        await env.DB.prepare("UPDATE labels SET med_id = ? WHERE code = ?").bind(medId, code).run();
        return json({ ok: true, code, n: label.n });
      }

      if (medId && seg[5] === "stock" && method === "POST") {
        const add = Number((await body(req)).add);
        if (!Number.isInteger(add) || add < 1 || add > 1000) throw new HttpError(400, "invalid", "Informe quantos comprimidos chegaram.");
        await env.DB.prepare("UPDATE meds SET stock = stock + ? WHERE id = ? AND elder_id = ?").bind(add, medId, elderId).run();
        return json({ ok: true });
      }

      if (medId && seg[5] === "restock-notice" && method === "POST") {
        const med = await readMed(env, elderId, medId);
        const elder = await getElder(env, elderId);
        const contacts = await readContacts(env, elderId);
        const text = `Repor ${med.name} ${med.dosage} (lote ${med.lot}) de ${elder.name}. Restam ${med.stock} comprimidos. Aviso de ${user.name.split(" ")[0]}.`;
        const delivered = await pushTo(env, "user", contacts.filter((c) => c.userId !== user.id).map((c) => c.userId), "Reposição de remédio", text);
        await addNotice(env, elderId, "reposicao", text, true);
        return json({ ok: true, delivered, relation: link.relation });
      }
    }
  }

  throw new HttpError(404, "not_found", "Endereço não encontrado.");
}

/* ================================================================== */
/* Etiquetas                                                           */
/* ================================================================== */

/** Garante pelo menos 2 etiquetas livres de cada cor e devolve todas. */
async function ensureLabels(env: Env, elderId: string): Promise<LabelRow[]> {
  const read = async () =>
    (
      await env.DB.prepare("SELECT code, marco, n, med_id FROM labels WHERE elder_id = ? ORDER BY marco, n")
        .bind(elderId)
        .all<{ code: string; marco: MarcoId; n: number; med_id: string | null }>()
    ).results;
  const rows = await read();
  const inserts: D1PreparedStatement[] = [];
  for (const marco of MARCO_IDS) {
    const mine = rows.filter((r) => r.marco === marco);
    let free = mine.filter((r) => !r.med_id).length;
    let n = mine.reduce((max, r) => Math.max(max, r.n), 0);
    while (free < 2) {
      n++;
      free++;
      inserts.push(env.DB.prepare("INSERT INTO labels (code, elder_id, marco, n) VALUES (?, ?, ?, ?)").bind(randomId(8), elderId, marco, n));
    }
  }
  if (inserts.length) await env.DB.batch(inserts);
  const all = inserts.length ? await read() : rows;
  return all.map((r) => ({ code: r.code, marco: r.marco, n: r.n, medId: r.med_id }));
}

/* ================================================================== */
/* Leitura da etiqueta pelo idoso (P1)                                 */
/* ================================================================== */

async function scan(env: Env, elderId: string, code: string, test: boolean): Promise<ScanResult> {
  const label = await env.DB.prepare("SELECT med_id FROM labels WHERE code = ? AND elder_id = ?").bind(code, elderId).first<{ med_id: string | null }>();
  if (!label) return { ok: false, reason: "unknown" };
  if (!label.med_id) return { ok: false, reason: "no_med" };
  const meds = await readMeds(env, elderId);
  const med = meds.find((m) => m.id === label.med_id);
  if (!med) return { ok: false, reason: "no_med" };
  if (test) return { ok: true, medId: med.id, test: true };

  const elder = await getElder(env, elderId);
  const now = localNow(elder.tz);
  if (!takesOn(med, now.date, now.weekday)) {
    return { ok: false, reason: "not_today", medId: med.id, startsTomorrow: med.createdDate === now.date };
  }
  const dose = await env.DB.prepare("SELECT confirmed_min FROM doses WHERE med_id = ? AND date = ?")
    .bind(med.id, now.date)
    .first<{ confirmed_min: number | null }>();
  if (dose?.confirmed_min != null) return { ok: false, reason: "already", medId: med.id, confirmedMin: dose.confirmed_min };
  const scheduled = toMin(med.time);
  if (now.min < scheduled - 30) return { ok: false, reason: "future", medId: med.id };

  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO doses (med_id, date, elder_id, scheduled_min, confirmed_min, confirmed_at, level) VALUES (?, ?, ?, ?, ?, ?, 0)
       ON CONFLICT (med_id, date) DO UPDATE SET confirmed_min = excluded.confirmed_min, confirmed_at = excluded.confirmed_at`,
    ).bind(med.id, now.date, elderId, scheduled, now.min, nowIso()),
    env.DB.prepare("UPDATE meds SET stock = MAX(stock - 1, 0) WHERE id = ?").bind(med.id),
  ]);

  // Alerta preventivo de estoque quando cruza a marca de 7 dias.
  const perDay = med.days.length / 7;
  const before = Math.floor(med.stock / perDay);
  const after = Math.floor(Math.max(med.stock - 1, 0) / perDay);
  if (before > 7 && after <= 7) {
    const contacts = await readContacts(env, elderId);
    const text = `Estoque baixo: restam ${med.stock - 1} comprimidos de ${med.name} ${med.dosage} (lote ${med.lot}).`;
    const delivered = await pushTo(env, "user", contacts.map((c) => c.userId), `Remédio de ${elder.name} acabando`, text);
    await addNotice(env, elderId, "estoque", text, delivered > 0);
  }
  return { ok: true, medId: med.id, confirmedMin: now.min };
}

/* ================================================================== */
/* Tarefa agendada: aviso, reforço (20 min) e aviso ao contato (40 min) */
/* ================================================================== */

async function tick(env: Env) {
  const { results: elders } = await env.DB.prepare("SELECT id, name, tz FROM elders").all<{ id: string; name: string; tz: string }>();
  for (const elder of elders) {
    const now = localNow(elder.tz);
    const meds = (await readMeds(env, elder.id)).filter((m) => takesOn(m, now.date, now.weekday));
    if (!meds.length) continue;
    const { results: rows } = await env.DB.prepare("SELECT med_id, confirmed_min, level FROM doses WHERE elder_id = ? AND date = ?")
      .bind(elder.id, now.date)
      .all<{ med_id: string; confirmed_min: number | null; level: number }>();
    const byMed = new Map(rows.map((r) => [r.med_id, r]));
    const { results: devices } = await env.DB.prepare("SELECT id FROM devices WHERE elder_id = ?").bind(elder.id).all<{ id: string }>();
    const deviceIds = devices.map((d) => d.id);

    for (const med of meds) {
      const row = byMed.get(med.id);
      if (row?.confirmed_min != null) continue;
      const scheduled = toMin(med.time);
      const diff = now.min - scheduled;
      const level = row?.level ?? 0;
      const t = MARCO_TEXT[med.marco];
      let next = level;

      if (diff >= 0 && diff < 20 && level < 1) {
        await pushTo(env, "device", deviceIds, "Hora do remédio", `Está na hora do ${t.dose}. Pegue a caixa ${t.color} com ${t.icon}.`);
        next = 1;
      } else if (diff >= 20 && diff < 40 && level < 2) {
        await pushTo(env, "device", deviceIds, "Lembrete: remédio pendente", `O ${t.dose} ainda está pendente. Pegue a caixa ${t.color} com ${t.icon}.`);
        next = 2;
      } else if (diff >= 40 && diff < 180 && level < 3) {
        const contacts = await readContacts(env, elder.id);
        const trusted = contacts.filter((c) => c.trusted).map((c) => c.userId);
        const text = `O ${t.dose} de ${elder.name} (${med.time}, caixa ${t.color}) ainda não foi confirmado às ${fmtMin(now.min)}.`;
        const delivered = await pushTo(env, "user", trusted.length ? trusted : contacts.map((c) => c.userId), `Aviso sobre ${elder.name}`, text);
        await addNotice(env, elder.id, "aviso", text, delivered > 0);
        next = 3;
      }

      if (next !== level) {
        await env.DB.prepare(
          `INSERT INTO doses (med_id, date, elder_id, scheduled_min, level) VALUES (?, ?, ?, ?, ?)
           ON CONFLICT (med_id, date) DO UPDATE SET level = excluded.level`,
        )
          .bind(med.id, now.date, elder.id, scheduled, next)
          .run();
      }
    }
  }
}

/* ================================================================== */

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(req);
    try {
      return await route(req, env, url);
    } catch (err) {
      if (err instanceof HttpError) {
        return json({ error: err.code, message: err.message, fields: (err as HttpError & { fields?: unknown }).fields }, err.status);
      }
      console.error(err);
      return json({ error: "server", message: "Algo deu errado no servidor. Tente de novo." }, 500);
    }
  },

  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(tick(env));
  },
} satisfies ExportedHandler<Env>;
