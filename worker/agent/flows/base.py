"""
Helpers compartidos para los flows de Playwright sobre FinnegansGO.

FinnegansGO carga TODO el formulario de carga dentro de un <iframe>. Los inputs del
formulario NO tienen id ni name; la identidad estable es el contenedor
`div.widget[name="wdg_*"]`. Este mÃ³dulo encapsula esos detalles.

Relevamiento autoritativo: ../../DOCUMENTACION_FORMULARIO_FACTURA_COMPRA.md

Uso:
    async with FinnegansSession(empresa="Prueba") as s:
        await s.select_empresa("Prueba")
        await s.goto_facturas()
        await s.open_nueva_factura()
        await s.set_selector("wdg_Organizacion", "EDET S.A.")
        ...
"""

from __future__ import annotations

import asyncio
import re
import sys
import time
from datetime import date, datetime
from pathlib import Path
from typing import Optional

from playwright.async_api import Browser, BrowserContext, Frame, Page, Playwright, async_playwright

from agent.config import (
    FINNEGANS_FACTURAS_URL,
    FINNEGANS_LOGIN_URL,
    FINNEGANS_PASS,
    FINNEGANS_USER,
    FINNEGANS_WORKSPACE,
    HEADLESS,
)

TIMEOUT = 120_000  # ms â€” cargas de pÃ¡gina
STEP_TIMEOUT = 45_000  # ms â€” pasos interactivos (para que un fallo se note rÃ¡pido)
WORKFLOW_DEFAULT = "Compras - Productos & Insumos - Sin Asistente"


class DuplicateComprobanteError(Exception):
    """Finnegans rechazó el guardado porque el número de comprobante ya existe."""


class ControlTotalMismatchError(Exception):
    """Finnegans bloqueó el guardado: el importe total no coincide con el de control."""


class SaveFailedError(Exception):
    """El guardado no se confirmó: el documento sigue como 'Nuevo' (Finnegans no
    persistió la factura). NO se debe intentar adjuntar el PDF en este caso."""


class AttachFailedError(Exception):
    """El PDF no quedó listado en el panel de adjuntos tras intentar adjuntarlo."""


def _log(msg: str) -> None:
    print(f"   [finnegans] {msg}", file=sys.stderr)


def _norm_text(s: str) -> str:
    """Normaliza texto para comparar filas de autocomplete: quita acentos,
    Ñ→N, deja solo alfanuméricos, mayúsculas. Mismo criterio que el JS norm."""
    import unicodedata
    s = unicodedata.normalize("NFD", str(s or ""))
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-zA-Z0-9]", "", s).upper()


def _parse_numero(s: str) -> float:
    """Parsea strings de nÃºmeros con separadores variados ($, espacios, .  vs ,)."""
    if s is None or s == "":
        return 0.0
    s = re.sub(r"[$\s]", "", str(s))
    if "." in s and "," in s:
        # el separador decimal es el Ãºltimo que aparece
        if s.rindex(".") > s.rindex(","):
            s = s.replace(",", "")          # 1,234.56 â†’ 1234.56
        else:
            s = s.replace(".", "").replace(",", ".")  # 1.234,56 â†’ 1234.56
    elif "," in s:
        s = s.replace(",", ".")              # 1234,56 â†’ 1234.56
    try:
        return float(s)
    except ValueError:
        return 0.0


