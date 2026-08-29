/* v3.4.0 geomorphology synthesis pass: broader karst bodies, hierarchical paddies, restrained river shelves and reference-led colour. */
state.tone=true;
$('toneToggle').classList.add('active');
$('toneToggle').textContent='桂林地貌色彩';

RICH_PALETTE_V330.karstDark.set(0x203a34);
RICH_PALETTE_V330.karstMid.set(0x415748);
RICH_PALETTE_V330.moss.set(0x566b45);
RICH_PALETTE_V330.limestone.set(0x858c82);
RICH_PALETTE_V330.limestoneLight.set(0xa7a99d);
RICH_PALETTE_V330.talus.set(0x80745a);
RICH_PALETTE_V330.soil.set(0x756343);
RICH_PALETTE_V330.fieldDark.set(0x4f6a2d);
RICH_PALETTE_V330.fieldGreen.set(0x769038);
RICH_PALETTE_V330.fieldBright.set(0x9aaa3f);
RICH_PALETTE_V330.fieldGold.set(0xb4a047);
RICH_PALETTE_V330.bund.set(0x66583a);
RICH_PALETTE_V330.channel.set(0x4f756f);
RICH_PALETTE_V330.wet.set(0x668d83);
RICH_PALETTE_V330.bank.set(0x8b7b58);
RICH_PALETTE_V330.sand.set(0xa99c71);
RICH_PALETTE_V330.distant.set(0x718a98);
RICH_PALETTE_V330.waterDeep.set(0x2f6e73);
RICH_PALETTE_V330.waterMid.set(0x4f918e);
RICH_PALETTE_V330.waterEdge.set(0x8fb3a3);

function superellipseRadiusV340(x,y,p=3.25){
  return Math.pow(Math.pow(Math.abs(x),p)+Math.pow(Math.abs(y),p),1/p);
}
function smoothMaximumV340(a,b,k=20){
  if(!Number.isFinite(a))return b;if(!Number.isFinite(b))return a;
  const h=clamp(.5+.5*(a-b)/k,0,1);
  return lerp(b,a,h)+k*h*(1-h);
}

const detectPeaksV340Base=detectPeaksRichV330;
detectPeaksRichV330=function(analysis,maxPeaks=52){
  const peaks=detectPeaksV340Base(analysis,maxPeaks);
  for(let i=0;i<peaks.length;i++){
    const peak=peaks[i],major=i<18,shape=hash21(peak.seed,.41,1601);
    const bodyScale=major?1.11:1.07;
    peak.radiusX*=bodyScale*(.96+shape*.10);
    peak.radiusY*=bodyScale*(1.04-shape*.08);
    peak.targetHeight*=major?1.04:1.00;
    peak.superPower=2.75+hash21(peak.seed,.73,1619)*1.55;
    peak.wallStart=.62+hash21(peak.seed,.83,1637)*.10;
    peak.crownBias=hash21(peak.seed,.97,1657);
    peak.faceSeed=Math.floor(hash21(peak.seed,.29,1669)*100000);
  }
  return peaks;
};
detectPeaks=detectPeaksRichV330;

