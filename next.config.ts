import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Voltar a uma tela vista há pouco é instantâneo; salvar algo limpa este cache (revalidatePath)
  experimental: { staleTimes: { dynamic: 60, static: 300 } },
};

export default nextConfig;
