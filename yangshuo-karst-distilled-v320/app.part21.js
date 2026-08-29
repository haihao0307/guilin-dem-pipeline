/* v3.4.2 terrain-mass reconstruction: reshape coarse DEM relief into continuous karst towers, remove crater rings and refine valley colour mosaics. */

towerShoulderCutV341=function(field){return field};
const clampLocalCenterV342Base=clampLocalCenter;
clampLocalCenter=function(center,origin){const result=clampLocalCenterV342Base(center,origin);state.pendingLocalCenter={x:result.x,y:result.y};return result};

const detectPeaksV342Source=detectPeaksV340Base;
detectPeaksRichV330=function(analysis,maxPeaks=46){
  const peaks=detectPeaksV342Source(analysis,maxPeaks);
  for(let i=0;i<peaks.length;i++){
    const peak=peaks[i],major=i<18,shape=hash21(peak.seed,.371,2701),cross=hash21(peak.seed,.619,2713);
    peak.targetHeight=clamp(peak.targetHeight*(major?.84:.78),major?118:72,major?272:188);
    const spread=(major?1.58:1.38)*(.94+shape*.12);
    peak.radiusX*=spread*(.93+cross*.14);peak.radiusY*=spread*(1.07-cross*.14);
    peak.superPower=1.72+hash21(peak.seed,.827,2729)*.68;
    peak.radialPower=1.36+hash21(peak.seed,.941,2741)*.34;
    peak.profilePower=.62+hash21(peak.seed,.287,2753)*.20;
    peak.crownShiftX=(hash21(peak.seed,.513,2767)-.5)*.19;
    peak.crownShiftY=(hash21(peak.seed,.777,2777)-.5)*.19;
    peak.faceSeed=Math.floor(hash21(peak.seed,.393,2791)*100000);
  }
  return peaks;
};
detectPeaks=detectPeaksRichV330;

peakEnvelopeAt=function(worldX,worldY,zBase,fineResidual,peaks){
  let surfaceA=-Infinity,surfaceB=-Infinity,bestRatio=0,bestInfluence=0;
  for(const peak of peaks){
    const ca=Math.cos(peak.angle),sa=Math.sin(peak.angle),dx=worldX-peak.x,dy=worldY-peak.y;
    let qx=(dx*ca+dy*sa)/peak.radiusX,qy=(-dx*sa+dy*ca)/peak.radiusY;
    if(Math.abs(qx)>1.55||Math.abs(qy)>1.55)continue;
    const warpA=fbm(worldX*.00155,worldY*.00155,peak.faceSeed+7,4),warpB=fbm(worldX*.0037+4.8,worldY*.0037-6.2,peak.faceSeed+23,3);
    qx+=warpA*.052+warpB*.018;qy+=fbm(worldX*.00155+7.1,worldY*.00155-3.7,peak.faceSeed+17,4)*.052-warpB*.014;
    const azimuth=Math.atan2(qy,qx),lobe=1+.050*Math.cos(azimuth*3+peak.angle)+.022*Math.cos(azimuth*5+peak.crownShiftX*11);
    qx/=lobe;qy/=lobe;
    const r=superellipseRadiusV340(qx,qy,peak.superPower);if(r>1.26)continue;
    const support=1-smoothstep(.98,1.26,r);if(support<=0)continue;
    const shiftedR=superellipseRadiusV340(qx-peak.crownShiftX*(1-r),qy-peak.crownShiftY*(1-r),peak.superPower);
    const radial=Math.pow(clamp(1-Math.pow(clamp(shiftedR,0,1.12),peak.radialPower),0,1),peak.profilePower);
    const inherited=clamp((zBase-peak.floor)/Math.max(24,peak.prominence),0,1.18);
    const inheritedShape=Math.pow(inherited,1.42);
    const faceBreak=(ridged(worldX*.0034,worldY*.0034,peak.faceSeed+41,4)-.54)*.055*(1-smoothstep(.82,1.08,r));
    const contourBias=Math.cos(azimuth*2+peak.angle)*.025*(1-r);
    const shape=clamp(radial*.76+inheritedShape*.24+faceBreak+contourBias,0,1.10);
    const target=peak.floor+peak.targetHeight*shape+fineResidual*.055;
    const surface=lerp(zBase,target,support);
    if(surface>surfaceA){surfaceB=surfaceA;surfaceA=surface;bestRatio=peak.ratio;bestInfluence=support}else if(surface>surfaceB)surfaceB=surface;
  }
  if(!Number.isFinite(surfaceA))return{delta:0,influence:0,ratio:0};
  const blended=Number.isFinite(surfaceB)?smoothMaximumV340(surfaceA,surfaceB,9):surfaceA;
  return{delta:clamp(blended-zBase,-58,218),influence:bestInfluence,ratio:bestRatio};
};

