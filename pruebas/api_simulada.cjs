// API de contenidos de GitHub simulada para los dos repositorios de la mesa de control.
// Uso: const api = await instalar(contexto, opciones); api.repos.web / api.repos.borr son Map(ruta -> {sha, texto}).
const fs = require('fs'), path = require('path');
const raiz = path.join(__dirname, '..');
const NOMBRES = { 'campeonatos-domino': 'web', 'campeonatos-borradores': 'borr' };
const OTROS = { web: 'campeonatos-domino', borr: 'campeonatos-borradores' };
const TOKEN = 'ghp_TOKEN_DE_PRUEBA';

// Copia un torneo de datos/_prueba a un repositorio simulado (sin Excel: solo JSON) y lo apunta en su índice.
function sembrar(api, clave, id) {
  const dir = path.join(raiz, 'datos/_prueba', id);
  for (const f of fs.readdirSync(dir)) api.poner(clave, `datos/${id}/${f}`, fs.readFileSync(path.join(dir, f), 'utf8'));
  const act = JSON.parse(fs.readFileSync(path.join(dir, 'actual.json'), 'utf8'));
  const t = act.torneo;
  const ind = JSON.parse(fs.readFileSync(path.join(raiz, 'datos/_prueba/indice.json'), 'utf8')).torneos.find((x) => x.id === id)
    || { id, nombre: t.nombre, tipo: t.tipo, temporada: t.temporada, fecha: t.fecha, estado: t.estado, jornada_actual: act.jornada.numero, n_jornadas: t.n_jornadas, n_participantes: t.n_participantes, ganador: null };
  const actual = api.repos[clave].get('datos/indice.json');
  const base = actual ? JSON.parse(actual.texto) : { version: '1.0', publicado: '2026-01-01T00:00:00Z', torneos: [] };
  base.torneos.push(ind);
  api.poner(clave, 'datos/indice.json', JSON.stringify(base, null, 1) + '\n');
}

async function instalar(ctx, opciones = {}) {
  const api = {
    repos: { web: new Map(), borr: new Map() },
    puts: [], dels: [], reqs: [], log: [], violaciones: [], // log: 'PUT clave ruta' / 'DELETE clave ruta' en orden; violaciones: veces que la web pública apuntó a archivos que no existían
    acceso: { web: true, borr: true, ...(opciones.acceso || {}) }, // false: GitHub contesta 404, como con un token sin ese repositorio
    soloLectura: { web: false, borr: false },
    token: TOKEN,
    fallar: null, // (metodo, clave, ruta) => estado HTTP o null
    n: 0,
    poner(clave, ruta, texto) { this.repos[clave].set(ruta, { sha: 's' + ++this.n, texto }); },
    json(clave, ruta) { const f = this.repos[clave].get(ruta); return f ? JSON.parse(f.texto) : null; },
    // La web pública nunca debe apuntar a algo que no existe: cada torneo del índice tiene su actual.json y cada actual.json tiene las jornadas que lista.
    revisar(donde) {
      const w = this.repos.web, ind = w.get('datos/indice.json');
      if (!ind) return;
      for (const t of JSON.parse(ind.texto).torneos) {
        const a = w.get(`datos/${t.id}/actual.json`);
        if (!a) { this.violaciones.push(`${donde}: ${t.id} está en indice.json y no tiene actual.json`); continue; }
        for (const j of JSON.parse(a.texto).jornadas || []) if (!w.has(`datos/${t.id}/jornada_${String(j.numero).padStart(2, '0')}.json`)) this.violaciones.push(`${donde}: actual.json de ${t.id} lista la jornada ${j.numero} y no existe`);
      }
    },
    rutas(clave) { return [...this.repos[clave].keys()].sort(); },
  };
  const enc = (t) => Buffer.from(t, 'utf8').toString('base64').replace(/(.{60})/g, '$1\n');
  await ctx.route('https://api.github.com/**', async (route) => {
    const req = route.request(); const u = new URL(req.url());
    const metodo = req.method();
    api.reqs.push({ metodo, ruta: u.pathname, auth: req.headers().authorization });
    if (req.headers().authorization !== 'Bearer ' + api.token) return route.fulfill({ status: 401, body: '{"message":"Bad credentials"}' });
    const m = /^\/repos\/ELIAN1603\/([^/]+)(?:\/contents\/(.*))?$/.exec(u.pathname);
    const clave = m && NOMBRES[m[1]];
    if (!clave || !api.acceso[clave]) return route.fulfill({ status: 404, body: '{"message":"Not Found"}' });
    if (!m[2]) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ name: m[1], permissions: { push: !api.soloLectura[clave] } }) });
    const ruta = decodeURIComponent(m[2]);
    const forzado = api.fallar && api.fallar(metodo, clave, ruta);
    if (forzado) return route.fulfill({ status: forzado, body: '{"message":"error simulado"}' });
    const repo = api.repos[clave];
    if (metodo === 'GET') {
      const f = repo.get(ruta);
      if (f) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ type: 'file', path: ruta, sha: f.sha, content: enc(f.texto) }) });
      const hijos = new Map();
      for (const [r, v] of repo) if (r.startsWith(ruta + '/')) { const nombre = r.slice(ruta.length + 1).split('/')[0]; const esDir = r.slice(ruta.length + 1).includes('/'); if (!hijos.has(nombre)) hijos.set(nombre, { name: nombre, path: ruta + '/' + nombre, type: esDir ? 'dir' : 'file', sha: v.sha }); }
      if (hijos.size) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([...hijos.values()]) });
      return route.fulfill({ status: 404, body: '{"message":"Not Found"}' });
    }
    const c = JSON.parse(req.postData());
    const f = repo.get(ruta);
    if (metodo === 'PUT') {
      if (f && c.sha !== f.sha) return route.fulfill({ status: 409, body: '{}' });
      if (!f && c.sha) return route.fulfill({ status: 422, body: '{}' });
      api.poner(clave, ruta, Buffer.from(c.content, 'base64').toString('utf8'));
      api.log.push('PUT ' + clave + ' ' + ruta);
      api.puts.push({ clave, ruta, mensaje: c.message, rama: c.branch, author: c.author, committer: c.committer });
      if (clave === 'web') api.revisar('tras escribir ' + ruta);
      return route.fulfill({ status: 201, contentType: 'application/json', body: '{"content":{},"commit":{}}' });
    }
    if (metodo === 'DELETE') {
      if (!f) return route.fulfill({ status: 404, body: '{}' });
      if (c.sha !== f.sha) return route.fulfill({ status: 409, body: '{}' });
      repo.delete(ruta);
      api.log.push('DELETE ' + clave + ' ' + ruta);
      api.dels.push({ clave, ruta, mensaje: c.message, rama: c.branch, author: c.author, committer: c.committer });
      if (clave === 'web') api.revisar('tras borrar ' + ruta);
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{"commit":{}}' });
    }
    return route.fulfill({ status: 405, body: '{}' });
  });
  return api;
}

module.exports = { instalar, sembrar, TOKEN, OTROS };
