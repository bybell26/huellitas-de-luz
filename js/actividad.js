'use strict';
(() => {
  const params = new URLSearchParams(location.search);
  const action = params.get('action'), petId = params.get('pet');
  const configs = {
    play: ['EL PARQUE', 'Una pelota. Mil aventuras.', 'Lanza, corre y comparte un rato al aire libre.'],
    feed: ['SU RINCÓN FAVORITO', 'La hora más rica del día.', 'Croquetas, agüita y una buena dosis de cariño.'],
    bath: ['EL BAÑO', 'Patitas limpias, mascota feliz.', 'Un baño con agua tibia, jabón y mucho cuidado.'],
    style: ['EL VESTIDOR', 'Un look tan único como su huella.', 'Prueba colores y estilos antes de guardar.'],
  };
  const scene = document.getElementById('activity-scene');
  const avatar = document.getElementById('care-avatar');
  const panel = document.getElementById('care-game');
  const status = document.getElementById('care-status');
  const result = document.getElementById('activity-result');
  const styleForm = document.getElementById('activity-style');
  let pet, remaining, saving = false;
  let resetTimer;
  const key = `huellitas_activity:${getUser()?.id}:${petId}:${action}`;
  const games = createPetActivities({ stage: scene, avatar, panel, status, renderPet, onComplete: () => save(), onStop: completed => {
    if (saving || completed) return;
    status.textContent = 'Sesión cancelada. No se consumió ningún uso.';
    showButton('Volver a empezar', start);
  } });

  function renderPet(appearance = pet?.appearance, collar = pet?.collar) {
    if (pet) avatar.innerHTML = HuellitasMotion.render(pet.species, pet.breed, collar, pet.name, appearance);
  }
  function showButton(label, handler) {
    result.replaceChildren();
    const button = document.createElement('button'); button.type = 'button'; button.className = 'button button-primary'; button.textContent = label;
    button.addEventListener('click', handler); result.append(button);
  }
  function updateBalance() {
    const left = remaining?.[action] || 0;
    document.getElementById('activity-balance').textContent = `${left} de 3 disponibles hoy`;
  }
  function acceptBalance(data) {
    remaining = data.remaining;
    clearTimeout(resetTimer);
    const delay = new Date(data.resetsAt).getTime() - Date.now();
    if (Number.isFinite(delay)) resetTimer = setTimeout(refreshDaily, Math.max(1000, delay + 250));
    updateBalance();
  }
  async function refreshDaily() {
    if (!pet || saving) return;
    try {
      const previous = remaining[action];
      acceptBalance(await apiFetch(`/api/pets/${encodeURIComponent(pet.id)}/activities`));
      if (!previous && remaining[action] && !games.active && !sessionStorage.getItem(key)) {
        status.textContent = '¡Nuevo día! Ya tienes 3 sesiones disponibles para esta actividad.';
        showButton('Empezar actividad', start);
      }
    } catch { /* La siguiente consulta o guardado vuelve a comprobar el límite. */ }
  }
  function start() {
    if (saving || !pet) return;
    result.replaceChildren();
    if (!remaining[action]) { status.textContent = 'Esta mascota ya completó esta actividad 3 veces hoy. Vuelve mañana: se renueva a medianoche de Ciudad de México.'; return; }
    if (action === 'style') {
      styleForm.hidden = false;
      const fields = document.getElementById('style-fields'); fields.innerHTML = PetAppearance.controls(pet.appearance); fields.querySelector('details').open = true;
      const collar = document.getElementById('style-collar'); collar.replaceChildren(...COLORS.map(color => {const option = new Option(color.label, color.value);option.selected = color.value === pet.collar;return option;}));
      status.textContent = 'Prueba tu nuevo look. Solo guardar un cambio real cuenta como una de las 3 sesiones de hoy.';
    } else games.start(action, pet);
  }
  function styleDraft() { return Object.fromEntries([...styleForm.querySelectorAll('[data-appearance]')].map(field => [field.dataset.appearance, field.value])); }
  async function save(extras = {}, retryBody = null) {
    if (saving) return;
    saving = true;
    result.replaceChildren();
    styleForm.querySelectorAll('button,select').forEach(field => { field.disabled = true; });
    status.textContent = 'Guardando este momento…';
    const body = retryBody || { action, requestId: crypto.randomUUID(), ...extras };
    try { sessionStorage.setItem(key, JSON.stringify(body)); } catch {}
    try {
      const data = await apiFetch(`/api/pets/${encodeURIComponent(pet.id)}/activities`, { method: 'POST', body: JSON.stringify(body) });
      try { sessionStorage.removeItem(key); } catch {}
      pet = { ...pet, ...data.pet }; acceptBalance(data);
      renderPet(); updateBalance(); styleForm.hidden = true;
      scene.dataset.completed = 'true';
      status.textContent = { play:'¡Bien jugado! Tu mascota disfrutó del parque.',feed:'¡Buen provecho! Su charola quedó servida y su agua lista.',bath:'¡Limpia y reluciente! El baño terminó.',style:'¡Qué buen look! Su estilo quedó guardado.' }[action];
      if (remaining[action]) showButton(action === 'style' ? 'Probar otro estilo' : 'Otra sesión', () => { delete scene.dataset.completed; start(); });
    } catch (error) {
      status.textContent = error.status >= 400 && error.status < 500 ? error.message : `${error.message} Reintenta guardar; no necesitas repetir la actividad.`;
      showButton('Reintentar guardado', () => save({}, body));
      // Errores definitivos no deben dejar una solicitud inválida al volver a abrir.
      if (error.status >= 400 && error.status < 500) {
        try { sessionStorage.removeItem(key); } catch {}
        try { acceptBalance(await apiFetch(`/api/pets/${encodeURIComponent(pet.id)}/activities`)); } catch {}
        if (!remaining[action]) { result.replaceChildren(); styleForm.hidden = true; }
        else if (action === 'style') showButton('Volver a editar', () => { styleForm.querySelectorAll('button,select').forEach(field => { field.disabled = false; }); start(); });
      } else styleForm.hidden = true;
    } finally { saving = false; styleForm.querySelectorAll('button,select').forEach(field => { field.disabled = false; }); }
  }
  styleForm.addEventListener('change', () => renderPet(styleDraft(), document.getElementById('style-collar').value));
  styleForm.addEventListener('submit', event => { event.preventDefault(); save({ appearance: styleDraft(), collar: document.getElementById('style-collar').value }); });
  window.addEventListener('pagehide', () => { clearTimeout(resetTimer); games.stop(); });
  window.addEventListener('focus', refreshDaily);

  function decorate() {
    const decor = document.getElementById('activity-decor');
    if (action === 'play') decor.innerHTML = '<div class="park-sun"></div><div class="park-cloud cloud-one"></div><div class="park-cloud cloud-two"></div><div class="park-hill"></div><div class="park-tree tree-one"><i></i></div><div class="park-tree tree-two"><i></i></div><div class="park-bench"></div><div class="park-path"></div><div class="park-flowers">✿　✿　　　✿</div>';
    else if (action === 'bath') decor.innerHTML = '<div class="bath-mirror"></div><div class="shower-pipe"></div><div class="shower-head"></div><div class="bath-shelf"><i></i><i></i></div><div class="shower-tray"></div><div class="bath-towel"></div>';
    else if (action === 'feed') decor.innerHTML = '<div class="feeding-window"><i></i></div><div class="feeding-art">HECHO CON<br>♡<br>AMOR</div><div class="feeding-floor"></div><div class="feeding-mat"></div>';
    else decor.innerHTML = '<div class="dressing-mirror"></div><div class="dressing-rack"><i></i><i></i><i></i></div><div class="dressing-rug"></div>';
  }
  async function init() {
    if (!configs[action] || !petId) { status.textContent = 'Actividad no encontrada. Vuelve a Hogar y elige una mascota.'; document.getElementById('activity-balance').textContent = ''; return; }
    document.body.dataset.scene = action; scene.dataset.scene = action;
    const [place,title,subtitle] = configs[action];
    document.title = `${place} · Huellitas de Luz`;
    document.getElementById('activity-place').textContent = place;
    document.getElementById('activity-title').textContent = title;
    document.getElementById('activity-subtitle').textContent = subtitle;
    decorate();
    try {
      pet = (await apiGetPets()).find(item => item.id === petId);
      if (!pet) throw Error('Esta mascota no está en tu cuenta. Vuelve a Hogar.');
      acceptBalance(await apiFetch(`/api/pets/${encodeURIComponent(pet.id)}/activities`));
      document.getElementById('activity-pet').textContent = pet.name || 'Tu mascota';
      renderPet(); updateBalance();
      let pending;
      try { pending = JSON.parse(sessionStorage.getItem(key)); } catch {}
      if (pending?.requestId && pending.action === action) { status.textContent = 'Hay una sesión pendiente de guardar. Puedes reintentar sin gastar otro uso.'; showButton('Reintentar guardado', () => save({}, pending)); }
      else start();
    } catch (error) { status.textContent = error.message; document.getElementById('activity-balance').textContent = 'No disponible'; showButton('Reintentar', init); }
  }
  init();
})();
