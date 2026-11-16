'use strict';
(function(global){
 const names={constellation:'Constelación',garden:'Jardín',park:'Parque'};
 function svg(scene,width=1920,height=1080){
   scene=names[scene]?scene:'constellation';
   const space=scene==='constellation';
   const sky=space?['#111634','#292459']:scene==='garden'?['#ceeadd','#f1f2c9']:['#bcdfea','#eaf3d4'];
   let decor='';
   if(space){
     for(let i=0;i<85;i++){const x=(i*137+59)%1920,y=(i*199+71)%1080;decor+='<circle cx="'+x+'" cy="'+y+'" r="'+(i%3+1)+'" fill="#e1deff" opacity="'+(.25+i%6/10)+'"/>'}
     decor+='<ellipse cx="960" cy="550" rx="610" ry="180" fill="none" stroke="#9b92ef" opacity=".18"/><ellipse cx="960" cy="550" rx="400" ry="120" fill="none" stroke="#9b92ef" opacity=".2"/>';
   }else{
     decor='<circle cx="1560" cy="175" r="80" fill="#fff0b5"/><path d="M0 570Q400 350 900 600T1920 520V1080H0Z" fill="#8ebd81"/><path d="M0 760Q600 540 1200 780T1920 700V1080H0Z" fill="#72a56e"/>';
     for(const x of [140,430,1510,1780])decor+='<path d="M'+x+' 700V340" stroke="#88654a" stroke-width="28"/><circle cx="'+x+'" cy="310" r="130" fill="'+(scene==='garden'?'#72a879':'#54876b')+'"/><circle cx="'+(x-65)+'" cy="360" r="95" fill="#61976c"/>';
     if(scene==='park')decor+='<path d="M1030 600Q600 760 1080 1080H1430Q780 760 1120 600" fill="#d9c6a1"/><path d="M240 735H570M260 775H550M280 720V820M530 720V820" stroke="#8d6650" stroke-width="20" stroke-linecap="round"/>';
     else for(let i=0;i<32;i++){const x=(i*173)%1920,y=830+(i*79)%230;decor+='<path d="M'+x+' '+y+'v-23" stroke="#426f47" stroke-width="4"/><circle cx="'+x+'" cy="'+(y-25)+'" r="9" fill="'+(['#f2d58a','#f1c9b8','#eee5bf'][i%3])+'"/>'}
   }
   return '<svg xmlns="http://www.w3.org/2000/svg" width="'+width+'" height="'+height+'" viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="sky" x2="0" y2="1"><stop stop-color="'+sky[0]+'"/><stop offset="1" stop-color="'+sky[1]+'"/></linearGradient></defs><path d="M0 0H1920V1080H0Z" fill="url(#sky)"/>'+decor+'</svg>';
 }
 function loadImage(markup){return new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(Error('No se pudo dibujar la imagen.'));image.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(markup)})}
 async function renderWallpaper(canvas,{scene,pets,format,title,names:showNames}){
   const phone=format==='phone',width=phone?1080:1920,height=phone?1920:1080;
   canvas.width=width;canvas.height=height;
   const ctx=canvas.getContext('2d');
   ctx.drawImage(await loadImage(svg(scene,width,height)),0,0,width,height);
   ctx.fillStyle=scene==='constellation'?'#f2edff':'#254537';
   ctx.textAlign='center';ctx.font='600 '+(phone?48:52)+'px sans-serif';
   ctx.fillText(String(title||'Mis compañeros de luz').slice(0,60),width/2,phone?150:110,width-100);
   const columns=Math.min(pets.length,Math.max(1,Math.ceil(Math.sqrt(pets.length*width/(height*.8)))));
   const rows=Math.ceil(pets.length/columns),top=phone?240:180,padding=phone?60:90;
   const cellW=(width-padding*2)/columns,cellH=(height-top-90)/rows;
   const size=Math.min(cellW*.82,(cellH-(showNames?48:0))*.91,phone?720:650);
   for(let i=0;i<pets.length;i++){
     const pet=pets[i],row=Math.floor(i/columns),col=i%columns;
     const countInRow=Math.min(columns,pets.length-row*columns);
     const x=width/2+(col-(countInRow-1)/2)*cellW;
     const y=top+row*cellH+(cellH-size-(showNames?48:0))/2;
     const markup=HuellitasMotion.render(pet.species,pet.breed,pet.collar,pet.name,pet.appearance);
     ctx.drawImage(await loadImage(markup),x-size/2,y,size,size*340/320);
     if(showNames){ctx.font='600 '+Math.min(34,cellW/9)+'px sans-serif';ctx.fillText(pet.name||'Sin nombre',x,y+size*340/320+30,cellW-12)}
   }
   return canvas;
 }
 function setup({getRoster,getRoom}){
   const selector=document.getElementById('scene-select');
   const dialog=document.getElementById('wallpaper-dialog');
   const choices=document.getElementById('wallpaper-pets');
   const form=document.getElementById('wallpaper-form'),preview=document.getElementById('wallpaper-preview');
   const download=document.getElementById('wallpaper-download'),status=document.getElementById('wallpaper-status');
   let revision=0;
   const key='huellitas_scene_'+getRoom();
   let scene='constellation';try{scene=localStorage.getItem(key)||scene}catch{}
   function apply(value){scene=names[value]?value:'constellation';selector.value=scene;document.body.dataset.scene=scene;document.getElementById('stage').style.backgroundImage='url("data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg(scene))+'")';try{localStorage.setItem(key,scene)}catch{}}
   selector.addEventListener('change',()=>{apply(selector.value);if(dialog.open)void update()});
   apply(scene);
   async function update(){
     const current=++revision;
     const selected=new Set([...choices.querySelectorAll('input:checked')].map(input=>input.value));
     const pets=getRoster().filter(pet=>selected.has(pet.id));
     download.disabled=true;
     if(!pets.length){status.textContent='Selecciona al menos una mascota.';return}
     status.textContent='Preparando vista previa…';
     try{
       const draft=document.createElement('canvas');
       await renderWallpaper(draft,{scene,pets,format:form.elements.format.value,title:form.elements.title.value,names:form.elements.showNames.checked});
       if(current!==revision||!dialog.open)return;
       preview.width=draft.width;preview.height=draft.height;preview.getContext('2d').drawImage(draft,0,0);
       status.textContent=preview.width+' × '+preview.height+' px · '+pets.length+' mascota'+(pets.length===1?'':'s');
       download.disabled=false;
     }catch(err){if(current===revision)status.textContent=err.message}
   }
   function open(petId){
     choices.replaceChildren();
     const pets=getRoster();
     if(!pets.length){announce('Primero agrega una mascota para crear tu fondo.');return}
     for(const pet of pets){
       const label=document.createElement('label'),check=document.createElement('input'),text=document.createElement('span');
       check.type='checkbox';check.value=pet.id;check.checked=petId?pet.id===petId:true;
       text.textContent=(pet.name||'Sin nombre')+' · '+getBreed(pet.species,pet.breed).name;
       label.append(check,text);choices.append(label);
     }
     form.elements.format.value=innerHeight>innerWidth?'phone':'desktop';
     dialog.showModal();void update();
   }
   document.getElementById('open-wallpaper').addEventListener('click',()=>open());
   document.getElementById('constellation').addEventListener('click',event=>{const button=event.target.closest('[data-wallpaper]');if(button)open(button.dataset.wallpaper)});
   document.getElementById('close-wallpaper').addEventListener('click',()=>dialog.close());
   dialog.addEventListener('close',()=>{revision++});
   form.addEventListener('submit',event=>event.preventDefault());
   form.addEventListener('change',()=>void update());
   form.elements.title.addEventListener('input',()=>void update());
   document.getElementById('wallpaper-all').addEventListener('click',()=>{choices.querySelectorAll('input').forEach(c=>c.checked=true);void update()});
   document.getElementById('wallpaper-none').addEventListener('click',()=>{choices.querySelectorAll('input').forEach(c=>c.checked=false);void update()});
   download.addEventListener('click',()=>preview.toBlob(blob=>{
     if(!blob){status.textContent='No se pudo descargar la imagen.';return}
     const url=URL.createObjectURL(blob),link=document.createElement('a');
     link.download='huellitas-'+scene+'-'+form.elements.format.value+'.png';link.href=url;link.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
   },'image/png'));
   return {open,scene:()=>scene};
 }
 global.HuellitasScenes={svg,renderWallpaper,setup};
})(window);
