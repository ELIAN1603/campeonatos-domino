// Prueba de la web pública en un navegador: buscador, pestañas, jornadas, ancho de pantalla y refresco.
// Uso: node pruebas/probar_web.cjs [url-base] [carpeta-de-capturas]
const assert = require('assert');
const fs = require('fs');
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
    assert.strictEqual(await pg.locator('.fecha-ficha').count(), 0);
    assert(!/\b(oct|nov|ene|feb)\b/i.test(await pg.locator('#lista').innerText()), 'queda la marca de fecha');
    bien('portada: sin la fecha de inicio en las tarjetas');
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

    // torneo SP en curso (Plan 2.10.2): la clasificación de la J3 en vivo, con ⏳ en quien aún no ha jugado
    await pg.goto(`${base}/torneo.html?t=sp-ejemplo&${D}`);
    await pg.waitForSelector('table.clasi');
    assert((await pg.locator('table.clasi caption').innerText()).includes('jornada 3'));
    const nota = await pg.locator('.nota.caja').innerText();
    assert(nota.includes('en juego') && nota.includes('la clasificación se actualiza con cada resultado'), nota);
    assert(!/en este grupo/.test(nota), nota);
    assert.strictEqual(await pg.locator('.plazo').innerText(), 'Jornada 3 · se juega del 10/11 al 23/11');
    assert(!/Cómo se ordena|criterio|desempate/i.test(await pg.locator('main').innerText()));
    assert.deepStrictEqual(await pg.locator('nav.pestanas a').allInnerTexts(), ['Clasificación', 'Mesas', 'Parejas', 'Calendario']);
    bien('clasificación: nota sin recuento, fechas de juego, sin criterios y cuatro pestañas en orden');
    const pendJ3 = JSON.parse(fs.readFileSync('datos/_prueba/sp-ejemplo/actual.json', 'utf8')).clasificacion.filter((r) => r.grupo === 'A' && r.pendiente).length;
    assert.strictEqual(await pg.locator('table.clasi .etq.pend').count(), pendJ3); // ⏳ = pendiente del JSON
    assert.strictEqual(await pg.locator('.jornadas button').count(), 3); // las completas y la que está en juego
    await sinDesborde('clasificación SP'); bien(`clasificación en vivo de la J3 con ⏳ en las ${pendJ3} parejas sin resultado`);
    await pg.click('.jornadas button:has-text("2")');
    await pg.waitForFunction(() => document.querySelector('table.clasi caption').textContent.includes('jornada 2'));
    const filas = await pg.locator('table.clasi tbody tr').allInnerTexts();
    assert(filas[0].includes('Escrivá-Tomás'), filas[0]);
    assert.strictEqual(await pg.locator('table.clasi .etq.pend').count(), 0);
    bien('la J2 (cerrada) se sigue viendo, sin ⏳');
    await pg.click('.jornadas button:has-text("3")');
    await pg.waitForFunction(() => document.querySelector('table.clasi caption').textContent.includes('jornada 3'));
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
    await pg.goto(`${base}/torneo.html?t=sp-ejemplo&ver=mesas&${D}`);
    await pg.waitForSelector('li.mesa');
    assert((await pg.locator('ul.mesas').innerText()).includes('Pons-Mas'));
    assert.strictEqual(await pg.locator('.plazo').innerText(), 'Jornada 3 · se juega del 10/11 al 23/11');
    await pg.click('.jornadas button:has-text("1")');
    await pg.waitForFunction(() => document.querySelector('.plazo').textContent.startsWith('Jornada 1'));
    assert.strictEqual(await pg.locator('.plazo').innerText(), 'Jornada 1 · se juega del 13/10 al 26/10');
    await pg.click('.jornadas button:has-text("3")');
    await pg.waitForSelector('.plazo');
    bien('mesas: fechas de juego de la jornada elegida');
    await pg.goto(`${base}/torneo.html?t=sp-ejemplo&ver=mesas&${D}`);
    await pg.waitForSelector('li.mesa');
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
    // Mesas = emparejamientos + resultados: una tarjeta por mesa, jornada en curso por defecto
    assert.strictEqual(await pg.locator('.jornadas button').count(), 3);
    assert.strictEqual(await pg.locator('.jornadas button[aria-pressed=true]').innerText(), '3');
    assert.strictEqual(await pg.locator('.jornadas button.curso').innerText(), '3');
    assert.strictEqual(await pg.locator('.jornadas button').first().evaluate((x) => getComputedStyle(x).borderRadius), '50%');
    const rs = await pg.locator('.res').allInnerTexts();
    assert(rs.some((t) => t.includes('1-2') && t.includes('640-790 tantos')) && rs.some((t) => t.trim().toUpperCase() === 'RETIRADA'), rs.join('|'));
    assert(!rs.some((t) => t.includes('2-0') && /retirada/i.test(t)), 'la retirada lleva etiqueta, no cifras');
    assert(rs.some((t) => t.includes('⏳')), 'falta ⏳ en la mesa sin resultado');
    const gana = await pg.locator('li.mesa', { hasText: '640-790' }).locator('.lado.gana');
    assert.strictEqual(await gana.count(), 1); // el ganador no depende solo del color: ✓, negrita y barra
    assert((await gana.innerText()).includes('✓'));
    assert.strictEqual(await gana.locator('.nom').evaluate((x) => getComputedStyle(x).fontWeight), '800');
    assert.strictEqual(await pg.locator('li.mesa:has(.res b)').first().locator('.n').count(), 2);
    assert(!/Por jugar/.test(await pg.locator('#contenido h2').allInnerTexts().then((x) => x.join())), 'ya no hay bloque aparte de por jugar');
    await sinDesborde('mesas con resultados'); bien('mesas: tarjetas con partidas y tantos, ⏳ si falta, ganador con ✓ y negrita, jornada en curso marcada');
    if (capt) await pg.screenshot({ path: `${capt}/mesas_${w}.png`, fullPage: true });
    // la J2 ya cerrada enseña sus resultados
    await pg.click('.jornadas button:has-text("2")');
    await pg.waitForFunction(() => document.querySelector('ul.mesas').innerText.includes('Pons-Dols'));
    assert.strictEqual(await pg.locator('li.mesa .res:has-text("⏳")').count(), 0);
    bien('mesas: la J2 cerrada, con sus resultados y sin ⏳');
    for (const viejo of ['resultados', 'emparejamientos']) {
      await pg.goto(`${base}/torneo.html?t=sp-ejemplo&ver=${viejo}&${D}`);
      await pg.waitForSelector('li.mesa');
      assert.strictEqual(await pg.locator('nav.pestanas a[aria-current=page]').innerText(), 'Mesas');
    }
    bien('los enlaces antiguos ver=resultados y ver=emparejamientos abren Mesas');
    // parejas: nº, nombres, zona; nunca teléfonos
    await pg.click('nav.pestanas a:has-text("Parejas")');
    await pg.waitForSelector('table.lista-parejas');
    const ap = JSON.parse(fs.readFileSync('datos/_prueba/sp-ejemplo/actual.json', 'utf8')).participantes;
    assert.strictEqual(await pg.locator('table.lista-parejas tbody tr').count(), ap.length);
    const f1 = await pg.locator('table.lista-parejas tbody tr').first().innerText();
    assert(f1.includes(`${ap[0].j1_nombre} ${ap[0].j1_apellido1}`) && f1.includes(`${ap[0].j2_nombre} ${ap[0].j2_apellido1}`) && f1.includes(ap[0].zona), f1);
    assert(!/\d{9}|tel[eé]f|licencia/i.test(await pg.locator('main').innerText()));
    await sinDesborde('parejas'); bien(`parejas: ${ap.length} filas con nº, los dos jugadores y zona; sin teléfonos`);
    if (capt) await pg.screenshot({ path: `${capt}/parejas_${w}.png`, fullPage: true });
    // folleto: calendario completo con la jornada en curso resaltada y PDF
    await pg.goto(`${base}/torneo.html?t=sp-calendario&ver=folleto&${D}`); // actual.json de ejemplo con la clave "calendario" y su PDF
    await pg.waitForSelector('.calendario li');
    assert.strictEqual(await pg.locator('.calendario li').count(), 14);
    assert.strictEqual(await pg.locator('.calendario li.curso').count(), 1);
    assert((await pg.locator('.calendario li.curso').innerText()).replace(/\s+/g, ' ').includes('3 '), 'la jornada 3 debe estar resaltada');
    assert.deepStrictEqual(await pg.locator('.calendario .b').allInnerTexts(), ['B1', 'B2', 'B3']);
    assert((await pg.locator('.calendario li').nth(2).innerText()).includes('10/11 – 23/11'));
    assert.strictEqual(await pg.locator('a[download], iframe').count(), 0, 'sin PDF de normativa');
    await sinDesborde('calendario'); bien('calendario: 14 jornadas, B1-B3, J3 resaltada, sin PDF');
    if (capt) await pg.screenshot({ path: `${capt}/folleto_${w}.png`, fullPage: true });
    // sin "calendario" en el JSON
    await pg.goto(`${base}/torneo.html?t=sp-ejemplo&ver=folleto&${D}`);
    await pg.waitForSelector('text=no tiene calendario publicado'); assert.strictEqual(await pg.locator('.calendario').count(), 0);
    await pg.goto(`${base}/torneo.html?t=sp-ejemplo-anterior&ver=normativa&${D}`);
    await pg.waitForSelector('text=no tiene calendario publicado'); bien('sin clave calendario se explica; ver=normativa abre Calendario');
    assert(!(await pg.request.head(`${base}/datos/sp-2026-27/folleto.pdf`)).ok(), 'el folleto del 24º ya no se publica');

    // torneo terminado con grupo B, ND, incomparecencia
    await pg.goto(`${base}/torneo.html?t=sp-ejemplo-anterior&${D}`);
    await pg.waitForSelector('table.clasi');
    assert.strictEqual(await pg.locator('.grupos button').count(), 2);
    await pg.click('.grupos button:has-text("Grupo B")');
    await pg.waitForFunction(() => document.querySelector('table.clasi caption').textContent.includes('grupo B'));
    assert.strictEqual(await pg.locator('table.clasi tbody tr').count(), 4);
    await sinDesborde('grupo B'); bien('grupo A y B con su selector');
    if (capt) await pg.screenshot({ path: `${capt}/clasiB_${w}.png`, fullPage: true });
    await pg.goto(`${base}/torneo.html?t=sp-ejemplo-anterior&ver=mesas&j=5&${D}`);
    await pg.waitForSelector('.res');
    assert.strictEqual(await pg.locator('.etiq-estado.nd').first().innerText(), 'ND');
    assert.strictEqual(await pg.locator('li.mesa:has(.etiq-estado.nd) .res b').count(), 0);
    await sinDesborde('ND'); bien('encuentro No disputado: etiqueta ND en lugar del resultado');
    for (const [est, txt] of [['incomparecencia', 'Incomparecencia'], ['descanso', 'Descansa']]) {
      const n = await pg.locator('.etiq-estado.' + est).count();
      if (n) assert.strictEqual((await pg.locator('.etiq-estado.' + est).first().innerText()).toLowerCase(), txt.toLowerCase());
    }
    // retirada y descanso del parejas
    await pg.goto(`${base}/torneo.html?t=parejas-ejemplo-2026-11-14&ver=mesas&${D}`);
    await pg.waitForSelector('li.mesa'); assert((await pg.locator('body').innerText()).toLowerCase().includes('descansa'));
    assert.strictEqual(await pg.locator('.plazo').count(), 0);
    bien('descanso en parejas, sin fechas de juego (su JSON no las trae)');
    // individual: dos y dos
    await pg.goto(`${base}/torneo.html?t=individual-ejemplo-2026-11-14&ver=mesas&${D}`);
    await pg.waitForSelector('li.mesa'); assert.strictEqual(await pg.locator('li.mesa').first().locator('.lado .n').count(), 4);
    assert.strictEqual(await pg.locator('nav.pestanas a').nth(2).innerText(), 'Jugadores');
    await sinDesborde('individual'); bien('individual: 2 jugadores contra 2');
    // el 24º real: solo la J3 publicada → un solo botón, y se abre
    await pg.goto(`${base}/torneo.html?t=sp-2026-27`);
    await pg.waitForSelector('table.clasi');
    assert.strictEqual(await pg.locator('.jornadas button').count(), 1);
    await pg.click('nav.pestanas a:has-text("Mesas")');
    await pg.waitForSelector('li.mesa');
    assert.strictEqual(await pg.locator('.jornadas button').count(), 1);
    assert.strictEqual(await pg.locator('.jornadas button[aria-pressed=true]').innerText(), '3');
    assert((await pg.locator('li.mesa').count()) >= 20);
    await sinDesborde('24º mesas'); bien('24º real: un botón (J3), mesas con tarjeta, sin desbordar');
    if (capt) await pg.screenshot({ path: `${capt}/real_${w}.png`, fullPage: true });
    // enlace del buscador resalta la fila
    await pg.goto(`${base}/torneo.html?t=sp-ejemplo&ver=mesas&p=3&${D}`);
    await pg.waitForSelector('li.mesa.resalte'); bien('?p= resalta la mesa del jugador');
    assert.deepStrictEqual(errs, []); errs.length = 0;
    // inexistente (el 404 es lo esperado)
    await pg.goto(`${base}/torneo.html?t=no-existe&${D}`);
    await pg.waitForSelector('text=No se ha encontrado este campeonato'); bien('campeonato inexistente: mensaje llano'); errs.length = 0;
    // sin ?d= : datos reales
    await pg.goto(`${base}/index.html`);
    await pg.waitForSelector('.tarjeta');
    assert.strictEqual(await pg.locator('.banda-prueba').count(), 0);
    assert.strictEqual(await pg.locator('.fecha-ficha').count(), 0);
    bien('portada real: sin banda de prueba y sin fecha de inicio');
    assert.deepStrictEqual(errs, []);
    await ctx.close();
  }
  await b.close();
  console.log(`\n${ok} comprobaciones bien`);
})().catch((e) => { console.error('FALLA:', e.message.split('\n').slice(0, 8).join('\n')); process.exit(1); });
