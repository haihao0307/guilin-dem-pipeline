/* v3.7.0 Landscape Mother field-core integration: continuous field graph, deterministic seeds, normalized structural colour, topology-safe Lijiang reach and adaptive interaction quality. */

function hash32V370(n){n=Math.imul(n^(n>>>16),0x7feb352d);n=Math.imul(n^(n>>>15),0x846ca68b);return(n^(n>>>16))>>>0}
function deriveSeedsV370(master=1){const base=Math.max(1,Math.round(master))>>>0,derive=salt=>hash32V370(base^salt)||salt;return Object.freeze({master:base,shape:derive(101),warp:derive(211),structure:derive(307),damage:derive(401),color:derive(503),weather:derive(601),micro:derive(701)})}
const FIELD_SEEDS_V370=deriveSeedsV370(370001);
function sharedWarpV370(worldX,worldY){
  const x=(worldX-450000)*.001,y=(worldY-2750000)*.001;
  const wx=fbm(x*.72,y*.72,FIELD_SEEDS_V370.warp,3),wy=fbm((x+37.1)*.72,(y-19.7)*.72,FIELD_SEEDS_V370.warp+31,3);
  return{x:x+wx*.31,y:y+wy*.31,wx,wy};
}
function clarityV370(v,amount=1){const t=clamp(v,0,1),local=t*t*(3-2*t);return clamp(t+(t-local)*amount*1.35,0,1)}
function autoLevelV370(v,low=.15,high=.85){return clamp((v-low)/Math.max(1e-9,high-low),0,1)}
function separationV370(a,b,sharpness=1){return smoothstep(.02,.38/Math.max(.1,sharpness),Math.abs(a-b))}
function normalizedSplatV370(values,sharpness=2.25){const raw=values.map(value=>Math.pow(Math.max(1e-6,value),sharpness)),sum=raw.reduce((a,b)=>a+b,0)||1;return raw.map(value=>value/sum)}
function fieldGraphV370(worldX,worldY,field,index,slopeDeg){
  const q=sharedWarpV370(worldX,worldY),macro=clamp(.5+.5*fbm(q.x*1.15,q.y*1.15,FIELD_SEEDS_V370.shape,4),0,1),structureA=ridged(q.x*3.15,q.y*3.15,FIELD_SEEDS_V370.structure,4),structureB=ridged(q.x*1.60,q.y*1.60,FIELD_SEEDS_V370.structure+37,3),structure=clarityV370(structureA*.68+structureB*.32,.62),micro=ridged(q.x*15.5,q.y*15.5,FIELD_SEEDS_V370.micro,3),weather=autoLevelV370(.5+.5*fbm(q.x*2.0,q.y*.64,FIELD_SEEDS_V370.weather,3),.28,.82),curvature=clamp((field.curvature?.[index]??0)*.5+.5,0,1),wetBase=field.wetness?.[index]??((field.valley?.[index]??0)*.45),wet=clamp(Number.isFinite(wetBase)?wetBase:0,0,1),exposure=clamp(field.exposure?.[index]??smoothstep(23,57,slopeDeg),0,1),cavity=clamp((1-structure)*.38+(1-curvature)*.22+micro*.14+wet*.14,0,1),protrusion=clamp(structure*.58+macro*.22+curvature*.15+exposure*.18,0,1),separation=separationV370(structure,macro,1.18),driver=clarityV370(autoLevelV370(macro*.30+structure*.25+cavity*.14+weather*.12+separation*.10+exposure*.09,.14,.86),.72);
  return{...q,macro,structure,micro,weather,cavity,protrusion,separation,driver,wet,exposure};
}
function clut5V370(t,stops,target=new THREE.Color()){const x=clamp(t,0,1)*4,i=Math.min(3,Math.floor(x)),f=x-i;return target.copy(stops[i]).lerp(stops[i+1],f)}
const FIELD_PALETTE_V370={
  rock:[new THREE.Color(0x23372f),new THREE.Color(0x3d5245),new THREE.Color(0x66705f),new THREE.Color(0x878778),new THREE.Color(0xaaa797)],
  soil:[new THREE.Color(0x3f372a),new THREE.Color(0x554b36),new THREE.Color(0x6f6242),new THREE.Color(0x806e48),new THREE.Color(0x92805a)],
  paddy:[new THREE.Color(0x38532b),new THREE.Color(0x4e6a30),new THREE.Color(0x668034),new THREE.Color(0x7f8f3c),new THREE.Color(0x928146)],
  wet:[new THREE.Color(0x263f3b),new THREE.Color(0x34564f),new THREE.Color(0x4d7064),new THREE.Color(0x66877a),new THREE.Color(0x829b8d)]
};
const FIELD_COLOUR_SCRATCH_V370={rock:new THREE.Color(),soil:new THREE.Color(),paddy:new THREE.Color(),wet:new THREE.Color(),mix:new THREE.Color()};

