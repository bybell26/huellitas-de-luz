import { getToken } from './api';

const WS_BASE = 'ws://localhost:4000';
const RECONNECT_BASE_MS = 3000;
const MAX_RECONNECTS    = 10;

export type WsMessage =
  | { type: 'joined';       room: string; clients: number }
  | { type: 'pet_added';    pet: any }
  | { type: 'pet_removed';  petId: string }
  | { type: 'room_cleared' }
  | { type: 'pause';        paused: boolean }
  | { type: 'labels';       visible: boolean }
  | { type: 'replay';       id: string }
  | { type: '_connected' }
  | { type: '_disconnected' }
  | { type: '_failed';      message: string }
  | { type: 'error';        message: string };

export interface RoomSocket {
  send: (msg: object) => void;
  close: () => void;
}

export function createRoomSocket(
  roomCode: string,
  onMessage: (msg: WsMessage) => void,
): RoomSocket {
  let ws: WebSocket | null = null;
  let reconnects = 0;
  let disposed   = false;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  async function connect() {
    if (disposed) return;
    const token  = await getToken();
    const params = new URLSearchParams({ room: roomCode });
    if (token) params.set('token', token);

    ws = new WebSocket(`${WS_BASE}/ws?${params}`);

    ws.onopen = () => {
      reconnects = 0;
      onMessage({ type: '_connected' });
    };

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data) as WsMessage;
        onMessage(msg);
      } catch {}
    };

    ws.onclose = () => {
      if (disposed) return;
      onMessage({ type: '_disconnected' });
      if (reconnects < MAX_RECONNECTS) {
        const delay = RECONNECT_BASE_MS * Math.min(reconnects + 1, 4);
        reconnectTimer = setTimeout(connect, delay);
        reconnects++;
      } else {
        onMessage({ type: '_failed', message: 'No se pudo reconectar con la sala.' });
      }
    };

    ws.onerror = () => {};
  }

  connect();

  return {
    send(msg: object) {
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(msg));
      }
    },
    close() {
      disposed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      ws?.close();
    },
  };
}
