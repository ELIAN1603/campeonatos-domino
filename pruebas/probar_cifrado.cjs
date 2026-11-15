// Módulo de cifrado (assets/cifra.js) en Node, sin navegador: ida y vuelta, contraseña errónea, formato de clave.json y de los sobres.
// Uso: node pruebas/probar_cifrado.cjs
const assert = require('assert');
const Cifra = require('../assets/cifra.js');
let ok = 0; const bien = (t) => { ok++; console.log('  ok  ' + t); };
const B64 = /^[A-Za-z0-9+/]+={0,2}$/;

(async () => {
  const { json, clave } = await Cifra.crearClaveJson('caballo tortuga ventana prado nube');
  assert.deepStrictEqual(Object.keys(json), ['version', 'kdf', 'iteraciones', 'sal', 'verificador']);
  assert.strictEqual(json.version, 1);
  assert.strictEqual(json.kdf, 'PBKDF2-SHA-256');
  assert.strictEqual(json.iteraciones, 600000);
  assert(B64.test(json.sal) && Buffer.from(json.sal, 'base64').length === 16, 'sal de 16 bytes');
  assert(Cifra.esSobre(json.verificador));
  assert(!JSON.stringify(json).includes('caballo'), 'clave.json no lleva la contraseña');
  bien('clave.json: versión, PBKDF2-SHA-256, 600 000 iteraciones, sal de 16 bytes y verificador cifrado, sin la contraseña');

  const otra = await Cifra.crearClaveJson('caballo tortuga ventana prado nube');
  assert.notStrictEqual(otra.json.sal, json.sal);
  bien('la sal es aleatoria: la misma contraseña da otra sal');

  const texto = JSON.stringify({ nombre: 'Pareja Núñez-Ibáñez', tel: '612345678' });
  const sobre = await Cifra.cifrarTexto(clave, texto);
  assert.deepStrictEqual(Object.keys(sobre), ['v', 'iv', 'ct']);
  assert.strictEqual(sobre.v, 1);
  assert(B64.test(sobre.iv) && Buffer.from(sobre.iv, 'base64').length === 12, 'IV de 12 bytes');
  assert(B64.test(sobre.ct));
  const crudo = JSON.stringify(sobre);
  assert(!/Núñez|Pareja|612345678/.test(crudo) && !/Núñez|612345678/.test(Buffer.from(sobre.ct, 'base64').toString('latin1')));
  assert.strictEqual(await Cifra.descifrarTexto(clave, sobre), texto);
  bien('ida y vuelta de un texto con acentos: el sobre {v, iv, ct} no deja ver nada');

  const s2 = await Cifra.cifrarTexto(clave, texto);
  assert.notStrictEqual(s2.iv, sobre.iv);
  assert.notStrictEqual(s2.ct, sobre.ct);
  bien('IV aleatorio por archivo: cifrar lo mismo dos veces da sobres distintos');

  const pdf = new Uint8Array(70000); for (let i = 0; i < pdf.length; i++) pdf[i] = (i * 31) & 255; pdf.set([0x25, 0x50, 0x44, 0x46]);
  const sp = await Cifra.cifrar(clave, pdf);
  assert.deepStrictEqual(Buffer.from(await Cifra.descifrar(clave, sp)), Buffer.from(pdf));
  bien('ida y vuelta de bytes (un PDF de 70 KB)');

  const abierta = await Cifra.abrir('caballo tortuga ventana prado nube', json);
  assert(abierta, 'la contraseña buena abre');
  assert.strictEqual(await Cifra.descifrarTexto(abierta, sobre), texto);
  bien('abrir con la contraseña buena da una clave que descifra lo cifrado con la original');

  assert.strictEqual(await Cifra.abrir('caballo tortuga ventana prado nubes', json), null);
  assert.strictEqual(await Cifra.abrir('', json), null);
  bien('contraseña errónea: abrir devuelve null, sin excepción');

  const mala = await Cifra.abrir('caballo tortuga ventana prado nube', otra.json);
  await assert.rejects(Cifra.descifrarTexto(mala, sobre));
  bien('una clave de otra sal no descifra');

  const roto = { ...sobre, ct: Buffer.from(Buffer.from(sobre.ct, 'base64').map((b, i) => (i === 3 ? b ^ 1 : b))).toString('base64') };
  await assert.rejects(Cifra.descifrarTexto(clave, roto));
  bien('un sobre cambiado en un solo bit no se descifra (AES-GCM)');

  const exp = await Cifra.exportar(clave);
  assert(B64.test(exp) && Buffer.from(exp, 'base64').length === 32, 'clave AES-256 exportada');
  const imp = await Cifra.importar(exp);
  assert.strictEqual(await Cifra.descifrarTexto(imp, sobre), texto);
  assert(await Cifra.comprobar(imp, json));
  assert(!(await Cifra.comprobar(mala, json)));
  bien('la clave derivada se exporta y se importa (32 bytes) y se comprueba contra el verificador');

  assert(!Cifra.esSobre({ version: '1.0', torneos: [] }) && !Cifra.esSobre(null) && !Cifra.esSobre({ v: 1, iv: 'x' }) && Cifra.esSobre(sobre));
  assert(Cifra.esSobreTexto(JSON.stringify(sobre)) && !Cifra.esSobreTexto('{"version":"1.0"}') && !Cifra.esSobreTexto('%PDF-1.4') && !Cifra.esSobreTexto('no json'));
  bien('esSobre / esSobreTexto distinguen un sobre de un JSON en claro o de un PDF');

  const flojo = { ...json, iteraciones: 1000 };
  assert.strictEqual(await Cifra.abrir('caballo tortuga ventana prado nube', flojo), null);
  bien('un clave.json con menos de 600 000 iteraciones no se acepta');

  // frase propuesta: 5 palabras de la lista, sacadas con crypto.getRandomValues
  assert(Cifra.PALABRAS.length >= 1900, 'lista de unas 2 000 palabras: ' + Cifra.PALABRAS.length);
  assert.strictEqual(new Set(Cifra.PALABRAS).size, Cifra.PALABRAS.length, 'sin repetidas');
  assert(Cifra.PALABRAS.every((p) => /^[a-zñ]{3,10}$/.test(p)), 'palabras en minúscula sin tildes');
  const frases = new Set();
  for (let i = 0; i < 50; i++) {
    const f = Cifra.frase();
    const ps = f.split(' ');
    assert.strictEqual(ps.length, 5);
    assert(ps.every((p) => Cifra.PALABRAS.includes(p)));
    assert(f.length >= 14);
    frases.add(f);
  }
  assert.strictEqual(frases.size, 50);
  bien('frase propuesta: 5 palabras de la lista, siempre distinta y de 14 caracteres o más');

  assert.strictEqual(Cifra.contrasenaValida('corta'), false);
  assert.strictEqual(Cifra.contrasenaValida('trece letras.'), false);
  assert.strictEqual(Cifra.contrasenaValida('catorce letras'), true);
  assert.strictEqual(Cifra.contrasenaValida('   catorce   '), false, 'los espacios de los extremos no cuentan');
  bien('una contraseña escrita a mano necesita 14 caracteres o más');

  // compatible con el cifrado de las pruebas (crypto de Node), que llena datos/_prueba y la API simulada
  const K = require('./cripto_prueba.cjs');
  const deNode = K.claveJson('pingüino ñandú cigüeña');
  const kw = await Cifra.abrir('pingüino ñandú cigüeña', deNode.json);
  assert(kw, 'cifra.js abre un clave.json hecho con Node');
  assert.strictEqual(await Cifra.descifrarTexto(kw, K.cifrar(deNode.clave, 'hola Peñíscola')), 'hola Peñíscola');
  assert.strictEqual(K.descifrar(deNode.clave, await Cifra.cifrarTexto(kw, 'adiós')).toString('utf8'), 'adiós');
  assert(await Cifra.abrir('pingüino ñandú cigüeña'.normalize('NFD'), deNode.json), 'la misma contraseña con las letras compuestas de otra forma (NFD) también abre');
  bien('compatible con el cifrado de las pruebas en Node, y la contraseña se normaliza (NFC)');

  console.log(`\n${ok} comprobaciones bien`);
})().catch((e) => { console.error('FALLA:', e.message); process.exit(1); });
