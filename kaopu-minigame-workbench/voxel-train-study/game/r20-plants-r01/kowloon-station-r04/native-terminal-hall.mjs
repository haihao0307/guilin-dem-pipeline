// Complete semantic R02 hall/road-portico recipe. Authoring parameters only.
// Source shape parity is separate from explicitly corrected current construction.
// Source local (v,y,u) -> current (-u,y,v), a proper signed rotation.
// No geometry, material mother, renderer or live station module is imported.
import { sourceBeamBasis } from './native-station-lamps.mjs';
export const HALL_SOURCE_COMMIT='f31df978916876205355664593b0299f027188ad';
export const HALL_SOURCE_HASH='6e4ef63eecb24237bdaf8c90d22996d61ed68cd99b689355fb147f5983f7cac6';
export const HALL_MATERIAL_ENVELOPE=.03001;
export function sourceTerminalHall(){
 const parts=[],anchors=[],clockHands=[],s={platform:{top:1.1}},stone='#c8b990',brick='#8b5b46',ivory='#e3d6b0';
 const emit=(id,shape,role,feature,color)=>{parts.push({id,shape,surface:{role,feature,color,component:id,metricFrame:{origin:shape.center||shape.a||[0,0,0]},ageYears:35,rainExposure:feature.includes('cornice')?.7:.35,wetness:.10,repairFraction:.2}});};
 const box=(id,c,d,role='masonry-trim',feature='cut-stone-course',color)=>emit(id,{type:'box',center:c,size:d},role,feature,color);
 const beam=(id,a,b,w,d,role='masonry-trim',feature='linear-moulding')=>emit(id,{type:'beam',a,b,width:w,depth:d},role,feature);
 const cylinder=(id,c,r,h,role='masonry-trim',rt=r,seg=32)=>emit(id,{type:'cylinder',center:c,radius:r,radiusTop:rt,height:h,segments:seg},role,'turned-profile');
 const sphere=(id,c,r,scale,role)=>emit(id,{type:'sphere',center:c,radius:r,scale,segments:24},role,'dome-profile');
 function arch(id,c,r,w,d,axis='x',role='masonry-trim'){emit(id,{type:'arch-band',center:c,radius:r,width:w,depth:d,axis},role,'voussoir-arch');}
 function column(id,x,z,bottom,height,r=.41){
  box(id+'-plinth',[x,bottom+.14,z],[r*2.55,.28,r*2.55]);cylinder(id+'-base',[x,bottom+.35,z],r*1.2,.16);
  emit(id+'-shaft',{type:'fluted-column',center:[x,bottom+.47+height/2,z],radius:r,height,flutes:20,depth:.022,segments:80},'masonry-trim','fluted-stone-column');
  cylinder(id+'-neck',[x,bottom+height+.53,z],r*1.12,.15);cylinder(id+'-capital',[x,bottom+height+.72,z],r*1.1,.24,'masonry-trim',r*1.4);
  box(id+'-abacus',[x,bottom+height+.91,z],[r*3,.16,r*3]);
 }
 const hall={min:[12,0,-25.85],max:[28,17.4,32.25]},x0=hall.min[0],x1=hall.max[0],z0=hall.min[2],z1=hall.max[2],xc=(x0+x1)/2,zc=(z0+z1)/2,hallY=s.platform.top;
 // The real concourse is an unobstructed hall behind the train-buffer line.
 box('terminal-cross-concourse',[(10+x0)/2,hallY/2,zc],[x0-10,hallY,z1-z0],'platform-stone','cross-platform-terminal-apron');
 box('concourse-foundation',[xc,hallY/2,zc],[x1-x0,hallY,z1-z0],'platform-stone','ground-bearing-floor');
 for(let z=z0+.8;z<z1;z+=2.1)box('hall-floor-joint-'+z.toFixed(1),[xc,hallY+.009,z],[x1-x0-.6,.012,.018],'masonry-joint','floor-expansion-joint');
 const bays=8,step=(z1-z0)/bays;
 for(const [side,x]of [['sea',x1],['rail',x0]]){
  for(let i=0;i<=bays;i++){
   const z=z0+i*step;box(side+'-wall-pier-'+i,[x,5.65,z],[.70,9.10,1.25],'hall-brick','sheltered-masonry-pier');
   for(const dz of [-.51,.51])box(side+'-stone-edge-'+i+'-'+dz,[x+(side==='sea'?.40:-.40),5.65,z+dz],[.16,9.25,.18]);
   box(side+'-pier-base-'+i,[x,1.53,z],[1.12,.74,1.5]);box(side+'-pier-cap-'+i,[x,10.18,z],[1.1,.28,1.58]);
  }
  for(let i=0;i<bays;i++){
   const z=z0+(i+.5)*step,r=(step-1.1)/2,ay=6.35;
   arch(side+'-arch-'+i,[x,ay,z],r,.30,.77,'x');
   box(side+'-spandrel-'+i,[x,10.31,z],[.68,1.32,step-1.1],'hall-brick','sheltered-spandrel');
   // Iron framed upper fanlight, actual open lower door rather than a black quad.
   if(side==='sea'){
    for(let q=-2;q<=2;q++)beam(side+'-fanlight-bar-'+i+'-'+q,[x+.08,ay,z+q*.72],[x+.08,ay+Math.sqrt(Math.max(0,(r-.17)**2-(q*.72)**2)),z+q*.72],.026,.033,'structural-iron','fanlight-glazing-bar');
    beam(side+'-transom-'+i,[x+.08,ay,z-r+.16],[x+.08,ay,z+r-.16],.065,.055,'structural-iron');
    if(i!==3&&i!==4){box(side+'-lower-sill-'+i,[x,3.15,z],[.78,.22,step-1.15]);box(side+'-lower-wall-'+i,[x,2.13,z],[.65,1.85,step-1.15],'hall-brick','wall-below-window');}
   }
  }
  for(const[y,t,over]of [[10.96,.25,.40],[11.32,.22,.62],[11.58,.14,.78]])box(side+'-cornice-'+y,[x,y,zc],[.74+over,t,z1-z0+1.25]);
 }
 // Tall roof silhouette stays subordinate to the independent clock tower.
 emit('hall-roof-west',{type:'roof-panel',corners:[[x0-.65,11.8,z0-.55],[xc,14.1,z0-.55],[xc,14.1,z1+.55],[x0-.65,11.8,z1+.55]],thickness:.13},'roof-metal','slate-roof');
 emit('hall-roof-east',{type:'roof-panel',corners:[[xc,14.1,z0-.55],[x1+.65,11.8,z0-.55],[x1+.65,11.8,z1+.55],[xc,14.1,z1+.55]],thickness:.13},'roof-metal','slate-roof');
 beam('hall-roof-ridge',[xc,14.14,z0-.6],[xc,14.14,z1+.6],.16,.21,'roof-metal');
 // Roadside entrance portico. The pediment is geometry with a real oculus.
 const front=z1+.9;
 for(let i=0;i<4;i++)column('portico-'+i,x0+1.55+i*(x1-x0-3.1)/3,front,hallY,7.9,.44);
 for(const[y,t,w]of [[10.18,.50,16.9],[10.55,.20,17.25],[10.84,.17,17.55]])box('portico-entablature-'+y,[xc,y,front],[w,t,1.46]);
 emit('road-pediment',{type:'triangle-prism',center:[xc,10.98,front],width:17.6,rise:4.0,depth:.68,axis:'z'},'hall-brick','pediment-field');
 for(const sign of [-1,1])beam('pediment-rake-'+sign,[xc,15.02,front+.40],[xc+sign*9,10.98,front+.40],.27,.38);
 emit('pediment-oculus-ring',{type:'ring',center:[xc,12.55,front+.46],radius:.72,tube:.12,segments:40,axis:'z'},'masonry-trim','circular-window-arch');
 emit('pediment-oculus',{type:'disc',center:[xc,12.55,front+.47],radius:.58,axis:'z'},'window-glass','oculus-glazing');
 for(const sign of [-1,1]){box('entrance-return-'+sign,[xc+sign*7.3,5.55,z1],[1.55,8.9,1.0],'hall-brick','portico-return');for(let y=1.5;y<10;y+=.62)box('return-band-'+sign+'-'+y,[xc+sign*7.32,y,z1+.54],[1.62,.10,.14]);}
 for(let i=0;i<4;i++)box('hall-entry-step-'+i,[xc,hallY-(i+.5)*.22,front+1.45+i*.37],[15.8,.22,.42],'platform-stone','entrance-stair');
 anchors.push({id:'hall-title',text:'九龍  KOWLOON',at:[xc,10.22,front+.77],axis:'z',height:.47});
 // Low pierced parapets: repeated openings are formed by posts, never dark paint.
 for(const x of [x0-.15,x1+.15])for(let z=z0;z<z1;z+=1.25){box('parapet-post-'+x+'-'+z,[x,12.35,z],[.36,1.1,.22]);for(const y of [11.88,12.89])box('parapet-rail-'+x+'-'+z+'-'+y,[x,y,z+.60],[.42,.14,1.34]);}
 return {parts,anchors};
}
const clone=x=>JSON.parse(JSON.stringify(x));
const add=(a,b)=>a.map((x,i)=>x+b[i]),sub=(a,b)=>a.map((x,i)=>x-b[i]),mul=(a,n)=>a.map(x=>x*n),dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const SRC={length:58.1,depth:16,deck:1.1,eave:11.8,center:[20,0,(-25.85+32.25)/2]};
export const HALL_FAMILIES=[
 ['concourse-apron',/^terminal-cross-concourse$/],['hall-floor',/^concourse-foundation$/],['hall-floor-joint',/^hall-floor-joint-/],
 ['hall-wall-pier',/^(sea|rail)-wall-pier-/],['hall-stone-edge',/^(sea|rail)-stone-edge-/],['hall-pier-base',/^(sea|rail)-pier-base-/],['hall-pier-cap',/^(sea|rail)-pier-cap-/],
 ['hall-arch',/^(sea|rail)-arch-/],['hall-spandrel',/^(sea|rail)-spandrel-/],['hall-fanlight-bar',/^sea-fanlight-bar-/],['hall-transom',/^sea-transom-/],['hall-lower-sill',/^sea-lower-sill-/],['hall-lower-wall',/^sea-lower-wall-/],
 ['hall-cornice',/^(sea|rail)-cornice-/],['hall-roof',/^hall-roof-(west|east)$/],['hall-ridge',/^hall-roof-ridge$/],['portico-column',/^portico-\d+-/],['portico-entablature',/^portico-entablature-/],['pediment',/^road-pediment$/],['pediment-rake',/^pediment-rake-/],['oculus-ring',/^pediment-oculus-ring$/],['oculus-glass',/^pediment-oculus$/],['entrance-returns',/^(entrance-return-|return-band-)/],['entrance-stairs',/^hall-entry-step-/],['pierced-parapet',/^parapet-/],
];
export function terminalHallPlan(options={}){
 const mode=options.mode??'current';if(!['current','source'].includes(mode))throw Error('Invalid hall mode');
 const p=mode==='source'?{mode,width:SRC.length,depth:16,deck:1.1,eave:11.8,bays:8}:{mode,width:options.width??60,depth:options.depth??16,deck:options.deck??.85,eave:options.eave??12,bays:options.bays??8};
 if(!Object.values(p).filter(x=>typeof x==='number').every(Number.isFinite)||p.width<58.1||p.width>80||p.depth!==16||p.bays!==8||p.deck<.66||p.deck>1.5||p.eave<11.8||p.eave>14)throw Error('Unsupported hall datums or source profile');
 p.bay=p.width/p.bays;p.ridge=p.eave+2.3;p.lowerShift=p.deck-SRC.deck;p.upperShift=p.eave-SRC.eave;p.heightExtension=p.upperShift-p.lowerShift;p.porticoFront=p.width/2+.9;p.apronLength=options.apronLength??p.width+6.8;
 p.jointCount=Math.ceil((p.width-.8)/2.1);p.parapetCount=Math.ceil(p.width/1.25);p.approachEnd=options.approachEnd??43;
 if(p.apronLength<p.width||p.approachEnd<p.width/2+3.67)throw Error('Hall circulation envelope would omit a connection');
 return p;
}
export const hallToStation=p=>[-p[2],p[1],p[0]];
export const stationToHall=p=>[p[2],p[1],-p[0]];
function family(p){const a=HALL_FAMILIES.filter(([,re])=>re.test(p.id));if(a.length!==1)throw Error('Unbound hall source child '+p.id);return a[0][0];}
function ySpan(shape,lowerShift,upperShift){const lo=shape.center[1]-shape.size[1]/2+lowerShift,hi=shape.center[1]+shape.size[1]/2+upperShift;shape.center[1]=(lo+hi)/2;shape.size[1]=hi-lo;}
function localized(shape){const s=clone(shape);for(const k of['center','a','b'])if(s[k])s[k]=sub(s[k],SRC.center);if(s.corners)s.corners=s.corners.map(p=>sub(p,SRC.center));return s;}
function adaptedShape(part,p,counters){
 const s=localized(part.shape),f=part.sourceFamily,id=part.id,L=p.width,E=p.upperShift,B=p.lowerShift,step=p.bay;
 const upper=()=>{for(const k of['center','a','b'])if(s[k])s[k][1]+=E;};
 const bayCenter=i=>-L/2+(i+.5)*step;
 if(f==='hall-floor'){s.center=[0,p.deck-.7,0];s.size=[17.6,1.4,L+2.4];s.cutFloorJoints=true;}
 else if(f==='concourse-apron'){s.center=[-9,p.deck/2,0];s.size=[2,p.deck,p.apronLength];}
 else if(f==='hall-floor-joint'){const j=counters.joint++;s.center=[0,p.deck-.006,-L/2+.8+j*2.1];}
 else if(['hall-wall-pier','hall-stone-edge','hall-pier-base','hall-pier-cap'].includes(f)){
  const match=id.match(/-(\d+)(?:-(-?0\.51))?$/),i=Number(match[1]);s.center[2]=-L/2+i*step+(f==='hall-stone-edge'?Number(match[2]):0);
  if(f==='hall-wall-pier'||f==='hall-stone-edge')ySpan(s,B,E);else s.center[1]+=f==='hall-pier-base'?B:E;
 }
 else if(['hall-arch','hall-spandrel','hall-lower-wall','hall-lower-sill'].includes(f)){
  const i=Number(id.split('-').at(-1));s.center[2]=bayCenter(i);
  if(f==='hall-arch'){s.radius=(step-1.1)/2;upper();}
  else if(f==='hall-spandrel'){s.size[2]=step-1.1;upper();}
  else{s.center[1]+=B;s.size[2]=step-1.15;if(f==='hall-lower-wall'){const hi=s.center[1]+s.size[1]/2;s.center[1]=(hi+p.deck)/2;s.size[1]=hi-p.deck;}}
 }
 else if(f==='hall-fanlight-bar'){
  const match=id.match(/bar-(\d+)-(-?\d+)$/),i=Number(match[1]),q=Number(match[2]),r=(step-1.1)/2;
  s.a=[8.08,6.35+E,bayCenter(i)+q*.72];s.b=[8.08,6.35+E+Math.sqrt(Math.max(0,(r-.17)**2-(q*.72)**2)),s.a[2]];
 }
 else if(f==='hall-transom'){const i=Number(id.split('-').at(-1)),r=(step-1.1)/2;s.a=[8.08,6.35+E,bayCenter(i)-r+.16];s.b=[8.08,6.35+E,bayCenter(i)+r-.16];}
 else if(f==='hall-cornice'){s.size[2]=L+1.25;upper();}
 else if(f==='hall-roof'){s.corners=s.corners.map(q=>[q[0],q[1]+E,Math.sign(q[2])*(L/2+.55)]);}
 else if(f==='hall-ridge'){s.a[2]=-L/2-.6;s.b[2]=L/2+.6;upper();}
 else if(f==='portico-column'){
  s.center[2]=p.porticoFront;
  if(id.endsWith('-shaft')){s.center[1]+=(B+E)/2;s.height+=p.heightExtension;}
  else s.center[1]+=/-plinth$|-base$/.test(id)?B:E;
 }
 else if(['portico-entablature','pediment','oculus-ring','oculus-glass'].includes(f)){
  s.center[2]+=((L-SRC.length)/2);upper();if(f==='pediment')s.oculus={center:[0,12.55+E,p.porticoFront],radius:.64};
  if(f==='oculus-glass')s.thickness=.012;
 }
 else if(f==='pediment-rake'){s.a[2]+=(L-SRC.length)/2;s.b[2]+=(L-SRC.length)/2;upper();}
 else if(f==='entrance-returns'){
  s.center[2]+=(L-SRC.length)/2;
  if(id.startsWith('entrance-return-'))ySpan(s,B,E);
  else{const t=(s.center[1]-1.1)/8.9;s.center[1]+=B+t*(E-B);}
 }
 else if(f==='entrance-stairs'){s.center[2]+=(L-SRC.length)/2;s.center[1]+=B;}
 else if(f==='pierced-parapet'){
  const side=s.center[0]<0?'rail':'sea',j=counters.parapet[side]++;const cell=Math.floor(j/3),rail=id.startsWith('parapet-rail');s.center[2]=-L/2+cell*1.25+(rail?.60:0);upper();
 }
 else throw Error('Missing hall adaptation '+f);
 return s;
}
export const HALL_CONSTRUCTION_DECISIONS=Object.freeze([
 {id:'layout-short-end-portico',kind:'restoration',reason:'Four dedicated six-profile columns and the original portico assembly face the road at current −X. No long-façade proxy, added keystones, generic colonnade or solid entrance end wall.'},
 {id:'two-datum-adaptation',kind:'design-change',reason:'Retained 60×16 footprint, deck 0.85, eave 12 and ridge 14.3; lower and upper anchors shift independently. Connecting shafts/returns/piers lengthen 0.45 m without scaling moulding sections.'},
 {id:'material-trim-composite',kind:'material-adaptation',reason:'Source masonry-trim is paint, not physical stone. Current trim explicitly uses the existing mineral-core/finite-plaster composite ID 13; platform-stone stairs use mature stone ID 2, current ordinary floors use KST concrete ID 17.'},
 {id:'roof-metal-not-slate',kind:'preservation',reason:'The source feature slate-roof has roof-metal role. Keep finite metal panels and the current charcoal paint binding; never claim a slate mother.'},
 {id:'repeat-extensions',kind:'design-change',reason:'Keep 2.1 m floor-joint and 1.25 m parapet pitch: current 29 joints and 48 parapet cells per side. Seven extra children have new IDs, never replacements for source IDs.'},
 {id:'inset-floor-joints',kind:'constructive-correction',reason:'Source strips float 3 mm over the slab. Cut finite 18×12 mm slots in the host concrete and fit actual iron-role filler flush to the deck.'},
 {id:'oculus-aperture-and-rebate',kind:'constructive-correction',reason:'Cut a true 0.64 m-radius masonry aperture and add a finite plain mineral rebate with 0.58 m clear radius. Preserve source torus profiles; the source solid triangle had no aperture.'},
 {id:'oculus-glass-optics',kind:'unresolved',reason:'Keep the exact source glass ID and reserve a finite 12 mm pane descriptor. Do not render it as opaque enamel or claim transmission until a proper glass transport/material path is integrated.'},
 {id:'column-bearing-bedding',kind:'constructive-correction',reason:'A plain 44 mm bedding transition overlaps the source base/shaft by 2 mm to close their literal 40 mm bearing gap; six original column profiles remain separate.'},
 {id:'course-backing',kind:'constructive-correction',reason:'Plain concealed backing connects spaced cornice and entablature courses, returns, roof and parapet without inventing decorative tiers.'},
 {id:'lower-window-closure',kind:'constructive-correction',reason:'Extend only the six public lower walls down by 105 mm to meet the common deck; source bays 3/4 and all eight rail bays remain doors.'},
 {id:'short-end-circulation',kind:'constructive-correction',reason:'Add a ground-bearing portico landing, stair substructure and a plain concrete approach to the retained road edge. The named rail apron spans all four 6.8 m-wide island mouths; retain the separate +Z forecourt/quay route during integration.'},
 {id:'road-approach-bearing-and-levels',kind:'constructive-correction',reason:'The entrance approach is raised to the sidewalk top 0.15 m and grounded to −0.30 m. Its end stops at the sidewalk edge, leaving a real 0.60 m curb tread at −0.035 m between the sidewalk 0.15 m and road −0.22 m: two 0.185 m risers. The outer source stair remains at 0.19 m with an explicit 0.04 m threshold. This stepped route is not claimed accessible.'},
 {id:'roof-pediment-lap',kind:'constructive-correction',reason:'Two plain 40 mm-deep metal laps retain the roof pitch/130 mm section and bridge the source 10 mm horizontal gap between roof ends and the pediment back.'},
 {id:'title-outline-dependency',kind:'unresolved',reason:'Restore the exact title anchor in the short-end assembly. Existing licensed native outlines must be bound by the host; no raster sign texture is supplied.'},
]);
function extras(parts,p){
 const put=(id,shape,role,feature,decision)=>parts.push({id,sourceId:null,sourceFamily:'current-addition',shape,surface:{role,feature,component:id,metricFrame:{origin:shape.center||shape.a},ageYears:35,rainExposure:.35,wetness:.10,repairFraction:.2},adaptation:decision,status:'explicit-addition'});
 const box=(id,c,s,role,why)=>put(id,{type:'box',center:c,size:s},role,'plain-construction-backing',why);
 for(let j=28;j<p.jointCount;j++)box('current-hall-floor-joint-'+j,[0,p.deck-.006,-p.width/2+.8+j*2.1],[15.4,.012,.018],'masonry-joint','repeat-extensions');
 for(const side of[-1,1])for(let j=47;j<p.parapetCount;j++){
  const u=-p.width/2+j*1.25;box('current-parapet-post-'+side+'-'+j,[side*8.15,12.35+p.upperShift,u],[.36,1.1,.22],'masonry-trim','repeat-extensions');
  for(const y of[11.88,12.89])box('current-parapet-rail-'+side+'-'+j+'-'+y,[side*8.15,y+p.upperShift,u+.6],[.42,.14,1.34],'masonry-trim','repeat-extensions');
 }
 for(let i=0;i<4;i++)put('current-portico-bearing-'+i,{type:'cylinder',center:[-6.45+i*4.3,p.deck+.45,p.porticoFront],radius:.44,radiusTop:.44,height:.044,segments:32},'masonry-trim','plain-bearing-bedding','column-bearing-bedding');
 for(const side of[-1,1])box('current-cornice-backing-'+side,[side*8,(10.835+11.815)/2+p.upperShift,0],[.68,.98,p.width+1.25],'hall-brick','course-backing');
 box('current-entablature-backing',[0,(9.93+10.98)/2+p.upperShift,p.porticoFront],[16.6,1.05,1.10],'hall-brick','course-backing');
 put('current-oculus-rebate',{type:'annulus',center:[0,12.55+p.upperShift,p.porticoFront+.28],innerRadius:.58,outerRadius:.67,depth:.42,axis:'z'},'platform-stone','plain-window-rebate','oculus-aperture-and-rebate');
 for(const side of[-1,1]){const x0=side<0?-8.65:0,x1=side<0?0:8.65,y0=side<0?p.eave:p.ridge,y1=side<0?p.ridge:p.eave;put('current-roof-pediment-lap-'+side,{type:'roof-panel',corners:[[x0,y0,p.width/2+.54],[x1,y1,p.width/2+.54],[x1,y1,p.width/2+.58],[x0,y0,p.width/2+.58]],thickness:.13},'roof-metal','plain-concealed-roof-lap','roof-pediment-lap');}
 const landingStart=p.width/2+.4,landingEnd=p.width/2+2.35;
 box('current-portico-landing',[0,p.deck-.7,(landingStart+landingEnd)/2],[16,1.4,landingEnd-landingStart],'platform-concrete','short-end-circulation');
 // Solid stair bedding makes every source tread ground-bearing while retaining
 // its original top/profile/run. The bedding reaches 1 mm into each tread.
 for(let i=0;i<4;i++){const bottom=Math.min(-.3,p.deck-1.1),top=p.deck-(i+1)*.22+.001;box('current-entry-step-bedding-'+i,[0,(bottom+top)/2,p.porticoFront+1.45+i*.37],[15.8,top-bottom,.42],'platform-concrete','short-end-circulation');}
 const approachStart=p.width/2+3.64;
 box('current-portico-approach',[0,-.075,(approachStart+p.approachEnd)/2],[15.8,.45,p.approachEnd-approachStart],'platform-concrete','road-approach-bearing-and-levels');
 // The 20 mm overlap is buried below the sidewalk; 0.60 m of real tread
 // remains exposed toward the road. Base reaches below the land at −0.28 m.
 box('current-portico-road-curb-step',[0,(-.035-.34)/2,p.approachEnd+.29],[15.8,.305,.62],'platform-concrete','road-approach-bearing-and-levels');
}
function binding(p,mode){
 const role=p.surface.role;
 if(role==='window-glass')return{id:0,seed:191,physicalRole:'reserved-glass-optics',deferred:true};
 if(role==='hall-brick')return{id:/road-pediment|entrance-return-|entablature-backing/.test(p.id)?12:1,seed:191,physicalRole:'original-brick-and-mortar'};
 if(role==='masonry-trim')return{id:mode==='current'?13:7,seed:191,physicalRole:mode==='current'?'explicit-mineral-core-finite-plaster':'source-paint-role'};
 if(role==='platform-stone')return{id:mode==='current'&&['hall-floor','concourse-apron'].includes(p.sourceFamily)?17:2,seed:191,physicalRole:mode==='current'&&['hall-floor','concourse-apron'].includes(p.sourceFamily)?'current-KST-concrete':'mature-stone'};
 if(role==='platform-concrete')return{id:17,seed:191,physicalRole:'current-KST-concrete'};
 if(role==='roof-metal')return{id:3,seed:8,physicalRole:'roof-metal-with-finite-charcoal-paint'};
 if(role==='structural-iron'||role==='masonry-joint')return{id:3,seed:191,physicalRole:'source-iron'};
 throw Error('Unbound physical hall role '+role);
}
export function terminalHallIsFloorMember(m){return ['hall-floor','concourse-apron','hall-floor-joint','entrance-stairs'].includes(m.sourceFamily)||/^current-hall-floor-joint-|^current-portico-landing$|^current-entry-step-bedding-|^current-portico-approach$|^current-portico-road-curb-step$/.test(m.id);}
export function terminalHallMembers(options={}){
 const plan=terminalHallPlan(options),raw=sourceTerminalHall(),parts=raw.parts.map(p=>({...p,sourceId:p.id,sourceFamily:family(p)}));
 if(plan.mode==='current'){
  const counters={joint:0,parapet:{sea:0,rail:0}};
  for(const p of parts){p.sourceShape=clone(p.shape);p.sourceSurface=clone(p.surface);p.shape=adaptedShape(p,plan,counters);p.adaptation=p.sourceFamily==='oculus-glass'?'oculus-glass-optics':'two-datum-adaptation';p.adaptations=[p.adaptation];if(p.surface.role==='masonry-trim')p.adaptations.push('material-trim-composite');if(p.surface.role==='roof-metal')p.adaptations.push('roof-metal-not-slate');if(['hall-floor','hall-floor-joint'].includes(p.sourceFamily))p.adaptations.push('inset-floor-joints');if(p.sourceFamily==='hall-lower-wall')p.adaptations.push('lower-window-closure');if(p.sourceFamily==='pediment')p.adaptations.push('oculus-aperture-and-rebate');if(['portico-column','portico-entablature','pediment','pediment-rake','oculus-ring','oculus-glass','entrance-returns','entrance-stairs'].includes(p.sourceFamily))p.adaptations.push('layout-short-end-portico');if(['hall-floor','concourse-apron','entrance-stairs'].includes(p.sourceFamily))p.adaptations.push('short-end-circulation');p.status=p.sourceFamily==='oculus-glass'?'optics-unresolved':'restored-with-recorded-adaptation';}
  extras(parts,plan);
 }
 else for(const p of parts){p.sourceShape=clone(p.shape);p.status='exact-source-descriptor';}
 for(const [i,p] of parts.entries()){p.member=i;p.targetId=p.id;p.adaptations??=[p.adaptation??'exact-source-descriptor'];p.isFloor=terminalHallIsFloorMember(p);p.binding=binding(p,plan.mode);p.constructionShape=plan.mode==='source'?localized(p.shape):p.shape;Object.assign(p,frameRecord(p.constructionShape));p.materialFrame={origin:p.center.slice(),axes:p.frame.map(a=>a.slice()),halfExtents:p.extent.slice()};if(plan.mode==='current')p.surface.metricFrame=clone(p.materialFrame);}
 const anchor=clone(raw.anchors[0]);if(plan.mode==='current'){anchor.at=hallToStation([0,10.22+plan.upperShift,plan.porticoFront+.77]);anchor.axis='x';anchor.normal=[-1,0,0];anchor.status='native-outline-binding-required';}
 return{plan,parts,anchors:[anchor],decisions:plan.mode==='current'?HALL_CONSTRUCTION_DECISIONS:[],sourceCount:parts.filter(p=>p.sourceId).length};
}
export function terminalHallContinuity(options={}){return terminalHallMembers(options).parts.map(m=>({sourceId:m.sourceId,targetId:m.targetId,sourceFamily:m.sourceFamily,status:m.status,adaptations:m.adaptations,sourceRole:m.surface.role,physicalRole:m.binding.physicalRole,materialId:m.binding.id,opticalDependency:!!m.binding.deferred}));}
function frameRecord(s){
 let center=s.center,sourceFrame=[[1,0,0],[0,1,0],[0,0,1]],extent,kind=s.type,params={};
 if(s.type==='beam'){center=mul(add(s.a,s.b),.5);sourceFrame=sourceBeamBasis(sub(s.b,s.a));extent=[s.width/2,Math.hypot(...sub(s.b,s.a))/2,s.depth/2];kind='box';}
 else if(s.type==='box'){extent=s.size.map(x=>x/2);params.cutFloorJoints=!!s.cutFloorJoints;}
 else if(['cylinder','fluted-column'].includes(s.type)){const r=Math.max(s.radius,s.radiusTop??s.radius);extent=[r,s.height/2,r];params={r0:s.radius,r1:s.radiusTop??s.radius,height:s.height,flutes:s.flutes??0,depth:s.depth??0};kind=s.type==='cylinder'?'cone':'flute';}
 else if(s.type==='roof-panel'){
  const lo=[0,1,2].map(k=>Math.min(...s.corners.map(p=>p[k]))-(k===1?s.thickness:0)),hi=[0,1,2].map(k=>Math.max(...s.corners.map(p=>p[k])));center=mul(add(lo,hi),.5);extent=mul(sub(hi,lo),.5);
  params={slope:(s.corners[1][1]-s.corners[0][1])/(s.corners[1][0]-s.corners[0][0]),thickness:s.thickness};kind='roof';
 }
 else{
  if(s.axis==='x')sourceFrame=[[0,0,-1],[0,1,0],[1,0,0]];
  if(s.type==='arch-band'){extent=[s.radius+s.width,s.radius+s.width,s.depth/2];params={radius:s.radius,width:s.width,depth:s.depth};kind='arch';}
  else if(s.type==='triangle-prism'){center=add(s.center,[0,s.rise/2,0]);extent=[s.width/2,s.rise/2,s.depth/2];params={width:s.width,rise:s.rise,depth:s.depth,oculus:s.oculus??null};kind='triangle';}
  else if(s.type==='ring'){extent=[s.radius+s.tube,s.radius+s.tube,s.tube];params={radius:s.radius,tube:s.tube};}
  else if(s.type==='disc'){extent=[s.radius,s.radius,(s.thickness??0)/2];params={radius:s.radius,thickness:s.thickness??0};}
  else if(s.type==='annulus'){extent=[s.outerRadius,s.outerRadius,s.depth/2];params={inner:s.innerRadius,outer:s.outerRadius,depth:s.depth};}
  else throw Error('Unimplemented hall shape '+s.type);
 }
 return{center:hallToStation(center),hallCenter:center,sourceFrame,frame:sourceFrame.map(hallToStation),extent,kind,params};
}
// A material delta is applied to the analytic field, whose off-surface value
// need not be an exact Euclidean distance. Expand each primitive's level set,
// rather than assuming a 30.01 mm field delta always means 30.01 mm in XYZ.
// This matters at triangular corners, sheared roof edges and fluted shafts.
export function terminalHallMaterialPadding(m,margin=HALL_MATERIAL_ENVELOPE){
 if(!Number.isFinite(margin)||margin<0)throw Error('Invalid hall envelope');
 const a=m.params;let pad=[margin,margin,margin];
 if(m.kind==='flute'){const lip=Math.hypot(1,a.depth*a.flutes*.5/(a.r0-a.depth));pad=[margin*lip,margin,margin*lip];}
 if(m.kind==='triangle'){const k=2*a.rise/a.width,n=Math.hypot(1,k);pad=[margin*(n+1)/k,margin*n,margin];}
 if(m.kind==='roof')pad=[margin,margin*(Math.abs(a.slope)+Math.hypot(1,a.slope)),margin];
 return pad;
}
export function terminalHallMemberBounds(m,margin=0){
 const pad=terminalHallMaterialPadding(m,margin),extent=add(m.extent,pad);
 const h=[0,1,2].map(k=>m.frame.reduce((sum,a,i)=>sum+Math.abs(a[k])*extent[i],0));return{min:sub(m.center,h),max:add(m.center,h)};
}
export function terminalHallBounds(options={},margin=HALL_MATERIAL_ENVELOPE){const a=terminalHallMembers(options).parts.map(m=>terminalHallMemberBounds(m,margin));return{min:[0,1,2].map(k=>Math.min(...a.map(b=>b.min[k]))),max:[0,1,2].map(k=>Math.max(...a.map(b=>b.max[k])))};}
export function terminalHallFloorBounds(options={},margin=HALL_MATERIAL_ENVELOPE){
 const parts=terminalHallMembers(options).parts.filter(terminalHallIsFloorMember),groups=new Map();
 for(const m of parts){const key=m.sourceFamily==='concourse-apron'?'rail-apron':m.sourceFamily==='entrance-stairs'||m.id.startsWith('current-entry-step-bedding-')?'portico-stairs':m.id==='current-portico-landing'?'portico-landing':m.id==='current-portico-approach'?'road-approach':m.id==='current-portico-road-curb-step'?'road-curb-step':'hall-slab-and-inset-joints';if(!groups.has(key))groups.set(key,[]);groups.get(key).push(m);}
 return [...groups].map(([id,members])=>{const a=members.map(m=>terminalHallMemberBounds(m,margin));return{id,memberIds:members.map(m=>m.id),min:[0,1,2].map(k=>Math.min(...a.map(b=>b.min[k]))),max:[0,1,2].map(k=>Math.max(...a.map(b=>b.max[k])))};});
}
export function terminalHallMemberPoint(m,q){return m.center.map((x,k)=>x+m.frame.reduce((sum,a,i)=>sum+a[k]*q[i],0));}
const sdBox=(q,b)=>{const d=q.map((x,i)=>Math.abs(x)-b[i]);return Math.hypot(...d.map(x=>Math.max(x,0)))+Math.min(Math.max(...d),0);};
const extrusion=(a,b)=>Math.hypot(Math.max(a,0),Math.max(b,0))+Math.min(Math.max(a,b),0);
const segment2=(p,a,b)=>{const v=sub(b,a),t=clamp(dot(sub(p,a),v)/dot(v,v),0,1);return Math.hypot(...sub(sub(p,a),mul(v,t)));};
function coneDistance(q,p){const r=Math.hypot(q[0],q[2]),y=q[1],h=p.height/2;const d=Math.min(segment2([r,y],[p.r0,-h],[p.r1,h]),Math.hypot(Math.max(r-p.r0,0),y+h),Math.hypot(Math.max(r-p.r1,0),y-h));return d*(Math.abs(y)<=h&&r<=p.r0+(p.r1-p.r0)*(y+h)/p.height?-1:1);}
function jointSlotDistance(s,plan){const j=clamp(Math.round((s[2]+plan.width/2-.8)/2.1),0,plan.jointCount-1),u=-plan.width/2+.8+j*2.1;return sdBox(sub(s,[0,plan.deck+.004,u]),[7.7,.016,.009]);}
export function terminalHallMemberSample(m,p,plan=terminalHallPlan()){
 const q=m.frame.map(a=>dot(sub(p,m.center),a)),s=stationToHall(p),a=m.params;let d;
 if(m.kind==='box'){d=sdBox(q,m.extent);if(a.cutFloorJoints)d=Math.max(d,-jointSlotDistance(s,plan));}
 else if(m.kind==='cone')d=coneDistance(q,a);
 else if(m.kind==='flute'){
  const r=a.r0-a.depth*(.5+.5*Math.cos(Math.atan2(q[2],q[0])*a.flutes)),lip=Math.hypot(1,a.depth*a.flutes*.5/(a.r0-a.depth));d=extrusion((Math.hypot(q[0],q[2])-r)/lip,Math.abs(q[1])-a.height/2);
 }
 else if(m.kind==='arch')d=Math.max(Math.hypot(q[0],q[1])-a.radius-a.width,a.radius-Math.hypot(q[0],q[1]),-q[1],Math.abs(q[2])-a.depth/2);
 else if(m.kind==='roof')d=Math.max(Math.abs(q[0])-m.extent[0],Math.abs(q[2])-m.extent[2],(Math.abs(q[1]-a.slope*q[0])-a.thickness/2)/Math.hypot(1,a.slope));
 else if(m.kind==='triangle'){
  const y=q[1]+a.rise/2,k=2*a.rise/a.width;d=Math.max(-y,(y+k*Math.abs(q[0])-a.rise)/Math.hypot(1,k),Math.abs(q[2])-a.depth/2);
  if(a.oculus)d=Math.max(d,a.oculus.radius-Math.hypot(s[0]-a.oculus.center[0],s[1]-a.oculus.center[1]));
 }
 else if(m.kind==='ring')d=Math.hypot(Math.hypot(q[0],q[1])-a.radius,q[2])-a.tube;
 else if(m.kind==='disc')d=extrusion(Math.hypot(q[0],q[1])-a.radius,Math.abs(q[2])-a.thickness/2);
 else if(m.kind==='annulus'){const r=Math.hypot(q[0],q[1]);d=extrusion(Math.max(a.inner-r,r-a.outer),Math.abs(q[2])-a.depth/2);}
 else throw Error('Unimplemented hall distance '+m.kind);
 return{d,baseD:d,id:m.binding.id,q,extent:m.extent.slice(),frame:m.frame.map(x=>x.slice()),member:m.member,sourceSeed:m.member,seed:m.binding.seed,sourceId:m.sourceId,componentId:m.id,physicalRole:m.binding.physicalRole};
}
const roundKey=x=>JSON.stringify(x,(_,v)=>typeof v==='number'?Math.round(v*1e10)/1e10:v);
function groupsFor(parts){
 const buckets=new Map();for(const m of parts){if(m.binding.deferred)continue;const k=roundKey([m.kind,m.params,m.extent,m.sourceFrame,m.binding,m.isFloor]);if(!buckets.has(k))buckets.set(k,[]);buckets.get(k).push(m);}
 const groups=[];
 for(const bucket of buckets.values()){
  let rest=bucket.slice();while(rest.length){const first=rest[0];let best=[first],bestStep=[0,0,0],memberStride=0;
   for(const next of rest.slice(1)){
    const stride=sub(next.center,first.center),mi=next.member-first.member;if(Math.hypot(...stride)<1e-9)continue;
    const run=[first,next];for(let j=2;;j++){const target=add(first.center,mul(stride,j)),n=rest.find(m=>m.member===first.member+mi*j&&Math.hypot(...sub(m.center,target))<1e-8);if(!n)break;run.push(n);}
    if(run.length>best.length){best=run;bestStep=stride;memberStride=mi;}
   }
   const set=new Set(best.map(m=>m.member));rest=rest.filter(m=>!set.has(m.member));const a=best.map(m=>terminalHallMemberBounds(m,HALL_MATERIAL_ENVELOPE));
   groups.push({first:first.member,count:best.length,memberStride,translation:bestStep,members:best.map(m=>m.member),min:[0,1,2].map(k=>Math.min(...a.map(b=>b.min[k]))),max:[0,1,2].map(k=>Math.max(...a.map(b=>b.max[k])))});
  }
 }
 return groups;
}
function repetitionPad(m,g,margin){const local=m.frame.map(a=>dot(a,g.translation)),ss=dot(local,local),extent=add(m.extent,terminalHallMaterialPadding(m,2*margin));return Math.ceil(dot(local.map(Math.abs),extent)/ss)+1;}
/** Pure CPU diagnostic. Default covers every child. compact repetition mode is
 * independently compared with exhaustive sampling. Material callbacks run on
 * each child before selection and retain that child's exact material frame. */
