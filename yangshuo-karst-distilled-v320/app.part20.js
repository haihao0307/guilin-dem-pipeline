/* v3.4.1 continuity and morphology repair: reshape rounded shoulders, blend the local kilometre-scale patch and naturalize field/river edges. */

RICH_PALETTE_V330.karstDark.set(0x233a34);
RICH_PALETTE_V330.karstMid.set(0x405548);
RICH_PALETTE_V330.moss.set(0x566744);
RICH_PALETTE_V330.limestone.set(0x83897f);
RICH_PALETTE_V330.limestoneLight.set(0x9ea194);
RICH_PALETTE_V330.talus.set(0x796d55);
RICH_PALETTE_V330.soil.set(0x685b3f);
RICH_PALETTE_V330.fieldDark.set(0x526a31);
RICH_PALETTE_V330.fieldGreen.set(0x71863a);
RICH_PALETTE_V330.fieldBright.set(0x87983f);
RICH_PALETTE_V330.fieldGold.set(0x958642);
RICH_PALETTE_V330.bund.set(0x5b5037);
RICH_PALETTE_V330.bank.set(0x766b50);
RICH_PALETTE_V330.sand.set(0x9a9069);
RICH_PALETTE_V330.waterDeep.set(0x326d70);
RICH_PALETTE_V330.waterMid.set(0x4f8886);
RICH_PALETTE_V330.waterEdge.set(0x82a99b);

const detectPeaksV341Base=detectPeaksRichV330;
detectPeaksRichV330=function(analysis,maxPeaks=52){
  const peaks=detectPeaksV341Base(analysis,maxPeaks);
  for(let i=0;i<peaks.length;i++){
    const peak=peaks[i],major=i<18,spread=.98+hash21(peak.seed,.213,2101)*.10;
    peak.radiusX*=major?1.24*spread:1.18*spread;
    peak.radiusY*=major?1.24/spread:1.18/spread;
    peak.targetHeight*=major?.98:.96;
    peak.superPower=2.30+hash21(peak.seed,.417,2111)*1.10;
    peak.wallStart=.50+hash21(peak.seed,.613,2129)*.08;
  }
  return peaks;
};
detectPeaks=detectPeaksRichV330;

function towerShoulderCutV341(field,peaks,strength,maxCut){
  if(!field?.final||!peaks?.length)return field;
  let macroMin=Infinity,macroMax=-Infinity;
  for(let z=0;z<field.n;z++)for(let x=0;x<field.n;x++){
    const i=z*field.n+x,valley=field.valley?.[i]||0;
    if(valley>.58){macroMin=Math.min(macroMin,field.macro?.[i]||0);macroMax=Math.max(macroMax,field.macro?.[i]||0);continue}
    const wx=field.worldX[x],wy=field.worldY[z];let cut=0;
    for(const peak of peaks){
      const ca=Math.cos(peak.angle),sa=Math.sin(peak.angle),dx=wx-peak.x,dy=wy-peak.y;
      const qx=(dx*ca+dy*sa)/peak.radiusX,qy=(-dx*sa+dy*ca)/peak.radiusY,r=superellipseRadiusV340(qx,qy,peak.superPower||2.8);
      if(r<.58||r>1.43)continue;
      const ring=smoothstep(.58,.84,r)*(1-smoothstep(1.04,1.43,r));if(ring<=0)continue;
      const desiredProfile=Math.pow(clamp(1-smoothstep(.48,1.04,r),0,1),.52);
      const target=peak.floor+peak.targetHeight*desiredProfile+4.0;
      const inherited=Math.max(0,field.final[i]-target),asym=.80+.20*fbm(wx*.0021,wy*.0021,peak.seed+701,3);
      cut=Math.max(cut,Math.min(maxCut,inherited*ring*asym));
    }
    const applied=cut*strength*(1-valley*.92);
    if(applied>0){
      if(field.macro)field.macro[i]-=applied;
      field.final[i]-=state.enhanceMix*state.macro*applied;
    }
    macroMin=Math.min(macroMin,field.macro?.[i]||-applied);macroMax=Math.max(macroMax,field.macro?.[i]||0);
  }
  if(field.stats){field.stats.macroMin=macroMin;field.stats.macroMax=macroMax}
  return field;
}