fieldColourV330=function(worldX,worldY,mask,layer){
  const grammar=parcelGrammarV330(worldX,worldY,601),warpX=fbm(worldX*.0016,worldY*.0016,2861,3)*52,warpY=fbm(worldX*.0016+5.7,worldY*.0016-3.4,2879,3)*52;
  const sub=worley((worldX+warpX)*.0105,(worldY+warpY)*.0085,2897),subSeed=hash21(sub.cellX,sub.cellZ,2917),seed=clamp(grammar.fieldSeed*.68+subSeed*.32,0,1);
  let colour=seed<.19?RICH_PALETTE_V330.fieldDark.clone():seed<.50?RICH_PALETTE_V330.fieldGreen.clone():seed<.82?RICH_PALETTE_V330.fieldBright.clone():RICH_PALETTE_V330.fieldGold.clone();
  const broad=fbm(worldX*.00135,worldY*.00135,2939,4),fine=fbm(worldX*.0105,worldY*.0105,2953,3),subEdge=smoothstep(.060,.012,sub.f2-sub.f1);
  colour.offsetHSL(broad*.006,fine*.010,fine*.009);
  colour.lerp(RICH_PALETTE_V330.soil,clamp(subEdge*.075*mask,0,.075));
  colour.lerp(RICH_PALETTE_V330.bund,clamp(grammar.boundary*.27*mask,0,.27));
  colour.lerp(RICH_PALETTE_V330.channel,clamp(grammar.irrigation*.58*mask,0,.58));
  colour.lerp(RICH_PALETTE_V330.wet,clamp(grammar.wetness*.18*mask,0,.18));
  if(layer==='regional')colour.lerp(RICH_PALETTE_V330.distant,.085);return colour;
};

const terrainColourV342Base=terrainColourRichV330;
terrainColourRichV330=function(field,index,heightNorm,worldX,worldY,layer,slopeDeg){
  const colour=terrainColourV342Base(field,index,heightNorm,worldX,worldY,layer,slopeDeg),valley=field.valley?.[index]||0,exposure=field.exposure?.[index]||0;
  if(exposure>.48)colour.lerp(RICH_PALETTE_V330.limestone,(exposure-.48)*.10);
  if(valley>.58)colour.lerp(RICH_PALETTE_V330.fieldGreen,(valley-.58)*.05);
  return colour;
};

const createTerrainMeshV342Base=createTerrainMesh;
createTerrainMesh=function(field,origin,datum,layer,yOffset=0){
  const mesh=createTerrainMeshV342Base(field,origin,datum,layer,yOffset);
  if(layer==='context'&&state.pendingLocalCenter&&mesh.geometry?.index){
    const position=mesh.geometry.getAttribute('position'),source=mesh.geometry.index.array,out=[],cx=state.pendingLocalCenter.x-origin.x,cz=state.pendingLocalCenter.y-origin.y,half=DETAIL_EXTENT*.492;
    for(let i=0;i<source.length;i+=3){const a=source[i],b=source[i+1],c=source[i+2],mx=(position.getX(a)+position.getX(b)+position.getX(c))/3,mz=(position.getZ(a)+position.getZ(b)+position.getZ(c))/3;if(Math.abs(mx-cx)<half&&Math.abs(mz-cz)<half)continue;out.push(a,b,c)}
    mesh.geometry.setIndex(out);mesh.geometry.computeBoundingSphere();
  }
  return mesh;
};

