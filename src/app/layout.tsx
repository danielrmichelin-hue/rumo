import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SCRIPT_TEMA } from "@/lib/tema";

export const metadata: Metadata = {
  title: { default: "Rumo", template: "%s · Rumo" },
  description: "Clareza para o seu próximo passo.",
  appleWebApp: { capable: true, title: "Rumo", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F8F7F4" },
    { media: "(prefers-color-scheme: dark)", color: "#120D1B" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        {/* Aplica o tema escolhido antes da primeira pintura */}
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
