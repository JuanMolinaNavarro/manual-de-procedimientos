import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // El middleware (src/middleware.ts) corre sobre TODAS las rutas (matcher '/:path*'),
    // por lo que Next buffea el body de cada request y lo limita a 10MB por defecto.
    // La subida de facturas (POST /api/admin/facturas) manda varios PDFs juntos y
    // superaba ese limite, llegando truncado -> "Failed to parse body as FormData".
    middlewareClientMaxBodySize: '50mb',
  },
};

export default nextConfig;
