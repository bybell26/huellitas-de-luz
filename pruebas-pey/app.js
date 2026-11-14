'use strict';
const $=id=>document.getElementById(id);
let flow;
function view(name){for(const step of ['qr','loading','result']){$('screen-'+step).hidden=step!==name;$('step-'+step).classList.toggle('active',step===name)}}
function start(){
 flow?.dispose();
 flow=createPaymentFlow(p=>{
  if(p.status==='creating'){view('qr');$('qr-image').hidden=true;$('paid-button').disabled=true;$('qr-notice').textContent='Preparando tu codigo QR...';}
  if(p.status==='qr'){view('qr');$('qr-image').src=p.qr.qrImage;$('qr-image').hidden=false;$('paid-button').disabled=false;$('qr-notice').textContent='Escanea y paga $0.01 MXN. Despues pulsa Ya realice el pago.';$('qr-reference').textContent='Referencia QR: '+p.qr.id;}
  if(p.status==='waiting'){view('loading');$('loading-notice').textContent=p.message||'Esperando confirmacion. Tiempo maximo: 2 minutos.';}
  if(['paid','rejected','error'].includes(p.status)){view('result');$('result-title').textContent=p.status==='paid'?'Cobro aceptado':p.status==='rejected'?'Cobro rechazado':'No se pudo preparar el cobro';$('result-description').textContent=p.message||'Pey confirmo el pago de $0.01 MXN.';$('result-icon').textContent=p.status==='paid'?'OK':'!';$('transaction-id').textContent=p.transaction?'Transaccion: '+p.transaction.id:'';$('retry-button').hidden=true;}
 });
 flow.start();
}
$('paid-button').addEventListener('click',()=>flow.validate());
$('back-button').hidden=true;
$('new-button').addEventListener('click',start);
window.addEventListener('pagehide',()=>flow?.dispose());
start();
