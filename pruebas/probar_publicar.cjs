// Prueba de publicar.html en un navegador (Playwright) con una API de GitHub simulada.
// Uso: node pruebas/probar_publicar.cjs [url-base, por defecto http://localhost:8765]
const assert = require('assert');
const fs = require('fs'), os = require('os'), path = require('path');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright');
const base = process.argv[2] || 'http://localhost:8765';
const raiz = path.join(__dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tumesa-pub-'));
const xlsx = (id, nombre) => { const f = path.join(tmp, nombre || id + '.xlsx'); execFileSync('python3', [path.join(__dirname, 'hacer_xlsx.py'), path.join(raiz, 'datos/_prueba', id, 'actual.json'), f]); return f; };
const leerJson = (r) => JSON.parse(fs.readFileSync(path.join(raiz, 'datos/_prueba', r), 'utf8'));
const sinPub = (o) => { const c = JSON.parse(JSON.stringify(o)); delete c.publicado; return c; };

(async () => {
  const repo = new Map(); // ruta -> {sha, texto}
  let n = 0; const puts = [];
  repo.set('datos/indice.json', { sha: 's' + ++n, texto: JSON.stringify({ version: '1.0', publicado: '2026-01-01T00:00:00Z', torneos: [] }, null, 1) + '\n' }); // repo simulado: parte de un índice vacío, no del real
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1000, height: 900 } });
  const pg = await ctx.newPage();
  const errores = []; pg.on('pageerror', (e) => errores.push(e.message));
  await pg.route('https://api.github.com/**', async (route) => {
    const req = route.request(); const u = new URL(req.url());
    const cab = req.headers();
    if (cab.authorization !== 'Bearer ghp_TOKEN_DE_PRUEBA') return route.fulfill({ status: 401, body: '{}' });
    const m = /\/repos\/ELIAN1603\/campeonatos-domino\/contents\/(.+)$/.exec(u.pathname);
    if (!m) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ permissions: { push: true } }) });
    const ruta = decodeURIComponent(m[1]);
    if (req.method() === 'GET') {
      const f = repo.get(ruta);
      if (!f) return route.fulfill({ status: 404, body: '{"message":"Not Found"}' });
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ sha: f.sha, content: Buffer.from(f.texto, 'utf8').toString('base64').replace(/(.{60})/g, '$1\n') }) });
    }
    const c = JSON.parse(req.postData());
    const f = repo.get(ruta);
    if (f && c.sha !== f.sha) return route.fulfill({ status: 409, body: '{}' });
    if (!f && c.sha) return route.fulfill({ status: 422, body: '{}' });
    repo.set(ruta, { sha: 's' + ++n, texto: Buffer.from(c.content, 'base64').toString('utf8') });
    puts.push({ ruta, mensaje: c.message, rama: c.branch });
    return route.fulfill({ status: 201, contentType: 'application/json', body: '{"content":{},"commit":{}}' });
  });
  let ok = 0; const bien = (t) => { ok++; console.log('  ok  ' + t); };

  await pg.goto(base + '/publicar.html');
  // token incorrecto
  await pg.fill('#token', 'ghp_MAL'); await pg.click('text=Guardar y comprobar');
  await pg.waitForSelector('text=GitHub no acepta el token');
  bien('token incorrecto: mensaje en lenguaje llano');
  await pg.fill('#token', 'ghp_TOKEN_DE_PRUEBA'); await pg.click('text=Guardar y comprobar');
  await pg.waitForSelector('text=Hay un token guardado');
  assert.strictEqual(await pg.evaluate(() => localStorage.getItem('tumesa.token')), 'ghp_TOKEN_DE_PRUEBA');
  bien('token guardado en localStorage');

  // Excel sin hoja WEB
  const sinWeb = path.join(tmp, 'sin.xlsx');
  execFileSync('python3', ['-c', `import openpyxl;w=openpyxl.Workbook();w.active.title='INICIO';w.save(r'${sinWeb}')`]);
  await pg.setInputFiles('#archivo', sinWeb);
  await pg.waitForSelector('text=no tiene la hoja WEB');
  bien('V01: Excel sin hoja WEB');
  // archivo que no es Excel
  const txt = path.join(tmp, 'a.txt'); fs.writeFileSync(txt, 'hola');
  await pg.setInputFiles('#archivo', txt);
  await pg.waitForSelector('text=termina en .xlsx');
  bien('archivo que no es Excel');

  // Excel con un teléfono: bloquea
  const mal = path.join(tmp, 'mal.xlsx');
  execFileSync('python3', ['-c', `
import json,subprocess,sys
sys.argv=['x',r'${path.join(raiz, 'datos/_prueba/sp-ejemplo/actual.json')}',r'${mal}']
src=open(r'${path.join(__dirname, 'hacer_xlsx.py')}',encoding='utf-8').read().replace("wb.save(sys.argv[2])","ws['J5']='6' + '12 34' + ' 56 78'\\nwb.save(sys.argv[2])")
exec(src)`]);
  await pg.setInputFiles('#archivo', mal);
  await pg.waitForSelector('.vals li.bloquea');
  assert.strictEqual(await pg.isDisabled('#publicar'), true);
  assert((await pg.textContent('.vals li.bloquea')).includes('J5'));
  bien('V06: teléfono bloquea y el botón queda desactivado');

  // Publicar el SP de ejemplo (jornada 3)
  await pg.setInputFiles('#archivo', xlsx('sp-ejemplo'));
  await pg.waitForSelector('.tabla-caja');
  const vals = await pg.$$eval('.vals > li', (l) => l.map((x) => x.className + ' | ' + x.textContent));
  console.log('     avisos:', vals.map((v) => v.slice(0, 90)).join(' // '));
  assert.strictEqual(await pg.isDisabled('#publicar'), false);
  await pg.screenshot({ path: path.join(tmp, '..', 'pub_revision.png'), fullPage: true });
  await pg.click('#publicar');
  await pg.waitForSelector('text=Publicado.');
  assert.deepStrictEqual(puts.map((p) => p.ruta), ['datos/sp-ejemplo/jornada_03.json', 'datos/sp-ejemplo/actual.json', 'datos/indice.json']);
  assert.strictEqual(puts[0].rama, 'main');
  const esp = leerJson('sp-ejemplo/actual.json'); const { jornadas, ...espJornada } = esp;
  const j3 = JSON.parse(repo.get('datos/sp-ejemplo/jornada_03.json').texto);
  assert.deepStrictEqual(sinPub(j3), sinPub(espJornada));
  bien('jornada_03.json idéntico al JSON de referencia');
  const act = JSON.parse(repo.get('datos/sp-ejemplo/actual.json').texto);
  assert.deepStrictEqual(act.jornadas.map((x) => [x.numero, x.completa]), [[3, false]]);
  assert.strictEqual(repo.get('datos/sp-ejemplo/jornada_03.json').texto.endsWith('}\n'), true);
  const ind = JSON.parse(repo.get('datos/indice.json').texto);
  assert.deepStrictEqual(ind.torneos.map((t) => [t.id, t.jornada_actual, t.estado]), [['sp-ejemplo', 3, 'en_juego']]);
  bien('actual.json e indice.json escritos en orden y con el formato del contrato');

  // Publicar otro torneo: el índice los junta y ordena por fecha
  puts.length = 0;
  await pg.setInputFiles('#archivo', xlsx('parejas-ejemplo-2026-11-14'));
  await pg.waitForSelector('.tabla-caja');
  await pg.click('#publicar'); await pg.waitForSelector('text=Publicado.');
  const ind2 = JSON.parse(repo.get('datos/indice.json').texto);
  assert.deepStrictEqual(ind2.torneos.map((t) => t.id), ['parejas-ejemplo-2026-11-14', 'sp-ejemplo']);
  bien('segundo torneo: indice.json con los dos, el más reciente primero');

  // Republicar la misma jornada: no se pide confirmación (mismas mesas pendientes) y usa el sha existente
  puts.length = 0;
  await pg.setInputFiles('#archivo', xlsx('sp-ejemplo'));
  await pg.waitForSelector('.tabla-caja');
  await pg.click('#publicar'); await pg.waitForSelector('text=Publicado.');
  assert.strictEqual(puts.length, 3);
  bien('republicar la misma jornada sobrescribe con el sha anterior');

  // Jornada anterior a la publicada: pide confirmación y escribe solo su archivo
  const j2 = path.join(tmp, 'sp-j2.xlsx');
  execFileSync('python3', ['-c', `
import json,sys
j=json.load(open(r'${path.join(raiz, 'datos/_prueba/sp-ejemplo/jornada_02.json')}',encoding='utf-8'))
json.dump(j,open(r'${path.join(tmp, 'j2.json')}','w',encoding='utf-8'),ensure_ascii=False)
sys.argv=['x',r'${path.join(tmp, 'j2.json')}',r'${j2}']
exec(open(r'${path.join(__dirname, 'hacer_xlsx.py')}',encoding='utf-8').read())`]);
  puts.length = 0;
  await pg.setInputFiles('#archivo', j2);
  await pg.waitForSelector('.vals li.confirma');
  assert.strictEqual(await pg.isDisabled('#publicar'), true);
  await pg.check('.vals li.confirma input');
  assert.strictEqual(await pg.isDisabled('#publicar'), false);
  await pg.click('#publicar'); await pg.waitForSelector('text=solo se ha corregido');
  assert.deepStrictEqual(puts.map((p) => p.ruta), ['datos/sp-ejemplo/jornada_02.json', 'datos/sp-ejemplo/actual.json']);
  const act2 = JSON.parse(repo.get('datos/sp-ejemplo/actual.json').texto);
  assert.deepStrictEqual(act2.jornadas.map((x) => [x.numero, x.completa]), [[2, true], [3, false]]); // si no, la web no enseña la J2
  assert.deepStrictEqual(sinPub({ ...act2, jornadas: null }), sinPub({ ...act, jornadas: null })); // el resto de actual.json no cambia
  bien('V09: jornada anterior pide casilla, escribe jornada_02.json y la apunta en la lista de actual.json');

  assert.deepStrictEqual(errores, []);
  bien('sin errores de JavaScript en la página');
  await b.close();
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`\n${ok} comprobaciones bien`);
})().catch((e) => { console.error('FALLA:', e.message); process.exit(1); });
