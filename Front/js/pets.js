'use strict';
    const BREEDS={
      perro:[
        {id:'labrador',name:'Labrador',coat:'#d6a36c',light:'#f5d1a0',ear:'#a36b47',kind:'floppy',muzzle:'#f4dcbd'},
        {id:'husky',name:'Husky',coat:'#8797b3',light:'#dce9ef',ear:'#60728f',kind:'pointy',muzzle:'#f5f7f7'},
        {id:'corgi',name:'Corgi',coat:'#d88c4e',light:'#fbe1b8',ear:'#c57b3b',kind:'corgi',muzzle:'#fff0d8'},
        {id:'pug',name:'Pug',coat:'#d5b78d',light:'#f4dfbb',ear:'#594c50',kind:'pug',muzzle:'#6c5357'},
        {id:'poodle',name:'Poodle',coat:'#d6b5aa',light:'#f1d9cb',ear:'#b88e87',kind:'poodle',muzzle:'#f4ded5'}
      ],
      gato:[
        {id:'siames',name:'Siamés',coat:'#dec8a2',light:'#fff0cb',ear:'#6d565c',kind:'siames',muzzle:'#6a535a'},
        {id:'persa',name:'Persa',coat:'#e5d5c5',light:'#fff0e0',ear:'#cbb6a5',kind:'persa',muzzle:'#f8e6d5'},
        {id:'bengali',name:'Bengalí',coat:'#d0a15c',light:'#f3cf8e',ear:'#af7f45',kind:'bengali',muzzle:'#ebce9a'},
        {id:'britanico',name:'Británico',coat:'#8295ad',light:'#b7c9df',ear:'#64758b',kind:'britanico',muzzle:'#c8d7e5'},
        {id:'maine',name:'Maine Coon',coat:'#b88c78',light:'#ecd2b8',ear:'#896858',kind:'maine',muzzle:'#e9c9ae'}
      ]
    };
    const COLORS=[{label:'Lila',value:'#a77fff'},{label:'Turquesa',value:'#6fe1cf'},{label:'Coral',value:'#ff8b88'},{label:'Azul',value:'#73a7fc'},{label:'Amarillo',value:'#ffc96d'},{label:'Negro',value:'#33435c'}];
