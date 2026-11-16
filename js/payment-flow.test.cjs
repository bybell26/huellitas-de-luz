const {test} = require('node:test');
const assert = require('node:assert/strict');
const {createPaymentFlow} = require('./payment-flow.js');
function harness(request) {
  let time = 0, id = 0;
  const tasks = new Map(), updates = [];
  const flow = createPaymentFlow(p => updates.push(p), {
    request, now: () => time,
    schedule: (fn, delay) => {tasks.set(++id, {fn, at: time + delay});return id;},
    cancel: key => tasks.delete(key)
  });
  return {flow, updates, advance(ms) {time += ms;for(const [key, task] of [...tasks])if(task.at <= time){tasks.delete(key);task.fn();}}};
}
const qr = {id: 'QR1', qrImage: 'aW1hZ2U='};
test('PAID confirma y detiene la validación', async () => {
  const h = harness(async input => input.action === 'create' ? {...qr} : {items: [{id: 'T1', amount: 0.01, status: 'PAID', currency: 'MXN'}]});
  await h.flow.start(); h.flow.validate(); await new Promise(setImmediate);
  assert.equal(h.updates.at(-1).status, 'paid');
  h.advance(120000); assert.equal(h.updates.at(-1).status, 'paid');
});
test('rechaza a los 120 segundos aunque la petición siga abierta y descarta PAID tardío', async () => {
  let resolveStatus;
  const h = harness(input => input.action === 'create' ? Promise.resolve({...qr}) : new Promise(resolve => resolveStatus = resolve));
  await h.flow.start(); h.flow.validate();
  h.advance(119999); assert.equal(h.updates.at(-1).status, 'waiting');
  h.advance(1); assert.equal(h.updates.at(-1).status, 'rejected');
  resolveStatus({items: [{id:'late', status:'PAID', amount:0.01}]}); await new Promise(setImmediate);
  assert.equal(h.updates.some(p => p.status === 'paid'), false);
});
test('errores de consulta no aprueban pagos y terminan por tiempo agotado', async () => {
  const h = harness(async input => {if(input.action === 'create')return {...qr};throw Error('offline');});
  await h.flow.start(); h.flow.validate(); await new Promise(setImmediate);
  assert.equal(h.updates.at(-1).status, 'waiting');
  h.advance(120000); assert.equal(h.updates.at(-1).status, 'rejected');
});
test('PENDING o monto distinto no autorizan la mascota', async () => {
  const h = harness(async input => input.action === 'create' ? {...qr} : {items:[{status:'PENDING',amount:0.01},{status:'PAID',amount:1}]});
  await h.flow.start(); h.flow.validate(); await new Promise(setImmediate);
  assert.equal(h.updates.some(p => p.status === 'paid'), false);
  h.advance(120000); assert.equal(h.updates.at(-1).status, 'rejected');
});

test('la creación conserva el motivo del error en lugar de ocultarlo', async () => {
 const h = harness(async () => { throw Error('Pey indica que CoDi no está habilitado.'); });
 await h.flow.start();
 assert.equal(h.updates.at(-1).status, 'error');
 assert.equal(h.updates.at(-1).message, 'Pey indica que CoDi no está habilitado.');
});
