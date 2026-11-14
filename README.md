# Orbita Pets con pagos Pey

## Iniciar en Windows

Requiere Node.js 22 o superior. 
Abre http://127.0.0.1:8000/index.html y, desde el creador, abre la pantalla 2. Conserva el mismo navegador y origen para recuperar la coleccion guardada.

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
