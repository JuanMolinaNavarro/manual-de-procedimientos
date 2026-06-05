# Documentacion: adjuntar PDF de factura en FinnegansGO

## Objetivo

Implementar correctamente la subida del PDF de una factura de compra en FinnegansGO dentro del flujo Playwright del agente de facturas.

La regla critica es:

> El PDF solo puede adjuntarse despues de que la factura haya sido guardada correctamente.

Si el formulario todavia esta en estado `Nuevo - Factura de Compra`, Finnegans no tiene un documento persistido al cual asociar el archivo. Primero hay que guardar el borrador, confirmar que Finnegans asigno numero interno y recien despues abrir el panel de adjuntos.

## Caso validado

Prueba realizada con Playwright MCP sobre FinnegansGO.

- Archivo: `0097-72813195.pdf`
- Ruta local usada: `C:/Users/Olart/OneDrive/Desktop/sin cargar EDET/0097-72813195.pdf`
- Flujo: `energia_electrica`
- Proveedor: `EDET S.A.`
- Empresa seleccionada: `TAFI CABLE COLOR SA`
- Destinatario: `TAFI CABLE COLOR S.A.`
- Comprobante: `A-00097-72813195`
- Total: `412,120.00`
- Total de control: `412,120.00`
- Resultado de guardado: `Factura de Compra - 52257`
- Resultado de adjunto: PDF listado correctamente en el panel de adjuntos

La ruta local de Windows anterior corresponde solamente a la prueba manual ejecutada desde la maquina de desarrollo. En Docker, el worker no debe usar rutas `C:/Users/...`; debe usar la ruta interna del contenedor donde esta montado el volumen compartido.

Evidencia observada luego del adjunto:

```text
Nuevo Adjunto
0097-72813195.pdf
Adjuntado por:
[usuario logueado]
2 de Junio de 2026
```

Tambien se verifico:

- El popup de carga `#overDiv` quedo oculto.
- El body de la pagina contenia `0097-72813195.pdf`.
- El boton `Adjuntar` mostro contador `1`.
- `Total` y `Total De Control` quedaron iguales en `412,120.00`.

## Rutas de archivo en Docker y Linux

En produccion o desarrollo con Docker, la ruta correcta del PDF no es la ruta original del usuario ni una ruta del host. La ruta correcta es la ruta visible desde el contenedor que ejecuta Playwright.

En este proyecto, el flujo actual es:

1. El usuario sube el PDF desde el panel `/admin/facturas`.
2. La app Next.js recibe el archivo en `POST /api/admin/facturas`.
3. La app guarda el PDF en el volumen de uploads:

```text
/app/uploads/facturas/<uuid>.pdf
```

4. En la base se guardan dos nombres:

| Campo | Significado |
|---|---|
| `nombre_original` | Nombre original subido por el usuario, por ejemplo `0097-72813195.pdf` |
| `nombre_archivo` | Nombre real almacenado, por ejemplo `<uuid>.pdf` |

5. El worker toma facturas pendientes y arma la ruta real asi:

```text
UPLOADS_DIR / nombre_archivo
```

Con la configuracion actual de Docker Compose:

```text
UPLOADS_DIR=/app/uploads/facturas
```

Por lo tanto, el path que debe recibir `set_input_files()` / `setInputFiles()` dentro del worker es:

```text
/app/uploads/facturas/<nombre_archivo>
```

No debe usarse:

```text
C:/Users/Olart/OneDrive/Desktop/sin cargar EDET/0097-72813195.pdf
```

Esa ruta solo es valida para una prueba manual ejecutada desde el host Windows.

### Volumen compartido requerido

El `docker-compose.yml` ya monta el mismo volumen en `app` y `worker`:

```yaml
app:
  volumes:
    - uploads_data:/app/uploads

worker:
  volumes:
    - uploads_data:/app/uploads
```

Esto es lo que permite que:

- la app guarde el PDF en `/app/uploads/facturas`
- el worker lea el mismo PDF desde `/app/uploads/facturas`
- Playwright dentro del worker pueda adjuntar el archivo usando esa ruta interna

### Servidor Linux con Docker

En un servidor Linux corriendo Docker aplica exactamente la misma regla: el path importante es el path interno del contenedor, no el path del host.

Mientras el worker tenga montado el volumen en:

```text
/app/uploads
```

y `UPLOADS_DIR` apunte a:

```text
/app/uploads/facturas
```

el adjunto funcionara igual que en local.

### Caso especial: Playwright en otro contenedor

