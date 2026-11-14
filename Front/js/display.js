'use strict';
// Huellitas de Luz — Un escenario compartido, con posiciones estables por mascota.
const constellation=document.getElementById('constellation');
const waiting=document.getElementById('arrival-content');
const announcement=document.getElementById('arrival-message');
const displayStatus=document.getElementById('display-connected');
const displayCounter=document.getElementById('display-counter');
const pauseButton=document.getElementById('display-pause');
const labelsButton=document.getElementById('toggle-names');
let announcementTimer;

const slots=buildSlots();
function renderConstellation(newId=null){
  const roster=readRoster();
  const ids=new Set(roster.map(p=>p.id));
  for(const element of constellation.querySelectorAll('.constellation-pet')){
    if(!ids.has(element.dataset.id))element.remove();
  }
  constellation.style.setProperty('--pet-size',`${petSize(roster.length)}px`);
  constellation.classList.toggle('compact',roster.length>19);
  waiting.classList.toggle('is-hidden',roster.length>0);
  displayCounter.textContent=`${roster.length} ${roster.length===1?'mascota':'mascotas'}`;
  roster.forEach((pet,index)=>{
    let node=[...constellation.children].find(el=>el.dataset.id===pet.id);
    if(!node){
      node=createPetNode(pet,index);
      const position=slots[pet.slot]||slots[index];
      node.style.left=`${position.x}%`;
      node.style.top=`${position.y}%`;
      constellation.appendChild(node);
      if(pet.id===newId){
        node.querySelector('.pet-entry').classList.add('new');
        announce(`✦ ¡${pet.name||'Una nueva mascota'} llegó a la constelación! ✦`);
      }
    }
  });
  return roster;
}
function announce(message){
  announcement.textContent=message;
  announcement.classList.add('visible');
  clearTimeout(announcementTimer);
  announcementTimer=setTimeout(()=>announcement.classList.remove('visible'),3000);
}
function replay(id){
  const roster=readRoster(),pet=roster.find(p=>p.id===id)||roster.at(-1);
  if(!pet)return;
  renderConstellation();
  const node=[...constellation.children].find(el=>el.dataset.id===pet.id);
  if(!node)return;
  const entry=node.querySelector('.pet-entry');
  entry.classList.remove('new');
  void entry.offsetWidth; // reinicia la animación de entrada de esta mascota exclusivamente
  entry.classList.add('new');
  announce(`✦ ¡${pet.name||'Una mascota'} volvió a despegar! ✦`);
}
function updateAnimationSettings(){
  constellation.classList.toggle('is-paused',isPaused());
  constellation.classList.toggle('hide-labels',!labelsVisible());
  pauseButton.textContent=isPaused()?'▶ Reanudar':'Ⅱ Pausar';
  labelsButton.textContent=labelsVisible()?'Ocultar nombres':'Mostrar nombres';
}
const bus=createBus(message=>{
  if(message?.type==='sync'){
    const roster=renderConstellation(message.addedId||null);
    if(message.addedId&&roster.some(p=>p.id===message.addedId))bus.publish({type:'received',id:message.addedId});
  } else if(message?.type==='replay')replay(message.id);
  else if(message?.type==='pause'||message?.type==='labels')updateAnimationSettings();
});
function heartbeat(){
  try{localStorage.setItem(BEAT_KEY,String(Date.now()));displayStatus.textContent='● Exhibición conectada'}
  catch(error){displayStatus.textContent='● Sin almacenamiento local'}
}
function toggleFullscreen(){
  if(!document.fullscreenElement){document.body.requestFullscreen?.().catch(()=>{displayStatus.textContent='Usa F11 para pantalla completa'})}
  else document.exitFullscreen?.();
}
document.getElementById('go-fullscreen').addEventListener('click',toggleFullscreen);
document.addEventListener('fullscreenchange',()=>{document.getElementById('go-fullscreen').textContent=document.fullscreenElement?'Salir de pantalla completa':'⛶ Pantalla completa'});
pauseButton.addEventListener('click',()=>{
  try{setPaused(!isPaused());updateAnimationSettings();bus.publish({type:'pause'})}catch(error){announce('No se pudo cambiar el movimiento')}
});
labelsButton.addEventListener('click',()=>{
  try{setLabelsVisible(!labelsVisible());updateAnimationSettings();bus.publish({type:'labels'})}catch(error){announce('No se pudieron cambiar las etiquetas')}
});
window.addEventListener('storage',event=>{
  if(event.key===DATA_KEY)renderConstellation();
  if(event.key===PAUSE_KEY||event.key===LABELS_KEY)updateAnimationSettings();
});
window.addEventListener('resize',()=>constellation.style.setProperty('--pet-size',`${petSize(readRoster().length)}px`));
const startup=renderConstellation();
updateAnimationSettings();heartbeat();
bus.publish({type:'ready',ids:startup.map(p=>p.id)});
setInterval(heartbeat,1800);
