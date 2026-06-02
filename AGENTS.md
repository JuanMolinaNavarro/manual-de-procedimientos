# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start development server (localhost:3000)
npm run build     # Build for production
npm run start     # Start production server
npm run lint      # Run ESLint

npx prisma migrate dev   # Apply pending migrations and regenerate client
npx prisma generate      # Regenerate Prisma client after schema changes
npx prisma studio        # Open Prisma Studio (DB browser)
```

## Environment Variables

Required in `.env`:
```
DATABASE_URL=postgresql://...
SITE_USER=<admin username>
SITE_PASSWORD=<admin password>
LEADS_API_KEY=<secret key for external lead submissions>
```

`SITE_USER` / `SITE_PASSWORD` are used to auto-seed the first admin user when the `usuarios` table is empty.

`LEADS_API_KEY` is required by `POST /api/leads` — callers must send it as the `X-Api-Key` header.

## Architecture

**Next.js 16 App Router** with TypeScript, Tailwind CSS v4, Prisma ORM (PostgreSQL), and shadcn/ui components.

### Authentication & Authorization

Session is stored in a plain `site_session` HTTP-only cookie with the format `<usuario>|<rol>`. The middleware (`src/middleware.ts`) enforces:
- `/login` and `/api/login` are public.
- All other routes require a valid cookie.
- `/admin/*` and `/api/admin/*` require `rol === 'admin'`; others are redirected to `/retencion/inicio`.

Passwords are stored and compared in **plain text** — no hashing.

### Route Structure

- `/` → redirects to `/retencion/inicio`
- `/login` → unified login for both roles
- `/retencion/*` — the agent-facing manual with a sidebar layout (`src/app/retencion/layout.tsx`)
  - `inicio`, `primeros-pasos`, `continuacion` — general flow pages
  - `facturacion/`, `competencia/`, `personales/`, `tecnicos/` — retention motives
  - `facturacion/factura-mal-cargada`, `procedimiento-a`, `procedimiento-b` — sub-procedures
- `/admin/*` — admin panel (admin role required)
  - `bonificaciones/` — list, create (`nueva/`), edit (`[id]/editar/`)
  - `usuarios/` — list, edit (`[id]/editar/`)

### Data Layer

All DB access goes through `src/lib/` helpers that wrap Prisma:
- `src/lib/prisma.ts` — singleton Prisma client
- `src/lib/bonificaciones.ts` — CRUD + filtering by empresa and date validity
- `src/lib/empresas.ts` — `EMPRESAS` const array and `Empresa` type (the fixed list of companies)

**Bonificaciones** filtering: `getBonificacionesActivas()` filters by `activa: true` and checks `vigencia_desde`/`vigencia_hasta` against today's date (ISO string comparison).

### Prisma Schema Models

- `Bonificacion` — `id, empresa, titulo, descripcion, mensaje_sugerido, condiciones, activa, vigencia_desde, vigencia_hasta`
- `Usuario` — `id, usuario (unique), password, nombre, apellido, rol, isActive`

### Session State (Client)

The retention flow accumulates form data in `window.sessionStorage` under the key `retencion.caso` (see `src/lib/retencion-caso-session.ts`). `mergeRetencionCasoSessionData()` merges new values into existing storage.

### UI Components

shadcn/ui components live in `src/components/ui/`. Custom components (logout buttons, copy button, bonificaciones list, theme toggle, etc.) are in `src/components/`. The app supports light/dark theming via `ThemeToggle`.
