// Farmland R028. Persistent synthetic relationships; render buffers are derived.
export const VERSION='FARMLAND_R037_GROUNDED_FIELD_CONNECTIONS_20260914';
export const CONTROL_SOURCE_VERSION='FARMLAND_R032_FIELD_CONTROL_MAINTENANCE_20260913';
export const VISUAL_SOURCE_VERSION='FARMLAND_R037_GROUNDED_FIELD_CONNECTIONS_20260914';
export const WORLD_SOURCE_VERSION='FARMLAND_R028_WATERSHED_20260912';
export const RUNTIME_SOURCE_VERSION='FARMLAND_R029_RUNTIME_LIGHT_20260913';
export const HIERARCHY_SOURCE_VERSION='FARMLAND_R030_IRRIGATION_HIERARCHY_20260913';
export const MORPHOLOGY_SOURCE_VERSION='FARMLAND_R031_FIELD_BUND_CANAL_MORPHOLOGY_20260913';
export const FRAME={id:'farmland-r028-local',unit:'m',axes:'x east, y up, z south',datum:'synthetic local zero',surveyAccuracy:null,worldLocation:null};
export const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export const mix=(a,b,t)=>a+(b-a)*t;
export function smooth(a,b,x){const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);}
export function rng(seed=280912){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
export const hash=(x,z)=>{const a=Math.sin(x*127.1+z*311.7)*43758.5453;return a-Math.floor(a);};
export function noise(x,z){const i=Math.floor(x),j=Math.floor(z),u=smooth(0,1,x-i),v=smooth(0,1,z-j);return mix(mix(hash(i,j),hash(i+1,j),u),mix(hash(i,j+1),hash(i+1,j+1),u),v);}
export const terraceLevels=[14.1,12.65,11.5,9.8,8.4,6.9,5.55,4.25,2.9,1.65];
// R034 reference morphology: terraces share the slope-scale contour trend but each boundary
// carries its own phase. This creates the widening, pinching and non-parallel edges visible
// in the supplied terrace references without claiming surveyed local dimensions.
const contourZ=[-124,-111,-97,-84,-70,-56,-43,-30,-17,-3,14];
const contourPhase=[.15,.72,-.36,.93,.28,-.62,.58,-.88,.08,.77,-.28];
// R035: a shared mountain-scale contour gesture gives visual continuity, while each boundary
// adds its own phase and local pinch. The aim is nested contour rhythm, not parallel stripes.
function contourShared(u){return 18*Math.sin(u*Math.PI*1.22+.24)+5.7*Math.sin(u*Math.PI*2.75-.42)+2.3*Math.cos(u*7.1+.55);}
export function contour(k,u){const local=2.7*Math.sin(u*(4.0+.15*k)+contourPhase[k]*2.2)+1.35*Math.cos(u*(8.5-.10*k)-contourPhase[k]*1.6)+.8*Math.sin((u-.5)*(u-.5)*15+k*.43);return contourZ[k]+contourShared(u)+local;}
export function terracePoint(k,u,v){return[-106+98*u,mix(contour(k,u),contour(k+1,u),v)];}
export function terraceCoordinate(x,z){const u=(x+106)/98;if(u<0||u>1)return null;for(let k=0;k<10;k++){const a=contour(k,u),b=contour(k+1,u);if(z>=a&&z<=b)return{k,u,v:(z-a)/(b-a)};}return null;}
export function riverX(z){return 58+11*Math.sin((z+30)*.018)+4*Math.sin(z*.042);}
export function riverY(z){return -.36-.0025*(z+115);}
export const extent={xmin:-195,xmax:180,zmin:-305,zmax:145,step:.5};
const flatBeds=[1.16,.98,.79,.59];
const flatZ=[27,48,69,91,113];
export function flatPoint(k,u,v){const a=flatZ[k]+5*Math.sin(u*5+k*.4),b=flatZ[k+1]+5*Math.sin(u*5+(k+1)*.4),z=mix(a,b,v);const left=-4+2*Math.sin(z*.04);const right=riverX(z)-12;return[mix(left,right,u),z];}
export function flatCoordinate(x,z){for(let k=0;k<4;k++){
  const left=-4+2*Math.sin(z*.04),u=(x-left)/(riverX(z)-12-left),a=flatZ[k]+5*Math.sin(u*5+k*.4),b=flatZ[k+1]+5*Math.sin(u*5+(k+1)*.4),v=(z-a)/(b-a);
  if(u>=0&&u<=1&&v>=0&&v<=1)return{k,u,v};
}return null;}
export function area(poly){let a=0;for(let i=0;i<poly.length;i++){const p=poly[i],q=poly[(i+1)%poly.length];a+=p[0]*q[1]-q[0]*p[1];}return Math.abs(a)*.5;}
export function pointInPolygon(x,z,poly){let inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const xi=poly[i][0],zi=poly[i][1],xj=poly[j][0],zj=poly[j][1];const hit=((zi>z)!=(zj>z))&&(x<(xj-xi)*(z-zi)/(zj-zi+1e-12)+xi);if(hit)inside=!inside;}return inside;}
export function ring(point,k,u0=.06,u1=.94,v0=.12,v1=.68){const p=[],n=90;for(let j=0;j<=n;j++){const t=j/n,u=mix(u0,u1,t),vv=clamp(v0+.035*Math.sin(t*Math.PI*3.2+k*.73)+.015*Math.sin(t*Math.PI*8+k),.02,.92);p.push(point(k,u,vv));}for(let j=0;j<=n;j++){const t=j/n,u=mix(u1,u0,t),vv=clamp(v1+.045*Math.sin((1-t)*Math.PI*2.7+k*.51)+.018*Math.cos(t*Math.PI*7-k),.06,.96);p.push(point(k,u,vv));}return p;}
const terraceBounds=[[.05,.93,.09,.70],[.11,.96,.12,.78],[.04,.91,.07,.61],[.17,.96,.10,.73],[.07,.92,.15,.80],[.13,.97,.08,.66],[.05,.91,.10,.72],[.21,.97,.13,.79],[.09,.93,.08,.60],[.15,.96,.11,.70]];
const flatBounds=[[.055,.94,.10,.84],[.08,.955,.13,.87],[.045,.93,.08,.83],[.10,.96,.12,.88]];
const terraceStages=['tillering','heading','tillering','transplanted','tillering','heading','tillering','transplanted','tillering','heading'];
const flatStages=['tillering','transplanted','transplanted','tillering'];
export const fields=[...terraceLevels.map((bed,k)=>{const bounds=terraceBounds[k];return{id:`T${k+1}`,name:`坡地第 ${k+1} 级`,kind:'terrace',k,bed,point:terracePoint,bounds,polygon:ring(terracePoint,k,...bounds),stage:terraceStages[k],source:'generated',frame:FRAME.id};}),...flatBeds.map((bed,k)=>{const bounds=flatBounds[k];return{id:`F${k+1}`,name:['河湾秧田','移栽田','插秧田','河畔水田'][k],kind:'flat',k,bed,point:flatPoint,bounds,polygon:ring(flatPoint,k,...bounds),stage:flatStages[k],source:'generated',frame:FRAME.id};})];
for(const f of fields){f.area=area(f.polygon);f.crest=f.bed+.26;f.inletId=`in-${f.id}`;f.outletId=`out-${f.id}`;f.evidence={kind:'synthetic',source:'reference morphology, not surveyed dimensions',uncertainty:null};}
export const fieldById=Object.fromEntries(fields.map(f=>[f.id,f]));
// R036 landform spine: one continuous terrain from rear mountains -> cultivated hillside -> footslope -> flat paddies.
// Mountains are relief of the same height field, never detached meshes.
export const landformZones={
  rearMountains:{z:[-305,-145],role:'forested high catchment / background mountain range'},
  terraceHillside:{z:[-150,20],role:'continuous cultivated slope carrying contour-following terraces'},
  footslope:{z:[5,38],role:'slope-to-plain transition and collection zone'},
  flatPaddy:{z:[27,118],role:'low-gradient paddy plain'},
  downstream:{z:[95,145],role:'drainage / river receiving edge'}
};
export const mountains=[
  [-170,-252,46,82,62],[-92,-270,58,86,66],[-8,-260,64,88,68],[78,-256,59,86,64],[154,-246,48,78,60],
  [-138,-205,31,70,50],[-48,-214,38,74,52],[45,-208,36,72,50],[130,-202,30,68,48]
];
function ridgeBlob(x,z,cx,cz,h,rx,rz,seed){
  const dx=(x-cx)/rx,dz=(z-cz)/rz,r=Math.hypot(dx,dz);if(r>1.8)return 0;
  const theta=Math.atan2(dz,dx),body=Math.exp(-Math.pow(r*1.15,1.72));
  const shoulders=1+.13*Math.sin(theta*3+seed*.7)+.055*Math.sin(theta*7-seed*.31);
  const weather=.84+.20*noise(x*.021+seed,z*.026-seed*.3)+.07*noise(x*.083-seed,z*.071+seed);
  return h*body*shoulders*weather;
}
export function rockHeight(x,z){
  const rearMask=smooth(-126,-222,z);let h=0;
  for(let i=0;i<mountains.length;i++){const[cx,cz,hh,rx,rz]=mountains[i];h=Math.max(h,ridgeBlob(x,z,cx,cz,hh,rx,rz,i+1));}
  // a low connecting shoulder prevents the mountain masses reading as isolated cones.
  const connected=rearMask*(5.2+4.2*noise(x*.010,z*.012)+2.1*noise(x*.028+3,z*.024-2));
  return rearMask*Math.max(h,connected);
}
export function hillsideFoundation(x,z){
  const t=smooth(28,-154,z); // flat plain at the front, continuously rising toward the rear.
  const broad=17.6*t + 1.35*t*(1-t)*(Math.sin(x*.021+.6)+.55*Math.sin(x*.049-1.1));
  const micro=(.16+.38*t)*((noise(x*.025,z*.026)-.5)+.42*(noise(x*.071+5,z*.065-3)-.5));
  return .24+broad+micro;
}
export function earthBase(x,z){
  // Start from one connected ground sheet. Every later terrace, channel, tree and actor samples this same surface.
  let y=hillsideFoundation(x,z)+rockHeight(x,z);
  const tc=terraceCoordinate(x,z);
  if(tc){const{k,u,v}=tc,h=terraceLevels[k],next=terraceLevels[k+1]??.72;
    // Terrace = horizontal basin cut into the slope, with a compacted crest and a real riser to the next level.
    const riserStart=.79+.018*Math.sin(u*5.2+k*.41);
    let ty=v<riserStart?h:mix(h,next,smooth(riserStart,.985,v));
    ty+=.30*Math.exp(-Math.pow((v-(riserStart-.025))/.050,4));
    ty+=.24*Math.exp(-Math.pow((u-.022)/.020,4))+.24*Math.exp(-Math.pow((u-.978)/.020,4));
    // Blend only at the outer shoulders. The terrace is carved from the slope instead of laid over it.
    const shoulder=smooth(0,.035,u)*(1-smooth(.965,1,u));
    y=mix(hillsideFoundation(x,z)+rockHeight(x,z),ty,shoulder);
  }else if(x>-116&&x<2&&z>-145&&z<30){
    // Side shoulders stay part of the same slope and meet terrace ends without vertical floating shelves.
    const u=clamp((x+106)/98,0,1);let k=0;while(k<9&&z>contour(k+1,u))k++;
    const edgeDistance=Math.min(Math.abs(x+106),Math.abs(x+8));
    const blend=1-smooth(0,10,edgeDistance);
    y=mix(y,terraceLevels[k]+.08,blend*.72);
  }
  const fc=flatCoordinate(x,z);if(fc){const{k,u,v}=fc;
    // Flat paddies are shallow basins raised only by their bund shoulders; they remain part of the same terrain mesh.
    const edge=Math.min(u,1-u,v,1-v),bund=.27*(1-smooth(.02,.075,edge));
    y=flatBeds[k]+bund;
  }
  // A shallow footslope swale carries water toward the visible downstream river without separating the plain from the hill.
  const d=Math.abs(x-riverX(z));if(z>-132){const channel=riverY(z)-.78+.018*Math.sin(z*.075);y=mix(channel,y,smooth(5.8,11.8,d));}
  return y;
}
export function landformSample(){
  return{
    rear:ground(-40,-248),
    upperSlope:ground(-48,-128),
    midSlope:ground(-48,-64),
    footslope:ground(-12,18),
    plain:ground(18,82)
  };
}
export const connections=[];
function addEdge(id,from,to,points,crest,width=.68,role='field_spill',carrierId=null){connections.push({id,from,to,points,crest,width,role,carrierId,coefficient:.38,model:'ideal head-controlled opening; uncalibrated',source:'generated',frame:FRAME.id});}
const first=fields[0],p0=first.point(0,.9,.2);
export const spring={id:'spring',kind:'source',name:'高位山泉',x:p0[0]+6,z:p0[1]-12,bed:14.3,area:Math.PI*2.25**2,initialVolume:Math.PI*2.25**2*.085,frame:FRAME.id,evidence:{kind:'synthetic',source:'reference relationship only; not surveyed'}};
export const junctions=[
  {id:'J1',kind:'division_control',name:'上段分水点',x:-4.5,z:-116,bed:14.16,area:4.0,initialVolume:.32,frame:FRAME.id},
  {id:'J2',kind:'division_control',name:'中段分水点',x:-4.5,z:-82,bed:9.86,area:4.0,initialVolume:.32,frame:FRAME.id},
  {id:'J3',kind:'division_control',name:'下段分水点',x:-4.5,z:-45,bed:5.61,area:4.0,initialVolume:.32,frame:FRAME.id},
  {id:'J4',kind:'terminal_distribution',name:'河湾末端配水点',x:-1.0,z:28,bed:1.22,area:5.0,initialVolume:.40,frame:FRAME.id}
].map(j=>({...j,evidence:{kind:'synthetic',source:'hierarchy/control-volume candidate; allocation ratios uncalibrated'}}));
export const junctionById=Object.fromEntries(junctions.map(j=>[j.id,j]));
function jp(id,yOffset=.04){const j=junctionById[id];return[j.x,j.bed+yOffset,j.z];}
// Place ports on the actual curved basin boundary, not inside the flooded field.
function boundaryPoint(f,u,front){const half=f.polygon.length/2;const points=front?f.polygon.slice(half):f.polygon.slice(0,half);const target=f.point(f.k,u,.5)[0];return points.reduce((a,b)=>Math.abs(b[0]-target)<Math.abs(a[0]-target)?b:a);}
function fp(id,u,v,yOffset=.015){const f=fieldById[id],[x,z]=boundaryPoint(f,u,v>.4);return[x,f.bed+yOffset,z];}
// Main carrier: spring -> J1 -> J2 -> J3 -> J4. Each control point may continue downstream and feed a field group.
addEdge('headworks-spring-J1','spring','J1',[[spring.x,spring.bed+.07,spring.z],[-6.5,14.24,-126],jp('J1')],14.20,.58,'headworks','main-canal');
addEdge('trunk-J1-J2','J1','J2',[jp('J1'),[-4.1,12.9,-104],[-4.4,11.2,-92],jp('J2')],14.18,1.08,'trunk','main-canal');
addEdge('trunk-J2-J3','J2','J3',[jp('J2'),[-4.7,8.6,-69],[-4.3,7.0,-56],jp('J3')],9.88,1.08,'trunk','main-canal');
addEdge('trunk-J3-J4','J3','J4',[jp('J3'),[-3.8,4.45,-26],[-3.0,3.05,-4],[-2.0,1.72,17],jp('J4')],5.63,1.12,'trunk','main-canal');
// R035 water grammar: trunk water stays high, branches enter each terrace group, and
// inlet/outlet locations alternate laterally so a field is not represented as a short-circuit pipe.
// The ratios remain uncalibrated; only topology and relative placement are asserted.
function addCascade(a,b,uOut,uIn,carrier){
  const fa=fieldById[a],fb=fieldById[b];
  // The receiving inlet shares the outlet's lateral position. Alternating the next
  // outlet makes water traverse the basin itself, not a diagonal channel above it.
  const p=boundaryPoint(fa,uOut,true),q=boundaryPoint(fb,uOut,false);
  addEdge(`spill-${a}-${b}`,a,b,[[p[0],fa.bed+.015,p[1]],[q[0],fb.bed+.015,q[1]]],fa.bed+.055,.84,'field_spill',carrier);
}
// Upper terrace branch
addEdge('branch-J1-T1','J1','T1',[jp('J1'),[-10.0,14.19,-119],fp('T1',.86,.20)],14.18,.72,'branch_supply','upper-terrace-branch');
addCascade('T1','T2',.84,.22,'upper-terrace-branch');
addCascade('T2','T3',.24,.78,'upper-terrace-branch');
addEdge('return-T3-J2','T3','J2',[fp('T3',.80,.64),[-10.0,9.90,-89],jp('J2')],11.53,.78,'branch_return','upper-terrace-branch');
// Middle terrace branch
addEdge('branch-J2-T4','J2','T4',[jp('J2'),[-9.6,9.90,-83],fp('T4',.88,.20)],9.88,.72,'branch_supply','middle-terrace-branch');
addCascade('T4','T5',.86,.20,'middle-terrace-branch');
addCascade('T5','T6',.22,.82,'middle-terrace-branch');
addEdge('return-T6-J3','T6','J3',[fp('T6',.84,.63),[-10.0,5.65,-52],jp('J3')],6.93,.78,'branch_return','middle-terrace-branch');
// Lower terrace branch
addEdge('branch-J3-T7','J3','T7',[jp('J3'),[-9.4,5.65,-47],fp('T7',.87,.20)],5.63,.72,'branch_supply','lower-terrace-branch');
addCascade('T7','T8',.85,.20,'lower-terrace-branch');
addCascade('T8','T9',.22,.82,'lower-terrace-branch');
addCascade('T9','T10',.82,.24,'lower-terrace-branch');
addEdge('return-T10-J4','T10','J4',[fp('T10',.26,.64),[-7.2,1.60,18],jp('J4')],1.68,.82,'branch_return','lower-terrace-branch');
// Flat-field branch
addEdge('branch-J4-F1','J4','F1',[jp('J4'),[2.0,1.24,31],fp('F1',.12,.20)],1.24,.82,'branch_supply','flat-field-branch');
addCascade('F1','F2',.82,.18,'flat-field-branch');
addCascade('F2','F3',.18,.82,'flat-field-branch');
addCascade('F3','F4',.82,.18,'flat-field-branch');
const last=fieldById.F4,out=boundaryPoint(last,.83,true),riverZ=out[1]+7;
export const receiver={id:'river',kind:'receiver',name:'下游河段',area:50000,bed:-2,initialVolume:(riverY(riverZ)+2)*50000,z:riverZ,scope:'finite downstream reach extending beyond the visible river segment',frame:FRAME.id};
addEdge('field-return-river','F4','river',[[out[0],last.bed+.01,out[1]],[riverX(out[1])-11,last.bed+.055,out[1]],[riverX(riverZ),riverY(riverZ)-.2,riverZ]],last.bed+.055,1.05,'drain','downstream-return');
export const carriers=[
  {id:'main-canal',kind:'trunk',name:'主渠',edgeIds:['headworks-spring-J1','trunk-J1-J2','trunk-J2-J3','trunk-J3-J4']},
  {id:'upper-terrace-branch',kind:'branch',name:'上段梯田支路',edgeIds:['branch-J1-T1','spill-T1-T2','spill-T2-T3','return-T3-J2']},
  {id:'middle-terrace-branch',kind:'branch',name:'中段梯田支路',edgeIds:['branch-J2-T4','spill-T4-T5','spill-T5-T6','return-T6-J3']},
  {id:'lower-terrace-branch',kind:'branch',name:'下段梯田支路',edgeIds:['branch-J3-T7','spill-T7-T8','spill-T8-T9','spill-T9-T10','return-T10-J4']},
  {id:'flat-field-branch',kind:'branch',name:'河湾水田支路',edgeIds:['branch-J4-F1','spill-F1-F2','spill-F2-F3','spill-F3-F4']},
  {id:'downstream-return',kind:'drain',name:'下游排水',edgeIds:['field-return-river']}
].map(c=>({...c,frame:FRAME.id,evidence:{kind:'synthetic',source:'structural hierarchy candidate; not surveyed canal dimensions'}}));
export const carrierById=Object.fromEntries(carriers.map(c=>[c.id,c]));
export const ports=fields.flatMap(f=>{
  const incoming=connections.filter(e=>e.to===f.id),outgoing=connections.filter(e=>e.from===f.id);
  return[
    ...incoming.map(e=>({id:`in-${f.id}-${e.id}`,kind:'field_inlet',fieldId:f.id,edgeId:e.id,position:e.points[e.points.length-1],frame:FRAME.id,evidence:{kind:'synthetic',source:'derived from connected edge'}})),
    ...outgoing.map(e=>({id:`out-${f.id}-${e.id}`,kind:'field_outlet',fieldId:f.id,edgeId:e.id,position:e.points[0],frame:FRAME.id,evidence:{kind:'synthetic',source:'derived from connected edge'}}))
  ];
});
export const portsByField=Object.fromEntries(fields.map(f=>[f.id,{inlets:ports.filter(p=>p.fieldId===f.id&&p.kind==='field_inlet'),outlets:ports.filter(p=>p.fieldId===f.id&&p.kind==='field_outlet')} ]));
export const irrigationHierarchy={sourceId:'spring',trunkCarrierId:'main-canal',divisionNodeIds:junctions.filter(j=>j.kind==='division_control').map(j=>j.id),terminalDistributionNodeId:'J4',branchCarrierIds:['upper-terrace-branch','middle-terrace-branch','lower-terrace-branch','flat-field-branch'],receiverId:'river',allocationPolicy:{status:'un-calibrated',historicalRatio:null,note:'No 3/7 or other historical allocation ratio is asserted in R030.'},frame:FRAME.id};
// R031 morphology layer: reference-informed structural candidates, still synthetic and uncalibrated.
export const bundProfiles={
  terrace:{id:'bund-terrace',kind:'field_bund',regime:'terrace',topWidth:.58,baseWidth:1.18,crestHeight:.34,innerSlope:1.25,outerSlope:1.55,walkable:true,surfaceZones:['walkable_crest','wet_inner_face','vegetated_outer_face'],evidence:{kind:'reference-informed synthetic',source:'user reference images; no surveyed local dimensions'}},
  flat:{id:'bund-flat',kind:'field_bund',regime:'flat',topWidth:.72,baseWidth:1.34,crestHeight:.30,innerSlope:1.45,outerSlope:1.7,walkable:true,surfaceZones:['walkable_crest','wet_inner_face','vegetated_outer_face'],evidence:{kind:'reference-informed synthetic',source:'user reference images; no surveyed local dimensions'}}
};
export const maintenanceProfiles={
  maintained:{id:'maintained',kind:'bund_condition',crestScale:1,topWidthScale:1,roughnessScale:1,vegetationCover:.78,hydraulicPenalty:0,note:'Reference-informed visual/state candidate; not a calibrated age.'},
  worn:{id:'worn',kind:'bund_condition',crestScale:.91,topWidthScale:.94,roughnessScale:1.18,vegetationCover:.58,hydraulicPenalty:.08,note:'Foot traffic / weathering candidate; duration uncalibrated.'},
  eroded:{id:'eroded',kind:'bund_condition',crestScale:.78,topWidthScale:.86,roughnessScale:1.34,vegetationCover:.38,hydraulicPenalty:.18,note:'Local erosion candidate; not a failure probability.'},
  patched:{id:'patched',kind:'bund_condition',crestScale:.96,topWidthScale:1.06,roughnessScale:1.12,vegetationCover:.52,hydraulicPenalty:.04,note:'Recent repair candidate; repair material/local practice unverified.'}
};
export const fieldMaintenance=Object.fromEntries(fields.map((f,i)=>[f.id,{fieldId:f.id,condition:i%7===3?'worn':i%11===6?'patched':'maintained',seed:320913+i*37,evidence:{kind:'synthetic state candidate',source:'reference morphology only; no dated maintenance history'}}]));
export function bundLocalModifiers(fieldId,x,z){const m=fieldMaintenance[fieldId],profile=maintenanceProfiles[m.condition],n=(hash(x*.37+m.seed,z*.41-m.seed)-.5);return{condition:m.condition,crestScale:profile.crestScale*(1+n*.09),topWidthScale:profile.topWidthScale*(1+n*.12),vegetationCover:clamp(profile.vegetationCover+n*.18,.12,.95),roughnessScale:profile.roughnessScale};}
export const canalProfiles={
  headworks:{id:'canal-headworks',kind:'earthen_canal',waterWidth:.58,bankTopWidth:.46,bankHeight:.34,sideSlope:1.35,lining:'earth',evidence:{kind:'synthetic',source:'R030 hierarchy + user morphology references'}},
  trunk:{id:'canal-trunk',kind:'earthen_main_canal',waterWidth:1.08,bankTopWidth:.68,bankHeight:.40,sideSlope:1.45,lining:'earth',evidence:{kind:'synthetic',source:'R030 hierarchy + user morphology references'}},
  branch_supply:{id:'canal-branch',kind:'earthen_branch_canal',waterWidth:.72,bankTopWidth:.54,bankHeight:.34,sideSlope:1.35,lining:'earth',evidence:{kind:'synthetic',source:'R030 hierarchy + user morphology references'}},
  field_spill:{id:'field-drop',kind:'field_drop_transition',waterWidth:.84,bankTopWidth:.36,bankHeight:.26,sideSlope:1.15,lining:'earth',dropApronLength:.82,evidence:{kind:'synthetic',source:'user terrace inlet/outlet/drop references'}},
  branch_return:{id:'canal-return',kind:'earthen_return_canal',waterWidth:.78,bankTopWidth:.50,bankHeight:.32,sideSlope:1.3,lining:'earth',evidence:{kind:'synthetic',source:'R030 hierarchy + user morphology references'}},
  drain:{id:'canal-drain',kind:'earthen_drain',waterWidth:1.05,bankTopWidth:.62,bankHeight:.36,sideSlope:1.45,lining:'earth',evidence:{kind:'synthetic',source:'R030 hierarchy + user morphology references'}}
};
export function canalProfileForRole(role){return canalProfiles[role]||canalProfiles.branch_supply;}
for(const f of fields){f.regime=f.kind==='terrace'?'terrace':'flat';f.bundProfileId=bundProfiles[f.regime].id;}
for(const e of connections)e.morphologyProfileId=canalProfileForRole(e.role).id;
export const portMorphology=ports.map(p=>{const f=fieldById[p.fieldId],edge=connections.find(e=>e.id===p.edgeId),isDrop=edge?.role==='field_spill';return{...p,objectKind:p.kind==='field_inlet'?'field_port_in':'field_port_out',state:'open',defaultOpenness:1,controlMode:'manual_candidate',throatWidth:f.kind==='terrace'?.62:.78,sillHeight:f.bed+(p.kind==='field_inlet'?.015:.01),transition:isDrop?'short_drop':'level_notch',erosionState:'un-calibrated',evidence:{kind:'reference-informed synthetic',source:'user reference images; dimensions not surveyed'}};});
export const portMorphologyById=Object.fromEntries(portMorphology.map(p=>[p.id,p]));
export const edgePortIds=Object.fromEntries(connections.map(e=>[e.id,portMorphology.filter(p=>p.edgeId===e.id).map(p=>p.id)]));
export function edgeOpenness(state,edgeId){const ids=edgePortIds[edgeId]||[];if(!ids.length)return 1;return Math.min(...ids.map(id=>clamp(state.portOpenness?.[id]??1,0,1)));}
export function setPortOpenness(state,portId,value){if(!portMorphologyById[portId])throw Error('Unknown port '+portId);state.portOpenness[portId]=clamp(value,0,1);return state;}

