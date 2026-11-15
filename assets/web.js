/* tu mesa · web pública. Lee los JSON del contrato (datos/…) y pinta todo como texto. */
(function () {
  'use strict';

  /* ---------- utilidades ---------- */
  const $ = (s, r) => (r || document).querySelector(s);
  // Un enlace con esquema (https://…) o de otro origen solo vale si es https; y entonces lleva rel="noopener noreferrer".
  const CON_ESQUEMA = /^([a-z][a-z0-9+.-]*:|\/\/)/i;
  const enlaceSeguro = (v) => !CON_ESQUEMA.test(String(v)) || /^https:\/\/[^\s/]/i.test(String(v));
  function el(tag, attrs, ...kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else if (k === 'href' && !enlaceSeguro(v)) continue;
      else e.setAttribute(k, v === true ? '' : v);
    }
    if (e.tagName === 'A' && CON_ESQUEMA.test(e.getAttribute('href') || '')) e.setAttribute('rel', 'noopener noreferrer');
    for (const k of kids.flat(Infinity)) {
      if (k == null || k === false) continue;
      e.append(k.nodeType ? k : document.createTextNode(String(k)));
    }
    return e;
  }
  const poner = (cont, ...kids) => cont.replaceChildren(...kids.flat(Infinity).filter((k) => k != null && k !== false));
  const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const pad = (n) => String(n).padStart(2, '0');
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  function partesFecha(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    return m ? { a: +m[1], m: +m[2], d: +m[3] } : null;
  }
  function fechaLarga(iso) {
    const f = partesFecha(iso);
    return f ? `${f.d} de ${MESES[f.m - 1]} de ${f.a}` : '';
  }
  const corta = (iso) => { const f = partesFecha(iso); return f ? `${pad(f.d)}/${pad(f.m)}` : ''; };
  function instante(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return '';
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  const signo = (n) => (n == null ? '' : n > 0 ? '+' + n : n < 0 ? '−' + Math.abs(n) : '0');

  const TIPOS = {
    sp: { nombre: 'Super-Prestigio', jornada: 'Jornada', unidad: 'pareja', unidades: 'parejas', gan: 'Encuentros ganados' },
    parejas: { nombre: 'Parejas', jornada: 'Partida', unidad: 'pareja', unidades: 'parejas', gan: 'Partidas ganadas' },
    individual: { nombre: 'Individual', jornada: 'Partida', unidad: 'jugador', unidades: 'jugadores', gan: 'Partidas ganadas' },
  };
  const tipoDe = (t) => TIPOS[t] || TIPOS.parejas;

  /* ---------- datos ---------- */
  const qs = new URLSearchParams(location.search);
  let BASE = 'datos';
  const d = qs.get('d');
  if (d && /^datos(\/[a-z0-9_-]+)+$/.test(d)) BASE = d;
  const ES_PRUEBA = BASE !== 'datos';

  function url(pagina, params) {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(params || {})) if (v != null && v !== '') p.set(k, v);
    if (ES_PRUEBA) p.set('d', BASE);
    const s = p.toString();
    return pagina + (s ? '?' + s : '');
  }
  async function leer(ruta, fresco) {
    const r = await fetch(ruta, fresco ? { cache: 'no-cache' } : undefined);
    if (!r.ok) throw new Error(ruta + ' ' + r.status);
    return r.json();
  }
  const rutaJornada = (id, n, v) => `${BASE}/${id}/jornada_${pad(n)}.json` + (v ? '?v=' + encodeURIComponent(v) : '');

  function bandaPrueba() {
    if (!ES_PRUEBA) return;
    document.body.prepend(el('div', { class: 'banda-prueba' }, 'Datos de prueba: ningún campeonato de esta página existe de verdad.'));
  }

  /* ---------- nombres ---------- */
  const nombreLargo = (p) => (p.j2_nombre ? `${p.j1_nombre} ${p.j1_apellido1} y ${p.j2_nombre} ${p.j2_apellido1}` : `${p.j1_nombre} ${p.j1_apellido1}`);

  /* =====================================================================
     PORTADA
     ===================================================================== */
  const ESTADOS = { en_juego: 'En juego', proximo: 'Próximo', terminado: 'Terminado' };

  function tarjeta(t) {
    const tp = tipoDe(t.tipo);
    const partes = [`${tp.jornada} ${t.jornada_actual} de ${t.n_jornadas}`, `${t.n_participantes} ${tp.unidades}`];
    if (t.estado === 'terminado' && t.ganador) partes.push(`ganó ${t.ganador.corto}`);
    return el('li', null, el('a', { class: 'tarjeta', href: url('torneo.html', { t: t.id }) },
      el('div', null,
        el('h3', null, t.nombre),
        el('div', { class: 'linea' },
          el('span', { class: 'etiqueta ' + (t.estado === 'en_juego' ? 'vivo' : t.estado === 'terminado' ? 'fin' : '') }, ESTADOS[t.estado] || t.estado),
          tp.nombre + (t.temporada ? ' ' + t.temporada : '') + ' · ' + partes.join(' · ')))));
  }

  async function portada() {
    const lista = $('#lista');
    let indice;
    try {
      indice = await leer(`${BASE}/indice.json`, true);
    } catch (e) {
      lista.replaceChildren(el('p', { class: 'aviso alerta' }, 'No se ha podido cargar la lista de campeonatos. Prueba otra vez dentro de un minuto.'));
      return;
    }
    const ts = indice.torneos || [];
    if (!ts.length) {
      lista.replaceChildren(el('p', { class: 'vacio' }, 'Todavía no hay campeonatos publicados.'));
    } else {
      const grupos = [['en_juego', 'En juego'], ['proximo', 'Próximos'], ['terminado', 'Terminados']];
      lista.replaceChildren(...grupos.flatMap(([est, tit]) => {
        const g = ts.filter((t) => t.estado === est);
        return g.length ? [el('h2', { class: 'seccion' }, tit), el('ul', { class: 'tarjetas' }, g.map(tarjeta))] : [];
      }));
    }
    iniciarBuscador(ts);
  }

  /* ---------- buscador de jugador ---------- */
  function iniciarBuscador(torneos) {
    const entrada = $('#buscar');
    const salida = $('#resultados');
    let cargado = null; // promesa con los actual.json
    const cargar = () => cargado || (cargado = Promise.all(torneos.map((t) =>
      leer(`${BASE}/${t.id}/actual.json`, true).catch(() => null))).then((x) => x.filter(Boolean)));

    // quién jugó dónde: una entrada por persona y torneo
    function personasDe(a) {
      const out = [];
      const subs = a.sustituciones || [];
      for (const p of a.participantes) {
        for (const lado of [['j1_nombre', 'j1_apellido1'], ['j2_nombre', 'j2_apellido1']]) {
          if (!p[lado[0]]) continue;
          const sub = subs.find((s) => s.id === p.id && s.entra_nombre === p[lado[0]] && s.entra_apellido1 === p[lado[1]]);
          out.push({ nombre: p[lado[0]], ap: p[lado[1]], p, nota: sub ? { tipo: 'entra', s: sub } : null });
        }
      }
      for (const s of subs) {
        const p = a.participantes.find((x) => x.id === s.id);
        if (p) out.push({ nombre: s.sale_nombre, ap: s.sale_apellido1, p, nota: { tipo: 'sale', s } });
      }
      return out;
    }

    async function puestoDe(a, id) {
      const js = a.jornadas || [];
      const ult = js.filter((j) => j.completa).map((j) => j.numero).sort((x, y) => y - x)[0];
      if (!ult) return null;
      let jd = a;
      if (!(a.jornada.numero === ult && a.jornada.completa)) {
        try { const meta = js.find((j) => j.numero === ult); jd = await leer(rutaJornada(a.torneo.id, ult, meta && meta.publicado)); } catch (e) { return null; }
      }
      const fila = jd.clasificacion.find((r) => r.id === id);
      return fila ? { puesto: fila.puesto, grupo: fila.grupo, hay_b: jd.clasificacion.some((r) => r.grupo === 'B'), jornada: ult, n: jd.clasificacion.filter((r) => r.grupo === fila.grupo).length } : null;
    }

    async function buscar() {
      const q = norm(entrada.value).split(/\s+/).filter(Boolean);
      if (entrada.value.trim().length < 2) { salida.replaceChildren(); return; }
      salida.replaceChildren(el('p', { class: 'aviso' }, 'Buscando…'));
      const todos = await cargar();
      if (norm(entrada.value).split(/\s+/).filter(Boolean).join(' ') !== q.join(' ')) return; // el usuario ya escribió otra cosa
      const grupos = new Map();
      for (const a of todos) {
        for (const per of personasDe(a)) {
          const clave = norm(per.nombre + ' ' + per.ap);
          if (!q.every((w) => clave.includes(w))) continue;
          if (!grupos.has(clave)) grupos.set(clave, { nombre: `${per.nombre} ${per.ap}`, items: [] });
          grupos.get(clave).items.push({ a, per });
        }
      }
      if (!grupos.size) {
        salida.replaceChildren(el('p', { class: 'aviso' }, 'No hay nadie con ese nombre en los campeonatos publicados.'));
        return;
      }
      const tarjetas = [...grupos.values()].sort((x, y) => x.nombre.localeCompare(y.nombre, 'es')).map((g) => {
        const ul = el('ul');
        g.items.sort((x, y) => (y.a.torneo.fecha || '').localeCompare(x.a.torneo.fecha || ''));
        for (const { a, per } of g.items) {
          const t = a.torneo, tp = tipoDe(t.tipo);
          const compa = a.participantes.length && per.p.j2_nombre
            ? [[per.p.j1_nombre, per.p.j1_apellido1], [per.p.j2_nombre, per.p.j2_apellido1]].filter((x) => !(x[0] === per.nombre && x[1] === per.ap)).map((x) => x.join(' ')).join('') : '';
          const detalle = el('span', null);
          const linea = [`${tp.unidad[0].toUpperCase() + tp.unidad.slice(1)} ${per.p.id}`];
          if (per.p.corto && t.tipo !== 'individual') linea.push(per.p.corto);
          if (compa && !per.nota) linea.push(`con ${compa}`);
          detalle.append(linea.join(' · '));
          if (per.nota) {
            const s = per.nota.s;
            detalle.append(el('span', null, per.nota.tipo === 'sale'
              ? `Jugó hasta la ${tp.jornada.toLowerCase()} ${s.desde - 1}; le sustituyó ${s.entra_nombre} ${s.entra_apellido1}.`
              : `Entró en la ${tp.jornada.toLowerCase()} ${s.desde} en lugar de ${s.sale_nombre} ${s.sale_apellido1}.`));
          }
          const pu = el('span', { class: 'puesto' }, '…');
          detalle.append(pu);
          puestoDe(a, per.p.id).then((r) => {
            const campeon = r && r.puesto === 1 && r.grupo === 'A' && t.estado === 'terminado';
            pu.textContent = !r ? 'Aún sin clasificación' : (campeon ? 'Campeones · ' : '') + `${r.puesto}.º${r.hay_b ? ' del grupo ' + r.grupo : ''} de ${r.n} tras la ${tp.jornada.toLowerCase()} ${r.jornada}`;
          });
          ul.append(el('li', null, el('a', { href: url('torneo.html', { t: t.id, ver: 'clasificacion', p: per.p.id }) },
            el('b', null, t.nombre + (t.temporada ? ' · ' + t.temporada : '')), detalle)));
        }
        return el('div', { class: 'persona' }, el('h3', null, g.nombre), ul);
      });
      salida.replaceChildren(...tarjetas);
    }
    let espera;
    entrada.addEventListener('input', () => { clearTimeout(espera); espera = setTimeout(buscar, 180); });
    entrada.addEventListener('focus', cargar, { once: true });
  }

  /* =====================================================================
     PÁGINA DE TORNEO
     ===================================================================== */
  const PESTANAS = [['clasificacion', 'Clasificación'], ['mesas', 'Mesas'], ['parejas', 'Parejas'], ['folleto', 'Calendario']];
  const ANTIGUAS = { emparejamientos: 'mesas', resultados: 'mesas', normativa: 'folleto' }; // enlaces de antes del cambio de pestañas
  const E = { id: null, actual: null, cache: new Map(), ver: 'clasificacion', j: null, g: 'A', p: null, q: '', cal: 'lista' };

  function leerUrl() {
    const x = new URLSearchParams(location.search);
    E.id = x.get('t');
    const v = ANTIGUAS[x.get('ver')] || x.get('ver');
    E.ver = PESTANAS.some((t) => t[0] === v) ? v : 'clasificacion';
    E.j = +x.get('j') || null;
    E.g = x.get('g') === 'B' ? 'B' : 'A';
    E.p = +x.get('p') || null;
    E.cal = x.get('cal') === 'linea' ? 'linea' : 'lista';
  }
  function irA(cambios, empujar) {
    Object.assign(E, cambios);
    const nueva = url('torneo.html', { t: E.id, ver: E.ver === 'clasificacion' ? '' : E.ver, j: E.j, g: E.g === 'B' ? 'B' : '', p: E.p, cal: E.ver === 'folleto' ? E.cal : '' });
    if (empujar) history.pushState(null, '', nueva); else history.replaceState(null, '', nueva);
    pintar();
  }

  const jornadasDe = (a) => (a.jornadas && a.jornadas.length ? a.jornadas : [{ numero: a.jornada.numero, completa: a.jornada.completa, publicado: a.publicado }]).slice().sort((x, y) => x.numero - y.numero);
  const ultimaCompleta = (a) => { const c = jornadasDe(a).filter((j) => j.completa); return c.length ? c[c.length - 1].numero : null; };
  // En vivo (como el Excel): en cuanto la jornada publicada tiene un resultado, su clasificación es la que se ve,
  // con ⏳ en quien aún no ha jugado (`pendiente`, cifras de antes). Sin resultados, se ve la última cerrada.
  const conResultado = (jd) => !jd.jornada.completa && jd.emparejamientos.some((m) => ['jugada', 'incomparecencia', 'nd'].includes(m.estado));

  async function datosJornada(n) {
    const a = E.actual;
    if (n === a.jornada.numero) return a;
    if (E.cache.has(n)) return E.cache.get(n);
    const meta = jornadasDe(a).find((j) => j.numero === n);
    const jd = await leer(rutaJornada(E.id, n, meta && meta.publicado));
    E.cache.set(n, jd);
    return jd;
  }

  function cabecera() {
    const a = E.actual, t = a.torneo, tp = tipoDe(t.tipo);
    document.title = `${t.nombre} · tu mesa`;
    const datos = [t.tipo === 'sp' ? null : fechaLarga(t.fecha), t.temporada && 'Temporada ' + t.temporada, t.lugar, `${t.n_participantes} ${tp.unidades}`, `${tp.jornada} ${a.jornada.numero} de ${t.n_jornadas}`].filter(Boolean);
    $('#cab').replaceChildren(
      el('div', null, el('span', { class: 'etiqueta ' + (t.estado === 'en_juego' ? 'vivo' : t.estado === 'terminado' ? 'fin' : '') }, ESTADOS[t.estado] || t.estado), el('span', { class: 'etiqueta' }, tp.nombre)),
      el('h1', null, t.nombre),
      el('p', { class: 'linea' }, datos.join(' · ')),
      el('p', { class: 'sello' }, `Datos publicados el ${instante(a.publicado)}.` + (t.estado === 'en_juego' ? ' Esta página se actualiza sola.' : '')));
  }

  function pestanas() {
    const ind = E.actual.torneo.tipo === 'individual';
    $('#pestanas').replaceChildren(...PESTANAS.map(([k, txt]) => el('a', {
      href: url('torneo.html', { t: E.id, ver: k === 'clasificacion' ? '' : k, p: E.p }), 'aria-current': E.ver === k ? 'page' : null,
      onclick: (ev) => { if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.button) return; ev.preventDefault(); irA({ ver: k, j: null }, true); },
    }, k === 'parejas' && ind ? 'Jugadores' : txt)));
  }

  // "Jornada N · se juega del dd/mm al dd/mm"; nada si el JSON no trae el plazo
  function plazo(jd, tp) {
    const j = jd.jornada, d = corta(j.plazo_desde), h = corta(j.plazo_hasta);
    return d && h ? el('p', { class: 'plazo' }, `${tp.jornada} ${j.numero} · se juega del ${d} al ${h}`) : null;
  }

  function selectorJornada(lista, actualN, tp, alElegir) {
    return el('div', { class: 'jornadas', role: 'group', 'aria-label': tp.jornada }, el('span', { class: 'rot' }, tp.jornada),
      lista.map((j) => el('button', {
        type: 'button', 'aria-pressed': String(j.numero === actualN), class: j.completa ? '' : 'curso',
        title: j.completa ? null : 'En juego', onclick: () => alElegir(j.numero),
      }, j.numero)));
  }

  /* ----- clasificación ----- */
  async function pintarClasificacion(cont) {
    const a = E.actual, tp = tipoDe(a.torneo.tipo);
    const ult = ultimaCompleta(a);
    const vivo = conResultado(a) ? a.jornada.numero : null;
    if (!ult && !vivo) {
      cont.replaceChildren(el('p', { class: 'vacio' }, `La clasificación aparecerá cuando se cierre la ${tp.jornada.toLowerCase()} 1.` + (a.jornada.numero === 1 ? ' Mientras tanto, mira los emparejamientos y los resultados que van llegando.' : '')));
      return;
    }
    const completas = jornadasDe(a).filter((j) => j.completa || j.numero === vivo);
    const n = completas.some((j) => j.numero === E.j) ? E.j : (vivo || ult);
    let jd;
    try { jd = await datosJornada(n); } catch (e) { cont.replaceChildren(el('p', { class: 'aviso alerta' }, 'No se ha podido cargar esa clasificación. Prueba otra vez dentro de un minuto.')); return; }
    if (E.ver !== 'clasificacion') return;
    const byId = new Map(jd.participantes.map((p) => [p.id, p]));
    const sp = a.torneo.tipo === 'sp';
    const conB = jd.clasificacion.some((r) => r.grupo === 'B');
    const g = conB ? E.g : 'A';
    const filas = jd.clasificacion.filter((r) => r.grupo === g);
    const subs = (jd.sustituciones || []);

    const cols = sp
      ? [['gan', 'Gan', tp.gan, 0], ['dp', 'Dif.P', 'Diferencia de partidas', 0], ['dt', 'Dif.T', 'Diferencia de tantos', 0], ['tf', 'TF', 'Tantos a favor', 0], ['jug', 'Jug', 'Encuentros jugados', 1], ['pg', 'PG', 'Partidas ganadas', 1], ['pp', 'PP', 'Partidas perdidas', 1], ['tc', 'TC', 'Tantos en contra', 1]]
      : [['gan', 'Gan', tp.gan, 0], ['dt', 'Dif.T', 'Diferencia de tantos', 0], ['tf', 'TF', 'Tantos a favor', 0], ['jug', 'Jug', 'Partidas jugadas', 1], ['tc', 'TC', 'Tantos en contra', 1]];

    const cuerpo = filas.map((r) => {
      const p = byId.get(r.id) || { corto: '#' + r.id };
      const sub = subs.find((s) => s.id === r.id);
      const sub2 = [`Nº ${r.id}`, p.zona, p.j1_nombre && nombreLargo(p)].filter(Boolean).join(' · ');
      return el('tr', { class: (p.ret ? 'ret ' : '') + (E.p === r.id ? 'resalte' : ''), id: 'fila-' + r.id },
        el('td', null, el('span', { class: 'puesto' + (r.puesto <= 3 ? ' p' + r.puesto : '') }, r.puesto)),
        el('td', { class: 'pareja' },
          el('span', { class: 'nom' }, p.corto, p.ret ? el('span', { class: 'etq alerta' }, 'Retirada') : null,
            r.pendiente && !jd.jornada.completa ? el('span', { class: 'etq pend', title: `Todavía no ha jugado la ${tp.jornada.toLowerCase()} ${n}` }, '⏳') : null),
          el('span', { class: 'sub' }, sub2),
          sub ? el('span', { class: 'sub' }, `Cambio en la ${tp.jornada.toLowerCase()} ${sub.desde}: entra ${sub.entra_nombre} ${sub.entra_apellido1} por ${sub.sale_nombre} ${sub.sale_apellido1}`) : null),
        cols.map(([k, , , x]) => el('td', { class: (x ? 'x ' : '') + (k === 'gan' ? 'gan' : '') }, k === 'dp' || k === 'dt' ? signo(r[k]) : r[k])));
    });
    const tabla = el('table', { class: 'clasi' },
      el('caption', { class: 'solo-lector' }, `Clasificación del grupo ${g} tras la ${tp.jornada.toLowerCase()} ${n}`),
      el('thead', null, el('tr', null, el('th', { scope: 'col' }, '#'), el('th', { scope: 'col', class: 'izq' }, tp.unidad[0].toUpperCase() + tp.unidad.slice(1)),
        cols.map(([, t, ab, x]) => el('th', { scope: 'col', class: x ? 'x' : '' }, el('abbr', { title: ab }, t))))),
      el('tbody', null, cuerpo));
    const leyenda = cols.map(([, t, ab]) => `${t}: ${ab.toLowerCase()}`).join(' · ');

    poner(cont,
      selectorJornada(completas, n, tp, (x) => irA({ j: x }, false)),
      conB ? el('div', { class: 'grupos', role: 'group', 'aria-label': 'Grupo' }, ['A', 'B'].map((x) => el('button', { type: 'button', 'aria-pressed': String(g === x), onclick: () => irA({ g: x }, false) }, 'Grupo ' + x))) : null,
      plazo(jd, tp),
      n === vivo ? el('p', { class: 'nota caja' }, `${tp.jornada} ${n} en juego: la clasificación se actualiza con cada resultado. ⏳ = todavía no ha jugado esta ${tp.jornada.toLowerCase()} (lleva sus cifras de antes).`) : null,
      n !== vivo && n === ult && !a.jornada.completa && !vivo ? el('p', { class: 'nota caja' }, `Esta clasificación es la de la ${tp.jornada.toLowerCase()} ${ult}, la última cerrada. En cuanto llegue el primer resultado de la ${tp.jornada.toLowerCase()} ${a.jornada.numero}, la clasificación se verá en vivo.`) : null,
      filas.length ? el('div', { class: 'tabla-caja' }, tabla) : el('p', { class: 'vacio' }, 'Este grupo todavía no tiene clasificación.'),
      el('p', { class: 'leyenda' }, leyenda));
    const f = E.p && $('#fila-' + E.p);
    if (f && !E.yaDesplazado) { E.yaDesplazado = true; f.scrollIntoView({ block: 'center' }); }
  }

  /* ----- mesas: una tarjeta por mesa, con resultado ----- */
  const ETIQUETAS = { incomparecencia: 'Incomparecencia', nd: 'ND', descanso: 'Descansa', retirada: 'Retirada', ausencia: 'Falta alguien', no_cuenta: 'No cuenta' };
  const TITULOS = { nd: 'No disputado', incomparecencia: 'Una pareja no se presentó', retirada: 'La pareja rival se ha retirado', descanso: 'Sin rival esta jornada', ausencia: 'Falta algún jugador en la mesa', no_cuenta: 'Esta mesa no cuenta' };

  function ladoEl(ids, byId, gana) {
    return el('div', { class: 'lado' + (gana ? ' gana' : '') }, ids.map((id) => {
      const p = byId.get(id);
      return el('div', { class: 'pa' }, el('span', { class: 'n' }, id),
        el('span', { class: 'quien' }, el('span', { class: 'nom' }, p ? p.corto : '?'),
          p && p.ret ? el('span', { class: 'etq alerta' }, 'Retirada') : null,
          p && p.j2_nombre ? el('small', null, nombreLargo(p)) : null),
        gana ? el('span', { class: 'gana-marca', title: 'Ganadora' }, '✓', el('span', { class: 'solo-lector' }, ' ganadora')) : null);
    }));
  }
  function qBusqueda(m, byId) {
    const ids = [...m.izq, ...m.dcha];
    return norm(ids.map((i) => { const p = byId.get(i); return i + ' ' + (p ? nombreLargo(p) + ' ' + p.corto : ''); }).join(' ') + ' mesa ' + (m.mesa || ''));
  }
  // Resultado: partidas (2-1) y tantos (600-472) en el SP; solo tantos en los demás. Un estado raro lleva su etiqueta en lugar de cifras.
  function resultado(m, sp) {
    if (m.estado === 'pendiente') return el('div', { class: 'res' }, el('span', { class: 'por', title: 'Por jugar' }, '⏳'), el('small', null, 'por jugar'));
    if (m.estado === 'jugada' && m.p_izq != null) {
      return el('div', { class: 'res' }, el('b', null, sp ? `${m.p_izq}-${m.p_dcha}` : `${m.t_izq}-${m.t_dcha}`), sp ? el('small', null, `${m.t_izq}-${m.t_dcha} tantos`) : null);
    }
    return el('div', { class: 'res' }, el('span', { class: 'etiq-estado ' + m.estado, title: TITULOS[m.estado] || null }, ETIQUETAS[m.estado] || m.estado));
  }
  function tarjetaMesa(m, byId, a) {
    const sp = a.torneo.tipo === 'sp';
    const jugada = m.estado === 'jugada' && m.p_izq != null;
    const gIzq = jugada && (sp ? m.p_izq > m.p_dcha : m.t_izq > m.t_dcha), gDcha = jugada && (sp ? m.p_dcha > m.p_izq : m.t_dcha > m.t_izq);
    const mia = E.p && [...m.izq, ...m.dcha].includes(E.p);
    const desc = m.estado === 'descanso';
    const aus = m.estado === 'ausencia' && m.ausentes.length ? el('small', { class: 'sub' }, 'Falta: ' + m.ausentes.map((i) => (byId.get(i) || {}).corto || i).join(', ')) : null;
    return el('li', { class: 'mesa' + (mia ? ' resalte' : '') + (desc ? ' descanso' : ''), 'data-q': qBusqueda(m, byId), id: mia ? 'mesa-mia' : null },
      el('div', { class: 'cab-mesa' },
        desc ? el('span', { class: 'num-mesa sin' }, 'Descanso') : el('span', { class: 'num-mesa' }, el('i', null, 'Mesa'), el('b', null, m.mesa)),
        resultado(m, sp)),
      el('div', { class: 'lados' }, ladoEl(m.izq, byId, gIzq), desc ? null : ladoEl(m.dcha, byId, gDcha), aus));
  }
  function aplicarFiltro() {
    const q = norm(E.q), cont = $('#contenido');
    const filas = [...cont.querySelectorAll('li.mesa')];
    let visibles = 0;
    for (const li of filas) {
      const ok = !q || (/^\d+$/.test(q) ? li.dataset.q.split(' ').includes(q) : li.dataset.q.includes(q));
      li.hidden = !ok;
      if (ok) visibles++;
    }
    const sin = $('#sin-coincidencias');
    if (sin) sin.hidden = visibles > 0 || !filas.length;
  }
  function filtro() {
    const campo = el('input', { type: 'search', id: 'filtro', autocomplete: 'off', placeholder: 'Busca tu nombre, tu apellido o tu número', value: E.q, 'aria-label': 'Buscar en esta jornada' });
    campo.addEventListener('input', () => { E.q = campo.value; aplicarFiltro(); });
    return el('div', { class: 'filtro' }, campo);
  }

  async function pintarMesas(cont) {
    const a = E.actual, tp = tipoDe(a.torneo.tipo);
    const lista = jornadasDe(a);
    const n = lista.some((j) => j.numero === E.j) ? E.j : a.jornada.numero;
    let jd;
    try { jd = await datosJornada(n); } catch (e) { cont.replaceChildren(el('p', { class: 'aviso alerta' }, 'No se ha podido cargar esa ' + tp.jornada.toLowerCase() + '. Prueba otra vez dentro de un minuto.')); return; }
    if (E.ver !== 'mesas') return;
    const byId = new Map(jd.participantes.map((p) => [p.id, p]));
    const ms = jd.emparejamientos;
    const grupos = [...new Set(ms.map((m) => m.grupo))];
    const pend = ms.filter((m) => m.estado === 'pendiente').length;
    const hechas = ms.filter((m) => m.estado !== 'pendiente' && m.estado !== 'descanso').length;
    const avisos = [];
    if (jd.jornada.sorteo && jd.jornada.sin_sortear) avisos.push('El sorteo todavía no se ha hecho: este orden es provisional.');
    else if (jd.jornada.emparejamiento === 'provisional' && !jd.jornada.completa) avisos.push('Estos emparejamientos todavía no están fijados y pueden cambiar.');
    if (!jd.jornada.completa && pend) avisos.push(`${hechas ? (hechas === 1 ? 'Hay 1 mesa con resultado' : `Hay ${hechas} mesas con resultado`) : 'Todavía no hay resultados'} y faltan ${pend}. ⏳ = por jugar.`);
    const secciones = ms.length ? grupos.flatMap((g) => [
      grupos.length > 1 ? el('h2', { class: 'grupo-tit' }, 'Grupo ' + g) : null,
      el('ul', { class: 'mesas' }, ms.filter((m) => m.grupo === g).map((m) => tarjetaMesa(m, byId, a)))]) : [el('p', { class: 'vacio' }, 'Todavía no hay emparejamientos publicados.')];
    poner(cont, selectorJornada(lista, n, tp, (x) => irA({ j: x }, false)), plazo(jd, tp), filtro(),
      avisos.map((t) => el('p', { class: 'nota caja' }, t)), secciones,
      el('p', { id: 'sin-coincidencias', class: 'vacio', hidden: true }, 'Nadie coincide con esa búsqueda en esta ' + tp.jornada.toLowerCase() + '.'));
    aplicarFiltro();
    const m = !E.yaDesplazado && $('#mesa-mia'); if (m) { E.yaDesplazado = true; m.scrollIntoView({ block: 'center' }); }
  }

  /* ----- parejas ----- */
  function pintarParejas(cont) {
    const a = E.actual, tp = tipoDe(a.torneo.tipo);
    const ps = a.participantes.slice().sort((x, y) => x.id - y.id);
    if (!ps.length) { cont.replaceChildren(el('p', { class: 'vacio' }, `Todavía no hay ${tp.unidades} publicadas.`)); return; }
    const hayB = ps.some((p) => p.grupo === 'B');
    cont.replaceChildren(el('div', { class: 'tabla-caja' }, el('table', { class: 'lista-parejas' },
      el('caption', { class: 'solo-lector' }, `${tp.unidades[0].toUpperCase() + tp.unidades.slice(1)} inscritas`),
      el('thead', null, el('tr', null, el('th', { scope: 'col' }, 'Nº'), el('th', { scope: 'col' }, tp.unidades === 'jugadores' ? 'Jugador' : 'Jugadores'), el('th', { scope: 'col' }, 'Zona'))),
      el('tbody', null, ps.map((p) => el('tr', { class: p.ret ? 'ret' : null },
        el('td', { class: 'n' }, p.id),
        el('td', null, [[p.j1_nombre, p.j1_apellido1], [p.j2_nombre, p.j2_apellido1]].filter((x) => x[0]).map((x) => el('span', { class: 'nom' }, x.join(' '))),
          p.ret ? el('span', { class: 'etq alerta' }, 'Retirada') : null, hayB ? el('span', { class: 'etq' }, 'Grupo ' + p.grupo) : null),
        el('td', { class: 'zona' }, p.zona)))))));
  }

  /* ----- calendario: dos vistas (Lista y Línea de tiempo) ----- */
  const CALS = [['lista', 'Lista'], ['linea', 'Línea de tiempo']];
  const diaN = (iso) => { const f = partesFecha(iso); return Date.UTC(f.a, f.m - 1, f.d) / 864e5; };
  const dm = (iso) => { const f = partesFecha(iso); return `${f.d}/${f.m}`; };
  const dma = (iso) => `${dm(iso)}/${partesFecha(iso).a}`;
  // "13/10 – 26/10/2026"; si cruza de año, "15/12/2026 – 4/1/2027"
  const rango = (c) => (partesFecha(c.desde).a === partesFecha(c.hasta).a ? `${dm(c.desde)} – ${dma(c.hasta)}` : `${dma(c.desde)} – ${dma(c.hasta)}`);
  // "del 10 al 23 de noviembre de 2026" (para lectores de pantalla)
  function rangoLargo(c) {
    const d = partesFecha(c.desde), h = partesFecha(c.hasta);
    if (d.a !== h.a) return `del ${fechaLarga(c.desde)} al ${fechaLarga(c.hasta)}`;
    if (d.m !== h.m) return `del ${d.d} de ${MESES[d.m - 1]} al ${h.d} de ${MESES[h.m - 1]} de ${h.a}`;
    return `del ${d.d} al ${h.d} de ${MESES[h.m - 1]} de ${h.a}`;
  }
  function filasCalendario(a) {
    return (Array.isArray(a.calendario) ? a.calendario : [])
      .filter((c) => c && Number.isInteger(c.jornada) && partesFecha(c.desde) && partesFecha(c.hasta) && diaN(c.hasta) >= diaN(c.desde))
      .sort((x, y) => diaN(x.desde) - diaN(y.desde));
  }
  const cursoDe = (a) => (a.torneo.estado === 'terminado' ? null : a.jornada.numero);
  const estadoDe = (c, curso) => (curso == null || c.jornada < curso ? 'jugada' : c.jornada === curso ? 'en juego' : 'por jugar');

  function calLista(a, filas) {
    const tp = tipoDe(a.torneo.tipo), curso = cursoDe(a);
    return el('section', { class: 'calendario' }, el('h2', null, 'Calendario'),
      el('ol', null, filas.map((c) => el('li', { class: c.jornada === curso ? 'curso' : null, 'aria-current': c.jornada === curso ? 'step' : null },
        el('span', { class: 'num' }, el('small', null, tp.jornada), c.jornada, c.jornada_b != null ? el('b', { class: 'b' }, 'B' + c.jornada_b) : null),
        el('span', { class: 'fechas' }, rango(c))))));
  }

  // Regla vertical de semanas: la altura de cada jornada sale de sus días (--dias; la CSP permite setProperty).
  function calLinea(a, filas) {
    const tp = tipoDe(a.torneo.tipo), curso = cursoDe(a);
    const dias = filas.map((c) => diaN(c.hasta) - diaN(c.desde) + 1);
    const n = new Date(), hoy = Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()) / 864e5;
    const conB = filas.some((c) => c.jornada_b != null);
    const sobre = filas.map(() => ({ arriba: [], abajo: [], cortes: [], hoy: null }));
    const hito = (i, pos, txt, iso) => sobre[i][pos].push(el('p', { class: 'hito', tabindex: '0', role: 'group', 'aria-label': `${txt}: ${fechaLarga(iso)}` },
      el('b', { 'aria-hidden': 'true' }, txt), el('span', { 'aria-hidden': 'true' }, dma(iso))));
    const ult = filas.length - 1;
    hito(0, 'arriba', 'Inicio del campeonato', filas[0].desde);
    const kb = filas.findIndex((c) => c.jornada_b != null);
    if (kb > 0) { hito(kb - 1, 'abajo', 'Corte del grupo B', filas[kb - 1].hasta); hito(kb, 'arriba', 'Inicio del grupo B', filas[kb].desde); }
    hito(ult, 'abajo', 'Final del campeonato', filas[ult].hasta);
    // cambio de año: una línea que cruza la regla, con el año a cada lado
    for (let y = partesFecha(filas[0].desde).a + 1; y <= partesFecha(filas[ult].hasta).a; y++) {
      const ene = Date.UTC(y, 0, 1) / 864e5;
      let i = filas.findIndex((c) => diaN(c.desde) <= ene && ene <= diaN(c.hasta));
      let f = i < 0 ? 0 : (ene - diaN(filas[i].desde)) / dias[i];
      if (i < 0) i = filas.findIndex((c) => diaN(c.desde) > ene);
      if (i < 0) continue;
      const corte = el('div', { class: 'corte' },
        el('span', { class: 'anio antes' }, y - 1),
        el('b', { class: 'anio despues', tabindex: '0', role: 'group', 'aria-label': `Cambio de año: ${fechaLarga(`${y}-01-01`)}` },
          el('span', { 'aria-hidden': 'true' }, y), el('small', { 'aria-hidden': 'true' }, 'Cambio de año · 1/1')));
      corte.style.setProperty('--f', f);
      sobre[i].cortes.push(corte);
    }
    // «hoy», dentro del campeonato
    if (hoy >= diaN(filas[0].desde) && hoy <= diaN(filas[ult].hasta)) {
      let i = filas.findIndex((c) => hoy <= diaN(c.hasta));
      const f = hoy >= diaN(filas[i].desde) ? (hoy - diaN(filas[i].desde) + 0.5) / dias[i] : 0;
      const m = el('div', { class: 'hoy' }, el('b', { 'aria-hidden': 'true' }, 'hoy'), el('span', { class: 'solo-lector' }, `Hoy, ${fechaLarga(`${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}`)}`));
      m.style.setProperty('--f', f);
      sobre[i].hoy = m;
    }
    const lis = filas.map((c, i) => {
      const est = estadoDe(c, curso), cl = est === 'jugada' ? 'jugada' : est === 'en juego' ? 'curso' : 'falta';
      const li = el('li', { class: cl, 'aria-current': cl === 'curso' ? 'step' : null },
        el('div', { class: 'hitos' }, sobre[i].arriba, sobre[i].abajo),
        el('span', { class: 'regla', 'aria-hidden': 'true' }),
        el('div', { class: 'jornada', tabindex: '0', role: 'group', 'aria-label': `${tp.jornada} ${c.jornada}, ${rangoLargo(c)}, ${est}${c.jornada_b != null ? `, jornada ${c.jornada_b} del grupo B` : ''}` },
          el('b', { class: 'num', 'aria-hidden': 'true' }, el('small', null, tp.jornada), c.jornada),
          el('span', { class: 'fechas', 'aria-hidden': 'true' }, `${dm(c.desde)} – ${dm(c.hasta)}`),
          el('span', { class: 'estado', 'aria-hidden': 'true' }, est)),
        c.jornada_b != null ? el('span', { class: 'carril-b', 'aria-hidden': 'true' }, 'B' + c.jornada_b) : null,
        sobre[i].cortes, sobre[i].hoy);
      li.style.setProperty('--dias', dias[i]);
      return li;
    });
    return el('section', { class: 'linea-tiempo' }, el('h2', null, 'Calendario'),
      el('ol', { class: conB ? 'con-b' : null }, lis));
  }

  function pintarFolleto(cont) {
    const filas = filasCalendario(E.actual);
    const sub = el('nav', { class: 'subpestanas', 'aria-label': 'Vista del calendario' }, CALS.map(([k, txt]) => el('a', {
      href: url('torneo.html', { t: E.id, ver: 'folleto', cal: k, p: E.p }), 'aria-current': E.cal === k ? 'page' : null,
      onclick: (ev) => { if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.button) return; ev.preventDefault(); E.enfocar = true; irA({ cal: k }, true); },
    }, txt)));
    poner(cont, sub, !filas.length ? el('p', { class: 'vacio' }, 'Este campeonato no tiene calendario publicado.') : E.cal === 'linea' ? calLinea(E.actual, filas) : calLista(E.actual, filas));
    if (E.enfocar) { E.enfocar = false; const x = $('.subpestanas a[aria-current]', cont); if (x) x.focus(); }
  }

  /* ----- orquestación ----- */
  let pintando = 0;
  async function pintar() {
    const marca = ++pintando;
    cabecera(); pestanas();
    const cont = $('#contenido');
    if (marca !== pintando) return;
    if (E.ver === 'clasificacion') await pintarClasificacion(cont);
    else if (E.ver === 'mesas') await pintarMesas(cont);
    else if (E.ver === 'parejas') pintarParejas(cont);
    else pintarFolleto(cont);
  }

  async function sondear() {
    try {
      const nuevo = await leer(`${BASE}/${E.id}/actual.json?t=${Math.floor(Date.now() / 60000)}`, true);
      if (nuevo.publicado !== E.actual.publicado) {
        const y = window.scrollY;
        E.actual = nuevo; E.cache.clear();
        await pintar();
        window.scrollTo(0, y);
      }
    } catch (e) { /* sin red: se reintenta en el siguiente minuto */ }
  }

  async function torneo() {
    leerUrl();
    if (!E.id || !/^[a-z0-9][a-z0-9-]{2,59}$/.test(E.id)) { $('#contenido').replaceChildren(el('p', { class: 'aviso alerta' }, 'Falta el campeonato. Vuelve a la portada y elige uno.')); return; }
    try { E.actual = await leer(`${BASE}/${E.id}/actual.json`, true); }
    catch (e) { $('#contenido').replaceChildren(el('p', { class: 'aviso alerta' }, 'No se ha encontrado este campeonato. Puede que todavía no esté publicado.')); return; }
    await pintar();
    window.addEventListener('popstate', () => { leerUrl(); pintar(); });
    if (E.actual.torneo.estado === 'en_juego') {
      setInterval(() => { if (!document.hidden) sondear(); }, 60000);
      document.addEventListener('visibilitychange', () => { if (!document.hidden) sondear(); });
    }
  }

  window.TuMesa = { el, poner };

  document.addEventListener('DOMContentLoaded', () => {
    bandaPrueba();
    const pagina = document.body.dataset.pagina;
    if (pagina === 'portada') portada();
    else if (pagina === 'torneo') torneo();
    document.querySelectorAll('a[data-conservar]').forEach((x) => { if (ES_PRUEBA) x.href = url(x.getAttribute('href')); });
  });
})();