const buildContextFieldsV341Base=buildContextFields;
buildContextFields=function(analysis,peaks,mode){return towerShoulderCutV341(buildContextFieldsV341Base(analysis,peaks,mode),peaks,.88,42)};
const buildRegionalFieldsV341Base=buildRegionalFields;
buildRegionalFields=function(analysis){const field=buildRegionalFieldsV341Base(analysis);return towerShoulderCutV341(field,field.peaks,.34,20)};

function sampleOptionalV341(field,x,y,key,fallback=0){return field?.[key]?sampleField(field,x,y,key):fallback}
const buildLocalFieldsV341Base=buildLocalFields;
buildLocalFields=function(contextField,localCenter,mode,data,candidate,riverSections){
  const field=buildLocalFieldsV341Base(contextField,localCenter,mode,data,candidate,riverSections),count=field.n*field.n;
  const keys=['valley','karst','paddy','wetness','sediment','exposure','ruggedness','curvature'];
  for(const key of keys)field[key]=new Float32Array(count);
  field.localEdge=new Float32Array(count);
  for(let z=0;z<field.n;z++)for(let x=0;x<field.n;x++){
    const i=z*field.n+x,wx=field.worldX[x],wy=field.worldY[z],lx=wx-localCenter.x,ly=wy-localCenter.y,edge=edgeFeather(lx,ly,field.extent,.20);
    field.localEdge[i]=edge;
    for(const key of keys)field[key][i]=sampleOptionalV341(contextField,wx,wy,key,0);
    if(field.paddyMask){const parent=field.paddy[i];field.paddyMask[i]=lerp(parent,field.paddyMask[i],edge)}
    if(field.tone)field.tone[i]=lerp(sampleOptionalV341(contextField,wx,wy,'tone',field.tone[i]),field.tone[i],edge);
  }
  return field;
};

const createTerrainMeshV341Base=createTerrainMesh;
createTerrainMesh=function(field,origin,datum,layer,yOffset=0){
  const mesh=createTerrainMeshV341Base(field,origin,datum,layer,yOffset);
  if(layer==='context'&&state.pendingLocalCenter&&mesh.geometry?.index){
    const positions=mesh.geometry.getAttribute('position'),source=mesh.geometry.index.array,out=[],cx=state.pendingLocalCenter.x-origin.x,cz=state.pendingLocalCenter.y-origin.y,half=DETAIL_EXTENT*.493;
    for(let i=0;i<source.length;i+=3){
      const a=source[i],b=source[i+1],c=source[i+2],mx=(positions.getX(a)+positions.getX(b)+positions.getX(c))/3,mz=(positions.getZ(a)+positions.getZ(b)+positions.getZ(c))/3;
      if(Math.abs(mx-cx)<half&&Math.abs(mz-cz)<half)continue;
      out.push(a,b,c);
    }
    mesh.geometry.setIndex(out);mesh.geometry.computeBoundingSphere();
  }
  return mesh;
};

fieldColourV330=function(worldX,worldY,mask,layer){
  const grammar=parcelGrammarV330(worldX,worldY,601),seed=grammar.fieldSeed;
  let colour=seed<.20?RICH_PALETTE_V330.fieldDark.clone():seed<.55?RICH_PALETTE_V330.fieldGreen.clone():seed<.84?RICH_PALETTE_V330.fieldBright.clone():RICH_PALETTE_V330.fieldGold.clone();
  const broad=fbm(worldX*.00155,worldY*.00155,2203,4),fine=fbm(worldX*.013,worldY*.013,2221,3);
  colour.offsetHSL(broad*.008,fine*.012,fine*.010);
  colour.lerp(RICH_PALETTE_V330.bund,clamp(grammar.boundary*.32*mask,0,.32));
  colour.lerp(RICH_PALETTE_V330.channel,clamp(grammar.irrigation*.64*mask,0,.64));
  colour.lerp(RICH_PALETTE_V330.wet,clamp(grammar.wetness*.22*mask,0,.22));
  if(layer==='regional')colour.lerp(RICH_PALETTE_V330.distant,.08);
  return colour;
};

