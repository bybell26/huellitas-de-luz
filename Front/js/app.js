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
function header(title,subtitle,stepCount=1){return `<div class="head-row"><div><h2>${title}</h2><p>${subtitle}</p></div><div class="step-dots"><i class="active"></i><i class="${stepCount>=2?'active':''}"></i><i class="${stepCount>=3?'active':''}"></i></div></div>`}
function renderCreate(){
  const full=readRoster().length>=MAX_PETS;
  const complete=!!state.species&&!!state.breed&&!full;
  formRegion.innerHTML=`${header('Diseña tu compañero','Son solo tres decisiones. ¡Hazlo a tu manera!',1)}
    <div class="form-group"><span class="field-title"><span class="field-index">01</span> Elige tu mascota</span><div class="species-grid">
      ${[['perro','🐶','Perro','Amigo fiel'],['gato','🐱','Gato','Espíritu libre']].map(([id,emoji,label,sub])=>`<button class="species-choice" type="button" data-species="${id}" aria-pressed="${state.species===id}"><span class="emoji">${emoji}</span><span><strong>${label}</strong><small>${sub}</small></span></button>`).join('')}
    </div></div>
    <div class="form-group"><span class="field-title"><span class="field-index">02</span> Selecciona su raza</span>
      ${state.species?`<div class="breed-grid">${BREEDS[state.species].map(b=>`<button type="button" class="breed-choice" data-breed="${b.id}" aria-pressed="${state.breed===b.id}" title="${b.name}"><span class="pet-thumbnail">${petSVG(state.species,b.id,state.collar)}</span><strong>${b.name}</strong></button>`).join('')}</div><p class="hint">Cinco razas disponibles por animal.</p>`:'<div class="empty-choice">Primero selecciona perro o gato para descubrir las cinco razas.</div>'}
    </div>
    <div class="form-group"><span class="field-title"><span class="field-index">03</span> Dale su toque personal</span><div class="collar-name-grid"><div><span class="mini-label">Color de collar</span><div class="color-options">${COLORS.map(c=>`<button class="color-choice" type="button" data-collar="${c.value}" aria-label="Collar ${c.label}" aria-pressed="${state.collar===c.value}" title="${c.label}"><span style="background:${c.value}"></span></button>`).join('')}</div></div>
      <div><label for="pet-name" class="mini-label">Nombre (opcional)</label><input id="pet-name" class="name-field" maxlength="16" autocomplete="off" placeholder="Ej. Luna" value="${escapeText(state.name)}" /></div></div></div>
    <button id="continue" class="button button-primary button-wide" type="button" ${complete?'':'disabled'}>${full?'Constelación completa · 42 mascotas':'Revisar mi mascota →'}</button><p class="field-note">${full?'Retira una mascota desde el centro de control para crear otra.':'Solo tendrás que confirmarla dos veces antes de enviarla a la pantalla 2.'}</p>`;
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
  const first=state.step==='review1';
  formRegion.innerHTML=`${header('¿Así te gusta?','Revísala antes de dejarla volar.',first?2:3)}
    <span class="pill">CONFIRMACIÓN ${first?'1':'2'} DE 2</span>
    <h2 class="confirm-heading">${first?'¿Está todo correcto?':'¿La enviamos a volar?'}</h2>
    <p class="confirm-text">${first?'Revisa la raza, el collar y el nombre de tu mascota.':'Esta confirmación enviará a tu mascota al otro monitor. La pantalla de creación permanecerá abierta.'}</p>
    ${reviewMarkup()}
    <div class="review-note"><span class="review-note-icon">${first?'1':'2'}</span><div><strong>${first?'Primera confirmación':'Segunda confirmación'}</strong><p>${first?'Aprueba cómo quedó tu creación.':'Autoriza la aparición en la pantalla de exhibición.'}</p></div></div>
    <div class="form-actions"><button type="button" class="button button-outline" id="edit">← ${first?'Editar':'Volver'}</button><button type="button" class="button button-primary" id="confirm">${first?'✓ Confirmar diseño (1/2)':'✦ Confirmar y enviar (2/2)'}</button></div>`;
  document.getElementById('edit').addEventListener('click',()=>{state.step=first?'create':'review1';render()});
  document.getElementById('confirm').addEventListener('click',()=>{
    if(first){state.step='review2';render()}
    else startSending();
  });
}
function renderSent(){
  const avatar=readRoster().find(a=>a.id===state.lastSentId);
  formRegion.innerHTML=`${header('¡Su viaje ha comenzado!','Tu mascota ya está lista para la pantalla 2.',3)}
    <div class="success-mark">✓</div><h2 class="confirm-heading">¡${escapeText(state.name.trim()||'Tu mascota')} despegó!</h2>
    <p class="success-text">${isDisplayOnline()?'La sumamos a la constelación de la pantalla 2.':'La mascota quedó guardada. Abre la pantalla 2 para verla flotar.'} Puedes crear otra mientras todas flotan juntas.</p>
    <div class="saved-pet" id="send-detail">${state.lastReceivedId===state.lastSentId && state.lastSentId?'✓ Recibida en la pantalla 2':isDisplayOnline()?'Esperando confirmación de recepción…':'Pantalla 2 desconectada; la mascota aparecerá cuando la abras.'}</div>
    <div class="form-actions"><button type="button" id="go-support" class="button button-primary button-wide">♥ Donar ${moneyLabel()} y descargar a ${escapeText(state.name.trim()||"tu mascota")}</button></div>
    <div class="form-actions"><button type="button" id="new-pet" class="button button-outline button-wide">+ Crear otra mascota</button></div><p class="field-note">Todas las mascotas siguen flotando, hasta un máximo de 42.</p>`;
  document.getElementById('go-support').addEventListener('click',openSupport);
  document.getElementById('new-pet').addEventListener('click',()=>{
    resetDonation();
    state.species=null;state.breed=null;state.collar=COLORS[0].value;state.name='';state.step='create';state.lastSentId=null;state.lastReceivedId=null;render();scrollTo({top:0,behavior:'smooth'});
  });
  if(!avatar)notify('No se pudo guardar la mascota. Revisa los permisos del navegador.');
}
function render(){
  if(state.step==='create')renderCreate();
  else if(state.step==='sent')renderSent();
  else if(state.step==='support')renderSupport();
  else renderReview();
  renderPreview();refreshRoster();
}
function startSending(){
  if(state.busy||!state.species||!state.breed)return;
  if(readRoster().length>=MAX_PETS){notify('La constelación está llena (42 mascotas). Retira alguna para continuar.');return}
  state.busy=true;
  const loading=document.getElementById('loading');const bar=document.getElementById('progress');const progressText=document.getElementById('progress-text');
  loading.classList.add('active');loading.setAttribute('aria-hidden','false');bar.style.width='0%';progressText.textContent='0%';
  let val=0;
  const timer=setInterval(()=>{
    val=Math.min(100,val+10);bar.style.width=val+'%';progressText.textContent=val+'%';
    if(val===100){
      clearInterval(timer);
      const avatar={id:Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,9),species:state.species,breed:state.breed,collar:state.collar,name:state.name.trim(),createdAt:Date.now()};
      try{
        const saved=addAvatar(avatar);
        state.lastSentId=saved.id;
        bus.publish({type:'sync',addedId:saved.id});
        state.step='sent';
      }catch(error){
        state.step='review2';notify(error?.message==='full'?'La constelación está llena. Retira una mascota.':'No fue posible guardar el avatar. Verifica el almacenamiento local.');
      }
      state.busy=false;loading.classList.remove('active');loading.setAttribute('aria-hidden','true');render();
    }
  },105);
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
    list.innerHTML='<div class="roster-empty"><span>✦</span><strong>Todavía no hay mascotas en la constelación</strong><p>La primera que crees aparecerá aquí y en la pantalla 2.</p></div>';
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
