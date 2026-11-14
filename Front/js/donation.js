'use strict';
// Pantalla de donativo y retrato: pago con QR CoDi, subida de foto y descarga.
const donation={phase:'intro',order:null,qr:null,error:'',pollTimer:null,busy:false,photoName:''};
const STATUS_REVIEW=['QR_REVIEW_REQUIRED','PAYMENT_REVIEW_REQUIRED','GENERATION_FAILED'];

function stopPolling(){clearInterval(donation.pollTimer);donation.pollTimer=null}
function resetDonation(){stopPolling();clearOrder();Object.assign(donation,{phase:'intro',order:null,qr:null,error:'',busy:false,photoName:''})}
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
    if(info.status==='PAID'){stopPolling();setPhase('photo')}
    else if(STATUS_REVIEW.includes(info.status)){stopPolling();setPhase('review')}
    else if(['GENERATION_QUEUED','GENERATING'].includes(info.status)){stopPolling();watchGeneration()}
    else if(info.status==='READY'){stopPolling();setPhase('done')}
  });
}
function watchGeneration(){
  donation.phase='working';renderSupport();
  startPolling(info=>{
    if(info.canDownload){stopPolling();setPhase('done')}
    else if(STATUS_REVIEW.includes(info.status)){stopPolling();setPhase('review')}
  });
}

async function beginDonation(){
  if(donation.busy)return;donation.busy=true;
  try{
    if(!donation.order){
      const created=await OrdersApi.create();
      donation.order={id:created.id,token:created.orderToken};saveOrder(donation.order);
    }
    donation.qr=await OrdersApi.createQr(donation.order.id,donation.order.token);
    donation.busy=false;donation.phase='qr';renderSupport();watchPayment();
  }catch(error){
    donation.busy=false;
    if(error.status===502){setPhase('review')}
    else setPhase('intro',error.message);
  }
}

async function sendPhoto(file){
  if(donation.busy)return;
  if(!['image/png','image/jpeg'].includes(file.type)){setPhase('photo','Usa una imagen PNG o JPEG.');return}
  if(file.size>5*1024*1024){setPhase('photo','La foto pesa más de 5 MB.');return}
  donation.busy=true;donation.photoName=file.name;donation.error='';renderSupport();
  try{
    await OrdersApi.uploadPhoto(donation.order.id,donation.order.token,file);
    donation.busy=false;watchGeneration();
  }catch(error){donation.busy=false;setPhase('photo',error.message)}
}

async function downloadPortrait(){
  if(donation.busy)return;donation.busy=true;
  try{
    const {blob,type}=await OrdersApi.download(donation.order.id,donation.order.token);
    const ext=type.includes('svg')?'svg':'png';
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download='retrato-mascota.'+ext;document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
    notify('✓ Descarga iniciada');
  }catch(error){notify(error.message)}
  donation.busy=false;
}

function qrMarkup(){
  const q=donation.qr;if(!q)return '';
  const demo=q.isDemo?'<p class="field-note">Modo demo: este QR no cobra nada.</p>':'';
  if(q.qrImage)return `<div class="qr-box"><img alt="QR CoDi para pagar" src="data:image/png;base64,${q.qrImage}" width="220" height="220"/></div>${demo}`;
  return `<div class="saved-pet" style="word-break:break-all">QR sin imagen. Código CoDi:<br><code>${escapeText(q.qrString||'')}</code></div>${demo}`;
}
function expiryText(){
  const t=donation.qr?.qrExpiresAt;if(!t)return '';
  return new Date(t*1000).toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'});
}
function errorMarkup(){return donation.error?`<p class="field-note" role="alert" style="color:#ffb4b4">${escapeText(donation.error)}</p>`:''}