createRiverMarginMeshV330=function(build){
  const sections=build.riverSections;if(!sections?.length)return null;
  const field=build.context,vertices=[],colours=[],indices=[],bands=[1.005,1.055,1.15,1.34];
  const add=(x,h,y,c)=>{vertices.push(x-build.origin.x,h-build.datum,y-build.origin.y);colours.push(c.r,c.g,c.b);return vertices.length/3-1};
  const palettes=[RICH_PALETTE_V330.wet.clone().lerp(RICH_PALETTE_V330.bank,.38),RICH_PALETTE_V330.bank,RICH_PALETTE_V330.soil,RICH_PALETTE_V330.karstMid];
  for(const side of [-1,1]){
    let previous=null;
    for(let i=0;i<sections.length;i+=2){
      const section=sections[i],pair=[];
      for(let b=0;b<bands.length;b++){
        const q=bands[b],x=section.x+section.nx*section.width*.5*q*side,y=section.y+section.ny*section.width*.5*q*side,sampled=sampleField(field,x,y,'final'),cap=[.055,.30,.92,2.25][b],h=b===0?section.water+.035:Math.min(sampled+.02,section.water+cap);
        const colour=palettes[b].clone();colour.offsetHSL(0,0,fbm(x*.006,y*.006,2309+b,2)*.018);pair.push(add(x,h,y,colour));
      }
      if(previous)for(let b=0;b<bands.length-1;b++)indices.push(previous[b],pair[b],previous[b+1],previous[b+1],pair[b],pair[b+1]);
      previous=pair;
    }
  }
  if(!indices.length)return null;
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colours,3));geometry.setIndex(indices);geometry.computeVertexNormals();
  const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.99,metalness:0,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1.5,polygonOffsetUnits:-1.5});material.dithering=true;
  const mesh=new THREE.Mesh(geometry,material);mesh.name='river-margin-sediment';mesh.castShadow=false;mesh.receiveShadow=false;mesh.renderOrder=5;return mesh;
};

createSandbarsV330=function(build){
  const sections=build.riverSections;if(!sections?.length)return null;const vertices=[],colours=[],indices=[];let previous=null;
  const add=(x,h,y,c)=>{vertices.push(x-build.origin.x,h-build.datum,y-build.origin.y);colours.push(c.r,c.g,c.b);return vertices.length/3-1};
  for(let i=0;i<sections.length;i+=3){
    const section=sections[i],curve=section.curvature||0,active=Math.abs(curve)>.0022&&Math.sin(section.s*.00145+curve*74)>.28;
    if(!active){previous=null;continue}
    const side=-Math.sign(curve||1),q0=.10,q1=.42,x0=section.x+section.nx*section.width*.5*q0*side,y0=section.y+section.ny*section.width*.5*q0*side,x1=section.x+section.nx*section.width*.5*q1*side,y1=section.y+section.ny*section.width*.5*q1*side,h=section.water+.025,c0=RICH_PALETTE_V330.sand.clone().lerp(RICH_PALETTE_V330.bank,.18),c1=RICH_PALETTE_V330.bank.clone().lerp(RICH_PALETTE_V330.sand,.58),pair=[add(x0,h,y0,c0),add(x1,h,y1,c1)];
    if(previous)indices.push(previous[0],pair[0],previous[1],previous[1],pair[0],pair[1]);previous=pair;
  }
  if(!indices.length)return null;const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colours,3));geometry.setIndex(indices);geometry.computeVertexNormals();const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.99,metalness:0,side:THREE.DoubleSide});const mesh=new THREE.Mesh(geometry,material);mesh.name='river-inner-bend-sandbars';mesh.renderOrder=9;mesh.castShadow=false;mesh.receiveShadow=false;return mesh;
};

