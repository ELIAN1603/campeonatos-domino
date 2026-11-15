// Prueba del contrato: crea un .xlsx con la hoja WEB a partir de los JSON de datos/_prueba,
// lo lee con SheetJS como hará publicar.html y comprueba que sale el mismo JSON.
// Uso: node pruebas/probar_contrato.cjs
const assert = require('assert');
const fs = require('fs'), os = require('os'), path = require('path');
const { execFileSync } = require('child_process');
const XLSX = require('../assets/xlsx.mini.min.js');
const C = require('../assets/contrato.js');

const raiz = path.join(__dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tumesa-'));
const ids = ['sp-ejemplo', 'parejas-ejemplo-2026-11-14', 'individual-ejemplo-2026-11-14', 'sp-ejemplo-anterior'];
let fallos = 0, hechos = 0;
const ok = (nombre, fn) => { try { fn(); hechos++; console.log('  ok  ' + nombre); } catch (e) { fallos++; console.log('  FALLA ' + nombre + '\n       ' + String(e.message).split('\n').slice(0, 6).join('\n       ')); } };

function hoja(id) {
  const xl = path.join(tmp, id + '.xlsx');
  execFileSync('python3', [path.join(__dirname, 'hacer_xlsx.py'), path.join(raiz, 'datos/_prueba', id, 'actual.json'), xl]);
  const wb = XLSX.read(fs.readFileSync(xl), { type: 'buffer', sheets: 'WEB' });
  return { wb, ws: wb.Sheets.WEB, xl };
}
const sinJornadas = (o) => { const c = JSON.parse(JSON.stringify(o)); delete c.jornadas; delete c.publicado; return c; };

console.log('Lectura y construcción (ida y vuelta con los JSON de prueba)');
for (const id of ids) {
  const { wb, ws } = hoja(id);
  ok(`${id}: solo se lee la hoja WEB`, () => assert.deepStrictEqual(Object.keys(wb.Sheets), ['WEB']));
  const r = C.leer(ws);
  const esperado = JSON.parse(fs.readFileSync(path.join(raiz, 'datos/_prueba', id, 'actual.json'), 'utf8'));
  ok(`${id}: JSON idéntico al de referencia`, () => assert.deepStrictEqual(sinJornadas(C.construir(r, 'x')), sinJornadas(esperado)));
  ok(`${id}: orden de claves y texto idénticos`, () => {
    const a = C.aTexto(C.construir(r, esperado.publicado));
    const { jornadas, ...resto } = esperado; // actual.json trae 'jornadas'; el de jornada_NN.json no
    assert.strictEqual(a, C.aTexto(resto));
  });
  ok(`${id}: sin bloqueos`, () => {
    const v = C.validar(r, C.construir(r, 'x'), { indice: null, actual: null });
    const bl = v.filter((x) => x.gravedad === 'bloquea');
    assert.deepStrictEqual(bl, []);
  });
  ok(`${id}: ni teléfonos ni licencias en el JSON`, () => {
    const s = C.aTexto(C.construir(r, 'x'));
    for (const malo of ['LIC-', '6' + '12' + '345' + '678', '6' + '98 11' + ' 22 33', 'Soriano ']) assert(!s.includes(malo), malo);
  });
}

console.log('Validaciones');
function con(id, cambiar, pub) {
  const { ws } = hoja(id);
  cambiar(ws);
  const r = C.leer(ws);
  return C.validar(r, C.construir(r, 'x'), pub || {});
}
const cod = (v, c) => v.filter((x) => x.cod === c).map((x) => x.gravedad);
const poner = (ws, ref, val, t) => { ws[ref] = { t: t || (typeof val === 'number' ? 'n' : 's'), v: val }; };
const SP = 'sp-ejemplo';
const celda = (clave) => 'B' + (4 + C.CLAVES_META.indexOf(clave));
ok('V02 versión distinta', () => assert.deepStrictEqual(cod(con(SP, (w) => poner(w, 'A1', '2.0')), 'V02'), ['bloquea']));
ok('V02 versión como número', () => assert.deepStrictEqual(cod(con(SP, (w) => poner(w, 'A1', 1)), 'V02'), ['bloquea']));
ok('V02b versión menor mayor', () => assert.deepStrictEqual(cod(con(SP, (w) => poner(w, 'A1', '1.3')), 'V02b'), ['avisa']));
ok('V03 cabecera cambiada', () => assert.deepStrictEqual(cod(con(SP, (w) => poner(w, 'Q3', 'idd')), 'V03'), ['bloquea']));
ok('V04 id no válido', () => assert.deepStrictEqual(cod(con(SP, (w) => poner(w, celda('id'), 'Sp Ejemplo')), 'V04'), ['bloquea']));
ok('V04 id usado por otro tipo', () => assert.deepStrictEqual(cod(con(SP, () => {}, { indice: { torneos: [{ id: 'sp-ejemplo', tipo: 'parejas', nombre: 'X' }] } }), 'V04'), ['bloquea']));
ok('V04b mismo id otro nombre', () => assert.deepStrictEqual(cod(con(SP, () => {}, { indice: { torneos: [{ id: 'sp-ejemplo', tipo: 'sp', nombre: 'OTRO' }] } }), 'V04b'), ['confirma']));
ok('V05 celda con error', () => assert.deepStrictEqual(cod(con(SP, (w) => poner(w, 'Z9', '#N/A', 'e')), 'V05'), ['bloquea']));
ok('V05 ¿LICENCIA?', () => assert.deepStrictEqual(cod(con(SP, (w) => poner(w, 'G5', '¿LICENCIA?')), 'V05'), ['bloquea']));
ok('V19 texto de más de 300 caracteres', () => assert.deepStrictEqual(cod(con(SP, (w) => poner(w, celda('lugar'), 'x'.repeat(301))), 'V19'), ['bloquea']));
ok('V06 teléfono en la zona', () => assert.deepStrictEqual(cod(con(SP, (w) => poner(w, 'J5', '6' + '12 345' + ' 678')), 'V06'), ['bloquea']));
ok('V06 cifra en un nombre', () => assert.deepStrictEqual(cod(con(SP, (w) => poner(w, 'E5', 'Nuria2')), 'V06'), ['bloquea']));
ok('V06 teléfono en el lugar', () => assert.deepStrictEqual(cod(con(SP, (w) => poner(w, celda('lugar'), 'Llamar al ' + '6' + '12' + '345' + '678')), 'V06'), ['bloquea']));
ok('V06 número con decimales', () => assert.deepStrictEqual(cod(con(SP, (w) => poner(w, 'W4', 1450.5)), 'V06'), ['bloquea']));
ok('V06 número de 6 cifras', () => assert.deepStrictEqual(cod(con(SP, (w) => poner(w, 'W4', 123456)), 'V06'), ['bloquea']));
ok('V07 pareja que no sale en mesas', () => assert.deepStrictEqual(cod(con(SP, (w) => { delete w['AH4']; }), 'V07'), ['bloquea']));
ok('V07 mesa repetida', () => assert.deepStrictEqual(cod(con(SP, (w) => poner(w, 'AD5', 1)), 'V07'), ['bloquea']));
ok('V07 puesto salteado', () => assert.deepStrictEqual(cod(con(SP, (w) => poner(w, 'P6', 9)), 'V07'), ['bloquea']));
ok('V07 n_participantes', () => assert.deepStrictEqual(cod(con(SP, (w) => poner(w, celda('n_participantes'), 7)), 'V07'), ['bloquea']));
ok('V07 grupo B sin hay_b', () => assert.deepStrictEqual(cod(con(SP, (w) => poner(w, 'K5', 'B')), 'V07'), ['bloquea']));
ok('V07b mesa individual con 1+1', () => assert.deepStrictEqual(cod(con('individual-ejemplo-2026-11-14', (w) => { delete w['AG4']; }), 'V07b'), ['bloquea']));
ok('V08 dt no cuadra', () => assert.deepStrictEqual(cod(con(SP, (w) => poner(w, 'Y4', 999)), 'V08'), ['bloquea']));
ok('V08 mesa jugada sin tantos', () => assert.deepStrictEqual(cod(con(SP, (w) => { delete w['AN5']; }), 'V08'), ['bloquea']));
ok('V08b resultado raro', () => assert.deepStrictEqual(cod(con(SP, (w) => { poner(w, 'AL5', 3); poner(w, 'AM5', 0); }), 'V08b'), ['avisa']));
ok('V09 jornada anterior a la publicada', () => assert.deepStrictEqual(cod(con(SP, () => {}, { actual: { torneo: { id: 'sp-ejemplo' }, jornada: { numero: 5 }, jornadas: [] } }), 'V09'), ['confirma']));
ok('V10 saltos de jornada', () => assert.deepStrictEqual(cod(con(SP, () => {}, { actual: { torneo: { id: 'sp-ejemplo' }, jornada: { numero: 1 }, jornadas: [{ numero: 1, completa: true }] } }), 'V10'), ['avisa']));
ok('V11 jornada anterior sin completar', () => assert.deepStrictEqual(cod(con(SP, () => {}, { actual: { torneo: { id: 'sp-ejemplo' }, jornada: { numero: 2 }, jornadas: [{ numero: 2, completa: false }] } }), 'V11'), ['avisa']));
ok('V12 menos resultados que lo publicado', () => assert.deepStrictEqual(cod(con(SP, () => {}, { existente: { jornada: { mesas_pendientes: 0 } } }), 'V12'), ['confirma']));
ok('V13 errores en la hoja', () => assert.deepStrictEqual(cod(con(SP, (w) => poner(w, celda('errores'), 2)), 'V13'), ['confirma']));
ok('V14 sin sortear', () => assert.deepStrictEqual(cod(con(SP, (w) => poner(w, celda('sin_sortear'), 1)), 'V14'), ['confirma']));
ok('V16 normativa sin https', () => assert.deepStrictEqual(cod(con(SP, (w) => poner(w, celda('normativa_url'), 'http://x.es/n.pdf')), 'V16'), ['bloquea']));
ok('V17 fecha mala en parejas', () => assert.deepStrictEqual(cod(con('parejas-ejemplo-2026-11-14', (w) => poner(w, celda('fecha'), '2026-02-30')), 'V17'), ['bloquea']));
ok('V18 jornada mayor que n_jornadas', () => assert.deepStrictEqual(cod(con(SP, (w) => poner(w, celda('jornada'), 15)), 'V18'), ['bloquea']));

console.log('Archivos a escribir');
ok('actual.json lleva "jornadas" tras "jornada" y fusiona con lo publicado', () => {
  const { ws } = hoja(SP);
  const j = C.construir(C.leer(ws), '2026-11-14T18:30:00Z');
  const prev = { torneo: { id: 'sp-ejemplo' }, jornadas: [{ numero: 1, completa: true, publicado: 'a' }, { numero: 3, completa: false, publicado: 'viejo' }] };
  const l = C.jornadasNuevas(j, prev);
  assert.deepStrictEqual(l, [{ numero: 1, completa: true, publicado: 'a' }, { numero: 3, completa: false, publicado: '2026-11-14T18:30:00Z' }]);
  const a = C.conJornadas(j, l);
  const k = Object.keys(a);
  assert.strictEqual(k[k.indexOf('jornada') + 1], 'jornadas');
});
ok('indice.json: añade, reemplaza y ordena por fecha', () => {
  const j = C.construir(C.leer(hoja(SP).ws), '2026-11-14T18:30:00Z');
  const ind = { version: '1.0', publicado: 'a', torneos: [{ id: 'otro', fecha: '2027-01-01' }, { id: 'sp-ejemplo', fecha: '2020-01-01' }, { id: 'viejo', fecha: '2019-01-01' }] };
  const n = C.indiceNuevo(ind, j);
  assert.deepStrictEqual(n.torneos.map((x) => x.id), ['otro', 'sp-ejemplo', 'viejo']);
  assert.strictEqual(n.torneos[1].fecha, '2026-10-13');
  assert.strictEqual(n.torneos[1].ganador, null);
});
ok('indice.json: ganador cuando el torneo está terminado', () => {
  const j = C.construir(C.leer(hoja('sp-ejemplo-anterior').ws), 'x');
  const e = C.indiceNuevo(null, j).torneos[0];
  assert.strictEqual(e.estado, 'terminado');
  assert.deepStrictEqual(e.ganador, { id: 3, corto: 'Pons-Giner' });
});

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n${hechos} pruebas bien, ${fallos} con fallo`);
process.exit(fallos ? 1 : 0);
