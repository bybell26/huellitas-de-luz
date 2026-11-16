'use strict';
// Un solo reloj para toda la sala; posiciones locales sin tráfico de red por frame.
function wanderSeed(id) {
  let seed = 2166136261;
  for (const ch of String(id)) seed = Math.imul(seed ^ ch.charCodeAt(0), 16777619);
  return seed >>> 0;
}
function wanderRandom(state) {
  state.seed = (Math.imul(state.seed, 1664525) + 1013904223) >>> 0;
  return state.seed / 4294967296;
}
function stepPetWander(states, bounds, dt) {
  dt = Math.min(Math.max(dt, 0), .05);
  const velocities = [];
  for (const state of states) {
    if (state.held || state.tricking) { velocities.push([0, 0]); continue; }
    state.time += dt;
    const angle = state.heading + Math.sin(state.time * .27 + state.phase) * .85 +
      Math.sin(state.time * .11 + state.phase * 2) * .55;
    let dx = Math.cos(angle), dy = Math.sin(angle) * .7;
    const edge = Math.min(90, Math.max(20, (bounds.right - bounds.left) / 4));
    dx += Math.max(0, 1 - (state.x - bounds.left) / edge) * 3;
    dx -= Math.max(0, 1 - (bounds.right - state.x) / edge) * 3;
    dy += Math.max(0, 1 - (state.y - bounds.top) / edge) * 3;
    dy -= Math.max(0, 1 - (bounds.bottom - state.y) / edge) * 3;
    for (const other of states) {
      if (other === state) continue;
      const x = state.x - other.x, y = state.y - other.y;
      const distance = Math.hypot(x, y);
      const clearance = (state.size + other.size) * .43 + 12;
      if (distance > 0 && distance < clearance) {
        const force = (1 - distance / clearance) * 2.4;
        dx += x / distance * force; dy += y / distance * force;
      }
    }
    const length = Math.hypot(dx, dy) || 1;
    const ease = 1 - Math.exp(-dt * 1.7);
    velocities.push([
      state.vx + (dx / length * state.speed - state.vx) * ease,
      state.vy + (dy / length * state.speed - state.vy) * ease,
    ]);
  }
  states.forEach((state, index) => {
    if (state.held || state.tricking) return;
    [state.vx, state.vy] = velocities[index];
    state.x = Math.min(bounds.right, Math.max(bounds.left, state.x + state.vx * dt));
    state.y = Math.min(bounds.bottom, Math.max(bounds.top, state.y + state.vy * dt));
  });
}

