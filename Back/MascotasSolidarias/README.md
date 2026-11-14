# Mascotas Solidarias — Backend para Visual Studio

API C#/.NET 10 para ordenar un retrato, crear QR CoDi mediante pey, registrar el pago y habilitar la subida de la foto, la generación y la descarga. **MVP local funcional, no sistema de producción auditado ni despliegue AWS.**

## 1. Abrir y ejecutar

1. Instala el SDK **.NET 10** desde Microsoft y una versión de Visual Studio compatible con él (Visual Studio 2026). En el instalador selecciona «ASP.NET y desarrollo web». Si tienes VS 2022, usa Visual Studio actualizado o ejecuta mediante la terminal con el SDK 10; no cambies el framework a una versión fuera de soporte solo para compilar.
2. Descomprime el ZIP y abre `MascotasSolidarias.sln`.
3. Restaura paquetes NuGet y compila. Selecciona `Mascotas.Api` como proyecto de inicio.
4. Ejecuta con F5. Se abre `https://localhost:7160`. También está disponible `http://localhost:5160` para pruebas locales.
5. Si falta confianza del certificado local, ejecuta `dotnet dev-certs https --trust` en tu equipo después de revisar la petición de confianza.

Terminal alternativa:
```sh
dotnet restore
dotnet build -c Release
dotnet run --project src/Mascotas.Api
```

**Por defecto todo es DEMO:** no contacta pey, no genera QR bancario real, no cobra y no llama a un proveedor de IA. El resultado es un SVG marcado «DEMO», no una transformación de la foto. SQLite se crea automáticamente en `src/Mascotas.Api/App_Data/mascotas.db`; fotos y resultados están en la misma carpeta privada. No borres esa carpeta para actualizar código: contiene operaciones e imágenes.

## 2. Estructura

- `Program.cs`: endpoints, validación, autorización por orden y configuración.
- `Models/Order.cs`: entidades y estados.
- `Data/AppDb.cs`: SQLite / EF Core, índices únicos de QR y transacción.
- `Services/PeyClient.cs`: cliente HTTP real y sustituto demo.
- `Services/WebhookVerifier.cs`: verificación Standard Webhooks v1 HMAC-SHA256 sobre bytes originales, tolerancia de 5 minutos, comparación constante.
- `Services/Images.cs`: worker persistente por estados de BD, generador demo y adaptador HTTP para el servicio de imágenes del equipo.
- `tests/smoke.py`: prueba de flujo y seguridad sin cobros externos.

## 3. Contrato para el frontend

> **Estado actual:** el front del repo (`../../Front`) usa solo crear orden, QR y consulta de estado. Al llegar a `PAID` genera el PNG del avatar en el navegador. Subir foto y la generación con IA siguen en la API, pero ese front no las usa. Detalle en `FRONTEND.md` y `CONTEXTO.md`.

Todas las rutas de orden salvo crear necesitan `Authorization: Bearer <orderToken>`; token secreto devuelto solo al crear. No exponerlo en URLs, logs, QR, ni repositorios. Para el MVP guárdalo en memoria o sessionStorage; evita scripts de terceros y XSS. En producción sustituir por cuentas/sesiones con autenticación completa.

| Método | Ruta | Función |
|---|---|---|
| POST | `/api/orders` | Crear orden con `amountMxn` (y `style` opcional) |
| GET | `/api/orders/{id}` | Consultar estado y permisos de botones |
| POST | `/api/orders/{id}/qr` | Crear o devolver el mismo QR pendiente |
| POST | `/api/orders/{id}/photo` | Subir la foto (bytes PNG/JPEG, máx. 5 MB) solo si la orden está pagada; encola la generación |
| GET | `/api/orders/{id}/download` | Descargar archivo solo si está listo |
| POST | `/api/webhooks/pey` | Recibir evento de pey, sin token de orden; exige firma válida |
| POST | `/api/orders/{id}/simulate-payment` | Solo Development + Demo; simula pago |

