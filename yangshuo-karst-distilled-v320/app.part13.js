/* v3.3.0 rich terrain renderer: geological colour, wet fields, river margins, sandbars and atmospheric depth. */
document.title='小王 · 桂林丰富地形蒸馏实验室 v3.3';
const brandLabelV330=document.querySelector('.brand small');if(brandLabelV330)brandLabelV330.textContent='XIAOWANG · GUILIN RICH TERRAIN DISTILLATION v3.3';
const brandCopyV330=document.querySelector('.brand p');if(brandCopyV330)brandCopyV330.textContent='12.5 米真实 DEM 只读骨架 · 20.48 km 区域层 · 6.4 km 地貌层 · 512 m 局部 1 米增强层 · 峰林、稻田、河床与沉积协作 · 无植物实例';
const RICH_PALETTE_V330={
  karstDark:new THREE.Color(0x294038),karstMid:new THREE.Color(0x3f5845),moss:new THREE.Color(0x53684b),
  limestone:new THREE.Color(0x8e9288),limestoneLight:new THREE.Color(0xa9a89a),talus:new THREE.Color(0x81765f),
  soil:new THREE.Color(0x75684c),fieldGreen:new THREE.Color(0x829638),fieldBright:new THREE.Color(0xa5ad3f),fieldGold:new THREE.Color(0xb8a044),fieldDark:new THREE.Color(0x5f772f),
  bund:new THREE.Color(0x514732),channel:new THREE.Color(0x627f79),wet:new THREE.Color(0x6e8d87),bank:new THREE.Color(0x9c8b62),sand:new THREE.Color(0xb9aa78),
  distant:new THREE.Color(0x71878a),waterDeep:new THREE.Color(0x3f7f86),waterMid:new THREE.Color(0x65a5a4),waterEdge:new THREE.Color(0x91b7a9)
};

function makeNoiseTextureV330(seed=0,size=256){
  const data=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const u=x/size,v=y/size;
    const ridge=ridged(u*7.3,v*7.3,seed+17,5),cell=worley(u*12.5,v*12.5,seed+41),grain=fbm(u*31,v*31,seed+73,3);
    const value=clamp(.34+ridge*.42+(cell.f2-cell.f1)*.20+grain*.08,0,1),b=Math.round(value*255),i=(y*size+x)*4;
    data[i]=b;data[i+1]=b;data[i+2]=b;data[i+3]=255;
  }
  const texture=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);texture.needsUpdate=true;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.generateMipmaps=true;return texture;
}
const rockTextureV330=makeNoiseTextureV330(821),soilTextureV330=makeNoiseTextureV330(907);

