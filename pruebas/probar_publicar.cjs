// Prueba de la mesa de control (publicar.html y torneo.html?borrador=1) en un navegador (Playwright), con una API de GitHub simulada para los dos repositorios.
// Uso: node pruebas/probar_publicar.cjs [url-base, por defecto http://localhost:8765]
const assert = require('assert');
const fs = require('fs'), os = require('os'), path = require('path');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright');
const { instalar, TOKEN } = require('./api_simulada.cjs');
const base = process.argv[2] || 'http://localhost:8765';
const raiz = path.join(__dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tumesa-pub-'));
const xlsx = (id, nombre) => { const f = path.join(tmp, nombre || id + '.xlsx'); execFileSync('python3', [path.join(__dirname, 'hacer_xlsx.py'), path.join(raiz, 'datos/_prueba', id, 'actual.json'), f]); return f; };
const leerJson = (r) => JSON.parse(fs.readFileSync(path.join(raiz, 'datos/_prueba', r), 'utf8'));
const sinPub = (o) => { const c = JSON.parse(JSON.stringify(o)); delete c.publicado; return c; };


const NOREPLY = { name: 'Mesa de control', email: '356692983+ELIAN1603@users.noreply.github.com' };
const vacio = () => JSON.stringify({ version: '1.0', publicado: '2026-01-01T00:00:00Z', torneos: [] }, null, 1) + '\n';
const hora = (iso) => new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso)).replace(',', '');