function createPetRoaming(container, details) {
  const states = new Map();
  const initialSlots = buildSlots();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let selected = null, paused = false, frameId = null, lastTime = null;
  let bounds = { left:0, right:0, top:0, bottom:0 };
  function paint(state) {
    state.node.style.left = '0';
    state.node.style.top = '0';
    state.node.style.transform = 'translate3d(' + state.x.toFixed(2) + 'px,' + state.y.toFixed(2) + 'px,0) translate(-50%,-50%)';
    state.node.style.setProperty('--drift-lean', (state.held ? 0 : state.vx * .09).toFixed(2) + 'deg');
  }
  function hide() {
    if (selected) {
      selected.held = false;
      selected.node.classList.remove('is-inspected');
      selected.node.removeAttribute('aria-describedby');
    }
    selected = null;
    details.hidden = true;
  }
  function show(state) {
    hide();
    selected = state;
    state.held = true;
    state.node.classList.add('is-inspected');
    state.node.setAttribute('aria-describedby', details.id);
    const breed = getBreed(state.pet.species, state.pet.breed);
    details.querySelector('[data-detail-name]').textContent = state.pet.name || 'Sin nombre';
    details.querySelector('[data-detail-breed]').textContent = 'Raza: ' + breed.name;
    details.querySelector('[data-detail-donation]').textContent = formatPetDonation(state.pet);
    details.hidden = false;
    const anchor = state.node.getBoundingClientRect();
    const box = details.getBoundingClientRect();
    const x = Math.max(12, Math.min(innerWidth - box.width - 12, anchor.left + anchor.width / 2 - box.width / 2));
    let y = anchor.top - box.height - 12;
    if (y < 86) y = anchor.bottom + 12;
    y = Math.max(12, Math.min(innerHeight - box.height - 12, y));
    details.style.left = x + 'px';
    details.style.top = y + 'px';
    paint(state);
  }
  function resize() {
    const size = parseFloat(getComputedStyle(container).getPropertyValue('--pet-size')) || 120;
    const width = container.clientWidth, height = container.clientHeight;
    bounds.left = Math.min(width / 2, size / 2 + 18);
    bounds.right = Math.max(bounds.left, width - size / 2 - 18);
    bounds.top = Math.min(height / 2, 90 + size * .55);
    bounds.bottom = Math.max(bounds.top, height - size * .65 - 46);
    for (const state of states.values()) {
      state.size = size;
      state.x = Math.max(bounds.left, Math.min(bounds.right, state.x));
      state.y = Math.max(bounds.top, Math.min(bounds.bottom, state.y));
      paint(state);
    }
    if (selected) show(selected);
  }
  function tick(now) {
    frameId = null;
    if (paused || reduced.matches || document.hidden || !states.size) { lastTime = null; return; }
    if (lastTime === null) lastTime = now;
    const dt = (now - lastTime) / 1000;
    if (dt >= 1 / 30) {
      lastTime = now;
      for(const state of states.values())state.tricking=!!state.node.dataset.trick;
      stepPetWander([...states.values()], bounds, dt);
      for (const state of states.values()) paint(state);
    }
    frameId = requestAnimationFrame(tick);
  }
  function schedule() {
    if (frameId !== null) cancelAnimationFrame(frameId);
    lastTime = null;
    frameId = null;
    if (!paused && !reduced.matches && !document.hidden && states.size) frameId = requestAnimationFrame(tick);
  }
  function sync(roster) {
    const ids = new Set(roster.map(pet => pet.id));
    for (const [id, state] of states) if (!ids.has(id)) {
      if (selected === state) hide();
      states.delete(id);
    }
    for (const pet of roster) {
      const existing = states.get(pet.id);
      if (existing) { existing.pet = pet; continue; }
      const node = [...container.children].find(el => el.dataset.id === pet.id);
      if (!node) continue;
      const state = { pet, node, seed:wanderSeed(pet.id), size:120, x:0, y:0, vx:0, vy:0, held:false, time:0 };
      state.phase = wanderRandom(state) * Math.PI * 2;
      state.heading = wanderRandom(state) * Math.PI * 2;
      state.speed = (pet.species === 'gato' ? 13 : 18) + wanderRandom(state) * 8;
      // Arranque distribuido; después cada mascota elige su propio recorrido.
      const position = initialSlots[pet.slot ?? states.size] || { x:50, y:50 };
      state.x = container.clientWidth * position.x / 100;
      state.y = container.clientHeight * position.y / 100;
      node.addEventListener('pointerenter', () => show(state));
      node.addEventListener('pointerleave', () => { if (selected === state && document.activeElement !== node) hide(); });
      node.addEventListener('focus', () => show(state));
      node.addEventListener('blur', () => { if (selected === state) hide(); });
      node.addEventListener('click', () => show(state));
      node.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); show(state); }
        if (event.key === 'Escape' && selected === state) { event.preventDefault(); event.stopPropagation(); hide(); }
      });
      states.set(pet.id, state);
    }
    resize();
    schedule();
  }
  function dismissOutside(event) {
    if (selected && !selected.node.contains(event.target)) hide();
  }
  document.addEventListener('pointerdown', dismissOutside);
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  reduced.addEventListener('change', schedule);
  document.addEventListener('visibilitychange', schedule);
  return {
    sync,
    setPaused(value) { paused = value; schedule(); },
    destroy() {
      paused = true; schedule(); hide(); states.clear(); observer.disconnect();
      reduced.removeEventListener('change', schedule);
      document.removeEventListener('visibilitychange', schedule);
      document.removeEventListener('pointerdown', dismissOutside);
    },
  };
}
if (typeof module !== 'undefined') module.exports = { stepPetWander, wanderSeed };
