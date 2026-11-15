// Gera o par de chaves das notificações push (VAPID). Rodar uma vez:
//   node scripts/gerar-chaves-push.mjs
// A chave pública vai em wrangler.jsonc (VAPID_PUBLIC_KEY).
// A privada vai em .dev.vars (local) e em `npx wrangler secret put VAPID_PRIVATE_JWK` (produção).
import { webcrypto as crypto } from "node:crypto";

const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
const raw = Buffer.from(await crypto.subtle.exportKey("raw", pair.publicKey)).toString("base64url");
const jwk = await crypto.subtle.exportKey("jwk", pair.privateKey);

console.log("VAPID_PUBLIC_KEY=" + raw);
console.log("VAPID_PRIVATE_JWK=" + JSON.stringify(jwk));
