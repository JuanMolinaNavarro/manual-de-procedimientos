import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // El middleware corre en todas las rutas y bufferea el body (cap 10mb por
  // defecto). Subimos el límite para permitir la carga del Excel del padrón.
  experimental: {
    proxyClientMaxBodySize: "60mb",
  },
};

export default nextConfig;
