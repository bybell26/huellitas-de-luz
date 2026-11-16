'use strict';
(function(global){
 const fields={
 fur:{label:'Pelaje',options:[['breed','De la raza'],['black','Negro'],['chocolate','Chocolate'],['cream','Crema'],['white','Blanco'],['ginger','Canela'],['gray','Gris']]},
 pattern:{label:'Patrón',options:[['breed','De la raza'],['solid','Liso'],['patches','Manchas'],['stripes','Rayado']]},
 ears:{label:'Orejas',options:[['breed','De la raza'],['pointed','Puntiagudas'],['soft','Suaves']]},
 tail:{label:'Cola',options:[['breed','De la raza'],['long','Larga'],['curled','Curvada'],['short','Corta']]},
 body:{label:'Cuerpo',options:[['breed','De la raza'],['slim','Esbelto'],['stocky','Robusto']]}};
 function normalize(value={}){return Object.fromEntries(Object.entries(fields).map(([key,f])=>[key,f.options.some(([id])=>id===value?.[key])?value[key]:'breed']))}
 function controls(value={}){const v=normalize(value);return '<details class="appearance-options"><summary>Personalizar apariencia</summary><p>Pelajes naturales y proporciones a tu gusto.</p><div class="appearance-grid">'+Object.entries(fields).map(([key,f])=>'<label>'+f.label+'<select data-appearance="'+key+'">'+f.options.map(([id,name])=>'<option value="'+id+'"'+(v[key]===id?' selected':'')+'>'+name+'</option>').join('')+'</select></label>').join('')+'</div></details>'}
 global.PetAppearance={fields,normalize,controls};
})(window);
