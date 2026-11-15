// Gera o site da versão funcional (Cloudflare), sem o caminho do GitHub Pages.
import { execSync } from "node:child_process";

execSync("npx next build", {
  stdio: "inherit",
  env: { ...process.env, NEXT_PUBLIC_TARGET: "cloudflare", NEXT_PUBLIC_BASE_PATH: "" },
});