Crear orden:
```json
{
  "amountMxn": 10.00,
  "style": "cartoon"
}
```
`style` es opcional (por defecto `cartoon`). Estilos permitidos: `cartoon`, `watercolor`, `astronaut`. La foto ya no se manda al crear: se sube después del pago con `POST /api/orders/{id}/photo`. Foto hasta 5 MB, verificación de cabecera PNG/JPEG; el proveedor de imágenes debe decodificar/validar por completo, limitar dimensiones y eliminar metadatos. El importe mínimo se configura con `App:MinAmountMxn` (por defecto 0.01 durante las pruebas; subirlo a 10 en producción) y el máximo es 1000 MXN, con dos decimales. Monto almacenado en centavos enteros.

Respuesta QR: `qrId`, `qrString`, `qrImage` (PNG base64 o null), `qrExpiresAt` (Unix), `isDemo`. Si `qrImage` es null, el front debe renderizar exactamente `qrString` con una biblioteca QR; nunca IA. En Demo no lo presentes como QR cobrable.

Estados:
```
CREATED -> QR_CREATING -> PENDING_PAYMENT -> PAID
  (subir foto) -> GENERATION_QUEUED -> GENERATING -> READY
```
Errores: `QR_REVIEW_REQUIRED` (resultado de llamada incierto), `PAYMENT_REVIEW_REQUIRED` (pago tardío/anómalo), `GENERATION_FAILED` (no se reintenta/cobra automáticamente). Un pago distinto adicional o de importe incorrecto requiere conciliación manual en pey. No hay endpoint de reembolso ni se promete reembolso automático.

UI: crear orden → pedir QR → consultar estado cada 3 segundos → habilitar la subida de la foto cuando `canUploadPhoto=true` → subir la foto → consultar hasta `canDownload=true`. El usuario paga en su banco; esta API **crea el cobro y recibe confirmación**, no debita su cuenta. Para descargar usa `fetch` con Authorization y crea un object URL del blob: un enlace HTML normal no puede enviar ese encabezado.

## 4. Prueba rápida sin gastar

Usa `demo.http` (Visual Studio HTTP editor) o Postman. Crea la orden, copia `id` y `orderToken`, pide QR, simula pago, sube la foto, consulta y descarga. La web raíz es una respuesta JSON informativa. Swagger está en `http://localhost:5160/swagger` (solo en Development).

Prueba automática (Python 3):
```sh
dotnet build -c Release
python tests/smoke.py
```
Verifica flujo demo, prohibición de generar sin pago, acceso sin token, QR repetido, generación repetida, firma incorrecta, timestamp viejo, cuenta/monto incorrectos, eventos duplicados y ausencia del simulador en modo pey. Modo pey de prueba usa una fixture SQLite y no llama al proveedor.

## 5. Activar pey real, solo cuando esté autorizado

Antes: confirmar con organizadores la beneficiaria autorizada y titular de las credenciales/cuenta, aviso de privacidad, consentimiento para enviar foto al proveedor de IA, desglose de destino del dinero y política de fallo/reembolso. **Las cuentas de prueba pueden mover dinero real.** No subir llaves al repo ni escribirlas en el chat.

La configuración también se lee de `src/Mascotas.Api/appsettings.Local.json` (las variables de entorno tienen prioridad). Alternativa: clic derecho proyecto → Administrar secretos de usuario. Ejemplo de estructura, reemplazando cada marcador localmente:
```json
{
  "App:Mode": "Pey",
  "App:ApiKey": "TU_LLAVE_PRIVADA",
  "App:ApiKeyId": "ID_DE_LA_LLAVE",
  "App:WebhookSecret": "whsec_SECRETO_ENTREGADO_POR_PEY",
  "App:BankAccountId": "",
  "App:ImageProvider": "Http",
  "App:ImageServiceUrl": "https://TU-SERVICIO/generate",
  "App:ImageServiceKey": "SECRETO_SERVIDOR_A_SERVIDOR"
}
```
`BankAccountId` vacío usa la cuenta ligada a la API key. Si se especifica, debe ser la autorizada y se exige que el webhook la reporte. ApiKeyId es opcional: si está configurado, siempre se compara; si está vacío, el webhook se autentica solo con la firma y se registra en el log el `apiKeyId` recibido para poder copiarlo (Pey no lo expone por API). `App:AllowDemoImageInPey=true` permite arrancar en modo Pey con el generador Demo; úsalo solo para pruebas. La aplicación se niega a arrancar en modo real con generador Demo, salvo con `App:AllowDemoImageInPey=true`. User Secrets se usa en Development; en servidor configura variables de entorno (`App__ApiKey`, etc.) o gestor de secretos. No usar estos ejemplos como credenciales.

