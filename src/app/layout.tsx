import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible } from "next/font/google";
import "./globals.css";

// Fonte criada para leitura por pessoas com baixa visão.
const atkinson = Atkinson_Hyperlegible({
  variable: "--font-main",
  subsets: ["latin"],
  weight: ["400", "700"],
});

const isCloudflare = process.env.NEXT_PUBLIC_TARGET === "cloudflare";

export const metadata: Metadata = isCloudflare
  ? {
      title: "MyHealthRoutine",
      description: "Apoio à gestão autônoma de medicamentos por pessoas da terceira idade.",
      manifest: "/manifest.webmanifest",
      icons: { icon: "/icon-192.png", apple: "/icon-180.png" },
      appleWebApp: { capable: true, title: "MyHealth", statusBarStyle: "default" },
    }
  : {
      title: "MyHealthRoutine | Protótipo",
      description: "Protótipo interativo do MyHealthRoutine: apoio à gestão autônoma de medicamentos por pessoas da terceira idade.",
    };

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: isCloudflare ? "#0b6b62" : "#eef4f2",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className={atkinson.variable}>{children}</body>
    </html>
  );
}