function paddyGrammarV370(worldX,worldY,seed=0){
  const q=sharedWarpV370(worldX,worldY),angle=-.22+fbm(q.x*.17,q.y*.17,seed+17,3)*.70,ca=Math.cos(angle),sa=Math.sin(angle),u=q.x*ca+q.y*sa,v=-q.x*sa+q.y*ca;
  const coarse=worley(u*4.7,v*4.0,seed+89),meso=worley((u+fbm(q.x*.8,q.y*.8,seed+101,2)*.10)*9.4,(v+fbm(q.x*.8+4.3,q.y*.8-2.8,seed+113,2)*.10)*7.5,seed+127);
  const parentSeed=hash21(coarse.cellX,coarse.cellZ,seed+149),childSeed=hash21(meso.cellX,meso.cellZ,seed+163),coarseBoundary=smoothstep(.072,.010,coarse.f2-coarse.f1),mesoBoundary=smoothstep(.052,.008,meso.f2-meso.f1),subdivide=smoothstep(.45,.79,parentSeed),directional=Math.abs(Math.sin(u*6.0+fbm(q.x*.58,q.y*.58,seed+181,3)*2.3)),split=(1-smoothstep(.018,.075,directional))*subdivide*.58,boundary=Math.max(coarseBoundary,mesoBoundary*(.18+.65*subdivide),split);
  const flowA=ridged((q.x+fbm(q.x*.34,q.y*.34,seed+197,3)*.35)*2.9,(q.y-fbm(q.x*.34,q.y*.34,seed+211,3)*.20)*.88,seed+229,4),flowB=ridged((q.x-fbm(q.x*.30,q.y*.30,seed+241,3)*.22)*.92,(q.y+fbm(q.x*.30,q.y*.30,seed+257,3)*.32)*2.5,seed+271,4),irrigation=Math.max(smoothstep(.915,.982,flowA),smoothstep(.922,.984,flowB)*.68)*smoothstep(.055,.35,meso.f1)*(1-boundary*.42),fieldSeed=clamp(parentSeed*.42+childSeed*.58,0,1),wetness=clamp(.18+.50*(.5+.5*fbm(q.x*1.9,q.y*1.9,seed+293,3))+.32*(fieldSeed-.5),0,1);
  return{cell:meso,coarse,boundary,irrigation,fieldSeed,wetness,split,orientation:angle,parcelWidthMeters:[85,215],scale:1};
}
paddyGrammarV366=paddyGrammarV370;paddyGrammarV364=paddyGrammarV370;paddyGrammarV363=paddyGrammarV370;paddyGrammarV362=paddyGrammarV370;paddyGrammarV360=paddyGrammarV370;parcelGrammarV330=paddyGrammarV370;