Publica primero en un HTTPS autorizado y registra en pey su URL `/api/webhooks/pey`; localhost no es accesible desde pey. Ajusta AllowedHosts a tu hostname y CorsOrigins al front real. CORS no autentica al proveedor. Usa el secreto específico del webhook. Al fallar la firma devuelve 401; al desconocer un QR devuelve 503 para permitir reintento; no marca como pagado por datos del navegador.

La creación QR real usa `POST https://api.pey.mx/codi/qr`, expiración de 900 segundos, monto fijo, referencia numérica de hasta 7 dígitos, `generateImage=true`, metadata con orderId. Si hay timeout/error no se repite automáticamente: el QR podría haberse creado. Revisa pey y concilia antes de crear otra orden.

## 6. Conectar al equipo que genera imágenes (en pausa)

El flujo actual del front no genera imágenes con IA, así que esta sección solo aplica si se retoma la subida de foto.

El adaptador `HttpImageGenerator` espera que **su servicio** implemente:
```
POST https://su-servidor/generate
Authorization: Bearer <ImageServiceKey>
Content-Type: application/json
```
```json
{"orderId":"...","style":"cartoon","photoBase64":"..."}
```
Respuesta:
```json
{"pngBase64":"..."}
```
PNG válido hasta 10 MB. Servicio debe validar su token, limitar tamaño/dimensiones, y deduplicar por orderId para evitar cargos por reintentos manuales. Timeout 90 s; sin reintentos automáticos. Este adaptador **no es integración lista con OpenAI/Bedrock**: el equipo debe elegir/proveer el generador, o reemplazar `IImageGenerator`. El worker obtiene foto desde almacenamiento privado y nunca descarga URLs elegidas por usuarios.

## 7. Qué falta antes de producción/AWS

Esta entrega ejecuta **un solo proceso** con SQLite y disco local. No subir tal cual a Lambda: disco/worker no son durables allí. Para AWS: sustituir BD por DynamoDB o BD administrada, archivos por S3 privado, cola/worker por SQS + Lambda, secretos por configuración segura; añadir autenticación, cuotas atómicas globales, observabilidad, recuperación/conciliación, expiración/retención y borrado de fotos. `MaxOrders` y rate limit son controles básicos locales, no un límite financiero infalible. No hay limpieza automática de imágenes ni migraciones de esquema incluidas: documentar retención y usar migraciones al cambiar el modelo.

El estado GENERATING se convierte a fallo al reiniciar para no duplicar inferencia facturada. GENERATION_QUEUED sí sobrevive al reinicio. No ejecutar dos instancias con esta política de recuperación. SQLite tiene limitaciones de concurrencia; si rechaza una escritura webhook puede reintentarse sin perder la deduplicación transaccional.

Detrás de ngrok u otro proxy se usa `UseForwardedHeaders`, así que el rate limit (120 peticiones por minuto por IP) aplica a la IP real del cliente. Si el front usa ngrok, debe enviar el header `ngrok-skip-browser-warning: 1`. Detalle de la API para el front: `FRONTEND.md`. Estado y pendientes del proyecto: `CONTEXTO.md`.

Mantener HTTPS, reloj sincronizado, origen de frontend restringido, claves fuera del cliente; no registrar bodies ni secretos. Revisar/actualizar paquetes y auditoría antes de exponer. Las imágenes no son públicas y se entregan como archivo adjunto con token. Configurar presupuesto AWS y cupos de generación; no se garantiza costo cero.

Fuentes usadas para la integración (14 nov 2026):
- https://docs.pey.mx/openapi.json
- https://docs.pey.mx/docs/api/create-qr/
- https://docs.pey.mx/docs/webhooks/introduction/
- https://docs.pey.mx/docs/webhooks/codi/qr/
- https://github.com/standard-webhooks/standard-webhooks/blob/main/spec/standard-webhooks.md
- https://hackatonmexico.com/reglas
