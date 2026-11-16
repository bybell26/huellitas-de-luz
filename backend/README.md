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
