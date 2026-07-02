# ISPBoss / ViaCCC (TvCloud 2.0) — Alta de abonado/venta + API REST

> Sistema: `https://viaccc.ispboss.com` — **ViaCCC v1.0.0.10190**, ASP.NET WebForms (IIS 10 / .NET 4.0.30319) de **CHRS Software**.
> Relevado con Playwright (usuario `folarte`) y la API REST probada con la API key de prueba provista.
> **No se creó ningún abonado real**: el wizard se completó con datos de prueba y se canceló antes de "Crear Abonado". Sobre la API sólo se hicieron lecturas (GET) y sondeos `OPTIONS`.

---

## 1. Arquitectura: 3 capas

| Capa | Para qué | Auth | ¿Sirve para integrar? |
|------|----------|------|----------------------|
| **UI WebForms** (`.aspx`) | Lo que opera el humano. Todo va por `POST /Abonados/Default.aspx` con `__VIEWSTATE` + partial postbacks (UpdatePanel). | Cookie de sesión | Para **crear** abonados: es la única vía (ver §4). Reconstruir los postbacks "por fuera" es frágil. |
| **ScriptServices `.asmx`** | Pueblan los desplegables (calles, provincias…) por AJAX JSON. | Cookie de sesión | Para **leer catálogos** (lookups) de forma limpia (§3.2). |
| **API REST `/api/*`** | API JSON con auth por **API Key**. | **`X-Api-Key`** | **Sólo lectura de abonado por id** (§3.3). No lista, no busca, no crea. |

> **Conclusión:** con esta API key, la API sólo permite **leer un abonado por su id interno**. Para "filtrar abonados al momento de cargarlos", la creación se hace por la **UI (Playwright, §4)** y el filtro/validación se apoya en `GET /api/abonados/{id}` (§5).

---

## 2. Flujo de alta en la UI (wizard de 4 pasos)

**Menú:** `Abonados ▸ Abonados` → `/Abonados/Default.aspx` (listado) → botón **"Nuevo"** (`#ctl00_ctl00_b_b_btnNuevo`).
> `Abonados ▸ Ventas` (`/Abonados/Ventas.aspx`) **NO** es alta: es un **reporte** de movimientos (altas/bajas/modif.).

Ids de los controles con prefijo `ctl00_ctl00_b_b_ucAlta_…`.

### Paso 1 — Domicilio de Instalación
`ddlInstalacionCalle`* · `txtInstalacionNumero`* · `ddlInstalacionZona`* (dep. Calle+Número) · `txtInstalacionPiso` · `txtInstalacionManzana` · `txtInstalacionCasa` · `txtInstalacionCodigoPostal` · `txtObservaciones` · `ddlInstalacionProvincia`* · `ddlInstalacionPartido`* (dep. Provincia) · `ddlInstalacionLocalidad`* (dep. Partido) · `txtInstalacionLatitud`/`txtInstalacionLongitud` + botón **Geolocalizar** + mapa.
Avanzar: **`btnGuardar1`**. *(Para pasar de paso alcanza con Calle + Número.)*

### Paso 2 — Datos Personales
`ddlDocumentoTipo` (def. DNI) · `txtDocumentoNumero`* · `ddlCondicionIVA` (def. CF) · `ddlIIBBCondicion` · `txtNombres`* · `txtApellido`* · `ddlCategoria`* · `txtContrato` · `txtFechaNacimiento` · `ddlPromotor` · `ddlComprobanteMetodoEnvio`* (Email/Repartidor) · `ddlRepartidor` (si Repartidor) · Teléfono · Celular* (área+número) · E-mail* (si método = Email).
Avanzar: **`btnGuardar2`**.

### Paso 3 — Datos de Facturación
`ddlFormaPago`* (CO Contado / TC Tarjeta Créd. / TD Tarjeta Déb.) · si tarjeta: `ddlTarjetaMarca`, `ddlTarjetaEntidad` · si CBU: `ddlCBUEntidad` · checkbox **"Utilizar el Domicilio de Instalación"** (tildado) → si se destilda: `ddlFacturacion{Provincia,Partido,Localidad}` · Observaciones.
Avanzar: **`btnGuardar3`**.

