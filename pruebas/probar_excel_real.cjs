// Prueba con un Excel real de un generador (hoja WEB de verdad, valores guardados): lo lee con SheetJS como hace
// publicar.html y comprueba que sale el mismo JSON que escribe tools/comun/web_export.py (programas-domino; sirve para sp, parejas e individual).
// El Excel NO está ni debe estar en este repositorio: se pasa por ruta.
//
//   python3 -I <programas-domino>/tools/comun/web_export.py libro.xlsx /tmp/web --publicado 2026-01-01T00:00:00Z
//   node pruebas/probar_excel_real.cjs libro.xlsx /tmp/web/<id>/jornada_NN.json [url-base, por defecto http://localhost:8765] [--ficticio]
//   --ficticio: libro de los casos de prueba (nombres con cifras, que V06 bloquea). Solo comprueba la parte de Node y que V06 sea lo único que bloquea.
//
// 1) Node: SheetJS lee solo la hoja WEB, A1 es texto "1.0", ninguna celda con error, sin bloqueos de validación, JSON idéntico.
// 2) Navegador (Playwright): se elige el Excel en publicar.html con una API de GitHub simulada, se publica y los archivos
//    escritos son idénticos, byte a byte, a los de web_export.py. Se mide el tiempo desde elegir el archivo hasta la revisión.
const assert = require('assert');
const fs = require('fs'), path = require('path');
const XLSX = require('../assets/xlsx.mini.min.js');
const C = require('../assets/contrato.js');
const { chromium } = require('playwright');
const { instalar, recordarWeb } = require('./api_simulada.cjs');

const ficticio = process.argv.includes('--ficticio');   // casos de prueba con nombres como Nom1a: V06 bloquea a propósito
const [xlsx, jsonPy, base = 'http://localhost:8765'] = process.argv.slice(2).filter((x) => !x.startsWith('--'));
if (!xlsx || !jsonPy) { console.error('Uso: node pruebas/probar_excel_real.cjs libro.xlsx jornada_NN.json [url-base]'); process.exit(2); }
const quitar = (o) => { const c = JSON.parse(JSON.stringify(o)); delete c.publicado; delete c.jornadas; return c; };
const esperado = JSON.parse(fs.readFileSync(jsonPy, 'utf8'));
const textoPy = fs.readFileSync(jsonPy, 'utf8');
let ok = 0;
const bien = (t) => { ok++; console.log('  ok  ' + t); };
const MB = (fs.statSync(xlsx).size / 1048576).toFixed(2);
console.log(`${path.basename(xlsx)} (${MB} MB), jornada ${esperado.jornada.numero}, ${esperado.participantes.length} participantes`);

