# Contexto del proyecto: Mascotas Solidarias (backend) + Órbita Pets (front)

App web de beneficencia para el hackathon. El usuario crea un avatar de perro o gato (raza, collar y nombre), paga un donativo con QR CoDi (vía Pey) y descarga un PNG con su avatar y su nombre. La API está en C# / .NET 10 con SQLite. Este archivo resume el estado del proyecto para retomarlo en otra ruta o sesión.

## Estructura del repositorio

```
huellitas-de-luz/
├─ Back/MascotasSolidarias/   API .NET 10 (este archivo vive aquí)
└─ Front/                     Órbita Pets: HTML/CSS/JS sin dependencias de build
```

Repo: `github.com/bybell26/huellitas-de-luz`. Rama de trabajo: `develop` (`main` tiene el front original subido por Fernando Lemus).

## Mover el proyecto a otra ruta

Copia la carpeta completa **incluyendo** estos archivos que git ignora:
- `Back/MascotasSolidarias/src/Mascotas.Api/appsettings.Local.json`: credenciales. En git solo está `appsettings.Local.example.json`, con marcadores.
- `Back/MascotasSolidarias/src/Mascotas.Api/App_Data/`: base de datos de las órdenes. Solo si quieres conservar las órdenes de prueba.

No hace falta copiar `bin/`, `obj/` ni `.vs/`. Después ejecuta `dotnet restore`. Si cambias de carpeta, el túnel de ngrok y el webhook de Pey no cambian, porque dependen del dominio y no de la ruta.

## Flujo del producto (el que usa el front)

```
1. El usuario crea su mascota en el front y la confirma (2 confirmaciones).
2. Pulsa "Donar $10 y descargar a {nombre}".
3. POST /api/orders           → crea la orden {amountMxn: 0.01}; devuelve id y orderToken
4. POST /api/orders/{id}/qr   → crea el QR CoDi (Pey); el front muestra qrImage
5. GET  /api/orders/{id}      → el front consulta cada 3 s hasta status = PAID
6. El front genera el PNG del avatar en el navegador (canvas) y lo descarga.
```

- **Monto:** la pantalla muestra **$10 MXN** (`DONATION_DISPLAY_MXN`) pero se manda **0.01** al back (`DONATION_CHARGE_MXN`). Ambos valores están en `Front/js/api.js`. Es para la demo; antes de uso con público hay que alinear el texto con el monto cobrado.
- **El PNG se arma en el front.** El servidor solo confirma el pago; no guarda ni protege el avatar.
- **Ya no se usa:** subir foto (`POST /api/orders/{id}/photo`), generación con IA y descarga desde el servidor (`/download`). Esos endpoints siguen en el back por si se retoma la idea, pero el front no los llama.
- El QR: si Pey devuelve `qrImage` (caso real), se muestra tal cual. Si viene vacío (modo Demo), el front lo dibuja desde `qrString` con `Front/js/qrcode.js` (qrcode-generator 1.4.4, MIT).
- La pantalla muestra un loader mientras se crea la orden y el QR, un temporizador de 15 minutos y un aviso cuando el QR vence.

Documentación de la API para el front: `FRONTEND.md`. Swagger: `http://localhost:5160/swagger` (solo en Development).

## Cambios hechos sobre el backend original

- La orden se crea solo con `amountMxn`. `style` es opcional (por defecto `cartoon`). Ya no se manda la foto al crear.
- Monto mínimo configurable con `App:MinAmountMxn` (por defecto 0.01). La idea original era 10 MXN como mínimo en producción. Súbelo a 10 cuando termine la prueba. El máximo es 1000.
- Nuevo `POST /api/orders/{id}/photo` (el front actual no lo usa). Se eliminó `/generate`. `canGenerate` ahora es `canUploadPhoto`.
- `App:ApiKeyId` es **opcional**. Si está vacío, el webhook valida la firma HMAC y escribe en el log el `apiKeyId` que llega. Si tiene valor, se compara.
- `App:AllowDemoImageInPey` (por defecto `false`): permite arrancar en modo `Pey` con el generador Demo. Solo para pruebas.
- Swagger con Swashbuckle y esquema Bearer.
- `UseForwardedHeaders`: detrás de ngrok se usa la IP real del cliente para el rate limit (120 peticiones por minuto por IP).
- La configuración se lee también de `appsettings.Local.json`. Las variables de entorno siguen teniendo prioridad.
- CORS permite `http://localhost:5173`, `https://localhost:5173`, `http://127.0.0.1:8000` y `http://localhost:8000` (el front corre en el puerto 8000).
- `tests/smoke.py` fue actualizado al flujo con foto, **antes** de los cambios de `ApiKeyId` opcional y `AllowDemoImageInPey`. No se ha vuelto a correr.

## Configuración y credenciales

