import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Rumo", template: "%s · Rumo" },
  description: "Clareza para o seu próximo passo.",
  appleWebApp: { capable: true, title: "Rumo", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F8F7F4" },
    { media: "(prefers-color-scheme: dark)", color: "#141019" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
