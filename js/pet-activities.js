'use strict';
// Interacciones locales: el saldo se confirma en el servidor al terminar la sesión.
window.createPetActivities = ({ stage, avatar, panel, status, onComplete, onStop, renderPet }) => {
  let session = null;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const dirtPositions = [[29,27],[57,30],[43,44],[65,48],[33,62],[56,68],[38,83],[63,83]];

  function stop(completed = false) {
    if (!session) return;
    const finishedAction = session.action;
    session.controller.abort();
    for (const animation of session.animations) animation.cancel();
    session = null;
    panel.replaceChildren();
    panel.hidden = true;
    stage.removeAttribute('data-game');
    stage.removeAttribute('data-bath-phase');
    stage.removeAttribute('data-water');
    stage.querySelectorAll('.game-prop,.dirt-layer').forEach(node => {
      if (completed === true && finishedAction === 'feed' && (node.classList.contains('food-bowl') || node.classList.contains('water-bowl'))) return;
      node.remove();
    });
    avatar.style.removeProperty('transform');
    avatar.removeAttribute('data-gait');
    avatar.removeAttribute('data-activity');
    renderPet();
    onStop(completed === true);
  }
  function listen(node, type, handler) { node.addEventListener(type, handler, { signal: session.controller.signal }); }
  function button(label, handler, className = '') {
    const node = document.createElement('button');
    node.type = 'button'; node.className = `button button-ghost ${className}`; node.textContent = label;
    listen(node, 'click', handler); panel.append(node); return node;
  }
  function progress(text, value, total) {
    const label = panel.querySelector('.game-progress');
    label.textContent = `${text} · ${value} / ${total}`;
    const bar = panel.querySelector('progress'); bar.max = total; bar.value = value;
  }
  async function animate(node, frames, duration, easing = 'ease-in-out') {
    const current = session;
    if (!current || reduced.matches) return;
    const animation = node.animate(frames, { duration, easing, fill: 'forwards' });
    current.animations.add(animation);
    try { await animation.finished; } catch {} finally {
      if (session === current) { try { animation.commitStyles(); } catch {} }
      current.animations.delete(animation); animation.cancel();
    }
  }
  async function finish() {
    if (!session || session.completed) return;
    session.completed = true;
    panel.querySelectorAll('button').forEach(node => { node.disabled = true; });
    const action = session.action;
    stop(true);
    await onComplete(action);
  }
  function prop(className, text) {
    const node = document.createElement('div'); node.className = `game-prop ${className}`;
    node.textContent = text; node.setAttribute('aria-hidden','true'); stage.append(node); return node;
  }

  // El parque usa el mismo SVG personalizado que Hogar y el creador.
  function profilePet(pet) {
    const template = document.createElement('template');
    template.innerHTML = HuellitasMotion.render(pet.species, pet.breed, pet.collar, pet.name, pet.appearance);
    const svg = template.content.querySelector('svg');
    svg.classList.add('profile-pet', 'park-pet');
    const neck = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    neck.classList.add('park-neck');
    const head = svg.querySelector('.hlm-head');
    svg.insertBefore(neck, head);
    neck.append(head, svg.querySelector('.hlm-collar'));
    return svg.outerHTML;
  }

  function bath() {
    const current = session;
    status.textContent = 'Primero moja su pelaje con la regadera. Después aplica jabón, frota y enjuaga.';
    stage.dataset.bathPhase = 'dirty';
    const dirt = document.createElement('div'); dirt.className = 'dirt-layer'; dirt.setAttribute('aria-hidden','true');
    dirtPositions.forEach(([x,y], i) => { const spot=document.createElement('span');spot.className='dirt-spot';spot.style.left=x+'%';spot.style.top=y+'%';spot.dataset.spot=i;dirt.append(spot); });
    avatar.append(dirt);
    const sponge = prop('bath-sponge','');
    const water = prop('shower-water','');
    let cleaned=0, last=null, soapy=false, pouring=false;
    progress('Pasos del baño',0,3);
    async function pour(rinsing) {
      if (pouring || current !== session) return;
      pouring=true; wet.disabled=true; soap.disabled=true; rinse.disabled=true;
      stage.dataset.water='true';
      stage.dataset.bathPhase=rinsing?'rinse':'wet';
      status.textContent=rinsing?'El agua se lleva el jabón y la tierrita…':'Mojando su pelaje con agua tibia…';
      await animate(water,[{opacity:1},{opacity:1}],1500);
      if(current!==session)return;
      stage.dataset.water='false';water.style.opacity='';pouring=false;
      if(rinsing){progress('Pasos del baño',3,3);finish();return;}
      soap.disabled=false;progress('Pasos del baño',1,3);
      status.textContent='¡Pelaje mojado! Aplica el jabón para comenzar a frotar las manchas.';
    }
    const wet = button('Echar agua',()=>pour(false));
    const soap = button('Aplicar jabón',()=>{soapy=true;soap.disabled=true;stage.dataset.bathPhase='soap';progress('Manchas enjabonadas',0,8);status.textContent='Frota las manchas con el mouse o el dedo. También puedes usar el botón Frotar.';scrubButton.disabled=false;});
    const rinse = button('Enjuagar', () => { if(cleaned===8)pour(true); });
    soap.disabled=true;rinse.disabled=true;
    function scrub(spot) {
      if (!soapy || pouring || !spot || spot.classList.contains('is-clean') || current!==session) return;
      spot.classList.add('is-clean'); spot.textContent='🫧'; cleaned++;
      progress('Manchas enjabonadas',cleaned,8);
      if(cleaned===8){rinse.disabled=false;scrubButton.disabled=true;status.textContent='¡Todo enjabonado! Abre la regadera con Enjuagar para quitar la espuma.';}
    }
    const scrubButton=button('Frotar una mancha',()=>scrub(dirt.querySelector('.dirt-spot:not(.is-clean)')),'game-keyboard-action');scrubButton.disabled=true;
    function rub(event) {
      if(last && Math.hypot(event.clientX-last.x,event.clientY-last.y)<6)return;
      last={x:event.clientX,y:event.clientY};
      const box=avatar.getBoundingClientRect();
      sponge.style.left=(event.clientX-stage.getBoundingClientRect().left-15)+'px';
      sponge.style.top=(event.clientY-stage.getBoundingClientRect().top-15)+'px';
      for(const spot of dirt.children){const rect=spot.getBoundingClientRect();if(Math.hypot(event.clientX-(rect.left+rect.width/2),event.clientY-(rect.top+rect.height/2))<Math.max(24,box.width*.13))scrub(spot);}
    }
    listen(avatar,'pointerdown',event=>{if(event.button!==0)return;avatar.setPointerCapture(event.pointerId);last=null;rub(event);});
    listen(avatar,'pointermove',event=>{if(avatar.hasPointerCapture(event.pointerId))rub(event);});
    listen(avatar,'pointerup',event=>{if(avatar.hasPointerCapture(event.pointerId))avatar.releasePointerCapture(event.pointerId);last=null;});
  }

  function feed() {
    status.textContent = 'Arrastra la bolsa de croquetas a la charola. Verás cómo cae la comida. Su agua ya está lista a un lado.';
    progress('Porciones servidas',0,3);
    const bowl=prop('food-bowl',''),food=prop('food-piece','CROQUETAS');
    bowl.innerHTML='<span class="bowl-kibble"></span>';
    prop('water-bowl','');
    let portions=0, serving=false;
    const current=session;
    async function serve(){
      if(serving||session!==current)return;
      serving=true;serveButton.disabled=true;
      avatar.dataset.activity='feed';
      const box=stage.getBoundingClientRect(), target=bowl.getBoundingClientRect(), bag=food.getBoundingClientRect();
      const x=target.left+target.width/2-(bag.left+bag.width/2),y=target.top-bag.bottom-18;
      await animate(food,[{transform:'translate(0,0) rotate(0)'},{transform:`translate(${x}px,${y}px) rotate(45deg)`}],400);
      if(session!==current)return;
      const grains=Array.from({length:14},(_,i)=>{
        const grain=prop('food-grain','');grain.style.left=(target.left-box.left+target.width/2+(i%5-2)*7)+'px';grain.style.top=(target.top-box.top-70)+'px';
        return animate(grain,[{transform:'translateY(0) rotate(0)',opacity:0},{opacity:1,offset:.15},{transform:`translateY(${65+i%3*5}px) rotate(${i*31}deg)`,opacity:1}],550+i*22,'ease-in').then(()=>grain.remove());
      });
      await Promise.all(grains);
      if(session!==current)return;
      food.style.transform='';food.style.opacity='';
      portions++;bowl.style.setProperty('--fullness',String(portions/3));progress('Porciones servidas',portions,3);avatar.removeAttribute('data-activity');
      if(portions===3){finish();return;}
      serving=false;serveButton.disabled=false;
    }
    const serveButton=button('Servir comida',serve);
    listen(food,'pointerdown',event=>{if(serving||event.button!==0)return;food.setPointerCapture(event.pointerId);});
    listen(food,'pointermove',event=>{if(food.hasPointerCapture(event.pointerId)){const box=stage.getBoundingClientRect();food.style.left=(event.clientX-box.left-18)+'px';food.style.top=(event.clientY-box.top-18)+'px';}});
    listen(food,'pointerup',event=>{if(!food.hasPointerCapture(event.pointerId))return;food.releasePointerCapture(event.pointerId);const rect=bowl.getBoundingClientRect();const hit=event.clientX>=rect.left-20&&event.clientX<=rect.right+20&&event.clientY>=rect.top-20&&event.clientY<=rect.bottom+20;food.style.left='';food.style.top='';if(hit)serve();});
  }

  function play(pet) {
    avatar.innerHTML=profilePet(pet);
    status.textContent = 'Arrastra y suelta la pelota para lanzarla, o toca el suelo. Tu mascota correrá a buscarla y volverá caminando.';
    progress('Pelotas recuperadas',0,3);
    const ball=prop('play-ball','🎾');
    const profile=avatar.querySelector('svg');
    const head=profile.querySelector('.hlm-head');
    const neck=profile.querySelector('.park-neck');
    const svgNS='http://www.w3.org/2000/svg';
    const heldBall=document.createElementNS(svgNS,'g');
    heldBall.classList.add('park-carried-ball');
    heldBall.setAttribute('aria-hidden','true');
    // Anclada debajo del hocico: acompaña el movimiento de la cabeza.
    heldBall.setAttribute('transform',`translate(160 ${pet.species==='gato'?197:203})`);
    heldBall.innerHTML='<circle r="16" fill="#b3d65b" stroke="#8baa3c" stroke-width="1.5"/><path d="M-10-12Q4 0-10 12M10-12Q-4 0 10 12" fill="none" stroke="#f5efc2" stroke-width="1.8"/><path d="M-8-13Q0-8 8-13" fill="none" stroke="#665061" stroke-width="2" stroke-linecap="round"/>';
    head.append(heldBall);
    let rounds=0, chasing=false;
    const current=session;
    async function launch(target){
      if(chasing||session!==current)return;
      chasing=true;launchButton.disabled=true;
      const width=stage.clientWidth;
      const actorX=avatar.offsetLeft,actorWidth=avatar.clientWidth;
      const destination=Math.max(actorX+actorWidth*.9,Math.min(width-35,target));
      const travel=Math.max(0,Math.min(width-actorX-actorWidth-10,destination-actorX-actorWidth*.5));
      const floor=parseFloat(getComputedStyle(ball).bottom)||24;
      const startX=24;
      const height=Math.min(stage.clientHeight*.43,145);
      const flight=Array.from({length:21},(_,i)=>{
        const t=i/20;
        return {left:(startX+(destination-startX)*t)+'px',bottom:(floor+height*4*t*(1-t))+'px',transform:`rotate(${720*t}deg)`,offset:t};
      });
      flight.push({left:destination+'px',bottom:floor+'px',transform:'rotate(720deg)',offset:1});
      const runTime=Math.max(1000,Math.min(1800,travel*4));
      avatar.dataset.gait='run';
      await Promise.all([
        (async()=>{await animate(ball,flight,1000,'linear');if(session!==current)return;await animate(ball,[{bottom:floor+'px'},{bottom:(floor+22)+'px',offset:.5},{bottom:floor+'px'}],350);})(),
        animate(avatar,[{transform:'translateX(0)'},{transform:`translateX(${travel*.18}px)`,offset:.25},{transform:`translateX(${travel*.88}px)`,offset:.8},{transform:`translateX(${travel}px)`}],runTime,'linear')
      ]);
      if(session!==current)return;
      avatar.style.transform=`translateX(${travel}px)`;
      avatar.dataset.gait='pickup';
      await animate(neck,[{transform:'translateY(0) rotate(0)'},{transform:'translateY(45px) rotate(6deg)'}],320);
      if(session!==current)return;
      const sceneBox=stage.getBoundingClientRect(), mouthBox=heldBall.querySelector('circle').getBoundingClientRect();
      const mouthX=mouthBox.left+mouthBox.width/2-sceneBox.left;
      const mouthBottom=sceneBox.bottom-(mouthBox.top+mouthBox.height/2);
      await animate(ball,[{left:destination+'px',bottom:floor+'px',opacity:1},{left:(mouthX-ball.offsetWidth/2)+'px',bottom:(mouthBottom-ball.offsetHeight/2)+'px',opacity:.8}],180);
      if(session!==current)return;
      profile.dataset.carrying='true';ball.style.visibility='hidden';
      await animate(neck,[{transform:'translateY(45px) rotate(6deg)'},{transform:'translateY(0) rotate(0)'}],320);
      if(session!==current)return;
      neck.style.removeProperty('transform');
      profile.style.transform='scaleX(-1)';
      avatar.dataset.gait='walk';
      await animate(avatar,[{transform:`translateX(${travel}px)`},{transform:'translateX(0)'}],2000,'linear');
      if(session!==current)return;
      avatar.dataset.gait='drop';
      const returnedBox=heldBall.querySelector('circle').getBoundingClientRect(), returnedScene=stage.getBoundingClientRect();
      const returnedX=returnedBox.left+returnedBox.width/2-returnedScene.left-ball.offsetWidth/2;
      const returnedBottom=returnedScene.bottom-(returnedBox.top+returnedBox.height/2)-ball.offsetHeight/2;
      ball.style.left=returnedX+'px';ball.style.bottom=returnedBottom+'px';ball.style.transform='';ball.style.opacity='1';ball.style.visibility='';
      delete profile.dataset.carrying;
      await animate(ball,[{left:returnedX+'px',bottom:returnedBottom+'px'},{left:'24px',bottom:floor+'px'}],360,'ease-in');
      if(session!==current)return;
      avatar.style.transform='';ball.style.left='';ball.style.bottom='';ball.style.transform='';ball.style.opacity='';profile.style.transform='';avatar.removeAttribute('data-gait');
      rounds++;progress('Pelotas recuperadas',rounds,3);
      if(rounds===3){finish();return;}
      chasing=false;launchButton.disabled=false;
    }
    const launchButton=button('Lanzar pelota',()=>launch(stage.clientWidth-45));
    listen(ball,'pointerdown',event=>{if(chasing||event.button!==0)return;ball.setPointerCapture(event.pointerId);});
    listen(ball,'pointermove',event=>{if(ball.hasPointerCapture(event.pointerId)){const box=stage.getBoundingClientRect();ball.style.left=Math.max(0,Math.min(box.width-30,event.clientX-box.left-15))+'px';}});
    listen(ball,'pointerup',event=>{if(ball.hasPointerCapture(event.pointerId)){ball.releasePointerCapture(event.pointerId);launch(event.clientX-stage.getBoundingClientRect().left);}});
    listen(stage,'click',event=>{if(event.target===stage&&!chasing)launch(event.clientX-stage.getBoundingClientRect().left);});
  }

  function start(action,pet) {
    stop();
    stage.querySelectorAll('.game-prop,.dirt-layer').forEach(node => node.remove());
    session={action,controller:new AbortController(),animations:new Set(),completed:false};
    stage.dataset.game=action;
    avatar.removeAttribute('data-activity');
    panel.hidden=false;
    const label=document.createElement('p');label.className='game-progress';label.setAttribute('role','status');
    const bar=document.createElement('progress');bar.setAttribute('aria-label','Progreso de la actividad');
    panel.append(label,bar);
    if(action==='bath')bath();else if(action==='feed')feed();else play(pet);
    button('Volver sin gastar un uso',stop,'game-cancel');
  }
  return { start, stop, get active(){return !!session;} };
};
