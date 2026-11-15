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
    assert.deepStrictEqual(await pg.locator('nav.pestanas a').allInnerTexts(), ['Clasificación', 'Mesas', 'Parejas', 'Calendario', 'Línea de tiempo']);
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
    // Calendario (lista) y Línea de tiempo, dos pestañas provisionales
    await pg.clock.setFixedTime(new Date('2026-11-15T10:00:00')); // «hoy» fijo: la J3 en curso
    await pg.goto(`${base}/torneo.html?t=sp-calendario&ver=folleto&${D}`); // actual.json de ejemplo con la clave "calendario"
    await pg.waitForSelector('.calendario li');
    assert.strictEqual(await pg.locator('.linea-tiempo').count(), 0);
    assert.strictEqual(await pg.locator('.calendario li').count(), 14);
    assert.strictEqual(await pg.locator('.calendario li.curso').count(), 1);
    assert((await pg.locator('.calendario li.curso').innerText()).replace(/\s+/g, ' ').includes('3 '), 'la jornada 3 debe estar resaltada');
    assert.deepStrictEqual(await pg.locator('.calendario .b').allInnerTexts(), ['B1', 'B2', 'B3']);
    assert((await pg.locator('.calendario li').nth(0).innerText()).includes('13/10 – 26/10/2026'));
    assert((await pg.locator('.calendario li').nth(2).innerText()).includes('10/11 – 23/11/2026'));
    assert.strictEqual(await pg.locator('a[download], iframe').count(), 0, 'sin PDF de normativa');
    await sinDesborde('calendario lista'); bien('lista: 14 jornadas con el año, B1-B3, J3 resaltada');
    if (capt) await pg.screenshot({ path: `${capt}/cal_lista_${w}.png`, fullPage: true });
    // pestaña Línea de tiempo: selector provisional «Opción 1…5» (&op=), por defecto la 1
    await pg.click('nav.pestanas a:has-text("Línea de tiempo")');
    await pg.waitForSelector('.linea-tiempo');
    assert(/[?&]ver=linea\b/.test(pg.url()), pg.url());
    await pg.goto(`${base}/torneo.html?t=sp-calendario&ver=folleto&cal=linea&${D}`); await pg.waitForSelector('.linea-tiempo');
    assert.strictEqual(await pg.locator('nav.pestanas a[aria-current=page]').innerText(), 'Línea de tiempo');
    assert.deepStrictEqual(await pg.locator('.opciones button').allInnerTexts(), ['1', '2', '3', '4', '5']);
    assert.strictEqual(await pg.locator('.opciones button[aria-pressed=true]').innerText(), '1');
    assert.strictEqual(await pg.locator('.linea-tiempo.op1').count(), 1);
    for (const raro of ['9', '0', 'x']) { await pg.goto(`${base}/torneo.html?t=sp-calendario&ver=linea&op=${raro}&${D}`); await pg.waitForSelector('.linea-tiempo.op1'); }
    await pg.click('.opciones button:has-text("3")');
    await pg.waitForSelector('.linea-tiempo.op3');
    assert(/[?&]op=3\b/.test(pg.url()) && /[?&]ver=linea\b/.test(pg.url()), pg.url());
    await pg.reload(); await pg.waitForSelector('.linea-tiempo.op3');
    assert.strictEqual(await pg.locator('.opciones button[aria-pressed=true]').innerText(), '3');
    bien('línea de tiempo: selector «Opción 1…5», op= en la URL (por defecto 1, valores raros → 1), sobrevive a recargar; cal=linea antiguo lleva a la pestaña');

    const NOMBRES = ['La mano', 'El plazo', 'La esfera', 'El acta', 'La regla'];
    const LISTA = { 1: '.linea-tiempo > .solo-lector li', 2: '.linea-tiempo > .solo-lector li', 3: '.leyenda li', 4: 'table.acta.a tr[data-jornada]', 5: '.linea-tiempo > .solo-lector li' };
    // Recorre las cinco opciones de un campeonato: cada una pinta 14 jornadas, dice cuál está en curso y qué día es hoy, y no desborda.
    async function recorrer(nombre, ruta, esp) {
      for (let op = 1; op <= 5; op++) {
        await pg.goto(`${base}/${ruta}${ruta.includes('?') ? '&' : '?'}op=${op}`);
        await pg.waitForSelector(`.linea-tiempo.op${op}`);
        const n = (s) => pg.locator(s).count(), txt = (s) => pg.locator(s).innerText();
        const dónde = `${nombre} op ${op}`;
        assert.strictEqual(await txt('.nombre-op'), NOMBRES[op - 1], dónde);
        // 14 jornadas pintadas
        const pintadas = { 1: '.mano .t', 2: '.tira:not(.b) .sg', 3: '.esfera path.g', 4: 'table.acta.a tr[data-jornada]', 5: '.r-a .bl' }[op];
        const extraB = op === 1 || op === 3 ? esp.nB : 0;
        assert.strictEqual(await n(pintadas), 14 + extraB, `${dónde}: jornadas pintadas`);
        // texto equivalente: 14 jornadas, la jornada en curso y hoy
        assert.strictEqual(await n(LISTA[op]), 14, `${dónde}: 14 jornadas en texto`);
        const lec = (await pg.locator('.linea-tiempo > .solo-lector').textContent()).replace(/\s+/g, ' ');
        assert(lec.includes('Jornada en curso: la 3.') && lec.includes('Hoy es domingo 15 de noviembre de 2026.'), `${dónde}: ${lec}`);
        const act = { 1: '.linea-tiempo > .solo-lector li[aria-current=step]', 2: '.linea-tiempo > .solo-lector li[aria-current=step]', 3: '.leyenda li[aria-current=step]', 4: 'table.acta.a tr[aria-current=step]', 5: '.linea-tiempo > .solo-lector li[aria-current=step]' }[op];
        assert.strictEqual(await n(act), 1, `${dónde}: jornada en curso marcada`);
        if (op !== 4) assert((await pg.locator(op === 3 ? '.leyenda li[aria-current=step]' : act).textContent()).replace(/\s+/g, ' ').includes('10/11/2026') || (await pg.locator(act).textContent()).includes('10 al 23 de noviembre de 2026'), dónde);
        // estados: 2 jugadas, 1 en curso, el resto por jugar
        assert.strictEqual(await n(`${pintadas}.jugada`), 2, `${dónde}: 2 jugadas`);
        assert.strictEqual(await n(`${pintadas}.curso`), 1, `${dónde}: 1 en curso`);
        assert.strictEqual(await n(`${pintadas}.falta`), 11 + extraB, `${dónde}: el resto por jugar`);
        // grupo B
        const prev = esp.g === 'previsto', conB = esp.nB > 0;
        const todo = (await pg.locator('.linea-tiempo').innerText()).replace(/\s+/g, ' ');
        if (prev) assert(/previsto/i.test(todo), `${dónde}: falta la palabra «previsto»`); else assert(!/previsto/i.test(todo), `${dónde}: «previsto» donde el B es firme o no hay`);
        assert.strictEqual(await n({ 1: '.mano .prev', 2: '.tira.b.prev', 3: '.esfera .g.prev', 4: 'table.acta.b.prev', 5: '.r-b.prev' }[op]), prev ? { 1: esp.nB + 1, 2: 1, 3: esp.nB, 4: 1, 5: 1 }[op] : 0, `${dónde}: trazo discontinuo del B previsto`);
        const nb = { 1: '.mano .t .pin:text-matches("^B")', 2: '.tira.b .sg', 3: '.esfera .nv:text-matches("^B")', 4: 'table.acta.b tr[data-jornada]', 5: '.r-b .bl' }[op];
        assert.strictEqual(await n(nb), esp.nB, `${dónde}: fichas B`);
        if (op === 1) assert.strictEqual(await n('.mano .doble'), conB ? 1 : 0, 'doble atravesado solo con B');
        assert((await pg.locator('.linea-tiempo > .solo-lector').textContent()).includes(conB ? (prev ? 'Grupo B (previsto)' : 'Grupo B:') : 'No hay grupo B'), dónde);
        // hitos
        const hitosTxt = (await pg.locator(op === 4 ? 'table.acta' : '.hitos-l').allInnerTexts()).join(' ').replace(/\s+/g, ' ').toLowerCase();
        for (const h of ['inicio del campeonato', 'cambio de año', 'final del campeonato'].concat(conB ? ['corte del grupo b', 'inicio del grupo b'] : [])) assert(hitosTxt.includes(h), `${dónde}: falta el hito «${h}»`);
        if (!conB) assert(!hitosTxt.includes('corte del grupo b'), dónde);
        // sin desbordes: la página, y nada fuera de la pantalla salvo dentro de sus cajas con desplazamiento
        await sinDesborde(dónde);
        const fuera = await pg.evaluate(() => [...document.querySelectorAll('.linea-tiempo *')].filter((x) => !x.closest('.regla-caja, .mano-caja, .solo-lector') && (x.getBoundingClientRect().right > innerWidth + 1 || x.getBoundingClientRect().left < -1)).length);
        assert.strictEqual(fuera, 0, `${dónde}: elementos fuera de la pantalla`);
        const cajaMano = await pg.evaluate(() => { const c = document.querySelector('.mano-caja'); return c ? c.scrollWidth <= c.clientWidth + 1 : true; });
        assert(cajaMano, `${dónde}: la mano no cabe en su caja`);
      }
    }
    const previstoRuta = async () => pg.route('**/datos/sp-2026-27/actual.json*', async (r) => { const j = await (await r.fetch()).json(); j.torneo.jornada_b = 11; r.fulfill({ json: j }); });
    await recorrer('B firme (hay_b=1, jornada_b=12)', `torneo.html?t=sp-calendario&ver=linea&${D}`, { nB: 3, g: 'firme' });
    await recorrer('24º real, tal como está publicado (jornada_b vacío)', 'torneo.html?t=sp-2026-27&ver=linea', { nB: 0, g: null });
    await previstoRuta();
    await recorrer('24º con B previsto (jornada_b=11)', 'torneo.html?t=sp-2026-27&ver=linea', { nB: 4, g: 'previsto' });
    await pg.unroute('**/datos/sp-2026-27/actual.json*');
    bien('las 5 opciones, con B firme, sin B (24º tal cual) y con B previsto (24º con jornada_b=11): 14 jornadas pintadas, texto equivalente con la jornada en curso y hoy, hitos, trazo discontinuo + «previsto», sin desbordes');

    // forma propia de cada opción (con el 24º real y B previsto)
    await previstoRuta();
    const U = (op) => `${base}/torneo.html?t=sp-2026-27&ver=linea&op=${op}`;
    // 1 · la mano: ficha vertical en el cambio de año, zigzag en móvil, doble que cubre dos filas
    await pg.goto(U(1)); await pg.waitForSelector('.mano .t');
    const T = await pg.locator('.mano .t').evaluateAll((l) => l.map((x) => { const r = x.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; }));
    const dob = await pg.locator('.mano .doble').evaluate((x) => { const r = x.getBoundingClientRect(); return { w: r.width, h: r.height }; });
    assert.strictEqual(await pg.locator('.mano .t').first().locator('.m b').first().innerText(), '13');
    assert((await pg.locator('.mano .t').nth(4).innerText()).replace(/\s+/g, ' ').includes('2026') && (await pg.locator('.mano .t').nth(4).innerText()).includes('2027'), 'la J5 lleva los dos años en la esquina');
    assert.strictEqual(await pg.locator('.mano .t').nth(2).locator('.hoy').count(), 1, '«hoy» en la J3');
    if (w >= 720) {
      assert(T[4].h > T[3].h * 1.8 && T[4].w < T[3].w * 0.7, 'J5 vertical: dobla la esquina');
      assert(T[5].y > T[0].y + T[0].h / 2 && T[5].x < T[4].x, 'la fila baja y vuelve');
      assert(dob.h > T[0].h * 1.8 && dob.w < T[0].w * 0.7, 'doble atravesado');
      const yA = T[10].y, yB = await pg.locator('.mano .t:has(.pin:text("B1"))').evaluate((x) => x.getBoundingClientRect().y);
      assert(yB > yA + T[10].h * 0.9 && Math.abs((await pg.locator('.mano .t:has(.pin:text("B1"))').evaluate((x) => x.getBoundingClientRect().x)) - T[10].x) < 2, 'B1 debajo de la J11');
    } else {
      assert(T[0].x < T[1].x - 20 && Math.abs(T[1].x - T[2].x) < 2 && Math.abs(T[3].x - T[0].x) < 2, 'zigzag en móvil');
      assert(T[1].y > T[0].y && T[3].y > T[2].y && T[9].y > T[8].y, 'baja');
      assert(dob.w > dob.h, 'doble tumbado en móvil');
    }
    bien(`la mano (${w < 720 ? 'zigzag' : 'filas con esquina'}): J5 con los dos años, «hoy» en la J3, doble atravesado y B bajo A`);
    // 2 · el plazo: frase grande según el día, tira proporcional
    const frase = async (iso) => { await pg.clock.setFixedTime(new Date(iso)); await pg.goto(U(2)); await pg.waitForSelector('.grande'); return (await pg.locator('.grande').innerText()).replace(/\s+/g, ' '); };
    assert.strictEqual(await frase('2026-11-15T10:00:00'), 'Jornada 3 · te quedan 8 días · hasta el lunes 23 de noviembre');
    assert.strictEqual(await frase('2026-11-22T10:00:00'), 'Jornada 3 · te queda 1 día · hasta el lunes 23 de noviembre');
    assert.strictEqual(await frase('2026-11-23T10:00:00'), 'Jornada 3 · termina hoy');
    assert.strictEqual(await frase('2026-11-04T10:00:00'), 'Jornada 3 · empieza el martes 10 de noviembre');
    await pg.clock.setFixedTime(new Date('2026-11-15T10:00:00')); await pg.goto(U(2)); await pg.waitForSelector('.tira');
    const sg = await pg.locator('.tira:not(.b) .sg').evaluateAll((l) => l.map((x) => x.getBoundingClientRect().width + 2));
    assert(Math.abs(sg[4] / sg[5] - 21 / 14) < 0.12 && Math.abs(sg[0] / sg[5] - 1) < 0.12, `tira proporcional ${sg[4] / sg[5]}`);
    assert.strictEqual(await pg.locator('.tira .corte').count(), 1); assert.strictEqual(await pg.locator('.tira .aguja').count(), 1);
    assert.deepStrictEqual(await pg.locator('.rotulos .an').allInnerTexts(), ['2026', '2027']);
    const tb = await pg.locator('.tira.b').boundingBox(), ta = await pg.locator('.tira:not(.b)').boundingBox();
    assert(tb.height < ta.height * 0.7, 'la tira B es más estrecha');
    bien('el plazo: frase (te quedan 8 días / 1 día / termina hoy / empieza el…), tira proporcional a los días con corte de año y «hoy», tira B más estrecha');
    // 3 · la esfera
    await pg.goto(U(3)); await pg.waitForSelector('svg.esfera');
    assert.strictEqual(await pg.locator('svg.esfera .aguja').count(), 1);
    assert.strictEqual(await pg.locator('svg.esfera .cambio').count(), 1);
    assert.deepStrictEqual(await pg.locator('svg.esfera .an').evaluateAll((l) => l.map((x) => x.textContent)), ['2026', '2027', '13/10', '24/5']);
    assert.strictEqual(await pg.locator('svg.esfera').getAttribute('aria-hidden'), 'true');
    assert((await pg.locator('.leyenda').innerText()).includes('15/12/2026 – 4/1/2027'), 'leyenda con las fechas');
    bien('la esfera: SVG con aguja de hoy, muesca con 2026/2027, anillo B interior, inicio y final, leyenda en texto');
    // 4 · el acta
    await pg.goto(U(4)); await pg.waitForSelector('table.acta');
    assert.strictEqual(await pg.locator('table.acta').count(), 2);
    assert.strictEqual(await pg.locator('table.acta.a .casilla:text("X")').count(), 2, 'cerrada en las 2 jugadas');
    assert.strictEqual(await pg.locator('table.acta.a tr[data-jornada] .casilla').count(), 14);
    assert((await pg.locator('table.acta.a th.tit').textContent()).includes('24º Campeonato SUPER-PRESTIGIO') && (await pg.locator('table.acta.a th.sub').textContent()).toLowerCase().includes('temporada 2026-2027'));
    assert.strictEqual(await pg.locator('table.acta.a').evaluate((x) => getComputedStyle(x.querySelector('td')).borderTopWidth), '1px');
    bien('el acta: cabecera con campeonato y temporada, tabla con bordes, casilla «cerrada» marcada en las 2 jugadas, B en una segunda acta');
    // 5 · la regla
    await pg.goto(U(5)); await pg.waitForSelector('.regla-caja');
    assert.strictEqual(await pg.locator('.regla-caja').getAttribute('role'), 'region');
    const rw = await pg.locator('.r-a .bl').evaluateAll((l) => l.map((x) => x.getBoundingClientRect().width + 2));
    assert(Math.abs(rw[4] / rw[5] - 21 / 14) < 0.12, 'ancho proporcional a los días');
    assert.strictEqual(await pg.locator('.regla .corte').count(), 1);
    assert.strictEqual(await pg.locator('.regla .aguja').count(), 1);
    const cs = await pg.locator('.regla-caja').evaluate((c) => ({ sw: c.scrollWidth, cw: c.clientWidth, sl: c.scrollLeft }));
    if (w < 720) { assert(cs.sw > cs.cw + 100, 'en móvil la regla se desplaza dentro de su caja'); assert(cs.sl > 0, 'abre cerca de hoy'); } else assert(cs.sw <= cs.cw + 1, 'en escritorio cabe entera');
    bien(`la regla: ancho proporcional a los días, año partido por una línea, «hoy», carril B; ${w < 720 ? 'se desplaza en horizontal dentro de su caja' : 'cabe entera'}`);
    await pg.unroute('**/datos/sp-2026-27/actual.json*');
    // la lista no se toca: el 24º real, con el año en la jornada que cruza
    await pg.goto(`${base}/torneo.html?t=sp-2026-27&ver=folleto`); await pg.waitForSelector('.calendario li');
    assert.strictEqual(await pg.locator('.calendario li').count(), 14);
    assert((await pg.locator('.calendario li').nth(4).innerText()).includes('15/12/2026 – 4/1/2027'), 'jornada que cruza de año');
    assert((await pg.locator('.calendario li').nth(0).innerText()).includes('13/10 – 26/10/2026'));
    await sinDesborde('24º calendario (lista)'); bien('Calendario (lista) intacto con el 24º real: «15/12/2026 – 4/1/2027» en la J5');
    for (const op of [1, 2, 3, 4, 5]) if (capt) { await pg.goto(`${base}/torneo.html?t=sp-2026-27&ver=linea&op=${op}`); await pg.waitForSelector(`.linea-tiempo.op${op}`); await pg.screenshot({ path: `${capt}/linea_op${op}_${w}.png`, fullPage: true }); }
    assert.deepStrictEqual(errs, [], 'la consola no debe mostrar violaciones de la CSP ni errores'); errs.length = 0;
    bien('consola limpia en la línea de tiempo (sin violaciones de CSP)');
    await pg.clock.setFixedTime(new Date('2026-11-15T10:00:00'));
    // sin "calendario" en el JSON, las dos vistas dan el mensaje de siempre
    for (const ver of ['folleto', 'linea']) {
      await pg.goto(`${base}/torneo.html?t=sp-ejemplo&ver=${ver}&${D}`);
      await pg.waitForSelector('text=no tiene calendario publicado');
      assert.strictEqual(await pg.locator('.calendario, .linea-tiempo').count(), 0);
    }
    bien('sin la clave calendario, Lista y Línea de tiempo enseñan el mismo aviso');
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
    // el 24º real: un botón por jornada publicada (según actual.json), y se abre la jornada en curso
    const act24 = JSON.parse(require('fs').readFileSync('datos/sp-2026-27/actual.json', 'utf8'));
    const nPub = (act24.jornadas || [act24.jornada]).length;
    await pg.goto(`${base}/torneo.html?t=sp-2026-27`);
    await pg.waitForSelector('table.clasi');
    assert.strictEqual(await pg.locator('.jornadas button').count(), nPub);
    await pg.click('nav.pestanas a:has-text("Mesas")');
    await pg.waitForSelector('li.mesa');
    assert.strictEqual(await pg.locator('.jornadas button').count(), nPub);
    assert.strictEqual(await pg.locator('.jornadas button[aria-pressed=true]').innerText(), String(act24.jornada.numero));
    assert((await pg.locator('li.mesa').count()) >= 20);
    await sinDesborde('24º mesas'); bien(`24º real: ${nPub} botones, se abre la J${act24.jornada.numero}, mesas con tarjeta, sin desbordar`);
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
