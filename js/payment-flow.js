'use strict';
function createPaymentFlow(onUpdate, options = {}) {
  const now = options.now || Date.now;
  const schedule = options.schedule || setTimeout;
  const cancel = options.cancel || clearTimeout;
  const request = options.request || (async (body, signal) => {
    // Incluir JWT si hay sesión activa (requerido por el nuevo backend)
    const token = (typeof getToken === 'function') ? getToken() : null;
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    // En desarrollo apunta al backend en :4000; en producción al mismo origen
    const base = (typeof API_BASE !== 'undefined') ? API_BASE : '';
    const response = await fetch(base + '/api/pey', { method: 'POST', headers, body: JSON.stringify(body), signal });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error('No se pudo consultar Pey.');
    return result.data;
  });
  let qr = null, deadline = 0, timer, timeout, controller, finished = false;
  function finish(status, extra = {}) {
    if (finished) return;
    finished = true; cancel(timer); cancel(timeout); controller?.abort();
    onUpdate({status, qr, ...extra});
  }
  function reject() {
    finish('rejected', {message: 'Cobro rechazado por tiempo agotado: no se confirmó en 2 minutos. Esto no cancela ni revierte un pago bancario.'});
  }
  async function poll() {
    if (finished) return;
    if (now() >= deadline) return reject();
    controller = new AbortController();
    const requestTimeout = schedule(() => controller.abort(), Math.min(10000, deadline - now()));
    try {
      let nextToken;
      const seen = new Set();
      do {
        const data = await request({action: 'status', id: qr.id, nextToken}, controller.signal);
        if (finished) return;
        if (now() >= deadline) return reject();
        const paid = (data.items || []).find(item => item.status === 'PAID' && Number(item.amount) === 0.01 && (!item.currency || item.currency === 'MXN'));
        if (paid) return finish('paid', {transaction: paid});
        nextToken = data.nextToken;
        if (nextToken && seen.has(nextToken)) throw new Error('Paginación repetida.');
        if (nextToken) seen.add(nextToken);
      } while (nextToken);
    } catch {
      if (!finished) onUpdate({status: 'waiting', qr, message: 'Seguimos verificando el pago…', remaining: Math.max(0, Math.ceil((deadline - now()) / 1000))});
    } finally {
      cancel(requestTimeout);
      if (!finished) timer = schedule(poll, Math.min(2000, Math.max(0, deadline - now())));
    }
  }
  return {
    async start() {
      onUpdate({status: 'creating'});
      controller = new AbortController();
      const createTimeout = schedule(() => controller.abort(), 30000);
      try {
        qr = await request({action: 'create'}, controller.signal);
        if (finished) return;
        if (!qr?.id || typeof qr.qrImage !== 'string') throw new Error('QR sin imagen.');
        const image = qr.qrImage.replace(/^data:image\/png;base64,/, '');
        if (!image || !/^[A-Za-z0-9+/=\s]+$/.test(image)) throw new Error('Imagen inválida.');
        qr.qrImage = 'data:image/png;base64,' + image;
        onUpdate({status: 'qr', qr});
      } catch {
        if (!finished) finish('error', {message: 'No fue posible preparar el QR. Si Pey recibió la solicitud, el QR podría haberse creado; no se confirmó ningún pago.'});
      } finally { cancel(createTimeout); }
    },
    validate() {
      if (finished || !qr || deadline) return;
      deadline = now() + 120000;
      onUpdate({status: 'waiting', qr, remaining: 120});
      timeout = schedule(reject, 120000);
      poll();
    },
    dispose() { finished = true; cancel(timer); cancel(timeout); controller?.abort(); }
  };
}
if (typeof module !== 'undefined') module.exports = {createPaymentFlow};
