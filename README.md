# campeonatos-domino

Web de resultados de los campeonatos de dominó que lleva la mesa de control (Jesús Eduardo Elián C.). Sitio estático para GitHub Pages, sin servidor.

Este repositorio es público. **Nunca entra un Excel, un teléfono ni una licencia.** El `.gitignore` deja fuera `*.xlsx`, `*.xlsm` y `*.xls`.

## Qué hay

| Ruta | Para qué |
|---|---|
| `index.html` | Portada: campeonatos en juego y terminados, y buscador de jugador |
| `torneo.html?t=<id>` | Un campeonato: Clasificación, Mesas, Resultados, Parejas y Folleto |
| `publicar.html` | Para la mesa de control: lee la hoja WEB del Excel, valida y escribe los JSON |
| `assets/` | Estilo, código de la web, código del contrato de datos y SheetJS (copia local, sin CDN) |
| `datos/indice.json` | Lista de campeonatos que ve la portada. Lo escribe `publicar.html` |
| `datos/<id>/` | `jornada_NN.json` (una foto por jornada), `actual.json` y, si lo hay, `folleto.pdf` |
| `datos/_prueba/` | Datos inventados para probar. No salen en `indice.json` |
| `pruebas/` | Pruebas automáticas |

El formato de los JSON y de la hoja WEB está en `docs/W2_contrato_datos.md` del repositorio `programas-domino`.

## Cómo decide la web qué enseña

- La clasificación va en vivo, como en el Excel: en cuanto la jornada en curso tiene un resultado, se ve esa jornada, reordenada, con ⏳ en quien aún no ha jugado (`pendiente` del JSON; lleva sus cifras de antes). Mientras no haya ningún resultado, se ve la última jornada cerrada.
- Bajo el selector de jornada, en Clasificación y en Mesas, sale «Jornada N · se juega del dd/mm al dd/mm» con `plazo_desde` y `plazo_hasta`; si están vacíos no sale nada.
- La pestaña Folleto enseña el calendario (clave opcional `calendario` de `actual.json`, con la jornada en curso resaltada) y el PDF `datos/<id>/folleto.pdf`, con descarga y vista integrada si el navegador la admite. El folleto se sube a mano y nunca lleva teléfonos ni cuentas bancarias. Detalle en `docs/W2_contrato_datos.md`, sección 12.
- La web no enseña criterios de clasificación; la leyenda de columnas sí.
- Cada jornada conserva los nombres que tenía cuando se publicó, así que una sustitución no reescribe las anteriores.
- Mientras un campeonato está en juego, la página pide `actual.json` cada 60 segundos y se detiene si la pestaña está oculta.
- Todo texto de los JSON se pinta como texto, nunca como HTML.

## Ver los datos de prueba

Abre cualquier página con `?d=datos/_prueba`:

```
index.html?d=datos/_prueba
torneo.html?t=sp-ejemplo&d=datos/_prueba
```

## Pruebas

Hace falta Node 18 o más, Python 3 con `openpyxl` y Playwright. Desde la raíz:

```bash
python3 -m http.server 8765 &
node pruebas/probar_contrato.cjs
node pruebas/probar_publicar.cjs
node pruebas/probar_web.cjs
```

- `probar_contrato.cjs` crea un `.xlsx` pequeño con la hoja WEB (con `hacer_xlsx.py`), lo lee con SheetJS y comprueba que sale el mismo JSON que los ejemplos, y que cada validación V01 a V18 salta cuando toca. El `.xlsx` queda en la carpeta temporal y se borra.
- `probar_publicar.cjs` abre `publicar.html` en Chromium con una API de GitHub simulada y publica de verdad contra ella.
- `probar_web.cjs` recorre la web a 390 px y a 1280 px: buscador, pestañas, jornadas, grupos, filtro, fechas de juego, calendario, folleto, estados raros y que nada desborde.
- `probar_excel_real.cjs` necesita un Excel real; ver la sección siguiente.

## Prueba con el Excel real del SP

`pruebas/probar_excel_real.cjs` lee un Excel de verdad (el del 24º SP y la demo del 23º), con SheetJS y con `publicar.html` en Chromium, y comprueba que el JSON es el mismo que escribe `tools/sp/web_export.py` de `programas-domino`. El Excel se pasa por ruta y no entra nunca en este repositorio.

```bash
python3 -I <programas-domino>/tools/sp/web_export.py libro.xlsx /tmp/web --publicado 2026-01-01T00:00:00Z
node pruebas/probar_excel_real.cjs libro.xlsx /tmp/web/<id>/jornada_NN.json
```

Resultado con los entregables de W2b (14/11/2026), sin cambiar `publicar.html` ni la web:

1. Valores guardados, vacíos, `A1` y fechas: SheetJS lee las fórmulas con su valor guardado. Las 4.500 celdas que dan `""` salen como `null`, `A1` es el texto `"1.0"` y las fechas son texto `aaaa-mm-dd`.
2. Mismo JSON: `contrato.js` y `web_export.py` dan el mismo objeto en el 24º (jornada 3 en curso) y en el 23º (14 jornadas, grupo B). `publicar.html` escribe `jornada_NN.json` idéntico, byte a byte, salvo `publicado`. También coinciden en los casos S0–S7 de `programas-domino` (con `--ficticio`, porque sus nombres llevan cifras y V06 los bloquea a propósito) y en las jornadas con incomparecencia, No disputado, descanso, retirada y sustitución.
3. Tiempo de lectura: unos 0,35 s en Node y de 0,5 a 0,7 s en Chromium desde elegir el archivo hasta la revisión, con Excels de 6 a 6,5 MB. Medido aquí, no en el PC del árbitro.

## Lo que falta comprobar

1. La escritura real contra GitHub con el token del padre (hasta ahora, solo contra una API simulada): permisos, errores 401, 403 y 409 y el origen `github.io`.
2. El tiempo de lectura en el PC del árbitro (Windows 10, Chrome o Edge). Aquí tarda menos de un segundo, pero la máquina es otra.
3. Que Pages sirva `datos/` con el retraso esperado y que el refresco de 60 segundos vea las publicaciones.
4. Un Excel guardado por Excel de verdad. Los de prueba los guarda LibreOffice (y `inject_values.py` pone los valores), así que falta confirmar que Excel 2016 los guarda igual.
5. Los casos que aún no tienen Excel: una retirada con grupo B, y los programas de parejas e individual (P3b).