### Paso 4 — Confirmación
Resumen + botón **"Crear Abonado"** = `#ctl00_ctl00_b_b_ucAlta_btnGuardar4` → `__doPostBack('ctl00$ctl00$b$b$ucAlta$btnGuardar4','')`. **Este postback da de alta** (queda `PorInstala` y genera las órdenes de servicio).

**Botones:** `btnNuevo` → `btnGuardar1` → `btnGuardar2` → `btnGuardar3` → **`btnGuardar4` (CREAR)**. `btnCancelar`/`btnCancelarN` = cancelar/anterior.

---

## 3. Inventario de endpoints

### 3.1 Postbacks WebForms → `POST /Abonados/Default.aspx`
`x-microsoftajax: Delta=true`, body reenvía todo el form + `__VIEWSTATE`/`__EVENTVALIDATION`, con `__EVENTTARGET` = control disparador (`…$btnNuevo`, `…$ucAlta$btnGuardar1..4`).

### 3.2 ScriptServices `.asmx` (catálogos) — contrato común
```
POST https://viaccc.ispboss.com/WebServices/<Servicio>.asmx/<Metodo>
Content-Type: application/json; charset=utf-8      (auth: cookie de sesión)
Body: { "parameters": { "ParentValues": [], "Query": "", "PageLimit": 10, "PageIndex": 1 } }
→ { "d": "{\"total_count\":4675,\"items\":[{\"id\":\"6\",\"text\":\"(CIU) - 12 DE OCTUBRE\"}]}" }
```
`ParentValues` = valores de los desplegables padre (cascada). `Query` = búsqueda. `PageLimit`/`PageIndex` = paginación (1-based).

| Paso | Campo | Servicio/método | Padres |
|---|---|---|---|
| 1 | Calle | `Calles.asmx/GetTodosInstalacion` | — |
| 1 | Zona | `Zonas.asmx/GetTodosPorCalleNumero` | Calle+Número |
| 1 | Provincia | `Ubicacion.asmx/GetProvincias` | — |
| 1 | Partido | `Ubicacion.asmx/GetPartidos` | Provincia |
| 1 | Localidad | `Ubicacion.asmx/GetLocalidades` | Partido |
| 2 | Tipo Doc. | `DocumentosTipos.asmx/GetTodos` | — |
| 2 | Condición IVA | `CondicionesIVA.asmx/GetTodosPorDocumentoTipo` | Tipo Doc. |
| 2 | Condición II.BB. | `CondicionesIB.asmx/GetTodos` | — |
| 2 | Categoría | `AbonadosCategorias.asmx/GetTodos` | — |
| 2 | Promotor | `SeguridadUsuarios.asmx/GetTodosVendedores` | — |
| 2 | Método envío | `ComprobantesMetodosEnvio.asmx/GetTodos` | — |
| 2 | Repartidor | `Repartidores.asmx/GetTodos` | — |
| 2 | Cód. tel. país | `Ubicacion.asmx/GetCodigosTelefonicosPaises` | — |
| 3 | Forma de Pago | `FormasPago.asmx/GetTodos` | — |
| 3 | Tarjeta Marca | `TarjetasMarcas.asmx/GetTodos` | — |
| 3 | Entidad Bancaria | `Entidades.asmx/GetTodos` | — |
| 3 | Prov/Part/Loc fact. | `Ubicacion.asmx/GetProvincias·GetPartidos·GetLocalidades` | cascada |

### 3.3 API REST `/api/` — VERIFICADA con la API key

