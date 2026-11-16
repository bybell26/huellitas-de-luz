'use strict';
const gallery = document.getElementById('gallery');
const motion = window.HuellitasMotion;
let count = 0;
for (const [species, breeds] of Object.entries(motion.breeds)) {
  for (const breed of breeds) {
    const cat = species === 'gato';
    const card = document.createElement('article');
    card.className = 'pet-card';
    card.dataset.species = cat ? 'cat' : 'dog';
    card.innerHTML = '<div class="card-top"><span>' + (cat ? 'GATO' : 'PERRO') +
      ' / ' + String(++count).padStart(2,'0') + '</span><i aria-hidden="true"></i></div>' +
      '<div class="pet-art">' + motion.render(species, breed.id, motion.colors[(count-1)%motion.colors.length].value, '') +
      '</div><div class="ground" aria-hidden="true"></div><h2>' + breed.name +
      '</h2><p>' + (cat ? 'Tranquilo y observador' : 'Atento y juguetón') + '</p>';
    gallery.append(card);
  }
}
const pause = document.getElementById('pause');
pause.addEventListener('click', () => {
  const paused = pause.getAttribute('aria-pressed') !== 'true';
  gallery.dataset.motionPaused = String(paused);
  pause.setAttribute('aria-pressed', String(paused));
  pause.textContent = paused ? '▶ Reanudar movimiento' : 'Ⅱ Pausar movimiento';
});
document.querySelectorAll('[data-filter]').forEach(button => {
  button.addEventListener('click', () => {
    document.querySelectorAll('[data-filter]').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
    for (const card of gallery.children) {
      card.hidden = button.dataset.filter !== 'all' && card.dataset.species !== button.dataset.filter;
    }
  });
});
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
function showPreference() {
  document.getElementById('motion-note').textContent = reduced.matches
    ? 'Movimiento reducido activado en tu dispositivo: las mascotas se muestran quietas.'
    : 'Cada compañero lleva su propio ritmo. Observa unos segundos sus pequeños gestos.';
}
showPreference();
reduced.addEventListener('change', showPreference);
