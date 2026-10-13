// AMO 2024 pp.3/5 observations. Dimensions remain authored within the R04 site.
// The retained R04 source is separate; this is an independent heritage candidate.
import {clockTowerMembers as retainedTowerMembers,clockTowerWGSL as retainedTowerWGSL} from '../native-clock-tower-r04.mjs';
export const TOWER_EVIDENCE=Object.freeze({source:'https://www.amo.gov.hk/filemanager/amo/common/download-area/pamphlet/clock_tower.pdf',observed:['square main shaft','two octagonal turret stages','concrete dome','granite pediment window surrounds','timber window frames'],authored:['all new member dimensions','maintained finish and exposure history','current 44m-scale envelope retained'],unresolved:['whether reported 44m includes the 7m lightning rod','original hall plan/depth','period-specific clock glazing'],referenceImagesPublished:false});
const clone=x=>JSON.parse(JSON.stringify(x));
export function clockTowerMembers({width=6.2}={}){
 const original=retainedTowerMembers({width}),parts=original.parts.filter(p=>!/^belfry-|^tower-belfry|^tower-dome|^dome-crown|^tower-finial|^tower-quoin|^tower-pilaster|^tower-cornice-(31|38|39)/.test(p.id)).map(clone);
 const add=(id,shape,role,feature)=>parts.push({id,shape,surface:{role,feature,component:id,ageYears:110,maintenance:'continuous selective maintenance',evidence:'authored profile from AMO visual evidence'}});
 const box=(id,center,size,role='masonry-trim',feature='cut-granite')=>add(id,{type:'box',center,size},role,feature);
 const beam=(id,a,b,width,depth,role='masonry-trim')=>add(id,{type:'beam',a,b,width,depth},role,'jointed-profile');
 const oct=(id,y,r,h,role='masonry-trim',inner=0)=>add(id,{type:'octagon',center:[0,y,0],radius:r,height:h,inner},role,'octagonal-turret');
 // Corner ashlar is broad, flush with the brick face. Shallow joints are actual
 // gaps between blocks, rather than giant projecting horizontal stripes.
 for(const sx of [-1,1])for(const sz of [-1,1])for(let row=0;row<27;row++){
  const y=1.3+(row+.5)*1.01;
  box(`heritage-quoin-${sx}-${sz}-${row}`,[sx*(width/2-.29),y,sz*(width/2-.29)],[.93,.996,.93]);
 }
 // Four recessed windows per face. Their openings are subtracted in the same
 // brick solid. No black window decal and no claimed glass transmission.
 const levels=[{y:3.9,h:2.7},{y:9.8,h:2.5},{y:15.2,h:2.5},{y:20.5,h:1.9}];
 const facePoint=(face,u,y,d)=>{const a=face*Math.PI/2;return [Math.cos(a)*u+Math.sin(a)*d,y,-Math.sin(a)*u+Math.cos(a)*d];};
 for(let face=0;face<4;face++)for(const [i,win] of levels.entries()){
  const pt=(u,y,d)=>facePoint(face,u,y,d),faceSize=(u,y,d)=>face%2?[d,y,u]:[u,y,d],depth=width/2+.018;
  for(const side of [-1,1])box(`heritage-window-jamb-${face}-${i}-${side}`,pt(side*.86,win.y,depth),faceSize(.22,win.h+.39,.24));
  box(`heritage-window-sill-${face}-${i}`,pt(0,win.y-win.h/2-.13,depth+.07),faceSize(2.02,.18,.43));
  box(`heritage-window-head-${face}-${i}`,pt(0,win.y+win.h/2+.17,depth),faceSize(2.02,.25,.30));
  const spring=win.y+win.h/2+.36;
  for(const s of [-1,1])beam(`heritage-window-pediment-${face}-${i}-${s}`,pt(s*1.07,spring,depth+.05),pt(0,spring+.49,depth+.05),.105,.27);
  box(`heritage-window-pediment-base-${face}-${i}`,pt(0,spring,depth+.04),faceSize(2.18,.11,.32));
  // Timber has its own section-local metric frame in completeTowerTimber.
  for(const s of [-1,1])box(`heritage-sash-stile-${face}-${i}-${s}`,pt(s*.686,win.y,depth-.19),faceSize(.062,win.h-.06,.073),'window-timber');
  for(let r=0;r<5;r++)box(`heritage-sash-rail-${face}-${i}-${r}`,pt(0,win.y-win.h/2+.06+r*(win.h-.12)/4,depth-.19),faceSize(1.43,.044,.071),'window-timber');
  for(const u of [-.23,.23])box(`heritage-sash-mullion-${face}-${i}-${u}`,pt(u,win.y,depth-.19),faceSize(.032,win.h-.1,.067),'window-timber');
 }
 // Build the square transition attic continuously between retained cornice
 // and the first octagonal plinth; these are load-bearing volumes.
 box('heritage-square-attic',[0,30.08,0],[5.55,1.87,5.55],'tower-brick');
 for(const x of [-1,1])for(const z of [-1,1])box(`heritage-attic-corner-${x}-${z}`,[x*2.65,30.10,z*2.65],[.43,1.85,.43]);
 for(let face=0;face<4;face++){
  const normal=[Math.sin(face*Math.PI/2),0,Math.cos(face*Math.PI/2)];
  add('heritage-clock-rebate-'+face,{type:'annulus',center:normal.map((v,k)=>k===1?25:v*3.14),radius:1.50,inner:1.30,depth:.40,axis:face%2?'x':'z'},'masonry-trim','clock-stone-rebate');
 }
 // Existing lower square attic/cornices are retained. The lantern above them is
 // now genuinely eight-sided, with solid diagonal brick piers and open windows.
 oct('heritage-octagonal-plinth',31.25,2.68,.60);
 oct('heritage-lower-octagonal-drum',32.05,2.46,1.08,'tower-brick',1.95);
 oct('heritage-octagonal-string',32.67,2.65,.22);
 for(let side=0;side<8;side++){
  const a=side*Math.PI/4+Math.PI/8,x=Math.sin(a)*2.13,z=Math.cos(a)*2.13;
  add('heritage-lantern-pier-'+side,{type:'oriented-box',center:[x,35.0,z],size:[.58,4.50,.53],yaw:a},'tower-brick','octagonal-brick-pier');
  add('heritage-lantern-edge-'+side,{type:'cylinder',center:[x*1.075,35.0,z*1.075],radius:.125,radiusTop:.125,height:4.46},'masonry-trim','slender-mineral-order');
 }
 for(const [y,r,h]of[[37.25,2.59,.25],[37.55,2.80,.25],[37.83,2.88,.20]])oct('heritage-lantern-cornice-'+y,y,r,h);
 oct('heritage-upper-drum',38.39,2.35,.98,'tower-brick',1.89);
 oct('heritage-upper-drum-coping',38.96,2.51,.18);
 // Structural concrete shell, 160mm gauge; never the old 1.2mm copper skin.
 add('heritage-concrete-dome',{type:'dome',center:[0,39.02,0],radius:2.46,rise:2.15,thickness:.16},'tower-concrete','maintained-mineral-concrete-dome');
 add('heritage-dome-crown',{type:'cylinder',center:[0,41.23,0],radius:.17,radiusTop:.12,height:.40},'tower-concrete','concrete-crown');
 // R04 top envelope is preserved pending a surveyed vertical datum. Do not
 // label this provisional 2.65m visible support as the official seven-metre rod.
 for(const x of [-.11,.11])for(const z of [-.11,.11])beam(`heritage-mast-${x}-${z}`,[x,41.4,z],[x*.4,43.65,z*.4],.025,.025,'structural-iron');
 for(let i=0;i<5;i++){const y=41.4+i*.45;beam('heritage-mast-brace-'+i,[-.10,y,.10],[.10,y+.43,.10],.017,.017,'structural-iron');}
 add('heritage-mast-needle',{type:'cylinder',center:[0,43.8,0],radius:.013,radiusTop:.006,height:.5},'structural-iron','provisional-lightning-support');
 return {parts,clockHands:original.clockHands,windows:levels,evidence:TOWER_EVIDENCE};
}
const f=x=>Math.abs(x)<1e-12?'0.':Number.isInteger(x)?x+'.':String(x),v=a=>'vec3<f32>('+a.map(f).join(',')+')';
function field(s){const q=`(p-${v(s.center||[0,0,0])})`;
 if(s.type==='box')return `box(${q},${v(s.size.map(n=>n/2))})`;
 if(s.type==='oriented-box'){const a=s.yaw??0;return `box(vec3<f32>(${f(Math.cos(a))}*${q}.x-(${f(Math.sin(a))})*${q}.z,${q}.y,${f(Math.sin(a))}*${q}.x+${f(Math.cos(a))}*${q}.z),${v(s.size.map(n=>n/2))})`;}
 if(s.type==='beam')return `memberBeam(p,${v(s.a)},${v(s.b)},${f(s.width)},${f(s.depth)})`;
 if(s.type==='cylinder')return `memberCone(${q},${f(s.radius)},${f(s.radiusTop??s.radius)},${f(s.height)},0u)`;
 if(s.type==='octagon')return `heritageOctagon(${q},${f(s.radius)},${f(s.height/2)},${f(s.inner)})`;
 if(s.type==='dome')return `heritageDome(${q},${f(s.radius)},${f(s.rise)},${f(s.thickness)})`;
 const plane=s.axis==='x'?`${q}.zyx`:q;
 if(s.type==='annulus')return `max(max(length(${plane}.xy)-${f(s.radius)},${f(s.inner)}-length(${plane}.xy)),abs(${plane}.z)-${f(s.depth/2)})`;
 if(s.type==='ring')return `length(vec2<f32>(length(${plane}.xy)-${f(s.radius)},${plane}.z))-${f(s.tube)}`;
 if(s.type==='disc')return `max(length(${plane}.xy)-${f(s.radius)},abs(${plane}.z)-.006)`;
 throw Error('Unknown heritage tower primitive '+s.type);
}
export function clockTowerWGSL(options={}){
 const {parts,windows}=clockTowerMembers(options),w=options.width??6.2;
 let out=`fn heritageOctagon(q:vec3<f32>,r:f32,h:f32,inner:f32)->f32{let a=abs(q.xz);let side=max(max(a.x,a.y),dot(a,vec2<f32>(.707106781186548)))-r;var d=max(side,abs(q.y)-h);if(inner>0.){let hole=max(max(a.x,a.y),dot(a,vec2<f32>(.707106781186548)))-inner;d=max(d,-hole);}return d;}\nfn heritageDome(q:vec3<f32>,r:f32,rise:f32,t:f32)->f32{let scale=vec3<f32>(1.,rise/r,1.);return max(abs(length(q/scale)-(r-t*.5))*(rise/r)-t*.5,-q.y);}\n`;
 for(const [group,role]of Object.entries({stone:'masonry-trim',brick:'tower-brick',iron:'structural-iron',concrete:'tower-concrete',dial:'clock-face'})){
  out+=`fn completeTower${group}(p:vec3<f32>)->ColumnMemberHit{var h=ColumnMemberHit(1e5,-1.);var d=0.;\n`;
  for(const [i,part]of parts.entries())if(part.surface.role===role){let expr=field(part.shape);if(part.id==='clock-shaft'){
   for(const win of windows)expr=`max(${expr},-box(vec3<f32>(min(abs(p.x),abs(p.z)),p.y-${f(win.y)},max(abs(p.x),abs(p.z))-${f(w/2-.26)}),vec3<f32>(.745,${f(win.h/2)},.66)))`;
  }out+=`// ${part.id}\nd=${expr};if(d<h.d){h=ColumnMemberHit(d,${f(i)});}\n`;}
  out+='return h;}\n';
 }
 // One shared material call in a finite original-order loop. This avoids
 // asking the driver to inline the full timber mother 144 separate times.
 const timber=parts.map((part,i)=>({part,i})).filter(({part})=>part.surface.role==='window-timber');
 out+='fn completeTowerTimber(p:vec3<f32>)->HitField{var h=HitField(1e5,4u,p,172.,1e5,vec3<f32>(1.),0.);let world=p+vec3<f32>(24.,0.,4.);let st=resolveStationState(world);\n';
 out+=`for(var j=0u;j<${timber.length}u;j++){var q=vec3<f32>(0.);var extent=vec3<f32>(1.);var member=0.;switch j{\n`;
 for(const [j,{part,i}]of timber.entries()){
  const s=part.shape,axis=s.size.indexOf(Math.max(...s.size)),perm=axis===1?'yxz':axis===2?'zxy':'xyz',ex=perm.split('').map(k=>s.size['xyz'.indexOf(k)]/2);
  out+=`${j===timber.length-1?'default':`case ${j}u`}:{q=(p-${v(s.center)}).${perm};extent=${v(ex)};member=${f(i)};}\n`;
 }
 out+='}let d=box(q,extent);if(d-.03001<h.d){var child=HitField(d,4u,q,172.,d,extent,member);child.d=stationCandidatePhysicalDistance(child,world,st);if(child.d<h.d){h=child;}}}h.d=h.baseD;return h;}\n';
 out+='fn heritageTimberDirection(member:f32,d:vec3<f32>)->vec3<f32>{\n';
 for(const [i,part]of parts.entries())if(part.surface.role==='window-timber'){const axis=part.shape.size.indexOf(Math.max(...part.shape.size)),perm=axis===1?'yxz':axis===2?'zxy':'xyz';out+=`if(member==${f(i)}){return d.${perm};}\n`;}
 out+='return d;}\n';
 const source=retainedTowerWGSL(options),start=source.indexOf('fn completeTowerDialIndices');out+=source.slice(start);
 return out;
}