createPaddyWaterV330=function(build){
  if(!['atlas','paddy'].includes(state.preset.id)||state.enhanceMix===0)return null;
  const field=build.local,{n,spacing,worldX,worldY,final}=field,step=isMobile?15:13,positions=[],colours=[],indices=[];
  const add=(x,h,y,c)=>{positions.push(x-build.origin.x,h-build.datum,y-build.origin.y);colours.push(c.r,c.g,c.b);return positions.length/3-1};
  for(let z=step;z<n-step;z+=step)for(let x=step;x<n-step;x+=step){
    const i=z*n+x,mask=field.paddyMask?.[i]||0;if(mask<.46)continue;const grammar=parcelGrammarV330(worldX[x],worldY[z],601),chance=hash21(Math.floor(worldX[x]/17),Math.floor(worldY[z]/17),2401);if(grammar.wetness<.48||grammar.boundary>.44||chance<.35)continue;
    const half=step*spacing*(.24+.08*chance),angle=(grammar.fieldSeed-.5)*.8,ca=Math.cos(angle),sa=Math.sin(angle),corners=[[-half,-half],[half,-half],[-half,half],[half,half]],ids=[];
    const colour=RICH_PALETTE_V330.wet.clone().lerp(RICH_PALETTE_V330.waterEdge,.22+.18*grammar.wetness),h=final[i]+.028;
    for(const [dx,dy] of corners)ids.push(add(worldX[x]+dx*ca-dy*sa,h,worldY[z]+dx*sa+dy*ca,colour));indices.push(ids[0],ids[2],ids[1],ids[1],ids[2],ids[3]);
  }
  if(!indices.length)return null;const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colours,3));geometry.setIndex(indices);geometry.computeVertexNormals();const material=new THREE.MeshPhysicalMaterial({vertexColors:true,roughness:.31,transparent:true,opacity:.50,depthWrite:false,clearcoat:.34,side:THREE.DoubleSide});const mesh=new THREE.Mesh(geometry,material);mesh.name='paddy-shallow-water';mesh.renderOrder=6;return mesh;
};

configureCamera=function(view,build=state.currentBuild){
  if(!build)return;const offset=build.localOffset||{x:0,z:0},targetHeight=build.localTargetHeight||260,id=state.preset.id;
  if(id==='atlas'){camera.fov=38;camera.position.set(3050,1660,4300);controls.target.set(20,240,-330)}
  else if(id==='paddy'){camera.fov=38;camera.position.set(offset.x+190,targetHeight+1460,offset.z+360);controls.target.set(offset.x-20,targetHeight+5,offset.z-35)}
  else if(id==='river'){camera.fov=39;camera.position.set(offset.x+1110,targetHeight+640,offset.z+1480);controls.target.set(offset.x-30,targetHeight+10,offset.z-175)}
  else{camera.fov=38;camera.position.set(offset.x+450,targetHeight+570,offset.z+650);controls.target.set(offset.x-10,targetHeight+155,offset.z-45)}
  camera.updateProjectionMatrix();controls.update();
};

const makeQAV341Base=makeQA;
makeQA=function(build){const qa=makeQAV341Base(build);qa.richTerrainPass='v3.4.1';qa.localFieldContinuity='context-semantics+edge-feather+full-hole';qa.towerShoulderReshape='negative-excess-cut';qa.riverMarginProfile='narrow-wet-shelf+bank+soil';qa.paddyWaterModel='sparse-rotated-shallow-patches';return qa};

document.title='小王 · 桂林地貌蒸馏实验室 v3.4.1';
const brandSmallV341=document.querySelector('.brand small');if(brandSmallV341)brandSmallV341.textContent='XIAOWANG · GUILIN GEOMORPHOLOGY DISTILLATION v3.4.1';
