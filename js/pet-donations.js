'use strict';
window.PetTricks = (() => {
 const seen=new Set();
 function play(event){
   if(!event?.eventId||seen.has(event.eventId))return;
   const node=[...document.querySelectorAll('.constellation-pet')].find(el=>el.dataset.id===event.petId);
   if(!node||!['paw','spin','stand','yarn'].includes(event.trick))return;
   seen.add(event.eventId);if(seen.size>200)seen.delete(seen.values().next().value);
   node.dataset.trick=event.trick;node.dataset.trickEvent=event.eventId;
   const labels={paw:'levanta la patita',spin:'da una vuelta',stand:'se pone en dos patas',yarn:'juega con estambre'};
   announce('¡Gracias por donar! '+(node.querySelector('.pet-tag strong')?.textContent||'Tu mascota')+' '+labels[event.trick]+'.');
   setTimeout(()=>{if(node.dataset.trickEvent===event.eventId){delete node.dataset.trick;delete node.dataset.trickEvent}},3600);
 }
 return {play};
})();
function setupPetDonations({getRoster,onPaid}){
 const dialog=document.getElementById('donation-dialog'),content=document.getElementById('donation-content');
 const labels={paw:'Levantar la pata',spin:'Girar',stand:'Ponerse en dos patas',yarn:'Jugar con estambre'};
 let flow=null,current=null;
 const key='huellitas_extra_'+(getUser()?.id||'guest')+'_';
 function draft(){try{return JSON.parse(sessionStorage.getItem(key+current?.id))}catch{return null}}
 function save(value){try{sessionStorage.setItem(key+value.petId,JSON.stringify(value))}catch{}}
 function clear(){try{sessionStorage.removeItem(key+current?.id)}catch{}}
 function open(petId){
   current=getRoster().find(pet=>pet.id===petId);if(!current)return;
   dialog.showModal();
   if(!isLoggedIn()){content.innerHTML='<p>Inicia sesión en el creador para donar a esta mascota.</p>';return}
   const pending=draft();
   if(pending?.petId===petId&&pending.qr){begin(pending.amount,pending.trick,pending.qr);return}
   const tricks=current.species==='perro'?['paw','spin']:['stand','yarn'];
   content.innerHTML='<p id="donation-pet"></p><form id="extra-form"><label>Monto en MXN<input id="extra-amount" type="number" min="0.01" max="1000" step="0.01" value="10" required></label><label>Su truco<select id="extra-trick">'+tricks.map(id=>'<option value="'+id+'">'+labels[id]+'</option>').join('')+'</select></label><p>El truco se activa cuando Pey confirme el pago. Cada cobro se suma una sola vez.</p><button class="button button-primary" type="submit">Generar QR de donación</button></form>';
   content.querySelector('#donation-pet').textContent='Para '+(current.name||'tu mascota');
   content.querySelector('#extra-form').addEventListener('submit',event=>{event.preventDefault();const amount=Number(content.querySelector('#extra-amount').value),trick=content.querySelector('#extra-trick').value;begin(amount,trick)});
 }
 function begin(amount,trick,qr){
   flow?.dispose();
   const petId=current.id;
   flow=createPaymentFlow(update=>{
     content.replaceChildren();
     const status=document.createElement('p');status.setAttribute('role','status');content.append(status);
     if(update.status==='creating'){status.textContent='Preparando donación de '+amount.toFixed(2)+' MXN…';return}
     if(update.status==='qr'){
       save({petId,amount,trick,qr:update.qr});
       status.textContent='Escanea y paga '+amount.toFixed(2)+' MXN con tu app bancaria.';
       const image=document.createElement('img');image.src=update.qr.qrImage;image.alt='QR CoDi de donación';image.className='payment-qr';content.append(image);
       const validate=document.createElement('button');validate.type='button';validate.className='button button-primary';validate.textContent='Ya doné, validar pago';validate.onclick=()=>flow.validate();content.append(validate);return;
     }
     if(update.status==='waiting'){status.textContent='Esperando confirmación de Pey… '+(update.message||'');return}
     if(update.status==='paid'){
       clear();status.textContent='¡Gracias! Donación confirmada: '+amount.toFixed(2)+' MXN.';
       void onPaid();
       if(update.transaction.donationEvent)PetTricks.play(update.transaction.donationEvent);
       return;
     }
     status.textContent=update.message||'No se pudo completar la donación.';
     const retry=document.createElement('button');retry.className='button button-outline';retry.textContent='Volver a consultar este cobro';retry.onclick=()=>{const pending=draft();if(pending?.petId===petId)begin(pending.amount,pending.trick,pending.qr);else{dialog.close();open(petId)}};content.append(retry);
   },{amount,createBody:{purpose:'extra',petId,trick,amount},qr});
   void flow.start();
 }
 document.getElementById('constellation').addEventListener('click',event=>{const action=event.target.closest('[data-donate]');if(action){event.stopPropagation();open(action.dataset.donate)}});
 document.getElementById('close-donation').addEventListener('click',()=>dialog.close());
 dialog.addEventListener('close',()=>{flow?.dispose();flow=null});
 return {open};
}