const detectPeaksV370Base=detectPeaksRichV330;
detectPeaksRichV330=function(analysis,maxPeaks=50){
  const peaks=detectPeaksV370Base(analysis,maxPeaks);
  for(const peak of peaks){const variation=.97+hash21(peak.seed,.371,8701)*.07;peak.radiusX*=1.10*variation;peak.radiusY*=1.10*(2-variation);peak.targetHeight*=.94;peak.ratio=clamp((peak.ratio||1.3)*.90,.94,1.84);peak.fieldSeedV370=hash32V370((peak.seed||1)^FIELD_SEEDS_V370.shape)}
  return peaks;
};
detectPeaks=detectPeaksRichV330;
function smoothMaximumV370(a,b,k=8){if(!Number.isFinite(a))return b;if(!Number.isFinite(b))return a;const h=clamp(.5+.5*(a-b)/k,0,1);return lerp(b,a,h)+k*h*(1-h)}
peakEnvelopeAt=function(worldX,worldY,zBase,fineResidual,peaks){
  let best=-Infinity,second=-Infinity,bestRatio=0,bestInfluence=0;
  for(const peak of peaks){
    const ca=Math.cos(peak.angle),sa=Math.sin(peak.angle),dx=worldX-peak.x,dy=worldY-peak.y,q=sharedWarpV370(worldX+peak.fieldSeedV370*.0001,worldY-peak.fieldSeedV370*.0001),broad=fbm(q.x*.65,q.y*.65,peak.fieldSeedV370+17,3),mid=fbm(q.x*2.1+4.2,q.y*2.1-5.1,peak.fieldSeedV370+31,3);let qx=(dx*ca+dy*sa)/peak.radiusX,qy=(-dx*sa+dy*ca)/peak.radiusY;
    qx+=broad*.035+mid*.010;qy+=fbm(q.x*.65+5.7,q.y*.65-3.2,peak.fieldSeedV370+43,3)*.035-mid*.008;const az=Math.atan2(qy,qx),lobe=1+.055*Math.cos(az*3+peak.angle)+.022*Math.cos(az*5+peak.seed*.0017);qx/=lobe;qy/=lobe;const p=2.30+hash21(peak.seed,.617,8731)*.80,r=Math.pow(Math.pow(Math.abs(qx),p)+Math.pow(Math.abs(qy),p),1/p);if(r>1.13)continue;
    const support=1-smoothstep(.965,1.13,r);if(support<=0)continue;const crown=.25+hash21(peak.seed,.239,8741)*.11,wallKnee=.76+hash21(peak.seed,.827,8753)*.07;let profile;
    if(r<=crown)profile=1-(.075+hash21(peak.seed,.417,8761)*.055)*Math.pow(r/crown,1.65);else if(r<=wallKnee)profile=lerp(.91,.76,smoothstep(crown,wallKnee,r));else{const t=clamp((r-wallKnee)/Math.max(.01,1.02-wallKnee),0,1);profile=.055+.705*Math.pow(1-t,.48)}
    const middle=smoothstep(.28,.55,r)*(1-smoothstep(.88,1.03,r)),buttress=Math.pow(Math.max(0,Math.cos(az*(4+Math.floor(hash21(peak.seed,.73,8779)*3))+peak.angle)),3.2)*middle*.045,notch=smoothstep(.80,.965,ridged(q.x*5.2,q.y*5.2,peak.fieldSeedV370+71,3))*middle*.035,inherited=clamp((zBase-peak.floor)/Math.max(32,peak.prominence),0,1.05),target=peak.floor+peak.targetHeight*clamp(profile+buttress-notch+Math.pow(inherited,1.45)*.07*(1-smoothstep(.50,.84,r)),0,1.04)+fineResidual*.04,surface=lerp(zBase,target,support);
    if(surface>best){second=best;best=surface;bestRatio=peak.ratio;bestInfluence=support}else if(surface>second)second=surface;
  }
  if(!Number.isFinite(best))return{delta:0,influence:0,ratio:0};const surface=Number.isFinite(second)?smoothMaximumV370(best,second,7.5):best;return{delta:clamp(surface-zBase,-42,210),influence:bestInfluence,ratio:bestRatio};
};

