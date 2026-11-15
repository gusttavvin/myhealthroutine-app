import { Prototype } from "@/components/prototype";
import { RealApp } from "@/real/real-app";

// O mesmo código gera duas versões:
// - GitHub Pages: o protótipo com dados simulados (usado na avaliação da disciplina);
// - Cloudflare: o aplicativo funcional, com servidor e banco de dados.
const isCloudflare = process.env.NEXT_PUBLIC_TARGET === "cloudflare";

export default function Home() {
  return isCloudflare ? <RealApp /> : <Prototype />;
}
