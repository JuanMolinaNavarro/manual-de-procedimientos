"""
Gestión del knowledge base de proveedores, empresas propias y flujos.

Estructura en disk:
  agent/knowledge/
    index.json                 — CUITs separados: providers vs. companies
    providers/{id}.json        — empresas externas que emiten facturas de compra
    companies/{id}.json        — empresas propias (aparecen como cliente en las facturas)
    flows/{tipo}.json          — mapeo campo-a-campo con FinnegansGO

Flujo de lookup correcto:
  1. OpenAI extrae la factura → obtenemos cuit_emisor y cuit_cliente
  2. lookup_provider(cuit_emisor)  → identifica al proveedor externo
  3. lookup_company(cuit_cliente)  → confirma que el cliente es empresa propia
"""
from __future__ import annotations

import json
import re
import unicodedata
from datetime import date
from pathlib import Path

KNOWLEDGE_DIR = Path(__file__).parent / "knowledge"
INDEX_PATH = KNOWLEDGE_DIR / "index.json"
PROVIDERS_DIR = KNOWLEDGE_DIR / "providers"
COMPANIES_DIR = KNOWLEDGE_DIR / "companies"
FLOWS_DIR = KNOWLEDGE_DIR / "flows"
CENTROS_COSTO_PATH = KNOWLEDGE_DIR / "centros_costo.json"
EMPRESAS_FINNEGANS_PATH = KNOWLEDGE_DIR / "empresas_finnegans.json"
CATALOGO_FINNEGANS_PATH = KNOWLEDGE_DIR / "empresas_finnegans_catalogo.json"

_CENTROS_COSTO_CACHE: dict | None = None
_EMPRESAS_FINNEGANS_CACHE: dict | None = None
_CATALOGO_FINNEGANS_CACHE: dict | None = None


# ---------------------------------------------------------------------------
# Centros de costo (mapeo NUM_SERVICIO → Centro de Costos)
# ---------------------------------------------------------------------------

def _load_centros_costo() -> dict:
    global _CENTROS_COSTO_CACHE
    if _CENTROS_COSTO_CACHE is None:
        if CENTROS_COSTO_PATH.exists():
            with open(CENTROS_COSTO_PATH, encoding="utf-8-sig") as f:
                _CENTROS_COSTO_CACHE = json.load(f)
        else:
            _CENTROS_COSTO_CACHE = {"by_num_servicio": {}, "empresa_pagadora_by_num_servicio": {}}
    return _CENTROS_COSTO_CACHE


def lookup_centro_costos(numero_servicio: str | int | None) -> str | None:
    """Devuelve el nombre del Centro de Costos para un NUM SERVICIO de factura.

    Devuelve None si el número no está mapeado (en cuyo caso el flow puede
    caer al comportamiento default: tipear 'a' y elegir el primer resultado).
    """
    if numero_servicio is None or numero_servicio == "":
        return None
    key = str(numero_servicio).strip()
    return _load_centros_costo().get("by_num_servicio", {}).get(key)


def lookup_centro_costos_by_company_id(company_id: str | None) -> str | None:
    """Devuelve el Centro de Costos default para una EMPRESA PROPIA identificada
    por su `id` en knowledge/companies (ej. 'ccc_sa').

    Es la forma MÁS robusta de resolver el CC default: el id se obtiene de
    `lookup_company(cuit_cliente, cliente)` sobre los datos del PDF, así que NO
    depende del nombre exacto en Finnegans ni se rompe cuando se fuerza una
    empresa sandbox ('Prueba') vía override.
    """
    if not company_id:
        return None
    by_company = _load_centros_costo().get("by_company_default", {})
    return by_company.get(company_id)


