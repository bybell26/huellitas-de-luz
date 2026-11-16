import * as SecureStore from 'expo-secure-store';
import { Species } from '../constants/pets';

// En desarrollo apunta al backend local.
// En producción cambia esta URL a tu servidor desplegado.
import { getApiBase } from './config';

export const TOKEN_KEY = 'huellitas_token';
export const USER_KEY  = 'huellitas_user';

// ─── Sesión ───────────────────────────────────────────────────────────────────

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function getStoredUser(): Promise<User | null> {
  const raw = await SecureStore.getItemAsync(USER_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

async function saveSession(token: string, user: User): Promise<void> {
  await clearSession();
  await SecureStore.setItemAsync(TOKEN_KEY, token);
  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
}

export async function clearSession(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(USER_KEY);
  await SecureStore.deleteItemAsync('huellitas_room_code');
}

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  name: string;
}

export interface Pet {
  id: string;
  species: Species;
  breed: string;
  collar: string;
  name: string;
  createdAt?: string;
  slot?: number;
}

export interface Room {
  id: string;
  code: string;
  name: string;
  owner_id: string;
  pet_count?: number;
  created_at?: string;
}

// ─── Núcleo HTTP ──────────────────────────────────────────────────────────────

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> ?? {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(getApiBase() + path, { ...options, headers });
  const data = await response.json().catch(() => ({}));

  if (response.status === 401 && token) {
    await handleUnauthorized();
  }
  if (!response.ok) {
    throw new Error((data as any).error ?? `Error ${response.status}`);
  }
  return data as T;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export async function apiRegister(email: string, password: string, name: string): Promise<User> {
  const data = await apiFetch<{ token: string; user: User }>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, name }),
  });
  await saveSession(data.token, data.user);
  return data.user;
}

export async function apiLogin(email: string, password: string): Promise<User> {
  const data = await apiFetch<{ token: string; user: User }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  await saveSession(data.token, data.user);
  return data.user;
}

export async function apiMe(): Promise<User> {
  return (await apiFetch<{ user: User }>('/api/auth/me')).user;
}

// ─── Mascotas ─────────────────────────────────────────────────────────────────

export async function apiGetPets(): Promise<Pet[]> {
  return (await apiFetch<{ pets: Pet[] }>('/api/pets')).pets;
}

export async function apiSavePet(pet: Omit<Pet, 'slot'>): Promise<Pet> {
  return (await apiFetch<{ pet: Pet }>('/api/pets', {
    method: 'POST',
    body: JSON.stringify(pet),
  })).pet;
}

export async function apiDeletePet(id: string): Promise<void> {
  await apiFetch(`/api/pets/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

// ─── Salas ────────────────────────────────────────────────────────────────────

export async function apiGetRooms(): Promise<Room[]> {
  return (await apiFetch<{ rooms: Room[] }>('/api/rooms')).rooms;
}

export async function apiCreateRoom(name: string): Promise<Room> {
  return (await apiFetch<{ room: Room }>('/api/rooms', {
    method: 'POST',
    body: JSON.stringify({ name }),
  })).room;
}

export async function apiGetRoom(code: string): Promise<{ room: Room; pets: Pet[] }> {
  return apiFetch(`/api/rooms/${encodeURIComponent(code)}`);
}

export async function apiAddPetToRoom(roomCode: string, petId: string): Promise<Pet> {
  return (await apiFetch<{ pet: Pet }>(`/api/rooms/${encodeURIComponent(roomCode)}/pets`, {
    method: 'POST',
    body: JSON.stringify({ petId }),
  })).pet;
}

export async function apiRemovePetFromRoom(roomCode: string, petId: string): Promise<void> {
  await apiFetch(`/api/rooms/${encodeURIComponent(roomCode)}/pets/${encodeURIComponent(petId)}`, {
    method: 'DELETE',
  });
}

export async function apiClearRoom(roomCode: string): Promise<void> {
  await apiFetch(`/api/rooms/${encodeURIComponent(roomCode)}`, { method: 'DELETE' });
}

export async function handleUnauthorized(): Promise<void> {
  await clearSession();
  const { router } = await import('expo-router');
  router.replace('/(auth)/login');
}