function contiguousRiverReachV370(points,center,extent){
  if(!points?.length)return[];let focusIndex=0,best=Infinity;for(let i=0;i<points.length;i++){const d=Math.hypot(points[i].x-center.x,points[i].y-center.y);if(d<best){best=d;focusIndex=i}}
  const focusS=points[focusIndex].s,halfArc=extent*.94;let selected=points.filter(point=>point.s>=focusS-halfArc&&point.s<=focusS+halfArc);if(selected.length<8)selected=points.slice(Math.max(0,focusIndex-64),Math.min(points.length,focusIndex+65));
  return selected.map(point=>({...point}));
}
function extendRiverReachV370(points,center,extent){
  if(points.length<2)return points;const out=points.map(point=>({...point})),outside=point=>Math.abs(point.x-center.x)>extent*.56||Math.abs(point.y-center.y)>extent*.56;
  const extend=(front)=>{let guard=0;while(!outside(front?out[0]:out[out.length-1])&&guard++<420){const a=front?out[0]:out[out.length-1],b=front?out[1]:out[out.length-2],dx=a.x-b.x,dy=a.y-b.y,len=Math.hypot(dx,dy)||1,next={x:a.x+dx/len*RIVER_SAMPLE_METERS,y:a.y+dy/len*RIVER_SAMPLE_METERS,s:front?a.s-RIVER_SAMPLE_METERS:a.s+RIVER_SAMPLE_METERS};if(front)out.unshift(next);else out.push(next)}};extend(true);extend(false);return out;
}
prepareRiverSections=function(riverModel,localCenter,extent,data,candidate){
  if(!riverModel?.all?.length)return null;let pts=extendRiverReachV370(contiguousRiverReachV370(riverModel.all,localCenter,extent),localCenter,extent);if(pts.length<8)return null;
  const radius=7,smoothed=pts.map((point,index)=>{let x=0,y=0,weightSum=0;for(let j=Math.max(0,index-radius);j<=Math.min(pts.length-1,index+radius);j++){const w=1-Math.abs(j-index)/(radius+1);x+=pts[j].x*w;y+=pts[j].y*w;weightSum+=w}return{...point,x:x/weightSum,y:y/weightSum}}),heights=smoothed.map(point=>sampleSource(data,candidate,point.x,point.y)),heightSmooth=heights.map((_,index)=>{let sum=0,weightSum=0;for(let j=Math.max(0,index-13);j<=Math.min(heights.length-1,index+13);j++){const w=1-Math.abs(j-index)/14;sum+=heights[j]*w;weightSum+=w}return sum/weightSum});
  let meanS=0,meanH=0;for(let i=0;i<smoothed.length;i++){meanS+=smoothed[i].s;meanH+=heightSmooth[i]}meanS/=smoothed.length;meanH/=smoothed.length;let numerator=0,denominator=0;for(let i=0;i<smoothed.length;i++){numerator+=(smoothed[i].s-meanS)*(heightSmooth[i]-meanH);denominator+=(smoothed[i].s-meanS)**2}const slope=clamp(denominator?numerator/denominator:0,-.0045,.0045),intercept=meanH-slope*meanS,sections=[];
  for(let i=0;i<smoothed.length;i++){const prev=smoothed[Math.max(0,i-1)],next=smoothed[Math.min(smoothed.length-1,i+1)],dx=next.x-prev.x,dy=next.y-prev.y,len=Math.hypot(dx,dy)||1,tx=dx/len,ty=dy/len,nx=-ty,ny=tx;let curvature=0;if(i>0&&i<smoothed.length-1){const a=Math.atan2(smoothed[i].y-smoothed[i-1].y,smoothed[i].x-smoothed[i-1].x),b=Math.atan2(smoothed[i+1].y-smoothed[i].y,smoothed[i+1].x-smoothed[i].x);curvature=Math.atan2(Math.sin(b-a),Math.cos(b-a))}const broad=fbm((smoothed[i].x-450000)*.00075,(smoothed[i].y-2750000)*.00075,FIELD_SEEDS_V370.structure,3),width=clamp(104+broad*24+Math.min(.28,Math.abs(curvature)*9)*44,78,176),water=intercept+slope*smoothed[i].s-.22;sections.push({...smoothed[i],s:i*RIVER_SAMPLE_METERS,tx,ty,nx,ny,width,water,curvature,sourceRunId:'authoritative-lijiang-contiguous-reach'})}
  let maxGap=0,breaks=0;for(let i=1;i<sections.length;i++){const gap=Math.hypot(sections[i].x-sections[i-1].x,sections[i].y-sections[i-1].y);maxGap=Math.max(maxGap,gap);if(gap>RIVER_SAMPLE_METERS*1.8)breaks++}state.riverContinuityV370={sectionCount:sections.length,maxGapMeters:maxGap,internalBreakCount:breaks,endpointOutsideContext:[Math.abs(sections[0].x-localCenter.x)>extent*.52||Math.abs(sections[0].y-localCenter.y)>extent*.52,Math.abs(sections.at(-1).x-localCenter.x)>extent*.52||Math.abs(sections.at(-1).y-localCenter.y)>extent*.52],topologyContinuous:breaks===0};state.richRiverSections=sections;return sections;
};