def lookup_centro_costos_by_empresa(empresa_finnegans: str | None) -> str | None:
    """Devuelve el Centro de Costos default para una EMPRESA destino en
    FinnegansGO (clave = nombre EXACTO en Finnegans). Sirve de fallback cuando
    el NUM_SERVICIO no está en el mapeo (ej. facturas de CCC, donde el CC siempre
    es el mismo independientemente del servicio).

    Match tolerante: ignora puntos, espacios y Ñ↔N para tolerar pequeñas
    divergencias de tipeo en el JSON vs. el nombre real en Finnegans.
    """
    if not empresa_finnegans:
        return None
    by_empresa = _load_centros_costo().get("by_empresa_default", {})
    target = _normalize_for_compare(empresa_finnegans)
    target_no_n = re.sub(r"[ñÑ]", "N", target)
    for k, v in by_empresa.items():
        kn = re.sub(r"[ñÑ]", "N", _normalize_for_compare(k))
        if kn == target_no_n:
            return v
    return None


def lookup_empresa_pagadora(numero_servicio: str | int | None) -> str | None:
    """Devuelve la EMPRESA PAGADORA para un NUM SERVICIO (uso futuro: selección
    automática de empresa en FinnegansGO)."""
    if numero_servicio is None or numero_servicio == "":
        return None
    key = str(numero_servicio).strip()
    return _load_centros_costo().get("empresa_pagadora_by_num_servicio", {}).get(key)


def lookup_titular(numero_servicio: str | int | None) -> str | None:
    """Devuelve el TITULAR (nombre tal cual viene en la factura) para un
    NUM SERVICIO. Se usa para cross-check: si el TITULAR del Excel no coincide
    con el cliente del PDF, el NS extraído por el LLM probablemente está mal."""
    if numero_servicio is None or numero_servicio == "":
        return None
    key = str(numero_servicio).strip()
    return _load_centros_costo().get("titular_by_num_servicio", {}).get(key)


# ---------------------------------------------------------------------------
# Alias de nombres de empresa (PDF/Excel → nombre exacto en FinnegansGO)
# ---------------------------------------------------------------------------

def _load_empresas_finnegans() -> dict:
    global _EMPRESAS_FINNEGANS_CACHE
    if _EMPRESAS_FINNEGANS_CACHE is None:
        if EMPRESAS_FINNEGANS_PATH.exists():
            with open(EMPRESAS_FINNEGANS_PATH, encoding="utf-8-sig") as f:
                _EMPRESAS_FINNEGANS_CACHE = json.load(f)
        else:
            _EMPRESAS_FINNEGANS_CACHE = {"by_alias": {}}
    return _EMPRESAS_FINNEGANS_CACHE


def _load_catalogo_finnegans() -> dict:
    global _CATALOGO_FINNEGANS_CACHE
    if _CATALOGO_FINNEGANS_CACHE is None:
        if CATALOGO_FINNEGANS_PATH.exists():
            with open(CATALOGO_FINNEGANS_PATH, encoding="utf-8-sig") as f:
                _CATALOGO_FINNEGANS_CACHE = json.load(f)
        else:
            _CATALOGO_FINNEGANS_CACHE = {"by_cuit": {}}
    return _CATALOGO_FINNEGANS_CACHE


def lookup_empresa_finnegans_by_cuit(cuit: str | None, nombre: str | None = None) -> str | None:
    """Nombre EXACTO en FinnegansGO para un CUIT, desde el catálogo autoritativo.

    Es la vía MÁS confiable para la empresa destino: el CUIT del cliente lo lee el
    extractor de forma determinista y el catálogo tiene el nombre tal cual figura en
    el modal "Seleccionar Empresa".

    Si el CUIT mapea a MÁS de una empresa (colisión: p.ej. TAFI CABLE COLOR y MONTE
    QUEMADO comparten 30-69714056-1), desambigua por `nombre` (comparación tolerante).
    Si no se puede desambiguar, devuelve None (NO adivina) y el caller cae al lookup
    por nombre. Devuelve None también si el CUIT no está en el catálogo.
    """
    if not cuit:
        return None
    entradas = _load_catalogo_finnegans().get("by_cuit", {}).get(_normalize_cuit(cuit), [])
    if not entradas:
        return None
    if len(entradas) == 1:
        return entradas[0]["nombre"]
    # Colisión de CUIT: elegir la empresa cuyo nombre coincide con el cliente del PDF.
    if nombre:
        objetivo = _normalize_for_compare(nombre)
        for e in entradas:
            en = _normalize_for_compare(e["nombre"])
            if objetivo and en and (objetivo == en or objetivo in en or en in objetivo):
                return e["nombre"]
    return None


