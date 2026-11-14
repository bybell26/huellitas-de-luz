# Guía para el front: Mascotas Solidarias API

Swagger (solo en Development): `http://localhost:5160/swagger`

Base URL local: `http://localhost:5160`. En CORS ya están permitidos `http://localhost:5173` y `https://localhost:5173`. Si tu front corre en otro origen, avisa al back para agregarlo en `CorsOrigins`.

Si la API se expone con ngrok (plan gratis), agrega a **todos** los `fetch` el header `ngrok-skip-browser-warning: 1`. Sin él, ngrok puede devolver una página HTML de advertencia en lugar del JSON.

## Flujo

```
1. POST /api/orders              → crea la orden, devuelve id y orderToken
2. POST /api/orders/{id}/qr      → devuelve el QR para pagar con CoDi
3. GET  /api/orders/{id}         → repetir cada 3 s hasta status = PAID
4. POST /api/orders/{id}/photo   → sube la foto (solo si está pagada)
5. GET  /api/orders/{id}         → repetir cada 3 s hasta canDownload = true
6. GET  /api/orders/{id}/download → descarga la imagen
```

El usuario paga desde su app bancaria. El front nunca marca una orden como pagada: el back lo hace cuando Pey avisa por webhook.

## Autenticación

El paso 1 no necesita token. Todos los demás pedirán:

```
Authorization: Bearer <orderToken>
```

`orderToken` solo se devuelve al crear la orden. Guárdalo en memoria o `sessionStorage`. No lo pongas en la URL. Si se pierde, no hay forma de recuperarlo.

Un token incorrecto o de otra orden devuelve `404`.

## Endpoints

### 1. Crear orden

`POST /api/orders`

```json
{ "amountMxn": 10, "style": "cartoon" }
```

| Campo | Tipo | Notas |
|---|---|---|
| `amountMxn` | número | Obligatorio. Máximo 1000 y 2 decimales. El mínimo lo define el back (`MinAmountMxn`, hoy 0.01). |
| `style` | string | Opcional. `cartoon` (default), `watercolor` o `astronaut`. |

Respuesta `201`:

```json
{ "id": "a1b2...", "status": "CREATED", "orderToken": "9F3C...", "isDemo": true }
```

Errores: `400` (monto o estilo inválido), `429` (se alcanzó el cupo de órdenes).

### 2. Crear QR

`POST /api/orders/{id}/qr` (sin body)

Respuesta `200`:

```json
{
  "qrId": "...",
  "qrString": "000201...",
  "qrImage": "iVBORw0KGgo...",
  "qrExpiresAt": 1760000000,
  "isDemo": false
}
```

- `qrImage` es un PNG en base64 sin prefijo. Muéstralo con `<img src={"data:image/png;base64," + qrImage}>`.
- Si `qrImage` es `null`, genera el QR en el front con una librería, usando exactamente `qrString`.
- `qrExpiresAt` es Unix en segundos. El QR dura 15 minutos.
- Si llamas otra vez con la orden en `PENDING_PAYMENT`, devuelve el mismo QR.
- Si `isDemo` es `true`, el QR no cobra nada. Muestra un aviso de "modo demo".

Errores:
- `409`: la orden ya no está en `CREATED`. Consulta su estado.
- `502`: no se sabe si Pey creó el QR. No reintentes. La orden queda en `QR_REVIEW_REQUIRED` y hay que revisarla con el back.

### 3. Consultar estado

`GET /api/orders/{id}`

```json
{
  "id": "...",
  "status": "PENDING_PAYMENT",
  "amountMxn": 10.0,
  "style": "cartoon",
  "isDemo": false,
  "qrExpiresAt": 1760000000,
  "canUploadPhoto": false,
  "canDownload": false
}
```

Usa `canUploadPhoto` y `canDownload` para habilitar los botones. Consulta cada 3 segundos como máximo. El límite es 120 peticiones por minuto por IP.

### 4. Subir foto

`POST /api/orders/{id}/photo`

- Body: los bytes del archivo, sin JSON ni base64.
- `Content-Type`: `image/png` o `image/jpeg`.
- Máximo 5 MB.

```js
await fetch(`${BASE}/api/orders/${id}/photo`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": file.type },
  body: file, // objeto File del <input type="file">
});
```

Respuestas:
- `202`: foto guardada, la generación ya está en cola. Pasa a consultar el estado.
- `200`: la orden ya estaba en cola, generándose o lista. No se vuelve a subir.
- `400`: archivo que no es PNG/JPEG o mayor a 5 MB.
- `409`: la orden todavía no está pagada.

### 5. Descargar

`GET /api/orders/{id}/download`

Un enlace HTML normal no puede enviar el header `Authorization`, así que descarga con `fetch` y crea un blob:

```js
const res = await fetch(`${BASE}/api/orders/${id}/download`, {
  headers: { Authorization: `Bearer ${token}` },
});
if (!res.ok) throw new Error(await res.text());
const url = URL.createObjectURL(await res.blob());
const a = document.createElement("a");
a.href = url;
a.download = "retrato.png";
a.click();
URL.revokeObjectURL(url);
```

Respuestas: `200` con la imagen, `409` si todavía no está lista. En modo demo el archivo es un SVG de ejemplo, no una imagen generada por IA.

## Estados (`status`)

| Estado | Significado | Qué hace el front |
|---|---|---|
| `CREATED` | Orden creada | Pedir el QR |
| `QR_CREATING` | Se está creando el QR | Esperar |
| `PENDING_PAYMENT` | QR listo, falta pagar | Mostrar QR y consultar cada 3 s |
| `PAID` | Pago confirmado | Mostrar el selector de foto |
| `GENERATION_QUEUED` | Foto recibida, en cola | Mostrar "generando" |
| `GENERATING` | Generando la imagen | Mostrar "generando" |
| `READY` | Imagen lista | Habilitar descarga |
| `QR_REVIEW_REQUIRED` | No se sabe si el QR se creó | Mostrar "contacta al organizador" |
| `PAYMENT_REVIEW_REQUIRED` | Pago tardío o fuera de lo normal | Mostrar "contacta al organizador" |
| `GENERATION_FAILED` | Falló la generación | Mostrar "contacta al organizador". No cobrar de nuevo. |

Si el QR expira sin pago, la orden se queda en `PENDING_PAYMENT`. Para volver a intentar, crea una orden nueva.

## Probar en modo Demo (sin cobrar)

En Development con `Mode = Demo` existe `POST /api/orders/{id}/simulate-payment` (con el mismo Bearer). Marca la orden como pagada y sirve para probar el flujo completo sin Pey. En modo Pey esta ruta no existe.

## Errores generales

- `404`: la orden no existe o el token no corresponde.
- `429`: demasiadas peticiones o cupo lleno.
- `500`: error interno. Consulta el estado de la orden antes de repetir una operación.
- Las respuestas de error llevan `{ "error": "mensaje" }`.

`POST /api/webhooks/pey` es solo para Pey. El front no lo llama.