**Autenticación**
- Header correcto: **`X-Api-Key: <clave>`** (equivalente: `Authorization: Bearer <clave>`).
- Headers que NO funcionan: `ApiKey`, `Token`, `x-access-token`, `Authorization:` crudo → `403 "Invalid API Key or Token"`.
- El filtro de auth corre **antes** del ruteo: clave inválida/ausente → `403`; clave válida → pasa a ruteo (200/400/404 según la ruta). Por eso **no se pueden enumerar rutas sin clave** (todo da 403).

**Único endpoint expuesto a esta clave**
```
GET https://viaccc.ispboss.com/api/abonados/{id}
Header: X-Api-Key: <clave>
→ 200  { …48 campos del abonado… }   (ver §3.4)
```
- `{id}` = **id interno (PK)**, entero positivo. **No es el "Código"** visible en pantalla.
  Ej.: `id=701956` → `Codigo=1008961`; `id=2` → `Codigo=3`. (Es el mismo id de las URLs del UI: `/Abonados/Default.aspx?id=701956`.)
- `id=0` → `400 "No se ha especificado id"`. `{id}` no numérico → `400 "La solicitud no es válida."`.
- `OPTIONS /api/abonados/{id}` → `405 Allow: GET` → **la ruta sólo admite GET**.

**Lo que NO existe (probado):**
- ❌ Colección/listado: `GET /api/abonados` → 404. `?codigo=`, `?documento=` → 404.
- ❌ Búsqueda: `/api/abonados/buscar`, `/search` → 400 (intenta bindear como id).
- ❌ Crear/editar/borrar: sólo `GET` permitido (405 en OPTIONS).
- ❌ Sub-recursos: `/api/abonados/{id}/servicios|conceptos|comprobantes|...` → 404.
- ❌ Otros controllers: `ventas, comprobantes, facturas, pagos, cobranzas, conceptos, localidades, zonas, calles, planes, usuarios, tickets, ordenes, equipos…` (41 nombres probados, todos 404).
- ❌ No hay Swagger/`$metadata`/`/api/help`.

> Es decir: con esta clave la API es **read-only, un abonado por id**. Es muy probable que la clave esté **scopeada** a eso; CHRS podría emitir una clave con más permisos o exponer más endpoints. **Conviene pedirles la documentación oficial de la API y/o una clave con permiso de escritura** si se necesita crear por API.

### 3.4 Esquema de un abonado (`GET /api/abonados/{id}`) — 48 campos
```
id, Codigo, NombreCompleto,
EstadoCodigo, EstadoNombre,
CategoriaCodigo, CategoriaNombre,
CondicionIVACodigo, CondicionIVANombre,
DocumentoTipoCodigo, DocumentoTipoNombre, DocumentoNumero,
FormapagoNombre, FormaPagoid, FormapagoCuentaTipoID,
TarjetaCBU, TarjetaMarca, TarjetBanco,
TelefonoArea, TelefonoNumero,
CelularPais, CelularArea, CelularNumero, CelularValidacionEstadoID,
Email, EmailValidacionEstadoID,
DomicilioInstalacionDomicilio, …Piso, …Manzana, …Casa, …CodigoPostal,
DomicilioInstalacionZonaCodigo, …ZonaNombre, …LocalidadCodigo, …LocalidadNombre, …Latitud, …Longitud,
DomicilioFacturacionDomicilio, …Piso, …Manzana, …Casa, …CodigoPostal, …GeoLocalidadNombre,
TotalOrdenesPendientes, TotalTicketsPendientes,
ImporteSaldoComprobantes, ConceptosVigentesImporte,
UltCompurl
```
Campos útiles para filtrar: `EstadoCodigo` (Activo, PorInstala, PendBaja, BAJAxIMP_I, SinCargo, ANULADO…), `CategoriaCodigo`, `DocumentoNumero`, `DomicilioInstalacionZonaCodigo`/`LocalidadCodigo`, `ImporteSaldoComprobantes`, `TotalOrdenesPendientes`.

---

### 3.5 Buscar abonados por domicilio (y otros filtros) — sólo UI, NO API

