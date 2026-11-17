import 'dotenv/config';
import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { once } from 'node:events';
import pg from 'pg';
import express from 'express';
import { WebSocket } from 'ws';

const schema = 'huellitas_test_' + randomBytes(6).toString('hex');
const originalFetch = globalThis.fetch;
let admin, pool, server, wss, base, signToken, users;
let qrSequence = 0, upstreamCalls = 0;
let peyFailure = null;
const transactions = new Map();
const sockets = new Set();

before(async () => {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL requerida: usa una base local de pruebas.');
  admin = new pg.Client({ connectionString: process.env.DATABASE_URL, options: '', connectionTimeoutMillis: 5000 });
  await admin.connect();
  await admin.query('CREATE SCHEMA "' + schema + '"');
  process.env.PGOPTIONS = '-c search_path=' + schema + ',public';
  process.env.JWT_SECRET = randomBytes(32).toString('hex');
  process.env.PEY_API_KEY = 'test-key';
  ({ default: pool } = await import('../src/db/pool.js'));
  assert.equal((await pool.query('SELECT current_schema() AS name')).rows[0].name, schema);
  await pool.query(await readFile(new URL('../src/db/schema.sql', import.meta.url), 'utf8'));
  ({ signToken } = await import('../src/middleware/auth.js'));
  const app = express();
  app.use(express.json());
  for (const [route, file] of [['auth','auth'],['pets','pets'],['rooms','rooms'],['pey','pey']]) {
    app.use('/api/' + route, (await import('../src/routes/' + file + '.js')).default);
  }
  server = createServer(app);
  wss = (await import('../src/ws/rooms.js')).attachWebSocket(server);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  base = 'http://127.0.0.1:' + server.address().port;
  users = (await pool.query("INSERT INTO users (email,password,name) VALUES ('a@test.example','unused','A'),('b@test.example','unused','B') RETURNING id,email,name")).rows;
  globalThis.fetch = async (url, options) => {
    if (String(url).startsWith('https://api.pey.mx/')) {
      upstreamCalls++;
      if (peyFailure) return Response.json(peyFailure.body,{status:peyFailure.status});
      if (options.method === 'POST') return Response.json({ id: 'QR' + ++qrSequence, qrImage: 'YWJj' }, { status: 201 });
      const qr = new URL(url).pathname.split('/').at(-1);
      return Response.json({ items: transactions.get(qr) || [] });
    }
    return originalFetch(url, options);
  };
});
after(async () => {
  globalThis.fetch = originalFetch;
  for (const socket of sockets) socket.terminate();
  if (wss) await new Promise(resolve => wss.close(resolve));
  if (server) await new Promise(resolve => server.close(resolve));
  if (pool) await pool.end();
  if (admin) {
    await admin.query('DROP SCHEMA IF EXISTS "' + schema + '" CASCADE');
    await admin.end();
  }
});