export function createTerminalHallSampler(options={}, {materialDistance=null,materialDistanceMaxShift=HALL_MATERIAL_ENVELOPE,compact=false,proxyBounds=false,includeDeferredGlass=false}={}){
 const c=terminalHallMembers(options),groups=groupsFor(c.parts);if(!Number.isFinite(materialDistanceMaxShift)||materialDistanceMaxShift<0||materialDistanceMaxShift>HALL_MATERIAL_ENVELOPE)throw Error('Invalid hall material-distance envelope');
 const sample=(p,{skipFloor=false,skipRoof=false}={})=>{let best={d:1e5,baseD:1e5,id:0,member:-1};
  const consider=i=>{const m=c.parts[i];if(skipFloor&&m.isFloor||skipRoof&&m.surface.role==='roof-metal')return;if(m.binding.deferred&&!includeDeferredGlass)return;const h=terminalHallMemberSample(m,p,c.plan);if(materialDistance){h.d=materialDistance(h,p,m);if(!Number.isFinite(h.d)||Math.abs(h.d-h.baseD)>materialDistanceMaxShift+1e-9)throw Error('Hall material-distance bound exceeded');}if(h.d<best.d)best=h;};
  if(!compact){for(let i=0;i<c.parts.length;i++)consider(i);return best;}
  for(const g of groups){
   if(skipFloor&&c.parts[g.first].isFloor||skipRoof&&c.parts[g.first].surface.role==='roof-metal')continue;
   if(proxyBounds){const b=sdBox(sub(p,mul(add(g.min,g.max),.5)),mul(sub(g.max,g.min),.5));if(b>.06){if(b<best.d)best={d:b,baseD:b,id:0,member:-1,proxy:true};continue;}}
   if(g.count===1){consider(g.first);continue;}
   const m=c.parts[g.first],n=clamp(Math.round(dot(sub(p,m.center),g.translation)/dot(g.translation,g.translation)),0,g.count-1),pad=repetitionPad(m,g,materialDistanceMaxShift);
   for(let j=Math.max(0,n-pad);j<=Math.min(g.count-1,n+pad);j++)consider(g.first+j*g.memberStride);
  }
  if(includeDeferredGlass)for(const m of c.parts)if(m.binding.deferred)consider(m.member);
  return best;
 };
 return Object.assign(sample,c,{groups});
}
const f=n=>Math.abs(n)<1e-13?'0.':Number.isInteger(n)?n+'.':String(n),v=a=>'vec3<f32>('+a.map(f).join(',')+')';
function primitiveWGSL(m,plan){
 const a=m.params,e=m.extent;
 if(m.kind==='box'){
  let d=`box(q,${v(e)})`;
  if(a.cutFloorJoints){const n=plan.jointCount-1;d=`max(${d},-box(vec3<f32>(s.x,s.y-${f(plan.deck+.004)},s.z-(-${f(plan.width/2)}+.8+clamp(round((s.z+${f(plan.width/2)}-.8)/2.1),0.,${f(n)})*2.1)),vec3<f32>(7.7,.016,.009)))`;}
  return d;
 }
 if(m.kind==='cone')return`memberCone(q,${f(a.r0)},${f(a.r1)},${f(a.height)},0u)`;
 if(m.kind==='flute'){const lip=Math.hypot(1,a.depth*a.flutes*.5/(a.r0-a.depth));return`hallExtrusion((length(q.xz)-(${f(a.r0)}-${f(a.depth)}*(.5+.5*cos(atan2(q.z,q.x)*${f(a.flutes)}))))/${f(lip)},abs(q.y)-${f(a.height/2)})`;}
 if(m.kind==='arch')return`max(max(length(q.xy)-${f(a.radius+a.width)},${f(a.radius)}-length(q.xy)),max(-q.y,abs(q.z)-${f(a.depth/2)}))`;
 if(m.kind==='roof')return`max(max(abs(q.x)-${f(e[0])},abs(q.z)-${f(e[2])}),(abs(q.y-(${f(a.slope)})*q.x)-${f(a.thickness/2)})/${f(Math.hypot(1,a.slope))})`;
 if(m.kind==='triangle'){
  const k=2*a.rise/a.width;let d=`max(max(-q.y-${f(a.rise/2)},(q.y+${f(a.rise/2)}+abs(q.x)*${f(k)}-${f(a.rise)})/${f(Math.hypot(1,k))}),abs(q.z)-${f(a.depth/2)})`;
  if(a.oculus)d=`max(${d},${f(a.oculus.radius)}-length(s.xy-${'vec2<f32>('+[a.oculus.center[0],a.oculus.center[1]].map(f).join(',')+')'}))`;return d;
 }
 if(m.kind==='ring')return`length(vec2<f32>(length(q.xy)-${f(a.radius)},q.z))-${f(a.tube)}`;
 if(m.kind==='annulus')return`hallExtrusion(max(${f(a.inner)}-length(q.xy),length(q.xy)-${f(a.outer)}),abs(q.z)-${f(a.depth/2)})`;
 throw Error('Deferred or unsupported hall field '+m.kind);
}
/** Requires box, memberCone, HitField, resolveStationState and the existing
 * stationCandidatePhysicalDistance callback. No source mother is replaced.
 * Returned d is already material-bearing; baseD is the winning nominal solid.
 * Submit terminalHallRawWinner(h) to the station's shared candidate resolver.
 * Exactly one global candidate is needed, including conservative far proxies. */