function mixColourV330(a,b,t){return a.clone().lerp(b,clamp(t,0,1))}
function fieldColourV330(worldX,worldY,mask,layer){
  if(layer==='regional'){const seed=hash21(Math.floor(worldX/180),Math.floor(worldY/140),601),colour=RICH_PALETTE_V330.fieldDark.clone().lerp(RICH_PALETTE_V330.fieldGold,seed*.72);return colour.lerp(RICH_PALETTE_V330.wet,clamp(mask*.12,0,.12))}
  const grammar=parcelGrammarV330(worldX,worldY,601),season=grammar.fieldSeed;
  let colour=season<.27?RICH_PALETTE_V330.fieldDark.clone():season<.58?RICH_PALETTE_V330.fieldGreen.clone():season<.82?RICH_PALETTE_V330.fieldBright.clone():RICH_PALETTE_V330.fieldGold.clone();
  colour.lerp(RICH_PALETTE_V330.bund,clamp(grammar.boundary*.92*mask,0,.92));
  colour.lerp(RICH_PALETTE_V330.channel,clamp(grammar.irrigation*.78*mask,0,.78));
  colour.lerp(RICH_PALETTE_V330.wet,clamp(grammar.wetness*.34*mask,0,.34));
  return colour;
}
function terrainColourRichV330(field,index,heightNorm,worldX,worldY,layer,slopeDeg){
  const valley=field.valley?.[index]??0,karst=field.karst?.[index]??smoothstep(12,38,slopeDeg),paddy=field.paddyMask?.[index]??field.paddy?.[index]??0;
  const exposure=field.exposure?.[index]??smoothstep(28,58,slopeDeg),sediment=field.sediment?.[index]??valley,wetness=field.wetness?.[index]??valley*.45;
  const rugged=field.ruggedness?.[index]??0,curvature=field.curvature?.[index]??0,riverQ=field.riverQ?.[index]??99;
  const broad=valueNoise(worldX*.00072,worldY*.00072,1001),fine=valueNoise(worldX*.012,worldY*.012,1033),streak=Math.sin(worldX*.012+worldY*.006+valueNoise(worldX*.003,worldY*.003,1069)*2.2);
  let colour=mixColourV330(RICH_PALETTE_V330.karstDark,RICH_PALETTE_V330.karstMid,.42+.28*broad+.18*heightNorm);
  colour.lerp(RICH_PALETTE_V330.moss,clamp((1-exposure)*(.28+.35*karst)+wetness*.12,0,.62));
  const rockBreak=clamp(exposure*(.46+.34*ridged(worldX*.0045,worldY*.0045,1097,3)+.18*streak)+rugged*.18,0,1);
  colour.lerp(mixColourV330(RICH_PALETTE_V330.limestone,RICH_PALETTE_V330.limestoneLight,.35+.25*fine),rockBreak*.80);
  colour.lerp(RICH_PALETTE_V330.talus,clamp(sediment*smoothstep(12,34,slopeDeg)*(1-smoothstep(36,55,slopeDeg))*.48,0,.48));
  if(valley>.18||paddy>.08){
    const fieldMask=clamp(Math.max(paddy,valley*.84)*smoothstep(15,3,slopeDeg),0,1),fieldColour=fieldColourV330(worldX,worldY,fieldMask,layer);
    fieldColour.lerp(RICH_PALETTE_V330.soil,clamp((1-fieldMask)*.35+Math.abs(curvature)*.14,0,.42));
    colour.lerp(fieldColour,fieldMask*.94);
  }
  if(riverQ<1.58){
    const bankMask=1-smoothstep(1.02,1.58,riverQ),sandMask=(1-smoothstep(.82,1.15,riverQ))*.22;
    colour.lerp(RICH_PALETTE_V330.bank,bankMask*.78);colour.lerp(RICH_PALETTE_V330.sand,sandMask);
  }
  if(layer==='regional')colour.lerp(RICH_PALETTE_V330.distant,.18+.14*heightNorm);
  colour.offsetHSL(broad*.015,clamp(fine*.035,-.025,.025),fine*.018);
  return colour;
}

function makeTerrainMaterialRichV330(layer){
  const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:layer==='local'?.84:.91,metalness:0,side:THREE.DoubleSide});
  if(layer!=='regional'){
    material.bumpMap=state.preset.id==='paddy'?soilTextureV330:rockTextureV330;
    material.bumpScale=layer==='local'?(state.preset.id==='cliff'?1.18:.52):.34;
    material.roughnessMap=state.preset.id==='paddy'?soilTextureV330:rockTextureV330;
  }
  material.polygonOffset=layer!=='regional';material.polygonOffsetFactor=layer==='local'?-2:-1;material.polygonOffsetUnits=layer==='local'?-2:-1;material.wireframe=state.wire;return material;
}

const buildLocalFieldsV330Rich=buildLocalFields;
buildLocalFields=function(contextField,localCenter,mode,data,candidate,riverSections){
  const field=buildLocalFieldsV330Rich(contextField,localCenter,mode,data,candidate,riverSections);
  if(riverSections?.length){
    const index=makeRiverIndexV322(riverSections),riverQ=new Float32Array(field.n*field.n),riverSide=new Float32Array(field.n*field.n);riverQ.fill(99);
    for(let z=0;z<field.n;z++)for(let x=0;x<field.n;x++){
      const i=z*field.n+x,nearest=nearestRiverV322(index,field.worldX[x],field.worldY[z]);if(!nearest)continue;riverQ[i]=nearest.distance/(nearest.section.width*.5);riverSide[i]=nearest.side;
    }
    field.riverQ=riverQ;field.riverSide=riverSide;
  }
  return field;
};

