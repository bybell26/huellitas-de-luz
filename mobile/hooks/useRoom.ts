import { useEffect, useRef, useState } from 'react';
import { apiAddPetToRoom, apiClearRoom, apiGetRoom, apiRemovePetFromRoom, apiSavePet, type Pet } from '../lib/api';
import { createRoomSocket } from '../lib/ws';

export function useRoom(roomCode: string | null) {
  const [pets, setPets] = useState<Pet[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refreshRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    let disposed = false;
    let revision = 0;
    let running: Promise<void> | null = null;
    setPets([]);
    setError(null);
    if (!roomCode) {
      setIsLoading(false);
      refreshRef.current = async () => {};
      return;
    }
    const code = roomCode;
    setIsLoading(true);
    function refresh(): Promise<void> {
      revision++;
      if (running) return running;
      running = (async () => {
        let observed;
        do {
          observed = revision;
          const data = await apiGetRoom(code);
          if (!disposed && observed === revision) {
            setPets(data.pets);
            setError(null);
          }
        } while (!disposed && observed !== revision);
      })().catch(err => {
        if (!disposed) setError(err?.message ?? 'Error al cargar la sala');
      }).finally(() => {
        running = null;
        if (!disposed) setIsLoading(false);
      });
      return running;
    }
    refreshRef.current = refresh;
    const socket = createRoomSocket(code, msg => {
      if (['_connected', 'pet_added', 'pet_removed', 'room_cleared'].includes(msg.type)) void refresh();
    });
    void refresh();
    return () => { disposed = true; socket.close(); };
  }, [roomCode]);

  function requireRoom(): string {
    if (!roomCode) throw new Error('La sala todavía no está lista. Reintenta antes de continuar.');
    return roomCode;
  }
  async function addPet(pet: Omit<Pet, 'slot'>): Promise<void> {
    const code = requireRoom();
    const saved = await apiSavePet(pet);
    await apiAddPetToRoom(code, saved.id);
    await refreshRef.current();
  }
  async function removePet(id: string): Promise<void> {
    await apiRemovePetFromRoom(requireRoom(), id);
    // Retirar de una sala no debe borrar la mascota de la cuenta ni de otras salas.
    await refreshRef.current();
  }
  async function clearAll(): Promise<void> {
    await apiClearRoom(requireRoom());
    await refreshRef.current();
  }
  return { pets, isLoading, error, addPet, removePet, clearAll };
}
