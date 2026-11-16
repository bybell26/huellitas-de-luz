/**
 * PetSVG.tsx — Versión React Native del petSVG() de js/pets.js
 * Usa react-native-svg. Genera exactamente la misma mascota que la web.
 */
import React, { useMemo } from 'react';
import Svg, {
  Defs, LinearGradient, RadialGradient, Stop,
  Ellipse, Path, Circle, Rect, Text as SvgText, G,
} from 'react-native-svg';
import { BREEDS, COLORS, getBreed, Species } from '../constants/pets';

let svgSerial = 0;

interface Props {
  species:  Species;
  breedId:  string;
  collar:   string;
  name?:    string;
  size?:    number;
}

export default function PetSVG({ species, breedId, collar, name = '', size = 160 }: Props) {
  const uid = useMemo(() => `pet-${++svgSerial}`, []);

  const b       = getBreed(species, breedId);
  const cat     = species === 'gato';
  const hairless= b.kind === 'sphynx';
  const collarColor = COLORS.some(c => c.value === collar) ? collar : COLORS[0].value;
  const initials = Array.from(String(name).trim()).slice(0, 2).join('').toUpperCase();

  const iris = b.kind === 'pointy' ? '#74cdeb'
    : cat ? (b.kind === 'siames' ? '#68cfe8' : b.kind === 'britanico' ? '#e8ad51' : '#aad078')
    : '#a47953';

  // ── Gradients ──────────────────────────────────────────────────────────────
  const defs = (
    <Defs>
      <LinearGradient id={`body-${uid}`} x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0"   stopColor={b.light} />
        <Stop offset=".6"  stopColor={b.coat} />
        <Stop offset="1"   stopColor={b.ear} />
      </LinearGradient>
      <RadialGradient id={`head-${uid}`} cx=".35" cy=".25" r=".85">
        <Stop offset="0"    stopColor={b.light} />
        <Stop offset=".75"  stopColor={b.coat} />
        <Stop offset="1"    stopColor={b.ear} />
      </RadialGradient>
      <LinearGradient id={`gold-${uid}`} x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0"    stopColor="#fff6cd" />
        <Stop offset=".45"  stopColor="#ffd47d" />
        <Stop offset="1"    stopColor="#c48338" />
      </LinearGradient>
      <LinearGradient id={`gloss-${uid}`} x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0"   stopColor="white" stopOpacity=".4" />
        <Stop offset=".5"  stopColor="white" stopOpacity="0" />
        <Stop offset="1"   stopColor="#19223b" stopOpacity=".3" />
      </LinearGradient>
    </Defs>
  );

  // ── Cola ───────────────────────────────────────────────────────────────────
  const tailD = cat
    ? 'M211 271Q280 302 279 241Q279 219 265 223'
    : 'M216 263Q272 243 255 201';

  // ── Orejas ─────────────────────────────────────────────────────────────────
  function dogEars() {
    switch (b.kind) {
      case 'pointy':
        return <>
          <Path d="M91 116 L92 37 Q105 22 135 83 Z" fill={b.ear} stroke="#414c66" strokeWidth="2"/>
          <Path d="M229 116 L228 37 Q215 22 185 83 Z" fill={b.ear} stroke="#414c66" strokeWidth="2"/>
          <Path d="M104 89 L102 54 L124 91Z" fill="#dba9ae" opacity=".72"/>
          <Path d="M216 89 L218 54 L196 91Z" fill="#dba9ae" opacity=".72"/>
        </>;
      case 'corgi':
        return <>
          <Path d="M90 120 L77 18 Q101 7 137 90Z" fill={b.ear}/>
          <Path d="M230 120 L243 18 Q219 7 183 90Z" fill={b.ear}/>
          <Path d="M99 86 L90 37 L125 95Z" fill="#e8b0a0"/>
          <Path d="M221 86 L230 37 L195 95Z" fill="#e8b0a0"/>
        </>;
      case 'pug':
        return <>
          <Path d="M105 108Q55 71 69 126Q75 152 98 152Z" fill={b.ear}/>
          <Path d="M215 108Q265 71 251 126Q245 152 222 152Z" fill={b.ear}/>
        </>;
      case 'poodle':
        return <G fill={b.ear}>
          <Circle cx="79" cy="119" r="30"/><Circle cx="78" cy="146" r="30"/>
          <Circle cx="241" cy="119" r="30"/><Circle cx="242" cy="146" r="30"/>
        </G>;
      default:
        return <>
          <Path d="M99 103Q48 88 57 155Q74 180 99 153Z" fill={b.ear}/>
          <Path d="M221 103Q272 88 263 155Q246 180 221 153Z" fill={b.ear}/>
        </>;
    }
  }

  function catEars() {
    const tall = b.kind === 'maine';
    return <>
      <Path d={`M90 110L${tall?79:85} ${tall?24:43}Q116 50 138 84Z`} fill={b.ear}/>
      <Path d={`M230 110L${tall?241:235} ${tall?24:43}Q204 50 182 84Z`} fill={b.ear}/>
      <Path d={`M99 90L92 ${tall?48:57} 125 93Z`} fill="#e9b4bd" opacity=".7"/>
      <Path d={`M221 90L228 ${tall?48:57} 195 93Z`} fill="#e9b4bd" opacity=".7"/>
      {tall && <Path d="M78 32L73 8L94 37M242 32L247 8L226 37" fill="none" stroke={b.ear} strokeWidth="9" strokeLinecap="round"/>}
    </>;
  }

  const ears = hairless
    ? <>
        <Path d="M94 124Q60 80 65 18Q114 24 141 90M226 124Q260 80 255 18Q206 24 179 90" fill={b.coat} stroke={b.ear} strokeWidth="3" strokeLinejoin="round"/>
        <Path d="M99 101Q78 65 80 37Q111 48 126 91M221 101Q242 65 240 37Q209 48 194 91" fill="#ba7b91"/>
        <Path d="M90 52L102 86M230 52L218 86" stroke="#f7c5c4" strokeWidth="4" strokeLinecap="round"/>
      </>
    : cat ? catEars() : dogEars();

  // ── Markings ───────────────────────────────────────────────────────────────
  function coatMarks() {
    if (species === 'perro') {
      if (b.kind === 'dalmata') return <G fill="#34384b">
        <Path d="M106 86Q117 72 129 82Q142 96 128 108Q108 117 102 102Z"/>
        <Ellipse cx="204" cy="94" rx="14" ry="10" transform="rotate(24 204 94)"/>
        <Ellipse cx="223" cy="155" rx="9" ry="13"/>
        <Ellipse cx="96" cy="150" rx="6" ry="8"/>
        <Circle cx="165" cy="78" r="6"/>
      </G>;
      if (b.kind === 'pointy') return <>
        <Path d={`M97 89 Q123 69 160 96Q197 69 223 89Q205 110 202 156L177 174L160 145L143 174L118 156Q115 110 97 89Z`} fill="#e9f2f2" opacity=".93"/>
        <Path d="M143 89L160 109L177 89" fill="none" stroke={b.ear} strokeWidth="6" strokeLinecap="round"/>
      </>;
      if (b.kind === 'pug') return <>
        <Ellipse cx="160" cy="161" rx="48" ry="45" fill="#6c5456"/>
        <Path d="M124 106Q140 100 151 112M169 112Q182 100 198 106" fill="none" stroke="#876e6a" strokeWidth="5" strokeLinecap="round"/>
      </>;
      if (b.kind === 'corgi') return <Path d="M137 71Q158 85 183 71L178 110L160 119L142 110Z" fill={b.light}/>;
      if (b.kind === 'poodle') return <G fill={b.coat}>
        <Circle cx="94" cy="93" r="30"/><Circle cx="128" cy="68" r="32"/>
        <Circle cx="160" cy="67" r="32"/><Circle cx="192" cy="68" r="32"/>
        <Circle cx="224" cy="93" r="30"/>
      </G>;
      return <Path d="M140 70Q159 83 181 70" fill="none" stroke={b.light} strokeWidth="8" strokeLinecap="round" opacity=".35"/>;
    }
    // gato
    if (b.kind === 'siames') return <>
      <Ellipse cx="160" cy="166" rx="53" ry="49" fill="#695259" opacity=".97"/>
      <Path d="M104 94Q160 73 216 94" fill="none" stroke="#d2bfa0" strokeWidth="7" opacity=".42"/>
    </>;
    if (b.kind === 'bengali') return <G fill="#885f3f" opacity=".85">
      <Ellipse cx="112" cy="98" rx="8" ry="4" transform="rotate(-20 112 98)"/>
      <Ellipse cx="138" cy="79" rx="6" ry="9"/>
      <Ellipse cx="184" cy="79" rx="6" ry="9"/>
      <Ellipse cx="208" cy="98" rx="8" ry="4" transform="rotate(20 208 98)"/>
      <Path d="M149 95L160 113L171 95" fill="none" stroke="#885f3f" strokeWidth="5" strokeLinecap="round"/>
      <Ellipse cx="103" cy="165" rx="9" ry="6"/>
      <Ellipse cx="217" cy="165" rx="9" ry="6"/>
    </G>;
    if (b.kind === 'persa' || b.kind === 'maine') return <G fill={b.light} opacity=".8">
      <Path d="M83 153Q72 167 89 175Q75 188 102 186L122 170Z"/>
      <Path d="M237 153Q248 167 231 175Q245 188 218 186L198 170Z"/>
    </G>;
    return <Path d="M125 91Q160 78 195 91" stroke={b.light} strokeWidth="7" strokeLinecap="round" fill="none" opacity=".4"/>;
  }

  const headMarks = hairless
    ? <G fill="none" stroke="#ad788e" strokeWidth="2.5" strokeLinecap="round" opacity=".65">
        <Path d="M137 84Q160 96 183 84M144 95Q160 104 176 95M150 106Q160 112 170 106M92 158L107 162M228 158L213 162"/>
      </G>
    : coatMarks();

  // ── Ojos ───────────────────────────────────────────────────────────────────
  const eyeData = [129, 191].map((x, i) => ({
    x, irisColor: b.kind === 'pointy' && i === 1 ? '#d4a269' : iris,
  }));

  // ── Hocico ─────────────────────────────────────────────────────────────────
  const mouth = cat
    ? <>
        <Path d="M152 170Q160 166 168 170L160 179Z" fill="#ba7289"/>
        <Path d="M160 179V185M160 185Q151 194 145 185M160 185Q169 194 175 185" stroke="#704258" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
        {!hairless && <Path d="M139 177L95 171M139 184L94 190M181 177L225 171M181 184L226 190" fill="none" stroke="#fff4e3" strokeWidth="2.5" strokeLinecap="round"/>}
      </>
    : <>
        <Path d="M146 166Q160 160 174 166Q177 177 160 182Q143 177 146 166" fill="#343044"/>
        <Ellipse cx="155" cy="168" rx="6" ry="2" fill="#b5a2b2" opacity=".6"/>
        <Path d="M146 186Q160 198 174 186" fill="#483344" stroke="#483344" strokeWidth="3" strokeLinecap="round"/>
        <Path d="M153 191Q160 195 167 191V199Q160 208 153 199Z" fill="#f195a7"/>
        <Path d="M160 194V199" stroke="#cc6e87" strokeWidth="1.5"/>
      </>;

  // ── Patas ──────────────────────────────────────────────────────────────────
  const pawData = [125, 195];

  return (
    <Svg viewBox="0 0 320 340" width={size} height={size * (340 / 320)}>
      {defs}

      {/* Cola */}
      <Path d={tailD} fill="none" stroke={b.ear}  strokeWidth={hairless ? 13 : 24} strokeLinecap="round"/>
      <Path d={tailD} fill="none" stroke={b.coat} strokeWidth={hairless ? 7  : 14} strokeLinecap="round"/>

      {/* Cuerpo */}
      <Ellipse cx="160" cy="260" rx={hairless ? 58 : 68} ry="67"
        fill={`url(#body-${uid})`} stroke={b.ear} strokeOpacity=".45" strokeWidth="2"/>
      <Ellipse cx="160" cy="270" rx="38" ry="45" fill={b.light} opacity=".75"/>

      {/* Manchas de cuerpo */}
      {b.kind === 'dalmata' && <G fill="#34384b">
        <Ellipse cx="111" cy="267" rx="13" ry="17" transform="rotate(-20 111 267)"/>
        <Ellipse cx="204" cy="283" rx="12" ry="9"/>
        <Circle cx="184" cy="252" r="7"/>
      </G>}
      {b.kind === 'bengali' && <G fill="none" stroke="#885f3f" strokeWidth="4">
        <Ellipse cx="110" cy="267" rx="7" ry="10"/>
        <Ellipse cx="207" cy="266" rx="8" ry="6"/>
        <Ellipse cx="202" cy="289" rx="7" ry="9"/>
      </G>}

      {/* Líneas patas */}
      <Path d="M124 255Q119 275 123 295M196 255Q201 275 197 295" fill="none" stroke={b.ear} strokeWidth="2.5" strokeLinecap="round" opacity=".4"/>

      {/* Patas */}
      {pawData.map(x => (
        <G key={x}>
          <Ellipse cx={x} cy="309" rx="27" ry="18" fill={`url(#body-${uid})`} stroke={b.ear} strokeOpacity=".45" strokeWidth="2"/>
          <Path d={`M${x-7} 310v7M${x+3} 311v7`} stroke={b.ear} strokeWidth="2" strokeLinecap="round" opacity=".5"/>
          <Ellipse cx={x-5} cy="303" rx="9" ry="3" fill="#fff" opacity=".24"/>
        </G>
      ))}

      {/* Sombra cuello */}
      <Ellipse cx="160" cy="218" rx="48" ry="13" fill="#38273e" opacity=".14"/>

      {/* Orejas */}
      {ears}

      {/* Cabeza */}
      <Ellipse cx="160" cy="140" rx={hairless ? 76 : 82} ry="78"
        fill={`url(#head-${uid})`} stroke={b.ear} strokeOpacity=".55" strokeWidth="2"/>

      {headMarks}

      {/* Hocico */}
      <Ellipse cx="160" cy="176" rx={cat ? 38 : 43} ry={cat ? 25 : 29} fill={b.muzzle} opacity=".94"/>

      {/* Rubor */}
      <Ellipse cx="108" cy="165" rx="13" ry="7" fill="#f791a6" opacity=".35"/>
      <Ellipse cx="212" cy="165" rx="13" ry="7" fill="#f791a6" opacity=".35"/>

      {/* Ojos */}
      {eyeData.map(({ x, irisColor }) => (
        <G key={x}>
          <Ellipse cx={x} cy="141" rx={cat ? 10 : 8} ry="11" fill={irisColor}/>
          <Ellipse cx={x} cy="141" rx={cat ? 3.5 : 6} ry="9" fill="#25283c"/>
          <Circle cx={x-2} cy="138" r="1.8" fill="#fff" opacity=".7"/>
        </G>
      ))}

      {mouth}

      {/* Collar */}
      <Path d="M111 208Q160 226 209 208L207 230Q160 250 113 230Z" fill={collarColor} stroke="#36344d" strokeWidth="2"/>
      <Path d="M111 208Q160 226 209 208L207 230Q160 250 113 230Z" fill={`url(#gloss-${uid})`}/>
      <Path d="M118 216Q160 232 202 216" fill="none" stroke="white" strokeOpacity=".55" strokeWidth="2" strokeDasharray="3 5" strokeLinecap="round"/>
      <Rect x="191" y="215" width="9" height="13" rx="2" fill={`url(#gold-${uid})`} stroke="#87643e"/>

      {/* Medallón */}
      <Circle cx="160" cy="234" r="5" fill="none" stroke="#f5cf7c" strokeWidth="3"/>
      <Circle cx="160" cy="252" r="19" fill="#563b36" opacity=".18"/>
      <Circle cx="160" cy="249" r="19" fill={`url(#gold-${uid})`} stroke="#e9bd6c" strokeWidth="2"/>
      <Circle cx="160" cy="249" r="14" fill="none" stroke="#fff0b7" strokeWidth="1.5"/>
      <SvgText x="160" y="254" textAnchor="middle" fontFamily="sans-serif"
        fontSize={initials ? 11 : 16} fontWeight="800" fill="#79502d">
        {initials || '★'}
      </SvgText>
      <Path d="M147 238L152 235" stroke="#fff9db" strokeWidth="3" strokeLinecap="round"/>
    </Svg>
  );
}