createTerrainMesh=function(field,origin,datum,layer,yOffset=0){
  const {n,worldX,worldY,final,spacing}=field,count=n*n,positions=new Float32Array(count*3),colors=new Float32Array(count*3),normals=new Float32Array(count*3),uvs=new Float32Array(count*2);
  let min=Infinity,max=-Infinity;for(const h of final){min=Math.min(min,h);max=Math.max(max,h)}const range=Math.max(1,max-min),normalRadius=layer==='local'?Math.max(2,Math.round(3/spacing)):1;
  for(let z=0;z<n;z++)for(let x=0;x<n;x++){
    const i=z*n+x,o=i*3,u=i*2,h=final[i],x0=Math.max(0,x-normalRadius),x1=Math.min(n-1,x+normalRadius),z0=Math.max(0,z-normalRadius),z1=Math.min(n-1,z+normalRadius);
    const dx=(final[z*n+x1]-final[z*n+x0])/Math.max(1,(x1-x0)*spacing),dz=(final[z1*n+x]-final[z0*n+x])/Math.max(1,(z1-z0)*spacing),inv=1/Math.hypot(dx,1,dz),slopeDeg=Math.atan(Math.hypot(dx,dz))*180/Math.PI;
    positions[o]=worldX[x]-origin.x;positions[o+1]=h-datum+yOffset;positions[o+2]=worldY[z]-origin.y;normals[o]=-dx*inv;normals[o+1]=inv;normals[o+2]=-dz*inv;uvs[u]=worldX[x]/96;uvs[u+1]=worldY[z]/96;
    const c=terrainColourRichV330(field,i,(h-min)/range,worldX[x],worldY[z],layer,slopeDeg);colors[o]=c.r;colors[o+1]=c.g;colors[o+2]=c.b;
  }
  let hole=null;if(layer==='regional')hole={x:field.center.x,y:field.center.y,extent:CONTEXT_EXTENT*.88};else if(layer==='context'&&state.pendingLocalCenter)hole={x:state.pendingLocalCenter.x,y:state.pendingLocalCenter.y,extent:DETAIL_EXTENT*.82};
  const indices=new Uint32Array((n-1)*(n-1)*6);let p=0,holeHalf=hole?hole.extent*.5:0;
  for(let z=0;z<n-1;z++)for(let x=0;x<n-1;x++){
    if(hole){const cx=(worldX[x]+worldX[x+1])*.5,cy=(worldY[z]+worldY[z+1])*.5;if(Math.abs(cx-hole.x)<holeHalf&&Math.abs(cy-hole.y)<holeHalf)continue}
    const a=z*n+x,b=a+1,c=a+n,d=c+1;if((x+z)&1){indices[p++]=a;indices[p++]=c;indices[p++]=d;indices[p++]=a;indices[p++]=d;indices[p++]=b}else{indices[p++]=a;indices[p++]=c;indices[p++]=b;indices[p++]=b;indices[p++]=c;indices[p++]=d}
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('normal',new THREE.BufferAttribute(normals,3));geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));geometry.setAttribute('uv',new THREE.BufferAttribute(uvs,2));geometry.setIndex(new THREE.BufferAttribute(indices.slice(0,p),1));geometry.computeBoundingSphere();
  const mesh=new THREE.Mesh(geometry,makeTerrainMaterialRichV330(layer));mesh.name=`terrain-${layer}`;mesh.renderOrder=layer==='regional'?0:layer==='context'?1:2;mesh.castShadow=layer!=='regional';mesh.receiveShadow=true;return mesh;
};