peakEnvelopeAt=function(worldX,worldY,zBase,fineResidual,peaks){
  let best=-Infinity,second=-Infinity,bestRatio=0,bestInfluence=0,bestCut=0;
  for(const peak of peaks){
    const ca=Math.cos(peak.angle),sa=Math.sin(peak.angle),dx=worldX-peak.x,dy=worldY-peak.y;
    let qx=(dx*ca+dy*sa)/peak.radiusX,qy=(-dx*sa+dy*ca)/peak.radiusY;
    if(Math.abs(qx)>1.72||Math.abs(qy)>1.72)continue;
    const lowWarp=fbm(worldX*.00145,worldY*.00145,peak.seed+7,4),midWarp=fbm(worldX*.0041+8.2,worldY*.0041-5.7,peak.seed+29,3);
    qx+=lowWarp*.060+midWarp*.020;qy+=fbm(worldX*.00145+4.7,worldY*.00145-3.9,peak.seed+19,4)*.060-midWarp*.016;
    const azimuth=Math.atan2(qy,qx),lobe=1+.070*Math.cos(azimuth*3+peak.angle)+.035*Math.cos(azimuth*5+peak.crownBias*5.7);
    qx/=lobe;qy/=lobe;
    const r=superellipseRadiusV340(qx,qy,peak.superPower||3.2);if(r>1.54)continue;
    const wallCore=Math.pow(clamp(1-smoothstep(peak.wallStart||.66,1.025,r),0,1),.34);
    const crownRound=Math.pow(clamp(1-r,0,1),.44+.12*peak.crownBias);
    const crownTilt=clamp(1+(qx*.10-qy*.07)*(peak.crownBias-.5),.86,1.13);
    const shoulderBreak=1-.070*smoothstep(.43,.72,r)+.045*ridged(worldX*.0047,worldY*.0047,peak.faceSeed,3);
    const profile=clamp((wallCore*.72+crownRound*.28)*crownTilt*shoulderBreak,0,1.12);
    const desired=peak.floor+peak.targetHeight*profile+fineResidual*.075;
    const influence=1-smoothstep(1.02,1.34,r);
    let delta=(desired-zBase)*influence;
    const footRing=smoothstep(.86,1.01,r)*(1-smoothstep(1.01,1.48,r));
    const floorTarget=peak.floor+clamp(peak.targetHeight*.018,2.0,6.5);
    const inheritedShoulder=Math.max(0,zBase-floorTarget);
    const footCut=inheritedShoulder*footRing*(.66+.18*lowWarp);
    delta-=footCut;
    if(delta>best){second=best;best=delta;bestRatio=peak.ratio;bestInfluence=influence;bestCut=footCut}else if(delta>second)second=delta;
  }
  if(!Number.isFinite(best))return{delta:0,influence:0,ratio:0};
  const blended=Number.isFinite(second)?smoothMaximumV340(best,second,16):best;
  return{delta:blended-bestCut*.16,influence:bestInfluence,ratio:bestRatio};
};

processMicro=function(worldX,worldY,gx,gy,karstMask,seed=0){
  if(karstMask<.001)return 0;
  const magnitude=Math.hypot(gx,gy)||1,downX=-gx/magnitude,downY=-gy/magnitude,acrossX=-downY,acrossY=downX;
  const warpA=fbm(worldX*.00155,worldY*.00155,seed+13,4),warpB=fbm(worldX*.0042+7.1,worldY*.0042-5.4,seed+31,3);
  const along=worldX*downX+worldY*downY+warpA*88,across=worldX*acrossX+worldY*acrossY+warpB*31;
  const dissolved=(ridged((worldX+warpA*58)*.0045,(worldY-warpB*46)*.0045,seed+53,5)-.59)*.72;
  const fluteCarrier=ridged(along*.0072,across*.00225,seed+71,4);
  const flutes=-Math.pow(smoothstep(.72,.965,fluteCarrier),2.2)*.92;
  const pocket=worley(worldX*.0155+warpA*.52,worldY*.0155+warpB*.52,seed+97);
  const pockets=-smoothstep(.26,.052,pocket.f1)*.44;
  const crackLarge=worley(worldX*.0072+warpB*.23,worldY*.0072-warpA*.23,seed+127);
  const crackMid=worley(worldX*.0205,worldY*.0205,seed+149);
  const cracks=-smoothstep(.076,.010,crackLarge.f2-crackLarge.f1)*.34-smoothstep(.048,.007,crackMid.f2-crackMid.f1)*.15;
  const bedding=(valueNoise(along*.015,across*.0032,seed+173))* .16;
  const crumble=(turbulenceV330(worldX*.0105,worldY*.0105,seed+191,4)-.49)*.18;
  return clamp((dissolved+flutes+pockets+cracks+bedding+crumble)*karstMask,-2.25,1.18);
};

