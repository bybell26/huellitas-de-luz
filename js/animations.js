'use strict';
// 7 columnas x 6 filas; elegimos primero las posiciones más alejadas entre sí.
// El número de ranura de cada mascota se almacena: al añadir otra, las anteriores NO saltan de sitio.
function buildSlots(){
  const candidates=[];
  for(let row=0;row<6;row++)for(let col=0;col<7;col++){
    candidates.push({x:13+col*12.34,y:24+row*11.3});
  }
  const selected=[],remaining=[...candidates];
  const start=remaining.findIndex(p=>Math.abs(p.x-50)<1&&Math.abs(p.y-46.6)<2);
  selected.push(remaining.splice(start>=0?start:17,1)[0]);
  while(remaining.length){
    let best=0,bestScore=-1;
    for(let i=0;i<remaining.length;i++){
      const p=remaining[i];
      const nearest=Math.min(...selected.map(s=>Math.pow((p.x-s.x)*1.35,2)+Math.pow(p.y-s.y,2)));
      if(nearest>bestScore){bestScore=nearest;best=i}
    }
    selected.push(remaining.splice(best,1)[0]);
  }
  return selected;
}
function hashId(id){let h=2166136261;for(const ch of id){h=Math.imul(h^ch.charCodeAt(0),16777619)}return h>>>0}
function petSize(count){
  const w=window.innerWidth,h=window.innerHeight;
  const density=count<=1?0.28:count<=3?0.19:count<=6?0.145:count<=12?0.108:count<=20?0.080:count<=30?0.060:0.048;
  const byHeight=count<=3?h*.33:count<=12?h*.25:count<=20?h*.115:count<=30?h*.087:h*.085;
  return Math.max(42,Math.min(w*density,byHeight,count<=1?295:245));
}
function createPetNode(pet,index){
  const article=document.createElement('article');
  article.className='constellation-pet';
  article.dataset.id=pet.id;
  const breed=getBreed(pet.species,pet.breed);
  article.setAttribute('aria-label',`${pet.name||'Mascota '+(index+1)}, ${labelFor(pet)} raza ${breed.name}`);
  const seed=hashId(pet.id);
  const dx=(seed%29)-14,dy=(Math.floor(seed/31)%25)-12;
  article.style.setProperty('--dx',`${dx}px`);
  article.style.setProperty('--dy',`${dy}px`);
  article.style.setProperty('--dx-start',`${Math.round(dx*-.4)}px`);
  article.style.setProperty('--dy-start',`${Math.round(dy*-.9)}px`);
  article.style.setProperty('--rotate',`${(seed%7)-3}deg`);
  article.style.setProperty('--period',`${4.6+(seed%37)/10}s`);
  article.style.setProperty('--delay',`${-((seed%30)/10)}s`);
  article.innerHTML=`<div class="pet-entry"><div class="pet-floater">
    <div class="pet-illustration">${petSVG(pet.species,pet.breed,pet.collar,pet.name)}</div>
    <div class="pet-tag"><strong>${escapeText(pet.name||'Mascota '+(index+1))}</strong><small>${escapeText(breed.name)}</small></div>
  </div></div>`;
  return article;
}
