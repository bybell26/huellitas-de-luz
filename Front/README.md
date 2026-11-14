# Orbita Pets

ÓRBITA PETS 3.0 — CONSTELACIÓN MULTIMASCOTA EN DOS MONITORES
============================================================

QUÉ HACE
Crea avatares 2D de perros y gatos y envíalos a una pantalla de exhibición.
TODOS los avatares enviados permanecen flotando al mismo tiempo (hasta 42).
Cada uno tiene su propia animación, nombre y color de collar.

ESTRUCTURA DEL PROYECTO
- index.html / display.html: creador y pantalla de mascotas.
- css/global.css: base, componentes compartidos y keyframes.
- css/creator.css: formulario, vista previa y coleccion.
- css/display.css: escenario y mascotas flotantes.
- js/app.js: formulario y controles del creador.
- js/pets.js: razas, colores e ilustraciones SVG.
- js/storage.js: persistencia, validacion y preferencias.
- js/sync.js: mensajes entre ventanas e indicador de conexion.
- js/animations.js: posiciones, tamanos y nodos animados.
- js/display.js: renderizado y controles de la exhibicion.
- assets/dogs/, cats/, collars/, backgrounds/: carpetas para futuros recursos.
  Las mascotas y collares actuales se generan como SVG en js/pets.js;
  los fondos se dibujan con CSS.
- assets/screenshots/: capturas de demostracion originales.
- iniciar_windows.bat / servidor_local.py: servidor local sin dependencias.

Los scripts usan defer en orden: pets, storage, sync y la entrada de cada
pagina (animations antes de display). Se conservan las claves de
localStorage y el puerto 8000. No se requiere package.json ni compilacion.

INICIAR EN WINDOWS (RECOMENDADO)
1. Descomprime el ZIP COMPLETO en una carpeta.
2. Con Python 3 instalado, haz doble clic en "iniciar_windows.bat".
   Deja abierta la ventana del servidor (sin Internet, sin dependencias).
   Abre en el navegador http://127.0.0.1:8000/index.html.
3. Alternativa sin Python: usa la extensión Live Server de VS Code
   desde index.html (siempre con el MISMO puerto y origen).
4. Haz clic en "Abrir pantalla 2" desde la estación de creación.
5. Mueve esa nueva ventana al segundo monitor. En Windows, con la
   ventana seleccionada, prueba Win+Shift+Flecha derecha/izquierda.
6. En el monitor 2, haz clic en "Pantalla completa" (o F11).
7. Crea una mascota desde el monitor 1. Cada nueva llegada SE SUMA
   a las anteriores en la pantalla 2.

CREACIÓN SIMPLIFICADA
1. Elige perro o gato.
2. Elige una de las cinco razas ofrecidas para esa especie.
3. Elige color del collar (6 tonos) y opcionalmente un nombre.
4. Primera confirmación: aprobar el diseño.
5. Segunda confirmación: enviar a la constelación.
6. Animación de progreso y nueva llegada flotante.
7. Pulsar "Crear otra mascota" y repetir.

CONTROLES
DESDE EL MONITOR 1
- Abrir pantalla 2.
- Ver indicador de conexión y contador de mascotas (0/42).
- Ver colección de mascotas con nombres, raza y collar.
- Retirar una mascota concreta mediante el botón X y confirmación.
- Repetir la entrada animada de la mascota más reciente.
- Pausar o reanudar el movimiento de todas.
- Vaciar la colección completa con confirmación.

DESDE EL MONITOR 2
- Pantalla completa.
- Pausar o reanudar animación (también actualiza el monitor 1).
- Mostrar u ocultar los nombres y razas de las mascotas.
- Contador de mascotas en la parte superior.

CÓMO FUNCIONA LA SINCRONIZACIÓN
- Las dos páginas deben estar abiertas en el MISMO navegador y origen
  (mismo protocolo, nombre de host y puerto).
- Usa localStorage del navegador y BroadcastChannel (con respaldo de
  eventos storage) para las actualizaciones entre las dos ventanas.
- El contenido se almacena SOLO en ese navegador y origen. No se
  transmite a la nube ni necesita cuentas o una base de datos.
- La colección se conserva al recargar y reabrir el navegador, salvo
  cuando la vacíes o borres los datos de navegación.
- El programa importa automáticamente el último avatar de v2 SI la
  versión anterior se utilizó con el mismo origen y todavía no existe
  una colección v3. Después no vuelve a importarlo.
- No funciona entre dos dispositivos independientes: eso requeriría
  un servidor de sincronización en red.

RENDIMIENTO Y LÍMITES
- Máximo 42 mascotas para asegurar posiciones disponibles.
- Cuando hay muchas mascotas, su tamaño baja automáticamente y las
  etiquetas de raza se ocultan para evitar amontonamientos.
- Cada mascota conserva su ubicación (slot) al añadir o quitar otras.
- Son ilustraciones SVG en 2D, no modelos 3D.
- En equipos lentos, usa el control Pausar movimiento.
- No abras index.html o display.html por file://, ya que el acceso
  al almacenamiento puede variar según navegador. Usa servidor HTTP.
- El mismo localhost no equivale a 127.0.0.1; evita mezclar dominios
  o puertos, porque tienen almacenamientos distintos.

VERIFICACIÓN RÁPIDA
[ ] Ambas ventanas abiertas en el mismo origen.
[ ] Indicador "Pantalla 2 conectada" en el monitor 1.
[ ] Una mascota nueva aparece y no borra las anteriores.
[ ] Las mascotas siguen ahí tras recargar la pantalla 2.
[ ] La pausa, nombres y eliminación individual responden.
[ ] El botón Vaciar todas requiere confirmación.

CÓDIGO Y USO
Proyecto autónomo HTML/CSS/JavaScript. No usa librerías externas.
Compatible con navegadores modernos Chrome o Microsoft Edge en Windows.

INTEGRACION CON LA API DE DONATIVOS (Mascotas Solidarias)
- Tras enviar la mascota aparece el boton 'Donar y descargar'. Crea una orden, muestra el QR CoDi de Pey, espera el pago y descarga un PNG con el avatar y su nombre.
- js/api.js: URL de la API (window.ORBITA_API_BASE, por defecto http://localhost:5160), monto mostrado ($10) y monto enviado al back (0.01).
- js/donation.js: pantallas de QR, loader, temporizador, pago y descarga.
- js/qrcode.js: libreria qrcode-generator 1.4.4 (MIT), respaldo para dibujar el QR en modo Demo.
- Requiere la API encendida en http://localhost:5160 (ver Back/MascotasSolidarias/CONTEXTO.md). El CORS de la API ya permite http://127.0.0.1:8000.
- En modo Demo de la API aparece el boton 'Simular pago (demo)'.
