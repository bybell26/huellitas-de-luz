const {test}=require('node:test');
const assert=require('node:assert/strict');
const {stepPetWander,wanderSeed}=require('./pet-roaming.js');
function pet(id,x=500,y=300) { return {seed:wanderSeed(id),x,y,vx:0,vy:0,held:false,time:0,heading:1,phase:wanderSeed(id)%6,speed:22,size:100}; }
const bounds={left:80,right:920,top:120,bottom:620};
test('recorridos acotados y suaves durante diez minutos con 42 mascotas',()=>{
 const states=Array.from({length:42},(_,i)=>pet(String(i),80+(i%7)*120,120+Math.floor(i/7)*90));
 for(let frame=0;frame<18000;frame++){
   stepPetWander(states,bounds,1/30);
   for(const p of states){
     assert.ok(p.x>=bounds.left&&p.x<=bounds.right&&p.y>=bounds.top&&p.y<=bounds.bottom);
     assert.ok(Math.hypot(p.vx,p.vy)<=p.speed+.001);
   }
 }
 assert.ok(new Set(states.map(p=>Math.round(p.x))).size>10);
});
test('inspeccionar detiene solo esa mascota y no salta al reanudar',()=>{
 const held=pet('held'),other=pet('other',700,400);held.held=true;
 for(let i=0;i<90;i++)stepPetWander([held,other],bounds,1/30);
 assert.equal(held.x,500);assert.equal(held.y,300);assert.notEqual(other.x,700);
 held.held=false;stepPetWander([held,other],bounds,5);
 assert.ok(Math.hypot(held.x-500,held.y-300)<2);
});