(async () => {
  // ---- 1) Node
  const buf = fs.readFileSync(xlsx);
  let t0 = process.hrtime.bigint();
  const wb = XLSX.read(buf, { type: 'array', sheets: 'WEB' });
  const msNode = Number(process.hrtime.bigint() - t0) / 1e6;
  const ws = wb.Sheets.WEB;
  assert.deepStrictEqual(Object.keys(wb.Sheets), ['WEB']);
  bien(`SheetJS lee solo la hoja WEB (${msNode.toFixed(0)} ms en Node)`);
  assert.strictEqual(ws.A1.t, 's'); assert.strictEqual(ws.A1.v, '1.0');
  bien('A1 es el texto "1.0", no un número');
  const r = C.leer(ws);
  assert.deepStrictEqual(r.estructura, []); assert.deepStrictEqual(r.celdasError, []);
  bien('estructura del contrato y ninguna celda con error');
  // vacíos: una fórmula que da "" se guarda como cadena vacía o sin valor y debe leerse como null
  const vacias = Object.keys(ws).filter((k) => /^[A-Z]+\d+$/.test(k) && ws[k].t === 's' && ws[k].v === '').length;
  const nulos = r.participantes.filter((p) => p.ret_desde === null).length;
  assert(nulos > 0);
  bien(`celdas vacías ("" de una fórmula): ${vacias} cadenas vacías en la hoja, leídas como null`);
  const fechas = [r.meta.fecha, r.meta.plazo_desde, r.meta.plazo_hasta].filter((x) => x != null);
  assert(fechas.every((f) => typeof f === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(f)));
  bien(`fechas como texto aaaa-mm-dd: ${fechas.join(', ')}`);
  const j = C.construir(r, 'x');
  assert.deepStrictEqual(quitar(j), quitar(esperado));
  bien('JSON de publicar.html (contrato.js) == JSON de web_export.py, objeto a objeto');
  const v = C.validar(r, j, { indice: null, actual: null });
  const bloqueos = v.filter((x) => x.gravedad === 'bloquea').map((x) => x.cod);
  assert.deepStrictEqual(bloqueos, ficticio ? ['V06'] : []);
  bien(ficticio ? 'validación: solo V06 bloquea (nombres ficticios con cifras)' : 'validación V01–V18: sin bloqueos' + (v.length ? ` (${v.map((x) => x.cod).join(', ')})` : ''));
  if (ficticio) { console.log(`\n${ok} comprobaciones bien`); return; }

  // ---- 2) navegador
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1000, height: 900 } });
  await ctx.addInitScript(() => localStorage.setItem('tumesa.token', 'ghp_TOKEN_DE_PRUEBA'));
  const api = await instalar(ctx);
  await recordarWeb(ctx); // la contraseña de la web ya está en este navegador
  const pg = await ctx.newPage();
  const errores = []; pg.on('pageerror', (e) => errores.push(e.message));
  await pg.goto(base + '/publicar.html');
  t0 = process.hrtime.bigint();
  await pg.setInputFiles('#archivo', xlsx);
  await pg.waitForSelector('.tabla-caja', { timeout: 120000 });
  const msNav = Number(process.hrtime.bigint() - t0) / 1e6;
  await pg.click('input[name=destino][value=web]'); // un torneo nuevo se propone como borrador; aquí se publica en la web
  await pg.waitForFunction(() => document.querySelector('#publicar').textContent === 'Publicar en la web');
  assert.strictEqual(await pg.isDisabled('#publicar'), false);
  bien(`publicar.html lee y valida el Excel de ${MB} MB en ${(msNav / 1000).toFixed(2)} s (Chromium, esta máquina) y deja publicar`);
  const vals = await pg.$$eval('.vals > li.bloquea, .vals > li.confirma, .vals > li.avisa', (l) => l.map((x) => x.className + ': ' + x.textContent.slice(0, 80)));
  if (vals.length) console.log('     avisos en pantalla: ' + vals.join(' // '));
  await pg.click('#publicar'); await pg.waitForSelector('text=Publicado.', { timeout: 60000 });
  const id = esperado.torneo.id, nn = String(esperado.jornada.numero).padStart(2, '0');
  assert.deepStrictEqual(api.puts.map((p) => p.clave + ' ' + p.ruta), [`web datos/${id}/jornada_${nn}.json`, `web datos/${id}/actual.json`, 'web datos/indice.json']);
  const sinPub = (t) => t.replace(/"publicado": "[^"]*"/g, '"publicado": "X"');
  assert.strictEqual(sinPub(api.bytes('web', `datos/${id}/jornada_${nn}.json`).toString('utf8')), sinPub(textoPy));
  bien('jornada_NN.json escrito por publicar.html: idéntico, byte a byte, al de web_export.py (salvo `publicado`), una vez descifrado');
  assert.deepStrictEqual(api.enClaro, []);
  assert(api.puts.every((p) => api.cifradoCon(p.ruta) === 0));
  bien('los tres archivos subieron cifrados con la clave de la web');
  const act = api.json('web', `datos/${id}/actual.json`);
  assert.deepStrictEqual(quitar(act), quitar(esperado));
  assert.deepStrictEqual(act.jornadas.map((x) => x.numero), [esperado.jornada.numero]);
  bien('actual.json e indice.json coherentes');
  assert.deepStrictEqual(errores, []);
  bien('sin errores de JavaScript en la página');
  await b.close();
  console.log(`\n${ok} comprobaciones bien`);
})().catch((e) => { console.error('FALLA:', e.message); process.exit(1); });