createWaterMesh=function(sections,origin,datum){
  if(!sections||sections.length<3)return null;const cross=10,cols=11,count=sections.length*cols,positions=new Float32Array(count*3),colors=new Float32Array(count*3),uvs=new Float32Array(count*2);let p=0,u=0;
  for(const section of sections){
    for(let j=0;j<=cross;j++){
      const q=j/cross*2-1,innerBias=-Math.sign(section.curvature||0)*Math.abs(section.curvature||0)*section.width*1.8*(1-q*q),x=section.x+section.nx*(section.width*.5*q+innerBias),y=section.y+section.ny*(section.width*.5*q+innerBias),wave=.025*Math.sin(section.s*.018+q*5.2);
      positions[p]=x-origin.x;positions[p+1]=section.water-datum+.035+wave;positions[p+2]=y-origin.y;
      const edge=Math.abs(q),flow=.5+.5*Math.sin(section.s*.006+q*1.7),c=RICH_PALETTE_V330.waterDeep.clone().lerp(RICH_PALETTE_V330.waterMid,smoothstep(0,.76,edge)).lerp(RICH_PALETTE_V330.waterEdge,smoothstep(.72,1,edge)*.58);c.offsetHSL(0,0,(flow-.5)*.025);
      colors[p]=c.r;colors[p+1]=c.g;colors[p+2]=c.b;p+=3;uvs[u++]=section.s/180;uvs[u++]=(q+1)*.5;
    }
  }
  const indices=new Uint32Array((sections.length-1)*cross*6);let k=0;for(let i=0;i<sections.length-1;i++)for(let j=0;j<cross;j++){const a=i*cols+j,b=a+1,c=a+cols,d=c+1;indices[k++]=a;indices[k++]=c;indices[k++]=b;indices[k++]=b;indices[k++]=c;indices[k++]=d}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));geometry.setAttribute('uv',new THREE.BufferAttribute(uvs,2));geometry.setIndex(new THREE.BufferAttribute(indices,1));geometry.computeVertexNormals();
  const surfaceMaterial=new THREE.MeshPhysicalMaterial({vertexColors:true,roughness:.19,metalness:0,transparent:true,opacity:.82,depthWrite:false,side:THREE.DoubleSide,clearcoat:.72,clearcoatRoughness:.16,ior:1.333});
  const underMaterial=new THREE.MeshBasicMaterial({color:0x2f6670,transparent:true,opacity:.28,depthWrite:false,side:THREE.DoubleSide});
  const surface=new THREE.Mesh(geometry,surfaceMaterial);surface.name='lijiang-water-surface';surface.renderOrder=8;surface.receiveShadow=true;
  const underGeometry=geometry.clone(),underPositions=underGeometry.getAttribute('position');for(let i=0;i<underPositions.count;i++)underPositions.setY(i,underPositions.getY(i)-.22);underPositions.needsUpdate=true;
  const under=new THREE.Mesh(underGeometry,underMaterial);under.name='lijiang-water-depth';under.renderOrder=7;
  const group=new THREE.Group();group.name='lijiang-water-system';group.add(under,surface);return group;
};

