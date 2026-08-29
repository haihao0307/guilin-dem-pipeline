/* v3.4.3 close-range richness pass: aerial paddy composition, local karst fracture detail and restrained river margins. */

const buildLocalFieldsV343Base=buildLocalFields;
buildLocalFields=function(contextField,localCenter,mode,data,candidate,riverSections){
  const field=buildLocalFieldsV343Base(contextField,localCenter,mode,data,candidate,riverSections);
  if(mode==='cliff'){
    let localMin=Infinity,localMax=-Infinity;
    for(let z=1;z<field.n-1;z++)for(let x=1;x<field.n-1;x++){
      const i=z*field.n+x,k=field.karst?.[i]||0;if(k<.015)continue;
      const gx=(field.truth[i+1]-field.truth[i-1])/(field.spacing*2),gy=(field.truth[i+field.n]-field.truth[i-field.n])/(field.spacing*2),edge=field.localEdge?.[i]??edgeFeather(field.worldX[x]-localCenter.x,field.worldY[z]-localCenter.y,field.extent,.20);
      const detail=processMicro(field.worldX[x],field.worldY[z],gx,gy,k,3403)*.72*edge;
      field.final[i]+=state.enhanceMix*state.process*detail;if(field.micro)field.micro[i]+=detail;
      localMin=Math.min(localMin,detail);localMax=Math.max(localMax,detail);
    }
    if(field.stats){field.stats.localMicroMin=Number.isFinite(localMin)?localMin:0;field.stats.localMicroMax=Number.isFinite(localMax)?localMax:0}
  }
  return field;
};

const terrainColourV343Base=terrainColourRichV330;
terrainColourRichV330=function(field,index,heightNorm,worldX,worldY,layer,slopeDeg){
  const colour=terrainColourV343Base(field,index,heightNorm,worldX,worldY,layer,slopeDeg);
  if(layer==='local'&&state.preset.id==='cliff'){
    const karst=field.karst?.[index]||0,exposure=field.exposure?.[index]||smoothstep(25,55,slopeDeg),streak=ridged(worldX*.0105,worldY*.0032,3449,4),cell=worley(worldX*.018,worldY*.018,3463),fissure=smoothstep(.055,.008,cell.f2-cell.f1),rock=clamp(karst*(.12+exposure*.24+smoothstep(.60,.92,streak)*.20),0,.46);
    colour.lerp(RICH_PALETTE_V330.limestone.clone().lerp(RICH_PALETTE_V330.limestoneLight,.24),rock);
    colour.lerp(RICH_PALETTE_V330.karstDark,clamp(fissure*karst*.11,0,.11));
  }
  return colour;
};

const makeTerrainMaterialV343Base=makeTerrainMaterialRichV330;
makeTerrainMaterialRichV330=function(layer){
  const material=makeTerrainMaterialV343Base(layer);
  if(layer==='local'&&state.preset.id==='cliff'){
    rockTextureV330.wrapS=rockTextureV330.wrapT=THREE.RepeatWrapping;rockTextureV330.repeat.set(3.1,3.1);rockTextureV330.anisotropy=8;rockTextureV330.needsUpdate=true;
    material.bumpMap=rockTextureV330;material.bumpScale=.58;material.roughnessMap=rockTextureV330;material.roughness=.91;material.needsUpdate=true;
  }
  return material;
};

createRiverMarginMeshV330=function(build){
  const sections=build.riverSections;if(!sections?.length)return null;
  const field=build.context,vertices=[],colours=[],indices=[],bands=[1.002,1.028,1.075,1.155];
  const add=(x,h,y,c)=>{vertices.push(x-build.origin.x,h-build.datum,y-build.origin.y);colours.push(c.r,c.g,c.b);return vertices.length/3-1};
  const palettes=[RICH_PALETTE_V330.wet.clone().lerp(RICH_PALETTE_V330.bank,.58),RICH_PALETTE_V330.bank.clone().lerp(RICH_PALETTE_V330.soil,.26),RICH_PALETTE_V330.soil.clone().lerp(RICH_PALETTE_V330.karstMid,.15),RICH_PALETTE_V330.karstMid.clone().lerp(RICH_PALETTE_V330.moss,.20)];
  for(const side of [-1,1]){
    let previous=null;
    for(let i=0;i<sections.length;i+=2){
      const section=sections[i],pair=[];
      for(let b=0;b<bands.length;b++){
        const q=bands[b],x=section.x+section.nx*section.width*.5*q*side,y=section.y+section.ny*section.width*.5*q*side,sampled=sampleField(field,x,y,'final'),cap=[.045,.20,.58,1.35][b],h=b===0?section.water+.028:Math.min(sampled+.018,section.water+cap),colour=palettes[b].clone();
        colour.offsetHSL(0,0,fbm(x*.006,y*.006,3503+b,2)*.012);pair.push(add(x,h,y,colour));
      }
      if(previous)for(let b=0;b<bands.length-1;b++)indices.push(previous[b],pair[b],previous[b+1],previous[b+1],pair[b],pair[b+1]);previous=pair;
    }
  }
  if(!indices.length)return null;const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colours,3));geometry.setIndex(indices);geometry.computeVertexNormals();const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.99,metalness:0,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1.2,polygonOffsetUnits:-1.2});material.dithering=true;const mesh=new THREE.Mesh(geometry,material);mesh.name='river-margin-sediment';mesh.castShadow=false;mesh.receiveShadow=false;mesh.renderOrder=5;return mesh;
};

const initRendererV343Base=initRenderer;
initRenderer=async function(){await initRendererV343Base();renderer.toneMappingExposure=1.10;sun.intensity=2.48;scene.fog.near=5700;scene.fog.far=21800};

configureCamera=function(view,build=state.currentBuild){
  if(!build)return;const offset=build.localOffset||{x:0,z:0},targetHeight=build.localTargetHeight||260,id=state.preset.id;
  if(id==='atlas'){camera.fov=38;camera.position.set(3160,1580,4380);controls.target.set(20,235,-340)}
  else if(id==='paddy'){camera.fov=36;camera.position.set(offset.x+120,targetHeight+1540,offset.z+460);controls.target.set(offset.x-10,targetHeight+8,offset.z-85)}
  else if(id==='river'){camera.fov=39;camera.position.set(offset.x+1120,targetHeight+640,offset.z+1500);controls.target.set(offset.x-35,targetHeight+10,offset.z-175)}
  else{camera.fov=39;camera.position.set(offset.x+610,targetHeight+420,offset.z+860);controls.target.set(offset.x-15,targetHeight+145,offset.z-55)}
  camera.updateProjectionMatrix();controls.update();
};

const makeQAV343Base=makeQA;
makeQA=function(build){const qa=makeQAV343Base(build);qa.richTerrainPass='v3.4.3';qa.cliffLocalDetail='geometry-micro+procedural-bump';qa.paddyReviewCamera='high-oblique-aerial';qa.riverMarginProfile='restrained-four-band';qa.toneMappingExposure=1.10;return qa};

document.title='小王 · 桂林地貌蒸馏实验室 v3.4.3';
const brandSmallV343=document.querySelector('.brand small');if(brandSmallV343)brandSmallV343.textContent='XIAOWANG · GUILIN GEOMORPHOLOGY DISTILLATION v3.4.3';
