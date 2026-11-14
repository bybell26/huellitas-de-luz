'use strict';
const DATA_KEY='orbita_pets_v3_roster';
const V2_DATA_KEY='orbita_pets_v2_latest';



const PAUSE_KEY='orbita_pets_v3_paused';
const LABELS_KEY='orbita_pets_v3_labels';
const MAX_PETS=42;

function cleanAvatar(raw){
  if(!raw || !['perro','gato'].includes(raw.species))return null;
  if(!BREEDS[raw.species].some(b=>b.id===raw.breed))return null;
  if(!COLORS.some(c=>c.value===raw.collar))return null;
  const id=String(raw.id||'').slice(0,60);
  if(!id)return null;
  return {id,species:raw.species,breed:raw.breed,collar:raw.collar,
    name:String(raw.name||'').trim().slice(0,16),createdAt:Number(raw.createdAt)||Date.now(),
    slot:Number.isInteger(raw.slot)&&raw.slot>=0&&raw.slot<MAX_PETS?raw.slot:null};
}
function normalizeRoster(input){
  if(!Array.isArray(input))return [];
  const ids=new Set(),usedSlots=new Set(),all=[];
  for(const raw of input){
    const pet=cleanAvatar(raw);
    if(!pet||ids.has(pet.id)||all.length===MAX_PETS)continue;
    ids.add(pet.id);
    if(pet.slot!==null&&!usedSlots.has(pet.slot))usedSlots.add(pet.slot);
    else pet.slot=null;
    all.push(pet);
  }
  for(const pet of all){
    if(pet.slot!==null)continue;
    for(let slot=0;slot<MAX_PETS;slot++)if(!usedSlots.has(slot)){
      pet.slot=slot;usedSlots.add(slot);break;
    }
  }
  return all;
}
function readRoster(){
  try{
    const current=localStorage.getItem(DATA_KEY);
    if(current!==null){const parsed=JSON.parse(current);return normalizeRoster(parsed?.avatars)}
    // Una sola importación desde V2; nunca reimportar tras borrar en V3.
    const old=localStorage.getItem(V2_DATA_KEY);
    let imported=[];
    if(old){const avatar=cleanAvatar(JSON.parse(old));if(avatar){avatar.slot=0;imported=[avatar]}}
    localStorage.setItem(DATA_KEY,JSON.stringify({version:3,avatars:imported}));
    return imported;
  }catch(error){return []}
}
function saveRoster(avatars){
  const safe=normalizeRoster(avatars);
  localStorage.setItem(DATA_KEY,JSON.stringify({version:3,avatars:safe}));
  return safe;
}
function addAvatar(raw){
  const roster=readRoster();
  if(roster.length>=MAX_PETS)throw new Error('full');
  const avatar=cleanAvatar(raw);
  if(!avatar)throw new Error('invalid');
  if(roster.some(p=>p.id===avatar.id))throw new Error('duplicate');
  avatar.slot=Array.from({length:MAX_PETS},(_,i)=>i).find(i=>!roster.some(p=>p.slot===i));
  saveRoster([...roster,avatar]);
  return avatar;
}
function removeAvatar(id){const roster=readRoster().filter(p=>p.id!==id);saveRoster(roster);return roster}
function clearRoster(){saveRoster([])}
function latestAvatar(){const all=readRoster();return all.at(-1)||null}
function isPaused(){try{return localStorage.getItem(PAUSE_KEY)==='1'}catch(error){return false}}
function setPaused(value){localStorage.setItem(PAUSE_KEY,value?'1':'0')}
function labelsVisible(){try{return localStorage.getItem(LABELS_KEY)!=='0'}catch(error){return true}}
function setLabelsVisible(value){localStorage.setItem(LABELS_KEY,value?'1':'0')}
