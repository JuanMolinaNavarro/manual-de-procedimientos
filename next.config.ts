import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // El middleware (src/middleware.ts) corre sobre TODAS las rutas (matcher '/:path*'),
    // por lo que Next buffea el body de cada request y lo limita a 10MB por defecto.
    // La subida de facturas (POST /api/admin/facturas) manda varios PDFs juntos y
    // superaba ese limite, llegando truncado -> "Failed to parse body as FormData".
    // 100mb ≈ 160 facturas de ~600KB por subida.
    // OJO: `next start` lee este archivo en RUNTIME (no es build standalone), así
    // que el Dockerfile DEBE copiar next.config.ts a la etapa runner; si falta,
    // Next cae al default de 10MB. Tras cambiar el valor: rebuildear la imagen.
    middlewareClientMaxBodySize: '100mb',
  },
};

export default nextConfig;
