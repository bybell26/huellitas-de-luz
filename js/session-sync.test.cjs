const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=name=>fs.readFileSync(path.join(__dirname,name),'utf8');
function store(){const data=new Map();return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)}}
function browser(extra={}) {
  const ctx={console,Date,URL,atob,localStorage:store(),sessionStorage:store(),window:{location:{origin:'https://huellitas.example',hostname:'huellitas.example',pathname:'/index.html',search:''}},...extra};
  vm.createContext(ctx);
  for(const file of ['auth.js','api.js','storage.js'])vm.runInContext(source(file),ctx);
  return ctx;
}
const token=exp=>'header.'+Buffer.from(JSON.stringify({exp})).toString('base64url')+'.signature';
test('sesiones: expiran, limpian sala y no conservan credenciales de otra pestaña',()=>{
  const ctx=browser();
  ctx.oldToken=token(Date.now()/1000+600);
  vm.runInContext("saveSession(oldToken,{id:'A'},false);setActiveRoom('luna-7429');saveSession(oldToken,{id:'B'},true)",ctx);
  assert.equal(vm.runInContext('getActiveRoom()',ctx),null);
  assert.equal(vm.runInContext('getUser().id',ctx),'B');
  assert.equal(ctx.sessionStorage.getItem('huellitas_token'),null);
  ctx.expired=token(1);
  vm.runInContext("saveSession(expired,{id:'B'})",ctx);
  assert.equal(vm.runInContext('isLoggedIn()',ctx),false);
  assert.equal(vm.runInContext('getToken()',ctx),null);
});
test('401 limpia sesión y redirige al acceso',async()=>{
  const ctx=browser({fetch:async()=>({ok:false,status:401,json:async()=>({error:'Token expirado'})})});
  ctx.valid=token(Date.now()/1000+600);
  vm.runInContext("saveSession(valid,{id:'A'})",ctx);
  await assert.rejects(vm.runInContext("apiGetPets()",ctx),/Token expirado/);
  assert.equal(vm.runInContext('getToken()',ctx),null);
  assert.ok(ctx.window.location.href.startsWith('/login.html?next='));
});
test('redirecciones solo al mismo origen',()=>{
  const ctx=browser();
  for(const next of ['//evil.example','https://evil.example/','javascript:alert(1)','/login.html'])assert.equal(ctx.safeRedirect(next),'/index.html');
  assert.equal(ctx.safeRedirect('/display.html?room=luna-7429'),'/display.html?room=luna-7429');
});
test('slots del servidor se conservan',()=>{
  const ctx=browser();
  const added=ctx.addAvatar({id:'pey-one',slot:7});
  assert.equal(added.slot,7);
});
test('reconexión descarta fotos viejas y recupera altas y bajas',async()=>{
  const queries=[],renders=[];
  const ctx=browser();
  ctx.apiGetRoom=()=>new Promise(resolve=>queries.push(resolve));
  const sync=ctx.createRosterSync(()=> 'luna-7429',()=>renders.push(ctx.readRoster()));
  ctx.addAvatar({id:'viejo',slot:0});
  const first=sync();
  sync(); // evento recibido mientras la foto inicial sigue pendiente
  queries.shift()({pets:[{id:'viejo',slot:0}]});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(renders.length,0);
  queries.shift()({pets:[{id:'nuevo',slot:9}]});
  await first;
  assert.equal(renders.length,1);
  assert.equal(renders[0][0].id,'nuevo');
  assert.equal(renders[0][0].slot,9);
});
test('sala guardada ajena se sustituye por una sala propia',async()=>{
  const ctx=browser();
  ctx.apiGetRooms=async()=>[{code:'nova-1234'}];
  ctx.apiCreateRoom=async()=>{throw Error('No crear sala innecesaria')};
  ctx.setActiveRoom('luna-7429');
  const app=source('app.js');
  const fn=app.slice(app.indexOf('async function ensureRoom()'),app.indexOf('function connectRoomSocket()'));
  vm.runInContext('let activeRoom=null;'+fn,ctx);
  await ctx.ensureRoom();
  assert.equal(ctx.getActiveRoom(),'nova-1234');
});