function escapeText(t){return String(t).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function getBreed(s,id){return BREEDS[s]?.find(b=>b.id===id)||BREEDS.perro[0]}
    function dogEars(b){switch(b.kind){
      case 'pointy':return `<path d="M91 116 L92 37 Q105 22 135 83 Z" fill="${b.ear}" stroke="#414c66" stroke-width="2"/><path d="M229 116 L228 37 Q215 22 185 83 Z" fill="${b.ear}" stroke="#414c66" stroke-width="2"/><path d="M104 89 L102 54 L124 91Z" fill="#dba9ae" opacity=".72"/><path d="M216 89 L218 54 L196 91Z" fill="#dba9ae" opacity=".72"/>`;
      case 'corgi':return `<path d="M90 120 L77 18 Q101 7 137 90Z" fill="${b.ear}"/><path d="M230 120 L243 18 Q219 7 183 90Z" fill="${b.ear}"/><path d="M99 86 L90 37 L125 95Z" fill="#e8b0a0"/><path d="M221 86 L230 37 L195 95Z" fill="#e8b0a0"/>`;
      case 'pug':return `<path d="M105 108Q55 71 69 126Q75 152 98 152Z" fill="${b.ear}"/><path d="M215 108Q265 71 251 126Q245 152 222 152Z" fill="${b.ear}"/>`;
      case 'poodle':return `<g fill="${b.ear}"><circle cx="79" cy="119" r="30"/><circle cx="78" cy="146" r="30"/><circle cx="241" cy="119" r="30"/><circle cx="242" cy="146" r="30"/></g>`;
      default:return `<path d="M99 103Q48 88 57 155Q74 180 99 153Z" fill="${b.ear}"/><path d="M221 103Q272 88 263 155Q246 180 221 153Z" fill="${b.ear}"/>`;
    }}
    function catEars(b){const tall=b.kind==='maine';return `<path d="M90 110L${tall?79:85} ${tall?24:43}Q116 50 138 84Z" fill="${b.ear}"/><path d="M230 110L${tall?241:235} ${tall?24:43}Q204 50 182 84Z" fill="${b.ear}"/><path d="M99 90L92 ${tall?48:57} 125 93Z" fill="#e9b4bd" opacity=".7"/><path d="M221 90L228 ${tall?48:57} 195 93Z" fill="#e9b4bd" opacity=".7"/>${tall?'<path d="M78 32L73 8L94 37M242 32L247 8L226 37" fill="none" stroke="'+b.ear+'" stroke-width="9" stroke-linecap="round"/>':''}`}
    function coatMarks(s,b){if(s==='perro'){
      if(b.kind==='pointy')return `<path d="M97 89 Q123 69 160 96Q197 69 223 89Q205 110 202 156L177 174L160 145L143 174L118 156Q115 110 97 89Z" fill="#e9f2f2" opacity=".93"/><path d="M143 89L160 109L177 89" fill="none" stroke="${b.ear}" stroke-width="6" stroke-linecap="round"/>`;
      if(b.kind==='pug')return `<ellipse cx="160" cy="161" rx="48" ry="45" fill="#6c5456"/><path d="M124 106Q140 100 151 112M169 112Q182 100 198 106" fill="none" stroke="#876e6a" stroke-width="5" stroke-linecap="round"/>`;
      if(b.kind==='corgi')return `<path d="M137 71Q158 85 183 71L178 110L160 119L142 110Z" fill="${b.light}"/>`;
      if(b.kind==='poodle')return `<g fill="${b.coat}"><circle cx="94" cy="93" r="30"/><circle cx="128" cy="68" r="32"/><circle cx="160" cy="67" r="32"/><circle cx="192" cy="68" r="32"/><circle cx="224" cy="93" r="30"/></g>`;
      return `<path d="M140 70Q159 83 181 70" fill="none" stroke="${b.light}" stroke-width="8" stroke-linecap="round" opacity=".35"/>`;
    }
    if(b.kind==='siames')return `<ellipse cx="160" cy="166" rx="53" ry="49" fill="#695259" opacity=".97"/><path d="M104 94Q160 73 216 94" fill="none" stroke="#d2bfa0" stroke-width="7" opacity=".42"/>`;
    if(b.kind==='bengali')return `<g fill="#885f3f" opacity=".85"><ellipse cx="112" cy="98" rx="8" ry="4" transform="rotate(-20 112 98)"/><ellipse cx="138" cy="79" rx="6" ry="9"/><ellipse cx="184" cy="79" rx="6" ry="9"/><ellipse cx="208" cy="98" rx="8" ry="4" transform="rotate(20 208 98)"/><path d="M149 95L160 113L171 95" fill="none" stroke="#885f3f" stroke-width="5" stroke-linecap="round"/><ellipse cx="103" cy="165" rx="9" ry="6"/><ellipse cx="217" cy="165" rx="9" ry="6"/></g>`;
    if(b.kind==='persa'||b.kind==='maine')return `<g fill="${b.light}" opacity=".8"><path d="M83 153Q72 167 89 175Q75 188 102 186L122 170Z"/><path d="M237 153Q248 167 231 175Q245 188 218 186L198 170Z"/></g>`;
    return `<path d="M125 91Q160 78 195 91" stroke="${b.light}" stroke-width="7" stroke-linecap="round" fill="none" opacity=".4"/>`;
    }
    let svgSerial=0;
    function petSVG(s,id,color=COLORS[0].value,name=''){const b=getBreed(s,id),cat=s==='gato',safe=escapeText(name||'');const idSuffix=`${s}-${b.id}-${++svgSerial}`;
      const tails=cat?`<path d="M212 261 Q277 292 280 231 Q278 210 266 215" stroke="${b.ear}" stroke-width="23" stroke-linecap="round" fill="none"/>`:`<path d="M213 246 Q271 226 255 183" stroke="${b.coat}" stroke-width="25" stroke-linecap="round" fill="none"/>`;
      const eyes=cat?`<g><ellipse cx="130" cy="139" rx="12" ry="14" fill="${b.kind==='siames'?'#6bd5ed':'#bcd688'}"/><ellipse cx="190" cy="139" rx="12" ry="14" fill="${b.kind==='siames'?'#6bd5ed':'#bcd688'}"/><ellipse cx="130" cy="139" rx="3.7" ry="11" fill="#202a42"/><ellipse cx="190" cy="139" rx="3.7" ry="11" fill="#202a42"/><circle cx="126" cy="134" r="2.6" fill="#fff"/><circle cx="186" cy="134" r="2.6" fill="#fff"/></g>`:`<g fill="#222a40"><ellipse cx="130" cy="139" rx="7" ry="9"/><ellipse cx="190" cy="139" rx="7" ry="9"/></g><g fill="white"><circle cx="128" cy="136" r="2.3"/><circle cx="188" cy="136" r="2.3"/></g>`;
      const nose=cat?`<path d="M153 169L167 169L160 177Z" fill="#bd7a84"/><path d="M160 177V185M160 185Q153 192 148 185M160 185Q167 192 172 185" stroke="#754a5d" stroke-width="2.8" fill="none" stroke-linecap="round"/><g stroke="#ece7dc" stroke-width="2" stroke-linecap="round" opacity=".9"><path d="M142 177L93 165M141 184L90 183M178 177L227 165M179 184L230 183"/></g>`:`<ellipse cx="160" cy="172" rx="18" ry="12" fill="#3c3544"/><path d="M160 182V190M160 190Q149 199 142 190M160 190Q171 199 178 190" stroke="#59454b" stroke-width="3" fill="none" stroke-linecap="round"/>`;
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 340" role="img" aria-label="Avatar ${cat?'de gato':'de perro'} raza ${escapeText(b.name)} con collar ${escapeText(color)}"><defs><linearGradient id="body-${idSuffix}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${b.light}"/><stop offset="1" stop-color="${b.coat}"/></linearGradient><linearGradient id="head-${idSuffix}" x1="0" y1="0" x2=".8" y2="1"><stop offset="0" stop-color="${b.light}"/><stop offset="1" stop-color="${b.coat}"/></linearGradient><linearGradient id="medal-${idSuffix}" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fff4b8"/><stop offset="1" stop-color="#d99c43"/></linearGradient></defs>
        ${tails}<ellipse cx="160" cy="256" rx="69" ry="74" fill="url(#body-${idSuffix})"/><ellipse cx="160" cy="267" rx="41" ry="52" fill="${b.light}" opacity=".72"/><ellipse cx="125" cy="307" rx="26" ry="18" fill="${b.coat}"/><ellipse cx="195" cy="307" rx="26" ry="18" fill="${b.coat}"/>
        ${cat?catEars(b):dogEars(b)}<ellipse cx="160" cy="140" rx="82" ry="80" fill="url(#head-${idSuffix})"/>
        ${coatMarks(s,b)}<ellipse cx="160" cy="171" rx="${cat?38:43}" ry="${cat?27:32}" fill="${b.muzzle}" opacity="${b.kind==='pug'||b.kind==='siames'?'0.72':'0.94'}"/><ellipse cx="110" cy="164" rx="12" ry="7" fill="#f49ba1" opacity=".24"/><ellipse cx="210" cy="164" rx="12" ry="7" fill="#f49ba1" opacity=".24"/>${eyes}${nose}
        <path d="M111 204Q160 224 209 204 L207 229Q160 248 113 229Z" fill="${color}" stroke="#18233d" stroke-width="2"/><path d="M117 213Q160 230 203 213" fill="none" stroke="white" stroke-width="2.5" opacity=".3"/><circle cx="160" cy="235" r="18" fill="url(#medal-${idSuffix})" stroke="#e7b96c" stroke-width="2"/><circle cx="160" cy="235" r="13" fill="none" stroke="#ffecb4" opacity=".8" stroke-width="1.5"/><text x="160" y="240" text-anchor="middle" font-family="sans-serif" font-size="${safe.length>1?9:14}" font-weight="800" fill="#70502e">${safe?escapeText(safe.slice(0,2).toUpperCase()):'★'}</text>
        </svg>`;
    }


function labelFor(pet){return pet.species==='perro'?'Perro':'Gato'}
