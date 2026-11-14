'use strict';
const formRegion=document.getElementById('form-region');
const previewRegion=document.getElementById('preview-region');
const notification=document.getElementById('notification');
const state={species:null,breed:null,collar:COLORS[0].value,name:'',step:'create',busy:false,lastSentId:null,lastReceivedId:null};
let toastTimer;
const bus=createBus(message=>{
  if(message?.type==='ready')updateStatus();
  if(message?.type==='sync'||message?.type==='pause')refreshRoster();
  if(message?.type==='received' && message.id===state.lastSentId){
    state.lastReceivedId=message.id;
    notify('✓ La mascota apareció en la pantalla 2');
    const el=document.getElementById('send-detail');
    if(el)el.textContent='✓ Recibida en la pantalla 2';
  }
});
function notify(message){
  notification.textContent=message;
  notification.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>notification.classList.remove('show'),4100);
}
function updateStatus(){
  const online=isDisplayOnline();
  const status=document.getElementById('display-status');
  status.classList.toggle('online',online);
  document.getElementById('status-text').textContent=online?'Pantalla 2 conectada':'Pantalla 2 sin abrir';
}
function updateOperator(){
  const has=readRoster().length>0;
  document.getElementById('replay').disabled=!has;
  document.getElementById('clear-display').disabled=!has;
  document.getElementById('pause').textContent=isPaused()?'▶ Reanudar movimiento':'Ⅱ Pausar movimiento';
}
function previewMarkup(){
  const chosen=state.species&&state.breed ? getBreed(state.species,state.breed) : null;
  const name=state.name.trim();
  return `<div class="preview-header"><h3>Así se verá tu mascota</h3><span class="pill">✧ VISTA EN VIVO</span></div>
    <div class="scene"><div class="scene-ring"></div><div class="scene-ring two"></div><i class="scene-spark a"></i><i class="scene-spark b"></i><i class="scene-spark c"></i>
      ${chosen?`<div class="preview-pet">${petSVG(state.species,state.breed,state.collar,name)}</div>`:'<div class="empty-preview"><span>🐾</span>Selecciona perro o gato y elige una raza para conocer a tu mascota.</div>'}
      <div class="preview-shadow"></div>
    </div>
    <div class="preview-details"><div><strong>${escapeText(name||'Tu nueva mascota')}</strong><p>${chosen?`${labelFor(state)} · ${chosen.name}`:'Esperando selección'}</p></div>${chosen?'<span class="green-check">Personalizando</span>':'<span class="pill">A TU GUSTO</span>'}</div>`;
}
function renderPreview(){previewRegion.innerHTML=previewMarkup()}
function actionContent(label,icon='arrow',detail=''){
  const paths={arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>',qr:'<rect x="3" y="3" width="6" height="6" rx="1"/><rect x="15" y="3" width="6" height="6" rx="1"/><rect x="3" y="15" width="6" height="6" rx="1"/><path d="M15 15h3v3h3m-6 3h3m3-6v-3"/>',check:'<path d="m5 12 4 4L19 6"/>',plus:'<path d="M12 5v14M5 12h14"/>'};
  return `<span class="button-label">${escapeText(label)}${detail?`<small>${escapeText(detail)}</small>`:''}</span><span class="button-icon button-trailing" aria-hidden="true"><svg viewBox="0 0 24 24">${paths[icon]||paths.arrow}</svg></span>`;
}
function header(title,subtitle,stepCount=1){
  return `<div class="head-row"><div><h2>${title}</h2><p>${subtitle}</p></div><ol class="creation-steps" aria-label="Progreso de creación">${['Diseña','Revisa','Paga'].map((label,i)=>`<li ${i+1===stepCount?'aria-current="step"':''} class="${i+1<stepCount?'is-complete':''}"><span class="step-number" aria-hidden="true">${i+1<stepCount?'✓':i+1}</span>${label}</li>`).join('')}</ol></div>`;
}
function renderCreate(){
  const full=readRoster().length>=MAX_PETS;
  const complete=!!state.species&&!!state.breed&&!full;
  formRegion.innerHTML=`${header('Diseña tu compañero','Son solo tres decisiones. ¡Hazlo a tu manera!',1)}
    <div class="form-group"><span class="field-title"><span class="field-index">01</span> Elige tu mascota</span><div class="species-grid">
      ${[['perro','🐶','Perro','Amigo fiel'],['gato','🐱','Gato','Espíritu libre']].map(([id,emoji,label,sub])=>`<button class="species-choice" type="button" data-species="${id}" aria-pressed="${state.species===id}"><span class="emoji">${emoji}</span><span><strong>${label}</strong><small>${sub}</small></span></button>`).join('')}
    </div></div>
    <div class="form-group"><span class="field-title"><span class="field-index">02</span> Selecciona su raza</span>
      ${state.species?`<div class="breed-grid">${BREEDS[state.species].map(b=>`<button type="button" class="breed-choice" data-breed="${b.id}" aria-pressed="${state.breed===b.id}" title="${b.name}">${b.isNew?'<span class="breed-badge">Nuevo</span>':''}<span class="pet-thumbnail">${petSVG(state.species,b.id,state.collar)}</span><strong>${b.name}</strong></button>`).join('')}</div><p class="hint">${BREEDS[state.species].length} razas, cada una con su propia personalidad.</p>`:'<div class="empty-choice">Primero selecciona perro o gato para descubrir sus razas.</div>'}
    </div>
    <div class="form-group"><span class="field-title"><span class="field-index">03</span> Dale su toque personal</span><div class="collar-name-grid"><div><span class="mini-label">Color de collar</span><div class="color-options">${COLORS.map(c=>`<button class="color-choice" type="button" data-collar="${c.value}" aria-label="Collar ${c.label}" aria-pressed="${state.collar===c.value}" title="${c.label}"><span style="background:${c.value}"></span></button>`).join('')}</div></div>
      <div><label for="pet-name" class="mini-label">Nombre (opcional)</label><input id="pet-name" class="name-field" maxlength="16" autocomplete="off" placeholder="Ej. Luna" value="${escapeText(state.name)}" /></div></div></div>
    <button id="continue" class="button button-primary button-wide" type="button" ${complete?'':'disabled'}>${actionContent(full?'Constelación completa':'Revisar mi mascota','arrow',full?'42 de 42 mascotas':complete?'Tu compañero está listo para el siguiente paso':'Elige un animal y una raza para continuar')}</button><p class="field-note">${full?'Retira una mascota desde el centro de control para crear otra.':'Confirma el diseño y paga $0.01 MXN para enviarla a la pantalla 2.'}</p>`;
  formRegion.querySelectorAll('[data-species]').forEach(btn=>btn.addEventListener('click',()=>{
    if(state.species!==btn.dataset.species){state.species=btn.dataset.species;state.breed=null;}
    renderCreate();renderPreview();
  }));
  formRegion.querySelectorAll('[data-breed]').forEach(btn=>btn.addEventListener('click',()=>{state.breed=btn.dataset.breed;renderCreate();renderPreview()}));
  formRegion.querySelectorAll('[data-collar]').forEach(btn=>btn.addEventListener('click',()=>{state.collar=btn.dataset.collar;renderCreate();renderPreview()}));
  document.getElementById('pet-name').addEventListener('input',event=>{state.name=event.target.value;renderPreview()});
  document.getElementById('continue').addEventListener('click',()=>{
    if(!complete)return;state.step='review1';render();scrollTo({top:0,behavior:'smooth'});
  });
}
function reviewMarkup(){
  const b=getBreed(state.species,state.breed);
  const color=COLORS.find(c=>c.value===state.collar);
  return `<div class="review-list"><div class="review-line"><span>Animal</span><strong>${state.species==='perro'?'🐶 Perro':'🐱 Gato'}</strong></div>
    <div class="review-line"><span>Raza</span><strong>${b.name}</strong></div>
    <div class="review-line"><span>Color del collar</span><strong><span style="display:inline-block;background:${color.value};width:11px;height:11px;border-radius:50%;margin-right:8px"></span>${color.label}</strong></div>
    <div class="review-line"><span>Nombre</span><strong>${escapeText(state.name.trim()||'Sin nombre')}</strong></div></div>`;
}
function renderReview(){
  formRegion.innerHTML=header('Confirma tu mascota','Revisa el diseño antes de pagar.',2)+reviewMarkup()+'<p class="confirm-text">El siguiente paso es pagar $0.01 MXN con QR. Tu mascota aparecerá en la pantalla compartida cuando Pey apruebe el cobro.</p><div class="form-actions"><button class="button button-outline" id="edit">Editar</button><button class="button button-primary" id="confirm">Confirmar y pagar $0.01</button></div>';
  document.getElementById('edit').addEventListener('click',()=>{state.step='create';render()});
  document.getElementById('confirm').innerHTML=actionContent('Confirmar y pagar','qr','$0.01 MXN · Pago con CoDi');
  document.getElementById('confirm').addEventListener('click',beginPayment);
}
let paymentFlow=null, paymentResult=null;
function beginPayment(){
  if(state.busy)return;
  if(readRoster().length>=MAX_PETS){notify('La constelación está llena. Retira una mascota antes de pagar.');return}
  paymentFlow?.dispose();state.busy=true;state.step='payment';
  paymentFlow=createPaymentFlow(updatePayment);
  paymentFlow.start();
}
function updatePayment(update){
  paymentResult=update;
  if(update.status==='paid'){
    state.busy=false;
    startSending(update.transaction);
    return;
  }
  if(update.status==='rejected'||update.status==='error')state.busy=false;
  renderPayment();renderPreview();
}
function renderPayment(){
  const p=paymentResult||{status:'creating'};
  if(p.status==='creating'){
    formRegion.innerHTML=header('Preparando tu cobro','Pago de $0.01 MXN',3)+'<div class="payment-spinner"></div><p>Generando tu QR...</p>';return;
  }
  if(p.status==='qr'){
    formRegion.innerHTML=header('Escanea y paga $0.01 MXN','Abre tu app bancaria y autoriza el cobro.',3)+'<div class="payment-center"><img class="payment-qr" id="payment-qr" alt="QR CoDi de cobro por un centavo"><p>Después de pagar, pulsa el botón para validar. Tendremos hasta 2 minutos para recibir la confirmación.</p><button class="button button-primary" id="validate-payment">Ya pagué, validar cobro</button></div>';
    document.getElementById('payment-qr').src=p.qr.qrImage;
    document.getElementById('validate-payment').innerHTML=actionContent('Ya pagué, validar cobro','check','Confirmaremos tu pago con Pey');
    document.getElementById('validate-payment').addEventListener('click',()=>paymentFlow.validate());return;
  }
  if(p.status==='waiting'){
    formRegion.innerHTML=header('Validando tu pago','Esperando la confirmación de Pey.',3)+'<div class="payment-center"><div class="payment-spinner"></div><h2>Confirmando $0.01 MXN</h2><p>Tiempo máximo: 2 minutos. Tu mascota aparecerá solo si el pago es aprobado.</p><p>'+escapeText(p.message||'Consultando el estado del pago...')+'</p></div>';return;
  }
  formRegion.innerHTML=header(p.status==='rejected'?'Cobro rechazado':'No se pudo preparar el cobro','La mascota no se envió a la pantalla compartida.',3)+'<p class="success-text">'+escapeText(p.message||'No fue posible completar el cobro.')+'</p><button class="button button-outline" id="payment-back">Volver a mi mascota</button>';
  document.getElementById('payment-back').addEventListener('click',()=>{paymentFlow?.dispose();state.step='review1';render()});
}
function renderSent(){
  const avatar=readRoster().find(a=>a.id===state.lastSentId);
  formRegion.innerHTML=`${header('¡Su viaje ha comenzado!','Tu mascota ya está lista para la pantalla 2.',3)}
    <div class="success-mark">✓</div><h2 class="confirm-heading">¡${escapeText(state.name.trim()||'Tu mascota')} despegó!</h2>
    <p class="success-text">${isDisplayOnline()?'La sumamos a la constelación de la pantalla 2.':'La mascota quedó guardada. Abre la pantalla 2 para verla flotar.'} Puedes crear otra mientras todas flotan juntas.</p>
    <div class="saved-pet" id="send-detail">${state.lastReceivedId===state.lastSentId && state.lastSentId?'✓ Recibida en la pantalla 2':isDisplayOnline()?'Esperando confirmación de recepción…':'Pantalla 2 desconectada; la mascota aparecerá cuando la abras.'}</div>
    <div class="form-actions"><button type="button" id="new-pet" class="button button-primary button-wide">${actionContent('Crear otra mascota','plus','Dale un nuevo compañero a tu constelación')}</button></div><p class="field-note">Todas las mascotas siguen flotando, hasta un máximo de 42.</p>`;
  document.getElementById('new-pet').addEventListener('click',()=>{
    state.species=null;state.breed=null;state.collar=COLORS[0].value;state.name='';state.step='create';state.lastSentId=null;state.lastReceivedId=null;render();scrollTo({top:0,behavior:'smooth'});
  });
  if(!avatar)notify('No se pudo guardar la mascota. Revisa los permisos del navegador.');
}
function render(){
  if(state.step==='create')renderCreate();
  else if(state.step==='sent')renderSent();
  else if(state.step==='payment')renderPayment();
  else renderReview();
  renderPreview();refreshRoster();
}
function startSending(transaction){
  if(!transaction||transaction.status!=='PAID'||Number(transaction.amount)!==0.01||!state.species||!state.breed)return;
  const avatar={id:'pey-'+transaction.id,species:state.species,breed:state.breed,collar:state.collar,name:state.name.trim(),createdAt:Date.now()};
  try{
    const existing=readRoster().find(p=>p.id===avatar.id);
    const saved=existing||addAvatar(avatar);
    state.lastSentId=saved.id;
    bus.publish({type:'sync',addedId:saved.id});
    state.step='sent';state.busy=false;render();
  }catch(error){
    formRegion.innerHTML=header('Pago aprobado','Tu cobro fue confirmado por Pey.',3)+'<p>La mascota todavía no pudo guardarse. Si la constelación está llena, retira una mascota. No necesitas pagar de nuevo.</p><button class="button button-primary" id="retry-delivery">Enviar mi mascota sin volver a pagar</button>';
    document.getElementById('retry-delivery').addEventListener('click',()=>startSending(transaction));
  }
}
function openDisplay(){const url=new URL('display.html',window.location.href);const opened=window.open(url.href,'orbita-pets-display','width=1280,height=800,resizable=yes,scrollbars=yes');if(!opened){notify('Tu navegador bloqueó la ventana. Abre display.html manualmente.')}else{opened.focus();notify('Mueve la ventana nueva al monitor 2 y activa pantalla completa.')}}
document.getElementById('open-display').addEventListener('click',openDisplay);
document.getElementById('replay').addEventListener('click',()=>{
  const avatar=latestAvatar();if(!avatar)return;
  bus.publish({type:'replay',id:avatar.id});
  notify(isDisplayOnline()?'Repitiendo la llegada de la última mascota':'Abre la pantalla 2 para verla');
});
document.getElementById('pause').addEventListener('click',()=>{
  try{const next=!isPaused();setPaused(next);bus.publish({type:'pause'});updateOperator();notify(next?'Movimiento en pausa':'Las mascotas volvieron a flotar')}
  catch(error){notify('No se pudo cambiar el estado de la animación')}
});
document.getElementById('clear-display').addEventListener('click',()=>{
  const count=readRoster().length;if(!count)return;
  if(!confirm(`¿Eliminar las ${count} mascotas de la constelación? Esta acción no se puede deshacer.`))return;
  try{clearRoster();bus.publish({type:'sync'});refreshRoster();notify('La constelación quedó vacía')}
  catch(error){notify('No se pudo vaciar la constelación')}
});
function renderRoster(){
  const roster=readRoster();
  document.getElementById('roster-count').textContent=`${roster.length} / ${MAX_PETS}`;
  const list=document.getElementById('roster-list');
  if(!roster.length){
    list.innerHTML='<div class="roster-empty"><span>✦</span><strong>Todavía no hay mascotas en órbita</strong><p>La primera que crees aparecerá aquí y en la pantalla 2.</p></div>';
    return;
  }
  list.innerHTML=roster.map((pet,i)=>{
    const breed=getBreed(pet.species,pet.breed);
    return `<article class="roster-item" data-id="${escapeText(pet.id)}">
      <span class="roster-avatar">${petSVG(pet.species,pet.breed,pet.collar,pet.name)}</span>
      <div class="roster-item-copy"><strong>${escapeText(pet.name||'Mascota '+(i+1))}</strong><small>${labelFor(pet)} · ${escapeText(breed.name)}</small></div>
      <span class="roster-color" style="background:${pet.collar}" title="Collar"></span>
      <button type="button" class="roster-remove" data-remove="${escapeText(pet.id)}" title="Retirar mascota" aria-label="Retirar ${escapeText(pet.name||'mascota '+(i+1))}">✕</button>
    </article>`;
  }).join('');
  list.querySelectorAll('[data-remove]').forEach(button=>button.addEventListener('click',()=>{
    const id=button.dataset.remove;
    const pet=readRoster().find(p=>p.id===id);if(!pet)return;
    if(!confirm(`¿Retirar a ${pet.name||'esta mascota'} de la constelación?`))return;
    try{removeAvatar(id);bus.publish({type:'sync'});refreshRoster();notify('Mascota retirada de la pantalla 2')}
    catch(error){notify('No fue posible retirar la mascota')}
  }));
}
function refreshRoster(){renderRoster();updateOperator()}
setInterval(updateStatus,1350);
window.addEventListener('storage',event=>{
  if(event.key===BEAT_KEY)updateStatus();
  if(event.key===DATA_KEY||event.key===PAUSE_KEY)refreshRoster();
});
updateStatus();render();