def _norm_header(nombre: str | None) -> str:
    """Normaliza un nombre como lo hace el matcher del modal 'Seleccionar Empresa'
    (FinnegansSession._normalize_empresa): quita acentos y Ñ→N, saca puntos y
    espacios, mayúsculas. Que un nombre matchee el catálogo con esta norma implica
    que select_empresa lo va a encontrar en el modal."""
    if not nombre:
        return ""
    s = unicodedata.normalize("NFD", str(nombre))
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = re.sub(r"[.\s]+", "", s)
    return s.upper()


def _iter_catalogo_nombres():
    for entradas in _load_catalogo_finnegans().get("by_cuit", {}).values():
        for e in entradas:
            yield e["nombre"]


def lookup_empresa_finnegans_by_nombre(nombre: str | None) -> str | None:
    """Nombre EXACTO del header para un NOMBRE de empresa (no CUIT), contra el
    catálogo autoritativo. Se usa cuando solo se tiene un nombre — p.ej. la empresa
    pagadora que viene del Excel, o el cliente cuando falta el CUIT.

    Match tolerante estilo-header: exacto normalizado primero; si no, prefijo pero
    SÓLO si es inequívoco (un único candidato), para no elegir la empresa equivocada
    entre nombres parecidos (p.ej. 'COMPAÑIA DE SEÑALES IP' vs 'COMPAÑIA DE CIRCUITOS
    CERRADO'). None si no hay match seguro."""
    target = _norm_header(nombre)
    if not target:
        return None
    nombres = list(_iter_catalogo_nombres())
    for en in nombres:  # 1) exacto normalizado (inequívoco)
        if _norm_header(en) == target:
            return en
    cands = []  # 2) prefijo, sólo si hay un único candidato
    for en in nombres:
        n = _norm_header(en)
        corto, largo = (target, n) if len(target) <= len(n) else (n, target)
        if len(corto) >= 6 and largo.startswith(corto):
            cands.append(en)
    return cands[0] if len(cands) == 1 else None


def _empresa_header_o_aviso(empresa: str | None, log) -> str | None:
    """Devuelve `empresa` avisando (auditoría) si NO está en el catálogo del header:
    en ese caso select_empresa podría no encontrarla y la factura iría a revisión."""
    if empresa and lookup_empresa_finnegans_by_nombre(empresa) is None:
        log(
            f"AVISO: la empresa resuelta '{empresa}' NO está en el catálogo del header "
            f"(empresas_finnegans_catalogo.json); select_empresa podría no encontrarla."
        )
    return empresa


def lookup_nombre_finnegans(nombre: str | None) -> str | None:
    """Devuelve el nombre EXACTO en FinnegansGO para un nombre de empresa que
    puede venir del PDF/Excel con variantes (sin la Ñ, sin puntos, etc.).
    Devuelve None si no hay alias mapeado para ese nombre.

    El match es case-insensitive y normaliza espacios; los puntos cuentan
    (porque la forma exacta de Finnegans suele tener un formato fijo).
    """
    if not nombre:
        return None
    aliases = _load_empresas_finnegans().get("by_alias", {})
    target = " ".join(nombre.strip().split()).upper()
    for alias, finnegans in aliases.items():
        if " ".join(alias.strip().split()).upper() == target:
            return finnegans
    return None