const terrainColourV370Base=terrainColourRichV330;
terrainColourRichV330=function(field,index,heightNorm,worldX,worldY,layer,slopeDeg){
  const base=terrainColourV370Base(field,index,heightNorm,worldX,worldY,layer,slopeDeg),fields=fieldGraphV370(worldX,worldY,field,index,slopeDeg),valley=clamp(field.valley?.[index]??0,0,1),paddy=clamp(field.paddySmoothV360?.[index]??field.paddyMask?.[index]??field.paddy?.[index]??0,0,1),riverQ=field.riverQ?.[index]??99,rockRaw=clamp(fields.exposure*.58+fields.protrusion*.26+(1-valley)*smoothstep(18,48,slopeDeg)*.32,0,1),paddyRaw=clamp(Math.max(paddy,valley*.72)*smoothstep(14,2.0,slopeDeg),0,1),wetRaw=clamp(fields.wet*.58+(riverQ<2?1-smoothstep(.85,2.0,riverQ):0)*.68,0,1),soilRaw=clamp(1-rockRaw*.76-paddyRaw*.44+valley*.18,0,1),weights=normalizedSplatV370([rockRaw,soilRaw,wetRaw,paddyRaw],2.05),rock=clut5V370(fields.driver,FIELD_PALETTE_V370.rock,FIELD_COLOUR_SCRATCH_V370.rock),soil=clut5V370(fields.macro*.54+fields.weather*.46,FIELD_PALETTE_V370.soil,FIELD_COLOUR_SCRATCH_V370.soil),paddyColour=clut5V370(fields.macro*.42+fields.wet*.34+fields.weather*.24,FIELD_PALETTE_V370.paddy,FIELD_COLOUR_SCRATCH_V370.paddy),wet=clut5V370(fields.wet*.58+fields.cavity*.42,FIELD_PALETTE_V370.wet,FIELD_COLOUR_SCRATCH_V370.wet),mix=FIELD_COLOUR_SCRATCH_V370.mix.setRGB(rock.r*weights[0]+soil.r*weights[1]+wet.r*weights[2]+paddyColour.r*weights[3],rock.g*weights[0]+soil.g*weights[1]+wet.g*weights[2]+paddyColour.g*weights[3],rock.b*weights[0]+soil.b*weights[1]+wet.b*weights[2]+paddyColour.b*weights[3]);
  if(paddyRaw>.02){const grammar=paddyGrammarV370(worldX,worldY,601);mix.lerp(new THREE.Color(0x3c5140),clamp(grammar.boundary*.20*paddyRaw,0,.20));mix.lerp(new THREE.Color(0x365b53),clamp(grammar.irrigation*.30*paddyRaw,0,.30))}mix.offsetHSL(0,fields.separation*.006,(fields.protrusion-fields.cavity)*.016);const strength=state.preset.id==='paddy'?.62:state.preset.id==='atlas'?.46:state.preset.id==='cliff'?.38:.34;base.lerp(mix,strength);if(!Number.isFinite(base.r+base.g+base.b))base.set(0x566447);return base;
};

