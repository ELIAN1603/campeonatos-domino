// Cifrado de las pruebas con el módulo crypto de Node (síncrono), compatible con assets/cifra.js: PBKDF2-SHA-256 + AES-256-GCM, sobre {v, iv, ct}.
// La contraseña de los datos de prueba es pública a propósito: datos/_prueba solo tiene campeonatos inventados.
const crypto = require('crypto'), fs = require('fs'), path = require('path');
const CONTRASENA_PRUEBA = 'datos de prueba de la mesa';
const VERIFICADOR = 'tu mesa: contraseña correcta';
const ITER = 600000;
const DIR_PRUEBA = path.join(__dirname, '..', 'datos/_prueba');

const derivar = (pass, salB64, iter = ITER) => crypto.pbkdf2Sync(Buffer.from(pass.normalize('NFC'), 'utf8'), Buffer.from(salB64, 'base64'), iter, 32, 'sha256');
function cifrar(clave, datos) {
  const iv = crypto.randomBytes(12), c = crypto.createCipheriv('aes-256-gcm', clave, iv);
  const ct = Buffer.concat([c.update(Buffer.isBuffer(datos) ? datos : Buffer.from(datos, 'utf8')), c.final(), c.getAuthTag()]);
  return { v: 1, iv: iv.toString('base64'), ct: ct.toString('base64') };
}
function descifrar(clave, s) { // Buffer, o null si no es de esta clave
  try {
    const ct = Buffer.from(s.ct, 'base64'), d = crypto.createDecipheriv('aes-256-gcm', clave, Buffer.from(s.iv, 'base64'));
    d.setAuthTag(ct.subarray(ct.length - 16));
    return Buffer.concat([d.update(ct.subarray(0, ct.length - 16)), d.final()]);
  } catch (e) { return null; }
}
const sobreTexto = (clave, texto) => JSON.stringify(cifrar(clave, texto));
function esSobre(t) { try { const o = JSON.parse(t); return !!o && o.v === 1 && typeof o.iv === 'string' && typeof o.ct === 'string' && Object.keys(o).length === 3; } catch (e) { return false; } }
function claveJson(pass) {
  const sal = crypto.randomBytes(16).toString('base64'), clave = derivar(pass, sal);
  return { clave, json: { version: 1, kdf: 'PBKDF2-SHA-256', iteraciones: ITER, sal, verificador: cifrar(clave, VERIFICADOR) } };
}
// Contraseña + clave.json → clave (Buffer) o null.
function abrir(pass, cj) {
  const clave = derivar(pass, cj.sal, cj.iteraciones), v = descifrar(clave, cj.verificador);
  return v && v.toString('utf8') === VERIFICADOR ? clave : null;
}
// La clave de datos/_prueba, lista para meterla en el navegador sin teclear la contraseña.
let deLaPrueba = null;
function clavePrueba() {
  if (!deLaPrueba) deLaPrueba = abrir(CONTRASENA_PRUEBA, JSON.parse(fs.readFileSync(path.join(DIR_PRUEBA, 'clave.json'), 'utf8')));
  return deLaPrueba;
}
// Guarda en el navegador la clave de los datos de prueba (como si la mesa hubiera escrito la contraseña y marcado «recordar»).
const recordarPrueba = (ctx) => ctx.addInitScript((k) => { if (!sessionStorage.getItem('sin-clave')) localStorage.setItem('tumesa.clave:datos/_prueba', k); }, clavePrueba().toString('base64'));

module.exports = { CONTRASENA_PRUEBA, VERIFICADOR, ITER, DIR_PRUEBA, derivar, cifrar, descifrar, sobreTexto, esSobre, claveJson, abrir, clavePrueba, recordarPrueba };
