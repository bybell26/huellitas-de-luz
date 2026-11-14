# Contexto del proyecto: Mascotas Solidarias (backend)

App web de beneficencia para el hackathon. El usuario paga un donativo con QR CoDi (vía Pey), sube la foto de su perro o gato y descarga una imagen generada. La API está en C# / .NET 10 con SQLite. Este archivo resume el estado del proyecto para retomarlo en otra ruta o sesión.

## Mover el proyecto a otra ruta

Copia la carpeta completa **incluyendo** estos archivos que git ignora:
- `src/Mascotas.Api/appsettings.Local.json`: credenciales (ver abajo).
- `src/Mascotas.Api/App_Data/`: base de datos y fotos de las órdenes. Solo si quieres conservar las órdenes de prueba.

No hace falta copiar `bin/`, `obj/` ni `.vs/`. Después ejecuta `dotnet restore`. Si cambias de carpeta, el túnel de ngrok y el webhook de Pey no cambian, porque dependen del dominio y no de la ruta.

## Flujo del producto

```
1. POST /api/orders                → crea la orden {amountMxn, style?}; devuelve id y orderToken
2. POST /api/orders/{id}/qr        → crea el QR CoDi (Pey)
3. (el usuario paga; Pey avisa por webhook; la orden pasa a PAID)
4. POST /api/orders/{id}/photo     → sube la foto (bytes PNG/JPEG, máx. 5 MB); encola la generación
5. GET  /api/orders/{id}           → consulta estado (canUploadPhoto, canDownload)
6. GET  /api/orders/{id}/download  → descarga la imagen
```

Documentación para el front: `FRONTEND.md`. Swagger: `http://localhost:5160/swagger` (solo en Development).

## Cambios hechos sobre el backend original

- La orden se crea solo con `amountMxn`. `style` es opcional (por defecto `cartoon`). Ya no se manda la foto al crear.
- Monto mínimo configurable con `App:MinAmountMxn` (por defecto 0.01). La idea original era 10 MXN como mínimo en producción. Súbelo a 10 cuando termine la prueba. El máximo es 1000.
- Nuevo `POST /api/orders/{id}/photo`: guarda la foto solo si la orden está pagada y encola la generación. Se eliminó `/generate`. `canGenerate` ahora es `canUploadPhoto`.
- Swagger con Swashbuckle y esquema Bearer.
- `UseForwardedHeaders`: detrás de ngrok se usa la IP real del cliente para el rate limit (120 peticiones por minuto por IP).
- La configuración se lee también de `appsettings.Local.json`. Las variables de entorno siguen teniendo prioridad.
- `tests/smoke.py` actualizado al flujo nuevo. Su limpieza ignora el bloqueo de SQLite en Windows.
- `README.md` y `demo.http` **no se actualizaron** y siguen describiendo el flujo viejo (foto al crear y `/generate`).

## Configuración y credenciales

Archivo `src/Mascotas.Api/appsettings.Local.json` (ignorado por git; no subirlo ni compartirlo):

| Clave | Estado |
|---|---|
| `App:ApiKey` | Puesta (llave `sk_live` de Pey, de producción). Rotarla al terminar el hackathon, porque se pegó en un chat. |
| `App:WebhookSecret` | Puesto (`whsec_...`). |
| `App:ApiKeyId` | **Falta.** Está en el panel de Pey junto a la llave. |
| `App:ImageServiceUrl` / `App:ImageServiceKey` | **Faltan.** Los da el equipo de imágenes. |
| `App:Mode` | Sigue en `Demo` (no cobra). Cambiar a `Pey` solo al final, en `appsettings.json` o `appsettings.Local.json`. |

El modo `Pey` exige `ApiKey`, `ApiKeyId`, `WebhookSecret` y `ImageProvider = Http` con URL HTTPS y clave. Si falta algo, la API no arranca.

## Servicio de imágenes

Lo construye el otro equipo. Contrato que espera la API:
```
POST <ImageServiceUrl>
Authorization: Bearer <ImageServiceKey>
{"orderId":"...","style":"cartoon","photoBase64":"..."}
→ {"pngBase64":"..."}   (PNG válido, máx. 10 MB, timeout 90 s)
```
Pregunta abierta: ¿ellos solo responden con el base64 (como está ahora) o prefieren hacer un POST a un endpoint nuevo de esta API cuando terminen? Hoy está implementada la primera opción.

## ngrok

- Dominio estático: `siberian-cavalier-radiation.ngrok-free.dev`
- Primera vez en una computadora: `ngrok config add-authtoken <TU_AUTHTOKEN>`.
- Comando para exponer la API (arrancarla antes con F5 en `http://localhost:5160`):
  ```
  ngrok http 5160 --host-header=localhost --url=siberian-cavalier-radiation.ngrok-free.dev
  ```
- `--host-header=localhost` es necesario porque `AllowedHosts` solo acepta `localhost` y `127.0.0.1`.
- Webhook a registrar en Pey: `https://siberian-cavalier-radiation.ngrok-free.dev/api/webhooks/pey` (evento `codi.qr.payment_received`).
- Prueba de que funciona: `https://siberian-cavalier-radiation.ngrok-free.dev/health` responde `{"status":"ok"}`.
- El front debe mandar el header `ngrok-skip-browser-warning: 1` en sus `fetch`.
- El plan gratis tiene un solo dominio estático. La API ya lo usa.

## Front: URL pendiente de decidir

1. Hosting gratis (Vercel, Netlify o GitHub Pages) y agregar su URL a `CorsOrigins` en `appsettings.json`.
2. Copiar el build del front a `wwwroot` de la API. Requiere agregar `UseStaticFiles`. Todo queda en el mismo dominio, sin CORS.

Hoy CORS solo permite `http://localhost:5173` y `https://localhost:5173`.

## Prueba de cobro de $0.01 (pendiente, NO hacer sin autorización explícita)

La llave es de producción, así que el cobro es real. Antes de hacerlo:
1. Completar `ApiKeyId` y el servicio de imágenes (o pedir la opción temporal para usar el generador Demo solo en la prueba).
2. Cambiar `App:Mode` a `Pey`.
3. Verificar que el webhook responde por ngrok.
4. Que Belén dé el visto bueno.

Después: crear orden con `amountMxn: 0.01`, pedir el QR, pagar con CoDi, confirmar que la orden pasa a `PAID`, subir la foto y descargar.

## Riesgos conocidos

- Si el QR expira sin pago, la orden queda en `PENDING_PAYMENT`. Para reintentar hay que crear otra orden.
- Un timeout al crear el QR deja la orden en `QR_REVIEW_REQUIRED`, porque no se sabe si Pey lo creó. No se reintenta solo.
- Una sola instancia: SQLite y archivos en disco local. No desplegar en Lambda tal cual (ver `README.md`, sección 7).
- Swagger está expuesto públicamente mientras la API corra en Development detrás de ngrok.
- `MaxOrders` (100) y el rate limit son controles básicos, no un límite financiero.

## Comandos útiles

```
dotnet build -c Release
dotnet run --project src/Mascotas.Api
python tests/smoke.py        # pruebas Demo y Pey simuladas, sin llamadas externas
```
