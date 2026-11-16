'use strict';
/**
 * storage.js — Capa de acceso a mascotas.
 * v4: persiste en PostgreSQL vía API; caché local en memoria para
 * renderizado inmediato sin esperar red.
 *
 * API pública (síncrona para compatibilidad con app.js / display.js):
 *   readRoster()          → array de mascotas en caché
 *   isPaused()            → bool
 *   setPaused(bool)
 *   labelsVisible()       → bool
 *   setLabelsVisible(bool)
 *   latestAvatar()        → última mascota o null
 *
 * Funciones async (nuevas):
 *   loadRoster(roomCode)  → carga mascotas desde la API y actualiza caché
 *   saveAvatar(pet, roomCode) → guarda en API y actualiza caché
 *   deleteAvatar(id, roomCode) → elimina en API y actualiza caché
 *   clearRosterRemote(roomCode) → vacía sala en API
 */

const MAX_PETS   = 42;
const PAUSE_KEY  = 'huellitas_v4_paused';
const LABELS_KEY = 'huellitas_v4_labels';
const ROOM_KEY   = 'huellitas_v4_room';

// Caché en memoria — se llena con loadRoster()
let _cache = [];

// ─── Lectura síncrona (desde caché) ──────────────────────────────────────────

function readRoster() {
  return [..._cache];
}

function latestAvatar() {
  return _cache.at(-1) || null;
}

// ─── Configuración local (sí usa localStorage, es preferencia de UI) ─────────

function isPaused() {
  try { return localStorage.getItem(PAUSE_KEY) === '1'; } catch { return false; }
}
function setPaused(value) {
  try { localStorage.setItem(PAUSE_KEY, value ? '1' : '0'); } catch {}
}
function labelsVisible() {
  try { return localStorage.getItem(LABELS_KEY) !== '0'; } catch { return true; }
}
function setLabelsVisible(value) {
  try { localStorage.setItem(LABELS_KEY, value ? '1' : '0'); } catch {}
}

// ─── Sala activa ──────────────────────────────────────────────────────────────

function getActiveRoom() {
  try { return localStorage.getItem(ROOM_KEY) || null; } catch { return null; }
}
function setActiveRoom(code) {
  try {
    if (code) localStorage.setItem(ROOM_KEY, code);
    else localStorage.removeItem(ROOM_KEY);
  } catch {}
}

// ─── Operaciones async (con API) ──────────────────────────────────────────────

/**
 * Carga las mascotas de una sala desde el backend y actualiza la caché.
 * Si roomCode es null, carga solo las mascotas del usuario (sin sala).
 */
async function loadRoster(roomCode) {
  try {
    if (roomCode) {
      const data = await apiGetRoom(roomCode);
      _cache = (data.pets || []).slice(0, MAX_PETS);
    } else {
      _cache = (await apiGetPets()).slice(0, MAX_PETS);
    }
    return readRoster();
  } catch (err) {
    console.warn('[storage] loadRoster falló:', err.message);
    return readRoster(); // devuelve caché anterior
  }
}

/**
 * Guarda la mascota en el backend y, si se proporciona roomCode,
 * la agrega a la sala. Actualiza la caché.
 */
async function saveAvatar(pet, roomCode) {
  // 1. Guardar la mascota en /api/pets
  const saved = await apiSavePet(pet);

  // 2. Agregarla a la sala si se proporcionó
  let withSlot = saved;
  if (roomCode) {
    withSlot = await apiAddPetToRoom(roomCode, saved.id);
  }

  // 3. Actualizar caché (evitar duplicados)
  if (!_cache.some(p => p.id === withSlot.id)) {
    _cache = [..._cache, withSlot].slice(0, MAX_PETS);
  }

  return withSlot;
}

/**
 * Elimina la mascota del backend (y de la sala si roomCode se da)
 * y actualiza la caché.
 */
async function deleteAvatar(id, roomCode) {
  if (roomCode) {
    await apiRemovePetFromRoom(roomCode, id);
  }
  await apiDeletePet(id);
  _cache = _cache.filter(p => p.id !== id);
  return readRoster();
}

/**
 * Vacía la sala en el backend y limpia la caché.
 */
async function clearRosterRemote(roomCode) {
  if (roomCode) await apiClearRoom(roomCode);
  _cache = [];
}

// ─── Compatibilidad con código legacy (app.js usa addAvatar / removeAvatar) ──

function addAvatar(raw) {
  // Solo actualiza caché local; el guardado real es async vía saveAvatar()
  if (_cache.length >= MAX_PETS) throw new Error('full');
  if (!raw?.id)                  throw new Error('invalid');
  if (_cache.some(p => p.id === raw.id)) throw new Error('duplicate');

  const slot = Array.from({ length: MAX_PETS }, (_, i) => i)
    .find(i => !_cache.some(p => p.slot === i));

  const avatar = { ...raw, slot: slot ?? _cache.length };
  _cache = [..._cache, avatar];
  return avatar;
}

function removeAvatar(id) {
  _cache = _cache.filter(p => p.id !== id);
  return readRoster();
}

function clearRoster() {
  _cache = [];
}
