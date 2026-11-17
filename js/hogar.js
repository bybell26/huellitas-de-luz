'use strict';
(() => {
  const room = document.getElementById('home-room');
  const list = document.getElementById('home-pets');
  const message = document.getElementById('home-message');
  const count = document.getElementById('home-count');
  const refresh = document.getElementById('home-refresh');
  const dialog = document.getElementById('pet-care');
  const careStatus = document.getElementById('care-status');
  const careAvatar = document.getElementById('care-avatar');
  let loading = false, signature = null, roster = [], selected = null, opening = 0;
  let dailyTimer;
  async function openCare(pet) {
    selected = pet;
    const revision = ++opening;
    document.getElementById('care-title').textContent = pet.name || 'Tu mascota';
    careAvatar.innerHTML = HuellitasMotion.render(pet.species, pet.breed, pet.collar, pet.name, pet.appearance);
    careStatus.textContent = 'Cargando actividades?';
    dialog.querySelectorAll('[data-care]').forEach(button => { button.disabled = true; button.querySelector('small').textContent = 'Cargando?'; });
    if (!dialog.open) dialog.showModal();
    try {
      const { remaining, resetsAt } = await apiFetch('/api/pets/' + encodeURIComponent(pet.id) + '/activities');
      if (revision !== opening || !dialog.open) return;
      clearTimeout(dailyTimer);
      const delay = new Date(resetsAt).getTime() - Date.now();
      if (Number.isFinite(delay)) dailyTimer = setTimeout(() => { if (dialog.open) openCare(pet); }, Math.max(1000, delay + 250));
      dialog.querySelectorAll('[data-care]').forEach(button => {
        const left = remaining[button.dataset.care];
        button.disabled = !left;
        button.querySelector('small').textContent = left ? left + ' de 3 hoy' : 'Límite de hoy · vuelve mañana';
      });
      careStatus.textContent = 'Elige una actividad para ir a su espacio.';
    } catch (error) { if (revision === opening) careStatus.textContent = error.message + ' Cierra y vuelve a intentar.'; }
  }
  dialog.querySelectorAll('[data-care]').forEach(button => button.addEventListener('click', () => {
    const params = new URLSearchParams({ pet: selected.id, action: button.dataset.care });
    window.location.href = 'actividad.html?' + params;
  }));
  document.getElementById('care-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => { clearTimeout(dailyTimer); opening++; loadHome(); });
  window.addEventListener('focus', () => { if (dialog.open && selected) openCare(selected); });
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
  window.addEventListener('pagehide', () => { clearInterval(timer); }, { once: true });
  loadHome();
})();
