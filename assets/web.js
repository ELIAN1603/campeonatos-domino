/* tu mesa · web pública. Lee los JSON del contrato (datos/…) y pinta todo como texto. */
(function () {
  'use strict';

  /* ---------- utilidades ---------- */
  const $ = (s, r) => (r || document).querySelector(s);
  function el(tag, attrs, ...kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? '' : v);
    }
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
  function instante(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return '';
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  const signo = (n) => (n == null ? '' : n > 0 ? '+' + n : n < 0 ? '−' + Math.abs(n) : '0');

  const TIPOS = {
    sp: { nombre: 'Súper-Prestigio', jornada: 'Jornada', unidad: 'pareja', unidades: 'parejas', gan: 'Encuentros ganados' },
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
    const f = partesFecha(t.fecha);
    const tp = tipoDe(t.tipo);
    const partes = [`${tp.jornada} ${t.jornada_actual} de ${t.n_jornadas}`, `${t.n_participantes} ${tp.unidades}`];
    if (t.estado === 'terminado' && t.ganador) partes.push(`ganó ${t.ganador.corto}`);
    return el('li', null, el('a', { class: 'tarjeta', href: url('torneo.html', { t: t.id }) },
      el('div', { class: 'fecha-ficha', 'aria-hidden': 'true' }, el('span', null, f ? MESES[f.m - 1].slice(0, 3) : '?'), el('b', null, f ? f.d : '')),
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
  const PESTANAS = [['clasificacion', 'Clasificación'], ['emparejamientos', 'Emparejamientos'], ['resultados', 'Resultados'], ['normativa', 'Normativa']];
  const E = { id: null, actual: null, cache: new Map(), ver: 'clasificacion', j: null, g: 'A', p: null, q: '' };

  function leerUrl() {
    const x = new URLSearchParams(location.search);
    E.id = x.get('t');
    E.ver = PESTANAS.some((t) => t[0] === x.get('ver')) ? x.get('ver') : 'clasificacion';
    E.j = +x.get('j') || null;
    E.g = x.get('g') === 'B' ? 'B' : 'A';
    E.p = +x.get('p') || null;
  }
  function irA(cambios, empujar) {
    Object.assign(E, cambios);
    const nueva = url('torneo.html', { t: E.id, ver: E.ver === 'clasificacion' ? '' : E.ver, j: E.j, g: E.g === 'B' ? 'B' : '', p: E.p });
    if (empujar) history.pushState(null, '', nueva); else history.replaceState(null, '', nueva);
    pintar();
  }

  const jornadasDe = (a) => (a.jornadas && a.jornadas.length ? a.jornadas : [{ numero: a.jornada.numero, completa: a.jornada.completa, publicado: a.publicado }]).slice().sort((x, y) => x.numero - y.numero);
  const ultimaCompleta = (a) => { const c = jornadasDe(a).filter((j) => j.completa); return c.length ? c[c.length - 1].numero : null; };

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
    const datos = [fechaLarga(t.fecha), t.temporada && 'Temporada ' + t.temporada, t.lugar, `${t.n_participantes} ${tp.unidades}`, `${tp.jornada} ${a.jornada.numero} de ${t.n_jornadas}`].filter(Boolean);
    $('#cab').replaceChildren(
      el('div', null, el('span', { class: 'etiqueta ' + (t.estado === 'en_juego' ? 'vivo' : t.estado === 'terminado' ? 'fin' : '') }, ESTADOS[t.estado] || t.estado), el('span', { class: 'etiqueta' }, tp.nombre)),
      el('h1', null, t.nombre),
      el('p', { class: 'linea' }, datos.join(' · ')),
      el('p', { class: 'sello' }, `Datos publicados el ${instante(a.publicado)}.` + (t.estado === 'en_juego' ? ' Esta página se actualiza sola.' : '')));
  }

  function pestanas() {
    $('#pestanas').replaceChildren(...PESTANAS.map(([k, txt]) => el('a', {
      href: url('torneo.html', { t: E.id, ver: k === 'clasificacion' ? '' : k, p: E.p }), 'aria-current': E.ver === k ? 'page' : null,
      onclick: (ev) => { if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.button) return; ev.preventDefault(); irA({ ver: k, j: null }, true); },
    }, txt)));
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
    if (!ult) {
      cont.replaceChildren(el('p', { class: 'vacio' }, `La clasificación aparecerá cuando se cierre la ${tp.jornada.toLowerCase()} 1.` + (a.jornada.numero === 1 ? ' Mientras tanto, mira los emparejamientos y los resultados que van llegando.' : '')));
      return;
    }
    const completas = jornadasDe(a).filter((j) => j.completa);
    const n = completas.some((j) => j.numero === E.j) ? E.j : ult;
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
          el('span', { class: 'nom' }, p.corto, p.ret ? el('span', { class: 'etq alerta' }, 'Retirada') : null),
          el('span', { class: 'sub' }, sub2),
          sub ? el('span', { class: 'sub' }, `Cambio en la ${tp.jornada.toLowerCase()} ${sub.desde}: entra ${sub.entra_nombre} ${sub.entra_apellido1} por ${sub.sale_nombre} ${sub.sale_apellido1}`) : null,
          r.desempate ? el('span', { class: 'sub' }, 'Desempate: ' + r.desempate) : null),
        cols.map(([k, , , x]) => el('td', { class: (x ? 'x ' : '') + (k === 'gan' ? 'gan' : '') }, k === 'dp' || k === 'dt' ? signo(r[k]) : r[k])));
    });
    const tabla = el('table', { class: 'clasi' },
      el('caption', { class: 'solo-lector' }, `Clasificación del grupo ${g} tras la ${tp.jornada.toLowerCase()} ${n}`),
      el('thead', null, el('tr', null, el('th', { scope: 'col' }, '#'), el('th', { scope: 'col', class: 'izq' }, tp.unidad[0].toUpperCase() + tp.unidad.slice(1)),
        cols.map(([, t, ab, x]) => el('th', { scope: 'col', class: x ? 'x' : '' }, el('abbr', { title: ab }, t))))),
      el('tbody', null, cuerpo));
    const leyenda = cols.map(([, t, ab]) => `${t}: ${ab.toLowerCase()}`).join(' · ');

    const completasUltima = n === ult;
    poner(cont,
      selectorJornada(completas, n, tp, (x) => irA({ j: x }, false)),
      conB ? el('div', { class: 'grupos', role: 'group', 'aria-label': 'Grupo' }, ['A', 'B'].map((x) => el('button', { type: 'button', 'aria-pressed': String(g === x), onclick: () => irA({ g: x }, false) }, 'Grupo ' + x))) : null,
      !a.jornada.completa && completasUltima ? el('p', { class: 'nota caja' }, `Esta clasificación es la de la ${tp.jornada.toLowerCase()} ${ult}, la última cerrada. La ${tp.jornada.toLowerCase()} ${a.jornada.numero} está en juego: sus resultados salen en la pestaña Resultados y la clasificación cambiará cuando se cierre.`) : null,
      filas.length ? el('div', { class: 'tabla-caja' }, tabla) : el('p', { class: 'vacio' }, 'Este grupo todavía no tiene clasificación.'),
      el('p', { class: 'leyenda' }, leyenda),
      a.torneo.criterios && a.torneo.criterios.length ? el('div', { class: 'criterios' }, el('b', null, 'Cómo se ordena'), el('ol', null, a.torneo.criterios.map((c) => el('li', null, c)))) : null);
    const f = E.p && $('#fila-' + E.p);
    if (f && !E.yaDesplazado) { E.yaDesplazado = true; f.scrollIntoView({ block: 'center' }); }
  }

  /* ----- mesas ----- */
  function ladoEl(ids, byId, gana) {
    return el('div', { class: 'lado' + (gana ? ' gana' : '') }, ids.map((id) => {
      const p = byId.get(id);
      return el('div', null, el('span', { class: 'n' }, id), el('span', { class: 'nom' }, p ? p.corto : '?'),
        p && p.ret ? el('span', { class: 'etq alerta' }, 'Retirada') : null,
        p && p.j2_nombre ? el('small', null, nombreLargo(p)) : null);
    }));
  }
  function qBusqueda(m, byId) {
    const ids = [...m.izq, ...m.dcha];
    return norm(ids.map((i) => { const p = byId.get(i); return i + ' ' + (p ? nombreLargo(p) + ' ' + p.corto : ''); }).join(' ') + ' mesa ' + (m.mesa || ''));
  }
  function resultado(m, tp, sp, meta) {
    const tiene = m.p_izq != null;
    const marc = tiene ? (sp ? `${m.p_izq}-${m.p_dcha}` : `${m.t_izq}-${m.t_dcha}`) : '';
    const tant = tiene && sp ? `${m.t_izq}-${m.t_dcha} tantos` : '';
    switch (m.estado) {
      case 'pendiente': return el('div', { class: 'res' }, el('span', { class: 'por' }, 'por jugar'));
      case 'jugada': return el('div', { class: 'res' }, el('b', null, marc), tant && el('small', null, tant));
      case 'incomparecencia': return el('div', { class: 'res' }, el('b', null, marc), el('small', null, 'incomparecencia'));
      case 'retirada': return el('div', { class: 'res' }, el('b', null, marc), el('small', null, 'rival retirado'));
      case 'descanso': return el('div', { class: 'res' }, el('b', null, marc), el('small', null, 'descanso'));
      case 'nd': return el('div', { class: 'res' }, el('b', null, 'ND'), el('small', null, 'no disputado'));
      case 'ausencia': return el('div', { class: 'res' }, el('small', null, 'falta alguien en la mesa'));
      case 'no_cuenta': return el('div', { class: 'res' }, el('small', null, 'no cuenta'));
      default: return el('div', { class: 'res' }, el('small', null, m.estado));
    }
  }
  function filaMesa(m, byId, a, modo) {
    const sp = a.torneo.tipo === 'sp', tp = tipoDe(a.torneo.tipo);
    const gIzq = m.p_izq != null && m.p_izq > m.p_dcha, gDcha = m.p_izq != null && m.p_dcha > m.p_izq;
    const mia = E.p && [...m.izq, ...m.dcha].includes(E.p);
    const desc = m.estado === 'descanso';
    const aus = m.estado === 'ausencia' && m.ausentes.length ? el('small', { class: 'sub' }, 'Falta: ' + m.ausentes.map((i) => (byId.get(i) || {}).corto || i).join(', ')) : null;
    return el('li', { class: 'mesa' + (mia ? ' resalte' : ''), 'data-q': qBusqueda(m, byId), id: mia ? 'mesa-mia' : null },
      desc ? el('div', { class: 'ficha-mesa sin' }, el('b', null, 'descansa')) : el('div', { class: 'ficha-mesa' }, el('i', null, 'mesa'), el('b', null, m.mesa)),
      el('div', { class: 'lados' }, ladoEl(m.izq, byId, gIzq), desc ? null : el('div', { class: 'contra' }, 'contra'), desc ? null : ladoEl(m.dcha, byId, gDcha), aus),
      modo === 'emp' ? el('div', { class: 'res' }, m.estado === 'pendiente' ? el('span', { class: 'por' }, 'por jugar') : desc ? el('span', { class: 'por' }, 'descansa') : el('span', { class: 'hecho' }, '✓ jugada')) : resultado(m, tp, sp));
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

  async function pintarMesas(cont, modo) {
    const a = E.actual, tp = tipoDe(a.torneo.tipo);
    const lista = jornadasDe(a);
    const n = lista.some((j) => j.numero === E.j) ? E.j : a.jornada.numero;
    let jd;
    try { jd = await datosJornada(n); } catch (e) { cont.replaceChildren(el('p', { class: 'aviso alerta' }, 'No se ha podido cargar esa ' + tp.jornada.toLowerCase() + '. Prueba otra vez dentro de un minuto.')); return; }
    if (E.ver !== modo_ver(modo)) return;
    const byId = new Map(jd.participantes.map((p) => [p.id, p]));
    const ms = jd.emparejamientos;
    const grupos = [...new Set(ms.map((m) => m.grupo))];
    const bloques = [];
    const secciones = (filtroFn, vacio) => {
      const out = [];
      for (const g of grupos) {
        const del = ms.filter((m) => m.grupo === g && filtroFn(m));
        if (!del.length) continue;
        if (grupos.length > 1) out.push(el('h2', { class: 'grupo-tit' }, 'Grupo ' + g));
        out.push(el('ul', { class: 'mesas' }, del.map((m) => filaMesa(m, byId, a, modo))));
      }
      return out.length ? out : [el('p', { class: 'vacio' }, vacio)];
    };
    const pend = ms.filter((m) => m.estado === 'pendiente').length;
    const cabecera = [selectorJornada(lista, n, tp, (x) => irA({ j: x }, false)), filtro()];
    if (modo === 'emp') {
      if (jd.jornada.sorteo && jd.jornada.sin_sortear) bloques.push(el('p', { class: 'nota caja' }, 'El sorteo todavía no se ha hecho: este orden es provisional.'));
      else if (jd.jornada.emparejamiento === 'provisional' && !jd.jornada.completa) bloques.push(el('p', { class: 'nota caja' }, 'Estos emparejamientos todavía no están fijados y pueden cambiar.'));
      bloques.push(...secciones(() => true, 'Todavía no hay emparejamientos publicados.'));
    } else {
      const hechas = ms.filter((m) => m.estado !== 'pendiente' && m.estado !== 'descanso').length;
      bloques.push(el('p', { class: 'nota' }, pend ? `Hay ${hechas} ${hechas === 1 ? 'mesa con resultado' : 'mesas con resultado'} y faltan ${pend}. Los resultados salen según llegan; la clasificación no cambia hasta cerrar la ${tp.jornada.toLowerCase()}.` : 'Todas las mesas tienen resultado.'));
      bloques.push(...secciones((m) => m.estado !== 'pendiente', 'Todavía no hay ningún resultado en esta ' + tp.jornada.toLowerCase() + '.'));
      if (pend) {
        bloques.push(el('h2', { class: 'grupo-tit' }, 'Por jugar'));
        bloques.push(el('ul', { class: 'mesas' }, ms.filter((m) => m.estado === 'pendiente').map((m) => filaMesa(m, byId, a, 'emp'))));
      }
    }
    poner(cont, ...cabecera, ...bloques, el('p', { id: 'sin-coincidencias', class: 'vacio', hidden: true }, 'Nadie coincide con esa búsqueda en esta ' + tp.jornada.toLowerCase() + '.'));
    aplicarFiltro();
    const m = !E.yaDesplazado && $('#mesa-mia'); if (m) { E.yaDesplazado = true; m.scrollIntoView({ block: 'center' }); }
  }
  const modo_ver = (m) => (m === 'emp' ? 'emparejamientos' : 'resultados');

  /* ----- normativa ----- */
  function pintarNormativa(cont) {
    const a = E.actual, t = a.torneo, tp = tipoDe(t.tipo), j = a.jornada;
    const jn = tp.jornada.toLowerCase();
    const sp = t.tipo === 'sp';
    const bloques = [];
    bloques.push(t.normativa_url
      ? el('p', null, el('a', { class: 'boton', href: t.normativa_url, rel: 'noopener noreferrer', target: '_blank' }, 'Abrir la normativa'))
      : el('p', { class: 'vacio' }, 'La mesa de control todavía no ha enlazado la normativa de este campeonato.'));
    const crit = (t.criterios || []);
    bloques.push(el('div', { class: 'texto' },
      el('h2', null, 'Cómo se ordena la clasificación'), crit.length ? el('ol', null, crit.map((c) => el('li', null, c))) : el('p', null, 'Sin criterios publicados.'),
      sp ? el('p', null, 'El criterio informático es el último desempate. Tras la 1.ª jornada gana la pareja que jugó en la mesa de número más bajo; en las siguientes, la que iba delante en la clasificación anterior.') : null,
      el('h2', null, 'Qué significan las marcas de las mesas'),
      el('ul', null,
        el('li', null, el('b', null, 'Descanso. '), `Si el número es impar, una ${tp.unidad} no tiene rival. Se le anotan ${sp ? '2-0 y' : ''} ${t.puntos_ausencia}-0.`.replace('  ', ' ')),
        el('li', null, el('b', null, 'Incomparecencia. '), `Gana quien se presenta: ${sp ? '2-0 y ' : ''}${t.puntos_ausencia}-0.`),
        el('li', null, el('b', null, 'Retirada. '), `Lo jugado antes se conserva. Mientras siga emparejada, su rival gana ${sp ? '2-0 y ' : ''}${t.puntos_ausencia}-0.`),
        sp ? el('li', null, el('b', null, 'No disputado (ND). '), 'Las dos parejas pierden el encuentro. A cada una se le anota 0-2 y 0-300, cuenta como jugado y nadie gana.') : null,
        t.tipo === 'individual' ? el('li', null, el('b', null, 'Falta alguien. '), `Los presentes ganan ${t.puntos_ausencia}-0 y quien falta pierde 0-${t.puntos_ausencia}.`) : null),
      t.hay_b ? [el('h2', null, 'Grupo B'), el('p', null, `Desde la ${jn} ${t.jornada_b} hay dos grupos. Pasan al B las últimas ${t.n_b} ${tp.unidades} de la clasificación. El B empieza de cero y tiene su propio sorteo.`)] : null,
      sp ? [el('h2', null, 'Sustituciones'), el('p', null, 'Si un jugador cambia, la pareja conserva su número y sus puntos. El nombre nuevo se ve desde la jornada del cambio; las jornadas anteriores siguen con el nombre de entonces.')] : null,
      j.plazo_desde && j.plazo_hasta ? [el('h2', null, `Plazo de la ${jn} ${j.numero}`), el('p', null, `Del ${fechaLarga(j.plazo_desde)} al ${fechaLarga(j.plazo_hasta)}.`)] : null,
      el('h2', null, 'Contacto'), el('p', null, `${t.contacto || 'Jesús Eduardo Elián C.'}, mesa de control.`)));
    poner(cont, ...bloques);
  }

  /* ----- orquestación ----- */
  let pintando = 0;
  async function pintar() {
    const marca = ++pintando;
    cabecera(); pestanas();
    const cont = $('#contenido');
    if (marca !== pintando) return;
    if (E.ver === 'clasificacion') await pintarClasificacion(cont);
    else if (E.ver === 'emparejamientos') await pintarMesas(cont, 'emp');
    else if (E.ver === 'resultados') await pintarMesas(cont, 'res');
    else pintarNormativa(cont);
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

  window.TuMesa = { el, poner, instante };

  document.addEventListener('DOMContentLoaded', () => {
    bandaPrueba();
    const pagina = document.body.dataset.pagina;
    if (pagina === 'portada') portada();
    else if (pagina === 'torneo') torneo();
    document.querySelectorAll('a[data-conservar]').forEach((x) => { if (ES_PRUEBA) x.href = url(x.getAttribute('href')); });
  });
})();
