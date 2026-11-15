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
  const PESTANAS = [['clasificacion', 'Clasificación'], ['mesas', 'Mesas'], ['parejas', 'Parejas'], ['folleto', 'Calendario'], ['linea', 'Línea de tiempo']];
  const ANTIGUAS = { emparejamientos: 'mesas', resultados: 'mesas', normativa: 'folleto' }; // enlaces de antes del cambio de pestañas
  const E = { id: null, actual: null, cache: new Map(), ver: 'clasificacion', j: null, g: 'A', p: null, q: '', cal: 'lista', op: 1 };

  function leerUrl() {
    const x = new URLSearchParams(location.search);
    E.id = x.get('t');
    const v = ANTIGUAS[x.get('ver')] || x.get('ver');
    E.ver = PESTANAS.some((t) => t[0] === v) ? v : 'clasificacion';
    E.j = +x.get('j') || null;
    E.g = x.get('g') === 'B' ? 'B' : 'A';
    E.p = +x.get('p') || null;
    E.cal = x.get('cal') === 'linea' ? 'linea' : 'lista';
    if (E.ver === 'folleto' && E.cal === 'linea') E.ver = 'linea'; // enlaces de la vista con sub-pestañas
    const o = +x.get('op');
    E.op = Number.isInteger(o) && o >= 1 && o <= 5 ? o : 1;
  }
  function irA(cambios, empujar) {
    Object.assign(E, cambios);
    const nueva = url('torneo.html', { t: E.id, ver: E.ver === 'clasificacion' ? '' : E.ver, j: E.j, g: E.g === 'B' ? 'B' : '', p: E.p, op: E.ver === 'linea' ? E.op : '' });
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

  /* ----- línea de tiempo: cinco opciones provisionales (&op=1..5) -----
     Todas salen del mismo modelo (modeloLinea): la clave "calendario", la jornada en curso y hoy.
     Los dibujos van con aria-hidden y cada opción lleva su texto para lector de pantalla.
     Las posiciones se fijan con style.setProperty: la CSP no admite estilos en línea escritos como atributo. */
  const NOM_OP = ['La mano', 'El plazo', 'La esfera', 'El acta', 'La regla'];
  const DIA_SEM = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const MES3 = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const diaSem = (iso) => DIA_SEM[new Date(diaN(iso) * 864e5).getUTCDay()];
  const fechaDia = (iso) => `${diaSem(iso)} ${partesFecha(iso).d} de ${MESES[partesFecha(iso).m - 1]}`;
  const isoDeDia = (dn) => new Date(dn * 864e5).toISOString().slice(0, 10);
  const fijar = (e, vars) => { for (const [k, v] of Object.entries(vars)) e.style.setProperty('--' + k, Math.round(v * 1e3) / 1e3); return e; };
  const claseEst = (j) => (j.est === 'jugada' ? 'jugada' : j.est === 'en juego' ? 'curso' : 'falta');
  const svgEl = (tag, attrs, ...kids) => {
    const e = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [k, v] of Object.entries(attrs || {})) if (v != null) e.setAttribute(k, v);
    for (const k of kids.flat(Infinity)) if (k != null) e.append(k.nodeType ? k : document.createTextNode(String(k)));
    return e;
  };

  function modeloLinea(a, filas) {
    const t = a.torneo, tp = tipoDe(t.tipo), curso = cursoDe(a), ult = filas.length - 1;
    const n = new Date(), hoy = Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()) / 864e5;
    const d0 = diaN(filas[0].desde), total = diaN(filas[ult].hasta) - d0 + 1;
    const js = filas.map((c, i) => ({ i, n: c.jornada, desde: c.desde, hasta: c.hasta, x: diaN(c.desde) - d0, dias: diaN(c.hasta) - diaN(c.desde) + 1, est: estadoDe(c, curso) }));
    // Grupo B: firme con hay_b; previsto si no hay_b pero torneo.jornada_b > 1; si no, sin B
    const ini = t.hay_b ? (Number.isInteger(t.jornada_b) ? t.jornada_b : (filas.find((c) => c.jornada_b != null) || {}).jornada) : (Number.isInteger(t.jornada_b) && t.jornada_b > 1 ? t.jornada_b : null);
    const kb = ini == null ? -1 : js.findIndex((j) => j.n === ini);
    const b = kb > 0 ? (t.hay_b ? 'firme' : 'previsto') : null;
    if (b) js.forEach((j, i) => { if (i >= kb) j.b = i - kb + 1; });
    // cambio de año: la ficha que cruza el 1 de enero; si el corte es limpio, la anterior
    const anios = [];
    for (let y = partesFecha(filas[0].desde).a + 1; y <= partesFecha(filas[ult].hasta).a; y++) {
      const ene = Date.UTC(y, 0, 1) / 864e5;
      let i = js.findIndex((j) => diaN(j.hasta) >= ene);
      if (i < 0) continue;
      const cruza = diaN(js[i].desde) < ene;
      if (!cruza) i--;
      anios.push({ y, i, cruza, x: ene - d0 });
    }
    const dentro = hoy >= d0 && hoy <= diaN(filas[ult].hasta);
    const hoyO = { dn: hoy, iso: isoDeDia(hoy), dentro, i: dentro ? js.findIndex((j) => hoy <= diaN(j.hasta)) : -1, x: hoy - d0 + 0.5 };
    const pv = b === 'previsto' ? ' (previsto)' : '';
    const hitos = [{ k: 'inicio', txt: 'Inicio del campeonato', iso: filas[0].desde }, { k: 'final', txt: 'Final del campeonato', iso: filas[ult].hasta }]
      .concat(anios.map((y) => ({ k: 'anio', txt: 'Cambio de año', iso: `${y.y}-01-01` })))
      .concat(b ? [{ k: 'corte', txt: 'Corte del grupo B' + pv, iso: js[kb - 1].hasta }, { k: 'inib', txt: 'Inicio del grupo B' + pv, iso: js[kb].desde }] : [])
      .sort((p, q) => (p.iso < q.iso ? -1 : p.iso > q.iso ? 1 : 0));
    // la frase grande de «El plazo» y su versión corta para el centro de la esfera
    const cj = curso == null ? null : js.find((j) => j.n === curso);
    const G = { j: `${tp.jornada} ${curso}`, q: null, h: null, corto: '' };
    if (curso == null) Object.assign(G, { j: 'Campeonato terminado', h: `la última jornada acabó el ${fechaDia(filas[ult].hasta)}`, corto: 'terminado' });
    else if (cj) {
      const q = diaN(cj.hasta) - hoy;
      if (hoy < diaN(cj.desde)) Object.assign(G, { q: `empieza el ${fechaDia(cj.desde)}`, corto: `empieza el ${dm(cj.desde)}` });
      else if (q === 0) Object.assign(G, { q: 'termina hoy', corto: 'termina hoy' });
      else if (q > 0) { const dd = q === 1 ? '1 día' : `${q} días`; Object.assign(G, { q: `te ${q === 1 ? 'queda' : 'quedan'} ${dd}`, h: `hasta el ${fechaDia(cj.hasta)}`, corto: `${q === 1 ? 'queda' : 'quedan'} ${dd}` }); }
      else Object.assign(G, { q: `el plazo terminó el ${fechaDia(cj.hasta)}`, corto: 'plazo vencido' });
    }
    const hoyTxt = `Hoy: ${diaSem(hoyO.iso)} ${fechaLarga(hoyO.iso)}` + (dentro ? '' : hoy < d0 ? '. Todavía no ha empezado.' : '. Ya ha pasado la última jornada.');
    return { t, tp, js, kb, b, pv, nB: b ? js.length - kb : 0, anios, hoy: hoyO, hitos, G, curso, d0, total, hoyTxt };
  }

  // Texto para lector de pantalla: las jornadas, la que está en curso y hoy
  function lector(m, lista = true) {
    const { tp, js, b, kb } = m;
    return el('div', { class: 'solo-lector' },
      el('p', null, `Calendario de ${js.length} jornadas, del ${fechaLarga(js[0].desde)} al ${fechaLarga(js[js.length - 1].hasta)}.`),
      el('p', null, `Hoy es ${diaSem(m.hoy.iso)} ${fechaLarga(m.hoy.iso)}.`),
      el('p', null, m.curso == null ? 'El campeonato ha terminado.' : `${tp.jornada} en curso: la ${m.curso}.`),
      lista ? el('ul', null, js.map((j) => el('li', { 'aria-current': j.est === 'en juego' ? 'step' : null }, `${tp.jornada} ${j.n}, ${rangoLargo(j)}, ${j.est}${j.b ? `, la B${j.b} del grupo B${m.pv}` : ''}`))) : null,
      b ? el('p', null, `Grupo B${m.pv}: desde la jornada ${js[kb].n}, ${m.nB} jornadas, de la B1 a la B${m.nB}.`) : el('p', null, 'No hay grupo B.'));
  }
  const hitosLista = (m) => el('ul', { class: 'hitos-l' }, m.hitos.map((h) => el('li', null, el('span', null, h.txt), el('b', null, dma(h.iso)))));

  /* --- 1 · La mano: fichas de dominó tumbadas, encadenadas; doble atravesado con las ramas A y B --- */
  function opMano(m) {
    const { js, kb, b, nB } = m, n = js.length, prev = m.b === 'previsto';
    const esq = new Set(m.anios.filter((y) => !b || y.i < kb).map((y) => y.i));
    // Escritorio: la cadena avanza por filas y dobla la esquina en la ficha del cambio de año (vertical)
    const D = []; let c = 0, r = 0, dir = 1;
    for (let i = 0; i < n; i++) {
      if (b && i === kb) { D.push({ k: 'd', c, r, w: 1, h: 2 }); c += dir; }
      if (b && i >= kb) {
        const x = dir > 0 ? c : c - 1;
        D.push({ k: 't', i, c: x, r, w: 2, h: 1, rev: dir < 0 }, { k: 'b', i, c: x, r: r + 1, w: 2, h: 1, rev: dir < 0 });
        c += dir * 2; continue;
      }
      if (esq.has(i)) { D.push({ k: 't', i, c, r, w: 1, h: 2 }); r++; dir = -dir; c += dir; continue; }
      D.push({ k: 't', i, c: dir > 0 ? c : c - 1, r, w: 2, h: 1, rev: dir < 0 }); c += dir * 2;
    }
    const c0 = Math.min(...D.map((o) => o.c)), C = Math.max(...D.map((o) => o.c + o.w)) - c0;
    // Móvil: zigzag con la mitad "fin" de cada ficha sobre la mitad "inicio" de la siguiente; las ramas bajan en vertical
    const Pz = [[2, 1], [4, 1], [4, -1], [2, -1]], M = [];
    for (let i = 0; i < (b ? kb : n); i++) M.push({ k: 't', i, c: Pz[i % 4][0], r: i + 1, w: 4, h: 1, rev: Pz[i % 4][1] < 0 });
    if (b) {
      const [gc, dr] = Pz[(kb - 1) % 4], sc = dr > 0 ? gc + 1 : gc - 1;
      M.push({ k: 'd', c: sc, r: kb + 1, w: 4, h: 1 });
      for (let i = kb; i < n; i++) M.push({ k: 't', i, c: sc, r: kb + 2 + 2 * (i - kb), w: 2, h: 2 }, { k: 'b', i, c: sc + 2, r: kb + 2 + 2 * (i - kb), w: 2, h: 2 });
    }
    const mitad = (iso, anio) => { const f = partesFecha(iso); return el('span', { class: 'm' }, el('b', null, f.d), el('small', null, MES3[f.m - 1]), anio ? el('i', { class: 'an' }, f.a) : null); };
    const mapa = new Map(D.map((o) => [o.k + (o.i ?? ''), { d: o }]));
    for (const o of M) mapa.get(o.k + (o.i ?? '')).m = o;
    const fichas = [...mapa.values()].map(({ d, m: mv }) => {
      const j = js[d.i], base = d.k === 'd' ? 'doble' + (prev ? ' prev' : '') : `t ${claseEst(j)}${d.k === 'b' && prev ? ' prev' : ''}`;
      const cls = [base, d.h > 1 && 'dv', mv.h > 1 && 'mv', d.rev && 'drev', mv.rev && 'mrev'].filter(Boolean).join(' ');
      const e = d.k === 'd'
        ? el('div', { class: cls }, el('span', { class: 'm' }, el('b', null, 'A')), el('span', { class: 'm' }, el('b', null, 'B'), prev ? el('small', null, 'previsto') : null))
        : el('div', { class: cls }, mitad(j.desde, esq.has(j.i) || partesFecha(j.desde).a !== partesFecha(j.hasta).a), el('i', { class: 'pin' }, d.k === 'b' ? 'B' + j.b : j.n),
          mitad(j.hasta, esq.has(j.i) || partesFecha(j.desde).a !== partesFecha(j.hasta).a), d.k === 't' && m.hoy.i === j.i ? el('em', { class: 'hoy' }, 'hoy') : null);
      return fijar(e, { dc: d.c - c0 + 1, dr: d.r + 1, dw: d.w, dh: d.h, mc: mv.c, mr: mv.r, mw: mv.w, mh: mv.h });
    });
    return el('div', { class: 'mano-caja' }, fijar(el('div', { class: 'mano', 'aria-hidden': 'true' }, fichas), { cd: C }));
  }

  /* --- 2 · El plazo: la frase grande y una tira fina proporcional a los días --- */
  function opPlazo(m) {
    const T = m.total, X = (v) => v / T * 100, g = m.G, prev = m.b === 'previsto', ult = m.js[m.js.length - 1];
    const seg = (j, txt) => fijar(el('span', { class: 'sg ' + claseEst(j) }, el('b', null, txt)), { x: X(j.x), w: X(j.dias) });
    const tira = el('div', { class: 'tira' }, m.js.map((j) => seg(j, j.n)), m.anios.map((y) => fijar(el('i', { class: 'corte' }), { x: X(y.x) })), m.hoy.dentro ? fijar(el('i', { class: 'aguja' }), { x: X(m.hoy.x) }) : null);
    const rot = el('div', { class: 'rotulos' },
      m.anios.flatMap((y) => [fijar(el('span', { class: 'an izq' }, y.y - 1), { x: X(y.x) }), fijar(el('span', { class: 'an der' }, y.y), { x: X(y.x) })]),
      m.hoy.dentro ? fijar(el('span', { class: 'hy' }, 'hoy'), { x: Math.min(94, Math.max(6, X(m.hoy.x))) }) : null);
    const tiraB = m.b ? el('div', { class: 'tira b' + (prev ? ' prev' : '') }, m.js.filter((j) => j.b).map((j) => seg(j, 'B' + j.b))) : null;
    return el('div', { class: 'plazo-placa' },
      el('p', { class: 'grande' }, el('span', { class: 'gj' }, g.j), g.q ? [el('span', { class: 'sep' }, ' · '), el('span', { class: 'gq' }, g.q)] : null, g.h ? [el('span', { class: 'sep' }, ' · '), el('span', { class: 'gh' }, g.h)] : null),
      el('div', { class: 'tira-caja', 'aria-hidden': 'true' }, rot, tira, tiraB),
      m.b ? el('p', { class: 'cap-b' }, `Grupo B${prev ? ' (previsto)' : ''}: de la B1 a la B${m.nB}, del ${dm(m.js[m.kb].desde)} al ${dm(ult.hasta)}`) : null);
  }

  /* --- 3 · La esfera: la temporada en un círculo, gajos proporcionales, aguja de hoy, anillo interior para el B --- */
  function opEsfera(m) {
    const T = m.total, cx = 230, f1 = (v) => v.toFixed(1), prev = m.b === 'previsto';
    const ang = (d) => d / T * 360;
    const pol = (r, deg) => { const q = deg * Math.PI / 180; return [cx + r * Math.sin(q), cx - r * Math.cos(q)]; };
    const sector = (r0, r1, a0, a1) => {
      const [x0, y0] = pol(r1, a0), [x1, y1] = pol(r1, a1), [x2, y2] = pol(r0, a1), [x3, y3] = pol(r0, a0), g = a1 - a0 > 180 ? 1 : 0;
      return `M${f1(x0)} ${f1(y0)}A${r1} ${r1} 0 ${g} 1 ${f1(x1)} ${f1(y1)}L${f1(x2)} ${f1(y2)}A${r0} ${r0} 0 ${g} 0 ${f1(x3)} ${f1(y3)}Z`;
    };
    const rotulo = (cls, r, deg, txt, anc) => { const [x, y] = pol(r, deg), s = Math.sin(deg * Math.PI / 180); return svgEl('text', { class: cls, x: f1(x), y: f1(y), 'text-anchor': anc || (s > 0.3 ? 'start' : s < -0.3 ? 'end' : 'middle'), 'dominant-baseline': 'central' }, txt); };
    const lin = (cls, r0, r1, deg) => { const [x0, y0] = pol(r0, deg), [x1, y1] = pol(r1, deg); return svgEl('line', { class: cls, x1: f1(x0), y1: f1(y0), x2: f1(x1), y2: f1(y1) }); };
    const semanas = [];
    for (let d = 0; d < T; d++) if ((m.d0 + d + 3) % 7 === 0) semanas.push(lin('sem', 176, 181, ang(d)));
    const gajo = (j, r0, r1, txt, rt, extra) => {
      const a0 = ang(j.x) + 0.5, a1 = ang(j.x + j.dias) - 0.5;
      return [svgEl('path', { class: `g ${claseEst(j)}${extra || ''}`, d: sector(r0, r1, a0, a1) }), svgEl('text', { class: `nv ${claseEst(j)}`, x: f1(pol(rt, (a0 + a1) / 2)[0]), y: f1(pol(rt, (a0 + a1) / 2)[1]), 'text-anchor': 'middle', 'dominant-baseline': 'central' }, txt)];
    };
    const ult = m.js[m.js.length - 1];
    const ah = ang(m.hoy.x), [hx, hy] = pol(172, ah);
    const dib = svgEl('svg', { class: 'esfera', viewBox: '0 0 460 460', 'aria-hidden': 'true', focusable: 'false' },
      semanas, m.js.map((j) => gajo(j, 128, 172, j.n, 150)), m.js.filter((j) => j.b).map((j) => gajo(j, 98, 120, 'B' + j.b, 109, prev ? ' prev' : '')),
      m.anios.map((y) => [lin('cambio', m.b ? 92 : 124, 186, ang(y.x)), rotulo('an', 198, ang(y.x) - 4.5, y.y - 1), rotulo('an nuevo', 198, ang(y.x) + 4.5, y.y)]),
      lin('ini', 172, 188, 0), rotulo('an', 198, 2, dm(m.js[0].desde), 'start'), rotulo('an', 198, -2, dm(ult.hasta), 'end'),
      m.hoy.dentro ? [svgEl('line', { class: 'aguja', x1: f1(pol(92, ah)[0]), y1: f1(pol(92, ah)[1]), x2: f1(hx), y2: f1(hy) }), svgEl('circle', { class: 'punta', cx: f1(hx), cy: f1(hy), r: 6 }), rotulo('hy', 200, ah, 'hoy')] : null,
      svgEl('text', { class: 'c1', x: cx, y: 188, 'text-anchor': 'middle' }, m.G.j.startsWith('Campeonato') ? 'Campeonato' : m.tp.jornada),
      svgEl('text', { class: 'c2', x: cx, y: 238, 'text-anchor': 'middle' }, m.curso == null ? '' : m.curso),
      svgEl('text', { class: 'c3', x: cx, y: 270, 'text-anchor': 'middle' }, m.G.corto));
    const leyenda = el('ol', { class: 'leyenda', 'aria-label': `${m.tp.jornada}s del calendario` }, m.js.map((j) => el('li', { class: claseEst(j), 'aria-current': j.est === 'en juego' ? 'step' : null },
      el('b', { class: 'nj' }, j.n), el('span', { class: 'rg' }, `${dma(j.desde)} – ${dma(j.hasta)}`), el('em', null, j.est), j.b ? el('span', { class: 'etq' + (prev ? ' prev' : '') }, `B${j.b}${prev ? ' previsto' : ''}`) : null)));
    return el('div', { class: 'esfera-caja' }, dib, leyenda);
  }

  /* --- 4 · El acta: tabla con bordes, como las ACTAS del Excel; el B va en una segunda acta --- */
  function opActa(m) {
    const t = m.t, tp = m.tp, prev = m.b === 'previsto', casilla = (x) => el('td', { class: 'cas' }, el('span', { class: 'casilla', 'aria-hidden': 'true' }, x ? 'X' : ''), el('span', { class: 'solo-lector' }, x ? 'sí' : 'no'));
    const fch = (iso) => [dm(iso), el('span', { class: 'y' }, '/' + partesFecha(iso).a)]; // el año se oculta en pantallas estrechas
    const hito = (txt, iso, nota) => el('tr', { class: 'hito-fila' }, el('td', { colspan: 5 }, el('b', null, txt), ' ', dma(iso), nota ? ` · ${nota}` : ''));
    const fila = (j, rot) => el('tr', { class: claseEst(j), 'data-jornada': rot, 'aria-current': j.est === 'en juego' ? 'step' : null },
      el('th', { scope: 'row' }, rot, j.est === 'en juego' ? el('small', null, m.hoy.i === j.i ? 'en curso · hoy' : 'en curso') : null, j.b && prev ? el('small', null, 'previsto') : null),
      el('td', null, fch(j.desde)), el('td', null, fch(j.hasta)), el('td', { class: 'num' }, j.dias), casilla(j.est === 'jugada'));
    const tabla = (cls, cab, cuerpo, pie) => el('table', { class: 'acta ' + cls }, el('thead', null, cab.map((c, i) => el('tr', null, el('th', { colspan: 5, class: i ? 'sub' : 'tit' }, c))),
      el('tr', null, ['Jornada', 'Desde', 'Hasta', 'Días', 'Cerrada'].map((h) => el('th', { scope: 'col' }, h)))), el('tbody', null, cuerpo), pie);
    const A = [], B = [];
    A.push(hito('Inicio del campeonato', m.js[0].desde));
    m.js.forEach((j, i) => {
      const yl = m.anios.find((q) => q.i === i);
      A.push(fila(j, j.n));
      if (yl) A.push(hito('Cambio de año', `${yl.y}-01-01`, yl.cruza ? `dentro de la jornada ${j.n}` : null));
      if (m.b && i === m.kb - 1) A.push(hito('Corte del grupo B' + m.pv, j.hasta));
    });
    if (m.b) { B.push(hito('Inicio del grupo B' + m.pv, m.js[m.kb].desde)); m.js.filter((j) => j.b).forEach((j) => B.push(fila(j, 'B' + j.b))); }
    const ult = m.js[m.js.length - 1];
    const cab = (extra) => [t.nombre, `${extra} · temporada ${t.temporada || ''}${t.organizador ? ' · ' + t.organizador : ''}`];
    return el('div', { class: 'actas', 'aria-label': 'Calendario en forma de acta' },
      tabla('a', cab('Acta de calendario' + (m.b ? ' · grupo A' : '')), A, el('tfoot', null, hito('Final del campeonato', ult.hasta))),
      m.b ? tabla('b' + (prev ? ' prev' : ''), cab('Acta de calendario · grupo B' + (prev ? ' · previsto' : '')), B) : null);
  }

  /* --- 5 · La regla horizontal: cada jornada tan ancha como dura; en móvil se desplaza dentro de su caja --- */
  function opRegla(m) {
    const T = m.total, X = (v) => v / T * 100, prev = m.b === 'previsto';
    const bl = (j, rot) => fijar(el('span', { class: 'bl ' + claseEst(j) }, el('b', null, rot), el('small', null, dm(j.desde)), el('small', null, dm(j.hasta))), { x: X(j.x), w: X(j.dias) });
    const marcas = [];
    for (let d = 0; d < T; d++) if ((m.d0 + d + 3) % 7 === 0) marcas.push(fijar(el('i', { class: 'sem' }), { x: X(d) }));
    const f0 = partesFecha(m.js[0].desde);
    marcas.push(fijar(el('i', { class: 'mes' }, el('span', null, MES3[f0.m - 1])), { x: 0 }));
    for (let y = f0.a, mo = f0.m + 1; ; mo++) {
      if (mo > 12) { mo = 1; y++; }
      const d = Date.UTC(y, mo - 1, 1) / 864e5 - m.d0;
      if (d >= T) break;
      marcas.push(fijar(el('i', { class: 'mes' }, el('span', null, MES3[mo - 1])), { x: X(d) }));
    }
    const regla = el('div', { class: 'regla', 'aria-hidden': 'true' },
      el('div', { class: 'r-anios' }, m.anios.flatMap((y) => [fijar(el('span', { class: 'an izq' }, y.y - 1), { x: X(y.x) }), fijar(el('span', { class: 'an der' }, y.y), { x: X(y.x) })]),
        m.hoy.dentro ? fijar(el('span', { class: 'hy' }, 'hoy'), { x: X(m.hoy.x) }) : null),
      el('div', { class: 'r-marcas' }, marcas),
      el('div', { class: 'r-a' }, m.js.map((j) => bl(j, j.n))),
      m.b ? el('div', { class: 'r-b' + (prev ? ' prev' : '') }, el('span', { class: 'lb' }, 'Grupo B' + (prev ? ' · previsto' : '')),
        fijar(el('span', { class: 'lc' }, `corte A/B ${dm(m.js[m.kb - 1].hasta)}`), { x: X(m.js[m.kb].x) }), m.js.filter((j) => j.b).map((j) => bl(j, 'B' + j.b))) : null,
      m.anios.map((y) => fijar(el('i', { class: 'corte' }), { x: X(y.x) })), m.hoy.dentro ? fijar(el('i', { class: 'aguja' }), { x: X(m.hoy.x) }) : null);
    fijar(regla, { tot: T });
    const caja = el('div', { class: 'regla-caja', role: 'region', tabindex: '0', 'aria-label': 'Regla de la temporada. Se desplaza en horizontal. El texto equivalente está debajo.' }, regla);
    requestAnimationFrame(() => { if (m.hoy.dentro) caja.scrollLeft = Math.max(0, X(m.hoy.x) / 100 * regla.offsetWidth - caja.clientWidth * 0.3); });
    return caja;
  }

  function calLinea(a, filas) {
    const m = modeloLinea(a, filas), op = E.op;
    const sel = el('div', { class: 'opciones', role: 'group', 'aria-label': 'Opción de línea de tiempo' }, el('span', { class: 'rot' }, 'Opción'),
      NOM_OP.map((nom, i) => el('button', { type: 'button', 'aria-pressed': String(op === i + 1), title: nom, onclick: () => irA({ op: i + 1 }, true) }, i + 1)),
      el('span', { class: 'nombre-op' }, NOM_OP[op - 1]));
    const cuerpo = [opMano, opPlazo, opEsfera, opActa, opRegla][op - 1](m);
    return el('section', { class: `linea-tiempo op${op}` }, el('h2', null, 'Línea de tiempo'), sel, cuerpo,
      el('p', { class: 'hoy-nota' }, m.hoyTxt), op === 4 ? null : hitosLista(m), lector(m, op !== 3 && op !== 4));
  }

  // Provisional: Calendario (lista) y Línea de tiempo (cinco opciones, &op=1..5) conviven en dos pestañas hasta que se elija una.
  function pintarFolleto(cont, linea) {
    const filas = filasCalendario(E.actual);
    poner(cont, !filas.length ? el('p', { class: 'vacio' }, 'Este campeonato no tiene calendario publicado.') : linea ? calLinea(E.actual, filas) : calLista(E.actual, filas));
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
    else pintarFolleto(cont, E.ver === 'linea');
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
