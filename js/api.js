'use strict';
/**
 * api.js — Cliente HTTP para el backend de Huellitas de Luz.
 * Reemplaza localStorage como capa de persistencia.
 *
 * Todas las funciones devuelven Promises y lanzan Error con
 * un mensaje legible en caso de fallo.
 */

const API_BASE = (() => {
  // En desarrollo apunta al backend local; en producción al mismo origen o URL configurada.
  if (typeof window !== 'undefined' && window.HUELLITAS_API_URL) return window.HUELLITAS_API_URL;
  const { hostname, protocol } = window.location;
  if (hostname === 'localhost' || hostname === '127.0.0.1') return 'http://localhost:4000';
  return ''; // mismo origen en producción
})();

// ─── Núcleo HTTP ──────────────────────────────────────────────────────────────

async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(API_BASE + path, { ...options, headers });
  const data = await response.json().catch(() => ({}));

  if (response.status === 401 && token) {
    clearSession();
    requireSession();
  }
  if (!response.ok) {
    const error = new Error(data.error || `Error ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return data;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

async function apiRegister(email, password, name) {
  const data = await apiFetch('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, name }),
  });
  saveSession(data.token, data.user, true);
  return data.user;
}

async function apiLogin(email, password) {
  const data = await apiFetch('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  saveSession(data.token, data.user, true);
  return data.user;
}

async function apiLogout() {
  clearSession();
}

async function apiMe() {
  return (await apiFetch('/api/auth/me')).user;
}

// ─── Mascotas ─────────────────────────────────────────────────────────────────

async function apiGetPets() {
  return (await apiFetch('/api/pets')).pets;
}

async function apiSavePet(pet) {
  return (await apiFetch('/api/pets', {
    method: 'POST',
    body: JSON.stringify(pet),
  })).pet;
}

async function apiDeletePet(id) {
  return apiFetch(`/api/pets/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

// ─── Salas ────────────────────────────────────────────────────────────────────

async function apiGetRooms() {
  return (await apiFetch('/api/rooms')).rooms;
}

async function apiCreateRoom(name) {
  return (await apiFetch('/api/rooms', {
    method: 'POST',
    body: JSON.stringify({ name }),
  })).room;
}

async function apiGetRoom(code) {
  const data = await apiFetch(`/api/rooms/${encodeURIComponent(code)}`);
  return data; // { room, pets }
}

async function apiAddPetToRoom(roomCode, petId) {
  return (await apiFetch(`/api/rooms/${encodeURIComponent(roomCode)}/pets`, {
    method: 'POST',
    body: JSON.stringify({ petId }),
  })).pet;
}

async function apiRemovePetFromRoom(roomCode, petId) {
  return apiFetch(`/api/rooms/${encodeURIComponent(roomCode)}/pets/${encodeURIComponent(petId)}`, {
    method: 'DELETE',
  });
}

async function apiClearRoom(roomCode) {
  return apiFetch(`/api/rooms/${encodeURIComponent(roomCode)}`, { method: 'DELETE' });
}
