import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // La raíz del workspace es este repo: si hay otro package.json/lockfile en un
  // directorio padre (p. ej. en el Desktop), Turbopack lo tomaría como raíz y
  // dejaría de resolver las dependencias.
  turbopack: {
    root: path.resolve(__dirname),
  },
  // pdfjs-dist (lectura de la sábana de recibos de Finnegans) carga su worker con un
  // import dinámico: se deja fuera del bundle del server y se resuelve de node_modules.
  serverExternalPackages: ["pdfjs-dist"],
  // El middleware corre en todas las rutas y bufferea el body (cap 10mb por
  // defecto). Subimos el límite para permitir la carga del Excel del padrón.
  experimental: {
    proxyClientMaxBodySize: "60mb",
  },
  poweredByHeader: false,
  // Headers de seguridad para todo el sitio. Sin CSP de scripts (Next inyecta scripts inline;
  // haría falta nonce): solo frame-ancestors, que evita que otra página nos meta en un iframe.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
      // Las páginas. En /api no: el header de acá pisa al de la respuesta, y las rutas que sirven
      // archivos subidos mandan su propio CSP con `sandbox` (src/lib/archivos.ts).
      {
        source: "/((?!api/).*)",
        headers: [{ key: "Content-Security-Policy", value: "frame-ancestors 'self'" }],
      },
    ];
  },
};

export default nextConfig;
