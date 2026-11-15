# Seguridad de campeonatos-domino

Este repositorio es público y lo sirve GitHub Pages. Aquí se explica qué se publica, cómo, qué protege el sitio y qué hacer con el token de publicación.

## Qué se publica

En `datos/` van los JSON de cada campeonato: nombre, organizador, temporada, fechas, y por cada pareja o jugador el nombre de pila, el primer apellido y un nombre corto (por ejemplo «Fontan-Ródenas»). También van la zona, las mesas de cada jornada con su resultado, la clasificación y el calendario. Cada jornada queda guardada con los nombres que tenía ese día.

Nunca entran en el repositorio:

- teléfonos, números de licencia, segundos apellidos, direcciones de correo ni cuentas bancarias;
- ningún Excel (el `.gitignore` deja fuera `*.xlsx`, `*.xlsm` y `*.xls`);
- el token de GitHub.

Dos barreras lo impiden. `publicar.html` lee solo la hoja WEB del Excel, en el ordenador de la mesa, y su validación V06 bloquea cualquier nombre con cifras o con arroba y cualquier texto libre que parezca un teléfono. Además, `pruebas/probar_contrato.cjs` comprueba esa validación. Si un dato personal llegara a publicarse por error, hay que borrarlo del repositorio y avisar a la persona afectada; el historial de Git conserva las versiones anteriores, así que quitar el archivo no basta.

## Cómo se publica

1. La mesa abre `publicar.html` y elige el Excel guardado. La página lo lee en el navegador; el Excel no se sube a ningún sitio. Rechaza archivos de más de 25 MB y hojas WEB con más de 300 filas o 80 columnas, y los textos de más de 300 caracteres.
2. La página escribe con la API de contenidos de GitHub, con el token guardado en el navegador. Solo puede escribir en `datos/indice.json` y en `datos/<id>/jornada_NN.json` y `datos/<id>/actual.json`. El `<id>` tiene que cumplir `[a-z0-9][a-z0-9-]{2,59}`; cualquier otra ruta se rechaza antes de llamar a GitHub.
3. Cada commit sale con autor y committer «Mesa de control» y el correo noreply de la cuenta (`356692983+ELIAN1603@users.noreply.github.com`), para que no se vea el correo real.
4. El token solo se envía a `https://api.github.com`. Si GitHub responde 401, la página lo borra del navegador y lo avisa.
5. Los textos del Excel y de los JSON se pintan siempre como texto, nunca como HTML. Los enlaces externos solo se aceptan con `https://` y llevan `rel="noopener noreferrer"`.

## Qué protege el sitio

GitHub Pages no deja poner cabeceras HTTP, así que cada página lleva `<meta>`:

- `Content-Security-Policy`: `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self' https://api.github.com; object-src 'none'; base-uri 'none'; form-action 'none'`. No hay scripts ni estilos en línea.
- `referrer` con `no-referrer`.
- `robots` con `noindex, nofollow`, y un `robots.txt` con `Disallow: /`.

Límites que conviene conocer:

- `frame-ancestors` no funciona en un `<meta>`, así que no se puede impedir que otra web enmarque estas páginas. Hace falta una cabecera HTTP, que GitHub Pages no ofrece.
- El `robots.txt` de un sitio de proyecto vive en `/campeonatos-domino/robots.txt`, no en la raíz del dominio, y los buscadores solo leen la raíz. Lo que de verdad pide que no se indexe es el `<meta name="robots">`. Ninguna de las dos cosas oculta el sitio: cualquiera con el enlace lo ve, y el repositorio es público.
- La CSP no protege de un token robado. Con permiso de escritura en el repositorio se pueden cambiar también `assets/*.js`, y esos scripts son de origen `'self'`.

## El token

Es un token fine-grained de GitHub con este alcance:

- solo el repositorio `ELIAN1603/campeonatos-domino`;
- permiso «Contents: Read and write» y ningún otro;
- caduca en noviembre de 2027.

Se pega una vez en `publicar.html`, en el equipo de la mesa, y se queda en el `localStorage` de ese navegador. No se manda por WhatsApp ni por correo, ni se escribe en el Excel o en el repositorio.

### Rotarlo

Conviene hacerlo antes de que caduque, o si cambia el equipo de la mesa.

1. En GitHub: Settings, Developer settings, Personal access tokens, Fine-grained tokens. Crea uno nuevo con el alcance de arriba (o usa «Regenerate token» en el existente) y una caducidad nueva.
2. En `publicar.html`, pulsa «Quitar el token», pega el nuevo y pulsa «Guardar y comprobar».
3. Borra el token antiguo en la misma pantalla de GitHub.
4. Anota la nueva fecha de caducidad en esta página y en la guía.

Si el token caduca o se pierde sin avisar, la página lo dice al publicar («GitHub no acepta el token…») y lo borra del navegador. No se pierde nada: se crea uno nuevo y se vuelve a publicar.

### Si se filtra

1. Revócalo ya: GitHub, Settings, Developer settings, Fine-grained tokens, Delete. Es lo único urgente.
2. Mira los commits recientes del repositorio. Los de la mesa se llaman «Publicar <id>: jornada N», con autor «Mesa de control». Cualquier otro commit, o uno que toque algo fuera de `datos/`, hay que revisarlo.
3. Si hay cambios que no son nuestros, restáuralos con `git revert` o repón los archivos desde el último commit bueno. Presta atención a `assets/` y a las páginas HTML.
4. Crea un token nuevo como se explica arriba.
5. Mira el registro de seguridad de la cuenta (Settings, Security log) por si se ha usado en algo más.

## Revisar cuando cambie algo

Si se añade una página, tiene que llevar las tres etiquetas `<meta>` y ningún script ni estilo en línea. `pruebas/probar_seguridad.cjs` lo comprueba.

## Avisos de seguridad

Si ves algo raro en la web, escribe a la mesa de control. No lo publiques en un issue si incluye datos de personas.