Archivo `src/Mascotas.Api/appsettings.Local.json` (ignorado por git; no subirlo ni compartirlo). Plantilla en `appsettings.Local.example.json`.

| Clave | Estado |
|---|---|
| `App:ApiKey` | Puesta (llave `sk_live` de Pey, de producción). Rotarla al terminar el hackathon, porque se pegó en un chat. |
| `App:WebhookSecret` | Puesto (`whsec_...`). |
| `App:ApiKeyId` | Vacío. Pey no lo expone por API. Aparece en el log del webhook tras el primer pago (línea "Webhook sin App:ApiKeyId configurado"). |
| `App:ImageServiceUrl` / `App:ImageServiceKey` | Vacíos. Ya no hacen falta con el flujo actual. |
| `App:AllowDemoImageInPey` | `true` en el equipo de Belén. No hace falta con el flujo actual. |
| `App:Mode` | `Pey` en la prueba real. Cambiar a `Demo` para probar sin cobrar. En Demo aparece el botón "Simular pago". |

Con `Mode = Pey` la API exige `ApiKey` y `WebhookSecret`, y `ImageProvider = Http` o `AllowDemoImageInPey = true`. Si falta algo, no arranca.

## Servicio de imágenes (en pausa)

Lo construía otro equipo para generar el retrato con IA a partir de una foto. El flujo actual no lo usa. Si se retoma, el contrato que espera la API es:
```
POST <ImageServiceUrl>
Authorization: Bearer <ImageServiceKey>
{"orderId":"...","style":"cartoon","photoBase64":"..."}
→ {"pngBase64":"..."}   (PNG válido, máx. 10 MB, timeout 90 s)
```

## Cómo levantar todo en local

```
# API (Development, http://localhost:5160)
cd Back/MascotasSolidarias
dotnet run --project src/Mascotas.Api

# Front (http://127.0.0.1:8000/index.html)
cd Front
python servidor_local.py        # o iniciar_windows.bat

# Túnel para el webhook de Pey (solo si Mode = Pey)
ngrok http 5160 --host-header=localhost --url=siberian-cavalier-radiation.ngrok-free.dev
```

## ngrok

- Dominio estático: `siberian-cavalier-radiation.ngrok-free.dev`
- Primera vez en una computadora: `ngrok config add-authtoken <TU_AUTHTOKEN>`.
- `--host-header=localhost` es necesario porque `AllowedHosts` solo acepta `localhost` y `127.0.0.1`.
- Webhook registrado en Pey: `https://siberian-cavalier-radiation.ngrok-free.dev/api/webhooks/pey` (evento `codi.qr.payment_received`).
- Prueba de que funciona: `https://siberian-cavalier-radiation.ngrok-free.dev/health` responde `{"status":"ok"}`.
- El front local llama directo a `http://localhost:5160`, no pasa por ngrok. Solo Pey usa el túnel. Si el front llegara a usar ngrok, debe mandar el header `ngrok-skip-browser-warning: 1` (ya lo manda `api.js`).
- El plan gratis tiene un solo dominio estático.

## Front: URL pendiente de decidir para producción

El front corre en `http://127.0.0.1:8000` con `servidor_local.py`. Para publicarlo:
1. Hosting gratis (Vercel, Netlify o GitHub Pages) y agregar su URL a `CorsOrigins` en `appsettings.json`. Además, apuntar `window.ORBITA_API_BASE` a la URL pública de la API.
2. Copiar el front a `wwwroot` de la API. Requiere agregar `UseStaticFiles`. Todo queda en el mismo dominio, sin CORS.

## Prueba de cobro de $0.01

Hecha en modo `Pey` con la llave de producción (el cobro fue real). Según Belén, el pago se completó y la página avanzó a la descarga. Para repetirla hace falta autorización explícita de Belén, porque cada prueba cobra.

## Riesgos conocidos

- Si el QR expira sin pago, la orden queda en `PENDING_PAYMENT`. Para reintentar hay que crear otra orden (el front lo hace con "Generar QR nuevo").
- Un timeout al crear el QR deja la orden en `QR_REVIEW_REQUIRED`, porque no se sabe si Pey lo creó. No se reintenta solo.
- Una sola instancia: SQLite y archivos en disco local. No desplegar en Lambda tal cual (ver `README.md`, sección 7).
- Swagger está expuesto públicamente mientras la API corra en Development detrás de ngrok.
- `MaxOrders` (100) y el rate limit son controles básicos, no un límite financiero.
- El botón de descarga se habilita en el navegador. Cualquiera que manipule el front puede descargar sin pagar. Es aceptable para la demo, no para producción.
- Con `ApiKeyId` vacío, el webhook solo se autentica con la firma HMAC. Es suficiente, pero conviene configurarlo.

## Comandos útiles

```
dotnet build -c Release
dotnet run --project src/Mascotas.Api
python tests/smoke.py        # pendiente de revisar tras los últimos cambios
```
