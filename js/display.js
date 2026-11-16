'use strict';
/**
 * display.js — Constelación flotante.
 * v4: recibe mascotas vía WebSocket, no requiere login (pantalla pública).
 * El roomCode viene en la URL: display.html?room=luna-7429
 */

const constellation = document.getElementById('constellation');
const waiting       = document.getElementById('arrival-content');
const announcement  = document.getElementById('arrival-message');
const statusEl      = document.getElementById('display-connected');
const counterEl     = document.getElementById('display-counter');
const pauseButton   = document.getElementById('display-pause');
const labelsButton  = document.getElementById('toggle-names');
const roomCodeEl    = document.getElementById('display-room-code');

let announcementTimer = null;
let roomSocket        = null;
let activeRoom        = null;

const slots = buildSlots();

// ─── Inicialización ───────────────────────────────────────────────────────────
async function init() {
  // Leer código de sala desde la URL
  const params = new URLSearchParams(window.location.search);
  activeRoom   = params.get('room');

  if (!activeRoom || !/^[a-z]+-\d{4}$/.test(activeRoom)) {
    waiting.innerHTML = '<div class="waiting-mark">🐾</div><h1 class="waiting-title">Sala no encontrada</h1><p class="waiting-subtitle">Abre esta pantalla desde el Creador y asegúrate de que la URL incluya ?room=código.</p>';
    return;
  }

  if (roomCodeEl) roomCodeEl.textContent = activeRoom;

  // Cargar mascotas iniciales desde la API (sin auth requerida)
  try {
    const data = await apiGetRoom(activeRoom);
    _injectRoster(data.pets || []);
    renderConstellation();
  } catch (err) {
    console.warn('[display] No se pudo cargar la sala:', err.message);
  }

  // Conectar WebSocket
  connectSocket();

  // Heartbeat para que el creador sepa que la pantalla está viva
  setDisplayOnline(activeRoom);
  setInterval(() => setDisplayOnline(activeRoom), 1800);

  updateAnimationSettings();
}

function _injectRoster(pets) {
  // Inyectar en la caché de storage.js sin llamar a la API
  pets.forEach(p => {
    if (!readRoster().some(r => r.id === p.id)) {
      try { addAvatar(p); } catch {}
    }
  });
}

// ─── WebSocket ────────────────────────────────────────────────────────────────
function connectSocket() {
  roomSocket = createRoomSocket(activeRoom, handleWsMessage);
}

function handleWsMessage(msg) {
  if (!msg?.type) return;

  switch (msg.type) {
    case '_connected':
      if (statusEl) statusEl.textContent = '● Constelación conectada';
      break;
    case '_disconnected':
      if (statusEl) statusEl.textContent = '○ Reconectando…';
      break;
    case '_failed':
      if (statusEl) statusEl.textContent = '✕ Sin conexión';
      break;

    case 'pet_added':
      if (msg.pet) {
        try { addAvatar(msg.pet); } catch {}
        renderConstellation(msg.pet.id);
      }
      break;

    case 'pet_removed':
      if (msg.petId) {
        removeAvatar(msg.petId);
        renderConstellation();
      }
      break;

    case 'room_cleared':
      clearRoster();
      renderConstellation();
      break;

    case 'pause':
      if (typeof msg.paused === 'boolean') setPaused(msg.paused);
      updateAnimationSettings();
      break;

    case 'labels':
      if (typeof msg.visible === 'boolean') setLabelsVisible(msg.visible);
      updateAnimationSettings();
      break;

    case 'replay':
      if (msg.id) replay(msg.id);
      break;
  }
}

// ─── Renderizado de constelación ──────────────────────────────────────────────
function renderConstellation(newId = null) {
  const roster = readRoster();
  const ids    = new Set(roster.map(p => p.id));

  // Quitar nodos de mascotas que ya no están
  for (const el of constellation.querySelectorAll('.constellation-pet')) {
    if (!ids.has(el.dataset.id)) el.remove();
  }

  constellation.style.setProperty('--pet-size', `${petSize(roster.length)}px`);
  constellation.classList.toggle('compact', roster.length > 19);
  waiting.classList.toggle('is-hidden', roster.length > 0);
  counterEl.textContent = `${roster.length} ${roster.length === 1 ? 'mascota' : 'mascotas'}`;

  roster.forEach((pet, index) => {
    let node = [...constellation.children].find(el => el.dataset.id === pet.id);
    if (!node) {
      node = createPetNode(pet, index);
      const position = slots[pet.slot] || slots[index] || slots[0];
      node.style.left = `${position.x}%`;
      node.style.top  = `${position.y}%`;
      constellation.appendChild(node);

      if (pet.id === newId) {
        node.querySelector('.pet-entry').classList.add('new');
        announce(`✦ ¡${pet.name || 'Una nueva mascota'} llegó a la constelación! ✦`);
      }
    }
  });

  return roster;
}

function announce(message) {
  announcement.textContent = message;
  announcement.classList.add('visible');
  clearTimeout(announcementTimer);
  announcementTimer = setTimeout(() => announcement.classList.remove('visible'), 3000);
}

function replay(id) {
  const roster = readRoster();
  const pet    = roster.find(p => p.id === id) || roster.at(-1);
  if (!pet) return;
  renderConstellation();
  const node = [...constellation.children].find(el => el.dataset.id === pet.id);
  if (!node) return;
  const entry = node.querySelector('.pet-entry');
  entry.classList.remove('new');
  void entry.offsetWidth;
  entry.classList.add('new');
  announce(`✦ ¡${pet.name || 'Una mascota'} volvió a despegar! ✦`);
}

function updateAnimationSettings() {
  constellation.classList.toggle('is-paused',     isPaused());
  constellation.classList.toggle('hide-labels',   !labelsVisible());
  pauseButton.textContent  = isPaused()       ? '▶ Reanudar' : 'Ⅱ Pausar';
  labelsButton.textContent = labelsVisible()  ? 'Ocultar nombres' : 'Mostrar nombres';
}

// ─── Controles de UI ──────────────────────────────────────────────────────────
document.getElementById('go-fullscreen').addEventListener('click', () => {
  if (!document.fullscreenElement) {
    document.body.requestFullscreen?.().catch(() => {
      if (statusEl) statusEl.textContent = 'Usa F11 para pantalla completa';
    });
  } else {
    document.exitFullscreen?.();
  }
});

document.addEventListener('fullscreenchange', () => {
  document.getElementById('go-fullscreen').textContent =
    document.fullscreenElement ? 'Salir de pantalla completa' : '⛶ Pantalla completa';
});

pauseButton.addEventListener('click', () => {
  try {
    const next = !isPaused();
    setPaused(next);
    updateAnimationSettings();
    roomSocket?.send({ type: 'pause', paused: next });
  } catch { announce('No se pudo cambiar el movimiento'); }
});

labelsButton.addEventListener('click', () => {
  try {
    const next = !labelsVisible();
    setLabelsVisible(next);
    updateAnimationSettings();
    roomSocket?.send({ type: 'labels', visible: next });
  } catch { announce('No se pudieron cambiar las etiquetas'); }
});

window.addEventListener('resize', () => {
  constellation.style.setProperty('--pet-size', `${petSize(readRoster().length)}px`);
});

// ─── Arranque ─────────────────────────────────────────────────────────────────
init().catch(err => {
  console.error('[display] init falló:', err);
  announce('Error al cargar la constelación.');
});
