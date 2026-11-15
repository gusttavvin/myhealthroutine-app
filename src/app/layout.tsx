import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible } from "next/font/google";
import "./globals.css";

// Fonte criada para leitura por pessoas com baixa visão.
const atkinson = Atkinson_Hyperlegible({
  variable: "--font-main",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "MyHealthRoutine | Protótipo",
  description: "Protótipo interativo do MyHealthRoutine: apoio à gestão autônoma de medicamentos por pessoas da terceira idade.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#eef4f2",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className={atkinson.variable}>{children}</body>
    </html>
  );
}