Si en el futuro Chromium/Playwright se ejecuta en otro contenedor distinto al `worker`, ese contenedor tambien debe tener acceso al mismo volumen de uploads. Si no, `set_input_files()` fallara porque el archivo no existira desde el filesystem del proceso que maneja el navegador.

Regla practica:

```text
El path del PDF debe existir dentro del mismo contenedor/proceso que ejecuta Playwright.
```

## Secuencia obligatoria

El flujo completo debe respetar este orden:

1. Seleccionar la empresa correcta en FinnegansGO.
2. Abrir `Facturas de Compra`.
3. Crear una nueva `Factura de Compra`.
4. Seleccionar el workflow.
5. Completar cabecera.
6. Completar items.
7. Completar informacion fiscal.
8. Completar retenciones/percepciones.
9. Completar `Total De Control`.
10. Guardar el formulario.
11. Confirmar que el guardado fue exitoso.
12. Adjuntar el PDF.
13. Confirmar que el PDF quedo listado en el panel de adjuntos.

Nunca intentar adjuntar el PDF antes del paso de guardado exitoso.

## Datos cargados en el caso EDET validado

### Empresa

Seleccionar en el header:

```text
TAFI CABLE COLOR SA
```

El selector puede mostrar el header truncado como:

```text
TAFI CABLE COLOR ... Empresa
```

Eso es aceptable si corresponde a la empresa correcta.

### Documento

En `Facturas de Compra`:

```text
Nuevo -> Factura de Compra
```

Workflow:

```text
Compras - Productos & Insumos - Sin Asistente
```

### Cabecera

Campos relevantes:

| Campo Finnegans | Valor |
|---|---|
| Proveedor | `EDET S.A.` |
| Nro. Comprobante | `A-00097-72813195` |
| Fecha | `31/05/2026` |
| Fecha De Comprobante | `29/05/2026` |
| Provincia Origen | `Tucuman` |
| Provincia Destino | `Tucuman` |
| Destinatario | `TAFI CABLE COLOR S.A.` |
| Descripcion | `Av Miguel Critto Av Critto 62 03/2026` |

Nota sobre el numero de comprobante:

- Finnegans usa mascara `A-_____-________`.
- El punto de venta debe tener 5 digitos.
- Para la factura `0097-72813195`, el valor correcto en Finnegans es:

```text
A-00097-72813195
```

No enviar `A-0097-72813195`, porque la mascara puede corromper el valor.

### Items

| Producto buscado | Producto seleccionado | Cantidad | Precio | Centro de costos |
|---|---|---:|---:|---|
| `EDETENE` | `ENERGIA IVA 27%` | `1` | `291,869.77` | `0094` / `TAFI VIEJO` |
| `Otros Impuestos y cargos` | `Otros Impuestos y cargos` | `1` | `22,475.56` | No expuso input de dimension en la prueba |
| `Servicio Energia Fuente/ Oficina No Gravado` | `Servicio Energia Fuente/ Oficina No Gravado` | `1` | `-1.70` | `0094` / `TAFI VIEJO` |

Observacion importante:

Para `Otros Impuestos y cargos`, durante la prueba el modal de `Dimensiones` no mostro ningun input `SELECTORDIMENSION...DISTRIBUCION...`. En ese caso, el comportamiento correcto es continuar y aceptar el item sin dimension explicita, como ya contempla el flujo base cuando no encuentra input de dimension.

### Informacion fiscal

| Campo | Valor |
|---|---|
| Comprobante Tipo Impositivo | `001-Factura Electronica A` |
| CAE | No cargado en esta prueba |
| Vencimiento CAE | No cargado en esta prueba |

La extraccion de esta factura no informo CAE, por lo que no se cargo.

### Retenciones / Percepciones

| Tipo | Retencion | Fecha | Importe |
|---|---|---|---:|
| `Percepcion de II.BB. Tucuman` | `Percepcion de II.BB. Tucuman` | `19/06/2026` | `10,215.44` |
| `Percepcion de IVA` | `Percepcion 3%` | `19/06/2026` | `8,756.09` |

Luego de cargar ambas percepciones, Finnegans calculo:

```text
Total Bruto:        314,343.63
Total Conceptos:     78,804.84
Total Retenciones:   18,971.53
Total:              412,120.00
```

### Total de control

Cargar:

```text
Total De Control: 412,120.00
```

Antes de guardar, validar:

```text
Total = Total De Control = 412,120.00
```

## Guardado

El guardado debe ejecutarse antes de adjuntar.

### Selectores recomendados

Selector principal:

```text
#_onSave
```

Fallbacks:

