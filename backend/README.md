# Huellitas de Luz — Backend

API REST + WebSockets para la app móvil y web.

## Requisitos

- Node.js 22+
- PostgreSQL 14+

## Setup

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar variables de entorno
cp .env.example .env
# Edita .env con tu DATABASE_URL, JWT_SECRET y PEY_API_KEY

# 3. Crear la base de datos en PostgreSQL
createdb huellitas

# 4. Aplicar el esquema
npm run migrate

# 5. Iniciar en desarrollo (con hot reload)
npm run dev
```

## Endpoints

### Auth
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/auth/register` | Crear cuenta |
| POST | `/api/auth/login` | Iniciar sesión → JWT |
| GET  | `/api/auth/me` | Perfil del usuario (requiere JWT) |

### Mascotas
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET    | `/api/pets` | Listar mascotas del usuario |
| POST   | `/api/pets` | Guardar mascota tras pago |
| DELETE | `/api/pets/:id` | Eliminar mascota |

### Salas
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET    | `/api/rooms` | Salas del usuario |
| POST   | `/api/rooms` | Crear sala |
| GET    | `/api/rooms/:code` | Sala + mascotas (público) |
| POST   | `/api/rooms/:code/pets` | Agregar mascota a sala |
| DELETE | `/api/rooms/:code/pets/:petId` | Quitar mascota de sala |
| DELETE | `/api/rooms/:code` | Vaciar sala |

### Pey (proxy)
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/pey` | Crear QR o consultar estado |

### Health
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/health` | Estado del servidor |

## WebSocket

Conectar: `ws://localhost:4000/ws?room=abc-1234&token=JWT`

### Eventos del servidor → cliente
```json
{ "type": "joined",       "room": "abc-1234", "clients": 2 }
{ "type": "pet_added",    "pet": { ...datos } }
{ "type": "pet_removed",  "petId": "pey-xxx" }
{ "type": "room_cleared" }
```

### Mensajes del cliente → servidor
```json
{ "type": "ping" }
```

## Variables de entorno

| Variable | Descripción |
|----------|-------------|
| `DATABASE_URL` | Conexión PostgreSQL |
| `JWT_SECRET` | Secreto para firmar tokens |
| `JWT_EXPIRES_IN` | Expiración del token (default: `7d`) |
| `PORT` | Puerto del servidor (default: `4000`) |
| `PEY_API_KEY` | API key de Pey |
| `ALLOWED_ORIGINS` | Orígenes CORS separados por coma |

## Recibos de pago

Para crear una mascota, `POST /api/pey` con `action: create` requiere `amount`:
$50, $100, $150 o $200 MXN, o una cantidad mayor a $200 con hasta dos decimales.
El servidor registra ese importe y solo confirma un recibo PAID por el mismo
monto en MXN. El monto de prueba de $0.01 ya no se acepta para nuevas creaciones.
El laboratorio `pruebas-pey/` conserva sus cobros de prueba independientes.

Después de actualizar, ejecuta `npm run migrate` para agregar `payment_requests` y
`payment_receipts` sin borrar los datos existentes. Las consultas de cobros solo
se permiten a la cuenta que creó el QR. `/api/pets` requiere un recibo aprobado
registrado por el servidor y lo consume de forma atómica. No se aceptan IDs de
transacciones inventados ni recibos de otras cuentas.

`npm test` usa PostgreSQL con un esquema temporal separado y Pey simulado. No
modifica las tablas de la aplicación ni genera cobros reales.

## Restablecer acceso local

La contraseña original no se puede recuperar: se almacena con bcrypt. Desde
`backend/`, ejecuta `npm run reset-password -- correo@ejemplo.com` para generar
una nueva contraseña aleatoria y conservar la cuenta y sus mascotas. El comando
solo funciona con acceso local a la base; no hay un endpoint público de reset.

La clave de Pey debe configurarse en `backend/.env` como `PEY_API_KEY`. También
se admite el archivo privado `pruebas-pey/config.local.json`; un valor de ejemplo
en `.env` ya no bloquea ese fallback. Reinicia el backend después de cambiar
`.env`. Ambos archivos privados están excluidos de Git.

## Actividades del hogar

`GET /api/pets/:id/activities` devuelve las sesiones disponibles hoy de la
mascota propia. `POST` en esa ruta recibe `action` (`feed`, `play`, `bath` o
`style`) y un `requestId` UUID único. Cada mascota puede completar tres sesiones
de cada actividad al día, con renovación a medianoche de `America/Mexico_City`.
La respuesta incluye `limit`, `date`, `timeZone` y `resetsAt`. El servidor conserva el historial, comprueba
la propiedad y serializa solicitudes simultáneas; reintentar el mismo UUID no
consume otra sesión, incluso si se reintenta una solicitud del día anterior.
Al alcanzar el límite responde 409 y hay que esperar al día siguiente.

`style` requiere `appearance` y `collar` válidos. Solo guardar un cambio real
consume un uso; previsualizar o cancelar no lo consume. Ejecuta `npm run migrate`
para agregar el índice diario de `pet_activities` y reinicia el backend después de actualizar.

## Donaciones adicionales (API)

`POST /api/pey` con `action: create`, `purpose: extra`, `petId`, `amount` y
`trick` crea un cobro específico. Se admiten `paw`/`spin` para perro y
`stand`/`yarn` para gato. El monto admite de $0.01 a $1,000 MXN con dos decimales.
El destino y truco se guardan en `payment_requests`; cada transacción PAID se
consume una sola vez en `pet_donations`. El evento `donation_added` se emite tras
persistir y el estado incluye un identificador estable para deduplicar el truco.
Las consultas de sala incluyen el total original más las donaciones extra.
Ejecuta `npm run migrate` antes de iniciar esta versión.