export const dropTransitions=connections.filter(e=>e.role==='field_spill').map(e=>({id:`drop-${e.id}`,kind:'drop_transition',edgeId:e.id,from:e.from,to:e.to,apronLength:canalProfiles.field_spill.dropApronLength,state:'stable_candidate',evidence:{kind:'synthetic',source:'reference morphology only; erosion/stability unvalidated'}}));
export const erosionZones=dropTransitions.map(d=>{const e=connections.find(e=>e.id===d.edgeId),p=e.points[Math.min(1,e.points.length-1)];return{id:`erosion-${d.edgeId}`,kind:'wet_erosion_apron',edgeId:d.edgeId,x:p[0],y:p[1],z:p[2],radius:.92,wetRadius:1.45,state:'active_visual_candidate',evidence:{kind:'reference-informed synthetic',source:'user reference images show localized wet mud and scour near field drops; dimensions uncalibrated'}};});
export const optionalCarriers=[{id:'bamboo-aqueduct-template',kind:'elevated_carrier',material:'bamboo',enabled:false,hydraulicRole:'optional_local_carrier',default:false,evidence:{kind:'reference-only',source:'user bamboo irrigation images; not assumed local or historical for this scene'},note:'Declared as an optional carrier type only. It is not connected to the active R031 hydraulic graph.'}];
export const morphologySummary={bundProfileCount:Object.keys(bundProfiles).length,canalProfileCount:Object.keys(canalProfiles).length,maintenanceProfileCount:Object.keys(maintenanceProfiles).length,fieldPortCount:portMorphology.length,dropTransitionCount:dropTransitions.length,erosionZoneCount:erosionZones.length,optionalCarrierCount:optionalCarriers.length,activeOptionalCarriers:optionalCarriers.filter(x=>x.enabled).length,referenceBoundary:'Cross-region photographs inform morphology classes only; they do not establish local dimensions, date, or prevalence.'};