parcelGrammarV330=function(worldX,worldY,seed=0){
  const warpX=fbm(worldX*.00135,worldY*.00135,seed+11,4)*78+fbm(worldX*.0062,worldY*.0062,seed+29,3)*12;
  const warpY=fbm(worldX*.00135+7.7,worldY*.00135-4.2,seed+41,4)*78+fbm(worldX*.0062-5.3,worldY*.0062+9.1,seed+57,3)*12;
  const coarse=worley((worldX+warpX)*.0063,(worldY+warpY)*.0052,seed+73),edgeGap=coarse.f2-coarse.f1;
  const coarseBoundary=smoothstep(.070,.010,edgeGap);
  const fieldSeed=hash21(coarse.cellX,coarse.cellZ,seed+149),rotation=(fieldSeed-.5)*.75;
  const ca=Math.cos(rotation),sa=Math.sin(rotation),u=(worldX+warpX*.22)*ca+(worldY+warpY*.22)*sa,v=-(worldX+warpX*.22)*sa+(worldY+warpY*.22)*ca;
  const contourPhase=Math.abs(Math.sin(u*(.0085+fieldSeed*.0038)+fbm(worldX*.0022,worldY*.0022,seed+101,3)*2.35));
  const crossPhase=Math.abs(Math.sin(v*(.0102+(1-fieldSeed)*.0035)+fbm(worldX*.0028,worldY*.0028,seed+127,3)*1.85));
  const splitGate=smoothstep(.46,.82,fieldSeed),split=Math.max(smoothstep(.050,.009,contourPhase)*splitGate,smoothstep(.046,.008,crossPhase)*(1-splitGate)*.72);
  const drainageA=Math.abs(Math.sin((worldX*.0038+worldY*.0017)+fbm(worldX*.0014,worldY*.0014,seed+173,4)*3.2));
  const drainageB=Math.abs(Math.sin((worldX*-.00155+worldY*.0047)+fbm(worldX*.0019,worldY*.0019,seed+197,3)*2.7));
  const irrigation=Math.max(smoothstep(.036,.006,drainageA),smoothstep(.034,.006,drainageB)*.74)*smoothstep(.07,.42,coarse.f1);
  const boundary=Math.max(coarseBoundary,split*.38),wetness=clamp((fieldSeed-.42)*2.15,0,1)*(.56+.44*fbm(worldX*.0027,worldY*.0027,seed+223,3));
  return{cell:coarse,boundary,irrigation,fieldSeed,wetness,split};
};

paddyDetail=function(worldX,worldY,truth,base,valleyMask,slopeDeg,seed=0){
  const parent=valleyMask*smoothstep(11.5,2.0,slopeDeg);if(parent<.001)return{delta:0,bund:0,channel:0,mask:0};
  const grammar=parcelGrammarV330(worldX,worldY,seed),terraceStep=.28+grammar.fieldSeed*.19;
  const terraceBias=fbm(worldX*.0035,worldY*.0035,seed+241,3)*.12;
  const terrace=Math.round((base+terraceBias)/terraceStep)*terraceStep;
  const flatten=clamp((terrace-base)*.62,-.31,.31);
  const bund=grammar.boundary*(.12+grammar.fieldSeed*.20);
  const channel=grammar.irrigation*(.10+.10*(1-grammar.fieldSeed));
  const micro=fbm(worldX*.075,worldY*.075,seed+263,2)*.022*(1-grammar.boundary);
  const delta=clamp((flatten+bund-channel+micro)*parent,-.40,.39);
  return{delta,bund:bund*parent,channel:channel*parent,mask:parent,fieldSeed:grammar.fieldSeed,wetness:grammar.wetness};
};

fieldColourV330=function(worldX,worldY,mask,layer){
  const grammar=parcelGrammarV330(worldX,worldY,601),seed=grammar.fieldSeed;
  let colour;
  if(seed<.20)colour=RICH_PALETTE_V330.fieldDark.clone();
  else if(seed<.52)colour=RICH_PALETTE_V330.fieldGreen.clone();
  else if(seed<.79)colour=RICH_PALETTE_V330.fieldBright.clone();
  else colour=RICH_PALETTE_V330.fieldGold.clone();
  const broad=fbm(worldX*.0018,worldY*.0018,1801,4),fine=fbm(worldX*.015,worldY*.015,1811,3);
  colour.offsetHSL(broad*.012,fine*.022,fine*.015);
  colour.lerp(RICH_PALETTE_V330.bund,clamp(grammar.boundary*.60*mask,0,.60));
  colour.lerp(RICH_PALETTE_V330.channel,clamp(grammar.irrigation*.76*mask,0,.76));
  colour.lerp(RICH_PALETTE_V330.wet,clamp(grammar.wetness*.30*mask,0,.30));
  if(layer==='regional')colour.lerp(RICH_PALETTE_V330.distant,.075);
  return colour;
};