function createRiverMarginMeshV330(build){
  const sections=build.riverSections;if(!sections?.length)return null;const field=build.context,vertices=[],colours=[],indices=[];
  const addVertex=(x,y,z,c)=>{vertices.push(x-build.origin.x,y-build.datum,z-build.origin.y);colours.push(c.r,c.g,c.b);return vertices.length/3-1};
  for(const side of [-1,1]){
    let previous=null;
    for(let i=0;i<sections.length;i+=2){const s=sections[i],innerQ=1.01,outerQ=1.30,x0=s.x+s.nx*s.width*.5*innerQ*side,y0=s.y+s.ny*s.width*.5*innerQ*side,x1=s.x+s.nx*s.width*.5*outerQ*side,y1=s.y+s.ny*s.width*.5*outerQ*side,h0=sampleField(field,x0,y0,'final')+.045,h1=sampleField(field,x1,y1,'final')+.045,moist=clamp(1-Math.abs(side*Math.sign(s.curvature||0))*.18,0,1),c0=RICH_PALETTE_V330.sand.clone().lerp(RICH_PALETTE_V330.bank,.42+moist*.12),c1=RICH_PALETTE_V330.bank.clone().lerp(RICH_PALETTE_V330.karstMid,.20);
      const pair=[addVertex(x0,h0,y0,c0),addVertex(x1,h1,y1,c1)];if(previous){indices.push(previous[0],pair[0],previous[1],previous[1],pair[0],pair[1])}previous=pair;
    }
  }
  if(!indices.length)return null;const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colours,3));geometry.setIndex(indices);geometry.computeVertexNormals();const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.97,metalness:0,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-3});const mesh=new THREE.Mesh(geometry,material);mesh.name='river-margin-sediment';mesh.receiveShadow=true;mesh.renderOrder=5;return mesh;
}

function createSandbarsV330(build){
  const sections=build.riverSections;if(!sections?.length)return null;const vertices=[],colours=[],indices=[];let previous=null;
  const add=(x,y,z,c)=>{vertices.push(x-build.origin.x,y-build.datum,z-build.origin.y);colours.push(c.r,c.g,c.b);return vertices.length/3-1};
  for(let i=0;i<sections.length;i+=2){const s=sections[i],curve=s.curvature||0,active=Math.abs(curve)>.0018&&Math.sin(s.s*.0017+curve*90)>.08;if(!active){previous=null;continue}const side=-Math.sign(curve||1),q0=.18,q1=.62,x0=s.x+s.nx*s.width*.5*q0*side,y0=s.y+s.ny*s.width*.5*q0*side,x1=s.x+s.nx*s.width*.5*q1*side,y1=s.y+s.ny*s.width*.5*q1*side,h=s.water+.055,c0=RICH_PALETTE_V330.sand.clone(),c1=RICH_PALETTE_V330.bank.clone().lerp(RICH_PALETTE_V330.sand,.65),pair=[add(x0,h,y0,c0),add(x1,h,y1,c1)];if(previous)indices.push(previous[0],pair[0],previous[1],previous[1],pair[0],pair[1]);previous=pair}
  if(!indices.length)return null;const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colours,3));geometry.setIndex(indices);geometry.computeVertexNormals();const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.95,metalness:0,side:THREE.DoubleSide}));mesh.name='river-inner-bend-sandbars';mesh.renderOrder=9;return mesh;
}

function createPaddyWaterV330(build){
  if(!['atlas','paddy'].includes(state.preset.id)||state.enhanceMix===0)return null;const field=build.local,{n,spacing,worldX,worldY,final}=field,step=isMobile?14:12,positions=[],colours=[],indices=[];
  const add=(x,y,z,c)=>{positions.push(x-build.origin.x,y-build.datum,z-build.origin.y);colours.push(c.r,c.g,c.b);return positions.length/3-1};
  for(let z=step;z<n-step;z+=step)for(let x=step;x<n-step;x+=step){const i=z*n+x,mask=field.paddyMask?.[i]||0;if(mask<.52)continue;const grammar=parcelGrammarV330(worldX[x],worldY[z],601);if(grammar.wetness<.64||grammar.boundary>.35)continue;const half=step*spacing*.34,h=final[i]+.035,c=RICH_PALETTE_V330.wet.clone().lerp(RICH_PALETTE_V330.waterEdge,.35+grammar.wetness*.25),a=add(worldX[x]-half,h,worldY[z]-half,c),b=add(worldX[x]+half,h,worldY[z]-half,c),d=add(worldX[x]-half,h,worldY[z]+half,c),e=add(worldX[x]+half,h,worldY[z]+half,c);indices.push(a,d,b,b,d,e)}
  if(!indices.length)return null;const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colours,3));geometry.setIndex(indices);geometry.computeVertexNormals();const mesh=new THREE.Mesh(geometry,new THREE.MeshPhysicalMaterial({vertexColors:true,roughness:.22,transparent:true,opacity:.66,depthWrite:false,clearcoat:.55,side:THREE.DoubleSide}));mesh.name='paddy-shallow-water';mesh.renderOrder=6;return mesh;
}