// R035 reusable system grammar. Source-backed relationships are kept separate from visual-composition inference.
export const terraceSystemRules={
  sourceBacked:{
    catchment:'forested upper catchment / springs feed the irrigation network',
    carriers:'trunk canal distributes to branch ditches and terrace groups',
    basin:'each paddy is a level basin retained by compacted bunds',
    cascade:'controlled outlets may pass water to a lower terrace or return/drain carrier',
    husbandry:'water buffalo and human labour are valid actors in the integrated terrace system'
  },
  geometry:{
    continuousLandform:'rear mountains -> one cultivated hillside -> footslope -> flat paddy plain',
    allObjectsGrounded:true,
    terracesCarvedIntoSlope:true,
    contourFollowing:true,
    parallelBandsForbidden:true,
    widthVariation:'terrace width changes with slope opportunity and local contour curvature',
    inletOutletSeparation:'prefer separated inlet/outlet positions to avoid a purely symbolic short circuit',
    bundContinuity:'bund is continuous except at explicit ports, paths or documented failure'
  },
  composition:{
    hierarchy:['forested catchment','terrace amphitheatre','main canal spine','reflective paddies','human/animal scale anchors'],
    rhythm:'nested contour curves with nonuniform spacing; avoid equal repetition',
    contrast:'bright crop planes against darker bund faces; limited water reflections as focal accents',
    asymmetry:'variation is correlated with terrain and management, not white-noise randomness'
  }
};
export const fieldActors=[
  {id:'farmer-F3-plant-1',kind:'person',role:'transplanting',fieldId:'F3',u:.36,v:.53,heading:-.45},
  {id:'farmer-F3-plant-2',kind:'person',role:'transplanting',fieldId:'F3',u:.58,v:.40,heading:.30},
  {id:'farmer-F4-plant-1',kind:'person',role:'transplanting',fieldId:'F4',u:.46,v:.62,heading:-.20},
  {id:'farmer-T8-bund',kind:'person',role:'bund_walking',fieldId:'T8',u:.62,v:.70,heading:.65},
  {id:'farmer-T5-gate',kind:'person',role:'gate_tending',fieldId:'T5',u:.25,v:.77,heading:-.6},
  {id:'buffalo-F2-1',kind:'water_buffalo',role:'puddling_scale_anchor',fieldId:'F2',u:.58,v:.55,heading:-.18}
].map(a=>({...a,frame:FRAME.id,evidence:{kind:'reference-and-domain-informed synthetic',source:'user planting reference + UNESCO integrated buffalo farming; exact placement synthetic'}}));