```text
#_onFileSave
a.TOOLBARBtnStandard[id*="Save"]
link visible con texto exacto "Guardar"
```

### Validacion de guardado exitoso

Despues de hacer click en `Guardar`:

1. Esperar procesamiento del servidor.
2. Revisar si aparece un dialogo dentro del iframe.
3. Confirmar que el titulo cambio desde:

```text
Nuevo - Factura de Compra
```

a:

```text
Factura de Compra - <numero>
```

En la prueba:

```text
Factura de Compra - 52257
```

4. Confirmar que el boton `Adjuntar` esta disponible.
5. Confirmar que `Total` y `Total De Control` siguen iguales.

## Manejo de errores durante el guardado

### Comprobante repetido

Si aparece un dialogo con texto relacionado a:

- `comprobante`
- `repetido`
- `numero de comprobante`

Entonces:

1. Cerrar el dialogo con `Aceptar`.
2. No adjuntar el PDF.
3. Reportar que la factura ya existe o que el comprobante esta repetido.
4. No marcar la carga como `guardada + PDF adjuntado`.

Este punto es critico: si el guardado falla por duplicado, no hay documento nuevo valido al cual adjuntar el PDF.

### Descuadre de importe de control

Si aparece un dialogo con texto relacionado a:

- `importe de control`
- `no coincide`
- `control`

Entonces:

1. Cerrar el dialogo con `Aceptar`.
2. No adjuntar el PDF.
3. Marcar la factura para revision.
4. Mantener evidencia del error en logs o screenshot.

### Dialogo inesperado

Si aparece cualquier otro dialogo:

1. Cerrar solo si es necesario para destrabar la UI.
2. No reportar exito silencioso.
3. Devolver error explicito con el texto del dialogo.
4. No adjuntar PDF salvo que se haya confirmado que el guardado fue exitoso.

## Flujo correcto para adjuntar PDF

Este flujo se ejecuta solamente despues del guardado exitoso.

### 1. Abrir panel de adjuntos

Click en:

```text
#_onFileAttach
```

Esto abre el panel custom de adjuntos de Finnegans.

Texto observado en el panel antes de adjuntar:

```text
Nuevo Adjunto
Sin adjunto que mostrar...
```

### 2. Abrir popup de nuevo adjunto

Click en:

```text
a.new
```

Texto visible:

```text
Nuevo Adjunto
```

Esto abre el popup:

```text
#overDiv
```

con titulo:

```text
Adjuntar archivo
```

### 3. Manejo especial si `a.new` da timeout

Puede ocurrir que Playwright falle al clickear `a.new` con un error de interceptacion de eventos por `#overDiv`.

Ejemplo conceptual:

```text
locator.click timeout
#overDiv intercepts pointer events
```

Esto no necesariamente significa que el flujo fallo. En la prueba real paso porque el popup `#overDiv` ya estaba abierto.

Regla:

- Si `#overDiv` esta visible y existe el input `#fileVerdad_0`, continuar directamente con la carga del archivo.
- No reintentar indefinidamente el click en `a.new`.

### 4. Input real de archivo

El upload no usa file chooser nativo.

El input correcto es:

```text
#fileVerdad_0
```

Fallback:

```text
input[name="FILE_WDGFileUpload"]
```

En la prueba se observo:

```text
id: fileVerdad_0
name: FILE_WDGFileUpload
type: file
```

Usar `set_input_files()` / `setInputFiles()` directamente sobre ese input.

Archivo validado:

```text
C:/Users/Olart/OneDrive/Desktop/sin cargar EDET/0097-72813195.pdf
```

Despues de cargarlo, validar que el input tenga:

```text
0097-72813195.pdf
```

### 5. Confirmar adjunto

Click en el boton `Adjuntar` dentro de `#overDiv`.

Selector recomendado:

```text
#overDiv a.WIDGETWidgetButton
```

Filtrar por texto:

```text
Adjuntar
```

Luego esperar:

1. Que `#overDiv` quede oculto.
2. `networkidle`, si esta disponible.
3. Una espera adicional corta para que refresque el panel de adjuntos.

## Validacion de adjunto exitoso

El adjunto se considera exitoso si se cumplen estas condiciones:

- `#overDiv` no esta visible.
- `div.adjunto` contiene el nombre del PDF.
- El body contiene el nombre del PDF.
- El boton `Adjuntar` muestra contador `1`, o el panel lista al menos un adjunto.
- El panel muestra metadata del adjunto.

Ejemplo de validacion real:

```text
Nuevo Adjunto
0097-72813195.pdf
Adjuntado por:
[usuario logueado]
2 de Junio de 2026
```

