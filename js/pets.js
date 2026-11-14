'use strict';
    const BREEDS={
      perro:[
        {id:'labrador',name:'Labrador',coat:'#d6a36c',light:'#f5d1a0',ear:'#a36b47',kind:'floppy',muzzle:'#f4dcbd'},
        {id:'husky',name:'Husky',coat:'#8797b3',light:'#dce9ef',ear:'#60728f',kind:'pointy',muzzle:'#f5f7f7'},
        {id:'corgi',name:'Corgi',coat:'#d88c4e',light:'#fbe1b8',ear:'#c57b3b',kind:'corgi',muzzle:'#fff0d8'},
        {id:'pug',name:'Pug',coat:'#d5b78d',light:'#f4dfbb',ear:'#594c50',kind:'pug',muzzle:'#6c5357'},
        {id:'poodle',name:'Poodle',coat:'#d6b5aa',light:'#f1d9cb',ear:'#b88e87',kind:'poodle',muzzle:'#f4ded5'},
        {id:'dalmata',name:'Dálmata',coat:'#dce4ee',light:'#ffffff',ear:'#34384b',kind:'dalmata',muzzle:'#faf7ef',isNew:true}
      ],
      gato:[
        {id:'siames',name:'Siamés',coat:'#dec8a2',light:'#fff0cb',ear:'#6d565c',kind:'siames',muzzle:'#6a535a'},
        {id:'persa',name:'Persa',coat:'#e5d5c5',light:'#fff0e0',ear:'#cbb6a5',kind:'persa',muzzle:'#f8e6d5'},
        {id:'bengali',name:'Bengalí',coat:'#d0a15c',light:'#f3cf8e',ear:'#af7f45',kind:'bengali',muzzle:'#ebce9a'},
        {id:'britanico',name:'Británico',coat:'#8295ad',light:'#b7c9df',ear:'#64758b',kind:'britanico',muzzle:'#c8d7e5'},
        {id:'maine',name:'Maine Coon',coat:'#b88c78',light:'#ecd2b8',ear:'#896858',kind:'maine',muzzle:'#e9c9ae'},
        {id:'sphynx',name:'Sphynx',coat:'#c48f9f',light:'#f4d1cb',ear:'#ad788e',kind:'sphynx',muzzle:'#f7dcd2',isNew:true}
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
      if(b.kind==='dalmata')return '<g fill="#34384b"><path d="M106 86Q117 72 129 82Q142 96 128 108Q108 117 102 102Z"/><ellipse cx="204" cy="94" rx="14" ry="10" transform="rotate(24 204 94)"/><ellipse cx="223" cy="155" rx="9" ry="13"/><ellipse cx="96" cy="150" rx="6" ry="8"/><circle cx="165" cy="78" r="6"/></g>';
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
function petSVG(s,id,color=COLORS[0].value,name=''){
  const b=getBreed(s,id),cat=s==='gato',hairless=b.kind==='sphynx';
  const uid=`pet-${++svgSerial}`;
  const collar=COLORS.some(c=>c.value===color)?color:COLORS[0].value;
  const initials=escapeText(Array.from(String(name||'').trim()).slice(0,2).join('').toUpperCase());
  const iris=b.kind==='pointy'?'#74cdeb':cat?(b.kind==='siames'?'#68cfe8':b.kind==='britanico'?'#e8ad51':'#aad078'):'#a47953';
  const eyes=[129,191].map((x,i)=>`<g><ellipse cx="${x}" cy="141" rx="${cat?10:8}" ry="11" fill="${b.kind==='pointy'&&i===1?'#d4a269':iris}"/><ellipse cx="${x}" cy="141" rx="${cat?3.5:6}" ry="9" fill="#25283c"/><circle cx="${x-2}" cy="138" r="1.8" fill="#fff" opacity=".7"/></g>`).join('');
  const ears=hairless?`<path d="M94 124Q60 80 65 18Q114 24 141 90M226 124Q260 80 255 18Q206 24 179 90" fill="${b.coat}" stroke="${b.ear}" stroke-width="3" stroke-linejoin="round"/><path d="M99 101Q78 65 80 37Q111 48 126 91M221 101Q242 65 240 37Q209 48 194 91" fill="#ba7b91"/><path d="M90 52L102 86M230 52L218 86" stroke="#f7c5c4" stroke-width="4" stroke-linecap="round"/>`:cat?catEars(b):dogEars(b);
  const tail=cat?'M211 271Q280 302 279 241Q279 219 265 223':'M216 263Q272 243 255 201';
  const bodyMarks=b.kind==='dalmata'?'<g fill="#34384b"><ellipse cx="111" cy="267" rx="13" ry="17" transform="rotate(-20 111 267)"/><ellipse cx="204" cy="283" rx="12" ry="9"/><circle cx="184" cy="252" r="7"/></g>':b.kind==='bengali'?'<g fill="none" stroke="#885f3f" stroke-width="4"><ellipse cx="110" cy="267" rx="7" ry="10"/><ellipse cx="207" cy="266" rx="8" ry="6"/><ellipse cx="202" cy="289" rx="7" ry="9"/></g>':'';
  const headMarks=hairless?'<g fill="none" stroke="#ad788e" stroke-width="2.5" stroke-linecap="round" opacity=".65"><path d="M137 84Q160 96 183 84M144 95Q160 104 176 95M150 106Q160 112 170 106M92 158L107 162M228 158L213 162"/></g>':coatMarks(s,b);
  const mouth=cat?`<path d="M152 170Q160 166 168 170L160 179Z" fill="#ba7289"/><path d="M160 179V185M160 185Q151 194 145 185M160 185Q169 194 175 185" stroke="#704258" stroke-width="2.5" fill="none" stroke-linecap="round"/>${hairless?'':'<path d="M139 177L95 171M139 184L94 190M181 177L225 171M181 184L226 190" fill="none" stroke="#fff4e3" stroke-width="2.5" stroke-linecap="round"/>'}`:'<path d="M146 166Q160 160 174 166Q177 177 160 182Q143 177 146 166" fill="#343044"/><ellipse cx="155" cy="168" rx="6" ry="2" fill="#b5a2b2" opacity=".6"/><path d="M146 186Q160 198 174 186" fill="#483344" stroke="#483344" stroke-width="3" stroke-linecap="round"/><path d="M153 191Q160 195 167 191V199Q160 208 153 199Z" fill="#f195a7"/><path d="M160 194V199" stroke="#cc6e87" stroke-width="1.5"/>';
  const paws=[125,195].map(x=>`<ellipse cx="${x}" cy="309" rx="27" ry="18" fill="url(#body-${uid})" stroke="${b.ear}" stroke-opacity=".45" stroke-width="2"/><path d="M${x-7} 310v7M${x+3} 311v7" stroke="${b.ear}" stroke-width="2" stroke-linecap="round" opacity=".5"/><ellipse cx="${x-5}" cy="303" rx="9" ry="3" fill="#fff" opacity=".24"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 340" role="img" aria-label="${cat?'Gato':'Perro'} ${escapeText(b.name)}${name?' llamado '+escapeText(name):''}, collar ${escapeText(collar)}">
  <defs>
    <linearGradient id="body-${uid}" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${b.light}"/><stop offset=".6" stop-color="${b.coat}"/><stop offset="1" stop-color="${b.ear}"/></linearGradient>
    <radialGradient id="head-${uid}" cx=".35" cy=".25" r=".85"><stop stop-color="${b.light}"/><stop offset=".75" stop-color="${b.coat}"/><stop offset="1" stop-color="${b.ear}"/></radialGradient>
    <linearGradient id="gold-${uid}" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fff6cd"/><stop offset=".45" stop-color="#ffd47d"/><stop offset="1" stop-color="#c48338"/></linearGradient>
    <linearGradient id="gloss-${uid}" x1="0" y1="0" x2="0" y2="1"><stop stop-color="white" stop-opacity=".4"/><stop offset=".5" stop-color="white" stop-opacity="0"/><stop offset="1" stop-color="#19223b" stop-opacity=".3"/></linearGradient>
  </defs>
  <path d="${tail}" fill="none" stroke="${b.ear}" stroke-width="${hairless?13:24}" stroke-linecap="round"/>
  <path d="${tail}" fill="none" stroke="${b.coat}" stroke-width="${hairless?7:14}" stroke-linecap="round"/>
  <ellipse cx="160" cy="260" rx="${hairless?58:68}" ry="67" fill="url(#body-${uid})" stroke="${b.ear}" stroke-opacity=".45" stroke-width="2"/>
  <ellipse cx="160" cy="270" rx="38" ry="45" fill="${b.light}" opacity=".75"/>
  ${bodyMarks}
  <path d="M124 255Q119 275 123 295M196 255Q201 275 197 295" fill="none" stroke="${b.ear}" stroke-width="2.5" stroke-linecap="round" opacity=".4"/>
  ${paws}
  <ellipse cx="160" cy="218" rx="48" ry="13" fill="#38273e" opacity=".14"/>
  ${ears}
  <ellipse cx="160" cy="140" rx="${hairless?76:82}" ry="78" fill="url(#head-${uid})" stroke="${b.ear}" stroke-opacity=".55" stroke-width="2"/>
  ${headMarks}
  <ellipse cx="160" cy="176" rx="${cat?38:43}" ry="${cat?25:29}" fill="${b.muzzle}" opacity=".94"/>
  <ellipse cx="108" cy="165" rx="13" ry="7" fill="#f791a6" opacity=".35"/><ellipse cx="212" cy="165" rx="13" ry="7" fill="#f791a6" opacity=".35"/>
  ${eyes}${mouth}
  <path d="M111 208Q160 226 209 208L207 230Q160 250 113 230Z" fill="${collar}" stroke="#36344d" stroke-width="2"/>
  <path d="M111 208Q160 226 209 208L207 230Q160 250 113 230Z" fill="url(#gloss-${uid})"/>
  <path d="M118 216Q160 232 202 216" fill="none" stroke="white" stroke-opacity=".55" stroke-width="2" stroke-dasharray="3 5" stroke-linecap="round"/>
  <rect x="191" y="215" width="9" height="13" rx="2" fill="url(#gold-${uid})" stroke="#87643e"/>
  <circle cx="160" cy="234" r="5" fill="none" stroke="#f5cf7c" stroke-width="3"/>
  <circle cx="160" cy="252" r="19" fill="#563b36" opacity=".18"/>
  <circle cx="160" cy="249" r="19" fill="url(#gold-${uid})" stroke="#e9bd6c" stroke-width="2"/>
  <circle cx="160" cy="249" r="14" fill="none" stroke="#fff0b7" stroke-width="1.5"/>
  <text x="160" y="254" text-anchor="middle" font-family="sans-serif" font-size="${initials?11:16}" font-weight="800" fill="#79502d">${initials||'★'}</text>
  <path d="M147 238L152 235" stroke="#fff9db" stroke-width="3" stroke-linecap="round"/>
  </svg>`;
}

function labelFor(pet){return pet.species==='perro'?'Perro':'Gato'}