class FinnegansSession:
    """Context manager async: abre el navegador, hace login y expone helpers del formulario."""

    def __init__(
        self,
        empresa: str = "Prueba",
        headless: bool = HEADLESS,
        keep_open: bool = True,
    ):
        self.empresa = empresa
        self.headless = headless
        self.keep_open = keep_open
        self._pw: Optional[Playwright] = None
        self._browser: Optional[Browser] = None
        self._context: Optional[BrowserContext] = None
        self.page: Optional[Page] = None
        self._frame: Optional[Frame] = None  # iframe con el contenido real
        self._modal_open: bool = False  # True cuando hay un modal de grilla abierto

    # ------------------------------------------------------------------
    # Ciclo de vida
    # ------------------------------------------------------------------

    @property
    def frame(self) -> Frame:
        """Frame del iframe de contenido de FinnegansGO."""
        if self._frame is None:
            raise RuntimeError("El iframe de contenido aÃºn no fue resuelto (llamar goto_facturas).")
        return self._frame

    async def __aenter__(self) -> "FinnegansSession":
        self._pw = await async_playwright().start()
        self._browser = await self._pw.chromium.launch(headless=self.headless)
        self._context = await self._browser.new_context(viewport={"width": 1680, "height": 950})
        self._context.set_default_timeout(TIMEOUT)
        self.page = await self._context.new_page()
        await self._login()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if exc_type is not None and self.page:
            _log(f"ERROR: {exc_val}")
            try:
                await self.screenshot("error")
            except Exception:
                pass
        # Dejar el navegador abierto para inspecciÃ³n (Ã©xito o error) si keep_open.
        if self.keep_open and self.page:
            try:
                await self.pause_para_inspeccion()
            except Exception:
                pass
        if self._browser:
            await self._browser.close()
        if self._pw:
            await self._pw.stop()
        return False

    async def pause_para_inspeccion(self):
        """Bloquea hasta que el usuario presione ENTER en la consola."""
        print(
            "\n=== Navegador abierto para inspecciÃ³n. "
            "RevisÃ¡ el formulario y presionÃ¡ ENTER para cerrar... ===",
            file=sys.stderr,
        )
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, input)

    # ------------------------------------------------------------------
    # Login
    # ------------------------------------------------------------------

    async def _login(self):
        page = self.page
        _log(f"login como {FINNEGANS_USER} / workspace {FINNEGANS_WORKSPACE}")
        await page.goto(FINNEGANS_LOGIN_URL, wait_until="load")

        async def _fill_first_visible(candidates: list, value: str, label: str):
            last_exc = None
            for loc in candidates:
                try:
                    await loc.first.fill(value, timeout=10_000)
                    return
                except Exception as exc:
                    last_exc = exc
            raise RuntimeError(f"No se pudo completar campo login {label!r}: {last_exc}")

        textboxes = page.locator("input:visible")
        await _fill_first_visible(
            [
                page.get_by_role("textbox", name="Usuario"),
                page.locator("input[name*='user' i], input[id*='user' i]"),
                textboxes.nth(0),
            ],
            FINNEGANS_USER,
            "Usuario",
        )
        await _fill_first_visible(
            [
                page.get_by_role("textbox", name="Contraseña"),
                page.locator("input[type='password']"),
                page.locator("input[name*='pass' i], input[id*='pass' i]"),
                textboxes.nth(1),
            ],
            FINNEGANS_PASS,
            "Contraseña",
        )
        await _fill_first_visible(
            [
                page.get_by_role("textbox", name="Espacio de Trabajo"),
                page.locator("input[name*='workspace' i], input[id*='workspace' i]"),
                textboxes.nth(2),
            ],
            FINNEGANS_WORKSPACE,
            "Espacio de Trabajo",
        )
        await page.get_by_role("button", name="Ingresar").click()

        # Redirige services â†’ go.finneg.com/login/external â†’ go.finneg.com/home/externos
        await page.wait_for_url("**/go.finneg.com/home/**", timeout=TIMEOUT)
        await page.wait_for_load_state("load")
        await page.wait_for_timeout(5000)
        _log("login OK")

    # ------------------------------------------------------------------
    # SelecciÃ³n de empresa (en la pÃ¡gina principal, NO en el iframe)
    # ------------------------------------------------------------------

    async def _modal_empresa_visible(self) -> bool:
        try:
            return await self.page.get_by_text("Seleccionar Empresa").first.is_visible()
        except Exception:
            return False

    @staticmethod
    def _normalize_empresa(nombre: str) -> str:
        """Comparacion ignorando puntos, espacios, mayusculas y sufijo 'Empresa'."""
        if not nombre:
            return ""
        s = re.sub(r"\b[Ee]mpresa\b\s*$", "", nombre).strip()
        s = re.sub(r"[.\s]+", "", s)
        return s.upper()

    async def get_header_empresa(self) -> Optional[str]:
        """Lee el nombre de la empresa activa en el header via .current-empresa-name.

        FinnegansGO pone el nombre en .current-empresa-name (span/div con clase CSS
        estable). Fallback: busqueda de texto con sufijo 'Empresa' si la clase no
        existe en esta version del frontend.
        """
        try:
            raw = await self.page.evaluate(
                """() => {
                    // Estrategia primaria: clase CSS estable .current-empresa-name
                    const el = document.querySelector('.current-empresa-name');
                    if (el) return el.textContent.trim();
                    // Fallback: elemento visible cuyo texto termina en ' Empresa'
                    const fb = [...document.querySelectorAll('*')].find(
                        e => e.offsetParent !== null
                             && /\\bEmpresa\\s*$/.test(e.textContent.trim())
                             && e.textContent.trim().length < 80);
                    return fb ? fb.textContent.trim() : null;
                }"""
            )
            if not raw:
                return None
            return re.sub(r"\s*Empresa\s*$", "", raw).strip()
        except Exception:
            return None

    async def select_empresa(self, nombre: Optional[str] = None):
        """Selecciona empresa en FinnegansGO.

        MECANISMO CORRECTO (verificado con MCP Playwright 2026-05-28):
        ---------------------------------------------------------------
        El modal "Seleccionar Empresa" usa un scroll-container interno
        (.empresa-container) con clientHeight ~459 px y scrollHeight ~2170 px.
        Hay ~24 .card-empresa en el DOM, la mayoria fuera de la vista inicial.

        PROBLEMAS CONFIRMADOS Y SUS SOLUCIONES:
        ----------------------------------------
        1. FILTRO NO FUNCIONA:
           El buscador del modal NO reacciona a JS value-setter + dispatchEvent
           NI a Playwright .fill(). Angular CDK no detecta el cambio de valor.
           SOLUCION: omitir completamente el filtro; iterar sobre todos los cards.

        2. getBoundingClientRect() + page.mouse.click(x, y) FALLA:
           Los items que no estan en el primer "fold" del scroll-container tienen
           y > 950 en getBoundingClientRect() (fuera del viewport visible de la
           pagina). page.mouse.click() en esas coordenadas no llega al elemento.
           SOLUCION: llamar scrollIntoView({block:'center'}) antes de cualquier
           click para traer el elemento al viewport.

        3. CLICK EN TEXTO O CARD DIV NO SELECCIONA:
           Hacer click en .card-empresa-name o en el div .card-empresa con
           page.mouse.click() o JS el.click() no activa el handler de Angular CDK.
           SOLUCION: clickear .p-checkbox-box (el elemento visual del checkbox de
           PrimeNG) que SI tiene su propio event listener y activa Angular.

        4. AGRUPADORES (empresas con sucursales):
           Las empresas con sucursales aparecen DOS veces:
           a) Un nodo agrupador (.card-empresa con .card-empresa-sucursales-cantidad
              que muestra el numero de sucursales, ej. "3") — al clickearlo se abre
              un sub-modal "Sucursales de X".
           b) Una sucursal real (mismo nombre, sin el badge de cantidad) — ES el
              card que queremos.
           SOLUCION: preferir cards donde .card-empresa-sucursales-cantidad esta
           vacio o ausente (isLeaf). Si igual abre sub-modal, manejarlo.
        """
        nombre = nombre or self.empresa
        page = self.page

        # 0) Skip si la empresa actual ya coincide
        current = await self.get_header_empresa()
        if current and self._normalize_empresa(current) == self._normalize_empresa(nombre):
            _log(f"empresa ya activa: {current!r} -> skip (target {nombre!r})")
            return

        _log(f"cambiando empresa: {current!r} -> {nombre!r}")

        # 1) Abrir modal via .current-empresa (boton del header) o fallback texto
        try:
            await page.locator(".current-empresa").first.click(timeout=STEP_TIMEOUT)
        except Exception as e1:
            _log(f"click .current-empresa fallo ({e1}); fallback texto 'Empresa'")
            try:
                await page.get_by_text("Empresa", exact=True).first.click(timeout=STEP_TIMEOUT)
            except Exception as e2:
                _log(f"fallback 'Empresa' tambien fallo ({e2})")
        await page.wait_for_timeout(1500)

        if not await self._modal_empresa_visible():
            _log("no se pudo abrir el modal 'Seleccionar Empresa' - se sigue con empresa actual")
            return

        # 2) scrollIntoView + click .p-checkbox-box
        #    NOTA: NO se usa el filtro/buscador (ver punto 1 del docstring).
        #    Se itera sobre todos los cards del DOM y se usa scrollIntoView para
        #    traer el elegido al viewport antes de clickear.
        result = await page.evaluate(
            """(nombre) => {
                const norm = s => (s || '')
                    .normalize('NFD')
                    .replace(/[\u0300-\u036f]/g, '')
                    .replace(/[^a-zA-Z0-9]/g, '')
                    .toUpperCase();
                const target = norm(nombre);

                const cards = [...document.querySelectorAll('.card-empresa')]
                    .filter(c => c.offsetParent !== null);

                // isLeaf: card sin badge de sucursales (o badge vacio)
                const isLeaf = c => {
                    const badge = c.querySelector('.card-empresa-sucursales-cantidad');
                    return !badge || !badge.textContent.trim();
                };

                const matchExact  = cards.filter(c => {
                    const n = c.querySelector('.card-empresa-name');
                    return n && norm(n.textContent) === target;
                });
                const matchSubstr = cards.filter(c => {
                    const n = c.querySelector('.card-empresa-name');
                    if (!n) return false;
                    const t = norm(n.textContent);
                    return t && t !== target && (t.includes(target) || target.includes(t));
                });

                const pick = arr => arr.find(isLeaf) || arr[0];
                let best = pick(matchExact);
                let how  = matchExact.length ? 'exact' : null;
                if (!best) { best = pick(matchSubstr); how = best ? 'substr' : null; }
                if (!best) return {ok: false, total: cards.length, msg: 'no card for ' + target};

                // scrollIntoView ANTES del click (fix: items fuera del fold)
                best.scrollIntoView({block: 'center', behavior: 'instant'});

                const txt = best.querySelector('.card-empresa-name')?.textContent.trim() || '?';
                const cb  = best.querySelector('.p-checkbox-box');
                if (cb) {
                    cb.click();  // PrimeNG checkbox -> activa Angular
                    return {ok: true, how, clicked: 'p-checkbox-box', txt, total: cards.length};
                }
                // Fallback: click directo al card (menos confiable)
                best.click();
                return {ok: true, how, clicked: 'card-fallback', txt, total: cards.length};
            }""",
            nombre,
        )
        clicked = bool(result and result.get("ok"))
        _log(f"empresa {nombre!r}: {'OK' if clicked else 'FAIL'} {result}")
        await page.wait_for_timeout(1500)

        # 3) Sub-modal "Sucursales de X" (solo para agrupadores)
        if clicked:
            sub = await page.evaluate(
                """(nombre) => {
                    const norm = s => (s || '')
                        .normalize('NFD')
                        .replace(/[\u0300-\u036f]/g, '')
                        .replace(/[^a-zA-Z0-9]/g, '')
                        .toUpperCase();
                    const target = norm(nombre);
                    const panes = [...document.querySelectorAll('.cdk-overlay-pane')]
                        .filter(p => p.offsetParent !== null
                            && /Sucursales de/i.test(p.textContent || ''));
                    if (!panes.length) return {present: false};
                    const pane = panes[panes.length - 1];
                    const cards = [...pane.querySelectorAll('.card-sucursal, .card-empresa')]
                        .filter(c => c.offsetParent !== null);
                    let best = cards.find(c => {
                        const n = c.querySelector('.card-sucursal-name, .card-empresa-name');
                        return n && norm(n.textContent) === target;
                    }) || cards[0];
                    if (!best) return {present: true, ok: false, total: cards.length};
                    best.scrollIntoView({block: 'center', behavior: 'instant'});
                    const txt = best.querySelector('.card-sucursal-name, .card-empresa-name')
                                    ?.textContent.trim() || '?';
                    const cb  = best.querySelector('.p-checkbox-box');
                    if (cb) {
                        cb.click();
                        return {present: true, ok: true, clicked: 'p-checkbox-box', txt};
                    }
                    best.click();
                    return {present: true, ok: true, clicked: 'card-fallback', txt};
                }""",
                nombre,
            )
            if sub and sub.get("present"):
                _log(f"sub-modal Sucursales: {sub}")
                await page.wait_for_timeout(1500)

        # 4) Cerrar modal si por algun motivo sigue abierto
        if await self._modal_empresa_visible():
            try:
                await page.keyboard.press("Escape")
                await page.wait_for_timeout(800)
            except Exception:
                pass

        # 5) Verificar empresa activa en el header
        header = await self.get_header_empresa()
        if header and self._normalize_empresa(header) == self._normalize_empresa(nombre):
            _log(f"empresa cambiada OK: {header!r}")
        else:
            _log(f"AVISO: header={header!r}, esperaba={nombre!r} (puede ser OK si la empresa tiene sucursales)")

    # ------------------------------------------------------------------
    # NavegaciÃ³n a Facturas de Compra + resoluciÃ³n del iframe
    # ------------------------------------------------------------------

    async def goto_facturas(self):
        # La navegación cierra cualquier modal que pudiese haber quedado abierto
        # por un crash previo.  Resetear el flag evita que _scope_selector()
        # devuelva "#dfLine_popup " cuando el popup ya no existe en el DOM,
        # lo que causaría "no-scope" en todos los set_text/set_selector del
        # siguiente formulario.
        self._modal_open = False
        await self.page.goto(FINNEGANS_FACTURAS_URL, wait_until="load")
        await self._resolve_frame()
        _log(f"iframe de contenido: {self._frame.url}")
        await self.screenshot("facturas_list")

    async def _resolve_frame(self, marker: str = "Nuevo", timeout_s: int = 90) -> Frame:
        """Espera y devuelve el iframe (no-main) cuyo body contiene `marker`."""
        deadline = time.monotonic() + timeout_s
        while time.monotonic() < deadline:
            for fr in self.page.frames:
                if fr == self.page.main_frame:
                    continue
                try:
                    ok = await fr.evaluate(
                        "(m) => !!document.body && (document.body.textContent || '').includes(m)",
                        marker,
                    )
                    if ok:
                        self._frame = fr
                        return fr
                except Exception:
                    pass
            await self.page.wait_for_timeout(1000)
        raise RuntimeError("No se encontrÃ³ el iframe de contenido de FinnegansGO")

    # ------------------------------------------------------------------
    # Crear nueva factura
    # ------------------------------------------------------------------

    async def open_nueva_factura(self, workflow: str = WORKFLOW_DEFAULT):
        """Nuevo â†’ Factura de Compra â†’ selecciona workflow â†’ Siguiente."""
        # Garantia defensiva: si un crash previo dejo _modal_open=True (por ej.
        # una excepcion dentro de grid_add_row sin llegar a modal_aceptar),
        # resetear aca asegura que _scope_selector() no use "#dfLine_popup"
        # en el nuevo formulario (causaria "no-scope" en todos los campos).
        self._modal_open = False
        frame = self.frame

        # BotÃ³n "Nuevo" de la toolbar
        await frame.get_by_role("link", name="Nuevo").first.click(timeout=STEP_TIMEOUT)

        # Item "Factura de Compra" del dropdown (texto exacto, no rol listitem que falla)
        fc = frame.get_by_text("Factura de Compra", exact=True).first
        await fc.wait_for(state="visible", timeout=STEP_TIMEOUT)
        await fc.click()

        # Modal "Seleccione el Workflow con el cual desea operar".
        # Los radios y sus textos son nodos sueltos dentro de una misma celda
        # (no hay un elemento cuyo texto sea exactamente el del workflow), asÃ­ que
        # se selecciona el radio vÃ­a JS: text node del workflow â†’ radio que lo precede.
        await frame.get_by_text("Seleccione el Workflow").first.wait_for(
            state="visible", timeout=STEP_TIMEOUT
        )
        res = await frame.evaluate(
            """(workflow) => {
                const walker = document.createTreeWalker(
                    document.body, NodeFilter.SHOW_TEXT, null);
                let node;
                while ((node = walker.nextNode())) {
                    if (node.textContent.trim() === workflow) {
                        let el = node.previousSibling;
                        while (el && !(el.tagName === 'INPUT' && el.type === 'radio'))
                            el = el.previousSibling;
                        if (el) { el.click(); return 'ok'; }
                        return 'radio-not-found';
                    }
                }
                return 'text-not-found';
            }""",
            workflow,
        )
        _log(f"workflow {workflow!r} â†’ radio: {res}")
        if res != "ok":
            _log("aviso: no se pudo marcar el radio del workflow; se usa el default del modal")
        await frame.wait_for_timeout(600)

        await frame.get_by_text("Siguiente", exact=True).first.click(timeout=STEP_TIMEOUT)

        # El formulario quedÃ³ cargado cuando aparece el widget de Fecha
        await frame.locator('div.widget[name="wdg_Fecha"]').wait_for(state="visible", timeout=TIMEOUT)
        await frame.wait_for_timeout(2000)
        _log(f"formulario abierto (workflow: {workflow})")
        await self.screenshot("formulario_nuevo")

    # ------------------------------------------------------------------
    # Helpers de campos  (todos operan sobre self.frame)
    # ------------------------------------------------------------------
    #
    # IMPLEMENTACIÃ“N: los inputs no tienen id/name y muchos tienen mÃ¡scaras o
    # comportamientos custom que pelean contra `fill()` / `type()` de Playwright.
    # Estrategia confiable (verificada en vivo con MCP):
    #
    #   - set_text:      JS native setter + eventos input/change/keyup/blur.
    #                    Aguanta bien las mÃ¡scaras (ej. Nro. Comprobante).
    #   - set_selector:  tipear char-por-char vÃ­a JS disparando keydown/input/keyup
    #                    para activar el autocomplete; el dropdown real es
    #                    `tr[recordid]` (NO el primer tr, que es de layout).
    #                    El click de la fila se hace por JS.
    #   - set_fecha:     JS native setter en cada uno de los 3 inputs day/month/year.
    #
    # Si hay un modal de grilla abierto (#dfLine_popup), los lookups por wdg
    # se scopean a ese popup para evitar colisiones (p.ej. hay un wdg_Descripcion
    # tanto en la cabecera como en el modal de Retenciones).
    # ------------------------------------------------------------------

    def _widget(self, wdg: str):
        if self._modal_open:
            return self.frame.locator(f'#dfLine_popup div.widget[name="{wdg}"]')
        return self.frame.locator(f'div.widget[name="{wdg}"]')

    def _scope_selector(self) -> str:
        """Prefijo CSS para querySelector segÃºn haya o no un modal abierto."""
        return "#dfLine_popup " if self._modal_open else ""

    async def set_text(self, wdg: str, value, verify: bool = False):
        """Setea un campo de texto/nÃºmero usando el setter nativo + eventos.
        Aguanta mÃ¡scaras (p.ej. wdg_NumeroDocumento = 'A-_____-________').

        Si `verify=True`, lee el valor del input despuÃ©s de setear y compara
        contra el value enviado. Si no coincide, ABORTA con RuntimeError â€”
        Ãºtil para campos enmascarados donde Finnegans puede reformatear de
        forma inesperada (ver investigaciÃ³n MCP: si el PV del Nro Comprobante
        no tiene exactamente 5 dÃ­gitos, Finnegans corrompe el valor)."""
        if value is None or value == "":
            return
        value = str(value)
        scope = self._scope_selector()
        result = await self.frame.evaluate(
            """({scope, wdg, value}) => {
                const root = scope ? document.querySelector(scope.trim()) : document;
                if (!root) return 'no-scope';
                const inp = root.querySelector(`div.widget[name="${wdg}"] input`);
                if (!inp) return 'no-input';
                const setter = Object.getOwnPropertyDescriptor(
                    window.HTMLInputElement.prototype, 'value').set;
                inp.focus();
                setter.call(inp, value);
                inp.dispatchEvent(new Event('input', { bubbles: true }));
                inp.dispatchEvent(new Event('change', { bubbles: true }));
                inp.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
                inp.blur();
                inp.dispatchEvent(new Event('blur', { bubbles: true }));
                return 'ok:' + inp.value;
            }""",
            {"scope": scope, "wdg": wdg, "value": value},
        )
        await self.frame.wait_for_timeout(300)
        _log(f"set_text {wdg} = {value!r} â†’ {result}")
        if verify and isinstance(result, str) and result.startswith("ok:"):
            got = result[3:]
            if got != value:
                raise RuntimeError(
                    f"set_text(verify) MISMATCH en {wdg}: enviado={value!r} "
                    f"pero el input quedÃ³ con {got!r}. Posible bug de mÃ¡scara: "
                    f"revisar el formato (PV/NUM dÃ­gitos)."
                )

    async def set_selector(self, wdg: str, search: str, expected: Optional[str] = None):
        """Selector con autocompletar: tipea `search` carÃ¡cter por carÃ¡cter
        (vÃ­a JS, para que el autocomplete dispare de verdad) y selecciona la
        fila del dropdown (`tr[recordid]`).

        Si `expected` estÃ¡, busca la fila cuyo texto normalizado coincide con
        `expected` normalizado (ignora puntos, espacios, mayÃºsculas, Ã‘â†”N).
        Sino, toma la PRIMERA fila (comportamiento legacy).

        Esto es CRÃTICO cuando el dropdown trae mÃºltiples coincidencias
        parciales (ej. tipear 'PROVIDERS' devuelve `PROVIDERS S.A. - OT`,
        `PROVIDERS S.A.`, `PROVIDERS - AGUILARES INTER SAS`...). Sin
        `expected`, se elegirÃ­a la primera (mal). Con `expected='PROVIDERS S.A.'`,
        se elige la correcta.
        """
        if not search:
            return
        search = str(search)
        scope = self._scope_selector()

        # 0) Guarda: capturar empresa activa antes de tocar el campo. Si despuÃ©s
        # del set la empresa cambia, es un bug grave (puede pasar si Finnegans
        # malinterpreta el click sobre una fila que coincide con la empresa
        # activa, o si un modal de empresa estaba abierto). Abortamos para
        # NO seguir cargando una factura corrupta en una empresa equivocada.
        empresa_antes = await self.get_header_empresa()

        _type_js = """({scope, wdg, search}) => {
                const root = scope ? document.querySelector(scope.trim()) : document;
                if (!root) return 'no-scope';
                const inp = root.querySelector(`div.widget[name="${wdg}"] input`);
                if (!inp) return 'no-input';
                inp.scrollIntoView({block: 'center'});
                inp.focus();
                inp.click();
                const setter = Object.getOwnPropertyDescriptor(
                    window.HTMLInputElement.prototype, 'value').set;
                setter.call(inp, '');
                inp.dispatchEvent(new Event('input', { bubbles: true }));
                for (const ch of search) {
                    setter.call(inp, inp.value + ch);
                    inp.dispatchEvent(new KeyboardEvent('keydown', { key: ch, bubbles: true }));
                    inp.dispatchEvent(new Event('input', { bubbles: true }));
                    inp.dispatchEvent(new KeyboardEvent('keyup', { key: ch, bubbles: true }));
                }
                return 'typed:' + inp.value;
            }"""

        # 1+2) Tipear y esperar el dropdown. Algunos selectores (ej.
        # wdg_ProvinciaOrigen) son flaky: el autocomplete a veces no dispara en
        # el primer tipeo si el campo recién se habilitó. Reintentamos el tipeo
        # una vez antes de rendirnos.
        rows = self.frame.locator("div.selectorContent tr[recordid]:visible")
        rows_aparecieron = False
        for intento in range(1, 3):
            typed = await self.frame.evaluate(
                _type_js, {"scope": scope, "wdg": wdg, "search": search}
            )
            if not typed.startswith("typed"):
                _log(f"set_selector {wdg}: no se pudo tipear ({typed})")
                return
            try:
                await rows.first.wait_for(state="visible", timeout=15_000)
                rows_aparecieron = True
                break
            except Exception:
                if intento < 2:
                    _log(
                        f"set_selector {wdg}: no aparecieron filas para {search!r} "
                        f"(intento {intento}); reintentando tipeo tras espera."
                    )
                    await self.frame.wait_for_timeout(3000)
        if not rows_aparecieron:
            _log(f"set_selector {wdg}: NO aparecieron filas para {search!r}")
            return

        # 3) EstabilizaciÃ³n: esperar a que la lista deje de cambiar
        await self.frame.wait_for_timeout(1500)
        prev = -1
        for _ in range(5):
            n = await rows.count()
            if n == prev:
                break
            prev = n
            await self.frame.wait_for_timeout(500)

        # 4) Elegir y clickear la fila â€” TODO con locators de Playwright.
        #    El acceso a elementos vÃ­a frame.evaluate es NO confiable en este
        #    iframe legacy (Prototype.js pisa textContent/click â†’ valores
        #    intermitentes). Playwright lee el texto y clickea a nivel
        #    navegador, lo cual SÃ gatilla el handler de selecciÃ³n de Finnegans.
        rows_loc = self.frame.locator("div.selectorContent tr[recordid]:visible")
        texts: list[str] = []
        try:
            nrows = await rows_loc.count()
            for i in range(nrows):
                txt = await rows_loc.nth(i).text_content()
                texts.append(txt or "")
        except Exception as exc:
            _log(f"set_selector {wdg}: no se pudieron leer filas ({exc})")
            return

        # Indices de filas con texto real (descarta stale/vacÃ­as).
        candidatos = [(i, t) for i, t in enumerate(texts) if t and t.strip()]
        if not candidatos:
            _log(f"set_selector {wdg}: typed {search!r} â†’ sin filas con texto (n={len(texts)})")
            return

        elegido_idx = None
        how = "first"
        if expected:
            target = _norm_text(expected)
            # match exacto normalizado
            for i, t in candidatos:
                if _norm_text(t) == target:
                    elegido_idx, how = i, "expected-exact"
                    break
            # prefijo (target empieza fila o viceversa) â€” "PROVIDERS S.A." vs "...- OT"
            if elegido_idx is None:
                for i, t in candidatos:
                    nt = _norm_text(t)
                    if nt and (nt.startswith(target) or target.startswith(nt)):
                        elegido_idx, how = i, "expected-prefix"
                        break
        if elegido_idx is None:
            elegido_idx = candidatos[0][0]
            how = "fallback-first" if expected else "first"

        elegido_txt = " ".join(texts[elegido_idx].split())[:80]
        clicked_ok = False
        try:
            await rows_loc.nth(elegido_idx).click(timeout=STEP_TIMEOUT)
            clicked_ok = True
        except Exception as exc:
            _log(f"set_selector {wdg}: click nth({elegido_idx}) fallÃ³ ({exc})")

        await self.frame.wait_for_timeout(1500)  # esperar el re-render del form
        _log(
            f"set_selector {wdg}: typed {search!r}"
            + (f" expected {expected!r}" if expected else "")
            + f" â†’ clicked(n={len(texts)},idx={elegido_idx},{how},ok={clicked_ok}):{elegido_txt!r}"
        )

        # 5) VerificaciÃ³n: la EMPRESA del header NO debe haber cambiado.
        # Si cambiÃ³, set_selector accidentalmente accionÃ³ el modal de empresa
        # del header. Abortamos limpio en vez de seguir cargando una factura
        # corrupta en la empresa equivocada.
        empresa_despues = await self.get_header_empresa()
        if (
            empresa_antes
            and empresa_despues
            and self._normalize_empresa(empresa_antes)
            != self._normalize_empresa(empresa_despues)
        ):
            raise RuntimeError(
                f"set_selector {wdg!r} CAMBIÃ“ la empresa del header: "
                f"{empresa_antes!r} â†’ {empresa_despues!r}. Esto indica un "
                f"side-effect indeseado al elegir la fila (typed={search!r}, "
                f"expected={expected!r}, result={result!r}). Investigar."
            )

    async def set_fecha(self, wdg: str, d: date):
        """Setea una fecha (3 inputs day/month/year) vÃ­a JS native setter."""
        scope = self._scope_selector()
        await self.frame.evaluate(
            """({scope, wdg, d, m, y}) => {
                const root = scope ? document.querySelector(scope.trim()) : document;
                if (!root) return;
                const w = root.querySelector(`div.widget[name="${wdg}"]`);
                if (!w) return;
                const setter = Object.getOwnPropertyDescriptor(
                    window.HTMLInputElement.prototype, 'value').set;
                const set = (name, val) => {
                    const inp = w.querySelector(`input[name="${name}"]`);
                    if (!inp) return;
                    inp.focus();
                    setter.call(inp, val);
                    inp.dispatchEvent(new Event('input', { bubbles: true }));
                    inp.dispatchEvent(new Event('change', { bubbles: true }));
                };
                set('day', d); set('month', m); set('year', y);
            }""",
            {"scope": scope, "wdg": wdg,
             "d": f"{d.day:02d}", "m": f"{d.month:02d}", "y": str(d.year)},
        )
        await self.frame.wait_for_timeout(200)
        _log(f"set_fecha {wdg} = {d.isoformat()}")

    async def set_text_keyboard(self, wdg: str, value):
        """Setea un campo numérico usando input de teclado real (click → type → Tab).

        Los campos numéricos dentro del modal de ítems (#dfLine_popup) —
        wdg_Precio, wdg_CantidadWorkflow, wdg_ImporteRetencion — no responden
        al setter JS de set_text: el valor aparece en el DOM pero Finnegans no
        lo registra y el campo vuelve a 0 al hacer Aceptar.
        Confirmado con MCP Playwright 2026-05-29: pressSequentially + Tab sí
        commitea el valor correctamente.
        """
        if value is None or value == "":
            return
        value = str(value)
        inp = self._widget(wdg).locator("input").first

        def _to_num(s: str):
            # Normaliza un importe a float tolerando formato AR ("709.645,30"),
            # formato US ("709,645.30") y simple ("709645.3"). Trata el ÚLTIMO
            # separador como decimal y elimina el resto (miles).
            raw = re.sub(r"[^\d.,]", "", str(s or ""))
            if not raw:
                return None
            last_sep = max(raw.rfind("."), raw.rfind(","))
            if last_sep == -1:
                ent, dec = raw, ""
            else:
                ent = re.sub(r"[.,]", "", raw[:last_sep])
                dec = re.sub(r"[.,]", "", raw[last_sep + 1:])
            try:
                return round(float(f"{ent or 0}.{dec or 0}"), 2)
            except ValueError:
                return None

        target_num = _to_num(value)

        committed = ""
        for intento in range(1, 4):
            # Limpiar el campo de forma fiable: foco + seleccionar todo + borrar.
            await inp.click()
            await self.frame.wait_for_timeout(120)
            await inp.press("Control+a")
            await inp.press("Delete")
            await self.frame.wait_for_timeout(120)
            # delay alto en el primer carácter para que el campo no se "coma"
            # los primeros dígitos en headless.
            await inp.press_sequentially(value, delay=60)
            await self.frame.wait_for_timeout(150)
            await inp.press("Tab")
            await self.frame.wait_for_timeout(250)

            committed = await inp.input_value()
            committed_num = _to_num(committed)
            if target_num is None or committed_num == target_num:
                _log(f"set_text_keyboard {wdg} = {value!r} (commit ok intento {intento})")
                return
            _log(
                f"set_text_keyboard {wdg}: reintento {intento} — "
                f"esperaba {value!r} pero el campo quedó {committed!r}"
            )

        raise RuntimeError(
            f"set_text_keyboard {wdg}: no se pudo commitear {value!r}; "
            f"último valor leído del campo: {committed!r}"
        )

    async def set_select_native(self, wdg: str, label: str):
        """Campo <select> nativo."""
        if not label:
            return
        await self._widget(wdg).locator("select").select_option(label=label)
        _log(f"set_select_native {wdg} = {label!r}")

    async def wait_field_enabled(self, wdg: str, timeout_ms: int = 15_000) -> bool:
        """Espera hasta que el input del widget deje de estar disabled."""
        inp = self._widget(wdg).locator("input").first
        deadline = time.monotonic() + timeout_ms / 1000
        while time.monotonic() < deadline:
            try:
                if not await inp.is_disabled():
                    return True
            except Exception:
                pass
            await self.frame.wait_for_timeout(500)
        _log(f"wait_field_enabled {wdg}: sigue disabled tras {timeout_ms}ms")
        return False

    # ------------------------------------------------------------------
    # PestaÃ±as y grillas
    # ------------------------------------------------------------------

    async def click_tab(self, texto: str):
        # Si queda abierta una minilista de autocomplete, su overlay
        # (`#minilista-CloseArea`) intercepta los clicks sobre las tabs.
        # Cerrarla antes de intentar clickear evita timeouts espurios.
        try:
            await self.frame.evaluate(
                """() => {
                    const close = document.querySelector('#minilista-CloseArea');
                    if (close && close.offsetParent !== null) {
                        close.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
                        close.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
                    }
                }"""
            )
            await self.frame.wait_for_timeout(250)
        except Exception:
            pass
        tab = self.frame.locator("div.tab", has_text=texto).first
        await tab.click(timeout=STEP_TIMEOUT)
        await self.frame.wait_for_timeout(1000)
        _log(f"tab â†’ {texto!r}")

    async def grid_add_row(self):
        """Click en el botÃ³n amarillo '+' (newButton) de la grilla visible â†’ abre el modal."""
        btn = self.frame.locator("table thead .newButton >> visible=true").first
        await btn.click(timeout=STEP_TIMEOUT)
        await self.frame.locator("#dfLine_popup").wait_for(state="visible", timeout=STEP_TIMEOUT)
        await self.frame.wait_for_timeout(900)
        self._modal_open = True
        _log("grid_add_row â†’ modal abierto")

    async def modal_aceptar(self):
        """Click 'Aceptar' en el modal de grilla y espera a que el modal se cierre."""
        popup = self.frame.locator("#dfLine_popup")
        # Si hay minilista abierta, intercepta el click del botÃ³n Aceptar.
        try:
            await self.frame.evaluate(
                """() => {
                    const close = document.querySelector('#minilista-CloseArea');
                    if (close && close.offsetParent !== null) {
                        close.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
                        close.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
                        // Hard fallback: ocultar overlay si sigue interceptando.
                        close.style.pointerEvents = 'none';
                        close.style.display = 'none';
                    }
                }"""
            )
            await self.frame.wait_for_timeout(200)
        except Exception:
            pass
        try:
            await popup.get_by_text("Aceptar", exact=True).first.click(timeout=STEP_TIMEOUT)
        except Exception:
            # Fallback robusto para UI legacy: click JS directo al botÃ³n aceptar.
            await self.frame.evaluate(
                """() => {
                    const p = document.querySelector('#dfLine_popup');
                    if (!p) return;
                    let btn = [...p.querySelectorAll('a,button')]
                        .find(e => (e.textContent || '').trim() === 'Aceptar');
                    if (!btn) {
                        btn = [...p.querySelectorAll('span,div')]
                            .find(e => (e.textContent || '').trim() === 'Aceptar');
                    }
                    if (btn) {
                        if (typeof btn.click === 'function') {
                            btn.click();
                        } else if (typeof btn.dispatchEvent === 'function') {
                            btn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
                            btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
                        }
                    }
                }"""
            )
        try:
            await popup.wait_for(state="hidden", timeout=TIMEOUT)
        except Exception:
            # fallback: esperar a que el overlay deje de interceptar
            try:
                await self.frame.locator("#lightBox").wait_for(state="hidden", timeout=10_000)
            except Exception:
                pass
        self._modal_open = False
        await self.frame.wait_for_timeout(700)
        _log("modal_aceptar OK")

    async def modal_cancelar(self):
        popup = self.frame.locator("#dfLine_popup")
        await popup.get_by_text("Cancelar", exact=True).first.click()
        try:
            await popup.wait_for(state="hidden", timeout=15_000)
        except Exception:
            pass
        self._modal_open = False
        await self.frame.wait_for_timeout(500)

    async def click_modal_subtab(self, texto: str):
        """Click en una sub-pestaÃ±a dentro del modal de grilla (#dfLine_popup).
        Ej. 'Dimensiones' en el modal Nuevo item."""
        if not self._modal_open:
            raise RuntimeError("No hay un modal abierto para hacer click en sub-pestaÃ±as")
        await self.frame.evaluate(
            """(texto) => {
                const tab = [...document.querySelectorAll('#dfLine_popup div.tab')].filter(
                    t => t.textContent.trim().normalize('NFC') === texto.normalize('NFC'))[0];
                if (tab) tab.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
            }""",
            texto,
        )
        await self.frame.wait_for_timeout(800)
        _log(f"modal sub-tab â†’ {texto!r}")

    # ------------------------------------------------------------------
    # Dimensiones (Centro de Costos) â€” sub-pestaÃ±a del modal Items
    # ------------------------------------------------------------------
    #
    # Los inputs de Dimensiones NO usan el patrÃ³n div.widget[name="wdg_*"].
    # Para items NUEVOS el sufijo numÃ©rico del nombre es siempre 999999.
    # Para Ã­tems existentes (ediciÃ³n) es el ID real del item â€” no aplica acÃ¡.

    async def _wait_modal_dimension_inputs(self, timeout_ms: int = 12_000):
        popup = self.frame.locator("#dfLine_popup")
        dim_inputs = popup.locator(
            "input[name*='SELECTORDIMENSION'][name*='DISTRIBUCION'][name*='_TXT_VIS']:visible"
        )
        try:
            await dim_inputs.first.wait_for(state="visible", timeout=timeout_ms)
        except Exception:
            return dim_inputs, 0
        return dim_inputs, await dim_inputs.count()

    async def set_dimension_centro_costos(self, row: int = 0, search: str = ""):
        """Selecciona el Centro de Costos en la fila `row` de la sub-pestaÃ±a
        Dimensiones del modal Items.

        Si `search` estÃ¡ vacÃ­o, tipea 'a' como wildcard para abrir el dropdown
        y elige el PRIMER resultado (Ãºtil mientras no tengamos el mapeo real
        empresa â†’ centro de costos).
        """
        search = (search or "").strip() or "a"

        dim_inputs = None
        count = 0
        for attempt in range(1, 4):
            if attempt > 1:
                _log(
                    f"set_dimension_centro_costos[row={row}]: reintento {attempt}/3 "
                    "abriendo sub-tab Dimensiones"
                )
                await self.click_modal_subtab("Dimensiones")
            dim_inputs, count = await self._wait_modal_dimension_inputs(timeout_ms=12_000)
            if count > 0:
                break
            await self.frame.wait_for_timeout(1200)

        if not dim_inputs or count == 0:
            # AVISO (no RuntimeError): algunos productos/workflows no tienen la
            # dimension DISTRIBUCION configurada (ej. 'Recaudacion' en ciertas
            # empresas). En ese caso se continua sin CC para no abortar la carga;
            # el item queda guardado sin dimension — verificar manualmente.
            _log(
                f"set_dimension_centro_costos[row={row}]: no-input-dimension "
                "(no se encontro input SELECTORDIMENSION*DISTRIBUCION*_TXT_VIS) "
                "— se omite CC y se continua"
            )
            return

        picked = dim_inputs.first
        picked_name = await picked.get_attribute("name")
        # Preferir el input que corresponde a la fila solicitada.
        for i in range(count):
            n = await dim_inputs.nth(i).get_attribute("name")
            if n and f"DISTRIBUCION{row}_TXT_VIS" in n:
                picked = dim_inputs.nth(i)
                picked_name = n
                break

        try:
            await picked.click(timeout=STEP_TIMEOUT)
            await picked.fill("")
            await picked.type(search, delay=50)
        except Exception as exc:
            _log(f"set_dimension_centro_costos[row={row}]: fallo al tipear ({exc})")
            return
        _log(
            f"set_dimension_centro_costos[row={row}]: typed {search!r} "
            f"en input name={picked_name!r}"
        )
        # Flujo simple: aparece un Ãºnico resultado -> clickear ese resultado.
        rows_loc = self.frame.locator("div.selectorContent tr[recordid]:visible")
        try:
            await rows_loc.first.wait_for(state="visible", timeout=15_000)
        except Exception:
            _log(f"set_dimension_centro_costos[row={row}]: NO apareciÃ³ dropdown ({search!r})")
            return

        clicked_ok = False
        elegido_txt = ""
        try:
            first_row = rows_loc.first
            chosen_cell = first_row.locator("td").first
            if await chosen_cell.count() > 0:
                elegido_txt = " ".join(((await first_row.text_content()) or "").split())[:80]
                await chosen_cell.click(timeout=STEP_TIMEOUT)
            else:
                elegido_txt = " ".join(((await first_row.text_content()) or "").split())[:80]
                await first_row.click(timeout=STEP_TIMEOUT)
            clicked_ok = True
        except Exception as exc:
            _log(f"set_dimension_centro_costos[row={row}]: click fila resultado fallÃ³ ({exc})")
        # Confirmar selecciÃ³n y cerrar minilista del autocomplete para que no
        # intercepte luego el click de "Aceptar" del modal.
        try:
            await self.frame.keyboard.press("Enter")
        except Exception:
            pass
        try:
            await self.frame.evaluate(
                """() => {
                    const close = document.querySelector('#minilista-CloseArea');
                    if (close && close.offsetParent !== null) {
                        close.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
                        close.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
                    }
                }"""
            )
        except Exception:
            pass
        await self.frame.wait_for_timeout(1200)
        _log(
            f"set_dimension_centro_costos[row={row}]: {search!r} â†’ "
            f"clicked_first(ok={clicked_ok}):{elegido_txt!r}"
        )

    # ------------------------------------------------------------------
    # Lectura de campos calculados / totales
    # ------------------------------------------------------------------

    async def get_field_value(self, wdg: str) -> str:
        """Devuelve el valor actual del input de un widget (como string)."""
        try:
            return await self.frame.locator(
                f'div.widget[name="{wdg}"] input'
            ).first.input_value(timeout=STEP_TIMEOUT)
        except Exception:
            return ""

    async def get_total_calculado(self) -> float:
        """Lee el campo wdg_Total (calculado, disabled) y lo devuelve como float."""
        v = await self.get_field_value("wdg_Total")
        return _parse_numero(v)

    async def dump_diag(self, etiqueta: str = "diag") -> None:
        """DIAGNÓSTICO: vuelca todos los widgets cuyo nombre contiene 'Total' o
        'Importe', el contenido del grid de Items, y saca un screenshot de la
        pestaña Items. Solo para depurar el descuadre de control en headless."""
        try:
            info = await self.frame.evaluate(
                """() => {
                    const out = { widgets: [], items: [] };
                    // 1. Todos los inputs cuyo widget tiene 'Total'/'Importe' en el name.
                    document.querySelectorAll('div.widget[name]').forEach(w => {
                        const name = w.getAttribute('name') || '';
                        if (/total|importe/i.test(name)) {
                            const inp = w.querySelector('input');
                            out.widgets.push({
                                name,
                                value: inp ? inp.value : null,
                                visible: w.offsetParent !== null,
                            });
                        }
                    });
                    // 2. Filas de cualquier grid con recordid (items/retenciones).
                    document.querySelectorAll('tr[recordid]').forEach(tr => {
                        if (tr.offsetParent === null) return;
                        const cells = [...tr.querySelectorAll('td')]
                            .map(td => (td.textContent || '').trim())
                            .filter(t => t.length);
                        if (cells.length) out.items.push(cells.join(' | '));
                    });
                    return out;
                }"""
            )
            _log(f"[DIAG {etiqueta}] widgets Total/Importe:")
            for w in info.get("widgets", []):
                vis = "" if w.get("visible") else " (oculto)"
                _log(f"[DIAG {etiqueta}]   {w['name']} = {w['value']!r}{vis}")
            _log(f"[DIAG {etiqueta}] filas de grids (tr[recordid] visibles):")
            for row in info.get("items", []):
                _log(f"[DIAG {etiqueta}]   {row}")
        except Exception as exc:  # noqa: BLE001
            _log(f"[DIAG {etiqueta}] dump_diag falló: {exc}")
        # Screenshot de la pestaña Items (el grid de ítems con sus importes).
        try:
            await self.click_tab("Items")
            await self.frame.wait_for_timeout(800)
            await self.screenshot(f"DIAG_{etiqueta}_items")
        except Exception as exc:  # noqa: BLE001
            _log(f"[DIAG {etiqueta}] no se pudo capturar tab Items: {exc}")

    # ------------------------------------------------------------------
    # Guardar (borrador) y Adjuntar PDF
    # ------------------------------------------------------------------

    async def _leer_estado_documento(self) -> dict:
        """Lee el estado del documento para confirmar si el guardado persistió.

        Según la documentación validada (DOCUMENTACION_ADJUNTAR_PDF_FINNEGANS.md,
        sección "Validacion de guardado exitoso"), un guardado exitoso transiciona
        el título de:
            Nuevo - Factura de Compra
        a:
            Factura de Compra - <numero>   (ej. "Factura de Compra - 52257")
        y deja disponible el botón Adjuntar (#_onFileAttach).

        Devuelve {nro, es_nuevo, attach_disponible}:
          - nro: nº interno asignado por Finnegans (str) o None si no se detectó.
          - es_nuevo: True si el documento sigue como "Nuevo - Factura de Compra".
          - attach_disponible: True si #_onFileAttach existe en el DOM.
        """
        try:
            return await self.frame.evaluate(
                """() => {
                    const body = (document.body && document.body.textContent) || '';
                    // Número interno: "Factura de Compra - 52257" (guion normal o largo).
                    const m = body.match(/Factura de Compra\\s*[-\\u2013]\\s*(\\d{2,})/);
                    // Aún "Nuevo - Factura de Compra" → guardado no confirmado.
                    const esNuevo = /Nuevo\\s*[-\\u2013]\\s*Factura de Compra/i.test(body);
                    const attach = !!document.querySelector('#_onFileAttach');
                    return { nro: m ? m[1] : null, es_nuevo: esNuevo, attach_disponible: attach };
                }"""
            )
        except Exception as exc:  # noqa: BLE001
            _log(f"_leer_estado_documento: no se pudo leer el estado ({exc})")
            return {"nro": None, "es_nuevo": False, "attach_disponible": False}

    async def save_draft(self) -> Optional[str]:
        """Click en 'Guardar' de la toolbar (deja la factura como borrador,
        editable). NO confunde con 'Finalizar', que bloquea el documento.

        Hace falta haber guardado al menos una vez antes de poder adjuntar.

        Devuelve el número interno asignado por Finnegans (str) si lo pudo leer,
        o None. Lanza SaveFailedError si NO se pudo confirmar el guardado (el
        documento sigue como "Nuevo"); en ese caso el caller NO debe adjuntar el
        PDF (regla crítica de DOCUMENTACION_ADJUNTAR_PDF_FINNEGANS.md).
        """
        # Uso .filter()[0] en vez de .find() porque .find() a veces devuelve
        # un wrapper que rompe al llamar .click() ("a.click is not a function").
        clicked = await self.frame.evaluate(
            """() => {
                const candidatos = [
                    '#_onFileSave',          // id estable conocido
                    '#_onSave',
                    'a.TOOLBARBtnStandard[id*="Save"]',
                ];
                for (const sel of candidatos) {
                    const el = document.querySelector(sel);
                    if (el) { el.click(); return 'sel:' + sel; }
                }
                // Fallback: link/toolbar con texto exacto 'Guardar' visible
                const links = [...document.querySelectorAll('a.TOOLBARBtnStandard, a')]
                    .filter(x => x.textContent.trim() === 'Guardar' && x.offsetParent !== null);
                if (links.length) { links[0].click(); return 'text:' + (links[0].id || 'no-id'); }
                return 'not-found';
            }"""
        )
        _log(f"save_draft: {clicked}")
        if clicked == "not-found":
            raise RuntimeError("No se encontró el botón 'Guardar' en la toolbar")
        # esperar a que el server procese el guardado
        await self.frame.wait_for_timeout(4000)

        # Detectar el dialog "Número de comprobante repetido" que Finnegans muestra
        # cuando se intenta guardar una factura con un número de comprobante que ya
        # existe para el mismo proveedor. El dialog tiene un botón 'Aceptar' (a.button)
        # y NO bloquea el guardado — clickear Aceptar descarta el aviso y el form
        # se guarda igualmente.
        # Confirmado con MCP Playwright 2026-05-29: el dialog aparece DENTRO del iframe.
        dup_text = await self.frame.evaluate(
            """() => {
                const btns = [...document.querySelectorAll('a.button')]
                    .filter(b => b.textContent.trim() === 'Aceptar'
                             && b.getBoundingClientRect().width > 0);
                if (!btns.length) return null;
                // Buscar texto del contenedor del dialog para saber de qué trata
                let container = btns[0];
                for (let i = 0; i < 5; i++) {
                    container = container.parentElement;
                    if (!container) break;
                    const t = (container.textContent || '').trim();
                    if (t.length > 20 && t.length < 500) return t;
                }
                return 'dialog-sin-texto';
            }"""
        )
        if dup_text:
            if "comprobante" in (dup_text or "").lower() or "repetido" in (dup_text or "").lower():
                _log(
                    f"AVISO: Finnegans detectó comprobante repetido al guardar. "
                    f"Texto: {dup_text[:120]!r}. Dismissing dialog."
                )
                try:
                    await self.frame.locator("a.button").filter(has_text="Aceptar").first.click(
                        timeout=5_000
                    )
                except Exception as exc:
                    _log(f"save_draft: no se pudo cerrar dialog comprobante repetido ({exc})")
                await self.frame.wait_for_timeout(1500)

                # Reintentar el guardado una vez más (Finnegans a veces bloquea en el
                # primer intento y permite el segundo tras el acknowledge).
                retry_clicked = await self.frame.evaluate(
                    """() => {
                        const candidatos = ['#_onFileSave', '#_onSave',
                            'a.TOOLBARBtnStandard[id*="Save"]'];
                        for (const sel of candidatos) {
                            const el = document.querySelector(sel);
                            if (el) { el.click(); return 'sel:' + sel; }
                        }
                        const links = [...document.querySelectorAll('a.TOOLBARBtnStandard, a')]
                            .filter(x => x.textContent.trim() === 'Guardar' && x.offsetParent !== null);
                        if (links.length) { links[0].click(); return 'text:' + (links[0].id || 'no-id'); }
                        return 'not-found';
                    }"""
                )
                _log(f"save_draft retry: {retry_clicked}")
                await self.frame.wait_for_timeout(4000)

                # Detectar si el dialog vuelve a aparecer (duplicado real).
                dup_text2 = await self.frame.evaluate(
                    """() => {
                        const btns = [...document.querySelectorAll('a.button')]
                            .filter(b => b.textContent.trim() === 'Aceptar'
                                     && b.getBoundingClientRect().width > 0);
                        if (!btns.length) return null;
                        let container = btns[0];
                        for (let i = 0; i < 5; i++) {
                            container = container.parentElement;
                            if (!container) break;
                            const t = (container.textContent || '').trim();
                            if (t.length > 20 && t.length < 500) return t;
                        }
                        return 'dialog-sin-texto';
                    }"""
                )
                if dup_text2 and (
                    "comprobante" in dup_text2.lower() or "repetido" in dup_text2.lower()
                ):
                    # Descartar el dialog y abortar — el comprobante ya existe en Finnegans.
                    try:
                        await self.frame.locator("a.button").filter(has_text="Aceptar").first.click(
                            timeout=5_000
                        )
                    except Exception:
                        pass
                    await self.frame.wait_for_timeout(1000)
                    raise DuplicateComprobanteError(
                        f"El número de comprobante ya existe en Finnegans: {dup_text[:120]}"
                    )
            else:
                low = (dup_text or "").lower()
                es_descuadre = (
                    "no coincide" in low
                    or "importe de control" in low
                    or ("control" in low and "importe" in low)
                )
                # Cerrar el dialog en cualquier caso (Aceptar) para no dejar la UI trabada.
                try:
                    await self.frame.locator("a.button").filter(has_text="Aceptar").first.click(
                        timeout=5_000
                    )
                except Exception:
                    pass
                await self.frame.wait_for_timeout(1000)
                if es_descuadre:
                    _log(
                        f"save_draft: Finnegans rechazó el guardado por descuadre de "
                        f"importe de control. Texto: {dup_text[:160]!r}"
                    )
                    raise ControlTotalMismatchError(dup_text[:200])
                # Dialog desconocido: NO reportar éxito falso silencioso.
                _log(f"save_draft: dialog inesperado detectado: {dup_text[:160]!r}")
                raise RuntimeError(f"Finnegans bloqueó el guardado con un dialog inesperado: {dup_text[:160]}")

        await self.frame.wait_for_timeout(2000)
        try:
            await self.page.wait_for_load_state("networkidle", timeout=15_000)
        except Exception:
            pass

        # ── Verificación de guardado exitoso ──────────────────────────────
        # No basta con "no apareció un dialog de error": Finnegans puede no
        # persistir el documento silenciosamente. Confirmamos la transición
        # "Nuevo - Factura de Compra" → "Factura de Compra - <numero>" (y/o que
        # el botón Adjuntar esté disponible) antes de dar el guardado por bueno.
        # Polling corto porque el re-render del título puede tardar un instante.
        estado = {"nro": None, "es_nuevo": True, "attach_disponible": False}
        for _ in range(8):
            estado = await self._leer_estado_documento()
            if estado.get("nro") or (
                not estado.get("es_nuevo") and estado.get("attach_disponible")
            ):
                break
            await self.frame.wait_for_timeout(1000)

        await self.screenshot("post_save")

        nro_interno = estado.get("nro")
        if nro_interno:
            _log(f"save_draft: guardado confirmado → Factura de Compra - {nro_interno}")
            return str(nro_interno)
        if not estado.get("es_nuevo") and estado.get("attach_disponible"):
            _log(
                "save_draft: guardado confirmado (documento ya no es 'Nuevo' y "
                "Adjuntar disponible), pero no se pudo leer el nº interno."
            )
            return None

        # Sigue como "Nuevo" → el guardado no persistió. No adjuntar.
        _log(
            f"save_draft: NO se confirmó el guardado (estado={estado!r}). "
            "El documento sigue como 'Nuevo'; no se intentará adjuntar el PDF."
        )
        raise SaveFailedError(
            "El guardado no se confirmó: el documento sigue como "
            "'Nuevo - Factura de Compra' (Finnegans no asignó número interno)."
        )

    async def attach_pdf(self, pdf_path):
        """Adjunta un PDF a la factura guardada.

        REQUIERE haber llamado save_draft() previamente.

        Flujo real de Finnegans (verificado con MCP Playwright 2026-05-29):
          1. #_onFileAttach abre un panel custom div.adjunto (NO un file chooser nativo).
          2. a.new ("Nuevo Adjunto") abre el popup div#overDiv.fafpopup con
             input#fileVerdad_0[type="FILE"] (oculto visualmente).
          3. set_input_files() en ese input carga el archivo.
          4. Click en el botón "Adjuntar" (llama FILEUPLOADAcceptPopup) sube el archivo.
        """
        from pathlib import Path as _Path
        pdf_path = _Path(pdf_path).absolute()
        if not pdf_path.exists():
            raise FileNotFoundError(f"PDF no existe: {pdf_path}")
        nombre_pdf = pdf_path.name

        # 1. Abrir el panel de adjuntos
        attach_btn = self.frame.locator("#_onFileAttach")
        await attach_btn.wait_for(state="visible", timeout=STEP_TIMEOUT)
        await attach_btn.click(timeout=STEP_TIMEOUT)
        await self.frame.wait_for_timeout(1500)

        # 2. Abrir el popup de carga (#overDiv) vía "Nuevo Adjunto" (a.new).
        #    Manejo especial (doc, sección 3 "Manejo especial si a.new da timeout"):
        #    si #overDiv ya está visible con el input #fileVerdad_0, NO se debe
        #    reintentar el click de a.new — el popup ya está abierto y ese click
        #    da timeout porque #overDiv intercepta los pointer events. Se continúa
        #    directo a setear el archivo.
        async def _popup_listo() -> bool:
            try:
                over_visible = await self.frame.locator("#overDiv").is_visible()
            except Exception:
                over_visible = False
            if not over_visible:
                return False
            try:
                return await self.frame.locator(
                    "#fileVerdad_0, input[name='FILE_WDGFileUpload']"
                ).first.count() > 0
            except Exception:
                return False

        if not await _popup_listo():
            try:
                nuevo_btn = self.frame.locator("a.new").first
                await nuevo_btn.wait_for(state="visible", timeout=STEP_TIMEOUT)
                await nuevo_btn.click(timeout=STEP_TIMEOUT)
            except Exception as exc:
                # Si #overDiv ya está abierto, el click de a.new puede dar timeout
                # por intercepción de pointer events: no es fatal mientras el input
                # de archivo exista. Solo abortamos si el popup tampoco está listo.
                _log(f"attach_pdf: click a.new falló ({exc}); verificando si #overDiv ya está abierto")
                if not await _popup_listo():
                    raise
            await self.frame.wait_for_timeout(1500)

        # 3. Cargar el archivo en el input oculto (sin file chooser nativo)
        file_input = self.frame.locator("#fileVerdad_0, input[name='FILE_WDGFileUpload']").first
        await file_input.wait_for(state="attached", timeout=STEP_TIMEOUT)
        await file_input.set_input_files(str(pdf_path))
        await self.frame.wait_for_timeout(1000)

        # 4. Click "Adjuntar" para subir
        adjuntar_btn = self.frame.locator("#overDiv a.WIDGETWidgetButton").filter(has_text="Adjuntar")
        await adjuntar_btn.click(timeout=STEP_TIMEOUT)

        # Esperar cierre del popup y upload completado
        try:
            await self.frame.locator("#overDiv").wait_for(state="hidden", timeout=15_000)
        except Exception:
            pass
        try:
            await self.page.wait_for_load_state("networkidle", timeout=15_000)
        except Exception:
            pass
        await self.frame.wait_for_timeout(2000)

        # 5. Validación de adjunto exitoso (doc, "Validacion de adjunto exitoso"):
        #    el nombre del PDF debe figurar en el panel de adjuntos (div.adjunto)
        #    o en el body, y #overDiv ya no debe estar visible. Polling corto
        #    porque el panel refresca de forma asíncrona tras el upload.
        listado = False
        for _ in range(6):
            try:
                listado = await self.frame.evaluate(
                    """(nombre) => {
                        const norm = s => (s || '').toLowerCase();
                        const target = norm(nombre);
                        const enPanel = [...document.querySelectorAll('div.adjunto')]
                            .some(d => norm(d.textContent).includes(target));
                        const enBody = norm(document.body && document.body.textContent)
                            .includes(target);
                        return enPanel || enBody;
                    }""",
                    nombre_pdf,
                )
            except Exception:
                listado = False
            if listado:
                break
            await self.frame.wait_for_timeout(1000)

        if not listado:
            raise AttachFailedError(
                f"El PDF {nombre_pdf!r} no aparece en el panel de adjuntos tras "
                f"el upload (posible fallo silencioso de FILEUPLOADAcceptPopup)."
            )
        _log(f"attach_pdf: {nombre_pdf} adjuntado y verificado en el panel OK")

    # ------------------------------------------------------------------
    # Screenshots
    # ------------------------------------------------------------------

    async def screenshot(self, nombre: str = "screenshot") -> str:
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        path = Path(f"screenshots/{ts}_{nombre}.png")
        path.parent.mkdir(exist_ok=True)
        await self.page.screenshot(path=str(path), full_page=False)
        _log(f"screenshot â†’ {path}")
        return str(path)
