const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const http=require('node:http');
const {spawn}=require('node:child_process');
const {WebSocket}=require('../backend/node_modules/ws');
const chrome=process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const root=path.resolve(__dirname,'..');

test('modal real: conexión, cierre, Escape y reapertura sin ventanas emergentes', {skip:!fs.existsSync(chrome),timeout:25000},async()=>{
 const bootstrap=`<script>
 localStorage.clear(); sessionStorage.clear();
 localStorage.setItem('huellitas_token','header.'+btoa(JSON.stringify({exp:Math.floor(Date.now()/1000)+3600}))+'.fake');
 localStorage.setItem('huellitas_user',JSON.stringify({id:'test',name:'Prueba'}));
 window.HUELLITAS_API_URL=location.origin;
 if(navigator.serviceWorker)navigator.serviceWorker.register=async()=>({});
 window.popupCount=0; window.open=()=>{window.popupCount++;throw Error('Unexpected popup')};
 window.__sockets=[];
 window.WebSocket=class extends EventTarget{
   static OPEN=1;
   constructor(){super();this.readyState=1;window.__sockets.push(this);setTimeout(()=>this.dispatchEvent(new Event('open')),20)}
   send(){}
   close(){this.readyState=3;this.dispatchEvent(new Event('close'))}
 };
 </script>`;
 const checks=`<script>
 window.addEventListener('DOMContentLoaded',async()=>{
   const out=document.createElement('pre');out.id='browser-result';document.body.append(out);
   const assert=(ok,msg)=>{if(!ok)throw Error(msg)};
   const wait=async(check)=>{for(let i=0;i<100;i++){if(check())return;await new Promise(r=>setTimeout(r,20))}throw Error('Tiempo agotado')};
   let stage='inicio';
   try{
     await wait(()=>document.getElementById('room-code').textContent==='luna-7429');
     const dialog=document.getElementById('constellation-modal'), frame=document.getElementById('constellation-frame');
     const trigger=document.getElementById('open-display'), close=document.getElementById('close-constellation');
     const status=()=>document.getElementById('status-text').textContent;
     assert(status()==='Constelación cerrada','No confundir socket del creador con exhibición');
     stage='abrir';trigger.click();assert(dialog.open,'Modal abierto');
     await wait(()=>status()==='Constelación conectada');
     assert(window.popupCount===0,'No abrir popup');

     const child=frame.contentWindow,doc=frame.contentDocument;
     await wait(()=>doc.querySelectorAll('.constellation-pet').length===2);
     const dog=doc.querySelector('[data-id="pey-demo-dog"]');
     assert(dog.querySelector('.hlm-pet'),'Gestos SVG integrados');
     const start=dog.style.transform;
     await new Promise(r=>setTimeout(r,500));
     assert(dog.style.transform!==start,'Mascota recorre la constelación');
     dog.dispatchEvent(new child.PointerEvent('pointerenter'));
     const details=doc.getElementById('pet-details');
     assert(!details.hidden,'Tarjeta visible al pasar mouse');
     assert(details.textContent.includes('Firulais')&&details.textContent.includes('Husky'),'Nombre y raza');
     assert(details.textContent.includes('0.01')&&details.textContent.includes('MXN'),'Donación confirmada');
     const held=dog.style.transform;
     await new Promise(r=>setTimeout(r,250));
     assert(dog.style.transform===held,'Se detiene para leer');
     dog.dispatchEvent(new child.PointerEvent('pointerleave'));
     assert(details.hidden,'Ocultar tarjeta al salir');
     dog.focus();assert(!details.hidden,'Detalles por teclado');
     dog.blur();
     const pause=doc.getElementById('display-pause');pause.click();
     const paused=dog.style.transform;
     await new Promise(r=>setTimeout(r,250));
     assert(dog.style.transform===paused,'Pausa detiene recorrido');
     pause.click();


     stage='escenarios';
     const scene=doc.getElementById('scene-select');
     scene.value='garden';scene.dispatchEvent(new child.Event('change'));
     assert(doc.body.dataset.scene==='garden','Escenario jardín');
     scene.value='park';scene.dispatchEvent(new child.Event('change'));
     assert(doc.body.dataset.scene==='park','Escenario parque');
     stage='fondo';
     doc.querySelector('[data-wallpaper="pey-demo-dog"]').click();
     const wallpaper=doc.getElementById('wallpaper-dialog'),form=doc.getElementById('wallpaper-form');
     await wait(()=>!doc.getElementById('wallpaper-download').disabled);
     const canvas=doc.getElementById('wallpaper-preview');
     assert(canvas.width===1920&&canvas.height===1080,'Fondo PC');
     assert(doc.querySelectorAll('#wallpaper-pets input:checked').length===1,'Solo la mascota elegida');
     assert(canvas.toDataURL('image/png').startsWith('data:image/png;base64,'),'PNG exportable sin canvas contaminado');
     doc.getElementById('wallpaper-all').click();
     form.elements.format.value='phone';form.dispatchEvent(new child.Event('change'));
     await wait(()=>!doc.getElementById('wallpaper-download').disabled);
     assert(canvas.width===1080&&canvas.height===1920,'Fondo celular');
     assert(doc.querySelectorAll('#wallpaper-pets input:checked').length===2,'Todas las mascotas');
     doc.getElementById('wallpaper-none').click();
     assert(doc.getElementById('wallpaper-download').disabled,'Rechazar selección vacía');
     doc.getElementById('close-wallpaper').click();
     stage='personalizar';
     const palette=child.PetAppearance.normalize({fur:'neon',pattern:'evil'});
     assert(palette.fur==='breed'&&palette.pattern==='breed','Paleta natural validada');
     const custom=child.HuellitasMotion.render('perro','husky','#a77fff','Prueba',{fur:'chocolate',pattern:'patches',ears:'soft',tail:'short',body:'slim'});
     assert(custom.includes('#81543c')&&custom.includes('scale(0.86 1)'),'Apariencia aplicada al SVG');
     stage='donar';
     doc.querySelector('[data-donate="pey-demo-dog"]').click();
     assert(doc.getElementById('donation-dialog').open,'Dialogo para donar');
     assert(doc.getElementById('extra-trick').options.length===2,'Dos trucos de perro');
     doc.getElementById('extra-amount').value='2.50';
     doc.getElementById('extra-form').requestSubmit();
     await wait(()=>doc.querySelector('#donation-content img'));
     const validate=[...doc.querySelectorAll('#donation-content button')].find(b=>b.textContent.includes('validar'));
     validate.click();
     await wait(()=>doc.getElementById('donation-content').textContent.includes('Donación confirmada'));
     assert(dog.dataset.trick==='paw','Pago confirmado activa truco');
     doc.getElementById('close-donation').click();
     child.PetTricks.play({eventId:'test-event',petId:'pey-demo-dog',trick:'paw'});
     assert(dog.dataset.trick==='paw','Patita al confirmar donación');
     delete dog.dataset.trick;
     child.PetTricks.play({eventId:'test-event',petId:'pey-demo-dog',trick:'paw'});
     assert(!dog.dataset.trick,'No repetir el mismo evento');
     scene.value='constellation';scene.dispatchEvent(new child.Event('change'));

     stage='desconectar';frame.contentWindow.__sockets[0].close();
     await wait(()=>status()==='Constelación sin conexión');
     stage='cerrar';close.click();assert(!dialog.open,'Cerrar modal');
     assert(status()==='Constelación cerrada','Estado inmediato al cerrar');
     assert(!frame.hasAttribute('src'),'Descargar iframe y su conexión');
     stage='reabrir';trigger.click();await wait(()=>status()==='Constelación conectada');
     stage='escape';frame.contentDocument.dispatchEvent(new frame.contentWindow.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
     await wait(()=>!dialog.open);
     assert(status()==='Constelación cerrada','Escape actualiza estado');
     trigger.click();await wait(()=>status()==='Constelación conectada');
     dialog.dispatchEvent(new MouseEvent('click',{clientX:-1,clientY:-1,bubbles:true}));
     assert(!dialog.open,'Cierre por fondo');
     trigger.click();await wait(()=>status()==='Constelación conectada');
     out.textContent='PASS_MODAL';
   }catch(err){out.textContent='FAIL_MODAL: '+err.message+' etapa='+stage+' estado='+document.getElementById('status-text').textContent+' aviso='+document.getElementById('notification').textContent}
 });
 </script>`;
 let extraAmount=0;
 const server=http.createServer((req,res)=>{
   const pathname=new URL(req.url,'http://local').pathname;
   if(pathname==='/api/pey'){
     let body='';req.on('data',chunk=>body+=chunk);req.on('end',()=>{
       const data=JSON.parse(body);res.setHeader('Content-Type','application/json');
       if(data.action==='create'){
         extraAmount=data.amount;
         assert.equal(data.purpose,'extra');
         res.end(JSON.stringify({ok:true,data:{id:'EXTRA_QR',qrImage:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j1ioAAAAASUVORK5CYII='}}));
       }else res.end(JSON.stringify({ok:true,data:{items:[{id:'EXTRA_TX',status:'PAID',amount:extraAmount,currency:'MXN',donationEvent:{eventId:'confirmed-extra',petId:'pey-demo-dog',trick:'paw'}}]}}));
     });return;
   }
   if(pathname==='/api/rooms'){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({rooms:[{code:'luna-7429'}]}))}
   if(pathname==='/api/rooms/luna-7429'){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({room:{code:'luna-7429'},pets:[{id:'pey-demo-dog',species:'perro',breed:'husky',collar:'#a77fff',name:'Firulais',slot:7,donation_amount:.01,donation_currency:'MXN'},{id:'pey-demo-cat',species:'gato',breed:'siames',collar:'#a77fff',name:'Mishi',slot:0,donation_amount:null,donation_currency:null}]}))}
   if(!/^\/(?:index\.html|display\.html|manifest\.json|sw\.js|(?:js|css)\/[\w-]+\.(?:js|css))$/.test(pathname)){res.writeHead(404);return res.end()}
   let text=fs.readFileSync(path.join(root,pathname),'utf8');
   if(pathname.endsWith('.html'))text=text.replace('<head>','<head>'+bootstrap);
   if(pathname==='/index.html')text=text.replace('</body>',checks+'</body>');
   res.setHeader('Content-Type',pathname.endsWith('.html')?'text/html; charset=utf-8':pathname.endsWith('.css')?'text/css':'text/javascript');
   res.end(text);
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'huellitas-modal-'));

 const browser=spawn(chrome,['--headless','--disable-gpu','--no-first-run','--remote-debugging-port=0','--user-data-dir='+profile,'--window-size=1280,1000','about:blank'],{windowsHide:true,stdio:'ignore'});
 let cdp;
 const pending=new Map();let sequence=0;
 async function command(method,params={},sessionId) {
   const id=++sequence;
   return new Promise((resolve,reject)=>{
     const timeout=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout: '+method))},5000);
     pending.set(id,{resolve:result=>{clearTimeout(timeout);resolve(result)},reject});
     cdp.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));
   });
 }
 try{
   const portFile=path.join(profile,'DevToolsActivePort');
   let portData='';
   for(let i=0;i<100;i++){
     try{portData=fs.readFileSync(portFile,'utf8');if(portData.trim().split(/\r?\n/).length>=2)break}catch{}
     await new Promise(r=>setTimeout(r,50));
   }
   const [port,endpoint]=portData.trim().split(/\r?\n/);
   cdp=new WebSocket('ws://127.0.0.1:'+port+endpoint);
   await new Promise((resolve,reject)=>{cdp.once('open',resolve);cdp.once('error',reject)});
   cdp.on('message',raw=>{const msg=JSON.parse(raw);const item=pending.get(msg.id);if(item){pending.delete(msg.id);msg.error?item.reject(Error(msg.error.message)):item.resolve(msg.result)}});
   const target=await command('Target.createTarget',{url:'http://127.0.0.1:'+server.address().port+'/index.html',background:false});
   const {sessionId}=await command('Target.attachToTarget',{targetId:target.targetId,flatten:true});
   let result;
   for(let i=0;i<100;i++){
     const value=await command('Runtime.evaluate',{expression:"document.getElementById('browser-result')?.textContent"},sessionId);
     result=value.result.value;
     if(result)break;
     await new Promise(r=>setTimeout(r,80));
   }
   assert.equal(result,'PASS_MODAL');
   await command('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]},sessionId);
   const reduced=await command('Runtime.evaluate',{expression:`(async()=>{
     const frame=document.getElementById('constellation-frame');
     const pet=frame.contentDocument.querySelector('.constellation-pet');
     await new Promise(r=>setTimeout(r,100));
     const position=pet.style.transform;
     await new Promise(r=>setTimeout(r,250));
     return position===pet.style.transform && frame.contentWindow.getComputedStyle(pet.querySelector('.hlm-tail')).animationName==='none';
   })()`,awaitPromise:true},sessionId);
   assert.equal(reduced.result.value,true,'Movimiento reducido detiene recorrido y gestos');
   if(process.env.MODAL_SCREENSHOT){
     await command('Emulation.setEmulatedMedia',{features:[]},sessionId);
     await command('Runtime.evaluate',{expression:`(async()=>{
       const frame=document.getElementById('constellation-frame'),doc=frame.contentDocument;
       const scene=doc.getElementById('scene-select');scene.value='park';scene.dispatchEvent(new frame.contentWindow.Event('change'));
       doc.getElementById('open-wallpaper').click();
       for(let i=0;i<100&&doc.getElementById('wallpaper-download').disabled;i++)await new Promise(r=>setTimeout(r,30));
     })()`,awaitPromise:true},sessionId);
     const shot=await command('Page.captureScreenshot',{format:'png'},sessionId);
     fs.writeFileSync(process.env.MODAL_SCREENSHOT,Buffer.from(shot.data,'base64'));
   }
 }finally{
   if(cdp?.readyState===WebSocket.OPEN){await command('Browser.close').catch(()=>{});cdp.close()}
   if(browser.exitCode===null)browser.kill();
   await new Promise(r=>server.close(r));
 }

});