def _normalize_for_compare(s: str | None) -> str:
    """Normaliza un nombre para comparar (ignora puntos, sufijo legal, '- PAGA X')."""
    if not s:
        return ""
    s = re.sub(r"\.", "", str(s))
    s = re.sub(r"\s+", " ", s).strip()
    # Quitar "- PAGA X" / " PAGA X" del final (ej. "TUCUMAN COMUNICACIONES- PAGA MR")
    s = re.sub(r"\s*[-]?\s*PAGA\s+\w+\s*$", "", s, flags=re.IGNORECASE)
    # Quitar sufijos legales finales
    s = re.sub(
        r"\s+(S\s*A\s*S|S\s*R\s*L|S\s*C\s*A|S\s*A|SAS|SRL|SA|SCA)\s*$",
        "",
        s,
        flags=re.IGNORECASE,
    )
    return s.upper().strip()


def _titular_matches_cliente(titular: str | None, cliente: str | None) -> bool:
    """¿El TITULAR del Excel y el cliente del PDF refieren a la misma empresa?
    Comparación tolerante: normaliza ambos y chequea igualdad o substring."""
    a = _normalize_for_compare(cliente)
    b = _normalize_for_compare(titular)
    if not a or not b:
        return False
    return a == b or a in b or b in a


def resolve_empresa_finnegans(datos: dict, log=None) -> str | None:
    """Resuelve el nombre EXACTO de la empresa en FinnegansGO a la que se le
    carga esta factura.

    Esta es la EMPRESA del header ("Seleccionar Empresa"), NO el Destinatario del
    formulario (ese usa `_search_cliente`/`_expected_cliente` + el alias map, que es
    otra grafía). Todos los caminos devuelven la grafía EXACTA del header vía el
    catálogo autoritativo; el alias/nombre-crudo queda sólo como último recurso.

    Estrategia (en orden):
      1) NUM_SERVICIO → si el TITULAR del Excel coincide con el cliente del PDF →
         empresa pagadora del Excel (cubre "PAGA MR", cliente ≠ pagador), llevada a
         la grafía del header.
      2) cuit_cliente → catálogo (vía más confiable; desambigua colisión TAFI/MONTE).
      3) nombre del cliente → catálogo (si faltó/no matcheó el CUIT).
      4) companies (legacy) → normalizado a la grafía del header.
      5) último recurso: alias/nombre crudo (con AVISO si cae fuera del catálogo).

    Args:
        datos: dict con `numero_servicio`, `cliente`, `cuit_cliente`.
        log: callable opcional para mensajes informativos del trazado.

    Returns:
        Nombre exacto de la empresa en el header de FinnegansGO, o None si no se pudo.
    """
    log = log or (lambda msg: None)
    ns = datos.get("numero_servicio")
    cliente = datos.get("cliente") or ""
    cuit_cliente = datos.get("cuit_cliente")

    # 1) NS→pagadora (Excel): PRIORIDAD para "PAGA MR" (cliente ≠ pagador). El nombre
    #    de la pagadora se lleva a la grafía EXACTA del header vía catálogo.
    pagadora_excel = lookup_empresa_pagadora(ns)
    titular_excel = lookup_titular(ns)
    if pagadora_excel and _titular_matches_cliente(titular_excel, cliente):
        empresa = (
            lookup_empresa_finnegans_by_nombre(pagadora_excel)
            or lookup_nombre_finnegans(pagadora_excel)
            or pagadora_excel
        )
        log(f"empresa via NS Excel (PAGA): NS={ns}, pagadora={pagadora_excel!r} -> {empresa!r}")
        return _empresa_header_o_aviso(empresa, log)
    if pagadora_excel:
        log(
            f"AVISO: NS={ns} en Excel mapea a TITULAR={titular_excel!r} != cliente "
            f"{cliente!r}; se ignora la pagadora y se resuelve por CUIT/nombre."
        )

    # 2) cuit_cliente → CATÁLOGO (vía más confiable; grafía exacta del header).
    exacto = lookup_empresa_finnegans_by_cuit(cuit_cliente, nombre=cliente)
    if exacto:
        log(f"empresa via catálogo (CUIT {cuit_cliente!r}, cliente {cliente!r}) -> {exacto!r}")
        return exacto

    # 3) nombre del cliente → CATÁLOGO (si faltó o no matcheó el CUIT).
    exacto = lookup_empresa_finnegans_by_nombre(cliente)
    if exacto:
        log(f"empresa via catálogo (nombre {cliente!r}) -> {exacto!r}")
        return exacto

    # 4) companies (legacy): normalizar a la grafía del header vía catálogo si se puede.
    company = lookup_company(cuit=cuit_cliente, nombre=cliente)
    if company:
        nombre = company.get("nombre_finnegans") or company.get("razon_social")
        if nombre and nombre != "PENDIENTE_VERIFICAR":
            empresa = lookup_empresa_finnegans_by_nombre(nombre) or nombre
            log(f"empresa via companies: cuit={cuit_cliente!r} -> {nombre!r} -> {empresa!r}")
            return _empresa_header_o_aviso(empresa, log)

    # 5) último recurso: nombre del cliente por catálogo, alias o crudo (con AVISO).
    if cliente:
        empresa = lookup_empresa_finnegans_by_nombre(cliente) or lookup_nombre_finnegans(cliente) or cliente
        log(f"empresa via cliente (último recurso): {cliente!r} -> {empresa!r}")
        return _empresa_header_o_aviso(empresa, log)

    log(
        f"NO se pudo resolver empresa: NS={ns!r}, cliente={cliente!r}, "
        f"cuit_cliente={cuit_cliente!r}"
    )
    return None