function addRichTerrainLayersV330(build){
  const banks=createRiverMarginMeshV330(build);if(banks)terrainGroup.add(banks);const bars=createSandbarsV330(build);if(bars)terrainGroup.add(bars);const paddies=createPaddyWaterV330(build);if(paddies)terrainGroup.add(paddies);
  return{bankVertices:banks?.geometry?.getAttribute('position')?.count||0,sandbarVertices:bars?.geometry?.getAttribute('position')?.count||0,paddyWaterVertices:paddies?.geometry?.getAttribute('position')?.count||0};
}

const initRendererV330=initRenderer;
initRenderer=async function(){
  await initRendererV330();renderer.toneMappingExposure=1.13;scene.background=new THREE.Color(0xc5d0d2);scene.fog=new THREE.Fog(0xc5d0d2,5200,20500);
  scene.traverse(object=>{if(object.isHemisphereLight){object.color.set(0xdce8e9);object.groundColor.set(0x6e644e);object.intensity=1.15}});
  sun.color.set(0xffdfab);sun.intensity=3.55;sun.position.set(-4600,6500,2400);sun.shadow.bias=.00065;sun.shadow.normalBias=2.1;sun.shadow.radius=1.7;
  const fill=new THREE.DirectionalLight(0x91b6c3,.48);fill.position.set(4200,2800,-3600);fill.name='cool-fill';scene.add(fill);
};

configureCamera=function(view,build=state.currentBuild){
  if(!build)return;const offset=build.localOffset||{x:0,z:0},targetHeight=build.localTargetHeight||260,id=state.preset.id;
  if(id==='atlas'){camera.fov=36;camera.position.set(3300,1420,4100);controls.target.set(0,230,-220)}
  else if(id==='paddy'){camera.fov=42;camera.position.set(offset.x+760,targetHeight+390,offset.z+980);controls.target.set(offset.x,targetHeight+4,offset.z-60)}
  else if(id==='river'){camera.fov=39;camera.position.set(offset.x+1120,targetHeight+470,offset.z+1410);controls.target.set(offset.x,targetHeight+18,offset.z-120)}
  else{camera.fov=40;camera.position.set(offset.x+560,targetHeight+330,offset.z+700);controls.target.set(offset.x,targetHeight+105,offset.z-45)}
  camera.updateProjectionMatrix();controls.update();
};

const makeQAV330=makeQA;
makeQA=function(build){const qa=makeQAV330(build);qa.richTerrainPass='v3.3.0';qa.multiFieldBands=['truth','tower-profile','ridge-links','hydraulic-grooves','thermal-talus','karst-micro','paddy-parcels','river-cross-sections','sediment-margins'];qa.colourModel='geomorphology-driven-vertex-albedo';qa.waterSurfaceModel='cross-section-surface-with-bank-and-sandbar-context';return qa};

const buildPresetV330=buildPreset;
buildPreset=async function(id,options={}){
  await buildPresetV330(id,options);if(!state.currentBuild||!window.__terrainV320QA?.ready)return;
  window.__terrainV320QA.ready=false;const overlays=addRichTerrainLayersV330(state.currentBuild);window.__terrainV320QA.richOverlayVertices=overlays;window.__terrainV320QA.ready=true;
  state.tone=true;$('toneToggle').classList.add('active');$('toneToggle').textContent='丰富地貌色彩';
  setStatus('丰富地貌综合版已加载',`${state.currentBuild.candidate.name} · 峰林、稻田、岸坡、河床和沉积分层协作`);configureCamera(state.preset.view,state.currentBuild);
};
