# Aurelius

Panel interno: manual de retención para agentes y módulos de administración (bonificaciones, organigrama,
asistencia con relojes Anviz, nómina, recibos de sueldo de Finnegans con firma desde el portal, proyectos,
señales IP, ventas, etc.).

Next.js 16 (App Router) + TypeScript + Prisma (PostgreSQL) + Tailwind v4 + shadcn/ui.

## Desarrollo

```bash
cp env.template .env.local   # completar DATABASE_URL, SITE_USER, SITE_PASSWORD, ...
npm install
npx prisma db push           # sincroniza el schema (no hay carpeta de migraciones)
npm run dev                  # http://localhost:3000
```

`npm test` corre los tests (lógica pura, sin base) y `npm run lint` el linter.

## Producción

`docker compose up -d --build` con un `.env` completo (ver `env.template`; `POSTGRES_PASSWORD` es obligatoria).

La arquitectura, las reglas de negocio y las decisiones de cada módulo están en [`CLAUDE.md`](CLAUDE.md).
