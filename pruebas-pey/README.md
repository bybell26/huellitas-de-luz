# Laboratorio Pey

Ejecuta iniciar_pruebas.bat con Node.js 22 o superior y abre http://127.0.0.1:8010.

Genera un QR real de $0.01 MXN sin pedir datos. Escanea el codigo y pulsa Ya realice el pago para pasar a carga e iniciar la validacion. Usa el mismo controlador js/payment-flow.js de la aplicacion principal.

La validacion dura un maximo de 120 segundos. PAID por $0.01 MXN muestra Cobro aceptado. Sin confirmacion, muestra Cobro rechazado por tiempo agotado; no es una cancelacion ni un reembolso bancario. Las respuestas tardias no cambian ese resultado. Puedes iniciar otro cobro con el boton correspondiente.

La clave permanece en config.local.json o PEY_API_KEY en el servidor; no se publica. El laboratorio no agrega mascotas a la pantalla compartida; esa integracion esta en la aplicacion principal, iniciada con iniciar_windows.bat.

Pruebas desde la raiz: node --test js/payment-flow.test.cjs servidor_local.test.cjs pruebas-pey/server.test.cjs.
