import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Configuración para better-sqlite3 (módulo nativo)
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