La **API no busca** (sólo `GET /api/abonados/{id}`). Pero el **grid de Abonados** (`/Abonados/Default.aspx`, panel "Búsqueda Avanzada") sí filtra por **domicilio de instalación** y más. Verificado: filtrando `Domicilio = "SARMIENTO"` devolvió **5.156** abonados cuyo domicilio contiene ese texto (**match por substring**, no exacto).

Mecánica (capa WebForms, automatizable con Playwright):
- Campo domicilio: `#ctl00_ctl00_b_b_conFiltros_filAbonadoDomicilio` (textbox).
- Aplicar: `#ctl00_ctl00_b_b_conFiltros_btnApply` → `__doPostBack('ctl00$ctl00$b$b$conFiltros$btnApply','')`.
- Resultados: grid `grdDatos`; total en "Total N registros"; cada fila linkea a `/Abonados/Default.aspx?id=<idInterno>` → de ahí sacás el **id interno** para la API.

Otros filtros del mismo panel: Código, Código Rango, **Número Documento**, Nombre, Apellido, **Domicilio instalacion**, Email/Teléfono, Fecha Solicitud/Instalación/Baja (y rangos), Scoring, Prob. Mora, Prob. Fuga, Piso, Manzana, Casa, etc.

> **Workflow que conecta UI + API:** buscás por domicilio/DNI en el grid (Playwright) → tomás el `id` interno del link de cada fila → `GET /api/abonados/{id}` para el JSON estructurado de 48 campos. Así cubrís dedupe/validación por domicilio aunque la API no tenga búsqueda.

---

## 4. Crear un abonado con Playwright (capa UI)

Los desplegables son **Select2 alimentados por `.asmx`**: el patrón confiable es *abrir → escribir → esperar opción → click*.

```js
// npm i playwright   |   node alta-abonado.js
const { chromium } = require('playwright');
const BASE = 'https://viaccc.ispboss.com';
const U = 'ctl00_ctl00_b_b_ucAlta_';

async function pickDropdown(page, selectId, query) {
  await page.locator(`#${selectId}`).locator('xpath=following-sibling::*[contains(@class,"select2")]').first().click();
  if (query) await page.locator('input.select2-search__field').fill(query);
  const opt = page.locator('li.select2-results__option[role="option"]:not(.loading-results)').first();
  await opt.waitFor({ state: 'visible' });
  await opt.click();
}

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  await page.goto(`${BASE}/Login.aspx`);
  await page.fill('#ctl00_b_txtUsuario', 'USUARIO');
  await page.fill('#ctl00_b_txtPassword', 'CLAVE');
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await page.waitForLoadState('networkidle');

  await page.goto(`${BASE}/Abonados/Default.aspx`);
  await page.evaluate(() => { const o = document.getElementById('sidebar-overlay'); if (o) o.style.display = 'none'; });
  await page.click('#ctl00_ctl00_b_b_btnNuevo');
  await page.waitForSelector(`#${U}ddlInstalacionCalle`);

  // Paso 1
  await pickDropdown(page, `${U}ddlInstalacionCalle`, '12 DE OCTUBRE');
  await page.fill(`#${U}txtInstalacionNumero`, '100');
  await pickDropdown(page, `${U}ddlInstalacionProvincia`, 'Tucum');
  await pickDropdown(page, `${U}ddlInstalacionPartido`, '');
  await pickDropdown(page, `${U}ddlInstalacionLocalidad`, '');
  await pickDropdown(page, `${U}ddlInstalacionZona`, '');
  await page.click(`#${U}btnGuardar1`);

  // Paso 2
  await page.fill(`#${U}txtDocumentoNumero`, '30123456');
  await page.fill(`#${U}txtNombres`, 'JUAN');
  await page.fill(`#${U}txtApellido`, 'PEREZ');
  await pickDropdown(page, `${U}ddlCategoria`, '');
  await pickDropdown(page, `${U}ddlComprobanteMetodoEnvio`, 'Email');
  await page.getByRole('textbox', { name: 'Dirección de E-mail' }).fill('juan.perez@example.com');
  await page.getByRole('textbox', { name: 'Cód.Area' }).last().fill('381');
  await page.getByRole('textbox', { name: 'Número' }).last().fill('5551234');
  await page.click(`#${U}btnGuardar2`);

  // Paso 3
  await pickDropdown(page, `${U}ddlFormaPago`, 'Contado');
  await page.click(`#${U}btnGuardar3`);

  // Paso 4 — confirmar
  // await page.click(`#${U}btnGuardar4`);  // ⚠️ CREA EL ABONADO REAL. Descomentar sólo cuando corresponda.
})();
```
Notas: quitar `#sidebar-overlay` antes de "Nuevo"; cada `btnGuardarN` es postback → esperar `networkidle`/`waitForSelector`; respetar el orden de las cascadas.

