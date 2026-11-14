# campeonatos-domino

Web de resultados de los campeonatos de dominó que lleva la mesa de control (Jesús Eduardo Elián C.). Sitio estático para GitHub Pages, sin servidor.

Este repositorio es público. **Nunca entra un Excel, un teléfono ni una licencia.** El `.gitignore` deja fuera `*.xlsx`, `*.xlsm` y `*.xls`.

## Qué hay

| Ruta | Para qué |
|---|---|
| `index.html` | Portada: campeonatos en juego y terminados, y buscador de jugador |
| `torneo.html?t=<id>` | Un campeonato: Clasificación, Emparejamientos, Resultados y Normativa |
| `publicar.html` | Para la mesa de control: lee la hoja WEB del Excel, valida y escribe los JSON |
| `assets/` | Estilo, código de la web, código del contrato de datos y SheetJS (copia local, sin CDN) |
| `datos/indice.json` | Lista de campeonatos que ve la portada. Lo escribe `publicar.html` |
| `datos/<id>/` | `jornada_NN.json` (una foto por jornada) y `actual.json` |
| `datos/_prueba/` | Datos inventados para probar. No salen en `indice.json` |
| `pruebas/` | Pruebas automáticas |

El formato de los JSON y de la hoja WEB está en `docs/W2_contrato_datos.md` del repositorio `programas-domino`.

## Cómo decide la web qué enseña

- La clasificación es la de la última jornada completa. Los resultados de la jornada en curso salen en Resultados según llegan, y la clasificación no se reordena hasta que esa jornada se cierra.
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
- `probar_web.cjs` recorre la web a 390 px y a 1280 px: buscador, jornadas, grupos, filtro, estados raros y que nada desborde.

## Lo que falta comprobar con el Excel real

Lo anterior usa un `.xlsx` hecho a mano con valores sueltos. Falta, cuando existan `web_export.py` y la hoja WEB de los generadores (W2b):

1. Que SheetJS lea bien los valores guardados de las fórmulas de un Excel 2016 de verdad (celdas con `""`, fechas como texto, `A1` como texto `"1.0"` y no como número).
2. Que el JSON de `publicar.html` coincida con el de `web_export.py` con el Excel del SP (S0 y S1).
3. La escritura real contra GitHub con el token del padre (hasta ahora, solo contra una API simulada): permisos, errores 401, 403 y 409 y el origen `github.io`.
4. El tiempo de lectura en el PC del árbitro (Windows 10, Chrome o Edge, Excel de unos MB).
5. Que Pages sirva `datos/` con el retraso esperado y que el refresco de 60 segundos vea las publicaciones.
6. Los casos que los ejemplos no cubren: retirada con grupo B, 100 parejas, 14 jornadas y un individual de 16 partidas.
