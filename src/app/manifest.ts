import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Rumo",
    short_name: "Rumo",
    description: "Clareza para o seu próximo passo.",
    start_url: "/hoje",
    display: "standalone",
    background_color: "#F8F7F4",
    theme_color: "#2B1E4B",
    lang: "pt-BR",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [{ name: "Capturar", url: "/hoje?capturar=1" }],
  };
}
