// Prueba de la web pública en un navegador: buscador, pestañas, jornadas, ancho de pantalla y refresco.
// Uso: node pruebas/probar_web.cjs [url-base] [carpeta-de-capturas]
const assert = require('assert');
const { chromium } = require('playwright');
const base = process.argv[2] || 'http://localhost:8765';
const capt = process.argv[3];
const D = 'd=datos/_prueba';
(async () => {
  const b = await chromium.launch();
  let ok = 0; const bien = (t) => { ok++; console.log('  ok  ' + t); };
  for (const [w, h] of [[390, 844], [1280, 900]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: w < 500 ? 2 : 1 });
    const pg = await ctx.newPage();
    const errs = []; pg.on('pageerror', (e) => errs.push(e.message)); pg.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
    const sinDesborde = async (n) => assert.strictEqual(await pg.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'desborda: ' + n);
    console.log(`A ${w} px`);

    await pg.goto(`${base}/index.html?${D}`);
    await pg.waitForSelector('.tarjeta');
    assert.strictEqual(await pg.locator('.tarjeta').count(), 4);
    await sinDesborde('portada'); bien('portada: 4 campeonatos sin desbordar');
    // buscador: un jugador en dos torneos
    await pg.fill('#buscar', 'pons');
    await pg.waitForSelector('.persona .puesto:not(:text("…"))');
    await pg.waitForTimeout(300);
    const pons = await pg.locator('.persona', { hasText: 'Vicent Pons' });
    assert.strictEqual(await pons.locator('li').count(), 2);
    const txt = await pons.innerText();
    assert(/Campeones/.test(txt) && /1\.º/.test(txt), txt);
    bien('buscador: Vicent Pons sale en 2 torneos, con su puesto y como campeón del terminado');
    await sinDesborde('buscador');
    if (capt) await pg.screenshot({ path: `${capt}/buscador_${w}.png`, fullPage: true });
    await pg.fill('#buscar', 'beltran');
    await pg.waitForSelector('.persona:has-text("Rosa Beltrán")');
    assert(/Jugó hasta la jornada 2; le sustituyó Hugo Lorente/.test(await pg.locator('.persona').first().innerText()));
    bien('buscador: sin tildes encuentra a Rosa Beltrán y cuenta su sustitución');
    await pg.fill('#buscar', 'zzzz'); await pg.waitForSelector('text=No hay nadie');
    bien('buscador: sin coincidencias lo dice');
    await pg.fill('#buscar', 'orts'); await pg.waitForSelector('.persona:has-text("Gemma Orts")');
    assert.strictEqual(await pg.locator('.persona', { hasText: 'Gemma Orts' }).locator('li').count(), 2);
    bien('buscador: Gemma Orts en parejas y en SP');

    // torneo SP en curso: clasificación = última jornada completa
    await pg.goto(`${base}/torneo.html?t=sp-ejemplo&${D}`);
    await pg.waitForSelector('table.clasi');
    assert((await pg.locator('.nota.caja').innerText()).includes('jornada 2'));
    const filas = await pg.locator('table.clasi tbody tr').allInnerTexts();
    assert(filas[0].includes('Escrivá-Tomás'), filas[0]); // el orden es el de la J2, no el provisional de la J3
    assert.strictEqual(await pg.locator('.jornadas button').count(), 2); // solo jornadas completas
    await sinDesborde('clasificación SP'); bien('clasificación = última jornada completa (J2), con aviso de que la J3 está en juego');
    if (capt) await pg.screenshot({ path: `${capt}/clasi_${w}.png`, fullPage: true });
    // los números caben en 390: la columna TF se ve entera
    const caja = await pg.locator('.tabla-caja').boundingBox(); const ult = await pg.locator('table.clasi th:visible').last().boundingBox();
    assert(ult.x + ult.width <= caja.x + caja.width + 1, 'última columna recortada');
    bien('la tabla de clasificación cabe sin desplazar');
    await pg.click('.jornadas button:has-text("1")');
    await pg.waitForFunction(() => document.querySelector('table.clasi caption').textContent.includes('jornada 1'));
    assert((await pg.locator('table.clasi caption').innerText()).includes('jornada 1'));
    bien('selector de jornada: J1');
    // nombres de entonces: Pons-Dols en J2, Pons-Mas en la J3 publicada
    assert((await pg.locator('table.clasi').innerText()).includes('Pons-Dols'));
    await pg.goto(`${base}/torneo.html?t=sp-ejemplo&ver=emparejamientos&${D}`);
    await pg.waitForSelector('li.mesa');
    assert((await pg.locator('ul.mesas').innerText()).includes('Pons-Mas'));
    await pg.click('.jornadas button:has-text("2")');
    await pg.waitForFunction(() => document.querySelector('ul.mesas').innerText.includes('Pons-Dols'));
    bien('las jornadas pasadas conservan el nombre de entonces (Pons-Dols en J2, Pons-Mas en J3)');
    // filtro de mesas
    await pg.click('.jornadas button:has-text("3")');
    await pg.waitForFunction(() => document.querySelector('ul.mesas').innerText.includes('Pons-Mas'));
    await pg.fill('#filtro', 'lidón');
    assert.strictEqual(await pg.locator('li.mesa:visible').count(), 1);
    await pg.fill('#filtro', '5');
    assert.strictEqual(await pg.locator('li.mesa:visible').count(), 1);
    await pg.fill('#filtro', 'zzz'); assert(await pg.locator('#sin-coincidencias').isVisible());
    await pg.fill('#filtro', '');
    await sinDesborde('emparejamientos'); bien('filtro por nombre y por número, y mensaje si nadie coincide');
    if (capt) await pg.screenshot({ path: `${capt}/emp_${w}.png`, fullPage: true });
    // resultados de la jornada en curso se muestran según llegan
    await pg.click('nav.pestanas a:has-text("Resultados")');
    await pg.waitForSelector('.res b');
    const rs = await pg.locator('.res').allInnerTexts();
    assert(rs.some((t) => t.includes('1-2') && t.includes('640-790')) && rs.some((t) => t.includes('2-0')));
    assert(await pg.locator('text=Por jugar').first().isVisible());
    await sinDesborde('resultados'); bien('resultados de la J3 en curso visibles y la mesa sin resultado como "por jugar"');
    if (capt) await pg.screenshot({ path: `${capt}/res_${w}.png`, fullPage: true });
    await pg.click('nav.pestanas a:has-text("Normativa")');
    await pg.waitForSelector('text=Cómo se ordena la clasificación');
    await sinDesborde('normativa'); bien('normativa');
    if (capt) await pg.screenshot({ path: `${capt}/norm_${w}.png`, fullPage: true });

    // torneo terminado con grupo B, ND, incomparecencia
    await pg.goto(`${base}/torneo.html?t=sp-ejemplo-anterior&${D}`);
    await pg.waitForSelector('table.clasi');
    assert.strictEqual(await pg.locator('.grupos button').count(), 2);
    await pg.click('.grupos button:has-text("Grupo B")');
    await pg.waitForFunction(() => document.querySelector('table.clasi caption').textContent.includes('grupo B'));
    assert.strictEqual(await pg.locator('table.clasi tbody tr').count(), 4);
    await sinDesborde('grupo B'); bien('grupo A y B con su selector');
    if (capt) await pg.screenshot({ path: `${capt}/clasiB_${w}.png`, fullPage: true });
    await pg.goto(`${base}/torneo.html?t=sp-ejemplo-anterior&ver=resultados&j=5&${D}`);
    await pg.waitForSelector('.res');
    assert((await pg.locator('ul.mesas').first().innerText()).length > 0);
    assert((await pg.locator('body').innerText()).includes('no disputado'));
    await sinDesborde('ND'); bien('encuentro No disputado visible');
    // retirada y descanso del parejas
    await pg.goto(`${base}/torneo.html?t=parejas-ejemplo-2026-11-14&ver=emparejamientos&${D}`);
    await pg.waitForSelector('li.mesa'); assert((await pg.locator('body').innerText()).toLowerCase().includes('descansa'));
    bien('descanso en parejas');
    // individual: dos y dos
    await pg.goto(`${base}/torneo.html?t=individual-ejemplo-2026-11-14&ver=emparejamientos&${D}`);
    await pg.waitForSelector('li.mesa'); assert.strictEqual(await pg.locator('li.mesa').first().locator('.lado .n').count(), 4);
    await sinDesborde('individual'); bien('individual: 2 jugadores contra 2');
    // enlace del buscador resalta la fila
    await pg.goto(`${base}/torneo.html?t=sp-ejemplo&ver=emparejamientos&p=3&${D}`);
    await pg.waitForSelector('li.mesa.resalte'); bien('?p= resalta la mesa del jugador');
    assert.deepStrictEqual(errs, []); errs.length = 0;
    // inexistente (el 404 es lo esperado)
    await pg.goto(`${base}/torneo.html?t=no-existe&${D}`);
    await pg.waitForSelector('text=No se ha encontrado este campeonato'); bien('campeonato inexistente: mensaje llano'); errs.length = 0;
    // sin ?d= : datos reales (vacíos)
    await pg.goto(`${base}/index.html`);
    await pg.waitForSelector('text=Todavía no hay campeonatos publicados');
    assert.strictEqual(await pg.locator('.banda-prueba').count(), 0);
    bien('portada real (main): lista vacía y sin banda de prueba');
    assert.deepStrictEqual(errs, []);
    await ctx.close();
  }
  await b.close();
  console.log(`\n${ok} comprobaciones bien`);
})().catch((e) => { console.error('FALLA:', e.message.split('\n').slice(0, 8).join('\n')); process.exit(1); });