(async () => {
  const b = await chromium.launch();
  let ok = 0; const bien = (t) => { ok++; console.log('  ok  ' + t); };
  const abiertos = [], externos = [];
  // Cada escenario es un navegador limpio con su propio repositorio simulado.
  async function escenario({ semilla, token = true, acceso } = {}) {
    const ctx = await b.newContext({ viewport: { width: 1000, height: 900 }, timezoneId: 'Europe/Madrid', locale: 'es-ES' });
    const api = await instalar(ctx, { acceso });
    if (semilla) semilla(api);
    if (token) await ctx.addInitScript((t) => { if (!localStorage.getItem('tumesa.token') && !sessionStorage.getItem('sin-token')) localStorage.setItem('tumesa.token', t); }, TOKEN);
    ctx.on('request', (r) => { const u = new URL(r.url()); if (!['data:', 'blob:'].includes(u.protocol) && u.origin !== new URL(base).origin && u.origin !== 'https://api.github.com') externos.push(r.url()); });
    const pg = await ctx.newPage();
    const errores = []; pg.on('pageerror', (e) => errores.push(e.message));
    pg.on('console', (m) => /Content Security Policy|Refused to/i.test(m.text()) && errores.push('consola: ' + m.text()));
    await pg.addInitScript(() => { window.__csp = []; document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(e.violatedDirective + ' ' + e.blockedURI)); });
    abiertos.push(ctx);
    return { ctx, pg, api, errores };
  }
  const sembrarWeb = (api) => { api.poner('web', 'datos/indice.json', vacio()); sembrar(api, 'web', 'sp-ejemplo'); };
  const { sembrar } = require('./api_simulada.cjs');
  const abrir = async (pg) => { await pg.goto(base + '/publicar.html'); await pg.waitForSelector('#lista-web[data-listo]'); await pg.waitForSelector('#lista-borr[data-listo]'); };
  const nombres = (pg, lista) => pg.$$eval(`#lista-${lista} li.torneo`, (l) => l.map((x) => x.dataset.id));

  /* ============ 1. Token y lista de torneos ============ */
  {
    const { pg, api, errores } = await escenario({ token: false, semilla: (a) => { sembrarWeb(a); sembrar(a, 'borr', 'parejas-ejemplo-2026-11-14'); } });
    await pg.goto(base + '/publicar.html');
    await pg.fill('#token', 'ghp_MAL'); await pg.click('text=Guardar y comprobar');
    await pg.waitForSelector('text=GitHub no acepta el token');
    bien('token incorrecto: mensaje en lenguaje llano');
    await pg.fill('#token', TOKEN); await pg.click('text=Guardar y comprobar');
    await pg.waitForSelector('text=Hay un token guardado');
    assert.strictEqual(await pg.evaluate(() => localStorage.getItem('tumesa.token')), TOKEN);
    bien('token guardado en localStorage');
    assert(api.reqs.some((r) => r.ruta === '/repos/ELIAN1603/campeonatos-domino') && api.reqs.some((r) => r.ruta === '/repos/ELIAN1603/campeonatos-borradores'));
    bien('al guardar, el token se comprueba contra los dos repositorios');
    await pg.waitForSelector('#lista-web[data-listo]'); await pg.waitForSelector('#lista-borr[data-listo]');
    assert.deepStrictEqual(await nombres(pg, 'web'), ['sp-ejemplo']);
    assert.deepStrictEqual(await nombres(pg, 'borr'), ['parejas-ejemplo-2026-11-14']);
    const gr = await pg.$$eval('#paso-torneos h3', (h) => h.map((x) => x.textContent));
    assert.deepStrictEqual(gr, ['En la web', 'Borradores']);
    bien('dos grupos: «En la web» y «Borradores», cada uno con sus torneos');
    const web = await pg.textContent('#lista-web li.torneo');
    assert(web.includes('CAMPEONATO SÚPER-PRESTIGIO DE EJEMPLO') && web.includes('Super-Prestigio') && /Jornada 3 de 14/.test(web) && web.includes(hora('2026-11-14T18:30:00Z')), web);
    const bor = await pg.textContent('#lista-borr li.torneo');
    assert(bor.includes('CAMPEONATO DE PAREJAS DE EJEMPLO') && bor.includes('Parejas') && /Partida 2 de 7/.test(bor) && bor.includes(hora('2026-11-14T18:30:00Z')), bor);
    bien('cada torneo enseña nombre, tipo, jornada publicada y fecha de la última publicación');
    const acc = async (lista) => pg.$$eval(`#lista-${lista} li.torneo:first-child .acciones button, #lista-${lista} li.torneo:first-child .acciones a`, (x) => x.map((e) => e.textContent));
    assert.deepStrictEqual(await acc('web'), ['Ver', 'Editar', 'Ocultar', 'Eliminar']);
    assert.deepStrictEqual(await acc('borr'), ['Ver', 'Editar', 'Publicar', 'Eliminar']);
    bien('acciones: web = ver, editar, ocultar, eliminar; borrador = ver, editar, publicar, eliminar');
    assert.strictEqual(await pg.getAttribute('#lista-borr li.torneo a[href*="borrador=1"]', 'href'), 'torneo.html?t=parejas-ejemplo-2026-11-14&borrador=1');
    assert.strictEqual(await pg.getAttribute('#lista-web li.torneo a[href^="torneo.html"]', 'href'), 'torneo.html?t=sp-ejemplo');
    bien('«Ver» abre torneo.html?t=<id>&borrador=1 en borradores y torneo.html?t=<id> en la web');
    assert.deepStrictEqual(errores, []);
  }

  // un nombre con HTML en un JSON se pinta como texto
  {
    const { pg } = await escenario({ semilla: (a) => {
      sembrarWeb(a); sembrar(a, 'borr', 'parejas-ejemplo-2026-11-14');
      const ind = a.json('borr', 'datos/indice.json'); ind.torneos[0].nombre = '<img src=x onerror=alert(1)><b>Hola</b>';
      a.poner('borr', 'datos/indice.json', JSON.stringify(ind));
    } });
    await abrir(pg);
    assert.strictEqual(await pg.$$eval('#lista-borr li.torneo img, #lista-borr li.torneo b', (x) => x.length), 0);
    assert((await pg.textContent('#lista-borr .torneo-nombre')).includes('<img src=x onerror=alert(1)><b>Hola</b>'));
    bien('un nombre con HTML dentro de un JSON se pinta como texto');
  }

  // token sin acceso a campeonatos-borradores: dice qué permiso falta y el resto sigue
  {
    const { pg, api } = await escenario({ acceso: { borr: false }, semilla: sembrarWeb });
    await abrir(pg);
    const msg = await pg.textContent('#lista-borr');
    assert(msg.includes('campeonatos-borradores') && msg.includes('Repository access'), msg);
    assert.deepStrictEqual(await nombres(pg, 'web'), ['sp-ejemplo']);
    assert.strictEqual(api.dels.length + api.puts.length, 0);
    bien('token sin acceso a borradores: el grupo dice que falta «Repository access» y la lista de la web sigue');
    assert.strictEqual(await pg.isDisabled('#paso-torneos .acciones button:text("Ocultar")'), false);
    await pg.setInputFiles('#archivo', xlsx('sp-ejemplo'));
    await pg.waitForSelector('.tabla-caja');
    assert.strictEqual(await pg.isDisabled('input[name=destino][value=borr]'), true);
    assert.strictEqual(await pg.isChecked('input[name=destino][value=web]'), true);
    bien('sin acceso a borradores se puede subir un Excel a la web y la opción «Borrador» queda desactivada');
  }
  {
    const { pg, api } = await escenario({ semilla: sembrarWeb });
    api.soloLectura.borr = true;
    await abrir(pg);
    assert((await pg.textContent('#lista-borr')).includes('Contents: Read and write'));
    bien('token de solo lectura en borradores: avisa de que falta «Contents: Read and write»');
  }

  /* ============ 2. Subir un Excel con destino ============ */
  {
    const { pg, api, errores } = await escenario({ semilla: (a) => { sembrarWeb(a); sembrar(a, 'borr', 'parejas-ejemplo-2026-11-14'); } });
    await abrir(pg);
    await pg.setInputFiles('#archivo', xlsx('sp-ejemplo'));
    await pg.waitForSelector('.tabla-caja');
    assert.strictEqual(await pg.isChecked('input[name=destino][value=web]'), true);
    bien('destino por defecto: Web si el torneo ya está en la web');
    await pg.setInputFiles('#archivo', xlsx('individual-ejemplo-2026-11-14'));
    await pg.waitForSelector('text=CAMPEONATO INDIVIDUAL DE EJEMPLO');
    await pg.waitForSelector('.tabla-caja');
    assert.strictEqual(await pg.isChecked('input[name=destino][value=borr]'), true);
    assert.strictEqual(await pg.textContent('#publicar'), 'Guardar como borrador');
    bien('destino por defecto: Borrador si el torneo es nuevo');
    api.puts.length = 0;
    await pg.click('#publicar'); await pg.waitForSelector('text=Guardado como borrador');
    assert.deepStrictEqual(api.puts.map((p) => p.clave + ' ' + p.ruta), ['borr datos/individual-ejemplo-2026-11-14/jornada_02.json', 'borr datos/individual-ejemplo-2026-11-14/actual.json', 'borr datos/indice.json']);
    for (const p of api.puts) { assert.deepStrictEqual(p.author, NOREPLY); assert.deepStrictEqual(p.committer, NOREPLY); assert.strictEqual(p.rama, 'main'); }
    assert.deepStrictEqual(api.json('web', 'datos/indice.json').torneos.map((t) => t.id), ['sp-ejemplo']);
    assert(!api.rutas('web').some((r) => r.includes('individual')));
    assert.deepStrictEqual(api.json('borr', 'datos/indice.json').torneos.map((t) => t.id), ['parejas-ejemplo-2026-11-14', 'individual-ejemplo-2026-11-14']);
    bien('subir como borrador: escribe datos y, al final, el índice, solo en campeonatos-borradores; la web no cambia');
    await pg.waitForFunction(() => document.querySelectorAll('#lista-borr li.torneo').length === 2);
    bien('la lista de borradores se actualiza tras subir');
    // cambiar el destino vuelve a validar contra el otro repositorio
    await pg.click('input[name=destino][value=web]');
    await pg.waitForFunction(() => document.querySelector('#publicar').textContent === 'Publicar en la web');
    assert.strictEqual(await pg.isDisabled('#publicar'), false);
    bien('al cambiar el destino a Web, el botón cambia de texto y se vuelve a validar');
    assert.deepStrictEqual(errores, []);
  }

  /* ============ 3. Ver un borrador ============ */
  {
    const { pg, api, errores } = await escenario({ semilla: (a) => { sembrarWeb(a); sembrar(a, 'borr', 'parejas-ejemplo-2026-11-14'); } });
    const externos = []; pg.on('request', (r) => { const u = new URL(r.url()); if (u.origin === new URL(base).origin && /\/datos\//.test(u.pathname)) externos.push(u.pathname); });
    await pg.goto(base + '/torneo.html?t=parejas-ejemplo-2026-11-14&borrador=1');
    await pg.waitForSelector('#cab h1');
    assert.strictEqual(await pg.textContent('#cab h1'), 'CAMPEONATO DE PAREJAS DE EJEMPLO');
    assert((await pg.textContent('.banda-prueba')).includes('Borrador privado'));
    await pg.waitForSelector('table.clasi');
    await pg.click('a:text("Mesas")'); await pg.waitForSelector('.mesa');
    assert(pg.url().includes('borrador=1'));
    assert.deepStrictEqual(externos, []);
    assert(api.reqs.filter((r) => r.ruta.includes('/contents/datos/')).every((r) => r.ruta.startsWith('/repos/ELIAN1603/campeonatos-borradores/') && r.auth === 'Bearer ' + TOKEN));
    bien('borrador con token: se ve (clasificación y mesas), lee de campeonatos-borradores por la API y no pide nada de datos/ a la web pública');
    assert.deepStrictEqual(errores, []);
    // la web pública sigue leyendo de datos/ sin tocar la API
    const antes = api.reqs.length;
    await pg.goto(base + '/torneo.html?t=sp-ejemplo&d=datos/_prueba'); await pg.waitForSelector('table.clasi');
    assert.strictEqual(api.reqs.length, antes);
    bien('sin borrador=1 la página no llama a GitHub');
  }
  for (const [caso, opc, preparar] of [
    ['sin token', { token: false }, null],
    ['con un token sin acceso a borradores', { acceso: { borr: false } }, null],
    ['con un token caducado', {}, (api) => { api.token = 'otro'; }],
    ['si el borrador no existe', {}, (api) => { api.repos.borr.clear(); }],
  ]) {
    const { pg, api } = await escenario({ ...opc, semilla: (a) => { sembrar(a, 'borr', 'parejas-ejemplo-2026-11-14'); } });
    if (preparar) preparar(api);
    const antes = api.reqs.length;
    await pg.goto(base + '/torneo.html?t=parejas-ejemplo-2026-11-14&borrador=1');
    await pg.waitForSelector('#contenido .aviso');
    const todo = await pg.textContent('body');
    assert(/borrador privado/.test(todo), caso + ': ' + todo);
    assert.strictEqual(await pg.$$eval('#cab *, table, .mesa', (x) => x.length), 0, caso);
    assert(!todo.includes('PAREJAS DE EJEMPLO'), caso);
    if (caso === 'sin token') assert.strictEqual(api.reqs.length, antes);
    if (caso === 'con un token caducado') assert.strictEqual(await pg.evaluate(() => localStorage.getItem('tumesa.token')), null);
    bien('ver un borrador ' + caso + ': dice que es privado y no enseña nada' + (caso === 'sin token' ? ' (sin llamar a GitHub)' : ''));
  }
  {
    // un borrador con HTML en el nombre sigue siendo texto
    const { pg } = await escenario({ semilla: (a) => {
      sembrar(a, 'borr', 'parejas-ejemplo-2026-11-14');
      const act = a.json('borr', 'datos/parejas-ejemplo-2026-11-14/actual.json'); act.torneo.nombre = '<img src=x onerror=alert(1)>Torneo';
      a.poner('borr', 'datos/parejas-ejemplo-2026-11-14/actual.json', JSON.stringify(act));
    } });
    await pg.goto(base + '/torneo.html?t=parejas-ejemplo-2026-11-14&borrador=1'); await pg.waitForSelector('#cab h1');
    assert.strictEqual(await pg.$$eval('#cab img', (x) => x.length), 0);
    assert.strictEqual(await pg.textContent('#cab h1'), '<img src=x onerror=alert(1)>Torneo');
    bien('borrador con HTML en el nombre: se pinta como texto');
  }

  /* ============ 4. El flujo de siempre, hacia la web ============ */
  const flujo = await escenario({ semilla: (a) => { a.poner('web', 'datos/indice.json', vacio()); } });
  {
    const { pg, api, errores } = flujo; const repo = api.repos.web; const puts = api.puts;
    const antesPuts = () => puts.filter((p) => p.clave === 'web').map((p) => p.ruta);
    await abrir(pg);

    // Excel sin hoja WEB
    const sinWeb = path.join(tmp, 'sin.xlsx');
    execFileSync('python3', ['-c', `import openpyxl;w=openpyxl.Workbook();w.active.title='INICIO';w.save(r'${sinWeb}')`]);
    await pg.setInputFiles('#archivo', sinWeb);
    await pg.waitForSelector('text=no tiene la hoja WEB');
    bien('V01: Excel sin hoja WEB');
    const txt = path.join(tmp, 'a.txt'); fs.writeFileSync(txt, 'hola');
    await pg.setInputFiles('#archivo', txt);
    await pg.waitForSelector('text=termina en .xlsx');
    bien('archivo que no es Excel');
    await pg.setInputFiles('#archivo', { name: 'enorme.xlsx', mimeType: 'application/octet-stream', buffer: Buffer.alloc(26 * 1024 * 1024) });
    await pg.waitForSelector('text=demasiado grande');
    bien('límite de tamaño: un archivo de 26 MB se rechaza');

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

    // Publicar el SP de ejemplo (jornada 3): torneo nuevo → el destino por defecto es Borrador; se elige Web
    await pg.setInputFiles('#archivo', xlsx('sp-ejemplo'));
    await pg.waitForSelector('.tabla-caja');
    assert.strictEqual(await pg.isChecked('input[name=destino][value=borr]'), true);
    await pg.click('input[name=destino][value=web]');
    await pg.waitForFunction(() => document.querySelector('#publicar').textContent === 'Publicar en la web');
    const vals = await pg.$$eval('.vals > li', (l) => l.map((x) => x.className + ' | ' + x.textContent));
    console.log('     avisos:', vals.map((v) => v.slice(0, 90)).join(' // '));
    assert.strictEqual(await pg.isDisabled('#publicar'), false);
    await pg.screenshot({ path: path.join(tmp, '..', 'pub_revision.png'), fullPage: true });
    await pg.click('#publicar');
    await pg.waitForSelector('text=Publicado.');
    assert.deepStrictEqual(antesPuts(), ['datos/sp-ejemplo/jornada_03.json', 'datos/sp-ejemplo/actual.json', 'datos/indice.json']);
    assert.strictEqual(puts[0].rama, 'main');
    for (const p of puts) { assert.deepStrictEqual(p.author, NOREPLY); assert.deepStrictEqual(p.committer, NOREPLY); }
    bien('cada PUT lleva author y committer con el correo noreply (' + puts.length + ' PUT)');
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
    await pg.click('input[name=destino][value=web]');
    await pg.waitForFunction(() => document.querySelector('#publicar').textContent === 'Publicar en la web');
    await pg.click('#publicar'); await pg.waitForSelector('text=Publicado.');
    assert.deepStrictEqual(JSON.parse(repo.get('datos/indice.json').texto).torneos.map((t) => t.id), ['parejas-ejemplo-2026-11-14', 'sp-ejemplo']);
    bien('segundo torneo: indice.json con los dos, el más reciente primero');

    // Republicar la misma jornada: ya está en la web, así que el destino por defecto es Web
    puts.length = 0;
    await pg.setInputFiles('#archivo', xlsx('sp-ejemplo'));
    await pg.waitForSelector('.tabla-caja');
    assert.strictEqual(await pg.isChecked('input[name=destino][value=web]'), true);
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
    assert.deepStrictEqual(act2.jornadas.map((x) => [x.numero, x.completa]), [[2, true], [3, false]]);
    assert.deepStrictEqual(sinPub({ ...act2, jornadas: null }), sinPub({ ...act, jornadas: null }));
    bien('V09: jornada anterior pide casilla, escribe jornada_02.json y la apunta en la lista de actual.json');

    assert.deepStrictEqual(await pg.evaluate(() => window.__csp), []);
    bien('CSP: ninguna violación en publicar.html (lista, lee el Excel y publica)');
    assert.deepStrictEqual(errores, []);
    bien('sin errores de JavaScript en la página');
  }

  /* ============ 5. Publicar, ocultar, editar y eliminar ============ */
  const PAR = 'parejas-ejemplo-2026-11-14', SPE = 'sp-ejemplo';
  const semillaDos = (a) => { sembrarWeb(a); sembrar(a, 'borr', PAR); };
  const fila = (pg, lista, id) => pg.locator(`#lista-${lista} li.torneo[data-id="${id}"]`);
  const boton = (pg, lista, id, txt) => fila(pg, lista, id).locator(`.acciones button:text-is("${txt}")`);
  const MSG_OK = /^(Publicar|Borrador|Ocultar|Eliminar|Editar|Publicar borrador) [a-z0-9-]+(: jornada \d+)?$/;
  const copia = (api, de, a, id) => api.rutas(de).filter((r) => r.startsWith(`datos/${id}/`)).every((r) => api.repos[a].has(r) && api.repos[a].get(r).texto === api.repos[de].get(r).texto);

  // publicar un borrador
  {
    const { pg, api, errores } = await escenario({ semilla: semillaDos });
    await abrir(pg);
    api.puts.length = 0;
    await boton(pg, 'borr', PAR, 'Publicar').click();
    await pg.waitForSelector('#lista-borr .aviso-accion');
    const aviso = await pg.textContent('#lista-borr .aviso-accion');
    assert(/público/.test(aviso) && /3 archivos/.test(aviso), aviso);
    assert.strictEqual(api.puts.length, 0);
    bien('publicar un borrador: antes de escribir pide confirmación y dice que será público');
    await pg.click('#lista-borr .panel button:text-is("Cancelar")');
    assert.strictEqual(api.puts.length, 0); assert.strictEqual(await pg.$$eval('#lista-borr .panel:not(:empty)', (x) => x.length), 0);
    await boton(pg, 'borr', PAR, 'Publicar').click();
    await pg.click('#lista-borr .panel button:text-is("Sí, publicar en la web")');
    await pg.waitForSelector('#registro-mesa:has-text("Publicado.")');
    assert.deepStrictEqual(api.log, [`PUT web datos/${PAR}/jornada_01.json`, `PUT web datos/${PAR}/jornada_02.json`, `PUT web datos/${PAR}/actual.json`, 'PUT web datos/indice.json']);
    assert(copia(api, 'borr', 'web', PAR));
    assert.deepStrictEqual(api.json('web', 'datos/indice.json').torneos.map((t) => t.id), [PAR, SPE]);
    assert(api.rutas('borr').includes(`datos/${PAR}/actual.json`));
    assert.deepStrictEqual(api.violaciones, []);
    bien('publicar un borrador: copia los datos a la web, añade el índice al final, deja el borrador y la web nunca apunta a archivos que faltan');
    for (const p of api.puts) { assert.deepStrictEqual(p.author, NOREPLY); assert.deepStrictEqual(p.committer, NOREPLY); assert(MSG_OK.test(p.mensaje), p.mensaje); }
    bien('mensajes de commit sin datos personales y firmados por «Mesa de control»');
    await pg.waitForFunction(() => document.querySelectorAll('#lista-web li.torneo').length === 2);
    assert((await fila(pg, 'borr', PAR).textContent()).includes('También está en la web'));
    assert.deepStrictEqual(errores, []);
  }

  // ocultar
  {
    const { pg, api, errores } = await escenario({ semilla: semillaDos });
    await abrir(pg);
    api.puts.length = 0;
    await boton(pg, 'web', SPE, 'Ocultar').click();
    await pg.waitForSelector('#lista-web .aviso-accion');
    assert(/historial público de git/.test(await pg.textContent('#lista-web .aviso-accion')));
    assert.strictEqual(api.log.length, 0);
    await pg.click('#lista-web .panel button:text-is("Cancelar")');
    assert.strictEqual(api.log.length, 0);
    bien('ocultar: pide confirmación y avisa de que queda en el historial público de git');
    await boton(pg, 'web', SPE, 'Ocultar').click();
    await pg.click('#lista-web .panel button:text-is("Sí, ocultar")');
    await pg.waitForSelector('#registro-mesa:has-text("Ocultado.")');
    const d = `datos/${SPE}/`;
    assert.deepStrictEqual(api.log, [`PUT borr ${d}jornada_01.json`, `PUT borr ${d}jornada_02.json`, `PUT borr ${d}jornada_03.json`, `PUT borr ${d}actual.json`, 'PUT borr datos/indice.json',
      'PUT web datos/indice.json', `DELETE web ${d}actual.json`, `DELETE web ${d}jornada_03.json`, `DELETE web ${d}jornada_02.json`, `DELETE web ${d}jornada_01.json`]);
    assert.deepStrictEqual(api.violaciones, []);
    assert.deepStrictEqual(api.rutas('web'), ['datos/indice.json']);
    assert.deepStrictEqual(api.json('web', 'datos/indice.json').torneos, []);
    assert.deepStrictEqual(api.json('borr', 'datos/indice.json').torneos.map((t) => t.id), [PAR, SPE]);
    assert(api.rutas('borr').filter((r) => r.startsWith(d)).length === 4);
    for (const x of [...api.puts, ...api.dels]) { assert.deepStrictEqual(x.author, NOREPLY); assert(MSG_OK.test(x.mensaje), x.mensaje); }
    bien('ocultar: copia a borradores (datos y su índice), quita la entrada de la web y solo después borra sus archivos, sin que la web apunte nunca a nada que falte');
    await pg.waitForFunction(() => document.querySelectorAll('#lista-web li.torneo').length === 0 && document.querySelectorAll('#lista-borr li.torneo').length === 2);
    bien('tras ocultar, el torneo pasa de «En la web» a «Borradores»');
    assert.deepStrictEqual(errores, []);
  }

  // eliminar: hay que escribir el id
  {
    const { pg, api } = await escenario({ semilla: semillaDos });
    await abrir(pg);
    await boton(pg, 'web', SPE, 'Eliminar').click();
    await pg.waitForSelector('#lista-web .panel input');
    assert(/historial público de git/.test(await pg.textContent('#lista-web .aviso-accion')));
    const si = pg.locator('#lista-web .panel button:text-is("Eliminar para siempre")');
    assert.strictEqual(await si.isDisabled(), true);
    await pg.fill('#lista-web .panel input', 'sp-ejempl'); assert.strictEqual(await si.isDisabled(), true);
    await pg.fill('#lista-web .panel input', SPE.toUpperCase()); assert.strictEqual(await si.isDisabled(), true);
    assert.strictEqual(api.log.length, 0);
    await pg.fill('#lista-web .panel input', SPE); assert.strictEqual(await si.isDisabled(), false);
    await si.click();
    await pg.waitForSelector('#registro-mesa:has-text("Eliminado.")');
    assert.deepStrictEqual(api.log, ['PUT web datos/indice.json', `DELETE web datos/${SPE}/actual.json`, `DELETE web datos/${SPE}/jornada_03.json`, `DELETE web datos/${SPE}/jornada_02.json`, `DELETE web datos/${SPE}/jornada_01.json`]);
    assert.deepStrictEqual(api.violaciones, []);
    assert.deepStrictEqual(api.rutas('borr').filter((r) => r.includes(SPE)), []);
    bien('eliminar de la web: pide escribir el id, quita la entrada y borra los archivos; no copia nada a borradores');
    // un borrador
    api.log.length = 0;
    await pg.waitForSelector(`#lista-borr li[data-id="${PAR}"]`);
    await boton(pg, 'borr', PAR, 'Eliminar').click();
    await pg.fill('#lista-borr .panel input', PAR);
    await pg.click('#lista-borr .panel button:text-is("Eliminar para siempre")');
    await pg.waitForSelector('#registro-mesa:has-text("Eliminado.")');
    assert.deepStrictEqual(api.log, ['PUT borr datos/indice.json', `DELETE borr datos/${PAR}/actual.json`, `DELETE borr datos/${PAR}/jornada_02.json`, `DELETE borr datos/${PAR}/jornada_01.json`]);
    assert.deepStrictEqual(api.json('borr', 'datos/indice.json').torneos, []);
    assert.deepStrictEqual(api.rutas('web'), ['datos/indice.json']);
    bien('eliminar un borrador: lo borra de campeonatos-borradores y no toca la web');
  }

  // editar
  {
    const { pg, api } = await escenario({ semilla: (a) => { semillaDos(a); sembrar(a, 'web', PAR); } });
    await abrir(pg);
    assert.deepStrictEqual(await nombres(pg, 'web'), [SPE, PAR]);
    await boton(pg, 'web', PAR, 'Editar').click();
    await pg.waitForSelector('#ed-nombre');
    const aviso = await pg.textContent('#lista-web .aviso-accion');
    assert(/sobrescriben el nombre, la temporada y el estado/.test(aviso) && /INICIO/.test(aviso), aviso);
    assert.strictEqual(await pg.inputValue('#ed-orden'), '2');
    bien('editar: avisa de que la siguiente publicación desde el Excel sobrescribe nombre y temporada (y estado) si no se cambian también en INICIO');
    await pg.fill('#ed-nombre', 'ab'); await pg.click('#lista-web .panel button:text-is("Guardar cambios")');
    await pg.waitForSelector('#lista-web .panel .nota.caja');
    assert.strictEqual(api.log.length, 0);
    await pg.fill('#ed-nombre', 'PAREJAS CAMBIADO'); await pg.fill('#ed-temporada', 'verano'); await pg.click('#lista-web .panel button:text-is("Guardar cambios")');
    assert((await pg.textContent('#lista-web .panel .nota.caja')).includes('temporada'));
    assert.strictEqual(api.log.length, 0);
    bien('editar: un nombre o una temporada que no valen no escriben nada');
    await pg.fill('#ed-temporada', '2026-2027'); await pg.fill('#ed-orden', '1');
    await pg.click('#lista-web .panel button:text-is("Guardar cambios")');
    await pg.waitForSelector('#registro-mesa:has-text("Guardado.")');
    assert.deepStrictEqual(api.log, [`PUT web datos/${PAR}/actual.json`, 'PUT web datos/indice.json']);
    const act = api.json('web', `datos/${PAR}/actual.json`);
    assert.strictEqual(act.torneo.nombre, 'PAREJAS CAMBIADO'); assert.strictEqual(act.torneo.temporada, '2026-2027');
    assert.deepStrictEqual(Object.keys(act), Object.keys(leerJson(`${PAR}/actual.json`)));
    const ind = api.json('web', 'datos/indice.json').torneos;
    assert.deepStrictEqual(ind.map((t) => t.id), [PAR, SPE]);
    assert.strictEqual(ind[0].nombre, 'PAREJAS CAMBIADO'); assert.strictEqual(ind[0].temporada, '2026-2027');
    assert(!api.log.some((x) => x.includes('jornada_')));
    bien('editar: cambia nombre y temporada en actual.json (primero) e indice.json, y el orden de la portada; no toca las jornadas');
    await pg.waitForFunction(() => document.querySelector('#lista-web li.torneo').dataset.id === 'parejas-ejemplo-2026-11-14');
    // estado terminado
    api.log.length = 0;
    await boton(pg, 'web', PAR, 'Editar').click(); await pg.waitForSelector('#ed-estado');
    await pg.selectOption('#ed-estado', 'terminado');
    await pg.click('#lista-web .panel button:text-is("Guardar cambios")');
    for (let i = 0; i < 100 && api.log.length < 2; i++) await pg.waitForTimeout(50); // el registro anterior también dice «Guardado.»
    await pg.waitForSelector('#registro-mesa:has-text("Guardado.")');
    assert.strictEqual(api.json('web', `datos/${PAR}/actual.json`).torneo.estado, 'terminado');
    const e2 = api.json('web', 'datos/indice.json').torneos.find((t) => t.id === PAR);
    assert.strictEqual(e2.estado, 'terminado'); assert(e2.ganador && e2.ganador.corto);
    bien('editar el estado a «terminado»: cambia actual.json e indice.json y apunta al ganador');
    // un borrador también se edita, en su repositorio
    api.log.length = 0;
  }
  {
    const { pg, api } = await escenario({ semilla: semillaDos });
    await abrir(pg);
    await boton(pg, 'borr', PAR, 'Editar').click(); await pg.waitForSelector('#ed-nombre');
    await pg.fill('#ed-nombre', 'BORRADOR RENOMBRADO'); await pg.click('#lista-borr .panel button:text-is("Guardar cambios")');
    await pg.waitForSelector('#registro-mesa:has-text("Guardado.")');
    assert.deepStrictEqual(api.log, [`PUT borr datos/${PAR}/actual.json`, 'PUT borr datos/indice.json']);
    assert.strictEqual(api.json('borr', 'datos/indice.json').torneos[0].nombre, 'BORRADOR RENOMBRADO');
    bien('editar un borrador: escribe solo en campeonatos-borradores');
  }

  // fallo a mitad: se cuenta qué quedó hecho y se repite solo lo que falta
  {
    const { pg, api } = await escenario({ semilla: semillaDos });
    await abrir(pg);
    api.fallar = (m, clave, ruta) => (m === 'PUT' && clave === 'web' && ruta === `datos/${PAR}/actual.json` ? 500 : null);
    api.puts.length = 0; api.log.length = 0;
    await boton(pg, 'borr', PAR, 'Publicar').click();
    await pg.click('#lista-borr .panel button:text-is("Sí, publicar en la web")');
    await pg.waitForSelector('#reintento-mesa button:text-is("Reintentar")');
    const reg = await pg.textContent('#registro-mesa');
    assert(/✖/.test(reg) && /Quedó hecho: Copiar jornada_01\.json a la web; Copiar jornada_02\.json a la web/.test(reg) && /Falta: Copiar actual\.json a la web; Actualizar indice\.json \(web\)/.test(reg), reg);
    assert.deepStrictEqual(api.json('web', 'datos/indice.json').torneos.map((t) => t.id), [SPE]);
    assert.deepStrictEqual(api.violaciones, []);
    bien('publicar con fallo a mitad: dice qué quedó hecho y qué falta, y la web no apunta a nada que no exista');
    api.fallar = null; api.log.length = 0;
    await pg.click('#reintento-mesa button:text-is("Reintentar")');
    await pg.waitForSelector('#registro-mesa:has-text("Publicado.")');
    assert.deepStrictEqual(api.log, [`PUT web datos/${PAR}/actual.json`, 'PUT web datos/indice.json']);
    assert(copia(api, 'borr', 'web', PAR)); assert.deepStrictEqual(api.violaciones, []);
    assert.strictEqual(await pg.$$eval('#reintento-mesa button', (x) => x.length), 0);
    bien('Reintentar repite solo los pasos que faltaban y termina bien');
  }
  {
    const { pg, api } = await escenario({ semilla: semillaDos });
    await abrir(pg);
    api.fallar = (m, clave, ruta) => (m === 'DELETE' && clave === 'web' && ruta === `datos/${SPE}/jornada_02.json` ? 500 : null);
    await boton(pg, 'web', SPE, 'Ocultar').click();
    await pg.click('#lista-web .panel button:text-is("Sí, ocultar")');
    await pg.waitForSelector('#reintento-mesa button:text-is("Reintentar")');
    assert.deepStrictEqual(api.violaciones, []);
    assert.deepStrictEqual(api.json('web', 'datos/indice.json').torneos, []);
    assert(api.rutas('borr').filter((r) => r.startsWith(`datos/${SPE}/`)).length === 4);
    bien('ocultar con fallo al borrar: el torneo ya está a salvo en borradores y fuera de la portada pública');
    // tras recargar, lo que quedó suelto en la web aparece como resto y se puede eliminar
    await pg.reload(); await pg.waitForSelector('#restos:not([hidden]) li.resto');
    assert.strictEqual(await pg.getAttribute('#restos li.resto', 'data-id'), SPE);
    bien('tras recargar, las carpetas que quedaron en la web sin entrada en el índice salen como «restos»');
    api.fallar = null;
    await pg.click('#restos li.resto button:text-is("Eliminar")');
    await pg.fill('#restos .panel input', SPE); await pg.click('#restos .panel button:text-is("Eliminar para siempre")');
    await pg.waitForSelector('#registro-mesa:has-text("Eliminado.")');
    assert.deepStrictEqual(api.rutas('web'), ['datos/indice.json']);
    await pg.waitForSelector('#restos', { state: 'hidden' });
    bien('eliminar un resto termina el trabajo');
  }
  {
    const { pg, api } = await escenario({ semilla: semillaDos });
    await abrir(pg);
    await pg.setInputFiles('#archivo', xlsx(SPE));
    await pg.waitForSelector('.tabla-caja');
    api.fallar = (m, clave, ruta) => (m === 'PUT' && ruta === 'datos/indice.json' ? 500 : null);
    api.log.length = 0;
    await pg.click('#publicar');
    await pg.waitForSelector('#reintento button:text-is("Reintentar")');
    const reg = await pg.textContent('#registro');
    assert(/Quedó hecho: Escribir jornada_03\.json; Escribir actual\.json/.test(reg) && /Falta: Escribir indice\.json/.test(reg), reg);
    api.fallar = null; api.log.length = 0;
    await pg.click('#reintento button:text-is("Reintentar")');
    await pg.waitForSelector('#registro:has-text("Publicado.")');
    assert.deepStrictEqual(api.log, ['PUT web datos/indice.json']);
    bien('subir un Excel con fallo en el índice: informa y Reintentar escribe solo el índice');
  }

  /* ============ 6. Seguridad ============ */
  {
    const { pg, api } = await escenario({ semilla: semillaDos });
    await abrir(pg);
    const intenta = (js, ...args) => pg.evaluate(async ([js, args]) => { try { await new Function('M', 'a', 'return ' + js)(window.Mesa, args); return 'PASÓ'; } catch (e) { return e.message; } }, [js, args]);
    const antes = api.reqs.length;
    const malas = ['assets/web.js', '.github/workflows/x.yml', 'README.md', 'datos/_prueba/actual.json', 'datos/../README.md', 'datos/sp-ejemplo/otro.json', 'datos/sp-ejemplo/folleto.pdf', 'datos/sp-ejemplo/jornada_1.json', 'datos/SP/actual.json', 'datos/sp-ejemplo/x/actual.json', 'datos/indice.json/..', '/datos/indice.json', 'datos/sp-ejemplo/actual.json\n', 'datos/-sp/actual.json'];
    for (const clave of ['web', 'borr']) for (const r of malas) {
      for (const [nom, js] of [['escribir', 'M.escribir(a[0], a[1], "{}", null, "x")'], ['borrar', 'M.borrar(a[0], a[1], "s", "x")'], ['leer', 'M.leer(a[0], a[1])']]) {
        const msg = await intenta(js, clave, r);
        assert(/Ruta no permitida/.test(msg), `${nom} ${clave} ${r} → ${msg}`);
      }
    }
    for (const dir of ['assets', 'datos/_prueba', '.github', 'datos/x', 'datos/sp-ejemplo/jornada_01.json/']) assert(/Ruta no permitida/.test(await intenta('M.listar(a[0], a[1])', 'web', dir)), dir);
    assert.strictEqual(api.reqs.length, antes);
    bien('rutas fuera de datos/ (' + malas.length + ' casos, en los dos repositorios): escribir, borrar y leer se rechazan sin llamar a GitHub');
    for (const otro of ['programas-domino', 'otro', '', 'web/../x', '__proto__', 'constructor']) {
      const msg = await intenta('M.escribir(a[0], "datos/indice.json", "{}", null, "x")', otro);
      assert(/Repositorio no permitido/.test(msg), otro + ' → ' + msg);
    }
    assert.strictEqual(api.reqs.length, antes);
    bien('un repositorio que no sea campeonatos-domino o campeonatos-borradores se rechaza sin llamar a GitHub');
    api.puts.length = 0; api.dels.length = 0;
    for (const [clave, r] of [['web', 'datos/indice.json'], ['web', 'datos/sp-ejemplo/actual.json'], ['borr', 'datos/sp-ejemplo/jornada_05.json'], ['borr', 'datos/indice.json']]) {
      assert.strictEqual(/Ruta no permitida|Repositorio no permitido/.test(await intenta('M.escribir(a[0], a[1], "{}", null, "x")', clave, r)), false, r);
    }
    bien('las rutas permitidas pasan el filtro en los dos repositorios');
    api.puts.length = 0; api.log.length = 0;
    for (const x of api.reqs) assert(/^\/repos\/ELIAN1603\/(campeonatos-domino|campeonatos-borradores)(\/|$)/.test(x.ruta) && !x.ruta.includes(TOKEN), x.ruta);
    bien('todas las llamadas con token van a api.github.com y a uno de los dos repositorios, sin el token en la dirección');
  }
  // 401 en mitad de una acción: se borra el token y se avisa
  {
    const { pg, api } = await escenario({ semilla: semillaDos });
    await abrir(pg);
    api.token = 'otro';
    await boton(pg, 'borr', PAR, 'Publicar').click();
    await pg.waitForSelector('#token');
    assert.strictEqual(await pg.evaluate(() => localStorage.getItem('tumesa.token')), null);
    assert(/borrado de este navegador/.test(await pg.textContent('#token-estado')));
    bien('401 al preparar una acción: el token se borra y se pide uno nuevo');
  }

  // GitHub responde 401 (token caducado): se borra del navegador y se avisa
  {
    const { pg, api } = await escenario({ semilla: sembrarWeb });
    await abrir(pg);
    api.token = 'otro';
    await pg.setInputFiles('#archivo', xlsx('sp-ejemplo'));
    await pg.waitForSelector('text=Lo he borrado de este navegador');
    assert.strictEqual(await pg.evaluate(() => localStorage.getItem('tumesa.token')), null);
    await pg.waitForSelector('#token');
    bien('401: el token se borra del navegador, se avisa y se pide uno nuevo');
  }

  assert.deepStrictEqual(externos, []);
  bien('ninguna petición de toda la prueba sale a otro sitio que la propia web o api.github.com');
  for (const c of abiertos) await c.close();
  await b.close();
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`\n${ok} comprobaciones bien`);
})().catch((e) => { console.error('FALLA:', e.message); process.exit(1); });
