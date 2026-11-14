const {test} = require('node:test');
const assert = require('node:assert/strict');
const {createServer} = require('./pruebas-pey/server.cjs');
test('aplicación y API en el mismo origen, configuración privada', async () => {
  const server = createServer(async () => new Response(JSON.stringify({id:'QR1',qrImage:'aW1hZ2U='}), {status:201}), async () => 'fake', __dirname);
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  try {
    for(const file of ['/index.html','/display.html','/js/app.js','/js/payment-flow.js','/css/creator.css'])assert.equal((await fetch(base+file)).status,200);
    for(const file of ['/pruebas-pey/config.local.json','/package.json/pey-openapi.json','/servidor_local.cjs'])assert.equal((await fetch(base+file)).status,404);
    const result = await (await fetch(base+'/api/pey',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({action:'create'})})).json();
    assert.equal(result.data.id,'QR1');
  } finally {await new Promise(resolve => server.close(resolve));}
});
