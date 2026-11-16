'use strict';
function createConstellationModal({ dialog, frame, trigger, closeButton, getRoom, onStateChange }) {
  let currentView = null;
  function close() {
    currentView = null;
    frame.removeAttribute('src');
    document.body.classList.remove('constellation-modal-open');
    trigger.setAttribute('aria-expanded', 'false');
    onStateChange('closed');
    if (dialog.open) dialog.close();
    trigger.focus();
  }
  function open({wallpaperPetId} = {}) {
    const room = getRoom();
    if (!room || dialog.open) return;
    currentView = crypto.randomUUID();
    const url = new URL('display.html', window.location.href);
    url.searchParams.set('room', room);
    url.searchParams.set('embedded', '1');
    url.searchParams.set('view', currentView);
    if(wallpaperPetId)url.searchParams.set('wallpaper',wallpaperPetId);
    dialog.showModal();
    trigger.setAttribute('aria-expanded', 'true');
    document.body.classList.add('constellation-modal-open');
    onStateChange('connecting');
    frame.src = url.href;
    closeButton.focus();
  }
  closeButton.addEventListener('click', close);
  dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
  dialog.addEventListener('close', () => {
    if (!dialog.open && currentView !== null) close();
  });
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right ||
        event.clientY < bounds.top || event.clientY > bounds.bottom) close();
  });
  window.addEventListener('message', event => {
    if (!dialog.open || event.origin !== window.location.origin || event.source !== frame.contentWindow) return;
    const msg = event.data;
    if (!msg || msg.view !== currentView || msg.room !== getRoom()) return;
    if (msg.type === 'huellitas-display-close') close();
    if (msg.type === 'huellitas-display-state' && ['connected', 'connecting', 'disconnected'].includes(msg.state)) {
      onStateChange(msg.state);
    }
  });
  return { open, close };
}
