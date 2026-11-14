const {test} = require('node:test');
const assert = require('node:assert/strict');
const {createServer} = require('./server.cjs');
const {paymentOutcome} = require('./payment.js');
test('cobro fijo, secreto privado y consulta de QR', async () => {
 const calls=[];
 const server=createServer(async (url,options)=>{calls.push({url,options});return new Response(JSON.stringify(options.method==='POST'?{id:'QR1',qrImage:null}:{items:[{id:'TX1',status:'PAID',amount:0.01,currency:'MXN'}]}),{status:options.method==='POST'?201:200});},async ()=>'fake-server-secret');
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port;
 const send=(body,origin=base)=>fetch(base+'/api/pey',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify(body)});
 try{
  for(const file of ['/','/app.js','/payment.js']){const r=await fetch(base+file);assert.equal(r.status,200);assert.equal((await r.text()).includes('fake-server-secret'),false);}
  for(const file of ['/config.local.json','/server.cjs','/.gitignore'])assert.equal((await fetch(base+file)).status,404);
  assert.equal((await send({action:'create'},'https://other.example')).status,403);
  assert.equal((await send({action:'other'})).status,400);
  assert.equal((await send({action:'status',id:'../other'})).status,400);
  const qr=await(await send({action:'create',amount:100,token:'browser-token',body:{amount:100}})).json();
  assert.equal(qr.status,201);
  assert.equal(JSON.parse(calls.at(-1).options.body).amount,0.01);
  assert.equal(calls.at(-1).options.headers.Authorization,'Bearer fake-server-secret');
  const status=await(await send({action:'status',id:'QR1',nextToken:'abc='})).json();
  assert.equal(calls.at(-1).url,'https://api.pey.mx/transaction/codi/qr/QR1?nextToken=abc%3D');
  assert.equal(paymentOutcome(status.data.items).id,'TX1');
 }finally{await new Promise(resolve=>server.close(resolve));}
});
test('solo PAID por el monto esperado confirma el pago',()=>{
 assert.equal(paymentOutcome([]),null);
 for(const status of ['PENDING','REJECTED','UNKNOWN'])assert.equal(paymentOutcome([{status,amount:0.01}]),null);
 assert.equal(paymentOutcome([{status:'PAID',amount:1}]),null);
 assert.equal(paymentOutcome([{status:'PAID',amount:0.01,currency:'USD'}]),null);
 assert.equal(paymentOutcome([{id:'ok',status:'PAID',amount:0.01,currency:'MXN'}]).id,'ok');
});
