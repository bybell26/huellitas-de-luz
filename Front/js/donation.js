'use strict';
// Pantalla de donativo: pago con QR CoDi y descarga del avatar elegido (PNG con su nombre).
const donation={phase:'intro',order:null,qr:null,error:'',pollTimer:null,countdownTimer:null,busy:false};
const STATUS_REVIEW=['QR_REVIEW_REQUIRED','PAYMENT_REVIEW_REQUIRED'];

function stopPolling(){clearInterval(donation.pollTimer);donation.pollTimer=null;stopCountdown()}
function stopCountdown(){clearInterval(donation.countdownTimer);donation.countdownTimer=null}
function secondsLeft(){const t=donation.qr?.qrExpiresAt;return t?Math.max(0,t-Math.floor(Date.now()/1000)):0}
function countdownText(){const s=secondsLeft();return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0')}
function startCountdown(){
  stopCountdown();
  const tick=()=>{
    const el=document.getElementById('qr-countdown');
    if(secondsLeft()<=0){stopPolling();setPhase('expired');return}
    if(el){el.textContent=countdownText();el.classList.toggle('urgent',secondsLeft()<=60)}
  };
  donation.countdownTimer=setInterval(tick,1000);tick();
}
function resetDonation(){stopPolling();clearOrder();Object.assign(donation,{phase:'intro',order:null,qr:null,error:'',busy:false})}
function moneyLabel(){return '$'+DONATION_DISPLAY_MXN+' MXN'}
function setPhase(phase,error=''){donation.phase=phase;donation.error=error;renderSupport()}

function startPolling(onStatus){
  stopPolling();
  const tick=async()=>{
    if(!donation.order)return;
    try{
      const info=await OrdersApi.get(donation.order.id,donation.order.token);
      onStatus(info);
    }catch(error){
      if(error.status===404){stopPolling();clearOrder();setPhase('error','La orden ya no existe. Empieza de nuevo.')}
    }
  };
  donation.pollTimer=setInterval(tick,3000);tick();
}

function watchPayment(){
  startPolling(info=>{
    if(['PAID','GENERATION_QUEUED','GENERATING','READY'].includes(info.status)){stopPolling();setPhase('done')}
    else if(STATUS_REVIEW.includes(info.status)){stopPolling();setPhase('review')}
  });
}
async function beginDonation(){
  if(donation.busy)return;donation.busy=true;
  donation.phase='creating';donation.error='';renderSupport();
  const loaderText=text=>{const el=document.getElementById('loader-text');if(el)el.textContent=text};
  try{
    if(!donation.order){
      loaderText('Creando tu orden…');
      const created=await OrdersApi.create();
      donation.order={id:created.id,token:created.orderToken};saveOrder(donation.order);
    }
    loaderText('Generando tu código QR…');
    donation.qr=await OrdersApi.createQr(donation.order.id,donation.order.token);
    donation.busy=false;donation.phase='qr';renderSupport();watchPayment();startCountdown();
  }catch(error){
    donation.busy=false;
    if(error.status===502){setPhase('review')}
    else setPhase('intro',error.message);
  }
}

// Avatar a descargar: el que se acaba de enviar; si se recargó la página, el último de la constelación.
function chosenAvatar(){
  return readRoster().find(a=>a.id===state.lastSentId)||latestAvatar()||null;
}
function loadImage(src){return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('No se pudo preparar la imagen.'));img.src=src})}
async function buildAvatarPng(a){
  const svg=petSVG(a.species,a.breed,a.collar,a.name);
  const url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));
  try{
    const img=await loadImage(url);
    const W=1080,H=1350,canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;
    const c=canvas.getContext('2d');
    const bg=c.createLinearGradient(0,0,W,H);bg.addColorStop(0,'#0b1230');bg.addColorStop(1,'#241c5c');c.fillStyle=bg;c.fillRect(0,0,W,H);
    const glow=c.createRadialGradient(W/2,560,60,W/2,560,560);glow.addColorStop(0,'rgba(133,234,202,.22)');glow.addColorStop(1,'rgba(133,234,202,0)');c.fillStyle=glow;c.fillRect(0,0,W,H);
    c.fillStyle='rgba(255,255,255,.55)';
    for(let i=0;i<46;i++){const x=(i*397)%W,y=(i*613)%H,r=1+(i%3);c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill()}
    const w=780,h=w*img.naturalHeight/img.naturalWidth||w*340/320;
    c.drawImage(img,(W-w)/2,140,w,h);
    c.textAlign='center';c.fillStyle='#ffffff';c.font='700 92px "Segoe UI",Arial,sans-serif';
    const name=(a.name||'').trim();
    c.fillText(name||(a.species==='gato'?'Mi michi':'Mi perrito'),W/2,1130);
    const breed=getBreed(a.species,a.breed);
    c.fillStyle='#b3c1d8';c.font='400 42px "Segoe UI",Arial,sans-serif';c.fillText(`${a.species==='gato'?'Gato':'Perro'} · ${breed.name}`,W/2,1195);
    c.fillStyle='#85eaca';c.font='600 32px "Segoe UI",Arial,sans-serif';c.fillText('✦ órbita pets · gracias por tu donativo',W/2,1280);
    return await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('No se pudo crear el PNG.')),'image/png'));
  }finally{URL.revokeObjectURL(url)}
}
async function downloadAvatar(){
  if(donation.busy)return;
  const a=chosenAvatar();if(!a){notify('No encontré la mascota para descargar.');return}
  donation.busy=true;
  try{
    const blob=await buildAvatarPng(a);
    const url=URL.createObjectURL(blob);
    const link=document.createElement('a');link.href=url;
    link.download=((a.name||'').trim().replace(/[^\p{L}\p{N}_-]+/gu,'-')||'mascota')+'-orbita-pets.png';
    document.body.appendChild(link);link.click();link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
    notify('✓ Descarga iniciada');
  }catch(error){notify(error.message)}
  donation.busy=false;
}
function localQrDataUrl(text){
  try{const qr=qrcode(0,'M');qr.addData(text);qr.make();return qr.createDataURL(8,0)}catch(error){return null}
}
function qrMarkup(){
  const q=donation.qr;if(!q)return '';
  // Caso real: Pey entrega la imagen del QR. Respaldo (modo demo): se dibuja desde qrString.
  const src=q.qrImage?'data:image/png;base64,'+q.qrImage:(q.qrString&&typeof qrcode==='function'?localQrDataUrl(q.qrString):null);
  const demo=q.isDemo?'<p class="field-note qr-demo">Modo demo: este QR no cobra nada.</p>':'';
  if(!src)return `<div class="saved-pet" style="word-break:break-all">No se pudo mostrar el QR. Código CoDi:<br><code>${escapeText(q.qrString||'')}</code></div>${demo}`;
  return `<div class="qr-frame"><div class="qr-box"><img alt="Código QR CoDi para pagar ${moneyLabel()}" src="${src}"/></div><span class="qr-corner tl"></span><span class="qr-corner tr"></span><span class="qr-corner bl"></span><span class="qr-corner br"></span></div>${demo}`;
}
function expiryText(){
  const t=donation.qr?.qrExpiresAt;if(!t)return '';
  return new Date(t*1000).toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'});
}
function errorMarkup(){return donation.error?`<p class="field-note" role="alert" style="color:#ffb4b4">${escapeText(donation.error)}</p>`:''}