En la prueba tambien se observo:

```text
Adjuntar
1
```

## Resultado esperado del flujo completo

Cuando todo sale bien, el resultado del agente debe poder distinguir:

```text
formulario cargado
guardado como borrador
PDF adjuntado correctamente
```

Mensaje esperado:

```text
Factura 0097-72813195 (energia): guardada como borrador + PDF adjuntado.
```

Si el guardado fue exitoso pero el adjunto fallo:

```text
Factura 0097-72813195 (energia): guardada como borrador (PDF NO adjuntado).
```

Si el guardado no fue exitoso:

```text
Factura 0097-72813195 (energia): NO se pudo guardar. No se intento adjuntar PDF.
```

## Recomendacion de implementacion para Claude Code

### Responsabilidad de `save_draft`

La funcion de guardado debe:

1. Clickear `Guardar`.
2. Esperar procesamiento.
3. Detectar dialogos de error.
4. Clasificar errores conocidos:
   - comprobante repetido
   - descuadre de total de control
   - dialogo inesperado
5. Confirmar que el documento ya no esta como `Nuevo`.
6. Devolver exito solo si Finnegans creo/actualizo el documento.

### Responsabilidad de `attach_pdf`

La funcion de adjunto debe:

1. Recibir `pdf_path`.
2. Verificar que el archivo exista.
3. Abrir panel con `#_onFileAttach`.
4. Clickear `a.new`, salvo que `#overDiv` ya este abierto.
5. Esperar `#fileVerdad_0` o `input[name="FILE_WDGFileUpload"]`.
6. Usar `set_input_files(pdf_path)`.
7. Clickear `Adjuntar` dentro de `#overDiv`.
8. Esperar cierre de `#overDiv`.
9. Validar que el nombre del archivo aparezca en el panel de adjuntos.
10. Devolver estado explicito de exito/fallo.

### Integracion en `energia_electrica`

La integracion conceptual debe quedar asi:

```text
cargar cabecera
cargar items
cargar informacion fiscal
cargar retenciones/percepciones
cargar total de control

si pdf_path existe:
    guardar borrador
    si guardado OK:
        adjuntar PDF
        validar PDF en panel
    si guardado falla:
        no adjuntar PDF
si pdf_path no existe:
    no guardar/no adjuntar, segun comportamiento actual esperado
```

Punto critico:

```text
attach_pdf() nunca debe ejecutarse si save_draft() fallo.
```

## Criterios de aceptacion

La implementacion se considera correcta cuando:

1. Una factura nueva se guarda y Finnegans asigna numero interno.
2. El PDF se adjunta solo despues del guardado.
3. El panel de adjuntos lista el nombre del PDF.
4. El contador del boton `Adjuntar` pasa a `1`.
5. Si aparece comprobante repetido, no se intenta adjuntar.
6. Si aparece descuadre de total de control, no se intenta adjuntar.
7. El resultado/log diferencia claramente:
   - carga del formulario
   - guardado exitoso
   - adjunto exitoso
   - fallo de guardado
   - fallo de adjunto

## Checklist de prueba manual con Playwright

1. Login en FinnegansGO.
2. Seleccionar `TAFI CABLE COLOR SA`.
3. Abrir `Facturas de Compra`.
4. Crear `Factura de Compra`.
5. Workflow `Compras - Productos & Insumos - Sin Asistente`.
6. Completar cabecera EDET.
7. Cargar items del flujo energia.
8. Cargar informacion fiscal.
9. Cargar percepciones.
10. Validar `Total = 412,120.00`.
11. Cargar `Total De Control = 412,120.00`.
12. Click `Guardar`.
13. Confirmar `Factura de Compra - <numero>`.
14. Click `Adjuntar`.
15. Click `Nuevo Adjunto`.
16. Si `#overDiv` ya esta abierto, continuar sin reintentar click.
17. Setear archivo en `#fileVerdad_0`.
18. Click `Adjuntar` dentro de `#overDiv`.
19. Confirmar que el panel muestra el PDF.
20. Confirmar contador `Adjuntar 1`.

## Nota final

El punto mas importante de este flujo es entender que FinnegansGO no abre un file chooser nativo para adjuntos. Usa un panel propio y un popup custom:

```text
Panel adjuntos -> a.new -> #overDiv -> #fileVerdad_0 -> boton Adjuntar
```

Por eso la implementacion robusta debe interactuar directamente con el input:

```text
#fileVerdad_0
```

y debe hacerlo solamente despues de que la factura ya fue guardada.
