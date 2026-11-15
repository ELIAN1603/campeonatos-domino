/* publicar.html: lee la hoja WEB del Excel, valida y escribe los JSON en el repositorio. */
(function () {
  'use strict';
  const { el, poner } = window.TuMesa;
  const C = window.Contrato;
  const REPO = { dueno: 'ELIAN1603', nombre: 'campeonatos-domino', rama: 'main' };
  const CLAVE = 'tumesa.token';
  const API = 'https://api.github.com'; // el único sitio al que viaja el token
  // Correo noreply de la cuenta (id de /users/ELIAN1603): así los commits no enseñan el correo real.
  const AUTOR = { name: 'Mesa de control', email: '356692983+ELIAN1603@users.noreply.github.com' };
  // Lo único que esta página puede escribir en el repositorio.
  const ID_OK = /^[a-z0-9][a-z0-9-]{2,59}$/;
  const RUTA_OK = /^datos\/(indice\.json|[a-z0-9][a-z0-9-]{2,59}\/(jornada_\d{2}|actual)\.json)$/;
  // Límites al leer el Excel (el real pesa unos 7 MB; la hoja WEB cabe en 210 filas y 53 columnas).
  const MAX_BYTES = 25 * 1024 * 1024, MAX_FILAS = 300, MAX_COLUMNAS = 80;
  const $ = (s) => document.querySelector(s);
  const E = { token: null, json: null, raw: null, pub: null, vals: [], confirmadas: new Set() };

  const guardado = {
    leer() { try { return localStorage.getItem(CLAVE); } catch (e) { return null; } },
    poner(v) { try { localStorage.setItem(CLAVE, v); return true; } catch (e) { return false; } },
    borrar() { try { localStorage.removeItem(CLAVE); } catch (e) { /* nada */ } },
  };

  /* ---------- GitHub ---------- */
  class ErrorGH extends Error { constructor(estado, msg) { super(msg); this.estado = estado; } }
  async function gh(ruta, opciones) {
    if (!E.token) throw new ErrorGH(401, 'Falta el token de GitHub. Pégalo en el paso 1.');
    const destino = API + ruta;
    let ok = false;
    try { ok = new URL(destino).origin === API && ruta.startsWith('/repos/' + REPO.dueno + '/' + REPO.nombre); } catch (e) { /* ok sigue en false */ }
    if (!ok) throw new ErrorGH(0, 'Dirección no permitida: el token solo se envía a GitHub.');
    let r;
    try {
      r = await fetch(destino, {
        ...opciones, redirect: 'error', credentials: 'omit', referrerPolicy: 'no-referrer', headers: { Authorization: 'Bearer ' + E.token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', ...(opciones && opciones.headers) },
      });
    } catch (e) { throw new ErrorGH(0, 'No hay conexión con GitHub. Comprueba que el ordenador tiene internet y prueba otra vez.'); }
    if (r.ok) return r.status === 204 ? null : r.json();
    if (r.status === 401) {
      guardado.borrar(); E.token = null;
      throw new ErrorGH(401, 'GitHub no acepta el token: es incorrecto o ha caducado. Lo he borrado de este navegador. Crea uno nuevo, pégalo en el paso 1 y vuelve a intentarlo.');
    }
    if (r.status === 403 || r.status === 404) throw new ErrorGH(r.status, 'Con este token no se puede escribir en el repositorio campeonatos-domino. Comprueba que el token es solo para ese repositorio y que tiene permiso de «Contents: Read and write».');
    if (r.status === 409 || r.status === 422) throw new ErrorGH(r.status, 'Alguien ha publicado a la vez y el archivo ha cambiado. Vuelve a elegir el Excel y publica otra vez.');
    throw new ErrorGH(r.status, `GitHub ha respondido con un error (${r.status}). Prueba otra vez dentro de un minuto.`);
  }
  const rutaApi = (ruta) => `/repos/${REPO.dueno}/${REPO.nombre}/contents/${ruta}`;
  function deBase64(b64) { const bin = atob(b64.replace(/\s/g, '')); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new TextDecoder().decode(u); }
  function aBase64(txt) { const u = new TextEncoder().encode(txt); let bin = ''; for (let i = 0; i < u.length; i += 0x8000) bin += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(bin); }
  async function traer(ruta) {
    if (!RUTA_OK.test(ruta)) throw new ErrorGH(0, 'Ruta no permitida: ' + ruta);
    try {
      const r = await gh(rutaApi(ruta) + '?ref=' + REPO.rama);
      return { sha: r.sha, json: JSON.parse(deBase64(r.content)) };
    } catch (e) { if (e.estado === 404) return null; throw e; }
  }
  async function escribir(ruta, texto, sha, mensaje) {
    if (!RUTA_OK.test(ruta)) throw new ErrorGH(0, 'Ruta no permitida: ' + ruta + '. Solo se escribe en datos/indice.json y datos/<id>/jornada_NN.json o actual.json.');
    const cuerpo = { message: mensaje, content: aBase64(texto), branch: REPO.rama, author: AUTOR, committer: AUTOR };
    if (sha) cuerpo.sha = sha;
    return gh(rutaApi(ruta), { method: 'PUT', body: JSON.stringify(cuerpo) });
  }

  /* ---------- paso 1: token ---------- */
  function pintarToken(msg, malo) {
    const t = guardado.leer();
    E.token = t;
    if (t) {
      poner($('#token-estado'),
        el('p', null, 'Hay un token guardado en este navegador.'),
        msg ? el('p', { class: 'nota' + (malo ? ' caja' : '') }, msg) : null,
        el('div', { class: 'acciones' },
          el('button', { type: 'button', class: 'boton sec', onclick: () => { guardado.borrar(); pintarToken(); } }, 'Quitar el token')));
      return;
    }
    const campo = el('input', { type: 'password', id: 'token', autocomplete: 'off', 'aria-label': 'Token de GitHub', placeholder: 'Pega aquí el token de GitHub' });
    const nota = el('p', { class: 'nota' + (malo ? ' caja' : ''), 'aria-live': 'polite' }, msg || '');
    const boton = el('button', { type: 'button', class: 'boton' }, 'Guardar y comprobar');
    boton.addEventListener('click', async () => {
      const v = campo.value.trim();
      if (!v) { nota.textContent = 'Pega primero el token.'; return; }
      boton.disabled = true; nota.textContent = 'Comprobando…';
      E.token = v;
      try {
        const r = await gh(`/repos/${REPO.dueno}/${REPO.nombre}`);
        if (!guardado.poner(v)) { pintarToken('El navegador no deja guardar el token (¿ventana privada?). Se usará solo hasta que cierres esta pestaña.', true); return; }
        pintarToken('Token comprobado y guardado.');
      } catch (e) { E.token = null; boton.disabled = false; nota.textContent = e.message; nota.className = 'nota caja'; }
    });
    poner($('#token-estado'),
      el('p', null, 'La primera vez hace falta un token de GitHub, solo para el repositorio campeonatos-domino. Pégalo aquí. No lo escribas en ningún chat ni correo.'),
      campo, el('div', { class: 'acciones' }, boton), nota);
  }

  /* ---------- paso 2: leer el Excel ---------- */
  async function alElegirArchivo(ev) {
    const f = ev.target.files[0];
    ev.target.value = ''; // así se puede volver a elegir el mismo archivo tras guardarlo de nuevo
    E.json = null;
    $('#paso-revision').hidden = true; $('#paso-publicar').hidden = true;
    if (!f) { poner($('#lectura')); return; }
    if (f.size > MAX_BYTES) { poner($('#lectura'), el('p', { class: 'nota caja' }, `Ese archivo pesa ${Math.round(f.size / 1048576)} MB y es demasiado grande (el máximo son ${MAX_BYTES / 1048576} MB). ¿Es el Excel del campeonato?`)); return; }
    if (!/\.(xlsx|xlsm)$/i.test(f.name)) { poner($('#lectura'), el('p', { class: 'nota caja' }, 'Elige el archivo Excel del campeonato (termina en .xlsx).')); return; }
    if (!guardado.leer() && !E.token) { poner($('#lectura'), el('p', { class: 'nota caja' }, 'Primero pega el token de GitHub en el paso 1.')); return; }
    poner($('#lectura'), el('p', { class: 'nota' }, 'Leyendo la hoja WEB…'));
    let wb;
    try {
      wb = XLSX.read(await f.arrayBuffer(), { type: 'array', sheets: 'WEB', cellFormula: false, cellHTML: false, cellStyles: false, cellNF: false });
    } catch (e) {
      poner($('#lectura'), el('p', { class: 'nota caja' }, 'No se ha podido leer ese archivo. ¿Está dañado o es de otro programa?'));
      return;
    }
    const ws = wb.Sheets && wb.Sheets.WEB;
    if (!ws) { poner($('#lectura'), el('p', { class: 'nota caja' }, 'Este archivo no tiene la hoja WEB. ¿Es el Excel del campeonato?')); return; }
    const rg = XLSX.utils.decode_range(ws['!ref'] || 'A1');
    if (rg.e.r + 1 > MAX_FILAS || rg.e.c + 1 > MAX_COLUMNAS) { poner($('#lectura'), el('p', { class: 'nota caja' }, 'La hoja WEB es mucho más grande de lo normal. ¿Es el Excel del campeonato?')); return; }
    E.archivo = f.name;
    await revisar(ws);
  }

  async function estadoPublicado(j) {
    const id = j.torneo.id;
    const pub = { indice: null, actual: null, existente: null, sha: {} };
    const i = await traer('datos/indice.json'); if (i) { pub.indice = i.json; pub.sha.indice = i.sha; }
    if (ID_OK.test(id || '')) {
      const a = await traer(`datos/${id}/actual.json`); if (a) { pub.actual = a.json; pub.sha.actual = a.sha; }
      if (Number.isInteger(j.jornada.numero) && j.jornada.numero > 0) {
        const x = await traer(`datos/${id}/jornada_${String(j.jornada.numero).padStart(2, '0')}.json`); if (x) { pub.existente = x.json; pub.sha.jornada = x.sha; }
      }
    }
    return pub;
  }

  async function revisar(ws) {
    try {
      E.raw = C.leer(ws);
      E.json = C.construir(E.raw, null);
      poner($('#lectura'), el('p', { class: 'nota' }, 'Comprobando lo que ya está publicado…'));
      E.pub = await estadoPublicado(E.json);
    } catch (e) {
      if (e.estado === 401) { pintarToken(e.message, true); $('#paso-revision').hidden = true; $('#paso-publicar').hidden = true; }
      poner($('#lectura'), el('p', { class: 'nota caja' }, e instanceof ErrorGH ? e.message : 'Esa hoja WEB no se puede leer. Comprueba que es la del campeonato y que el Excel está guardado.'));
      return;
    }
    poner($('#lectura'), el('p', { class: 'nota' }, `Leído «${E.archivo}»: ${E.json.torneo.nombre || 'sin nombre'}.`));
    E.vals = C.validar(E.raw, E.json, E.pub);
    E.confirmadas = new Set();
    pintarRevision();
  }

  /* ---------- paso 3: revisión ---------- */
  const ETIQ = { bloquea: 'No se puede publicar', confirma: 'Confirma', avisa: 'Aviso' };
  function pintarRevision() {
    const j = E.json, t = j.torneo, jo = j.jornada;
    const nombreJ = t.tipo === 'sp' ? 'Jornada' : 'Partida';
    const conRes = j.emparejamientos.filter((m) => m.estado !== 'pendiente' && m.estado !== 'descanso').length;
    const resumen = el('div', { class: 'resumen' },
      cuadro(t.nombre || '—', 'Campeonato'), cuadro(`${jo.numero} de ${t.n_jornadas}`, nombreJ + (jo.completa ? ' (completa)' : ' (en juego)')),
      cuadro(`${conRes} / ${j.emparejamientos.filter((m) => m.estado !== 'descanso').length}`, 'mesas con resultado'), cuadro(t.n_participantes, t.tipo === 'individual' ? 'jugadores' : 'parejas'));
    const bloquea = E.vals.filter((x) => x.gravedad === 'bloquea').length;
    const lista = E.vals.map((x) => {
      if (x.gravedad === 'confirma') {
        const c = el('input', { type: 'checkbox' });
        c.addEventListener('change', () => { c.checked ? E.confirmadas.add(x.cod) : E.confirmadas.delete(x.cod); actualizarBoton(); });
        return el('li', { class: 'confirma' }, el('label', null, c, el('span', null, el('span', { class: 'cod' }, x.cod), x.msg + ' ', el('b', null, 'Marca la casilla si quieres seguir.'))));
      }
      return el('li', { class: x.gravedad }, el('span', { class: 'cod' }, x.cod), el('b', null, ETIQ[x.gravedad] + ': '), x.msg);
    });
    if (!E.vals.length) lista.push(el('li', { class: 'ok' }, 'Todo en orden: no hay nada que avisar.'));
    const gA = j.clasificacion.filter((r) => r.grupo === 'A').slice(0, 8);
    const byId = new Map(j.participantes.map((p) => [p.id, p]));
    const sp = t.tipo === 'sp';
    const tabla = el('div', { class: 'tabla-caja sep-12' }, el('table', { class: 'clasi' },
      el('caption', { class: 'solo-lector' }, 'Primeros puestos leídos del Excel'),
      el('thead', null, el('tr', null, el('th', null, '#'), el('th', { class: 'izq' }, 'Quién'), el('th', null, 'Gan'), el('th', null, 'Dif.T'))),
      el('tbody', null, gA.map((r) => el('tr', null, el('td', null, r.puesto), el('td', { class: 'pareja' }, el('span', { class: 'nom' }, (byId.get(r.id) || {}).corto || '#' + r.id)), el('td', { class: 'gan' }, r.gan), el('td', null, r.dt == null ? '' : r.dt))))));
    const mesas = el('details', { class: 'sep-10' }, el('summary', null, `Ver las ${j.emparejamientos.length} mesas leídas`),
      el('ul', { class: 'vals' }, j.emparejamientos.map((m) => el('li', null,
        `${m.mesa == null ? 'Descansa' : 'Mesa ' + m.mesa}: ${m.izq.map((i) => (byId.get(i) || {}).corto || i).join(' y ')}${m.dcha.length ? ' contra ' + m.dcha.map((i) => (byId.get(i) || {}).corto || i).join(' y ') : ''}` +
        ` · ${m.estado}${m.p_izq != null ? ' · ' + (sp ? m.p_izq + '-' + m.p_dcha + ' (' + m.t_izq + '-' + m.t_dcha + ')' : m.t_izq + '-' + m.t_dcha) : ''}`))));
    poner($('#revision'), resumen, el('ul', { class: 'vals' }, lista),
      bloquea ? null : [el('p', { class: 'nota sep-12' }, jo.completa ? 'Así leerá la web esta jornada:' : 'Clasificación provisional leída del Excel. En cuanto haya un resultado, la web la enseña en vivo, con ⏳ en quien aún no ha jugado:'), tabla, mesas]);
    $('#paso-revision').hidden = false;
    $('#paso-publicar').hidden = false;
    $('#registro').hidden = true;
    actualizarBoton();
  }
  const cuadro = (b, s) => el('div', null, el('b', null, b), el('span', null, s));

  function actualizarBoton() {
    const bloquea = E.vals.some((x) => x.gravedad === 'bloquea');
    const falta = E.vals.filter((x) => x.gravedad === 'confirma').some((x) => !E.confirmadas.has(x.cod));
    $('#publicar').disabled = bloquea || falta;
    $('#pub-nota').textContent = bloquea ? 'Corrige lo que se marca en rojo, guarda el Excel y elígelo otra vez.' : falta ? 'Marca las casillas para poder publicar.' : '';
  }

  /* ---------- paso 4: publicar ---------- */
  async function publicar() {
    const boton = $('#publicar');
    const reg = $('#registro');
    const anota = (txt) => { reg.hidden = false; reg.textContent += txt + '\n'; };
    boton.disabled = true; reg.textContent = '';
    const j = E.json, id = j.torneo.id, n = String(j.jornada.numero).padStart(2, '0');
    j.publicado = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    const msg = `Publicar ${id}: jornada ${j.jornada.numero}`;
    const esReciente = !E.pub.actual || E.pub.actual.torneo.id !== id || j.jornada.numero >= E.pub.actual.jornada.numero;
    try {
      // si otro cambió el archivo entre medias, se vuelve a leer el sha una vez
      const conReintento = async (ruta, texto, sha) => {
        try { return await escribir(ruta, texto, sha, msg); } catch (e) {
          if (e.estado !== 409 && e.estado !== 422) throw e;
          const otra = await traer(ruta);
          return escribir(ruta, texto, otra && otra.sha, msg);
        }
      };
      anota(`Escribiendo jornada_${n}.json…`);
      await conReintento(`datos/${id}/jornada_${n}.json`, C.aTexto(j), E.pub.sha.jornada);
      if (esReciente) {
        anota('Escribiendo actual.json…');
        await conReintento(`datos/${id}/actual.json`, C.aTexto(C.conJornadas(j, C.jornadasNuevas(j, E.pub.actual))), E.pub.sha.actual);
        anota('Escribiendo indice.json…');
        await conReintento('datos/indice.json', C.aTexto(C.indiceNuevo(E.pub.indice, j)), E.pub.sha.indice);
      } else {
        // jornada anterior: actual.json sigue igual, pero su lista de jornadas tiene que incluirla (si no, la web no la enseña)
        const { jornadas, ...resto } = E.pub.actual;
        anota('Apuntando la jornada en actual.json…');
        await conReintento(`datos/${id}/actual.json`, C.aTexto(C.conJornadas(resto, C.jornadasNuevas(j, E.pub.actual))), E.pub.sha.actual);
        anota('Era una jornada anterior: solo se ha corregido su archivo.');
      }
    } catch (e) {
      anota('✖ ' + (e.message || 'Algo ha fallado.'));
      if (e.estado === 401) { pintarToken(e.message, true); anota('Pega un token nuevo en el paso 1 y vuelve a publicar.'); boton.disabled = false; return; }
      anota('No se ha perdido nada: puedes volver a elegir el Excel y publicar otra vez.');
      boton.disabled = false;
      return;
    }
    anota('✔ Publicado. La web lo mostrará en uno o dos minutos.');
    reg.append(el('a', { href: `torneo.html?t=${encodeURIComponent(id)}`, target: '_blank', rel: 'noopener noreferrer' }, 'Abrir el campeonato en la web'));
    E.pub = await estadoPublicado(j).catch(() => E.pub);
  }

  window.TuMesa.escribir = escribir; // lo usa pruebas/probar_publicar.cjs para comprobar que se rechazan las rutas fuera de datos/

  document.addEventListener('DOMContentLoaded', () => {
    if (document.body.dataset.pagina !== 'publicar') return;
    pintarToken();
    $('#archivo').addEventListener('change', alElegirArchivo);
    $('#publicar').addEventListener('click', publicar);
  });
})();
