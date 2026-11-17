'use strict';
(() => {
  const room = document.getElementById('home-room');
  const list = document.getElementById('home-pets');
  const message = document.getElementById('home-message');
  const count = document.getElementById('home-count');
  const refresh = document.getElementById('home-refresh');
  let loading = false;
  let signature = null;
  let roster = [];
  const dialog = document.getElementById('pet-care');
  const careStatus = document.getElementById('care-status');
  const careAvatar = document.getElementById('care-avatar');
  const careEffect = document.getElementById('care-effect');
  const styleForm = document.getElementById('care-style');
  const styleFields = document.getElementById('care-style-fields');
  const collarField = document.getElementById('care-collar');
  const closeButton = document.getElementById('care-close');
  let selected = null, balance = null, busy = false, opening = 0, effectTimer;
  const pending = new Map();

  function renderCare(appearance = selected?.appearance, collar = selected?.collar) {
    if (selected) careAvatar.innerHTML = HuellitasMotion.render(selected.species, selected.breed, collar, selected.name, appearance);
  }
  function updateActivities() {
    for (const button of dialog.querySelectorAll('[data-care]')) {
      const left = balance?.[button.dataset.care];
      button.disabled = busy || left === undefined || left === 0;
      button.querySelector('small').textContent = left === undefined ? 'No disponible' : left ? `${left} de 5 gratis` : 'Sin usos gratis · precio por definir';
    }
    closeButton.disabled = busy;
    for (const field of styleForm.querySelectorAll('button, select')) field.disabled = busy;
  }
  async function openCare(pet) {
    selected = pet;
    balance = null;
    const revision = ++opening;
    clearTimeout(effectTimer);
    careEffect.textContent = '';
    careAvatar.removeAttribute('data-activity');
    styleForm.hidden = true;
    document.getElementById('care-title').textContent = pet.name || 'Tu mascota';
    careStatus.textContent = 'Cargando tus actividades gratuitas…';
    renderCare();
    updateActivities();
    dialog.showModal();
    try {
      const result = await apiFetch(`/api/pets/${encodeURIComponent(pet.id)}/activities`);
      if (revision !== opening || !dialog.open) return;
      balance = result.remaining;
      careStatus.textContent = '¿Qué hacemos hoy?';
    } catch (error) {
      if (revision === opening && dialog.open) careStatus.textContent = `${error.message} Cierra y vuelve a seleccionar tu mascota para reintentar.`;
    }
    if (revision === opening) updateActivities();
  }
  function editStyle() {
    styleFields.innerHTML = PetAppearance.controls(selected.appearance);
    styleFields.querySelector('details').open = true;
    collarField.replaceChildren(...COLORS.map(color => {
      const option = new Option(color.label, color.value);
      option.selected = color.value === selected.collar;
      return option;
    }));
    styleForm.hidden = false;
    careStatus.textContent = 'Prueba tu look. Solo guardar un cambio consume un uso gratuito.';
    styleForm.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
  function draftAppearance() {
    return Object.fromEntries([...styleFields.querySelectorAll('[data-appearance]')].map(field => [field.dataset.appearance, field.value]));
  }
  async function doActivity(action, extras = {}) {
    if (busy || !balance?.[action]) return;
    busy = true;
    updateActivities();
    careStatus.textContent = 'Un momento…';
    const key = `${selected.id}:${action}`;
    const payload = JSON.stringify(extras);
    let request = pending.get(key);
    if (!request || request.payload !== payload) {
      request = { payload, body: { action, requestId: crypto.randomUUID(), ...extras } };
      pending.set(key, request);
    }
    try {
      const result = await apiFetch(`/api/pets/${encodeURIComponent(selected.id)}/activities`, { method: 'POST', body: JSON.stringify(request.body) });
      pending.delete(key);
      balance = result.remaining;
      selected = { ...selected, ...result.pet };
      roster = roster.map(pet => pet.id === selected.id ? selected : pet);
      signature = null;
      renderCare();
      styleForm.hidden = true;
      const messages = { feed: '¡Qué rico! Tu mascota disfrutó su comida.', play: '¡A jugar! Un ratito de diversión juntos.', bath: '¡Lista! Tu mascota quedó limpia y reluciente.', style: '¡Nuevo look! El estilo quedó guardado.' };
      careStatus.textContent = messages[action];
      careEffect.textContent = { feed: '🍲 💛', play: '🎾 ✨', bath: '🫧 🧼', style: '✨ 💜' }[action];
      careAvatar.dataset.activity = action;
      clearTimeout(effectTimer);
      effectTimer = setTimeout(() => { careEffect.textContent = ''; careAvatar.removeAttribute('data-activity'); }, 3500);
    } catch (error) {
      // El mismo identificador permite reintentar sin descontar dos veces.
      careStatus.textContent = error.message;
      try { balance = (await apiFetch(`/api/pets/${encodeURIComponent(selected.id)}/activities`)).remaining; } catch {}
    } finally { busy = false; updateActivities(); }
  }
  dialog.querySelectorAll('[data-care]').forEach(button => button.addEventListener('click', () => {
    if (button.dataset.care === 'style') editStyle();
    else doActivity(button.dataset.care);
  }));
  styleForm.addEventListener('change', () => renderCare(draftAppearance(), collarField.value));
  styleForm.addEventListener('submit', event => { event.preventDefault(); doActivity('style', { appearance: draftAppearance(), collar: collarField.value }); });
  document.getElementById('care-style-cancel').addEventListener('click', () => { styleForm.hidden = true; renderCare(); careStatus.textContent = '¿Qué hacemos hoy?'; });
  closeButton.addEventListener('click', () => { if (!busy) dialog.close(); });
  dialog.addEventListener('cancel', event => { if (busy) event.preventDefault(); });
  dialog.addEventListener('close', () => { opening++; loadHome(); });

  async function loadHome() {
    if (loading || dialog.open || !isLoggedIn()) return;
    loading = true;
    refresh.disabled = true;
    room.setAttribute('aria-busy', 'true');
    try {
      const pets = await apiGetPets();
      roster = pets;
      const next = JSON.stringify(pets);
      if (signature !== next) {
        list.replaceChildren(...pets.map((pet, index) => {
          const figure = document.createElement('figure');
          figure.className = 'home-pet';
          figure.dataset.id = pet.id;
          const trigger = document.createElement('button');
          trigger.className = 'home-pet-trigger';
          trigger.type = 'button';
          trigger.setAttribute('aria-haspopup', 'dialog');
          trigger.setAttribute('aria-controls', 'pet-care');
          trigger.setAttribute('aria-label', `Cuidar a ${pet.name || 'tu mascota'}, ${getBreed(pet.species, pet.breed).name}`);
          trigger.innerHTML = HuellitasMotion.render(pet.species, pet.breed, pet.collar, pet.name, pet.appearance);
          trigger.addEventListener('click', () => openCare(roster.find(item => item.id === pet.id) || pet));
          const caption = document.createElement('figcaption');
          caption.textContent = pet.name || `Mascota ${index + 1}`;
          const breed = document.createElement('small');
          breed.textContent = getBreed(pet.species, pet.breed).name;
          caption.append(breed);
          caption.id = `home-label-${index}`;
          trigger.setAttribute('aria-describedby', caption.id);
          figure.append(trigger, caption);
          return figure;
        }));
        signature = next;
      }
      count.textContent = `${pets.length} ${pets.length === 1 ? 'mascota en casa' : 'mascotas en casa'}`;
      message.hidden = pets.length > 0;
      if (!pets.length) message.innerHTML = 'Tu hogar está listo para recibir compañía.<br><a href="index.html">Crea tu primera mascota</a>';
    } catch (error) {
      message.hidden = false;
      message.textContent = `No pudimos actualizar tu hogar. ${error.message} Pulsa Actualizar para reintentar.`;
      if (signature === null) count.textContent = 'Sin conexión';
    } finally {
      loading = false;
      refresh.disabled = false;
      room.setAttribute('aria-busy', 'false');
    }
  }
  refresh.addEventListener('click', loadHome);
  window.addEventListener('focus', loadHome);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) loadHome(); });
  const timer = setInterval(() => { if (!document.hidden) loadHome(); }, 15000);
  window.addEventListener('pagehide', () => clearInterval(timer), { once: true });
  loadHome();
})();