function renderSupport(){
  const pet=escapeText(state.name.trim()||'tu mascota');
  let body='';
  if(donation.phase==='intro'){
    body=`<h2 class="confirm-heading">Un retrato real de ${pet}</h2>
      <p class="confirm-text">Con un donativo de <strong>${moneyLabel()}</strong> apoyas a las mascotas y recibes una imagen ilustrada generada a partir de la foto de tu perro o gato.</p>
      <div class="review-list"><div class="review-line"><span>Donativo</span><strong>${moneyLabel()}</strong></div><div class="review-line"><span>Forma de pago</span><strong>QR CoDi</strong></div></div>
      ${errorMarkup()}
      <div class="form-actions"><button type="button" class="button button-outline" id="back-sent">← Volver</button><button type="button" class="button button-primary" id="donate" ${donation.busy?'disabled':''}>${donation.busy?'Creando QR…':'Donar '+moneyLabel()+' con CoDi'}</button></div>`;
  }else if(donation.phase==='qr'){
    const demoBtn=donation.qr?.isDemo?'<button type="button" class="button button-outline" id="sim-pay">Simular pago (demo)</button>':'';
    body=`<h2 class="confirm-heading">Escanea para donar ${moneyLabel()}</h2>
      <p class="confirm-text">Abre la app de tu banco, elige pagar con CoDi y escanea el código. Vence a las ${expiryText()}.</p>
      ${qrMarkup()}
      <div class="saved-pet">Esperando tu pago… se confirma solo.</div>
      ${errorMarkup()}
      <div class="form-actions">${demoBtn}</div>`;
  }else if(donation.phase==='photo'){
    body=`<div class="success-mark">✓</div><h2 class="confirm-heading">¡Gracias por tu donativo!</h2>
      <p class="confirm-text">Sube una foto de ${pet} (PNG o JPEG, máximo 5 MB) y generamos su retrato.</p>
      <label class="button button-primary button-wide" for="photo-input" style="display:block;text-align:center;cursor:pointer;margin-top:16px">${donation.busy?'Subiendo '+escapeText(donation.photoName)+'…':'Elegir foto'}</label>
      <input id="photo-input" type="file" accept="image/png,image/jpeg" style="position:absolute;left:-9999px" ${donation.busy?'disabled':''}/>
      ${errorMarkup()}`;
  }else if(donation.phase==='working'){
    body=`<div class="big-paw" style="font-size:42px;margin:8px 0">🐾</div><h2 class="confirm-heading">Creando el retrato de ${pet}…</h2>
      <p class="confirm-text">Puede tardar un minuto. No cierres esta ventana.</p>`;
  }else if(donation.phase==='done'){
    body=`<div class="success-mark">✓</div><h2 class="confirm-heading">¡El retrato de ${pet} está listo!</h2>
      <p class="confirm-text">Descárgalo y compártelo. ¡Gracias por apoyar!</p>
      <div class="form-actions"><button type="button" class="button button-primary button-wide" id="download">⬇ Descargar retrato</button></div>
      <div class="form-actions"><button type="button" class="button button-outline button-wide" id="finish">Crear otra mascota</button></div>`;
  }else if(donation.phase==='review'){
    body=`<h2 class="confirm-heading">Necesitamos revisar tu orden</h2>
      <p class="confirm-text">Algo no quedó claro con el pago o la imagen. Contacta al organizador con el código de tu orden y no pagues de nuevo.</p>
      <div class="saved-pet">Código: <code>${escapeText(donation.order?.id||'sin orden')}</code></div>
      <div class="form-actions"><button type="button" class="button button-outline button-wide" id="finish">Volver al inicio</button></div>`;
  }else{
    body=`<h2 class="confirm-heading">Algo salió mal</h2>${errorMarkup()}
      <div class="form-actions"><button type="button" class="button button-outline button-wide" id="finish">Volver al inicio</button></div>`;
  }
  formRegion.innerHTML=`${header('Donativo y retrato','Último paso: apoya y recibe la imagen de tu mascota.',3)}${body}`;
  bindSupport();
}

function bindSupport(){
  const on=(id,fn)=>{const el=document.getElementById(id);if(el)el.addEventListener('click',fn)};
  on('back-sent',()=>{state.step='sent';render()});
  on('donate',beginDonation);
  on('download',downloadPortrait);
  on('finish',()=>{resetDonation();state.species=null;state.breed=null;state.collar=COLORS[0].value;state.name='';state.step='create';state.lastSentId=null;state.lastReceivedId=null;render();scrollTo({top:0,behavior:'smooth'})});
  on('sim-pay',async()=>{
    try{await OrdersApi.simulatePayment(donation.order.id,donation.order.token)}
    catch(error){donation.error=error.message;renderSupport()}
  });
  const input=document.getElementById('photo-input');
  if(input)input.addEventListener('change',()=>{const f=input.files&&input.files[0];if(f)sendPhoto(f)});
}

// Entrada desde la pantalla "enviada". Retoma una orden guardada en esta pestaña si existe.
async function openSupport(){
  state.step='support';
  const saved=loadOrder();
  if(saved&&!donation.order){
    donation.order=saved;
    try{
      const info=await OrdersApi.get(saved.id,saved.token);
      if(info.canDownload){donation.phase='done'}
      else if(info.canUploadPhoto){donation.phase='photo'}
      else if(['GENERATION_QUEUED','GENERATING'].includes(info.status)){render();watchGeneration();return}
      else if(info.status==='PENDING_PAYMENT'){
        donation.qr=await OrdersApi.createQr(saved.id,saved.token);donation.phase='qr';render();watchPayment();return;
      }else if(STATUS_REVIEW.includes(info.status)){donation.phase='review'}
      else{resetDonation()}
    }catch(error){resetDonation()}
  }
  render();
}