const makeTerrainMaterialV370Base=makeTerrainMaterialRichV330;
makeTerrainMaterialRichV330=function(layer){const material=makeTerrainMaterialV370Base(layer);material.metalness=0;material.dithering=true;material.roughness=layer==='local'?.94:.97;if(state.preset.id==='paddy'){material.bumpMap=null;material.roughnessMap=null;material.roughness=.99}if(state.preset.id==='atlas'&&layer!=='local'){material.bumpMap=null;material.roughnessMap=null}material.needsUpdate=true;return material};
const createTerrainMeshV370Base=createTerrainMesh;
createTerrainMesh=function(field,origin,datum,layer,yOffset=0){const mesh=createTerrainMeshV370Base(field,origin,datum,layer,yOffset);mesh.matrixAutoUpdate=false;mesh.updateMatrix();if(state.preset.id==='atlas'&&layer==='local'){mesh.visible=false;mesh.userData.hiddenAtlasLocalDetail=true}mesh.castShadow=state.preset.id==='cliff'&&layer!=='regional';mesh.receiveShadow=state.preset.id==='cliff';return mesh};

const initRendererV370Base=initRenderer;
initRenderer=async function(){await initRendererV370Base();const restRatio=isMobile?1:Math.min(window.devicePixelRatio||1,1.25),moveRatio=isMobile?.72:.82;state.runtimeQualityV370={restPixelRatio:restRatio,interactionPixelRatio:moveRatio,adaptive:true};const applyRatio=ratio=>{renderer.setPixelRatio(ratio);renderer.setSize(innerWidth,innerHeight,false)};applyRatio(restRatio);let restoreTimer=0;controls.addEventListener('start',()=>{clearTimeout(restoreTimer);applyRatio(moveRatio);if(renderer.shadowMap)renderer.shadowMap.enabled=false});controls.addEventListener('end',()=>{clearTimeout(restoreTimer);restoreTimer=setTimeout(()=>{applyRatio(restRatio);if(renderer.shadowMap)renderer.shadowMap.enabled=state.preset?.id==='cliff'},160)});controls.enableDamping=true;controls.dampingFactor=.075};

const makeQAV370Base=makeQA;
makeQA=function(build){const qa=makeQAV370Base(build),river=state.riverContinuityV370||{sectionCount:0,maxGapMeters:0,internalBreakCount:0,endpointOutsideContext:[false,false],topologyContinuous:state.preset.id!=='river'},criticalFieldGate=(state.preset.id!=='river'||(river.topologyContinuous&&river.endpointOutsideContext.every(Boolean)))&&qa.truthMutationCount===0;return{...qa,richTerrainPass:'v3.7.0',landscapeMotherFieldCore:'procedural-field-core/v1.0.0',fieldPipeline:['source','shape','data-mask','color','render','qa'],seedChannels:Object.keys(FIELD_SEEDS_V370),sharedDomainWarp:true,scaleBands:['macro','meso','micro'],lowStrengthMultiPass:true,normalizedSplat:true,structuralColourCorrelation:true,riverTopologyRunCount:state.preset.id==='river'?1:0,riverMaxSectionGapMeters:Number((river.maxGapMeters||0).toFixed(4)),riverInternalBreakCount:river.internalBreakCount||0,riverEndpointOutsideContext:river.endpointOutsideContext,riverTopologyContinuous:river.topologyContinuous,adaptiveInteractionQuality:state.runtimeQualityV370||null,truthApproved:false,visualApproved:false,visualAcceptance:false,criticalFieldGate,productionReady:false}};

const buildPresetV370Base=buildPreset;
buildPreset=async function(id,options={}){const result=await buildPresetV370Base(id,options);if(renderer.shadowMap)renderer.shadowMap.enabled=state.preset.id==='cliff';terrainGroup.traverse(object=>{if(object.isMesh){object.castShadow=state.preset.id==='cliff'&&object.name!=='terrain-regional';object.receiveShadow=state.preset.id==='cliff'}});if(window.__terrainV320QA?.ready){window.__terrainV320QA.richTerrainPass='v3.7.0';window.__terrainV320QA.visualApproved=false;window.__terrainV320QA.productionReady=false}setStatus('Landscape Mother v3.7.0 已加载',`${state.currentBuild.candidate.name} · 连续字段图、全局种子、结构综合色彩、连续漓江河段和交互自适应`);return result};

document.title='小王 · Landscape Mother 地貌字段实验室 v3.7.0';
const brandSmallV370=document.querySelector('.brand small');if(brandSmallV370)brandSmallV370.textContent='XIAOWANG · LANDSCAPE MOTHER FIELD CORE v3.7.0';
