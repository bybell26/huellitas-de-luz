'use strict';
// Configuración del backend (Mascotas Solidarias API).
// Para usar ngrok, define antes de cargar este archivo: window.ORBITA_API_BASE='https://<dominio>.ngrok-free.dev'
const API_BASE=(window.ORBITA_API_BASE||'http://localhost:5160').replace(/\/$/,'');
// Monto que ve el usuario en pantalla (demo) y monto que se manda realmente al back.
const DONATION_DISPLAY_MXN=10;
const DONATION_CHARGE_MXN=0.01;
const DONATION_STYLE='cartoon';
const ORDER_KEY='orbita_pets_order';

function saveOrder(order){try{sessionStorage.setItem(ORDER_KEY,JSON.stringify(order))}catch(error){}}
function loadOrder(){try{return JSON.parse(sessionStorage.getItem(ORDER_KEY))}catch(error){return null}}
function clearOrder(){try{sessionStorage.removeItem(ORDER_KEY)}catch(error){}}

async function apiFetch(path,{method='GET',token,body,contentType,raw=false}={}){
  const headers={'ngrok-skip-browser-warning':'1'};
  if(token)headers.Authorization='Bearer '+token;
  if(contentType)headers['Content-Type']=contentType;
  else if(body!==undefined&&!(body instanceof Blob))headers['Content-Type']='application/json';
  let response;
  try{
    response=await fetch(API_BASE+path,{method,headers,body:body===undefined?undefined:(body instanceof Blob?body:JSON.stringify(body))});
  }catch(error){
    const err=new Error('No se pudo conectar con el servidor. Verifica que la API esté encendida.');err.status=0;throw err;
  }
  if(raw&&response.ok)return response;
  let data=null;
  const text=await response.text();
  try{data=text?JSON.parse(text):null}catch(error){data=null}
  if(!response.ok){
    const err=new Error((data&&data.error)||('Error '+response.status));err.status=response.status;throw err;
  }
  return data;
}

const OrdersApi={
  create(){return apiFetch('/api/orders',{method:'POST',body:{amountMxn:DONATION_CHARGE_MXN,style:DONATION_STYLE}})},
  createQr(id,token){return apiFetch(`/api/orders/${id}/qr`,{method:'POST',token})},
  get(id,token){return apiFetch(`/api/orders/${id}`,{token})},
  simulatePayment(id,token){return apiFetch(`/api/orders/${id}/simulate-payment`,{method:'POST',token})},
  uploadPhoto(id,token,file){return apiFetch(`/api/orders/${id}/photo`,{method:'POST',token,body:file,contentType:file.type})},
  async download(id,token){
    const response=await apiFetch(`/api/orders/${id}/download`,{token,raw:true});
    return {blob:await response.blob(),type:response.headers.get('Content-Type')||''};
  }
};
