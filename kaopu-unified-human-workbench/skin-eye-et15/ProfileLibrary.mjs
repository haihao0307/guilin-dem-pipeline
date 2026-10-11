import {PRESETS,createPresetState} from '../full/ui/PresetCatalogueR2.mjs';
import {NATIVE_FEATURES,seededRandom} from '../identity-lab/Catalogue.mjs';
import {TRAIT_DEFAULTS,SHAPE_DEFAULTS,validateTraits,validateShape} from '../identity-lab/TraitSchema.mjs';
import {DEFAULTS as CINEMA,PRESETS as SURFACES} from '../skin-cinema-et14/Schema.mjs';
import {SKIN_DEFAULTS} from '../full/ui/skin/CommonSkinLayer.mjs';
export const VERSION='ET15-R1';
export const STAGES=['child','teen','young','adult','middle','senior'];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),round=v=>Number(v.toFixed(5));
const rows=new Map(NATIVE_FEATURES.map(r=>[r.id,r]));
// Deliberately not derived from gender, ancestry, weight, or an inferred disease.
// These are authored appearance histories, not diagnoses or biological predictions.
const complexion=[.40,.74,.58,.83,.30,.65,.50,.78,.69];
const iris=['#674833','#826342','#58624a','#6c5941','#485b66','#534433','#746443'];
const histories=['细腻哑光','鼻颊雀斑','润泽轻痘印','干燥细纹','淡旧伤痕','自然粗肤'];
const shapeRows=[[-.13,.12,-.12,-.10,.19,-.18],[-.22,-.16,.22,-.22,-.12,.20],[.12,-.05,.15,.16,.16,-.06],[-.06,.16,-.17,.20,-.04,-.16],[.21,.11,-.08,.11,.23,.13],[.02,-.14,.24,-.08,-.20,.06]];
function seedFor(id){let h=2166136261;for(const ch of id)h=Math.imul(h^ch.charCodeAt(0),16777619);return (h>>>0)%2147483647;}
export function createProfile(id,defaults){
 const p=PRESETS.find(p=>p.id===id);if(!p)throw Error('Unknown ET15 native profile '+id);
 const index=PRESETS.indexOf(p),stage=STAGES.indexOf(p.stage),slot=index%6,seed=seedFor(id),rng=seededRandom(seed),r=()=>rng()*2-1;
 const state=createPresetState(id,defaults),baseState=structuredClone(state),gain=p.stage==='child'?.34:p.stage==='teen'?.68:1;
 const [eye,tilt,nose,noseWidth,lip,ear]=shapeRows[(slot+stage*2)%6];
 const assignments={
  'eye-scale-incr':eye*.45+r()*.065,'eye-height1-incr':eye*.38+r()*.055,
  'eye-height2-incr':eye+r()*.045,'eye-height3-incr':eye*.60-tilt*.20,
  'eye-corner1-up':tilt*.60,'eye-corner2-up':r()*.035,'eye-trans-out':r()*.11,
  'eye-eyefold-up':r()*.09,'eye-eyefold-angle-up':tilt*.35,
  'nose-scale-depth-incr':nose+r()*.07,'nose-scale-horiz-incr':noseWidth+r()*.07,
  'nose-point-width-incr':noseWidth*.65+r()*.08,'nose-scale-vert-incr':r()*.12,
  'nose-point-up':r()*.10,'nose-hump-incr':Math.max(0,nose)*.45,
  'mouth-scale-horiz-incr':lip*.65+r()*.08,'mouth-upperlip-volume-incr':lip+r()*.08,
  'mouth-lowerlip-volume-incr':lip*.68+r()*.06,'mouth-cupidsbow-incr':r()*.16,
  'mouth-angles-up':r()*.045,'eyebrows-trans-forward':r()*.13,
  'eyebrows-angle-up':tilt*.4,'ear-scale-incr':ear*.6,'ear-lobe-incr':ear,
  'ear-rot-forward':r()*.12
 };
 for(const [key,value] of Object.entries(assignments)){
  const row=rows.get(key);if(!row)throw Error('Unmapped native profile field '+key);
  const asymmetry=row.paired?r()*.012*gain:0;
  row.keys.forEach((k,j)=>state.anny.localChanges[k]=round(clamp(value*gain+(j?asymmetry:-asymmetry),-.34,.34)));
 }
 const history=(slot+stage*3)%6,maturity=[0,0,.015,.10,.38,.68][stage];
 const traits={...TRAIT_DEFAULTS,seed,freckleSize:.30+rng()*.50,freckleContrast:.3+rng()*.3,freckleSpread:.45+rng()*.4,
  wrinkleDepth:.13+stage*.022,wrinkleWidth:.65+rng()*.28,wrinkleIrregularity:.88,
  forehead:maturity*(.45+rng()*.50),frown:maturity*(.2+rng()*.45),crowsFeet:maturity*(.55+rng()*.45),
  underEye:maturity*.45,nasolabial:maturity*.55,lipLines:maturity*.2,
  darkCircles:stage<2?0:.04+rng()*.12,ageSpots:stage<4?0:(stage-3)*(.045+rng()*.10),
  ageSpotSize:1.1+rng()*1.25,redPatches:stage<1?0:.02+rng()*.06};
 if(history===1){traits.freckles=.18+rng()*.3;traits.freckleContrast=.44+rng()*.16;}
 if(history===2&&stage>0&&stage<4){traits.acne=.08+rng()*.12;traits.acneMarks=.10+rng()*.14;traits.acneSize=.55+rng()*.45;traits.acneRelief=.09;traits.acneWhiteheads=.10;traits.acneRedness=.40;}
 if(history===4&&stage>1){Object.assign(traits,{scar:.46,scarX:(rng()>.5?1:-1)*(28+rng()*16),scarY:263+rng()*18,scarLength:9+rng()*12,scarAngle:-35+rng()*70,scarWidth:.6+rng()*.6,scarRelief:-.08,scarAge:.85});}
 if(history===5&&stage>1){traits.moles=.42;traits.moleX:-1;traits.moleX=-35+rng()*70;traits.moleY=248+rng()*30;traits.moleSize=.48+rng()*.38;traits.pittedScars=stage<4?.06:.02;}
 if(stage===0){traits.acne=traits.acneMarks=traits.scar=traits.pittedScars=traits.moles=0;}
 const surfaceType=['fine','balanced','oily','dry','balanced','weathered'][history];
 const cinema={...CINEMA,...SURFACES[surfaceType].values,enabled:true,foldRelief:stage<3?.65:.9,foldSpread:1.45,compression:0};
 if(stage===0)Object.assign(cinema,{poreDepth:.68,grain:.10,scanMicro:.75,oilFilm:.15});
 const skin={...SKIN_DEFAULTS,tone:complexion[(index*5+stage)%complexion.length],warmth:.36+rng()*.3,roughness:history===3?.69:history===2?.55:.62,
  oil:history===2?.32:.14,redness:.19+rng()*.15,variation:.28,detail:.70,
  lipColor:['#8a5350','#90584f','#a96c62','#7a4d48'][index%4],lipMix:.42};
 const shape={...SHAPE_DEFAULTS,bridgeMM:round(nose*gain*1.2),crease:round((rng()*1.1-.45)*gain),creaseHeightMM:3+rng()*.85,creaseWidthMM:1.05};
 return {id,label:p.label,stage:p.stage,stageLabel:p.stageLabel,seed,history:histories[history],baseState,state,
  traits:validateTraits(traits),shape:validateShape(shape),skin,cinema,
  optics:{enabled:true,irisColor:iris[(index*3+stage)%iris.length],irisSize:.96+rng()*.10,pupil:.32+rng()*.12,limbal:.42+rng()*.3,sclera:.44+rng()*.08,vessels:.10+rng()*.13,wetness:.78,contactShadow:.46,fiber:.65},
  calibration:{chronologicalAge:null,skinMeasurement:null,filmQualityAccepted:false},nativeFaceFields:Object.keys(assignments)};
}
export const PROFILE_INDEX=PRESETS.map(p=>({id:p.id,label:p.label,stage:p.stage,stageLabel:p.stageLabel}));
export function createLibrary(defaults){return PROFILE_INDEX.map(p=>createProfile(p.id,defaults));}