export function nodeLabel(id){return id==='spring'?'高位山泉':id==='river'?'下游河段':junctionById[id]?.name||fieldById[id]?.name||id;}
export function segmentProjection(x,z,a,b){const dx=b[0]-a[0],dz=b[2]-a[2],t=clamp(((x-a[0])*dx+(z-a[2])*dz)/(dx*dx+dz*dz),0,1);return{t,d:Math.hypot(x-mix(a[0],b[0],t),z-mix(a[2],b[2],t)),bed:mix(a[1],b[1],t)};}
export function ground(x,z){let y=earthBase(x,z);
  const d=Math.hypot(x-spring.x,z-spring.z);if(d<16){const tc=terraceCoordinate(x,z),guard=tc?1-smooth(0,.06,tc.v):1;const mound=mix(spring.bed+.24,y,smooth(3.6,16,d));y=Math.max(y,mix(y,mound,guard));}if(d<3.6)y=mix(spring.bed,Math.max(y,spring.bed+.24),smooth(2.3,3.6,d));
  // Channels and notches carve the same soil surface used by all display objects.
  let closest=null;
  for(const e of connections)for(let j=0;j<e.points.length-1;j++){
    const p=segmentProjection(x,z,e.points[j],e.points[j+1]),w=e.width*.5+.35;
    if(p.d<w+1.5&&(!closest||p.d<closest.d))closest={...p,w};
  }
  // A continuous earth section supports both excavated and embanked reaches.
  // The old min-only cut could never support a carrier above low ground.
  if(closest){const p=closest;y=mix(p.bed-.12,y,smooth(p.w,p.w+1.5,p.d));}
  return y;
}
export const nodes=[{...spring},...junctions.map(j=>({...j})),...fields.map(f=>({id:f.id,kind:'field_storage',area:f.area,bed:f.bed,initialVolume:f.area*.08})),{...receiver}];
export const nodesById=Object.fromEntries(nodes.map(n=>[n.id,n]));
export function makeState(scenario='normal'){
  const s={time:0,volume:Object.fromEntries(nodes.map(n=>[n.id,n.initialVolume])),lastFlows:{},rain:0,loss:0,scenario,initial:0,clamped:0,portOpenness:Object.fromEntries(portMorphology.map(p=>[p.id,p.defaultOpenness])),maintenance:Object.fromEntries(Object.entries(fieldMaintenance).map(([id,m])=>[id,m.condition]))};
  if(scenario==='dry')s.volume.spring=0;
  if(scenario==='backwater')s.volume.river=nodesById.river.area*(.78-nodesById.river.bed);
  if(scenario==='blocked')for(const id of edgePortIds['spill-T4-T5']||[])s.portOpenness[id]=0;
  if(scenario==='breach')s.maintenance.T4='eroded';
  s.initial=Object.values(s.volume).reduce((a,b)=>a+b,0);return s;
}
export function level(state,id){const n=nodesById[id];return n.bed+state.volume[id]/n.area;}
export function step(state,dt=1){if(!(dt>0&&dt<=30&&Number.isFinite(dt)))throw Error('Time step outside declared model range');
  const proposals=[],outgoing={};
  for(const e of connections){const ha=level(state,e.from),hb=level(state,e.to);const from=ha>=hb?e.from:e.to,to=ha>=hb?e.to:e.from;let crest=e.crest,width=e.width*edgeOpenness(state,e.id);
    if(state.scenario==='breach'&&e.id==='spill-T4-T5'){crest=fieldById.T4.bed;width=2.1;}
    const high=Math.max(ha,hb),low=Math.min(ha,hb),head=Math.max(0,high-Math.max(crest,low));
    const q=e.coefficient*width*Math.sqrt(2*9.81)*Math.pow(head,1.5);
    const equalize=Math.abs(ha-hb)/(1/nodesById[from].area+1/nodesById[to].area);
    const volume=Math.min(q*dt,equalize*.48);proposals.push({id:e.id,from,to,volume,sign:from===e.from?1:-1});outgoing[from]=(outgoing[from]||0)+volume;
  }
  const next={...state.volume},flows={};let newClamps=0,newRain=0;
  for(const p of proposals){const fraction=Math.min(1,state.volume[p.from]/(outgoing[p.from]||1));if(fraction<1)newClamps++;const v=p.volume*fraction;next[p.from]-=v;next[p.to]+=v;flows[p.id]=p.sign*v/dt;}
  if(state.scenario==='flood')for(const f of fields){const rain=f.area*(.045/3600)*dt;next[f.id]+=rain;newRain+=rain;}
  for(const id in next)if(!Number.isFinite(next[id])||next[id]<-1e-9)throw Error('Invalid storage '+id);
  for(const f of fields)if(f.bed+next[f.id]/f.area>f.crest)throw Error('Unsupported overtopping beyond modeled ports: '+f.id);
  state.volume=next;state.lastFlows=flows;state.time+=dt;state.rain+=newRain;state.clamped+=newClamps;return state;
}
export function balance(s){return Object.values(s.volume).reduce((a,b)=>a+b,0)-s.initial-s.rain+s.loss;}
export function waterSurfaceOnEdge(e,state,t){
  const lengths=e.points.slice(1).map((p,i)=>Math.hypot(p[0]-e.points[i][0],p[2]-e.points[i][2]));const total=lengths.reduce((a,b)=>a+b,0);let distance=t*total;
  for(let i=0;i<lengths.length;i++){if(distance<=lengths[i]||i===lengths.length-1){const f=clamp(distance/lengths[i],0,1),p=e.points[i],q=e.points[i+1];return[mix(p[0],q[0],f),mix(p[1],q[1],f)+.015,mix(p[2],q[2],f)];}distance-=lengths[i];}
}
export function validateWorld(){const errors=[];const outgoing={};for(const e of connections){if(!nodesById[e.from]||!nodesById[e.to])errors.push('missing_endpoint:'+e.id);(outgoing[e.from]??=[]).push(e.to);if(e.points.some(p=>p.some(v=>!Number.isFinite(v))))errors.push('invalid_point:'+e.id);}
  const reaches=(a,b,seen=new Set())=>a===b||(!seen.has(a)&&(seen.add(a),(outgoing[a]||[]).some(n=>reaches(n,b,seen))));
  for(const f of fields){if(!reaches('spring',f.id)||!reaches(f.id,'river'))errors.push('orphan:'+f.id);if(!(f.area>10))errors.push('invalid_area:'+f.id);if(!connections.some(e=>e.to===f.id)||!connections.some(e=>e.from===f.id))errors.push('missing_port:'+f.id);}
  for(const j of junctions){const ins=connections.filter(e=>e.to===j.id),outs=connections.filter(e=>e.from===j.id);if(!ins.length||!outs.length)errors.push('invalid_control:'+j.id);if(j.kind==='division_control'&&outs.length<2)errors.push('invalid_division:'+j.id);}
  for(const f of fields){const p=portsByField[f.id];if(p.inlets.length!==1||p.outlets.length!==1)errors.push('port_count:'+f.id);if(!Object.values(bundProfiles).some(b=>b.id===f.bundProfileId))errors.push('bund_profile:'+f.id);}
  for(const e of connections)if(!Object.values(canalProfiles).some(c=>c.id===e.morphologyProfileId))errors.push('canal_profile:'+e.id);
  for(const p of portMorphology)if(!(p.throatWidth>0&&Number.isFinite(p.sillHeight)&&p.defaultOpenness>=0&&p.defaultOpenness<=1))errors.push('port_morphology:'+p.id);
  for(const f of fields)if(!maintenanceProfiles[fieldMaintenance[f.id]?.condition])errors.push('maintenance_profile:'+f.id);
  for(const a of fieldActors)if(!fieldById[a.fieldId])errors.push('actor_field:'+a.id);
  const lf=landformSample();if(!(lf.rear>lf.upperSlope&&lf.upperSlope>lf.midSlope&&lf.midSlope>lf.footslope&&lf.footslope>=lf.plain-.8))errors.push('landform_order');
  for(const a of fieldActors){const f=fieldById[a.fieldId],[x,z]=f.point(f.k,a.u,a.v),gy=ground(x,z);if(!Number.isFinite(gy)||Math.abs(gy-f.bed)>1.5)errors.push('actor_ground:'+a.id);}
  return{ok:errors.length===0,errors,visualSourceVersion:VISUAL_SOURCE_VERSION,fieldCount:fields.length,junctionCount:junctions.length,carrierCount:carriers.length,connections:connections.length,ports:ports.length,bundProfiles:Object.keys(bundProfiles).length,canalProfiles:Object.keys(canalProfiles).length,dropTransitions:dropTransitions.length,optionalCarriers:optionalCarriers.length,frame:FRAME,worldSourceVersion:WORLD_SOURCE_VERSION,runtimeSourceVersion:RUNTIME_SOURCE_VERSION,hierarchySourceVersion:HIERARCHY_SOURCE_VERSION,morphologySourceVersion:MORPHOLOGY_SOURCE_VERSION,controlSourceVersion:CONTROL_SOURCE_VERSION,maintenanceProfiles:Object.keys(maintenanceProfiles).length,erosionZones:erosionZones.length,synthetic:true,visualAcceptance:false,productionReady:false};
}
