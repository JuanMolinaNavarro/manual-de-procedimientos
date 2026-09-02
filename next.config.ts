import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // La raíz del workspace es este repo: si hay otro package.json/lockfile en un
  // directorio padre (p. ej. en el Desktop), Turbopack lo tomaría como raíz y
  // dejaría de resolver las dependencias.
  turbopack: {
    root: path.resolve(__dirname),
  },
  // El middleware corre en todas las rutas y bufferea el body (cap 10mb por
  // defecto). Subimos el límite para permitir la carga del Excel del padrón.
  experimental: {
    proxyClientMaxBodySize: "60mb",
  },
};

export default nextConfig;
