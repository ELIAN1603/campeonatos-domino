/* Palabras comunes en español, sin tildes, para proponer contraseñas de 5 palabras (assets/cifra.js). Una frase de 5 palabras al azar de esta lista da unos 56 bits. */
(function (raiz) {
  'use strict';
  const P = (
    'abanico abecedario abedul abeja abeto abierto abismo abogada abogado abono abrazo abrigo abril abrir absoluto abuela ' +
    'abuelo acacia acampada aceite aceitera aceituna acelga acento acequia acera acero acertijo acierto acordeon acta ' +
    'activo actual actuar acuario acuerdo adivinar adivino admirar adobe adorno aduana adulto aerosol afan afecto agarrar ' +
    'agenda agil agosto agradable agricultor agua aguacate aguacero agudo aguijon aguila aguja ahijado ahorro aire ajedrez ' +
    'ajuar alacena alambique alambre alamo alarma alba albahaca albañil albergue albondiga alcachofa alcalde alcanzar ' +
    'alce alcoba aldaba aldea alegato alegrar alegre alegria alero aleta alfiler alfombra alforja alga algodon alhaja ' +
    'alianza aliento alivio alma almacen almeja almendra almendro almirez almohada almorzar almuerzo alondra alpaca altar ' +
    'altavoz alto altura alubia alumno amable amanecer amapola amar amargo amarillo ambiente ameba amigo amistad amor ' +
    'amplio amuleto anaquel anca ancho anchoa ancla andamio andar anden anfibio anfora angel anguila angula anillo animal ' +
    'animo anis anochecer anotar antena antiguo antilope antojo anual anuncio anzuelo apacible apagar aperitivo apetito ' +
    'apio aplaudir aplauso apodo aprender aprendiz apuntar apunte arado arandano arandela araña arbitro arbusto arce ' +
    'archivo arcilla arco arcon ardiente ardilla arena argolla arista armadillo armadura armario armonia aroma arpa arquero ' +
    'arrecife arreglar arreglo arriero arroyo arroz arte artista asado ascensor asiento asno aspecto astilla astro asunto ' +
    'atajo atar atardecer atento atlas atleta atolon atuendo atun audaz audiencia aula aureola aurora autobus autor avanzar ' +
    'avellana avena aventura avestruz avion avispa ayuda ayudar azada azafran azahar azotea azucar azul azulado azulejo ' +
    'babero bacalao badajo bagaje bahia bailar baile bajada bajar bajel bajo balanza balcon balde baliza ballena balon ' +
    'balsa bambu banco banda bandeja bandera banquete baraja barandilla barato barba barbero barca barco barniz barquero ' +
    'barquillo barrer barrera barril barrio barro base bastidor bastion baston bata bateria batido batuta baul baya bazar ' +
    'bañera beber bebida belleza bello bellota bengala berenjena berro beso besugo betun biblioteca bigote billete biombo ' +
    'bisonte bizcocho blanco blando bloque blusa bobina boca bocadillo bocina boda bodega bodegon bola bolera bolero ' +
    'boletin boligrafo bollo bolo bolsa bolsillo bombero bombilla bombo bombon bombona bondad bonito boquete borde borla ' +
    'borrador borrar borrasca bosque bota botella botijo botin boton boveda boya bozal brasa bravo bravura brazo brebaje ' +
    'breve brida brillante brillar brillo brincar brisa brocha broche brocoli brote brujula bruma buceo budin bueno buey ' +
    'bufalo bufanda bufete buho buitre bujia bulto burbuja buscar butaca buzon cabalgata caballo cabaña cabello caber ' +
    'cabestro cabeza cabina cable cabo cabra cabrito cacao cacerola cacharro cachorro cactus cadena cadera cadete caer ' +
    'cafe cafetal cafetera caja cajon calabacin calabaza calamar calcetin calcio caldero caldo calendario calentar calesa ' +
    'calidad calido caliente caliz callado callar calle callejon calma calmado calor calzada calzado cama camaleon camara ' +
    'camarero cambiar camello camilla caminante caminar camino camion camisa campana campesino campista campo campus ' +
    'canal canalon canario canasta cancion candado candil canela cangrejo canguro canica canoa cansancio cantar cantera ' +
    'canto capa caparazon capaz capilla capitan capote capricho capucha cara caracol caramelo caravana carbon carbonero ' +
    'carcajada cardo cardumen carey carga cargar cariño cariñoso carne caro carpeta carpintero carrera carreta carroza ' +
    'carrusel carta cartel cartera cartero cartilla cartulina casa casaca casar cascabel cascada cascara casco caserio ' +
    'casero caseta castaña castaño castañuela castillo castor catalejo catedral catre caudal caudillo causa caverna caza ' +
    'cazar cazo cazuela caña cañon cebada cebo cebolla cebra cedro cefiro ceja celaje celda celeste cemento cena cenar ' +
    'cencerro cenicero ceniza centella centeno central centro cepillar cepillo cera cerca cercano cerebro cereza cerezo ' +
    'cerilla cerrajero cerrar cerrojo certamen certero cesped cesta cesto chal chaleco chalupa champu chapa chaqueta ' +
    'charanga charco charla charlar charol chimenea chimpance chincheta chirimoya chispa chiste chocar chocolate chopo ' +
    'chorizo choza chubasco chumbera churro ciclista ciclon cielo ciervo cierzo cifra cigarra cigueña cima cimiento cinco ' +
    'cine cinta cinturon circo circulo cirio ciruela cisne cisterna citara ciudad clarin claro clase clasico claustro ' +
    'clavel clavo clima cloro club cobertizo cobijo cobre coche cocido cocina cocinar coco cocodrilo codo codorniz cofradia ' +
    'cofre coger cohete cojin cojinete cola colada colchon colegio colgar colibri coliflor colina collar colmena colmillo ' +
    'colocar colono color colorete columna comedor comer comercio cometa cometer cometido comida comino comodo compas ' +
    'compota comprar comun concha concierto concurso condor conducir conejo consejo conserje contar contento copa copiar ' +
    'copo coral corazon corbata corcel corcho cordel cordero cordillera cordon cornisa coro corona corpiño corral correo ' +
    'correr cortar cortejo cortes corteza cortina corto cosecha coser cosmos costa costal costilla costumbre costurero ' +
    'cotorra coyote craneo crater crear crecer credo crema cremoso cresta criba crisol cristal cronica crujiente cruzar ' +
    'cuaderno cuadrado cuadrilla cuadro cuartel cuarto cubierta cubilete cubo cuchara cuchillo cuclillo cuello cuenca ' +
    'cuenco cuento cuerda cuerno cuero cuervo cuesta cueva cuidador cuidar culebra cumbre cumplir cuna cuneta cupula ' +
    'curioso curtido curva cuñado dado dalia dama damasco danza dardo datil debate debil decena decente decidir decir ' +
    'dedal dedo dejar delantal deleite delfin delgado delta denso deporte deposito derecho desayunar descansar deseo ' +
    'desfile desierto despierto destino desvan detalle diadema diamante diana diario dibujar dibujo diente diestro dieta ' +
    'digno diluvio dinero dintel diploma directo disco discreto disfraz distinto divertido doble domingo dorado dormir ' +
    'dotes ducado ducha ducharse duelo dueño dulce dulzura duna durar durazno duro ebano echar ecuador edad edicion edificio ' +
    'efecto ejemplo elefante elegante elegir elixir embajada emblema embudo emisora empanada empezar empeño empujar encaje ' +
    'encargo encender enchufe encina encomienda encontrar enebro energia enero enigma enlace enorme ensalada ensayo enseñar ' +
    'ente entero entrada entrar envase enviar envio episodio epoca equipaje equipo erizo ermita escabeche escalera escalon ' +
    'escama escarcha escenario escoba escoger esconder escribir escritor escuchar escudo escuela esfera esmeralda espacio ' +
    'espada espalda esparto especia espejo esperar espeso espiga espina espinaca esponja espuma esqueleto esqui esquina ' +
    'establo estaca estacion estampa estanque estatua estepa estilo estirpe estrecho estrella estrofa estuche estudiar ' +
    'estudio estufa etapa eterno eucalipto evento exacto examen exito explicar fabrica fabula faceta facha factura faena ' +
    'fagot faisan fajin falda familia famoso fanal fango fantasia farmacia faro farol fauna favor fecha feliz felpudo ' +
    'feria fermento fertil festival fiambre ficha fideo fiel fieltro fiesta figura fijar fila filete filo finca fino ' +
    'fiordo firma firmar firme flaco flan flauta flecha flequillo flexible flor flora florero flotar foca fogon follaje ' +
    'folleto fonda fondo fontanero forastero forma formar fortuna fosa fosforo foto fragua frambuesa franela frasco frazada ' +
    'fregar frente fresa fresco fresno frio frontera fruta fruto fuego fuelle fuente fuerte fuerza fulgor funda furgon ' +
    'futbol futuro gabardina gacela gacho gafas gaita gajo galeon galeria galgo galleta gallina gallo galope gamba gamuza ' +
    'ganado ganar ganso garaje garbanzo garbo garganta garita garra garza gasa gasolina gaviota gazpacho gema gemelo ' +
    'general generoso genio gente gentil geranio germen gesto gigante gimnasio girar girasol giro glaciar globo gloria ' +
    'golfo golondrina golosina goma gondola gorila gorra gorrion gota gozo grabado grada grajo granada grande granito ' +
    'granizo granja grano grato grava grieta grifo grillo gris gritar grito grua grueso grupo gruta guante guapo guardar ' +
    'guardia guarida guepardo guiar guijarro guinda guion guisante guiso guitarra gustar gusto haba habano habil habitacion ' +
    'hablar hacer hacha hada halcon hallar hamaca hamster harina haya hebilla hechizo hectarea helado helar helecho heno ' +
    'herencia hermano hermoso heroe herrador herradura herrero hervir hiedra hielo hierba hierro higado higo hilo himno ' +
    'hipico hipopotamo hocico hogar hoguera hoja hojaldre hombrera hombro honda hondo hongo honor honrado hora horizonte ' +
    'hormiga horno horquilla hortaliza hospital hotel hoyo hueco huella huerta huerto hueso huesped huevo huir humilde ' +
    'humo humor icono idea ideal iglu igual iguana imagen imaginar iman imperio impulso incienso indice infancia ingenio ' +
    'injerto inmenso insecto instante intenso invento invierno invitar isla istmo jabali jabon jacinto jaguar jaleo jamon ' +
    'jarabe jardin jardinera jardinero jarra jarron jaspe jaula jazmin jefe jengibre jinete jirafa jornada jornal joven ' +
    'joya jubilo judia juego jueves juez jugar juglar jugo juguete juicio julio junco jungla junio junta juntar jurado ' +
    'justicia justo kiwi koala laberinto labio labor labrador lacre ladera ladrillo lagartija lagarto lago lagrima laguna ' +
    'lamina lampara lana lancha langosta lanza lanzar lapa lapiz largo larguero lata latido latitud laurel lavabo lavanda ' +
    'lavar lazo leal leccion leche lechuga lechuza lector leer legado legion legumbre lejania lejano lejia lema lemur ' +
    'lengua lenteja lentejuela lento leon leopardo letra letrero levadura levantar leyenda leña leñador libelula libertad ' +
    'libre libreta libro licencia liebre lienzo liga ligero lima limon limonero limpiar limpio linaje lince lindo linea ' +
    'lingote lino linterna liquido lirica lirio liso lista listo litera litoral llama llamar llano llanura llave llavero ' +
    'llavin llegar llenar lleno llevar llorar llover lluvia lobezno lobo locomotora lodo loma lona longitud loro losa ' +
    'lucero lucha luchar lucido luciernaga lugar lujo lujoso lumbre luna lunes luneta lupa lustre macarron maceta madeja ' +
    'madera madre madroño maduro maestro magia magico magnolia maiz majuelo malabar malecon maleta malva manada manantial ' +
    'mancha mandar mandarina mandil manejar manga mango manivela manjar mano mansion manso manta mantel manzana manzanilla ' +
    'manzano mapa mapache maqueta maquina maraton maravilla marcar marco marea marfil margarita margen marido marinero ' +
    'marino marioneta mariposa marisco marmita marmol marmota marques martes martillo martin marzo masa mascara mascota ' +
    'mastil mate matorral matriz mayo mazo mazorca mañana mecanico mecedora mecha medalla mediano medianoche medico medida ' +
    'medir medusa mejilla mejor melocoton melodia melon meloso membrillo memoria mendrugo menta menu menudo mercado mercurio ' +
    'meridiano merienda merluza mermelada mesa meseta mesita meta metal metodo metro mezcla mezclar miel miercoles mijo ' +
    'milagro milano milla mimbre mimo mina minero minimo minuto mirada mirador mirar mirlo mirto mision misterio mitad ' +
    'mito mocasin mochila moda modelo moderno mofeta mojado molde mole molinero molino momento monasterio moneda mono ' +
    'montar montaña monte monumento moqueta mora morado moral morcilla morder moreno morsa mortero mosaico mostaza mostrador ' +
    'mostrar motivo motor mover movil mozo moño mucho mudanza mueble muela muelle mula muleta multitud mundo muralla ' +
    'murcielago murmullo muro museo musgo musica muslo muñeca muñeco nabo nacion nadar naipe naranja naranjo nardo nariz ' +
    'narrador nata natillas natural nave navegar navidad navio neblina nectar negro nenufar nervio nevar nevera nicho ' +
    'nido niebla nieto nieve ninfa nispero nivel niñez noble noche nogal nomada nopal normal norte nota notar noticia ' +
    'novela noviembre novio nube nuca nudo nuevo nuez numero nutria oasis oboe obra obrero ocaso oceano ocio ocre octubre ' +
    'oculto ocupar odisea oferta oficina ofrenda ojal ojera oleaje oleo oler olfato oliva olivo olla olmo olvidar olvido ' +
    'ombligo onda opera opinion orador orbita orca orden ordenar oregano oreja orfebre organo orgullo orilla orquesta ' +
    'orquidea ortiga oruga osadia oscuro ostra otero otoño oveja ovillo oxigeno pabellon paciente pacifico pacto padre ' +
    'padrino paella pagar pagina pagoda paisaje paja pajarita pajaro pala palabra palacete palacio palanca palco paleta ' +
    'palillo palique palma palmera palo paloma panaderia panal pancarta panda pandero panecillo panorama pantalon pantano ' +
    'pantera papagayo papaya papel papilla paquete parada parador paraguas paramo parar parcela pardal pardo pared pareja ' +
    'parpado parque parra parral partir partitura pasaje pasajero pasar pasear pasillo pasion paso pasta pastel pastilla ' +
    'pastor pastora pata patata patin patio pato patrulla pausa pavimento pavo payaso pañuelo peca pecera pecho pedal ' +
    'pedestal pedir pegar pegaso peinar peine pelaje pelicano pelicula pelota peluca pendiente peninsula pensar peon ' +
    'peonza pepino pequeño pera peral percebe percha perder perdiz perejil perfecto perfume periodico perla perol perro ' +
    'persiana persona pesado pesca pescado pescador pescar pesebre pestaña petaca petalo peñasco piano picaporte pichon ' +
    'picnic pico piedra piel pierna pijama pila pilar piloto pimienta pimiento pinar pincel pinguino pino pinsapo pintar ' +
    'pinza pipa pirueta pisada pisar piscina pista pistacho pizarra pizca piña piñon placa plancha planchar planeta planicie ' +
    'plano planta plantar plantel plata platano plateado platillo plato playa plaza plazuela pleno plomo pluma pluvial ' +
    'pobre poder poema poeta polea polen pollo polvo pomada pomelo pompa poncho poner poniente portada portal portico ' +
    'porvenir postal postigo postre potro pozo pradera prado precio preciso preguntar preludio premio preparar presa ' +
    'primavera primero primo princesa prisa prisma proa probar profundo promesa pronto propina propio provincia prudente ' +
    'publico puchero pueblo puente puerro puerta puerto pulmon pulpo pulsera puma punto pupitre puro puño quedar querer ' +
    'quesera queso quijote quilla quimica quinta quiosco quiste quitar rabano racimo radar radio rafaga raiz raja rama ' +
    'rambla rampa rana rancho ranura rapido rapsoda raro rasgo rastrillo rastro ratito raton raya rayo real rebaño rebeca ' +
    'recado receta recoger recordar recreo recto recuerdo redondo refugio regadera regalo regar regata regla reina reir ' +
    'relampago relato relieve relleno reloj relojero remanso remar remo remolacha remolino renacuajo rendija reno repetir ' +
    'repisa reposo reptil resina resorte respirar respiro responder retablo reto retrato retumbo reunir revista ribera ' +
    'rico riel rienda rima rincon risa ritmo rito rival rizado rizo riñon roble robot robusto roca rocio rodaja rodeo ' +
    'rodilla rojo rollo romance rombo romero rompeolas romper ronda rosa rosado rosal rosco rosquilla rubi rubio rueda ' +
    'ruido ruiseñor ruleta rumbo rumor ruta sabado sabana saber sabio sabor sabueso sacapuntas sacar saco safari sainete ' +
    'salado salamandra salero salina salir salitre salmon salon salpicon salsa saltar salto salud saludar salvia sanatorio ' +
    'sandalia sandalo sandia sano santuario sardana sardina sarmiento sarten sastre sastreria satelite sauce savia saxofon ' +
    'sazon secano secar secreto sector seda seguir seguro sello selva semaforo semana semblante sembrar semilla sencillo ' +
    'senda sendero sensacion sentar sentir septiembre serenata sereno serio serpiente servilleta servir sesion seta señal ' +
    'sierra siesta sifon siglo silbar silbato silencio silla silueta simple sincero sinfonia sirena sirope sitio soberano ' +
    'sobre sobrino socio sofa solapa solar soledad solido sollozo soltar sombra sombrero sombrilla sonar sonata sondeo ' +
    'sonido sonoro sonrisa sopa sopera soplar sorbete sorbo sorpresa sorteo sortija sosiego sotano soñar suave subir ' +
    'suceso sudor suegro suela suelo suerte sueño sultan sumar sumidero surco suspiro sutil taberna tabla tablero taburete ' +
    'taco tacon tajada talento talla taller tallo talon tambor tamiz tanque tapa tapadera tapar tapete tapiz taquilla ' +
    'tardar tarde tarea tarjeta tarro tarta tartana tatuaje taza teatro techo teclado tejado tejedor tejer tejo tejon ' +
    'tela telar telefono telon temblar tempano templo tenaza tendera tendero tenedor tener tenis terciopelo terminar ' +
    'termo ternera terraza terron tertulia tesoro tetera tibio tiburon tiempo tienda tierno tierra tigre tijera tilo ' +
    'timbre timon tinaja tinglado tinta tintero tiovivo tirantes tirar titere titulo tiza toalla tobillo tobogan tocar ' +
    'tocino tomar tomate tomillo tonel topacio topo torero tormenta tornillo toro torre torrente tortilla tortita tortuga ' +
    'tostada totem trabajar trabajo tractor traer tragar traje trampolin tranquilo trapecio trapo travesia trazo trebol ' +
    'tren trenza trepar triangulo tribu triciclo trigo trillo trineo tripulante triste trofeo trompeta trompo tronco ' +
    'trono tropel trovador trucha truco trueno tubo tuerca tulipan tundra tunel turista turno turron ultimo ultramar ' +
    'umbral unico uniforme universo urbano urna urraca usanza usar utensilio util vaca vagabundo vagon vaina vainilla ' +
    'vajilla valiente valija valla valle valor vals vapor vasija vaso vecino vegetal vehiculo vela velada velero veleta ' +
    'veloz vena vendaval vender vendimia venir ventana ventisca ventura verano verbena verdadero verde verdura vereda ' +
    'verja verso vertiente vestibulo vestido veterano viajante viajar viaje viajero vibora victoria vida vidrio vieira ' +
    'viejo viento viernes vigia vinagre vinilo violeta violin virtud visera visitar vista vitrina vivero vivir vivo viñedo ' +
    'vocal volante volar volcan voltio voluntad volver votar vuelo vuelta yacimiento yate yegua yelmo yema yeso yogur ' +
    'yugo yunque zafiro zagal zaguan zamarra zambomba zanahoria zanja zapatilla zapato zarza zarzamora zepelin zinc zocalo ' +
    'zona zorro zumo zurron'
  ).split(' ');
  if (typeof module !== 'undefined' && module.exports) module.exports = P; else raiz.Palabras = P;
})(typeof window !== 'undefined' ? window : globalThis);
