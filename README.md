# Orbita Pets con pagos Pey

## Iniciar en Windows

Requiere Node.js 22 o superior. Cierra el servidor anterior y ejecuta iniciar_windows.bat. Abre http://127.0.0.1:8000/index.html y, desde el creador, abre la pantalla 2. Conserva el mismo navegador y origen para recuperar la coleccion guardada.

El servidor ahora es servidor_local.cjs; servidor_local.py queda como lanzador compatible que delega a Node.js. Live Server por si solo no proporciona /api/pey.

## Flujo de creacion y pago

1. Elige mascota, raza, collar y nombre.
2. Revisa y confirma el diseno.
3. Se genera un QR real de $0.01 MXN en lugar de la segunda confirmacion.
4. Escanea el QR con tu app bancaria y autoriza el pago.
5. Pulsa Ya pague, validar cobro. Se muestra la pantalla de carga y comienza un plazo de 120 segundos, consultando cada 2 segundos cuando no hay una consulta en curso.
6. Solo PAID por $0.01 MXN permite guardar la mascota y enviarla a display.html mediante el bus existente.
7. Sin confirmacion al vencer el plazo: Cobro rechazado por tiempo agotado. La mascota no se publica y las respuestas tardias se descartan.

El rechazo por tiempo agotado es una decision local: no cancela el QR, no representa un rechazo bancario y no devuelve dinero. Pey exige al menos 360 segundos de vigencia en un QR; se conserva la vigencia de 600 segundos. El plazo local de validacion es independiente.

Si el pago fue aprobado pero falla el guardado o la constelacion esta llena, puedes reintentar el envio sin volver a pagar. El ID de transaccion evita duplicar el envio en el mismo flujo. No recargues durante el cobro: el flujo activo de creacion esta en memoria.

## Clave y servidor

La clave se lee exclusivamente en el servidor desde pruebas-pey/config.local.json (excluido por .gitignore) o desde PEY_API_KEY en el entorno. No se entrega al navegador. El servidor publica unicamente las paginas y recursos de la aplicacion y escucha en 127.0.0.1:8000. Nunca publiques ni compartas el archivo de configuracion.

## Archivos principales

- index.html / display.html: creador y constelacion compartida.
- js/app.js: creador, pago y envio tras la aprobacion.
- js/payment-flow.js: generacion, validacion y limite de dos minutos.
- js/pets.js, storage.js, sync.js, animations.js, display.js: mascotas, persistencia, mensajes y exhibicion.
- css/: estilos compartidos y de cada pantalla.
- assets/: carpetas de recursos y capturas.
- pruebas-pey/: laboratorio independiente y modulo del servidor Pey.

## Verificacion

Ejecuta node --test js/payment-flow.test.cjs servidor_local.test.cjs pruebas-pey/server.test.cjs. Las pruebas usan respuestas simuladas y no generan cobros reales. Cubren aprobacion, rechazo a los 120 segundos, respuestas tardias, errores de red, monto fijo y acceso privado a la configuracion.

## Correcciones de persistencia y configuración

El backend de `backend/` debe estar iniciado además del servidor web en el puerto
8000. Ejecuta `npm run migrate` y `npm run dev` desde `backend/` con su `.env`
configurado. El lanzador web de Windows por sí solo no inicia PostgreSQL ni la API
de cuentas/salas en el puerto 4000.

Para crear mascotas nuevas, el servidor registra primero el QR a nombre de la
cuenta y después verifica su pago mediante `/api/pey`. El recibo de $0.01 MXN se
consume una sola vez. Los reintentos de la misma mascota conservan su ID y su
posición. Retirar una mascota de una sala conserva la mascota en la cuenta.

En móvil, API, pagos y WebSocket usan la misma configuración. Durante el
desarrollo se detecta el equipo de Metro; en un build configura
`EXPO_PUBLIC_API_URL` con la URL de tu backend (ver `mobile/.env.example`).
En un teléfono físico, `localhost` apunta al teléfono.

Comprobaciones:
- Web: `node --test js/*.test.cjs servidor_local.test.cjs pruebas-pey/server.test.cjs`.
- Backend: `cd backend` y `npm test` (requiere PostgreSQL; usa un esquema temporal
  aislado, lo elimina al terminar y simula Pey sin generar cobros).
- Móvil: `cd mobile`, `npm test`, `npm run typecheck` y `npm run lint`.

## Escenarios, fondos y donaciones extra (web)

En el modal de la constelación puedes elegir Constelación, Jardín o Parque.
La elección se recuerda localmente para esa sala. "Crear fondo" permite elegir
una o todas las mascotas, cambiar título y nombres, y descargar PNG en formato
celular (1080 × 1920) o computadora (1920 × 1080), sin servicios de imágenes
externos. También se ofrece al terminar de crear una mascota.

"Personalizar apariencia" agrega pelajes naturales, patrones, orejas, cola y
proporciones. Las opciones se guardan en la cuenta y se conservan al exportar.

El botón "Donar" de cada mascota permite elegir monto ($0.01 a $1,000 MXN) y
uno de dos trucos por especie. El servidor conserva propósito, destino y monto
del cobro; solo al verificar PAID por el monto esperado acumula la donación.
Cada recibo se utiliza una sola vez. Las donaciones extra no crean mascotas.
Los trucos son visuales, sin audio automático, y respetan movimiento reducido.
Cerrar el diálogo conserva el QR pendiente por cuenta y mascota en la pestaña;
al volver a abrirlo puedes consultar el mismo cobro sin generar otro.

Tras actualizar ejecuta `npm run migrate` desde `backend/`, reinicia el backend
y recarga el navegador. La migración agrega apariencia y donaciones y conserva
los datos anteriores.