# ---------------------------------------------------------------------------
# I/O helpers
# ---------------------------------------------------------------------------

def _load(path: Path) -> dict:
    # utf-8-sig tolera archivos con BOM sin romper json.load.
    with open(path, encoding="utf-8-sig") as f:
        return json.load(f)


def _save(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def _normalize_cuit(cuit: str) -> str:
    import re
    return re.sub(r"[\s\-]", "", cuit)


# ---------------------------------------------------------------------------
# Lookups — Proveedores externos
# ---------------------------------------------------------------------------

# Cada tipo de flujo lo emite un proveedor FIJO y conocido. El proveedor se
# determina a partir del flujo clasificado (no al revés): si el extractor
# clasificó la factura como SEPSA/GIRE/energía/soportes, el proveedor queda
# determinado sin depender de que el LLM haya leído bien el CUIT del emisor.
_FLOW_PROVIDER_ID: dict[str, str] = {
    "recaudacion_sepsa": "servicio_electronico_de_pago_s_a",
    "recaudacion": "gire",
    "energia_electrica": "edet",
    "arrendamiento_soportes": "edet",
}


def provider_for_flow(tipo_flujo: str | None) -> dict | None:
    """Devuelve el proveedor CANÓNICO asociado a un tipo de flujo.

    Es la forma preferida de identificar al proveedor: el flujo elegido por el
    extractor es la fuente de verdad. Devuelve None si el flujo no tiene un
    proveedor mapeado (no debería pasar con los flujos soportados)."""
    provider_id = _FLOW_PROVIDER_ID.get(tipo_flujo or "")
    if not provider_id:
        return None
    path = PROVIDERS_DIR / f"{provider_id}.json"
    return _load(path) if path.exists() else None


def lookup_provider(cuit: str | None = None, nombre: str | None = None) -> dict | None:
    """
    Busca un proveedor externo por cuit_emisor (preferido) o nombre.
    Retorna el dict del provider o None si no se encuentra.
    """
    index = _load(INDEX_PATH)["providers"]
    provider_id = None

    if cuit:
        cuit_norm = _normalize_cuit(cuit)
        for k, v in index["by_cuit"].items():
            if _normalize_cuit(k) == cuit_norm:
                provider_id = v
                break

    if not provider_id and nombre:
        nombre_upper = nombre.strip().upper()
        # 2a) match exacto contra el índice by_name
        for k, v in index["by_name"].items():
            if k.upper() == nombre_upper:
                provider_id = v
                break

        # 2b) match tolerante: normaliza (sin puntos/sufijo legal) y compara
        # por igualdad o substring contra el índice by_name.
        if not provider_id:
            nombre_norm = _normalize_for_compare(nombre)
            if nombre_norm:
                for k, v in index["by_name"].items():
                    k_norm = _normalize_for_compare(k)
                    if k_norm and (k_norm == nombre_norm
                                   or k_norm in nombre_norm
                                   or nombre_norm in k_norm):
                        provider_id = v
                        break

    if provider_id:
        path = PROVIDERS_DIR / f"{provider_id}.json"
        if path.exists():
            return _load(path)

    # 3) Fallback final: si el índice no resolvió, intentamos por las
    # `nombre_variantes` declaradas en cada JSON de provider (normalizado,
    # igualdad o substring). Cubre extracciones parciales del nombre del emisor.
    if nombre:
        nombre_norm = _normalize_for_compare(nombre)
        if nombre_norm:
            for p in PROVIDERS_DIR.glob("*.json"):
                data = _load(p)
                variantes = data.get("nombre_variantes") or []
                for var in variantes:
                    var_norm = _normalize_for_compare(var)
                    if var_norm and (var_norm == nombre_norm
                                     or var_norm in nombre_norm
                                     or nombre_norm in var_norm):
                        return data
    return None


# ---------------------------------------------------------------------------
# Lookups — Empresas propias
# ---------------------------------------------------------------------------

def lookup_company(cuit: str | None = None, nombre: str | None = None) -> dict | None:
    """
    Verifica si un CUIT/nombre corresponde a una empresa propia.
    Retorna el dict de la empresa o None si no se reconoce.
    """
    index = _load(INDEX_PATH)["companies"]
    company_id = None

    if cuit:
        cuit_norm = _normalize_cuit(cuit)
        for k, v in index["by_cuit"].items():
            if _normalize_cuit(k) == cuit_norm:
                company_id = v
                break

    if not company_id and nombre:
        nombre_upper = nombre.strip().upper()
        for k, v in index["by_name"].items():
            if k.upper() == nombre_upper:
                company_id = v
                break

    if not company_id:
        return None

    path = COMPANIES_DIR / f"{company_id}.json"
    return _load(path) if path.exists() else None


# ---------------------------------------------------------------------------
# Lookups — Flujos
# ---------------------------------------------------------------------------

def get_flow(flow_id: str) -> dict | None:
    """Retorna la configuración completa de un flujo por ID."""
    path = FLOWS_DIR / f"{flow_id}.json"
    return _load(path) if path.exists() else None


def get_all_providers() -> list[dict]:
    return [_load(p) for p in sorted(PROVIDERS_DIR.glob("*.json"))]


def get_all_companies() -> list[dict]:
    return [_load(c) for c in sorted(COMPANIES_DIR.glob("*.json"))]


def get_all_flows() -> list[dict]:
    return [_load(f) for f in sorted(FLOWS_DIR.glob("*.json"))]


# ---------------------------------------------------------------------------
# Escritura — Proveedores
# ---------------------------------------------------------------------------

def add_provider_name_variant(provider_id: str, new_name: str) -> None:
    """Agrega una variante de nombre a un proveedor y actualiza el index."""
    provider_path = PROVIDERS_DIR / f"{provider_id}.json"
    provider = _load(provider_path)

    if new_name not in provider["nombre_variantes"]:
        provider["nombre_variantes"].append(new_name)
        provider["ultima_actualizacion"] = str(date.today())
        _save(provider_path, provider)

    index = _load(INDEX_PATH)
    if new_name not in index["providers"]["by_name"]:
        index["providers"]["by_name"][new_name] = provider_id
        _save(INDEX_PATH, index)


def register_new_provider(
    razon_social: str,
    cuit: str,
    nombre_finnegans: str = "PENDIENTE_VERIFICAR",
    tipos_factura: list[str] | None = None,
    notas: str = "",
) -> str:
    """
    Registra un proveedor externo nuevo como borrador.
    Retorna el provider_id generado.
    """
    provider_id = _make_id(razon_social)

    data = {
        "id": provider_id,
        "razon_social": razon_social,
        "nombre_finnegans": nombre_finnegans,
        "cuit": cuit,
        "nombre_variantes": [razon_social],
        "tipos_factura": tipos_factura or [],
        "notas": notas,
        "ejemplos_procesados": [],
        "estado": "borrador",
        "agregado": str(date.today()),
        "ultima_actualizacion": str(date.today()),
    }

    _save(PROVIDERS_DIR / f"{provider_id}.json", data)

    index = _load(INDEX_PATH)
    index["providers"]["by_cuit"][cuit] = provider_id
    index["providers"]["by_name"][razon_social] = provider_id
    _save(INDEX_PATH, index)

    return provider_id


def record_example(provider_id: str, archivo: str, tipo: str) -> None:
    """Registra un archivo procesado exitosamente como ejemplo del proveedor."""
    provider_path = PROVIDERS_DIR / f"{provider_id}.json"
    provider = _load(provider_path)

    entry = {"archivo": archivo, "tipo": tipo}
    ejemplos = provider.setdefault("ejemplos_procesados", [])
    if entry not in ejemplos:
        ejemplos.append(entry)
        provider["ultima_actualizacion"] = str(date.today())
        _save(provider_path, provider)


# ---------------------------------------------------------------------------
# Escritura — Empresas propias
# ---------------------------------------------------------------------------

def register_new_company(razon_social: str, cuit: str, notas: str = "") -> str:
    """
    Registra una empresa propia nueva.
    Retorna el company_id generado.
    """
    company_id = _make_id(razon_social)

    data = {
        "id": company_id,
        "razon_social": razon_social,
        "cuit": cuit,
        "nombre_variantes": [razon_social],
        "notas": notas,
        "agregado": str(date.today()),
        "ultima_actualizacion": str(date.today()),
    }

    _save(COMPANIES_DIR / f"{company_id}.json", data)

    index = _load(INDEX_PATH)
    index["companies"]["by_cuit"][cuit] = company_id
    index["companies"]["by_name"][razon_social] = company_id
    _save(INDEX_PATH, index)

    return company_id


# ---------------------------------------------------------------------------
# Prompt enrichment
# ---------------------------------------------------------------------------

def build_context_for_prompt(provider: dict) -> str:
    """
    Construye un bloque de contexto para el system prompt de OpenAI
    cuando el proveedor ya es conocido. Mejora la precisión de clasificación.
    """
    tipos = provider.get("tipos_factura", [])
    flows = [get_flow(t) for t in tipos if get_flow(t)]

    lines = [
        f"PROVEEDOR CONOCIDO: {provider['razon_social']} (CUIT {provider['cuit']})",
        f"Tipos de factura que emite: {', '.join(tipos)}",
    ]

    for flow in flows:
        senales = ", ".join(flow.get("senales_clasificacion", []))
        lines.append(f"  - '{flow['id']}': clasificar si el texto contiene [{senales}]")

    if provider.get("notas"):
        lines.append(f"Notas: {provider['notas']}")

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Utils
# ---------------------------------------------------------------------------

def _make_id(name: str) -> str:
    """Genera un ID de archivo limpio a partir de una razón social."""
    result = name.lower()
    for ch in " .,-/()&'":
        result = result.replace(ch, "_")
    while "__" in result:
        result = result.replace("__", "_")
    return result.strip("_")[:40]
