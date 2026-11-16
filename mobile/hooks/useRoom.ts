import { useEffect, useRef, useState } from 'react';
import {
  apiAddPetToRoom,
  apiClearRoom,
  apiDeletePet,
  apiGetRoom,
  apiRemovePetFromRoom,
  apiSavePet,
  type Pet,
} from '../lib/api';
import { createRoomSocket, type RoomSocket, type WsMessage } from '../lib/ws';

interface RoomState {
  pets: Pet[];
  isLoading: boolean;
  error: string | null;
  addPet: (pet: Omit<Pet, 'slot'>) => Promise<void>;
  removePet: (id: string) => Promise<void>;
  clearAll: () => Promise<void>;
}

export function useRoom(roomCode: string | null): RoomState {
  const [pets, setPets] = useState<Pet[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<RoomSocket | null>(null);

  useEffect(() => {
    if (!roomCode) {
      setPets([]);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    apiGetRoom(roomCode)
      .then(({ pets: loadedPets }) => setPets(loadedPets))
      .catch(err => setError(err?.message ?? 'Error al cargar la sala'))
      .finally(() => setIsLoading(false));

    const socket = createRoomSocket(roomCode, (msg: WsMessage) => {
      switch (msg.type) {
        case 'pet_added':
          setPets(prev => {
            const exists = prev.some(p => p.id === msg.pet.id);
            return exists ? prev : [...prev, msg.pet as Pet];
          });
          break;
        case 'pet_removed':
          setPets(prev => prev.filter(p => p.id !== msg.petId));
          break;
        case 'room_cleared':
          setPets([]);
          break;
        default:
          break;
      }
    });

    socketRef.current = socket;

    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, [roomCode]);

  async function addPet(pet: Omit<Pet, 'slot'>): Promise<void> {
    if (!roomCode) return;
    const saved = await apiSavePet(pet);
    await apiAddPetToRoom(roomCode, saved.id);
  }

  async function removePet(id: string): Promise<void> {
    if (!roomCode) return;
    await apiRemovePetFromRoom(roomCode, id);
    await apiDeletePet(id);
  }

  async function clearAll(): Promise<void> {
    if (!roomCode) return;
    await apiClearRoom(roomCode);
  }

  return { pets, isLoading, error, addPet, removePet, clearAll };
}