terrainColourRichV330=function(field,index,heightNorm,worldX,worldY,layer,slopeDeg){
  const valley=field.valley?.[index]??0,karst=field.karst?.[index]??smoothstep(11,38,slopeDeg),paddy=field.paddyMask?.[index]??field.paddy?.[index]??0;
  const exposure=field.exposure?.[index]??smoothstep(27,58,slopeDeg),sediment=field.sediment?.[index]??valley,wetness=field.wetness?.[index]??valley*.45;
  const rugged=field.ruggedness?.[index]??0,curvature=field.curvature?.[index]??0,riverQ=field.riverQ?.[index]??99;
  const broad=fbm(worldX*.00048,worldY*.00048,1853,4),mid=fbm(worldX*.0023+5.2,worldY*.0023-4.8,1867,4),fine=fbm(worldX*.0105,worldY*.0105,1889,3);
  const rockCell=worley(worldX*.00215+broad*.62,worldY*.00215-mid*.42,1901),rockPatch=clamp((rockCell.f2-rockCell.f1)*1.55+ridged(worldX*.0019,worldY*.0019,1913,3)*.40,0,1);
  let colour=RICH_PALETTE_V330.karstDark.clone().lerp(RICH_PALETTE_V330.karstMid,.48+.15*broad+.08*heightNorm);
  const limestone=RICH_PALETTE_V330.limestone.clone().lerp(RICH_PALETTE_V330.limestoneLight,.28+.20*fine);
  const rockBreak=clamp(exposure*(.38+.38*rockPatch)+rugged*.18+Math.max(0,curvature)*.10,0,.84);
  colour.lerp(limestone,rockBreak);
  colour.lerp(RICH_PALETTE_V330.moss,clamp((1-exposure)*(.25+.31*karst)+wetness*.15,0,.55));
  colour.lerp(RICH_PALETTE_V330.talus,clamp(sediment*smoothstep(10,34,slopeDeg)*(1-smoothstep(38,56,slopeDeg))*.38,0,.38));
  const fieldMask=clamp(Math.max(paddy,valley*.82)*smoothstep(15,2.4,slopeDeg),0,1);
  if(fieldMask>.01){
    const fieldColour=fieldColourV330(worldX,worldY,fieldMask,layer),soilMix=clamp(Math.abs(curvature)*.06+(1-wetness)*.035,0,.16);
    fieldColour.lerp(RICH_PALETTE_V330.soil,soilMix);colour.lerp(fieldColour,fieldMask*.94);
  }
  if(riverQ<1.78){
    const wetBank=1-smoothstep(1.00,1.42,riverQ),dryBank=1-smoothstep(1.22,1.78,riverQ);
    colour.lerp(RICH_PALETTE_V330.wet,wetBank*.24);colour.lerp(RICH_PALETTE_V330.bank,dryBank*.36);
  }
  if(layer==='regional')colour.lerp(RICH_PALETTE_V330.distant,.16+.10*(1-heightNorm));
  colour.offsetHSL(broad*.008,mid*.010,fine*.010);
  return colour;
};

makeTerrainMaterialRichV330=function(layer){
  const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:layer==='local'?.89:.94,metalness:0,side:THREE.FrontSide});
  material.dithering=true;material.wireframe=state.wire;
  material.polygonOffset=layer!=='regional';material.polygonOffsetFactor=layer==='local'?-1.2:-.7;material.polygonOffsetUnits=layer==='local'?-1.2:-.7;
  return material;
};

const createTerrainMeshV340Base=createTerrainMesh;
createTerrainMesh=function(field,origin,datum,layer,yOffset=0){
  const mesh=createTerrainMeshV340Base(field,origin,datum,layer,yOffset);
  mesh.castShadow=false;mesh.receiveShadow=false;
  if(mesh.material){mesh.material.dithering=true;mesh.material.needsUpdate=true}
  return mesh;
};