async function send(method, path, user, body) {
  const response = await originalFetch(base + path, {
    method, headers: { 'Content-Type': 'application/json', ...(user ? { Authorization: 'Bearer ' + signToken(user) } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: response.status, body: await response.json() };
}
const pet = id => ({ id: 'pey-' + id, species: 'gato', breed: 'siames', collar: '#a77fff', name: 'Luna' });
async function pay(user, tx, amount = 0.01, currency = 'MXN') {
  const created = await send('POST','/api/pey',user,{ action:'create' });
  assert.equal(created.status,200);
  const qr = created.body.data.id;
  transactions.set(qr, [{id:tx,status:'PAID',amount,currency}]);
  const result = await send('POST','/api/pey',user,{ action:'status',id:qr });
  assert.equal(result.status,200);
  return qr;
}

test('registro, login y mascota pagada se sincronizan entre dos clientes', async () => {
  const account = { email: 'integration@test.example', password: 'Integration-123!', name: 'Integración' };
  const registered = await send('POST', '/api/auth/register', null, account);
  assert.equal(registered.status, 201);
  assert.ok(registered.body.token);
  assert.equal(registered.body.user.password, undefined);
  const loggedIn = await send('POST', '/api/auth/login', null, account);
  assert.equal(loggedIn.status, 200);
  assert.equal(loggedIn.body.user.id, registered.body.user.id);
  assert.equal((await send('POST', '/api/auth/login', null, { ...account, password: 'incorrect-password' })).status, 401);
  const profile = await originalFetch(base + '/api/auth/me', { headers: { Authorization: 'Bearer ' + loggedIn.body.token } });
  assert.equal(profile.status, 200);
  assert.equal((await profile.json()).user.id, registered.body.user.id);
  const user = loggedIn.body.user;
  const room = (await send('POST', '/api/rooms', user, { name: 'Integración' })).body.room;
  const clients = [];
  for (let i = 0; i < 2; i++) {
    const socket = new WebSocket(base.replace('http:', 'ws:') + '/ws?room=' + room.code + '&token=' + loggedIn.body.token);
    sockets.add(socket);
    await once(socket, 'open');
    clients.push(socket);
  }
  const received = clients.map(socket => new Promise((resolve, reject) => {
    const timer = setTimeout(() => { socket.off('message', handler); reject(Error('No llegó pet_added')); }, 2000);
    function handler(raw) {
      const event = JSON.parse(raw);
      if (event.type === 'pet_added') { clearTimeout(timer); socket.off('message', handler); resolve(event.pet); }
    }
    socket.on('message', handler);
  }));
  await pay(user, 'INTEGRATION');
  const saved = await send('POST', '/api/pets', user, pet('INTEGRATION'));
  assert.equal(saved.status, 201);
  const added = await send('POST', '/api/rooms/' + room.code + '/pets', user, { petId: pet('INTEGRATION').id });
  assert.equal(added.status, 201);
  for (const synced of await Promise.all(received)) assert.equal(synced.id, pet('INTEGRATION').id);
  const roster = await send('GET', '/api/rooms/' + room.code, user);
  assert.equal(roster.body.pets[0].id, pet('INTEGRATION').id);
  clients.forEach(socket => socket.close());
});

test('actividades: cinco usos por mascota, propiedad, concurrencia y estilo persistente', async () => {
  const [owner, other] = users;
  await pay(owner, 'CARE');
  const id = pet('CARE').id;
  assert.equal((await send('POST', '/api/pets', owner, pet('CARE'))).status, 201);
  const route = '/api/pets/' + id + '/activities';
  assert.equal((await send('GET', route, null)).status, 401);
  assert.equal((await send('GET', route, other)).status, 404);
  assert.equal((await send('POST', route, other, { action: 'feed', requestId: randomUUID() })).status, 404);
  assert.equal((await send('POST', route, owner, { action: 'invalid', requestId: randomUUID() })).status, 400);
  assert.deepEqual((await send('GET', route, owner)).body.remaining, { feed: 5, play: 5, bath: 5, style: 5 });
  const request = { action: 'feed', requestId: randomUUID() };
  const results = await Promise.all(Array.from({ length: 3 }, () => send('POST', route, owner, request)));
  assert.ok(results.every(result => result.status === 200 && result.body.remaining.feed === 4));
  assert.equal((await send('POST', route, owner, { ...request, action: 'play' })).status, 409);
  const simultaneous = await Promise.all(Array.from({ length: 6 }, () => send('POST', route, owner, { action: 'play', requestId: randomUUID() })));
  assert.equal(simultaneous.filter(result => result.status === 200).length, 5);
  assert.equal(simultaneous.filter(result => result.status === 409).length, 1);
  for (let i = 0; i < 5; i++) {
    assert.equal((await send('POST', route, owner, { action: 'bath', requestId: randomUUID() })).status, 200);
    assert.equal((await send('POST', route, owner, { action: 'style', requestId: randomUUID(), appearance: { fur: i % 2 ? 'cream' : 'gray' }, collar: '#73a7fc' })).status, 200);
  }
  for (const action of ['play', 'bath', 'style']) {
    const exhausted = await send('POST', route, owner, { action, requestId: randomUUID(), appearance: { fur: 'black' }, collar: '#73a7fc' });
    assert.equal(exhausted.status, 409);
    assert.equal(exhausted.body.remaining[action], 0);
  }
  const pets = (await send('GET', '/api/pets', owner)).body.pets;
  assert.deepEqual(pets.find(item => item.id === id).appearance, { fur: 'gray' });
  assert.equal(pets.find(item => item.id === id).collar, '#73a7fc');
  assert.deepEqual((await send('GET', route, owner)).body.remaining, { feed: 4, play: 0, bath: 0, style: 0 });
  // Una mascota nueva tiene su propio saldo y un estilo inválido no consume usos.
  await pay(owner, 'CARE2');
  await send('POST', '/api/pets', owner, pet('CARE2'));
  const second = '/api/pets/' + pet('CARE2').id + '/activities';
  assert.equal((await send('POST', second, owner, { action: 'style', requestId: randomUUID(), appearance: { fur: 'neon' }, collar: '#73a7fc' })).status, 400);
  assert.equal((await send('POST', second, owner, { action: 'style', requestId: randomUUID(), appearance: {}, collar: '#a77fff' })).status, 400);
  assert.deepEqual((await send('GET', second, owner)).body.remaining, { feed: 5, play: 5, bath: 5, style: 5 });
});

test('pago obligatorio, propiedad del QR, consumo único y reintento de mascota', async () => {
  const [a,b] = users;
  assert.equal((await send('POST','/api/pets',a,pet('inventado'))).status,403);
  const qr = await pay(a,'TX1');
  const calls = upstreamCalls;
  assert.equal((await send('POST','/api/pey',b,{action:'status',id:qr})).status,404);
  assert.equal(upstreamCalls,calls,'no consultar cobros ajenos a Pey');
  const results = await Promise.all([send('POST','/api/pets',a,pet('TX1')),send('POST','/api/pets',a,pet('TX1'))]);
  assert.deepEqual(results.map(r=>r.status).sort(),[200,201]);
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM pets WHERE id='pey-TX1'")).rows[0].n,1);
  const foreign = await send('POST','/api/pets',b,pet('TX1'));
  assert.equal(foreign.status,403);
  assert.equal(foreign.body.pet,undefined);
  assert.equal((await send('DELETE','/api/pets/pey-TX1',a)).status,200);
  assert.equal((await send('POST','/api/pets',a,pet('TX1'))).status,403,'no reutilizar un recibo después de borrar');
});
test('montos y monedas incorrectos no habilitan mascotas', async () => {
  await pay(users[0],'TX_BAD_AMOUNT',1);
  await pay(users[0],'TX_BAD_CURRENCY',0.01,'USD');
  for (const tx of ['TX_BAD_AMOUNT','TX_BAD_CURRENCY']) {
    assert.equal((await send('POST','/api/pets',users[0],pet(tx))).status,403);
  }
});
test('altas simultáneas, límite de sala y reintentos incluso con sala llena', async () => {
  const a=users[0];
  const room=(await send('POST','/api/rooms',a,{name:'Concurrencia'})).body.room;
  await pool.query('UPDATE rooms SET max_pets=2 WHERE id=$1',[room.id]);
  for (const tx of ['SLOT1','SLOT2','SLOT3']) {await pay(a,tx);assert.equal((await send('POST','/api/pets',a,pet(tx))).status,201);}
  const results=await Promise.all(['SLOT1','SLOT2'].map(tx=>send('POST','/api/rooms/'+room.code+'/pets',a,{petId:'pey-'+tx})));
  assert.ok(results.every(r=>r.status===201));
  assert.deepEqual(results.map(r=>r.body.pet.slot).sort(),[0,1]);
  const retry=await send('POST','/api/rooms/'+room.code+'/pets',a,{petId:'pey-SLOT1'});
  assert.equal(retry.status,200);
  assert.equal(retry.body.pet.slot,results[0].body.pet.slot);
  assert.equal((await send('POST','/api/rooms/'+room.code+'/pets',a,{petId:'pey-SLOT3'})).status,409);
  assert.equal((await send('DELETE','/api/rooms/'+room.code,users[1])).status,403);
  assert.equal((await send('DELETE','/api/rooms/'+room.code,a)).status,200);
  assert.equal((await send('DELETE','/api/rooms/'+room.code,a)).status,200);
});
test('WebSocket retransmite controles del dueño y rechaza los ajenos', async () => {
  const room=(await send('POST','/api/rooms',users[0],{name:'WS'})).body.room;
  async function connect(user) {
    const url=base.replace('http:','ws:')+'/ws?room='+room.code+(user?'&token='+signToken(user):'');
    const socket=new WebSocket(url);sockets.add(socket);await once(socket,'open');return socket;
  }
  const owner=await connect(users[0]),viewer=await connect(),other=await connect(users[1]);
  const messages=[];
  viewer.on('message',raw=>messages.push(JSON.parse(raw)));
  for (const control of [{type:'pause',paused:true},{type:'labels',visible:false},{type:'replay',id:'pey-SLOT1'}]) {
    const received=new Promise((resolve,reject)=>{
      const timeout=setTimeout(()=>reject(Error('No se retransmitió '+control.type)),1500);
      const handler=raw=>{const msg=JSON.parse(raw);if(msg.type===control.type){clearTimeout(timeout);viewer.off('message',handler);resolve(msg);}};
      viewer.on('message',handler);
    });
    owner.send(JSON.stringify(control));
    assert.deepEqual(await received,control);
  }
  other.send(JSON.stringify({type:'pause',paused:false}));
  viewer.send(JSON.stringify({type:'pause',paused:false}));
  await new Promise(resolve=>setTimeout(resolve,100));
  assert.equal(messages.filter(m=>m.type==='pause').length,1);
});

test('restablecer contraseña conserva la cuenta y guarda solo bcrypt', async () => {
  const { default: bcrypt } = await import('bcrypt');
  const { resetPassword } = await import('../scripts/reset-password.js');
  const before = (await pool.query('SELECT id, name FROM users WHERE email = $1', [users[0].email])).rows[0];
  const reset = await resetPassword(users[0].email);
  const after = (await pool.query('SELECT id, name, password FROM users WHERE email = $1', [users[0].email])).rows[0];
  assert.equal(after.id, before.id);
  assert.equal(after.name, before.name);
  assert.notEqual(after.password, reset.password);
  assert.equal(await bcrypt.compare(reset.password, after.password), true);
  await assert.rejects(resetPassword('no-existe@test.example'), /No existe/);
});

test('importe confirmado se conserva en sala y eventos, sin exponer el recibo', async () => {
  const a = users[0];
  await pay(a,'DONATION_DETAIL');
  assert.equal((await send('POST','/api/pets',a,pet('DONATION_DETAIL'))).status,201);
  const room=(await send('POST','/api/rooms',a,{name:'Detalles'})).body.room;
  const added=await send('POST','/api/rooms/'+room.code+'/pets',a,{petId:'pey-DONATION_DETAIL'});
  assert.equal(added.body.pet.donation_amount,.01);
  assert.equal(added.body.pet.donation_currency,'MXN');
  const publicRoom=await send('GET','/api/rooms/'+room.code,null);
  assert.equal(publicRoom.body.pets[0].donation_amount,.01);
  assert.equal(publicRoom.body.pets[0].donation_currency,'MXN');
  assert.equal(publicRoom.body.pets[0].transaction_id,undefined);
  assert.equal(publicRoom.body.pets[0].qr_id,undefined);
});

test('donación extra: monto exacto, total acumulado y un solo evento en reintentos', async () => {
 const donor=users[1], target='pey-SLOT1';
 const created=await send('POST','/api/pey',donor,{action:'create',purpose:'extra',petId:target,amount:12.5,trick:'yarn'});
 assert.equal(created.status,200);
 const qr=created.body.data.id;
 transactions.set(qr,[{id:'EXTRA1',status:'PAID',amount:12.5,currency:'MXN'}]);
 const results=await Promise.all([send('POST','/api/pey',donor,{action:'status',id:qr}),send('POST','/api/pey',donor,{action:'status',id:qr})]);
 assert.ok(results.every(r=>r.status===200));
 const events=results.map(r=>r.body.data.items[0].donationEvent);
 assert.equal(events[0].eventId,events[1].eventId);
 assert.equal(events[0].trick,'yarn');
 assert.equal((await pool.query("SELECT count(*)::int AS n FROM pet_donations WHERE transaction_id='EXTRA1'")).rows[0].n,1);
 const room=(await send('POST','/api/rooms',users[0],{name:'Acumulado'})).body.room;
 await send('POST','/api/rooms/'+room.code+'/pets',users[0],{petId:target});
 const roster=await send('GET','/api/rooms/'+room.code,null);
 assert.equal(roster.body.pets[0].donation_amount,12.51);
 assert.equal((await send('POST','/api/pets',donor,pet('EXTRA1'))).status,403,'no crear mascota con recibo extra');
 assert.equal((await send('POST','/api/pey',users[0],{action:'status',id:qr})).status,404);
 const altered=await send('POST','/api/pey',donor,{action:'create',purpose:'extra',petId:target,amount:5,trick:'stand'});
 const qr2=altered.body.data.id;
 transactions.set(qr2,[{id:'EXTRA_WRONG',status:'PAID',amount:4,currency:'MXN'}]);
 await send('POST','/api/pey',donor,{action:'status',id:qr2});
 assert.equal((await pool.query("SELECT count(*)::int AS n FROM pet_donations WHERE transaction_id='EXTRA_WRONG'")).rows[0].n,0);
});
test('validación de montos, especie del truco y apariencia natural persistente',async()=>{
 for(const amount of [0,-1,.001,1000.01,'10',null]){
   assert.equal((await send('POST','/api/pey',users[0],{action:'create',purpose:'extra',petId:'pey-SLOT1',amount,trick:'yarn'})).status,400);
 }
 assert.equal((await send('POST','/api/pey',users[0],{action:'create',purpose:'extra',petId:'pey-SLOT1',amount:10,trick:'paw'})).status,400);
 await pay(users[0],'CUSTOM_PET');
 const custom={...pet('CUSTOM_PET'),appearance:{fur:'ginger',pattern:'stripes',ears:'soft',tail:'long',body:'stocky'}};
 assert.equal((await send('POST','/api/pets',users[0],{...custom,appearance:{fur:'neon'}})).status,400);
 const saved=await send('POST','/api/pets',users[0],custom);
 assert.equal(saved.status,201);
 assert.deepEqual(saved.body.pet.appearance,custom.appearance);
 const room=(await send('POST','/api/rooms',users[0],{name:'Personalizada'})).body.room;
 await send('POST','/api/rooms/'+room.code+'/pets',users[0],{petId:custom.id});
 const fetched=await send('GET','/api/rooms/'+room.code,null);
 assert.deepEqual(fetched.body.pets[0].appearance,custom.appearance);
});

test('errores de Pey visibles sin cerrar la sesión del usuario ni filtrar la clave', async () => {
 try {
  peyFailure = { status:401, body:{error:{type:'UNAUTHORIZED',message:'secret test-key'}} };
  const denied = await send('POST','/api/pey',users[0],{action:'create'});
  assert.equal(denied.status,502);
  assert.equal(denied.body.status,401);
  assert.match(denied.body.error,/API key/);
  assert.equal(JSON.stringify(denied.body).includes('test-key'),false);
  peyFailure = { status:400, body:{error:{type:'INVALID_STATE'}} };
  const disabled = await send('POST','/api/pey',users[0],{action:'create'});
  assert.equal(disabled.status,502);
  assert.match(disabled.body.error,/CoDi no está habilitado/);
 } finally { peyFailure = null; }
});
