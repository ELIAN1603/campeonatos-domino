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

`publicar.html` es la mesa de control. Trabaja con dos repositorios: `campeonatos-domino` (público, la web) y `campeonatos-borradores` (privado, con la misma estructura `datos/`).

1. La mesa abre `publicar.html` y elige el Excel guardado. La página lo lee en el navegador; el Excel no se sube a ningún sitio. Rechaza archivos de más de 25 MB y hojas WEB con más de 300 filas o 80 columnas, y los textos de más de 300 caracteres.
2. La mesa elige el destino: borrador o web. Por defecto es la web si el torneo ya está en ella y borrador si es nuevo.
3. La página escribe con la API de contenidos de GitHub, con el token guardado en el navegador. Solo puede escribir en los dos repositorios, y en ellos solo en `datos/indice.json` y en `datos/<id>/jornada_NN.json` y `datos/<id>/actual.json`. El `<id>` tiene que cumplir `[a-z0-9][a-z0-9-]{2,59}`. Cualquier otra ruta u otro repositorio se rechaza antes de llamar a GitHub. Para borrar rige la misma lista de rutas.
4. Cada commit sale con autor y committer «Mesa de control» y el correo noreply de la cuenta (`356692983+ELIAN1603@users.noreply.github.com`), para que no se vea el correo real. Los mensajes llevan solo la acción y el id (por ejemplo «Ocultar sp-2026-27»), nunca nombres de personas.
5. El token solo se envía a `https://api.github.com`. Si GitHub responde 401, la página lo borra del navegador y lo avisa.
6. Los textos del Excel y de los JSON se pintan siempre como texto, nunca como HTML. Los enlaces externos solo se aceptan con `https://` y llevan `rel="noopener noreferrer"`.
7. Todo lo que borra o mueve pide confirmación: publicar un borrador, ocultar y eliminar. Eliminar exige escribir el id del campeonato.

### Orden de escritura

Cuando una acción toca varios archivos, la web pública no debe apuntar nunca a archivos que no existen:

- Subir o publicar: primero `jornada_NN.json`, luego `actual.json` y al final `indice.json`.
- Ocultar: copia los archivos a borradores y apunta el borrador en su `indice.json`; después quita el torneo de `indice.json` de la web y solo al final borra sus archivos de la web.
- Eliminar: quita el torneo de `indice.json` y luego borra sus archivos.
- Editar: primero `actual.json`, al final `indice.json`.

Si algo falla a medias, la página dice qué quedó hecho y ofrece «Reintentar» con los pasos que faltan. Si se cierra la página antes, las carpetas que queden en la web sin entrada en `indice.json` salen en la lista como restos, para eliminarlas.

## Borradores

`campeonatos-borradores` es privado. Una persona sin el token no ve nada de él.

- Ver un borrador: `torneo.html?t=<id>&borrador=1` lee los datos de `campeonatos-borradores` con la API de GitHub y el token guardado en ese navegador. Sin token, con un token que no llega al repositorio o si algo falla, la página dice que es un borrador privado y no enseña nada, ni siquiera el nombre. El código de la página es público; los datos no.
- Publicar un borrador copia sus archivos a `campeonatos-domino` y lo añade a `indice.json`. El borrador se queda en borradores.
- Ocultar un campeonato lo copia a borradores y lo quita de la web. Sus archivos siguen en el historial de git de `campeonatos-domino`, que es público: quien sepa buscar en el historial puede verlos. Ocultar retira un campeonato de la portada. Un dato publicado por error sigue en el historial después de ocultarlo; para quitarlo hay que reescribir el historial, como se hizo el 15/11/2026.
- Nunca entra un Excel en `campeonatos-borradores`, igual que en el repositorio público. Los borradores pueden llevar nombres de pila y primer apellido, como la web; la validación V06 se aplica en los dos casos.

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

- los dos repositorios, `ELIAN1603/campeonatos-domino` y `ELIAN1603/campeonatos-borradores`, y ningún otro, en «Repository access» (Only select repositories);
- permiso «Contents: Read and write» y ningún otro;
- caduca en noviembre de 2027.

Se pega una vez en `publicar.html`, en el equipo de la mesa, y se queda en el `localStorage` de ese navegador. No se manda por WhatsApp ni por correo, ni se escribe en el Excel o en el repositorio. Con el token se ven los borradores desde ese navegador.

Si el token no tiene acceso a `campeonatos-borradores`, la lista de borradores dice que falta «Repository access» y el resto de la página sigue funcionando: se puede subir a la web, ver, editar y eliminar lo que ya está en ella. Ocultar necesita los dos repositorios y se detiene en el primer paso, sin cambiar nada. Si solo puede leer, avisa de que falta «Contents: Read and write».

### Rotarlo

Conviene hacerlo antes de que caduque, o si cambia el equipo de la mesa.

1. En GitHub: Settings, Developer settings, Personal access tokens, Fine-grained tokens. Crea uno nuevo con el alcance de arriba (los dos repositorios) y una caducidad nueva, o usa «Regenerate token» en el existente.
2. En `publicar.html`, pulsa «Quitar el token», pega el nuevo y pulsa «Guardar y comprobar». La página comprueba los dos repositorios.
3. Borra el token antiguo en la misma pantalla de GitHub.
4. Anota la nueva fecha de caducidad en esta página y en la guía.

Si el token caduca o se pierde sin avisar, la página lo dice («GitHub no acepta el token…») y lo borra del navegador. No se pierde nada: se crea uno nuevo y se repite la acción.

### Si se filtra

Un token filtrado da acceso de escritura a la web y a los borradores privados.

1. Revócalo ya: GitHub, Settings, Developer settings, Fine-grained tokens, Delete. Es lo único urgente.
2. Mira los commits recientes de los dos repositorios. Los de la mesa llevan autor «Mesa de control» y mensajes como «Publicar <id>: jornada N», «Borrador <id>: jornada N», «Publicar borrador <id>», «Ocultar <id>», «Editar <id>» o «Eliminar <id>». Cualquier otro commit, o uno que toque algo fuera de `datos/`, hay que revisarlo.
3. Si hay cambios que no son nuestros, restáuralos con `git revert` o repón los archivos desde el último commit bueno. Presta atención a `assets/` y a las páginas HTML.
4. Lee los borradores por si alguien los ha copiado: contienen lo mismo que la web, pero aún sin publicar.
5. Crea un token nuevo como se explica arriba.
6. Mira el registro de seguridad de la cuenta (Settings, Security log) por si se ha usado en algo más.

## Revisar cuando cambie algo

Si se añade una página, tiene que llevar las tres etiquetas `<meta>` y ningún script ni estilo en línea. `pruebas/probar_seguridad.cjs` lo comprueba, y también que el token y la dirección de la API de GitHub solo aparecen en `assets/mesa.js`.

## Avisos de seguridad

Si ves algo raro en la web, escribe a la mesa de control. No lo publiques en un issue si incluye datos de personas.
