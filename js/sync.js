'use strict';
const BEAT_KEY='orbita_pets_v3_display_heartbeat';
const MESSAGE_KEY='orbita_pets_v3_message';
const BUS_NAME='orbita_pets_v3_bus';
function createBus(onMessage){
  let channel=null;
  const seen=new Set(),order=[];
  function accept(message){
    if(!message||typeof message!=='object')return;
    if(message.nonce){
      if(seen.has(message.nonce))return;
      seen.add(message.nonce);order.push(message.nonce);
      if(order.length>150)seen.delete(order.shift());
    }
    onMessage(message);
  }
  try{channel=new BroadcastChannel(BUS_NAME);channel.onmessage=e=>accept(e.data)}catch(error){}
  window.addEventListener('storage',e=>{
    if(e.key===MESSAGE_KEY&&e.newValue){try{accept(JSON.parse(e.newValue))}catch(error){}}
  });
  return {publish(message){
    const value={...message,nonce:Date.now()+'-'+Math.random().toString(36).slice(2,8)};
    try{channel?.postMessage(value)}catch(error){}
    try{localStorage.setItem(MESSAGE_KEY,JSON.stringify(value))}catch(error){}
  }};
}
function isDisplayOnline(){try{return Date.now()-Number(localStorage.getItem(BEAT_KEY))<6500}catch(error){return false}}
