const { test }=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function worker(fetch) {
 const events={};let saved;
 const cache={match:async()=>new Response('viejo'),put:async(req,res)=>{saved=await res.text()}};
 const ctx={Response,URL,console,fetch,caches:{open:async()=>cache},self:{location:{origin:'https://huellitas.example'},addEventListener:(type,fn)=>events[type]=fn}};
 vm.createContext(ctx);vm.runInContext(fs.readFileSync(__dirname+'/sw.js','utf8'),ctx);
 return {ctx,events,saved:()=>saved};
}
test('con conexión sirve scripts actuales y reemplaza los antiguos',async()=>{
 const w=worker(async()=>new Response('nuevo'));
 assert.equal(await (await w.ctx.networkFirst({url:'https://huellitas.example/js/payment-flow.js'})).text(),'nuevo');
 assert.equal(w.saved(),'nuevo');
});
test('sin conexión conserva el shell y no intercepta solicitudes a Pey',async()=>{
 const w=worker(async()=>{throw Error('offline')});
 assert.equal(await (await w.ctx.networkFirst({url:'https://huellitas.example/index.html'})).text(),'viejo');
 let intercepted=false;
 w.events.fetch({request:{url:'https://huellitas.example/api/pey',method:'POST'},respondWith(){intercepted=true}});
 assert.equal(intercepted,false);
});