function renderSupport(){
  const chosen=chosenAvatar();
  const pet=escapeText((chosen?.name||state.name||'').trim()||'tu mascota');
  let body='';
  if(donation.phase==='intro'){
    body=`<h2 class="confirm-heading">Llévate a ${pet}</h2>
      <p class="confirm-text">Con un donativo de <strong>${moneyLabel()}</strong> apoyas a las mascotas y descargas la imagen de tu mascota con su nombre.</p>
      <div class="review-list"><div class="review-line"><span>Donativo</span><strong>${moneyLabel()}</strong></div><div class="review-line"><span>Forma de pago</span><strong>QR CoDi</strong></div></div>
      ${errorMarkup()}
      <div class="form-actions"><button type="button" class="button button-outline" id="back-sent">← Volver</button><button type="button" class="button button-primary" id="donate" ${donation.busy?'disabled':''}>${donation.busy?'Creando QR…':'Donar '+moneyLabel()+' con CoDi'}</button></div>`;
  }else if(donation.phase==='creating'){
    body=`<div class="qr-loading" role="status" aria-live="polite"><div class="qr-spinner" aria-hidden="true"></div><h2 class="confirm-heading">Preparando tu donativo</h2><p class="confirm-text" id="loader-text">Creando tu orden…</p><p class="field-note">Esto puede tardar unos segundos. No cierres esta ventana.</p></div>`;
  }else if(donation.phase==='qr'){
    const demoBtn=donation.qr?.isDemo?'<button type="button" class="button button-outline" id="sim-pay">Simular pago (demo)</button>':'';
    body=`<h2 class="confirm-heading">Escanea para donar ${moneyLabel()}</h2>
      ${qrMarkup()}
      <div class="qr-timer">Vence en <strong id="qr-countdown">${countdownText()}</strong> <small>(a las ${expiryText()})</small></div>
      <ol class="qr-steps"><li>Abre la app de tu banco</li><li>Elige pagar con <strong>CoDi</strong> y escanea el código</li><li>Confirma el pago de <strong>${moneyLabel()}</strong></li></ol>
      <div class="saved-pet qr-waiting"><span class="qr-pulse"></span>Esperando tu pago… se confirma solo.</div>
      ${errorMarkup()}
      <div class="form-actions">${demoBtn}</div>`;
  }else if(donation.phase==='done'){
    body=`<div class="success-mark">✓</div><h2 class="confirm-heading">¡Gracias por tu donativo!</h2>
      <p class="confirm-text">${pet} ya está listo para descargar.</p>
      ${chosen?`<div class="download-preview">${petSVG(chosen.species,chosen.breed,chosen.collar,chosen.name)}</div>`:''}
      <div class="form-actions"><button type="button" class="button button-primary button-wide" id="download">⬇ Descargar a ${pet}</button></div>
      <div class="form-actions"><button type="button" class="button button-outline button-wide" id="finish">Crear otra mascota</button></div>`;
  }else if(donation.phase==='expired'){
    body=`<h2 class="confirm-heading">El QR venció</h2>
      <p class="confirm-text">No se hizo ningún cobro. Si ya pagaste, no lo repitas y contacta al organizador con tu código: <code>${escapeText(donation.order?.id||'')}</code>. Si no, genera un QR nuevo.</p>
      <div class="form-actions"><button type="button" class="button button-primary button-wide" id="retry-qr">Generar QR nuevo</button></div>`;
  }else if(donation.phase==='review'){
    body=`<h2 class="confirm-heading">Necesitamos revisar tu orden</h2>
      <p class="confirm-text">Algo no quedó claro con el pago. Contacta al organizador con el código de tu orden y no pagues de nuevo.</p>
      <div class="saved-pet">Código: <code>${escapeText(donation.order?.id||'sin orden')}</code></div>
      <div class="form-actions"><button type="button" class="button button-outline button-wide" id="finish">Volver al inicio</button></div>`;
  }else{
    body=`<h2 class="confirm-heading">Algo salió mal</h2>${errorMarkup()}
      <div class="form-actions"><button type="button" class="button button-outline button-wide" id="finish">Volver al inicio</button></div>`;
  }
  formRegion.innerHTML=`${header('Donativo','Último paso: apoya y descarga a tu mascota.',3)}${body}`;
  bindSupport();
}
function bindSupport(){
  const on=(id,fn)=>{const el=document.getElementById(id);if(el)el.addEventListener('click',fn)};
  on('back-sent',()=>{state.step='sent';render()});
  on('donate',beginDonation);
  on('retry-qr',()=>{resetDonation();beginDonation()});
  on('download',downloadAvatar);
  on('finish',()=>{resetDonation();state.species=null;state.breed=null;state.collar=COLORS[0].value;state.name='';state.step='create';state.lastSentId=null;state.lastReceivedId=null;render();scrollTo({top:0,behavior:'smooth'})});
  on('sim-pay',async()=>{
    try{await OrdersApi.simulatePayment(donation.order.id,donation.order.token)}
    catch(error){donation.error=error.message;renderSupport()}
  });
}

// Entrada desde la pantalla "enviada". Retoma una orden guardada en esta pestaña si existe.
async function openSupport(){
  state.step='support';
  const saved=loadOrder();
  if(saved&&!donation.order){
    donation.order=saved;
    try{
      const info=await OrdersApi.get(saved.id,saved.token);
      if(['PAID','GENERATION_QUEUED','GENERATING','READY'].includes(info.status)){donation.phase='done'}
      else if(info.status==='PENDING_PAYMENT'){
        donation.phase='creating';render();
        donation.qr=await OrdersApi.createQr(saved.id,saved.token);donation.phase='qr';render();watchPayment();startCountdown();return;
      }else if(STATUS_REVIEW.includes(info.status)){donation.phase='review'}
      else{resetDonation()}
    }catch(error){resetDonation()}
  }
  render();
}
