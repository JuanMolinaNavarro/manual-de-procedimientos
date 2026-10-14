# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start development server (localhost:3000)
npm run build     # Build for production
npm run start     # Start production server
npm run lint      # Run ESLint

npx prisma db push       # Sync the schema to the DB (no migrations folder in this repo) and regenerate client
npx prisma generate      # Regenerate Prisma client after schema changes
npx prisma studio        # Open Prisma Studio (DB browser)

npm test                 # vitest: pure logic only (nómina calc/hash), no DB

# Solo DB de desarrollo (aborta si DATABASE_URL no es localhost:5544): carga las empresas del
# Excel de liquidaciones de Finnegans como organigramas + fichas + usuarios rol `empleado`.
npx tsx --env-file=.env.local scripts/cargar-empleados-finnegans.ts "<ruta.xlsx>"
```

## Environment Variables

Required in `.env`:
```
DATABASE_URL=postgresql://...
SITE_USER=<admin username>
SITE_PASSWORD=<admin password>
LEADS_API_KEY=<secret key for external lead submissions>
```

`SITE_USER` / `SITE_PASSWORD` are used to auto-seed the first user (rol **superadmin**, contraseña cifrada) when
the `usuarios` table is empty.

`LEADS_API_KEY` is required by `POST /api/leads` — callers must send it as the `X-Api-Key` header.

### Recibos de Finnegans (API Teamplace)

```
TEAMPLACE_CLIENT_ID / TEAMPLACE_CLIENT_SECRET   # keys API de Finnegans (las mismas que CentralSM)
FINNEGANS_RECIBO_XML=ReciboSueldosOficial.jrxml # opcional: modelo de recibo (sábana oficial)
FINNEGANS_RECIBO_DATASOURCE=F_GA_LIQ_0065       # opcional: su stored procedure
FINNEGANS_TOPE_MENSUAL=80                       # opcional: corte de llamadas pagas por mes
```
Opcionales avanzados: `TEAMPLACE_TOKEN_URL`, `TEAMPLACE_BASE_URL` (reportes, default `api.finneg.com`),
`TEAMPLACE_EXEC_URL` (report/execute, default `api.teamplace.finneg.com`). Los modelos de recibo
disponibles salen gratis de `GET /api/OperacionSubtipoDealsApi/LIQSUELDOS` (`ReporteItems`).

### Aviso por mail de recibos disponibles (SMTP de la empresa)

```
SMTP_HOST / SMTP_PORT / SMTP_SECURE=true|false  # sin SMTP_HOST → "modo prueba": los mails se guardan como
SMTP_USER / SMTP_PASS                           #   .eml en uploads/nomina/mails-prueba/ y NO se envían
MAIL_FROM="Recursos Humanos <rrhh@empresa>"     # remitente
APP_URL=https://aurelius.empresa                # base del enlace a Mis recibos (default http://localhost:3000)
```

### Operación y deploy (Docker)

```
POSTGRES_PASSWORD=...        # obligatoria para docker compose (arma la DATABASE_URL del app)
CRON_ENABLED=1               # opcional: 1 = crons también en desarrollo; 0 = apagados siempre (copias de prueba)
PRISMA_ACCEPT_DATA_LOSS=1    # SOLO para un arranque con cambios destructivos del schema ya revisados
```
`env.template` lista todas las variables. `docker-compose.yml` publica Postgres en el puerto 5432 del host a
propósito (decisión del usuario: se accede por ese puerto), el app corre con `NODE_ENV=production`, y el contenedor arranca como root solo
para pasar el volumen de uploads a `node` y se baja a ese usuario (`docker/entrypoint.sh`, `setpriv`).
**`db push` ya no usa `--accept-data-loss` por defecto:** si el schema nuevo borra o cambia columnas con datos, el
arranque falla (el contenedor reinicia en loop con el aviso en el log) en vez de borrar datos en silencio. Revisar
el cambio y, si es intencional, levantar una vez con `PRISMA_ACCEPT_DATA_LOSS=1` en el `.env` y después sacarlo.
El módulo de facturas y el worker de Python viven en otro repo (`facturas-finnegans`); acá no hay worker.

## Architecture

**Next.js 16 App Router** with TypeScript, Tailwind CSS v4, Prisma ORM (PostgreSQL), and shadcn/ui components.

### Authentication & Authorization

**Sesión en la base** (`src/lib/sesion.ts`): la cookie `site_session` (HTTP-only, 12 h) lleva solo un token aleatorio
de 32 bytes; en la tabla `Sesion` se guarda su sha256. Rol, estado y módulos se leen **siempre del `Usuario`** en cada
request (`getSesion()` en `admin-auth.ts`, memoizado por request); la cookie no afirma nada. (Hasta 2026-09 la cookie
era `usuario|rol` en texto plano y se podía escribir a mano para ser superadmin.) Cerrar sesión revoca la fila; cambiar
usuario, contraseña, rol o estado desde Usuarios revoca todas las del usuario; un usuario inactivo no tiene sesión.
Para probar en desarrollo hay que loguearse de verdad (`POST /api/login`), ya no sirve escribir la cookie.

El **proxy** (`src/proxy.ts`, ex `middleware.ts`; en Next 16 corre en Node y puede leer la base) es el control central:
- `/login`, `/api/login`, `/api/on-demand`, `/api/sports`, `/api/leads` y las lecturas de `/api/plans` y de
  `/api/bonificaciones` (solo activas, con CORS) son públicas.
- Roles: `admin`, `superadmin`, `empleado`, `ventas` (`ROLES` / `rolValido` en `roles.ts`). El rol `agente` se retiró con el
  manual de retención: un usuario viejo con ese rol no puede loguearse y el proxy le revoca la sesión.
- Todo lo demás exige una sesión vigente (401 en APIs, redirect a `/login?from=` en páginas).
- **Rol `empleado`** (portal personal): NO es admin (`isAdminRole` lo excluye). Solo pasa por la lista blanca
  `rutaPermitidaEmpleado` (`src/lib/roles.ts`: `/admin`, Mi asistencia, Mis recibos, Mis vacaciones, sus APIs, `/api/me` y la foto de
  su propia ficha); cualquier otra página redirige a `/admin` y cualquier otra API da 403. Sus módulos son fijos
  (`modulosEfectivos` → `EMPLEADO_MODULOS`). Las rutas personales usan `handleSesion()` y toman la ficha SOLO de
  `getUsuarioSesion()`.
- **Rol `ventas`** (decisión del usuario 2026-09-30): solo **Leads y Padrón** (`VENTAS_MODULOS`, fijos: lo guardado en
  `modulos` no cuenta). NO es admin: `puedeUsarApi` / `puedeVerPagina` lo dejan pasar solo por las rutas de esos dos
  módulos y el inicio `/admin` (las reglas de "cualquier admin", como el portal personal o las fotos, no le aplican).
  Las rutas de Leads y Padrón chequean `puedeUsarModulo(slug)`, no `isAdmin()`. No ve el banner de cumpleaños.
- `/admin/*` y `/api/admin/*`: rol admin/superadmin **y el módulo que habilita la ruta** (`src/lib/permisos-rutas.ts`:
  `REGLAS_API` por prefijo, gana el más largo; `lectura` suma módulos que solo pueden hacer GET, p. ej. el organigrama
  lee horarios y abre recibos). Una ruta sin regla es solo del superadmin; `permisos-rutas.test.ts` recorre
  `src/app/api/admin/**` y falla si una ruta nueva no tiene regla. Páginas: `puedeVerPagina` (mismo criterio que
  `AdminModuleGuard`). Las escrituras de `/api/bonificaciones` y `/api/plans` también piden su módulo.
- Escrituras con `Sec-Fetch-Site: cross-site|same-site` → 403 (CSRF; otra app en la misma IP es "same-site").
- Cada ruta vuelve a chequear sesión/rol (`isAdmin()`, `handle()`, `handleAdmin()` de `src/lib/api-admin.ts`).
- `modulosEfectivos` nunca devuelve `[]` para un admin restringido (`[]` = todos): si solo tenía `usuarios`, queda con
  la marca `__ninguno__`.

- **Gestión de usuarios** (decisión del usuario, `roles.ts`): el módulo `usuarios` (`/admin/usuarios/**` y
  `/api/admin/usuarios/**`) es **solo del superadmin** (`puedeGestionarUsuarios`; layout de servidor + 403 en la API;
  `modulosEfectivos` saca `usuarios` a todo no-superadmin), evaluado con el **rol de la base**
  (`puedeGestionarUsuariosSesion` en `admin-auth.ts`). **El superadmin puede todo lo demás**, también adherir y revocar
  adhesiones y subir o quitar actas (decisión del usuario 2026-10-13: hasta entonces no podía, por separación de
  funciones). A cambio, **todo queda en la tabla `auditoria`** (`src/lib/auditoria.ts`, `auditar` dentro de la misma
  transacción; solo se agregan filas): alta de usuario, cambio de contraseña/usuario/rol/estado, adhesión, revocación,
  acta subida/quitada y cambio de PIN, con actor, IP y detalle (nunca la contraseña ni el PIN). El acta impresa dice
  quién registró la adhesión. El primer usuario de una instalación nueva (`SITE_USER`) se crea **superadmin**.

**Contraseñas** (`src/lib/password.ts`): PBKDF2-SHA256 async (`pbkdf2$600000$sal$hash`, `hashSecreto`, el mismo que el
PIN; decisión del usuario 2026-10-09: scrypt pedía ~32 MB por login), mínimo 8 caracteres. Las filas viejas en texto plano
o en `scrypt$N$r$p$sal$hash` se aceptan y se re-hashean a PBKDF2 en ese login. La API de usuarios nunca
devuelve `password` (`SELECT_USUARIO` en `usuarios-select.ts`); en la edición, contraseña vacía = no cambiarla.
**Freno de fuerza bruta** (`login-limite.ts`): 10 fallos seguidos bloquean al usuario 15 min (en la base,
`login_fallos` / `login_bloqueado_hasta`) y 30 fallos por IP en 15 min dan 429 (en memoria). La IP sale de
`x-real-ip` o de la **última** de `x-forwarded-for` (`ipCliente`, también usada en la constancia de firma).
**Adhesiones**: adherir, revocar y subir/quitar el acta: admin con Gestión de recibos o superadmin, registrado en
`auditoria`. **Archivos subidos** (`src/lib/archivos.ts`, `headersArchivo`): el tipo sale de la extensión guardada
(nunca del `file.type` del navegador), la extensión de imágenes la decide el servidor (`EXT_POR_MIME_IMAGEN`), se
sirven con `nosniff` y CSP `sandbox` (salvo PDF) y solo PDF/imágenes/texto van inline. `next.config.ts` agrega
headers de seguridad y `poweredByHeader: false`.

### Route Structure

- `/` → redirects to `/admin`
- `/login` → unified login (admin, superadmin, empleado)
- **El manual de retención ya no vive acá** (2026-09-28): se separó al proyecto `manual-retencion` (Next sin login ni
  base, en el escritorio del usuario). Lee las bonificaciones activas de `GET /api/bonificaciones` de este panel, que
  por eso es público y con CORS; se cargan y editan en `/admin/bonificaciones`.
- `/admin/*` — admin panel (admin role required)
  - `bonificaciones/` — list, create (`nueva/`), edit (`[id]/editar/`)
  - `usuarios/` — list, edit (`[id]/editar/`)
  - `proyectos/` — proyectos y finanzas: list, detail with 4 tabs (`[id]/`)

### Data Layer

All DB access goes through `src/lib/` helpers that wrap Prisma:
- `src/lib/prisma.ts` — singleton Prisma client
- `src/lib/bonificaciones.ts` — CRUD + filtering by empresa and date validity
- `src/lib/empresas.ts` — `EMPRESAS` const array and `Empresa` type (the fixed list of companies)

**Bonificaciones** filtering: `getBonificacionesActivas()` filters by `activa: true` and checks `vigencia_desde`/`vigencia_hasta` against today's date (ISO string comparison).

### Prisma Schema Models

- `Bonificacion` — `id, empresa, titulo, descripcion, mensaje_sugerido, condiciones, activa, vigencia_desde, vigencia_hasta`
- `Usuario` — `id, usuario (unique), password (PBKDF2), nombre, apellido, rol, isActive, modulos, modulos_edit, empleado_id, login_fallos, login_bloqueado_hasta`
- `Sesion` — `id (sha256 del token de la cookie), usuario_id, expira, revocada, ip, user_agent`
- `Auditoria` — `id, fecha, actor, accion, usuario_id, empleado_id, detalle, ip` (quién cambió accesos, adhesiones y PINs)
- `Proyecto` — `id, nombre, descripcion, responsable, responsable_id (→ OrgEmpleado), estado, fecha_inicio, notas, ingreso_estimado, otros_ingresos, moneda_ingreso, anio_ingreso`
- `ProyectoCosto` — `id, proyecto_id, categoria, concepto, unidad, cantidad, costo_unitario, moneda, etapa_id, orden`
- `ProyectoEtapa` — `id, proyecto_id, nombre, responsable, responsable_id (→ OrgEmpleado), fecha_inicio, duracion_dias, dep_id (self-rel), estado, avance, orden`
- `ProyectoConfig` — singleton `id = 1`: `fx_ars, infl_usd, anio_base`

### Proyectos y finanzas

Módulo genérico de gestión de proyectos (`/admin/proyectos`, slug `proyectos`): cronograma tipo
Gantt, costos y análisis financiero. Portado del prototipo HTML "La Cocha" pero **sin el dominio
agropecuario**: no hay cultivos, lotes, hectáreas ni modelo climático.

- `src/lib/proyectos-datos.ts` — constantes puras: estados de proyecto y de etapa, plantillas de
  cronograma, categorías sugeridas de costo y los textos de ayuda de los iconos "i".
- `src/lib/proyectos-calc.ts` — funciones puras compartidas cliente ↔ servidor: modelo financiero
  (USD constantes, margen, ROI, ingreso de equilibrio), agregados de costo y helpers de fecha ISO.
- `src/lib/proyectos.ts` — Prisma CRUD.

Detalles de negocio:
- **USD constantes:** todo se normaliza a USD. Los montos en ARS se convierten con `fx_ars`; el
  ingreso se deflacta desde `anio_ingreso` al `anio_base` con `infl_usd` para poder compararlo
  contra el costo de hoy con la misma vara.
- **Ingreso de equilibrio:** el costo vive en el año base, así que para el breakeven se **infla**
  (`inflar`) hasta `anio_ingreso` — no se compara un costo de hoy contra un ingreso de dentro de
  tres años sin ajustar.
- **Costo de una línea:** `cantidad × costo_unitario`, convertido por `moneda`. Sin factores de
  superficie ni de unidad productiva.
- **Cronograma en cascada:** cada etapa tiene `dep_id`; mover una arrastra a sus dependientes
  (`correrEnCascada`). Cambiar `fecha_inicio` del proyecto corre el cronograma completo.
- **Avance:** cada etapa tiene `avance` 0–100. El avance del proyecto es el promedio ponderado por
  `duracion_dias` (`avanceProyecto`), no el conteo de etapas hechas. Marcar una etapa como `hecho`
  la lleva a 100% y `pendiente` la vuelve a 0 salvo que se mande un `avance` explícito.
- **Imputación de costos:** `ProyectoCosto.categoria` es el rubro libre por el que se agrupa la
  tabla; `etapa_id` es la imputación opcional a una etapa del Gantt. Ambos alimentan el desglose
  del Resumen (`costoPorCategoria` / `costoPorEtapa`). Borrar una etapa desimputa sus costos
  (`onDelete: SetNull`), no los borra.

**Vínculo con el organigrama:** `Proyecto.responsable_id` y `ProyectoEtapa.responsable_id` apuntan
a `OrgEmpleado`. El texto libre `responsable` queda como respaldo para gente que no está en el
organigrama; el campo derivado `responsable_nombre` resuelve la precedencia (empleado vinculado →
su nombre actual; si no, el texto). `getProyectosDeEmpleado()` hace la consulta inversa —
proyectos a cargo + proyectos donde tiene alguna etapa asignada — y la expone en
`GET /api/admin/organigrama/empleados/[id]/proyectos`, que alimenta la pestaña **Proyectos** de la
ficha. Ese fetch vive en `FichaModal` (no en la pestaña) porque su resultado decide si la pestaña
se muestra: en modo lectura las pestañas vacías se ocultan.

Las 4 pestañas del detalle: **Resumen** (KPIs, alertas de etapas vencidas, distribución de costos,
próximas etapas, notas), **Cronograma** (Gantt con escala mensual, línea de hoy, editor con
corrimiento en cascada), **Costos** (tabla editable agrupada por categoría) y **Análisis
financiero** (supuestos de ingreso + KPIs + lectura en criollo).

Permisos: `isAdmin()` tanto para leer como para escribir, igual que `bonificaciones` / `senales-ip`
/ `leads` / `planes`. **No** usa el candado `modulos_edit` (eso lo hace solo `organigrama`): la UI de
usuarios expone un único switch hardcodeado para ese slug, así que gatear `proyectos` ahí lo dejaría
sin forma de otorgarse. Si más adelante se quiere separar ver/editar, hay que generalizar primero
ese switch en `/admin/usuarios/[id]/editar`.

### Organigrama: quitar a alguien no borra nada

Decisión del usuario 2026-09-30: una ficha **nunca se borra** desde el organigrama. «Quitar del organigrama»
(`DELETE .../empleados/[id]` → `ocultarEmpleado`) pone `OrgEmpleado.oculto_en` y `estado = 'inactive'`, y desengancha a
sus subordinados (`manager_id`) y las áreas que encabezaba (`jefe_id`). Documentos, licencias, nómina, recibos,
asistencia y usuario quedan intactos. Solo `getOrganigramaCompleto` (el lienzo) filtra a los ocultos y sus líneas
especiales; el resto de los módulos los sigue viendo como inactivos. Se listan en «Ocultos (N)» de la barra y
`PATCH { oculto: false }` (`restaurarEmpleado`) los devuelve activos. El botón «Reiniciar» (borraba todos los
organigramas) se **eliminó** por riesgo: `POST .../seed` solo carga la empresa de ejemplo si no hay ninguna, sin `reset`.

**Transferir a otro organigrama** (botón «Transferir» en la edición de la ficha; `PATCH .../empleados/[id]
{ organigrama_id, area }` → `transferirEmpleado`): la ficha cambia de `organigrama_id` con todo lo suyo (documentos,
nómina, recibos y asistencia cuelgan del empleado). Jefe y áreas son del organigrama de origen: queda sin jefe y con un
área del destino (o sin área), y sus subordinados y las áreas que encabezaba quedan sin jefe. Las líneas especiales
quedan en el origen y no se dibujan (el lienzo filtra por las fichas presentes).

**Asistencia pendiente** (botón de la barra, solo con `canEdit`; `GET .../organigrama/pendientes-asistencia` →
`getPendientesAsistencia`, `?organigramaId=`): fichas activas y visibles **del organigrama elegido** sin persona del reloj
vinculada y/o sin versión de horario vigente hoy o a futuro; el botón no aparece si no falta nadie. Un horario con
`incluir = false` cuenta como configurado. Solo informa: se completa en Asistencia › Personas.

### Organigrama: convenio

`OrgEmpleado.convenio` (texto libre, p. ej. `Satsaid 223/75 · GRUPO 3` o `Fuera de Convenio`) **no es el puesto**
(`rol`): decisión del usuario 2026-09-29. Solo lo ve quien puede editar el organigrama (`canEditModule('organigrama')`):
las lecturas (`GET /api/admin/organigrama`, `.../empleados`, `.../empleados/[id]`) lo mandan en null al resto
(`ocultarConvenio`) y `FichaModal` muestra el campo solo con `canEdit`. La carga de Finnegans lo llena con convenio +
categoría; como Finnegans no trae el puesto, una ficha nueva queda `Sin rol` y una existente conserva el suyo.

### Organigrama: fecha de ingreso

La ficha muestra y edita la **fecha de ingreso**, pero no es columna de `OrgEmpleado`: es `NominaEmpleado.fecha_ingreso`
(Nómina › Maestro), la misma que cargan Finnegans y usan Asistencia y Vacaciones, así no hay dos fechas que se
desincronicen. `organigrama.ts` la trae con `CON_INGRESO` y `mapEmpleado` la expone como `fecha_ingreso`; guardarla
desde la ficha crea la fila del Maestro si no existía (con `incluir` según el estado, el mismo criterio que usa Nómina
cuando falta la fila) y borrarla no crea una fila vacía. Las rutas validan un día real (`fechaIngresoValida`, 400).

### Organigrama: licencias de software (pestaña "Licencias" de la ficha)

`OrgLicencia` (ícono + título + cuenta, con contraseña, costo/moneda/periodicidad opcionales). Es el
**único recurso del organigrama donde la lectura también exige `canEditModule('organigrama')`**
(superadmin o admin con el switch "Puede editar el organigrama"): las rutas
`/api/admin/organigrama/empleados/[id]/licencias` y `/api/admin/organigrama/licencias/[id]{,/icono}`
devuelven 403 al resto, y `FichaModal` ni muestra la pestaña ni hace el fetch sin `canEdit`.

- **Ícono:** con `sitio_url` el servidor baja el favicon una sola vez (`src/lib/favicon.ts`, Google
  s2 → DuckDuckGo, timeout 8 s, ≤1 MB) y lo guarda en `uploads/organigrama/licencias/` con
  `icono_origen = 'favicon'`. Una imagen subida a mano queda como `'subido'` y **no se pisa** al
  cambiar la URL; solo `quitar_icono` o subir otra la reemplazan. Sin favicon disponible la licencia
  se guarda igual, sin ícono. Reglas y parseo del multipart en `src/lib/licencias-icono.ts`.
- **Contraseña en texto plano** (a diferencia de `Usuario.password`, que ya se hashea): tiene que poder leerse desde la UI (botón
  de ojo). Si se quiere cifrar en reposo hay que agregar clave en `.env` y un helper AES.
- Al borrar un empleado, `empleados/[id]/route.ts` desvincula los íconos a mano (la fila cascadea).

### Nómina (liquidación de sueldos y recibos digitales)

Porte del prototipo "PayRoll Assistant" (HTML autónomo). Cada pestaña del prototipo es un **módulo
propio** dentro de la categoría RRHH, con su slug/permiso: `nomina-tablero`, `nomina-maestro`,
`nomina-novedades`, `nomina-liquidacion`, `nomina-historico`, `nomina-parametros`
(`/admin/nomina/<tab>`; `/admin/nomina` redirige al primero permitido). **Desde 2026-10-06 no figuran en los menús**
(inicio ni lateral): `getModulosParaMenu` en `modulos.ts` los filtra (decisión del usuario: el motor propio es simulación
y confundía al lado de Gestión de recibos); el permiso sigue vigente y se entra por la URL. Permisos como `proyectos`:
`isAdmin()` para leer y escribir, sin `modulos_edit`. **Los recibos ya no son una pestaña de Nómina**: son dos
módulos propios, **Gestión de recibos** y **Mis recibos** (ver "Recibos de Finnegans"). El slug viejo
`nomina-recibos` guardado en `Usuario.modulos` se lee como `gestion-recibos` (`SLUGS_RENOMBRADOS` en `modulos.ts`) y
`/admin/nomina/recibos` redirige. El recibo imprimible del cálculo propio quedó en `/admin/nomina/imprimir`.

- `src/lib/nomina-datos.ts` — constantes y tipos (defaults del régimen general, `PARAM_META`,
  `RUBROS_EMPLEADOR` del Anexo III, columnas de novedades, `PIN_RE`, `PERIODO_RE`).
- `src/lib/nomina-calc.ts` — motor puro (`liquidarEmpleado`), `numeroALetras`, `reciboPayload`
  (contenido canónico, version `anexoIII-1`), `canonicalJson`, ranking de bonos, CSV.
- `src/lib/nomina-hash.ts` — solo servidor: `sha256`, `pinHash`, `reciboHash`, `chainHash`,
  `verificarCadena`. Tests en `src/lib/nomina-*.test.ts` (`npm test`).
- `src/lib/nomina.ts` — Prisma + operaciones (`NominaError` con status HTTP). Rutas en
  `src/app/api/admin/nomina/**` con el wrapper `handle()` de `src/lib/nomina-api.ts`.
- UI en `src/components/nomina/`: `NominaContext` (empresa + período persistidos en localStorage
  vía `useSyncExternalStore`, `refrescar()` invalida todos los `useNominaData`), `NominaBar`,
  páginas, `ReciboAnexoIII`, impresión.

Reglas de negocio:
- **El motor propio se escopea por organigrama** (`organigrama_id`): empleador de Parámetros, parámetros,
  conceptos, bonos y cierres. **Los recibos de Finnegans, adhesiones y constancias NO** (son de la persona y del
  empleador de Finnegans, ver "Recibos de Finnegans"): la barra, el histórico y la liquidación cuentan las firmas y
  adhesiones de las fichas que están hoy en el organigrama (`deFichasDe`). Los empleados son las fichas de `OrgEmpleado`
  de ese organigrama; nombre/rol/área/foto se leen de ahí (solo lectura en el Maestro). Los datos de
  nómina viven en `NominaEmpleado` (1:1, Cascade) y `NominaNovedad` (por período).
- **El motor propio es simulación y control**: el recibo legal es el PDF de Finnegans (ver "Recibos de
  Finnegans"). Su recibo calculado **ya no se firma** (se retiró `firmarKiosco`, `KioscoOverlay` y los
  "Firmar acá" de Liquidación/Detalle).
- **Cierre** (`NominaCierre` + `NominaLiquidacion`): snapshot inmutable de params, empleador, maestro
  y liquidación por empleado, con `hash = sha256(canonicalJson(reciboPayload))`. Se hashea JSON
  canónico (claves ordenadas) porque `jsonb` no conserva el orden; `fecha_cierre` es String ISO y
  entra en el hash. Cerrar se bloquea con flags de error. **Reabrir** borra el cierre (cascade a
  liquidaciones); las firmas de los recibos PDF no dependen del cierre y no se tocan.
- Liquidaciones, adhesiones, constancias y recibos PDF son `Restrict` sobre `OrgEmpleado` (red de seguridad en la base;
  desde la app ya no hay ningún camino que borre una ficha).

### Asistencia (relojes biométricos Anviz)

Fichadas de los relojes **Anviz** (software de escritorio *CrossChex Standard*) dentro del panel, módulo
`asistencia` en la categoría RRHH (`/admin/asistencia`). Permisos como `proyectos`: `isAdmin()` para leer y
escribir, sin `modulos_edit`.

- **Fuente primaria: los relojes por TCP** (protocolo **Anviz TC-B v2.15**, puerto 5010). Cliente propio en
  `src/lib/anviz-tcb.ts` (CRC16 0x8408/init 0xFFFF, armado/parseo de tramas y `ClienteAnviz` sobre `node:net`;
  tests con tramas reales del log en `src/lib/anviz-tcb.test.ts`). Comandos: `0x30` info, `0x3C` contadores,
  `0x40` bajar registros (param 1 todos / 2 nuevos / 0 continuar, 25 por trama), `0x4E` limpiar la marca de "nuevos".
- **Respaldo/histórico: importar la base de CrossChex (`.mdb`)** desde la pestaña Relojes. Se parsea con
  `mdb-reader` (JavaScript puro, corre en Linux). **La base real NO es la de `Program Files`** (esa queda vacía);
  CrossChex usa la que tenga configurada en `Att.ini` (`DBConnection` ofuscado) — en esta instalación era
  `C:\Users\Olart\Downloads\CrossChexTodos.mdb`. Se puede copiar aunque CrossChex esté abierto. Las columnas del
  `.mdb` varían la capitalización entre tablas (`Checkinout.userid` en minúscula, `Userinfo.Userid` con mayúscula):
  el lector normaliza las claves a minúscula.
- **Regla de `limpiar_nuevos` (por reloj, default apagado):** mientras CrossChex siga descargando, NO borramos la
  marca de "nuevos" en el reloj (si la borramos, CrossChex no ve más esos registros). Bajamos los "nuevos" en cada
  pasada y deduplicamos por `@@unique([reloj_id, user_id, fecha_hora])` **y además** por `(user_id, fecha_hora)` en
  cualquier reloj (`sinRepetidas`: la misma marca podía llegar por el .mdb con otro Sensorid y por TCP). Encender el
  switch solo cuando CrossChex se retire. Con el switch prendido, la marca se limpia **solo si se bajaron todos los
  nuevos** (`bajados >= registrosNuevos`); un `RET.FAIL` a mitad de la bajada es error (en el primer pedido = vacío).
- **Zona horaria:** los relojes trabajan en hora local de Argentina (-03:00, sin DST). La bajada directa
  (`fechaReloj`) y la importación guardan `fecha_hora` como instante real (UTC) y `fecha` como día local
  `yyyy-mm-dd`. Mismo cálculo en ambos caminos, así la dedup funciona entre orígenes `reloj` y `crosschex`.
- **Época del protocolo (`EPOCA_RELOJ_MS`):** el offset 0 de segundos de TC-B es **`2000-01-02` 00:00:00 hora
  local**, no `2000-01-01` — exactamente 86.400 s de diferencia. Verificado cruzando los segundos crudos que
  devuelve el comando `0x38` contra los registros del `.mdb` de CrossChex. Con la época de 2000-01-01 toda
  fichada quedaba un día atrás (un lunes se guardaba como domingo). No "corregir" esta constante sin volver
  a hacer ese cruce.
- **Relojes inactivos:** el cron filtra `where: { activo: true }`. La importación del `.mdb` da de alta los
  relojes que encuentra, y quedan sin activar a propósito: hay que prenderles el switch **Activo** en la
  pestaña Relojes a medida que se verifique que responden por LAN/VPN. Si no se sincroniza nada, mirar esto
  primero.
- **El cron vive en el proceso Node, no en el bundle:** `instrumentation.ts` corre una sola vez al arrancar y
  el Hot Reload de Next **no** lo recarga. Después de tocarlo (o de tocar algo que use, como `anviz-tcb.ts`),
  reiniciar `npm run dev` o el contenedor; si no, sigue corriendo el código viejo en memoria.
- **Sync automático:** cron cada 10 min en `src/instrumentation.ts` (`sincronizarTodos('nuevos')`, candado en
  memoria `isSyncAsistenciaRunning`). Un error de un reloj no frena a los demás; queda en `ultimo_error`. **Los crons
  solo corren en producción** (o con `CRON_ENABLED=1`): en `npm run dev` pegaban contra los relojes reales y competían
  con el sync de producción por la única conexión TCP del reloj.
- **Personas:** `AsistenciaPersona.user_id` = ID en el reloj (casi siempre el DNI); el nombre del reloj viene
  truncado a 10 caracteres. Vínculo a `OrgEmpleado` manual o automático por CUIL (`vincularPorCuil`: DNI = dígitos
  3-10 del CUIL del maestro de nómina). Si está vinculada, se muestra el nombre del organigrama. **Una ficha tiene un
  solo legajo**: `vincularPersona` devuelve 409 si la ficha ya está vinculada a otra persona, `vincularPorCuil` saltea
  las fichas ocupadas y los selectores (Personas, perfil) solo ofrecen fichas libres. Para cambiar de legajo hay que
  desvincular primero. (El calendario sigue uniendo los `user_id` de una ficha por si quedara algún caso viejo.)
- **Persona activa/inactiva** (`personaActiva` en `asistencia-datos.ts`): una sola fuente de verdad por caso. Vinculada
  → manda `OrgEmpleado.estado` (`active`/`inactive`) y el switch de Asistencia cambia **eso**; sin vincular → manda
  `AsistenciaPersona.activo`. Inactiva no borra nada: solo sale de las listas por defecto y de Día/Mes. **El cambio es
  siempre manual** (switch de Personas): no hay archivado por silencio ni reactivación por fichada. Hubo un cron de
  archivado a los 60 días con reactivación automática y se sacó porque pisaba bajas hechas a mano; si se vuelve a
  automatizar, tiene que ser con otro enfoque que no toque `activo` a espaldas del usuario.
- **Tramas no solicitadas:** los relojes **empujan** tramas por el socket sin que se las pidan — al menos `0x5F`
  con la fichada que alguien acaba de marcar (14 bytes, mismo layout que un registro del `0x40`). `ClienteAnviz`
  descarta toda trama cuyo `cmd` no sea el del comando pendiente (`esRespuestaA`); antes se tomaba como respuesta y
  los contadores llegaban "cortos (14 bytes)" cada vez que alguien fichaba durante el sync.
- **Un cliente TCP por vez:** el reloj acepta la conexión pero **no contesta** si otro cliente (CrossChex, otra
  pasada del sync) lo tiene tomado. Se ve como timeout intermitente; se cura solo en la pasada siguiente. Mientras
  CrossChex siga sondeando, esperar timeouts sueltos. Entre nosotros no se cruzan: `relojesEnUso` (en memoria, un solo
  proceso) hace que "Probar"/"Sincronizar" manual y el cron no abran dos conexiones al mismo reloj (409 / el cron lo
  saltea sin marcar error). `extraerTramas` descarta un `0xA5` con un largo mayor a `MAX_DATOS_TRAMA` y se
  resincroniza. `ultimo_ok` = último sync **sin error** (`ultimo_sync` se actualiza también al fallar).
- **Reimportar el `.mdb`** no pisa nombre ni IP de un reloj que ya existe (pueden estar corregidos a mano). Tope del
  archivo 55 MB (el proxy corta el cuerpo en 60).
- **Relojes duplicados del `.mdb`:** CrossChex puede re-registrar el mismo reloj físico con otro ClientNumber (caso
  AN id 12 → AN 2 id 15, misma IP). El reloj responde solo con el ID nuevo. El viejo se **desactiva, no se borra**:
  borrarlo se lleva su histórico en cascada.
- Modelos Prisma: `AsistenciaReloj` (`device_id` = ClientNumber, único), `AsistenciaPersona`, `AsistenciaFichada`
  (`tipo` 0 entrada / 1 salida / 2 descanso / 3 horas extra; `origen` `reloj` | `crosschex`). API en
  `src/app/api/admin/asistencia/**` con el wrapper `handle()` de `src/lib/asistencia-api.ts`. UI en
  `src/components/asistencia/` (ver "vistas Día y Mes").

### Asistencia: vistas Día y Mes (lo que revisa RR.HH.)

Rediseño 2026-10-07 (decisión del usuario; diseño en el lienzo «Rediseño Asistencia»): RR.HH. (35–45 años) tiene que
ver rápido llegadas tarde, horas extra, horas trabajadas y tardanzas compensadas. Mobile primero: letra de 16 px y
controles de 44 px (`Etiqueta`, `NavPeriodo`, `SelectorLugar`, `Buscador`, `BarraHoras` en `piezas.tsx`;
`EmpleadoCell grande`). La búsqueda sin tildes es `sinTildes` de `src/lib/utils.ts` (también la usan Organigrama y
Gestión de recibos).
El color nunca va solo: cada estado lleva su palabra.

- `/admin/asistencia` abre en **Día** (`?tab=dia`, default; `?fecha=` default hoy) con **Mes** al lado (`?tab=mes&mes=`).
  Calendario, Fichadas, Personas y Relojes quedan como **herramientas** en el menú «Más» (siguen en `?tab=`). El viejo
  Resumen (KPIs de fichadas, actividad por día) **se retiró** con su API (`/resumen`, `armarResumen`); los relojes con
  error se ven en el encabezado y los legajos sin vincular en Personas.
- **Lugar** = organigrama de la ficha (`?lugar=`, lo comparten Día y Mes; se filtra en el cliente). Solo personas
  activas con horario (las filas de `calendarioRango(…, false)`).
- Servidor `src/lib/asistencia-tablero.ts` (`tableroDia`, `tableroMes`; rutas `GET dia?fecha=` y `GET mes?mes=`); lectura
  pura en `src/lib/asistencia-tablero-calc.ts` (testeada): `grupoDelDia` (a horario / tarde / tarde grave / sin
  entrada / todavía no fichó / entra más tarde / faltó), `pendienteDeRevisar`, `resumenMesPersona`, `compensada`
  (llegó tarde y ese día se quedó después de hora **al menos** lo mismo: `extra.compensado >= tardanza`, el mismo
  criterio que la «recuperada» de Mi asistencia) y `explicarDia` (el cálculo en frases, sin tolerancia).
- **Día**: cuántos ficharon de los esperados (umbral de grave = `AsistenciaConfig.tarde_grave_min`), lo que quedó para
  revisar del **último día anterior con jornada de cada persona** (`PersonaDia.anterior`, hasta 3 días atrás: el lunes
  mira el viernes; es por persona porque con sábados alternos el lunes de quien no trabajó el sábado tiene que mirar
  el viernes; los feriados detectados no tienen jornada), y las listas «Llegaron tarde» (por minutos) y «Todavía no
  ficharon» / «No vinieron». Pasar de Día a Mes abre el mes del día que se estaba mirando.
- **Mes**: sin KPIs arriba (el usuario los sacó del diseño); celular = una tarjeta por persona, `lg` = tabla con
  horas trabajadas/esperadas, llegadas tarde, compensadas, tiempo tarde, extra 50 % y 100 %, faltas y días sin marca.
  Orden: más llegadas tarde (default), más horas extra, menos horas.

### Asistencia: calendario y horarios (versionados)

Pestaña **Calendario** (`/admin/asistencia?tab=calendario`): una fila por persona, una celda por día con el
estado **derivado** (a horario / tarde / tarde grave / ausente / trabajó en día no laborable / no laborable /
sin horario / pendiente / futuro). Los horarios se **editan solo en Asistencia › Personas** (botón «Editar»
de la columna Horario, `HorarioDialog`); la ficha del organigrama los muestra en solo lectura
(`HorarioDelEmpleado`, pestaña Resumen). Permisos: `isAdmin()` para todo, como el resto del módulo.

- `src/lib/asistencia-calendario.ts` — lógica pura (client + server, testeada): ciclo de semanas, versión
  vigente, `evaluarDia`, `armarCalendario`, `validarHorarioInput`, `describirHorario`. Servidor en
  `src/lib/asistencia-horarios.ts` (Prisma). Rutas: `calendario`, `horarios`, `horarios/[id]`, `config`.
- **Versiones con vigencia (`AsistenciaHorario`)**: una fila por versión, `vigente_desde`/`vigente_hasta`
  (inclusive, null = abierta), **una por empleado del organigrama** (`empleado_id`, Cascade). El estado de un
  día **nunca se guarda**: se calcula con las fichadas + la versión vigente ese día + `AsistenciaConfig`.
  Cambiar un horario no deja nada desactualizado.
- **"Aplicar desde"** (`guardarVersionHorario`): si la fecha es posterior al inicio de la última versión, la
  cierra el día anterior y crea una nueva; si coincide, corrige en el lugar; si es anterior, 400 (primero
  deshacer). `DELETE horarios/[id]` solo borra la **última** y reabre la anterior si esta la había cerrado.
  `versionEsperadaId` (última que vio el editor; null = ninguna) → 409 si otro admin guardó en el medio;
  `undefined` no verifica (seed, migración). `@@unique([empleado_id, vigente_desde])` atrapa el doble submit.
- **Ciclo de semanas ("sábados de por medio")**: `ciclo_semanas` 1..4 + `ciclo_ancla` (se normaliza al
  **lunes**). `semanaDelCiclo` = semanas enteras desde el ancla, módulo positivo; **nunca semanas ISO**.
  `dias` Json: `{ "0": { semanas:[0,1], entrada:"08:00", salida:"17:00" }, ... }` con **0 = lunes … 6 =
  domingo** (no el `getDay()` de JS). Día ausente = no laborable; con ciclo 1 `semanas` es `[0]`.
- **Estados**: `fecha > hoy` → `futuro` (con la jornada planificada para dibujar el plan, sin estado); sin
  versión / `incluir=false` / antes de `NominaEmpleado.fecha_ingreso` → `sin_horario` (nunca ausente ni
  tardanza: regla "sin números inventados"); hoy sin marcas → `pendiente`; `sinSalida` no aplica a hoy.
  Entrada = primera marca tipo 0 (fallback: primera no-salida; si todas son de salida y hay **dos o más**, la primera
  — botón equivocado al llegar —, con `entradaInferida`); salida = última tipo 1, nunca inventada (`resumirFichadas`,
  compartido con la vista por día de Fichadas). Una **única** marca de salida no es entrada: el día queda
  **`sin_entrada`** («vino, pero no se sabe a qué hora entró»: sin tardanza ni ausencia, a verificar;
  `resumenLiquidacion.sinEntrada`). En 2026 ~7 % de los días-persona tenían una sola marca de salida y daban
  «tarde grave» de horas. Los minutos tarde de los totales cuentan solo días `tarde`/`tarde_grave` (como el perfil).
- **Tolerancia**: por versión (`tolerancia_min`) o general (`AsistenciaConfig.tolerancia_min`, singleton
  id 1). **Primero manda la tolerancia que aplique**: dentro de ella es `a_horario` aunque supere el umbral
  grave (tolerancia propia 45 y umbral 30 → entrar 08:35 es a horario). Fuera de ella, `tarde_grave` si
  `>= tarde_grave_min` **medido desde la hora pactada**, no desde el fin de la tolerancia; si no, `tarde`.
  **Sin turno nocturno**: `salida <= entrada` se rechaza.
- **Turnos rotativos** (`DiaHorario.porSemana`): con ciclo > 1 cada semana del ciclo puede tener sus propias
  horas (`{ "1": { entrada:"14:00", salida:"22:00" } }`, clave = semana 0-based); si una semana no figura usa
  `entrada`/`salida`. Dos personas que alternan mañana/tarde = mismo ciclo y horas, ancla corrida una semana.
  `jornadaDelDia` resuelve el turno de la semana; tardanza y extra se miden contra ese turno. El editor, con
  ciclo > 1, muestra una línea por semana (checkbox + entrada + salida) en vez de una hora única por día.
- **Feriado detectado** (`detectarFeriados`, sin tabla de feriados): día **ya pasado** (no hoy) que **no sea
  domingo** en el que fichó menos de `FERIADO_UMBRAL` (20 %) del pool **de ese día** (decisión del usuario 2026-09-28):
  las personas activas (`personaActiva`, tengan o no horario) de los **relojes que tienen datos ese día**; si ese día
  ningún reloj tiene datos, las de los relojes que lo cubren (fichadas antes y después) — el feriado en que no vino
  nadie. El reloj habitual de cada persona sale de sus fichadas de los últimos `DIAS_RELOJ_HABITUAL` (120) días. Un
  reloj que no sincronizó o tiene un hueco ya no vuelve feriado un día normal (con el pool de todas las personas, un
  hueco de 8 de 9 relojes marcaba feriado). Se calcula en SQL, independiente de lo que se muestra.
  Los sábados entran en la regla: un sábado con poca gente queda feriado. Se trata como domingo: nadie `ausente`
  (estado `feriado`), y quien fichó queda `trabajo_no_laborable` con toda la jornada como extra al 100 %. Sale en
  `CalendarioMes.feriados`.
- **Filas del calendario**: empleados activos con alguna versión `incluir` que toque el mes (aunque no tengan
  legajo del reloj: quedan en ausente y se marcan «sin legajo») ∪, con «Mostrar sin horario», personas
  activas sin horario (marcas en gris). Fichadas de un empleado = unión de todos sus `user_id`
  (`AsistenciaPersona.empleado_id` no es único). Un inactivo con versión abierta no figura.
- Los campos viejos de texto libre `OrgEmpleado.horario` / `horarios` / `proyectos_actuales` se **borraron** del
  schema en 2026-09 (decisión del usuario; en producción solo la ficha 1 tenía un horario de texto, sin uso).
- **Perfil de la persona** (`/admin/asistencia/personas/[id]?mes=`, `PerfilPersonaPage`; el nombre es link en todo el
  módulo vía `LinkPerfil`, que lleva el mes; `GET personas/[id]/perfil?mes=`, que trae también las `marcas` crudas del
  mes): los mismos cuatro números de Mes (`resumenMesPersona`: horas trabajadas contra esperadas, llegadas tarde y
  compensadas, horas extra 50/100, faltas y días con marca faltante) y el **día por día** («Todos» / «Con novedad»), una
  tabla Día / Entrada / Salida / Tarde / Extra (minutos después de hora, `minutosDespues`) / Diferencia (extra − tarde);
  cada día se despliega con las marcas del reloj y `explicarDia`. Si el legajo no tiene ficha, ofrece vincularla
  **solo con las fichas que ninguna persona del reloj tiene** (mismo `EmpleadoPicker` y `PATCH personas/[id]`);
  cambiar o desvincular se hace desde Personas. `minutosTrabajados` = salida − entrada bruto, sin descontar
  descansos, solo días con las dos marcas.
- **Horas extra = solo control** (`horasExtraDe`): se derivan, no se guardan ni se autorizan; sirven para contrastar
  el Excel mensual de cada área, no para liquidar. Solo cuenta la **salida tardía** (salida real − salida esperada;
  llegar antes no suma) y toda la jornada en un día no laborable trabajado. **La salida tardía primero compensa la
  llegada tarde del mismo día** (`compensado = min(minutosTarde, exceso)`): llegar 1 h tarde e irse 1 h tarde es
  compensación, no hora extra; solo el exceso neto se parte en 50/100. Partición: L–V 50 %; sábado 50 % hasta
  `HE_SABADO_CORTE` (13:00) y 100 % después; domingo 100 %. Feriados no modelados (salen como día común). **Se cuenta de a
  media hora completa por día y por tipo** (`HE_BLOQUE_MIN` = 30, decisión del usuario 2026-10-13; antes eran horas
  enteras): 1 h 45 = 1,5 h, 29 min = nada; `horas50`/`horas100` van en múltiplos de 0,5 y se muestran con `fmtHorasExtra`. Sin marca de salida no hay extra.
- Etapa 2 prevista (no modelada aún): `AsistenciaNovedadDia` (vacaciones / licencia / sin goce / justificado /
  marcación manual / por verificar) y `AsistenciaFeriado`; `evaluarDia` los recibiría como inputs opcionales.
  Ojo: «licencia» ya significa licencia de software en el organigrama (`OrgLicencia`).

### Mi asistencia (vista personal)

Módulo `mi-asistencia` (`/admin/mi-asistencia`, categoría RRHH): cada usuario ve **solo su propia** asistencia,
la de la ficha del organigrama vinculada a su cuenta (`Usuario.empleado_id`, se vincula desde Usuarios ›
«Ficha del organigrama»). Sin vínculo la página lo explica y no muestra nada. Solo lectura. Permiso: entra en
`modulos` como cualquier módulo (`isAdmin()` en la API).

- **Rediseño 2026-10-07, versión simple** (decisión del usuario: que lo entienda de un vistazo una persona de 60 años;
  diseño en el lienzo «Mi asistencia — rediseño», fila «Versión simple»): el mes con flechas grandes, **unas pocas
  frases cortas** (vino X de Y días, horas trabajadas, llegadas tarde, recuperadas, horas extra, días para revisar; cada
  una aparece solo si tiene algo que decir) y un **calendario de colores**: verde vino, amarillo T llegó tarde,
  amarillo ✓ tarde recuperada, azul +N horas extra, rojo ! para revisar (ausente o falta una marca), gris día libre
  (`tipoDia`). Cada frase lleva el mismo cuadrado que su color, así el resumen hace de leyenda. Tocar un día abre un
  `Dialog` (hoja abajo en el celular) con una frase (`fraseDia`), entrada, salida y horas; las marcas crudas solo si
  hubo más de dos. Sin tarjetas, tablas ni jerga de RR.HH. **Se retiró el calendario anual** (`CalendarioAnual`).
- `GET /api/admin/mi-asistencia?mes=yyyy-mm` no recibe ningún id (el mes se acepta del actual hacia atrás
  `MI_ASISTENCIA_MESES` = 24). Resuelve la ficha con `getUsuarioSesion()` y llama a `miAsistencia()`
  (`asistencia-horarios.ts`), que devuelve **solo el mes**: `dias`/`celdas` alineados, `mes.resumen` (el mismo
  `resumenLiquidacion` del perfil), `mes.tieneHorario` y `marcas` (fichadas crudas del mes con tipo y reloj). Cada
  cambio de mes es un GET.
- **Tarde recuperada**: `ResumenLiquidacion.tardes[].recuperado` = `extra.compensado` del día (minutos de salida tardía
  que compensaron esa llegada tarde). Recuperada completa = `recuperado >= minutos`; una tilde junto a la «T» en el
  calendario.
- Es el mismo `evaluarDia`: `calendarioMes` quedó como envoltorio de **`calendarioRango(desde, hasta, …)`**. Un
  empleado sin legajo ni horario no tiene fila en el calendario general: `miAsistencia` arma una vacía (todo
  `sin_horario`) para que la pantalla explique.
- UI: todo en `MiAsistenciaPage` (mes en `useState`, no en la URL: no comparte el `AsistenciaProvider`, que pide
  personas/relojes/horarios de todos). Tiene sus propios colores (`COLOR`), más pocos que los de `ESTILO_CELDA`
  (en `CalendarioTab.tsx`, la pestaña Calendario de RR.HH.). `PerfilPiezas` quedó con `GrillaDiasHorario`
  (`HorarioDelEmpleado` del organigrama); la foto o iniciales de cualquier ficha es `Avatar` de `comunes/ui.tsx`;
  `tardanza` vive en `asistencia-tablero-calc.ts`.
- **Qué no se muestra** (decisión del usuario, vale para el perfil de Asistencia y para Mi asistencia): la
  **tolerancia** (solo se ve/edita en `HorarioDialog`), el **historial de versiones** en la tarjeta Horario, y en la
  columna Extra el desglose "compensa X min": sin bloques de media hora se muestra el tiempo total después de la hora de
  salida (`compensado + minutos50 + minutos100`). El cálculo de horas extra no cambió, solo la lectura. La respuesta
  de Mi asistencia tampoco trae la tolerancia (`config` no viaja y `versiones[].toleranciaMin` va en null).

### Asistencia: sábado libre elegido (gerentes)

Decisión del usuario 2026-10-14: quien trabaja casi todos los sábados (gerentes) elige **uno por mes** para no venir,
desde **Mi asistencia**, **sin aprobación**. Se habilita con la casilla «Elige un sábado libre por mes» del horario
(`AsistenciaHorario.sabado_libre` / `HorarioVersion.sabadoLibre`, solo si el sábado es laborable en esa versión).
Plazo: cualquier sábado **del mes en curso**, también los ya pasados; elegir otro lo reemplaza y se puede quitar. No se
puede elegir un sábado en el que fichó ni uno que no le tocaba. Se guarda solo la elección (`AsistenciaSabadoLibre`,
`@@unique([empleado_id, mes])`); `calendarioRango` la pasa como `libres` y `evaluarDia` anula la jornada como un feriado
→ `no_laborable` con `CeldaDia.libreElegido` (sin estado nuevo: no cuenta falta ni horas esperadas; si igual vino,
`trabajo_no_laborable`). Servidor en `src/lib/asistencia-sabado-libre.ts`; ruta `POST|DELETE /api/admin/mi-asistencia/sabado-libre`
(ficha SOLO de la sesión). `miAsistencia` devuelve `sabadoLibre: { puede, fecha }`.

### Asistencia: justificación de inasistencias

Decisiones del usuario 2026-10-10. El empleado, en **Mi asistencia**, toca un día `ausente` y sube un documento
(certificado médico, de examen…; PDF/JPG/PNG/WEBP ≤ 10 MB, tipo por **magic bytes** con `extensionDocumento` de
`archivos.ts`) con un comentario opcional. **Plazo: días del mes en curso y del anterior** (`justificarDesde`). RR.HH.
lo revisa en **Asistencia › Justificativos** (tercer segmento, con la cantidad pendiente): ve el documento, **marca en
un calendario los días que cubre** (un reposo puede abarcar varios, incluso futuros: `diaJustificable` = con jornada y
sin marcas) y aprueba, o rechaza con motivo obligatorio que el empleado lee. **Rechazado = definitivo**: el día queda
`ausente` y no se puede volver a pedir (`@@unique([empleado_id, fecha])` en `AsistenciaJustificacion`, Restrict).
Nadie revisa su propio pedido (403).

- El estado no se guarda: `calendarioRango` lee las `aprobada` (`dias String[]`) y pasa `justificados` por fila;
  `evaluarDia` da **`justificado`** («Inasistencia justificada») a un día con jornada, sin marcas y `<= hoy`. Si
  después aparecen marcas, manda lo fichado. No cuenta como falta (`ResumenLiquidacion.justificados`,
  `ResumenMesPersona.justificadas`) y se paga: el sueldo lo liquida Finnegans, Mes/Perfil lo muestran para pasarlo.
- Servidor en `src/lib/asistencia-justificaciones.ts`; archivos en `uploads/asistencia/justificaciones/<uuid>.<ext>`
  con sha256 verificado al servir. Rutas: `POST /api/admin/mi-asistencia/justificaciones` y `GET …/[id]/archivo`
  (ficha SOLO de la sesión; ajeno → 404); `GET /api/admin/asistencia/justificaciones?estado=pendiente|resueltas`,
  `GET|PATCH …/[id]` (`?mes=`; `{accion:'aprobar', dias}` | `{accion:'rechazar', motivo}`) y `GET …/[id]/archivo`.
- UI: `JustificarDia` en `MiAsistenciaPage.tsx` (color «J» verde azulado) y `JustificativosTab.tsx`.

### Recibos de Finnegans (PDF oficial) y Mis recibos

El recibo legal lo **emite Finnegans** (donde se liquida); Aurelius lo distribuye y más adelante lo hace firmar. Es
independiente del motor propio de Nómina (`NominaCierre`/`NominaLiquidacion`, que queda como simulación). Admin en
dos **módulos separados** (decisión del usuario: Nómina › Recibos estaba sobrecargado):
- **Gestión de recibos** (RR.HH., slug `gestion-recibos`, **`/admin/gestion-recibos`**, `GestionRecibosPage.tsx`): su
  `layout.tsx` usa `NominaProvider` con `barra={false}` (comparte el mes con Nómina por localStorage y le da la lista
  de organigramas para el filtro de lugar; no usa el organigrama elegido) y la página trae su propio encabezado con
  mes + filtros **Empleador** y **Lugar**. El acta se imprime en `/admin/gestion-recibos/acta?empleadoId=`.
- **Mis recibos** (empleado, slug `mis-recibos`, **`/admin/mis-recibos`**, `MisRecibosPage.tsx`): lista con estado de
  firma, y `/admin/mis-recibos/[id]` para ver y **firmar con el PIN desde el celular**; ver "Firma de recibos desde el
  portal". Rutas distintas a propósito: un permiso no cubre al otro.

- `src/lib/teamplace.ts`: cliente (token cacheado 4 min, reintento por "invalid token", token en query string).
  `getResumenLiq(desde, hasta)` y `getSabana(transaccionId)`. `report/execute` responde **200 + application/pdf
  también cuando falla** (cuerpo vacío o HTML "No hay datos…"): `clasificarRespuestaPdf` exige `%PDF`.
- `src/lib/recibos-finnegans-calc.ts` (puro, testeado): `agruparPorTransaccion`, `asignarPaginas` (página ↔
  legajo por CUIL; página sin CUIL = continuación; controla el neto con formato `1.053.625,00`), fechas.
- `src/lib/recibos-pdf.ts`: `extraerTextos` (pdfjs-dist legacy, en `serverExternalPackages`) y `partirPorGrupos`
  (pdf-lib). `src/lib/recibos-finnegans.ts`: Prisma + archivos.
- **Flujo:** `buscarLiquidaciones(periodo)` = **1 llamada paga** a `RESUMENLIQ` **sin filtro de empresa** (trae
  todas) → una `NominaFinnLiquidacion` por `TRANSACCIONID` (1 empresa × 1 tipo × 1 período, N legajos).
  `importarLiquidacion(tx)` = **1 llamada paga** por la sábana
  Oficial (`ReciboSueldosOficial.jrxml` + `F_GA_LIQ_0065`, `primaryKey = TRANSACCIONID`, una página por legajo),
  guardada en `uploads/nomina/sabanas/<tx>.pdf` y **reutilizada** en reintentos. Si páginas, CUIL, netos y fichas
  (`NominaEmpleado.cuil`) coinciden, publica un `NominaReciboPdf` por persona en
  `uploads/nomina/recibos/<yyyy>/<uuid>.pdf` con SHA-256; **cualquier diferencia → no publica nada**
  (`con_diferencias` + lista). Reimportar una importada no hace nada. El neto se compara como importe **completo**
  (`contieneImporte`: `5.000,00` no matchea dentro de `15.000,00`).
- **Empleador ≠ lugar de trabajo** (decisiones del usuario 2026-09-29/30). **Empleador** = la empresa que le paga el
  sueldo: la de la liquidación de Finnegans (`empresa_cuit`). **Lugar** = el organigrama de la ficha, hoy (los
  organigramas de prod son sedes físicas: Central, General Páz…). Los recibos son **de la persona**: ninguna tabla de
  recibos guarda organigrama (`NominaReciboPdf`, `NominaConstancia`, `NominaAdhesion[Revocada]`, `NominaCasoRecibo`,
  `NominaAviso`), así que **mover una ficha de organigrama no toca nada de recibos** (sus recibos y su adhesión la
  siguen). El lugar solo sirve para filtrar (`FiltrosRecibos`: `empleador` CUIT y `lugar` organigrama, opcionales, en
  panel, adhesiones y observaciones; `parseFiltrosRecibos`). La importación busca cada CUIL en **todas** las fichas
  (`fichasPorCuil`); un CUIL de la liquidación en dos fichas es diferencia. El CUIT de Nómina › Parámetros **no vincula
  nada** con recibos (es del motor propio). Empleador actual de una persona = su última liquidación de Finnegans
  (`empleadoresPorCuil` / `empleadorPorCuil` en `nomina.ts`, SQL `DISTINCT ON` sobre `filas`).
- **Índice robusto:** una transacción con filas incompletas de RESUMENLIQ se saltea y vuelve en `conProblemas` (no
  tumba las demás). Si al buscar de nuevo cambian las filas de una liquidación no importada (se rehízo en Finnegans),
  se borran su sábana guardada y sus diferencias: el próximo intento baja la sábana nueva.
- **Concurrencia (un solo proceso de Node):** las llamadas pagas van en serie (cola en memoria, así el tope no se pasa
  con pedidos simultáneos), una importación por transacción a la vez (409) y un aviso por período a la vez
  (409). Si algún día corre más de una instancia, pasar estos candados a `pg_advisory_lock`. Los `fetch` a Finnegans
  tienen timeout (token 30 s, RESUMENLIQ 60 s, sábana 180 s) y los errores de red salen como 502 con mensaje.
- **Costo:** ~19 llamadas/mes para las 13 empresas (1 índice + 1 por liquidación); no depende de la cantidad de
  empleados. Cada llamada paga queda en `NominaFinnLlamada`; al llegar a `FINNEGANS_TOPE_MENSUAL` (default 80) se
  corta con 429. El tope de Finnegans (100 gratis) es **por cuenta y compartido con CentralSM**.
- **Mis recibos:** `GET /api/admin/mis-recibos` y `/[id]/pdf`. `id` es UUID opaco; ajeno o inexistente → **404**
  (nunca 403). Antes de entregar se **recalcula el hash**; si no coincide → 409 y no se entrega. El primer acceso
  marca `accedido`.
- No todas las empresas liquidan todos los meses. El modelo Oficial **no trae el neto en letras** (RR.HH. dijo que
  no es problema). Los modelos "Descarga … Individual" (`F_GA_LIQ_0066`) piden `LIQUIDACIONLEGAJOID` (1 llamada por
  persona): no usarlos.
- **Datos de prueba (solo dev):** `scripts/cargar-empleados-finnegans.ts` crea un organigrama por empresa (con su
  CUIT en Datos del empleador), un área por convenio, las fichas con su maestro de nómina y un usuario `empleado`
  por persona (usuario = CUIL sin guiones, contraseña `empleado123`).

### Firma de recibos desde el portal (adhesión, PIN, aviso por mail, constancias)

Decisiones del usuario: **cada trabajador firma desde su celular** (portal, `/admin/mis-recibos/[id]`, con su usuario +
PIN); **RR.HH. no firma por nadie** (hubo un kiosco presencial y se retiró completo: `KioscoFirma`, `/admin/nomina/kiosco`,
`firma/pendientes`, `firma/recibos/[id]/firmar`). Cuando están los recibos del mes, **un botón manda un mail avisando**
(sin adjuntos ni importes: la idea es que firmen en el portal). El recibo del motor propio no se firma. Bloqueo **5 PIN
incorrectos → 15 min** persistente. Base legal: LCT 138/139 (Ley 27.802)/12/58/59/260, Res. 346/2019, Ley 25.506 art. 5
(firma electrónica: si se desconoce, el empleador prueba), CCyCN 287/288/314/319 (el valor probatorio sale de la cadena
de evidencia), Ley 25.326 art. 6.

- **Adhesión** (`NominaAdhesion`, una por persona, sin organigrama): **presencial**, la registra RR.HH. o el superadmin (queda
  en `created_by` y en `auditoria`). **Nombra al empleador** (`empleador_cuit`/`empleador_nombre`,
  congelados al adherir = el de su última liquidación de Finnegans): **sin ninguna liquidación con su CUIL no se puede
  adherir** (409) y **solo firma recibos de esa empresa** (`errorEmpleadorAdhesion`); si Finnegans pasa a liquidarlo otra,
  Adhesiones lo marca «Renovar: ahora le paga X» y se revoca y renueva (acta nueva). El acta toma el empleador de la
  adhesión y el domicilio de sus liquidaciones (`domicilioEmpleador`). El trabajador declara su **email** (obligatorio: ahí le llegan los avisos;
  si la ficha no tenía email, la ficha lo toma) y tipea el PIN (4–8 dígitos) dos veces. `pin_hash` = **PBKDF2**
  (`src/lib/nomina-pin.ts` → `hashSecreto`, CUIL mezclado en la entrada; nunca el PIN). Los PIN de antes de 2026-10 quedan
  en scrypt y **no se re-hashean**: `pin_hash` entra en `codigoAdhesion`, impreso en el acta firmada. `codigo` =
  `ADH-<id>-<8 hex>` (`codigoAdhesion`) se imprime en el acta y ata papel ↔ registro. **Sin acta subida la adhesión
  queda PENDIENTE y no firma** (`AdhesionView.completa`). El acta (`ActaAdhesion.tsx`, `acta-v6`; dos copias) se escanea y
  se sube: se guarda `acta_sha256`. Decisiones del usuario 2026-10 para la v5: firma en el portal con usuario + PIN desde
  cualquier dispositivo; email declarado (si es la casilla laboral, el trabajador acepta que queda en manos del empleador
  y que pierde el acceso al desvincularse); **la firma es constancia de recepción, no de conformidad** (arts. 138 a 140,
  12 y 260 LCT; las observaciones van a RR.HH. al firmar); a los 15 días del aviso RR.HH. puede pedir la firma por otro
  medio y **el silencio no implica conformidad** (art. 58: el usuario quería que sí, y la ley lo prohíbe); los datos los
  trata la empresa que paga el sueldo (sin trabajador: «(empresa que paga el sueldo)»). Texto **sujeto a revisión del asesor laboral**. **Revocar no borra nada**: se archiva
  en `NominaAdhesionRevocada` (código, acta, motivo); después se adhiere de nuevo. Con firmas hechas bajo la adhesión
  vigente, el acta **no se puede quitar ni reemplazar** (409).
- **PIN:** el cambio es **solo por autogestión** (`MiPinFirma.tsx`, `POST /api/admin/mis-recibos/pin`,
  `cambiarPinPropio`: PIN actual + nuevo dos veces; queda en `NominaPinCambio`). **RR.HH. no puede cambiar PINs** (no
  existe la ruta). Si lo olvidó: RR.HH. revoca y renueva la adhesión. Bloqueo en `pin_fallos` / `pin_bloqueado_hasta`
  (sobrevive reinicios), compartido por la firma y el cambio de PIN.
- **Aviso por mail** (`AvisoRecibos.tsx` en Gestión de recibos; `GET/POST /api/admin/nomina/firma/aviso`;
  `previaAviso` / `enviarAviso` / `listarAvisos` en `recibos-finnegans.ts`): **uno por mes para todos** (no depende de
  los filtros). Destinatarios = personas con recibos del período **sin firmar ni en papel**, adhesión completa **con el
  mismo empleador que sus recibos**, email válido y **usuario activo del portal**; el resto sale en `sinAviso` con el
  motivo (`sin_adhesion` / `pendiente_acta` / `otro_empleador` / `sin_email` / `sin_usuario`: a esos se les entrega en
  papel o hay que completar/renovar lo que falta). El contenido es puro y testeado
  (`src/lib/recibos-aviso.ts`, `armarMailAviso`: sin importes ni adjuntos, enlace a Mis recibos, HTML escapado). El
  transporte es `src/lib/mail.ts` (nodemailer; sin `SMTP_HOST` = modo prueba con `.eml`). Cada envío queda en
  `NominaAviso` + `NominaAvisoDestinatario` (estado, error, message_id): es la prueba de la puesta a disposición.
  Marca `NominaReciboPdf.notificado_en` solo donde era null; volver a apretarlo sirve de recordatorio. El aviso y cada
  destinatario se registran **a medida que salen** (si el proceso se corta, lo enviado consta). **Modo prueba no
  notifica:** sin SMTP el aviso queda registrado con `modo: 'prueba'` pero no marca `notificado_en` (nadie recibió
  nada); en `NODE_ENV=production` sin `SMTP_HOST` o sin `APP_URL` → 409. El empleador del mail son las empresas que
  liquidan los recibos avisados (de Finnegans, no de Parámetros). nodemailer con timeouts (15 s conexión / 30 s socket).
- **Constancia** (`NominaConstancia`): **una por recibo PDF** (`recibo_id @unique`, Restrict); `hash` = SHA-256 del
  PDF byte a byte; `firmante` incluye el código de adhesión; `canal` = `portal`; guarda `dispositivo` (user-agent) e
  `ip` (`ipCliente`). **Cadena por empleador** (`empleador_cuit` = el de la liquidación del recibo; lock
  `pg_advisory_xact_lock(hashtext('nomina_cadena'), hashtext(cuit))`; `verificarCadenas` devuelve una por empresa y el
  sello de Gestión las resume): `chainHash = sha256(prev|hash|fecha|empleado_id|periodo|recibo_id|
  conformidad|observaciones)` y, desde `formato = 2` (`FORMATO_CADENA`, columna `NominaConstancia.formato`), además
  `|canonicalJson(firmante)|ip|dispositivo|canal|leido`: quién y desde dónde también quedan sellados. Las constancias
  viejas quedan en `formato = 1` y `verificarCadena` usa la fórmula de cada una. Serializada con `pg_advisory_xact_lock`.
- **`firmarRecibo(empleadoId, reciboId, …)`** (`recibos-finnegans.ts`, `POST /api/admin/mis-recibos/[id]/firmar`, ficha
  **solo** de la sesión): recibo ajeno → 404 → adhesión completa del mismo CUIL **y del mismo empleador** (409 «pedile a
  RR.HH. que la renueve», antes de gastar un intento de PIN) → verifica el hash del PDF (409 si
  cambió) → **el recibo tiene que haberse abierto** (`accedido_en`, 409 "Abrí el recibo antes de firmarlo", antes de
  gastar un intento de PIN) → bloqueo (429) → `validarFirmaInput` (lectura obligatoria; observaciones opcionales:
  con texto la firma queda `observado`, si no `recibido`) → PIN (`comprobarPin`, intento reservado atómicamente; 401 / 429) → transacción
  con el lock de la cadena que **bloquea el recibo y la adhesión** (`SELECT … FOR UPDATE`), re-chequea estado y que
  la adhesión siga siendo la misma y con acta, y pasa a `firmado` con un `updateMany` condicional. Entrega en papel,
  quitar/reemplazar acta y revocar (`adhesionBloqueada` en `nomina.ts`) bloquean la misma fila: no se cruzan con una
  firma en curso. El primer acceso (`reciboPropio`) actualiza `accedido_en`/estado con updates condicionales (nunca
  retrocede un `firmado` o `papel`). P2002 → 409. Las notas de un caso resuelto no se pisan (409).
- **Visor del PDF en el celular:** `VisorPdf.tsx` dibuja con pdf.js en `<canvas>` (Chrome de Android no muestra PDF en
  `<iframe>`). Un worker propio por ejecución del efecto (con StrictMode compartirlo lo dejaba colgado).
- **Estados del recibo** (`NominaReciboPdf.estado`): `disponible` → `accedido` → `firmado` | `papel`. **"Notificado
  sin firmar" se deriva** (`estadoEntrega` → `sin_firmar`, `DIAS_PARA_FIRMAR = 15` desde `notificado_en`; sin aviso el
  plazo no corre) y **nunca implica conformidad** (art. 58): RR.HH. puede pedir la firma por otro medio o en papel.
- **Qué asienta la firma** (`NominaConstancia.conformidad`): `recibido` u `observado` desde el acta v5; las constancias
  anteriores dicen `conforme` / `disconforme` y se muestran tal cual (`textoFirma`, `tieneObservaciones` en
  `recibos-finnegans-calc.ts`; la constancia nunca se reescribe).
- **Entrega en papel** (`registrarEntregaPapel`): RR.HH. sube el escaneo del recibo impreso y firmado a mano
  (`uploads/nomina/papel/<uuid>.pdf`, `papel_sha256`); excluye la firma electrónica y viceversa.
- **Observaciones** (o disconformidad, en constancias viejas) → `NominaCasoRecibo` abierto (panel de RR.HH.); se anota y se resuelve (resolver exige notas). La
  constancia **nunca** se modifica.
- **UI de RR.HH.** (Gestión de recibos, centrada, `max-w-5xl`): `GestionRecibosPage` = encabezado con mes + filtros
  Empleador (los del mes, `PanelRecibos.empleadores`) y Lugar (organigramas), en `useState` (no persisten); cada recibo y
  cada adhesión muestran empleador y lugar. Tres tarjetas de pasos del mes (`PasoCard`):
  1 **Importar** (`RecibosFinnegans.tsx` → `PasoImportar`, la tabla de liquidaciones vive en un diálogo), 2 **Avisar**
  (`AvisoRecibos.tsx` → `PasoAviso`, confirmación con quién no recibe agrupado por motivo) y 3 **Firmas** (progreso); abajo
  pestañas **Recibos del mes** (`RecibosPeriodo`), **Adhesiones** (`AdhesionesTabla`) y **Observaciones**
  (`CasosObservaciones`). Las listas usan `BarraFiltros` (buscador sin tildes + chips con cantidad) y las acciones
  secundarias van en un menú «…» por fila. La ayuda larga está en el popover «Cómo funciona» y la integridad de la cadena
  en un sello chico. Si una carga falla se muestra `ErrorCarga` (con «Reintentar», en `comunes/ui.tsx`) en vez de quedar
  en «Cargando…». **Registrar en papel** y **Quitar acta** piden confirmación (son irreversibles / dejan la adhesión
  pendiente). El paso Avisar distingue «no hay recibos» de «no queda nadie pendiente», muestra por nombre a quién no le
  llegó el último envío y el historial de avisos se despliega con cada destinatario (la prueba de la puesta a
  disposición). Observaciones tiene «Abiertos / Resueltos»; las notas de un resuelto son de solo lectura. APIs en `src/app/api/admin/nomina/firma/**` (`aviso`, `panel`, `recibos/[id]/{pdf,papel}`, `casos`, `casos/[id]`)
  + `recibos/cadena`.
- **UI del empleado** (columna `max-w-xl`, pensada para el celular): `MisRecibosPage` (aviso «Tenés N para firmar»,
  lista tocable, PIN al pie) y `FirmarReciboPage` (pasos «Leé tu recibo» / «Firmalo con tu PIN»: casilla «Recibí
  este recibo y lo leí», observación opcional para RR.HH., PIN grande y botón «Firmar: recibí este recibo»; ya firmado →
  resumen y la constancia desplegable). La casilla «Lo leí» se habilita recién cuando `VisorPdf` terminó de dibujar el
  recibo (`onListo`), y al firmar el formulario se cierra al instante (sin doble toque). `ConstanciaCard` es una lista
  legible (firmante, identidad, desde dónde, hashes) y se comparte con el diálogo de RR.HH. y el recibo imprimible.
- La barra de Nómina y el histórico cuentan las firmas de los PDF del período; la pestaña Recibos de la ficha del
  organigrama lista los PDF con su estado.

### Vacaciones (rama `feature-vacation`)

Porte del prototipo "VacationDesk" (HTML autónomo + `test_vacation_desk.js`). Dos módulos de RRHH, como asistencia y
recibos: **Vacaciones** (RR.HH., slug `vacaciones`, `/admin/vacaciones`) y **Mis vacaciones** (slug `mis-vacaciones`,
`/admin/mis-vacaciones`, también del rol `empleado`; la ficha sale SOLO de la sesión). RR.HH. carga en nombre de alguien
en `/admin/vacaciones/seleccion/[id]` con `CargarFechasPage`; las dos pantallas comparten `ElegirFechas` (calendario +
validación en vivo). Los problemas por persona que lista Solicitudes salen de `problemasDePersonas` (solo lo que RR.HH.
tiene que resolver; los avisos de configuración, de `avisosDeConfiguracion`). **Mis vacaciones tiene su propia pantalla**
(`MisVacacionesPage`, rediseño 2026-10-07 para gente de 35 a 50 años: letra y botones grandes, calendario donde solo se
tocan los inicios válidos —`VistaSeleccion.inicios`—, sin citas de artículos —`sinArticulo`—, violeta = RR.HH.); una
página que cambia según el estado (elegir → enviadas → aprobadas con el aviso). **Privacidad:** un `Flag` puede traer
`portal` (versión sin nombres ni fechas de otras personas ni jerga de RR.HH.); `vista`, `previsualizar` y los errores
de `ejecutarAccion` en modo portal mandan esa versión (`paraPortal`, `errorPortal`). Un mensaje nuevo que nombre a otra
persona tiene que traer su `portal`. El día de vuelta es `vueltaDe` (salta descanso semanal y feriados). Documentos para
imprimir: `/admin/{vacaciones,mis-vacaciones}/documento?tipo=notificacion|fraccionamiento` (`auto=0` sin diálogo).

**Pantalla de RR.HH.** (rediseño 2026-10-07, para usuarios de 35 a 50 años: letra de 16 px, botones de 44 px
—`BOTON` en `piezas.tsx`—, sin citas de artículos en pantalla —`sinCita`—, una acción principal por fila). Tres
secciones de uso diario (`?tab=`): **Solicitudes** (bandeja en 4 grupos, `grupoBandeja`: para aprobar · para avisar
por escrito · todavía no eligieron · aprobadas; aprobar y devolver con motivo desde la tarjeta), **Calendario** (un área
por vez) y **Personas** (lista + ficha al costado). La revisión de una solicitud es `?tab=solicitudes&ver=<id>`
(`Revisar.tsx`: controles en frases simples de `controles.ts` y quién más del área sale esas semanas).
**«Cargar sus fechas»** (`/admin/vacaciones/seleccion/[id]`, `CargarFechasPage`) usa el mismo calendario que Mis
vacaciones: `ElegirFechas.tsx` (calendario, `ListaFechas`, `useVista`, `estadoEnvio`) con `voz="persona"` (segunda
persona, violeta) o `voz="rrhh"` (tercera persona, neutro). Las acciones de RR.HH. que comparten bandeja y revisión
(devolver, aviso por escrito, «Cambiar…») están en `AccionesSolicitud.tsx`; fechas, textos y estados en `piezas.tsx`.
**Configuración** va aparte
(`?tab=configuracion&sec=temporada|turnos|dividir|areas|cierres|convenios|historial|cerrar`); `ParametrosTab` queda
montado al cambiar de sección para no perder el borrador. Los `?tab=` viejos (tablero, areas, parametros, auditoria)
redirigen. La UI no deja aprobar una solicitud con errores de `validarSolicitud` (el servidor no lo bloquea).

Reglas de integridad (auditoría 2026-10-07, con tests): un tramo con interrupción **no se puede quitar** y una
selección con interrupciones o reprogramaciones **no se puede permutar** (la interrupción es de la persona, no de las
fechas); al permutar, el acuerdo de fraccionamiento viaja con los tramos. Las claves de convenio y de motivo se
validan con `Object.hasOwn` («constructor» no es un convenio). `POST .../cerrar` exige `{ ejercicio }` y da 409 si ya
se cerró (un doble clic avanzaba dos años). Las fechas de la API se validan como días reales (no 30/02). `retirar` es
solo del portal; RR.HH. usa «reabrir». Los grupos «mínimo de presentes» solo cuentan personas activas.

**Marco legal** (verificado 2026-10-03): LCT arts. 150 a 157, 162 y 164 con su texto original, y el **art. 154 según el
art. 41 de la Ley 27.802** (BO 06/03/2026). Una cautelar de la CGT lo suspendió en marzo y la Cámara del Trabajo (Sala
VIII) la dejó sin efecto el 23/04/2026: rige mientras sigue el juicio. Si un fallo de fondo lo revirtiera, el aviso
volvería a 45 días (es un parámetro) y el fraccionamiento dejaría de estar habilitado (switch «Permitir fraccionar»).

- `src/lib/vacaciones-calc.ts` — motor **puro** (cliente y servidor, testeado en `vacaciones-calc.test.ts` con los
  escenarios del prototipo). Trabaja sobre una foto `EstadoVac` y nunca la muta: las acciones devuelven la `Solicitud`
  nueva y el servidor la guarda. Memo por foto (`WeakMap`), así que toda foto nueva es un objeto nuevo.
- `src/lib/vacaciones.ts` — servidor: `cargarEstado` (fichas **activas y visibles** del organigrama + Nómina › Maestro),
  `ejecutarAccion` / `guardarConfig` / `guardarPerfil` / `guardarArea` / `cerrarTemporadaActual`, todas en transacción
  con `pg_advisory_xact_lock(hashtext('vacaciones'))` (el cupo y las reglas dependen de lo que guardan los demás) y con
  una fila en `VacacionesAuditoria` (actor, usuario, IP). Rutas en `src/app/api/admin/vacaciones/**` y
  `/api/admin/mis-vacaciones` con `conSesion()` de `vacaciones-api.ts`. RR.HH. recibe la foto entera y deriva todo en el
  cliente con el motor; la persona recibe solo su `VistaSeleccion` (calculada en el servidor) y valida un tramo con
  `{ accion: 'validar' }` (no guarda).
- Modelos: `VacacionesConfig` (singleton, `params` Json sobre `CONFIG_DEFAULT`), `VacacionesPerfil` (1:1 con la ficha),
  `VacacionesSolicitud` (una por persona y ejercicio; tramos, conformidad, notificación e interrupciones en Json;
  **Restrict**: es documentación legal), `VacacionesArea` (1:1 con `OrgArea`) y `VacacionesAuditoria`.
- **Fuentes**: nombre, área (y su `OrgArea`) y jefe del área salen del Organigrama; **ingreso, categoría y básico de
  Nómina › Maestro** (sin ingreso no se calculan días). Convenio automático por el texto de la ficha (`convenioAuto`:
  223/75 → CCT223, 130/75 → CCT130, resto → LCT), con override en la ficha de vacaciones.
- **Sueldos**: básico y remuneración de referencia (solo para el anticipo del art. 155) viajan únicamente a quien
  también tiene algún módulo de Nómina (`verSueldos`); sin eso, `cargarEstado(…, false)` los manda en 0/null y el
  PATCH de `remuneracionRef` da 403.

Reglas (decisiones de este porte, sobre el prototipo):
- **Días (art. 150)**: 14 / 21 / 28 / 35 según la antigüedad al **corte del convenio** (LCT 31/12 del ejercicio; CCT 223
  31/03 del año siguiente). "Exceder" es estricto: con 5 años justos al corte son 14 (`diasPorAntiguedad`). Sin la mitad
  de los hábiles del año → 1 día cada 20 trabajados (arts. 151/153; hábiles = lunes a viernes menos feriados cargados,
  `diasTrabajados` en la ficha pisa la estimación). Total = ley + extra convenio + beneficio + arrastre acordado
  (art. 164: solo con acuerdo y hasta 1/3 de lo legal del período anterior).
- **Inicio (art. 151)**: lunes o el hábil siguiente si es feriado; con francos rotativos, el día siguiente al descanso o
  el hábil siguiente. Los feriados son un parámetro (vienen cargados los nacionales de la temporada 2026/27; los días no
  laborables son optativos y no van).
- **Tramos (art. 154)**: dentro del 1/10–30/4 o con la casilla de mutuo acuerdo (queda en `tramo.fueraTemp`); partir
  exige `acuerdoFracc` (portal = la persona la marca; RR.HH. = «firmada en papel», con el acuerdo imprimible) y tramos
  de 7 días o más; cualquier cambio de tramos anula la conformidad. Máximo de tramos = el menor entre la política y el
  convenio. «Tramo principal %» es política interna, no ley.
- **Cupo y orden**: el cupo simultáneo es **por área del organigrama** (`null` = sin límite: las áreas reales tienen
  decenas de personas) y el orden de elección también se calcula **dentro de cada área** (el prototipo era una sola
  empresa chica). Primero quien lleva `cicloVerano − 1` temporadas sin verano (garantía del art. 154) y la preferencia
  de convenio por hijos en primaria; después rotación (quien eligió último va primero) / antigüedad / sorteo con
  semilla, o «llegada» sin turnos. Reglas por rol: «jefe y segundo» automática (jefe = `OrgArea.jefe_id`) y grupos
  «no salen juntos» / «mínimo de presentes». Los cierres colectivos descuentan días a todos y no consumen cupo.
- **Aviso (art. 154)**: aprobar reserva el cupo; RR.HH. registra la notificación escrita (documento imprimible, 30 días
  o más, el mayor entre el parámetro y el convenio) y la persona acusa recibo en el portal (o RR.HH. registra el acuse
  en papel). Notificada y dentro del plazo, reabrir exige marcar el mutuo acuerdo. La persona puede **retirar** un envío
  que nadie aprobó todavía.
- **Interrupción (art. 154)**: por enfermedad informada en tiempo y con posibilidad de control (exige certificado y
  confirmarlo), o fallecimiento si el convenio lo prevé, u «otro» por acuerdo. **El tramo no se acorta** (vuelve al final
  del período previsto, o al alta del art. 208): se registran los días no gozados (`desde`–`hasta`), se descuentan de lo
  usado y quedan para reprogramar; la reprogramación (exenta del tramo mínimo) la pide la persona y la aprueba RR.HH.
  Esos días no se informan como vacaciones en «días por mes».
- **Pago (art. 155)**: el CSV de anticipos usa remuneración ÷ 25 por día y el hábil anterior al inicio (remuneración de
  referencia de la ficha o el básico de Nómina; "mayor de 12 meses" si el convenio lo dice). No modela el salario
  variable (art. 155 c) ni la indemnización del art. 156.
- **Art. 157**: alerta a 60 días del cierre de temporada a quien tiene días sin asignar.
- **Cerrar temporada**: guarda en cada ficha si tuvo verano y su turno (alimentan la rotación y la garantía), propone el
  arrastre sin acuerdo (hay que formalizarlo) y pasa las fechas al ejercicio siguiente. No se deshace.
- Pendiente: que Asistencia muestre los días de vacaciones aprobadas (hoy quedarían como ausente), pasar «días por mes»
  a `NominaNovedad.dias_vacaciones`, aviso por mail de la notificación y aprobación por el jefe directo («Mi equipo»).

### UI Components

shadcn/ui components live in `src/components/ui/`. Custom components (logout button, theme toggle, admin home, sidebar, etc.) are in `src/components/`. The app supports light/dark theming via `ThemeToggle`.

### Upload body size

`src/proxy.ts` runs on all routes (matcher `/:path*`), so Next buffers request bodies with a 10MB cap.
`next.config.ts` raises it via `experimental.proxyClientMaxBodySize` (60 MB) for the padrón Excel and the CrossChex
`.mdb` uploads. Each upload route still enforces its own size limit.

### Fechas

Días de calendario siempre en hora de Argentina con `src/lib/fechas.ts` (`hoyLocal`, `mesLocal`, `diaLocal`), nunca
`new Date().toISOString().slice(0, 10)`: eso es el día en UTC y desde las 21 h ya es mañana. `fechas.ts` es también el
único lugar de la aritmética de días (`aMs`, `sumarDias`, `diffDias`), los meses (`MES_RE`, `rangoMes`,
`mesAnterior`/`mesSiguiente`, `fmtMes`, `MESES`, `MESES_CORTOS`) y `fechaCorta` (dd/mm/aaaa): no volver a escribirlos
en cada módulo.

Errores de la API: `ApiError(mensaje, status)` (`api-error.ts`) sale tal cual por `handle`/`handleSesion` de
`api-admin.ts`; `NominaError`, `AsistenciaError` y `VacacionesError` lo extienden y `AnvizError` es 502.
