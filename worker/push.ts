import { b64url, nowIso, type Env } from "./util";

/*
 * Notificações push sem conteúdo criptografado: o servidor só "acorda" o celular,
 * e o service worker (public/sw.js) busca o texto em /api/push/latest.
 */

const enc = new TextEncoder();
let signingKey: CryptoKey | null = null;

async function vapidHeader(env: Env, endpoint: string) {
  signingKey ??= await crypto.subtle.importKey(
    "jwk",
    JSON.parse(env.VAPID_PRIVATE_JWK),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const header = b64url(JSON.stringify({ typ: "JWT", alg: "ES256" }));
  const claims = b64url(
    JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: env.VAPID_SUBJECT }),
  );
  const signature = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, signingKey, enc.encode(`${header}.${claims}`));
  return `vapid t=${header}.${claims}.${b64url(signature)}, k=${env.VAPID_PUBLIC_KEY}`;
}

/** Envia para todos os aparelhos do dono. Retorna quantos receberam. */
export async function pushTo(env: Env, ownerKind: "device" | "user", ownerIds: string[], title: string, body: string) {
  if (!ownerIds.length || !env.VAPID_PRIVATE_JWK) return 0;
  const placeholders = ownerIds.map(() => "?").join(",");
  const { results } = await env.DB.prepare(
    `SELECT endpoint FROM push_subs WHERE owner_kind = ? AND owner_id IN (${placeholders})`,
  )
    .bind(ownerKind, ...ownerIds)
    .all<{ endpoint: string }>();

  let delivered = 0;
  for (const { endpoint } of results) {
    await env.DB.prepare("UPDATE push_subs SET last_title = ?, last_body = ? WHERE endpoint = ?").bind(title, body, endpoint).run();
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { Authorization: await vapidHeader(env, endpoint), TTL: "3600", Urgency: "high", "Content-Length": "0" },
      });
      if (res.status === 404 || res.status === 410) {
        await env.DB.prepare("DELETE FROM push_subs WHERE endpoint = ?").bind(endpoint).run();
      } else if (res.ok) {
        delivered++;
      }
    } catch {
      /* aparelho fora do ar: tenta na próxima */
    }
  }
  return delivered;
}

export async function saveSubscription(env: Env, ownerKind: "device" | "user", ownerId: string, endpoint: string) {
  await env.DB.prepare(
    `INSERT INTO push_subs (endpoint, owner_kind, owner_id, created_at) VALUES (?, ?, ?, ?)
     ON CONFLICT (endpoint) DO UPDATE SET owner_kind = excluded.owner_kind, owner_id = excluded.owner_id`,
  )
    .bind(endpoint, ownerKind, ownerId, nowIso())
    .run();
}
