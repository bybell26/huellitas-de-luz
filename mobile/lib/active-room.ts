import * as SecureStore from 'expo-secure-store';
import { apiCreateRoom, apiGetRooms } from './api';

export const ROOM_KEY = 'huellitas_room_code';
export async function ensureOwnRoom(): Promise<string> {
  const rooms = await apiGetRooms();
  const stored = await SecureStore.getItemAsync(ROOM_KEY);
  const room = rooms.find(item => item.code === stored) || rooms[0] || await apiCreateRoom('Mi constelación');
  await SecureStore.setItemAsync(ROOM_KEY, room.code);
  return room.code;
}