export function terminalHallWGSL(options={}){
 const c=terminalHallMembers(options),groups=groupsFor(c.parts),callback=options.materialDistance??'stationCandidatePhysicalDistance',proxy=options.proxyBounds!==false;
 if(!/^[A-Za-z][A-Za-z0-9_]*$/.test(callback))throw Error('Invalid hall material callback');
 let code=`// Complete ${c.sourceCount} source IDs; ${c.parts.length-c.sourceCount} named current additions.\n// Glass optics and title-outline dependencies are deliberately unresolved.\nfn hallExtrusion(a:f32,b:f32)->f32{return length(max(vec2<f32>(a,b),vec2<f32>(0.)))+min(max(a,b),0.);}\nfn terminalHallRawWinner(h:HitField)->HitField{var c=h;c.d=h.baseD;return c;}\nfn terminalHallQuery(p:vec3<f32>,skipRoof:bool,skipFloor:bool)->HitField{let s=vec3<f32>(p.z,p.y,-p.x);let st=resolveStationState(p);var h=HitField(1e5,0u,p,0.,1e5,vec3<f32>(1.),-1.);\n`;
 for(const [gi,g] of groups.entries()){
  const m=c.parts[g.first],center=mul(add(g.min,g.max),.5),half=mul(sub(g.max,g.min),.5),roof=m.surface.role==='roof-metal',floor=m.isFloor;
  code+=`// ${m.sourceFamily}: ${m.id}${g.count>1?' through '+c.parts[g.members.at(-1)].id:''}; ${g.count} finite members.\n{\n`;
  if(roof||floor)code+=`if(!${roof?'skipRoof':'skipFloor'}){\n`;
  if(proxy)code+=`let bound=box(p-${v(center)},${v(half)});if(bound>.06){if(bound<h.d){h=HitField(bound,0u,p,0.,bound,${v(half)},-1.);}}else{\n`;
  if(g.count>1){const pad=repetitionPad(m,g,HALL_MATERIAL_ENVELOPE);code+=`let stride=${v(g.translation)};let nearest=i32(clamp(round(dot(p-${v(m.center)},stride)/dot(stride,stride)),0.,${f(g.count-1)}));for(var offset=-${pad};offset<=${pad};offset++){let index=nearest+offset;if(index>=0&&index<${g.count}){let center=${v(m.center)}+stride*f32(index);let member=${f(g.first)}+f32(index)*${f(g.memberStride)};\n`;}
  else code+=`let center=${v(m.center)};let member=${f(m.member)};\n`;
  code+=`let delta=p-center;let q=vec3<f32>(${m.frame.map(a=>'dot(delta,'+v(a)+')').join(',')});let d=${primitiveWGSL(m,c.plan)};var child=HitField(d,${m.binding.id}u,q,${f(m.binding.seed)},d,${v(m.extent)},member);child.d=${callback}(child,p,st);if(child.d<h.d){h=child;}\n`;
  if(g.count>1)code+='}}\n';if(proxy)code+='}\n';if(roof||floor)code+='}\n';code+='}\n';
 }
 return code+'return h;}\nfn completeTerminalHall(p:vec3<f32>,skipFloor:bool)->HitField{return terminalHallQuery(p,false,skipFloor);}\n';
}
export const HALL_WGSL=terminalHallWGSL();
export const hallMembers=terminalHallMembers,hallWGSL=terminalHallWGSL,createHallSampler=createTerminalHallSampler;
