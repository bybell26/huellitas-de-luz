-- Huellitas de Luz — Esquema PostgreSQL
-- Ejecutar con: psql -d huellitas -f schema.sql

-- Extensión para UUIDs
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Usuarios ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email      TEXT        UNIQUE NOT NULL,
  password   TEXT        NOT NULL,
  name       TEXT        NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Mascotas ────────────────────────────────────────────────────────────────
-- id = "pey-{transaction.id}" para mantener compatibilidad con el flujo actual
CREATE TABLE IF NOT EXISTS pets (
  id         TEXT        PRIMARY KEY,
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  species    TEXT        NOT NULL CHECK (species IN ('perro', 'gato')),
  breed      TEXT        NOT NULL,
  collar     TEXT        NOT NULL,
  name       TEXT        NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pets_user_id_idx ON pets(user_id);

-- ─── Salas de constelación ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rooms (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  code       TEXT        UNIQUE NOT NULL,
  owner_id   UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT        NOT NULL DEFAULT 'Mi constelación',
  max_pets   INTEGER     NOT NULL DEFAULT 42,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rooms_code_idx ON rooms(code);
CREATE INDEX IF NOT EXISTS rooms_owner_id_idx ON rooms(owner_id);

-- ─── Mascotas en sala ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS room_pets (
  room_id    UUID        NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  pet_id     TEXT        NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  slot       INTEGER     NOT NULL,
  added_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (room_id, pet_id),
  UNIQUE (room_id, slot)
);

CREATE INDEX IF NOT EXISTS room_pets_room_id_idx ON room_pets(room_id);

-- Cobros por cuenta y recibos verificados exclusivamente por el servidor.
CREATE TABLE IF NOT EXISTS payment_requests (
  qr_id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS payment_receipts (
  transaction_id TEXT PRIMARY KEY,
  qr_id TEXT NOT NULL REFERENCES payment_requests(qr_id),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL CHECK (amount = 0.01),
  currency TEXT NOT NULL CHECK (currency = 'MXN'),
  redeemed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ampliaciones idempotentes: apariencia y donaciones adicionales por mascota.
ALTER TABLE pets ADD COLUMN IF NOT EXISTS appearance JSONB NOT NULL DEFAULT '{}';
ALTER TABLE payment_requests ADD COLUMN IF NOT EXISTS amount NUMERIC(12,2) NOT NULL DEFAULT 0.01;
ALTER TABLE payment_requests ADD COLUMN IF NOT EXISTS purpose TEXT NOT NULL DEFAULT 'creation';
ALTER TABLE payment_requests ADD COLUMN IF NOT EXISTS pet_id TEXT;
ALTER TABLE payment_requests ADD COLUMN IF NOT EXISTS trick TEXT;
ALTER TABLE payment_receipts DROP CONSTRAINT IF EXISTS payment_receipts_amount_check;
ALTER TABLE payment_receipts ADD CONSTRAINT payment_receipts_amount_check CHECK (amount >= 0.01 AND amount <= 1000);
CREATE TABLE IF NOT EXISTS pet_donations (
  id UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  transaction_id TEXT PRIMARY KEY REFERENCES payment_receipts(transaction_id),
  pet_id TEXT NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  trick TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pet_donations_pet_idx ON pet_donations(pet_id);