---

## 5. Cómo filtrar abonados al cargarlos (recomendación)

Como la API **no crea** abonados (read-only por id) y **no busca por documento**, el patrón realista es:

```
[tus datos de entrada]
        │
        ▼
[ TU SCRIPT EXTERNO ]  ←─ FILTRO/validación (reglas de negocio, formato DNI,
        │                  zona permitida, etc.)  +  (opcional) enriquecer/verificar
        │                  con GET /api/abonados/{id} si ya tenés el id interno
        ▼  (sólo los que pasan)
[ Playwright §4 ]  →  crea el abonado en la UI (btnGuardar4)
        │
        ▼  (post-alta, opcional)
GET /api/abonados/{nuevoId}  →  verificar que quedó bien cargado (estado, datos)
```

Puntos clave:
1. **El filtro vive en tu script**, antes del click final "Crear Abonado". Ahí decidís qué entra.
2. **Dedupe por DNI**: la API no busca por documento. Para chequear duplicados antes de cargar, usá el **grid de Abonados** (filtro "Número Documento") o el `.asmx` correspondiente; o pedí a CHRS un endpoint de búsqueda.
3. **`GET /api/abonados/{id}`** sirve para **verificar/enriquecer** por id (post-alta o si ya conocés el id), no para listar.
4. Si necesitás **crear por API** (sin UI) o **listar/buscar**, pedí a CHRS la **documentación de la API** y una **API key con más permisos** — el `/api/` da 403/404 según permiso+ruta, así que el alcance lo define la clave.

### Snippet de lectura por API (con tu clave)
```js
const BASE = 'https://viaccc.ispboss.com';
const KEY = process.env.ISPBOSS_API_KEY;       // tu X-Api-Key
async function getAbonado(id) {
  const r = await fetch(`${BASE}/api/abonados/${id}`, { headers: { 'X-Api-Key': KEY, 'Accept': 'application/json' } });
  if (r.status === 200) return r.json();
  if (r.status === 403) throw new Error('API key inválida o sin permiso');
  if (r.status === 400) throw new Error('id inválido');
  if (r.status === 404) return null;            // no existe ese id
  throw new Error('HTTP ' + r.status);
}
```

---

## 6. Catálogos de referencia observados
- **Estados de abonado:** `PorInstala`, `Activo`, `PendBaja`, `BAJAxIMP_I`, `BAJAXINMED`, `SinCargo`, `ANULADO`…
- **Formas de pago:** `CO` Contado, `TC` Tarjeta de Crédito, `TD` Tarjeta de Débito.
- **Método de envío de comprobantes:** Email, Repartidor.
- **Calles:** ~4.675 (catálogo grande → filtrar con `Query`).
- **Condición IVA** (def. `CF` Consumidor Final), **Categorías**, **Promotores/Vendedores**, **Condición II.BB.** → vía sus `.asmx` (§3.2).
```
```
```

> Nota de seguridad: la API key da acceso de lectura a datos de abonados (PII). Tratala como secreto (variable de entorno, no hardcodear, no commitear).