carveRiverSampleV322=function(base,nearest,edge=1){
  if(!nearest)return{height:base,q:Infinity,clearance:0};
  const section=nearest.section,q=nearest.distance/(section.width*.5),channel=clamp(1-q,0,1),clearance=.42+3.08*Math.pow(channel,1.36);
  if(q<=1){
    const target=section.water-clearance;
    return{height:state.enhanceMix>0?target:base,q,clearance};
  }
  const bankBlend=1-smoothstep(1.0,1.82,q);if(bankBlend<=0)return{height:base,q,clearance:0};
  const outer=smoothstep(1.0,1.82,q),curve=Math.min(1,Math.abs(section.curvature||0)*28),bankRise=.72+outer*(2.15+curve*.85),target=section.water+bankRise;
  const strength=state.enhanceMix*state.river*bankBlend*.72*edge;
  return{height:lerp(base,Math.min(base,target),strength),q,clearance:0};
};

createWaterMesh=function(sections,origin,datum){
  if(!sections||sections.length<3)return null;
  const cross=10,cols=11,count=sections.length*cols,positions=new Float32Array(count*3),colors=new Float32Array(count*3),uvs=new Float32Array(count*2);
  let p=0,u=0;
  for(const section of sections){
    for(let j=0;j<=cross;j++){
      const q=j/cross*2-1,x=section.x+section.nx*section.width*.5*q,y=section.y+section.ny*section.width*.5*q;
      const ripple=.006*Math.sin(section.s*.012+q*4.3)+.003*Math.sin(section.s*.027-q*7.1);
      positions[p]=x-origin.x;positions[p+1]=section.water-datum+.032+ripple;positions[p+2]=y-origin.y;
      const edge=Math.abs(q),flow=.5+.5*Math.sin(section.s*.0048+q*1.35),colour=RICH_PALETTE_V330.waterDeep.clone().lerp(RICH_PALETTE_V330.waterMid,smoothstep(.08,.76,edge)).lerp(RICH_PALETTE_V330.waterEdge,smoothstep(.74,1,edge)*.48);
      colour.offsetHSL(0,0,(flow-.5)*.014);colors[p]=colour.r;colors[p+1]=colour.g;colors[p+2]=colour.b;p+=3;uvs[u++]=section.s/220;uvs[u++]=(q+1)*.5;
    }
  }
  const indices=new Uint32Array((sections.length-1)*cross*6);let k=0;
  for(let i=0;i<sections.length-1;i++)for(let j=0;j<cross;j++){const a=i*cols+j,b=a+1,c=a+cols,d=c+1;indices[k++]=a;indices[k++]=c;indices[k++]=b;indices[k++]=b;indices[k++]=c;indices[k++]=d}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));geometry.setAttribute('uv',new THREE.BufferAttribute(uvs,2));geometry.setIndex(new THREE.BufferAttribute(indices,1));geometry.computeVertexNormals();
  const surfaceMaterial=new THREE.MeshPhysicalMaterial({vertexColors:true,roughness:.29,metalness:0,transparent:true,opacity:.76,depthWrite:false,side:THREE.DoubleSide,clearcoat:.48,clearcoatRoughness:.24,ior:1.333});surfaceMaterial.dithering=true;
  const underMaterial=new THREE.MeshBasicMaterial({color:0x24575c,transparent:true,opacity:.24,depthWrite:false,side:THREE.DoubleSide});
  const surface=new THREE.Mesh(geometry,surfaceMaterial);surface.name='lijiang-water-surface';surface.renderOrder=8;surface.castShadow=false;surface.receiveShadow=false;
  const underGeometry=geometry.clone(),underPositions=underGeometry.getAttribute('position');for(let i=0;i<underPositions.count;i++)underPositions.setY(i,underPositions.getY(i)-.24);underPositions.needsUpdate=true;
  const under=new THREE.Mesh(underGeometry,underMaterial);under.name='lijiang-water-depth';under.renderOrder=7;
  const group=new THREE.Group();group.name='lijiang-water-system';group.add(under,surface);return group;
};