createPaddyWaterV330=function(build){
  if(!['atlas','paddy'].includes(state.preset.id)||state.enhanceMix===0)return null;
  const field=build.local,{n,spacing,worldX,worldY,final}=field,step=isMobile?17:14,positions=[],colours=[],indices=[];
  const add=(x,h,y,c)=>{positions.push(x-build.origin.x,h-build.datum,y-build.origin.y);colours.push(c.r,c.g,c.b);return positions.length/3-1};
  for(let z=step;z<n-step;z+=step)for(let x=step;x<n-step;x+=step){
    const i=z*n+x,mask=field.paddyMask?.[i]||0;if(mask<.52)continue;const grammar=parcelGrammarV330(worldX[x],worldY[z],601),chance=hash21(Math.floor(worldX[x]/19),Math.floor(worldY[z]/19),3011);if(grammar.wetness<.56||grammar.boundary>.36||chance<.52)continue;
    const half=step*spacing*(.18+.055*chance),angle=(grammar.fieldSeed-.5)*.72,ca=Math.cos(angle),sa=Math.sin(angle),corners=[[-half,-half],[half,-half],[-half,half],[half,half]],ids=[],colour=RICH_PALETTE_V330.wet.clone().lerp(RICH_PALETTE_V330.waterEdge,.16+.12*grammar.wetness),h=final[i]+.025;
    for(const [px,py] of corners)ids.push(add(worldX[x]+px*ca-py*sa,h,worldY[z]+px*sa+py*ca,colour));indices.push(ids[0],ids[2],ids[1],ids[1],ids[2],ids[3]);
  }
  if(!indices.length)return null;const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colours,3));geometry.setIndex(indices);geometry.computeVertexNormals();const material=new THREE.MeshPhysicalMaterial({vertexColors:true,roughness:.34,transparent:true,opacity:.42,depthWrite:false,clearcoat:.26,side:THREE.DoubleSide});const mesh=new THREE.Mesh(geometry,material);mesh.name='paddy-shallow-water';mesh.renderOrder=6;return mesh;
};

configureCamera=function(view,build=state.currentBuild){
  if(!build)return;const offset=build.localOffset||{x:0,z:0},targetHeight=build.localTargetHeight||260,id=state.preset.id;
  if(id==='atlas'){camera.fov=38;camera.position.set(3160,1600,4380);controls.target.set(20,235,-340)}
  else if(id==='paddy'){camera.fov=40;camera.position.set(offset.x+910,targetHeight+920,offset.z+1390);controls.target.set(offset.x-35,targetHeight+12,offset.z-80)}
  else if(id==='river'){camera.fov=39;camera.position.set(offset.x+1120,targetHeight+640,offset.z+1500);controls.target.set(offset.x-35,targetHeight+10,offset.z-175)}
  else{camera.fov=40;camera.position.set(offset.x+760,targetHeight+520,offset.z+1050);controls.target.set(offset.x-20,targetHeight+125,offset.z-80)}
  camera.updateProjectionMatrix();controls.update();
};

const makeQAV342Base=makeQA;
makeQA=function(build){const qa=makeQAV342Base(build);qa.richTerrainPass='v3.4.2';qa.karstMassMethod='relief-remap+continuous-radial-profile';qa.craterRingSuppressed=true;qa.localFieldContinuity='semantic-inheritance+context-hole+edge-feather';qa.fieldColourGrammar='coarse-parcel+subparcel-cell';return qa};

document.title='小王 · 桂林地貌蒸馏实验室 v3.4.2';
const brandSmallV342=document.querySelector('.brand small');if(brandSmallV342)brandSmallV342.textContent='XIAOWANG · GUILIN GEOMORPHOLOGY DISTILLATION v3.4.2';
