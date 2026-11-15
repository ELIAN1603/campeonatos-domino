// Cifra los datos inventados de pruebas/datos en datos/_prueba, con la contraseña de prueba (pública: ver pruebas/cripto_prueba.cjs).
// Uso: node pruebas/cifrar_prueba.cjs   (después de cambiar algo en pruebas/datos)
// Con --comprobar no escribe nada: falla si datos/_prueba no es exactamente pruebas/datos cifrado.
const fs = require('fs'), path = require('path');
const K = require('./cripto_prueba.cjs');
const ORIGEN = path.join(__dirname, 'datos'), DESTINO = K.DIR_PRUEBA;
const comprobar = process.argv.includes('--comprobar');

const jsons = (dir, pre = '') => fs.readdirSync(path.join(dir, pre), { withFileTypes: true }).flatMap((e) =>
  e.isDirectory() ? jsons(dir, path.join(pre, e.name)) : /\.(json|pdf)$/.test(e.name) ? [path.join(pre, e.name)] : []);
const cifrado = (f) => (f.endsWith('.pdf') ? f + '.cifrado' : f); // la normativa va como normativa.pdf.cifrado
const deCifrado = (f) => f.replace(/\.cifrado$/, '');

const todos = (dir, pre = '') => fs.readdirSync(path.join(dir, pre), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? todos(dir, path.join(pre, e.name)) : [path.join(pre, e.name)]));

if (comprobar) {
  const clave = K.clavePrueba();
  if (!clave) throw new Error('datos/_prueba/clave.json no abre con la contraseña de prueba');
  const esperado = jsons(ORIGEN).sort(), hay = todos(DESTINO).filter((f) => f !== 'clave.json').map(deCifrado).sort();
  if (JSON.stringify(esperado) !== JSON.stringify(hay)) throw new Error('datos/_prueba no tiene los mismos archivos que pruebas/datos. Ejecuta node pruebas/cifrar_prueba.cjs');
  for (const f of esperado) {
    const t = fs.readFileSync(path.join(DESTINO, cifrado(f)), 'utf8');
    const plano = K.esSobre(t) && K.descifrar(clave, JSON.parse(t));
    if (!plano || !plano.equals(fs.readFileSync(path.join(ORIGEN, f)))) throw new Error(`datos/_prueba/${f} no es pruebas/datos/${f} cifrado. Ejecuta node pruebas/cifrar_prueba.cjs`);
  }
  console.log(`datos/_prueba al día: ${esperado.length} archivos cifrados`);
} else {
  fs.rmSync(DESTINO, { recursive: true, force: true });
  const { clave, json } = K.claveJson(K.CONTRASENA_PRUEBA);
  fs.mkdirSync(DESTINO, { recursive: true });
  fs.writeFileSync(path.join(DESTINO, 'clave.json'), JSON.stringify(json, null, 1) + '\n');
  for (const f of jsons(ORIGEN)) {
    fs.mkdirSync(path.dirname(path.join(DESTINO, f)), { recursive: true });
    fs.writeFileSync(path.join(DESTINO, cifrado(f)), JSON.stringify(K.cifrar(clave, fs.readFileSync(path.join(ORIGEN, f)))) + '\n');
  }
  console.log('datos/_prueba cifrado de nuevo');
}