createRiverMarginMeshV330=function(build){
  const sections=build.riverSections;if(!sections?.length)return null;
  const field=build.context,vertices=[],colours=[],indices=[],bands=[1.01,1.13,1.34,1.62];
  const add=(x,h,y,c)=>{vertices.push(x-build.origin.x,h-build.datum,y-build.origin.y);colours.push(c.r,c.g,c.b);return vertices.length/3-1};
  for(const side of [-1,1]){
    let previous=null;
    for(let i=0;i<sections.length;i+=3){
      const section=sections[i],pair=[];
      for(let b=0;b<bands.length;b++){
        const q=bands[b],x=section.x+section.nx*section.width*.5*q*side,y=section.y+section.ny*section.width*.5*q*side,sampled=sampleField(field,x,y,'final');
        const cap=[.08,.55,1.45,3.0][b],h=b===0?section.water+.055:Math.min(sampled+.025,section.water+cap);
        const palette=[RICH_PALETTE_V330.wet,RICH_PALETTE_V330.sand,RICH_PALETTE_V330.bank,RICH_PALETTE_V330.soil][b].clone();pair.push(add(x,h,y,palette));
      }
      if(previous)for(let b=0;b<bands.length-1;b++)indices.push(previous[b],pair[b],previous[b+1],previous[b+1],pair[b],pair[b+1]);
      previous=pair;
    }
  }
  if(!indices.length)return null;
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colours,3));geometry.setIndex(indices);geometry.computeVertexNormals();
  const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.98,metalness:0,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});material.dithering=true;
  const mesh=new THREE.Mesh(geometry,material);mesh.name='river-margin-sediment';mesh.castShadow=false;mesh.receiveShadow=false;mesh.renderOrder=5;return mesh;
};

const createSandbarsV340Base=createSandbarsV330;
createSandbarsV330=function(build){
  const mesh=createSandbarsV340Base(build);if(mesh){mesh.material.color?.set?.(0x8f835f);mesh.material.roughness=.98;mesh.castShadow=false;mesh.receiveShadow=false;mesh.scale.y=.65}return mesh;
};

const initRendererV340Base=initRenderer;
initRenderer=async function(){
  await initRendererV340Base();renderer.toneMappingExposure=1.18;
  scene.background=new THREE.Color(0xd5e0e4);scene.fog=new THREE.Fog(0xc2d1d6,6100,22500);
  scene.traverse(object=>{
    if(object.isHemisphereLight){object.color.set(0xdce8ed);object.groundColor.set(0x5f6656);object.intensity=1.42}
    if(object.name==='cool-fill'){object.color.set(0x91afbf);object.intensity=.52}
  });
  sun.color.set(0xffe1ad);sun.intensity=2.72;sun.position.set(-5200,6900,2500);sun.castShadow=false;
};

configureCamera=function(view,build=state.currentBuild){
  if(!build)return;const offset=build.localOffset||{x:0,z:0},targetHeight=build.localTargetHeight||260,id=state.preset.id;
  if(id==='atlas'){camera.fov=38;camera.position.set(3050,1680,4300);controls.target.set(30,245,-320)}
  else if(id==='paddy'){camera.fov=40;camera.position.set(offset.x+620,targetHeight+1120,offset.z+980);controls.target.set(offset.x-30,targetHeight+8,offset.z-70)}
  else if(id==='river'){camera.fov=39;camera.position.set(offset.x+1180,targetHeight+660,offset.z+1510);controls.target.set(offset.x-45,targetHeight+12,offset.z-175)}
  else{camera.fov=39;camera.position.set(offset.x+520,targetHeight+500,offset.z+720);controls.target.set(offset.x-20,targetHeight+145,offset.z-65)}
  camera.updateProjectionMatrix();controls.update();
};

const makeQAV340Base=makeQA;
makeQA=function(build){
  const qa=makeQAV340Base(build);qa.richTerrainPass='v3.4.0';qa.referenceColourModel='gold-standard-01-paddy-valley-palette';qa.karstBodyGrammar='superellipse-wall+crown+foot-contraction';qa.paddyParcelGrammar='hierarchical-cell+contour-split+irrigation';qa.riverMarginProfile='wet-shelf+sand+bank+soil';qa.selfShadowBandingSuppressed=true;qa.waterSurfacePalette='restrained-jade';return qa;
};

document.title='小王 · 桂林地貌蒸馏实验室 v3.4.0';
const brandSmallV340=document.querySelector('.brand small');if(brandSmallV340)brandSmallV340.textContent='XIAOWANG · GUILIN GEOMORPHOLOGY DISTILLATION v3.4.0';
const brandCopyV340=document.querySelector('.brand p');if(brandCopyV340)brandCopyV340.textContent='12.5 米真实 DEM 只读骨架 · 20.48 km 区域层 · 6.4 km 地貌层 · 512 m 局部 1 米增强层 · 多尺度峰林、稻田、水系与沉积协作 · 无植物实例';
