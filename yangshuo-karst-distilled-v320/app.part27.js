/* v3.4.8 valley readability pass: smaller irregular paddies, exposed karst faces, aerial field review and wider restrained river margins. */
state.tone=true;
$('toneToggle').classList.add('active');
$('toneToggle').textContent='桂林地貌色彩';

RICH_PALETTE_V330.fieldDark.set(0x4b5935);
RICH_PALETTE_V330.fieldGreen.set(0x606d3d);
RICH_PALETTE_V330.fieldBright.set(0x748044);
RICH_PALETTE_V330.fieldGold.set(0x82754a);
RICH_PALETTE_V330.bund.set(0x514737);
RICH_PALETTE_V330.channel.set(0x465e58);
RICH_PALETTE_V330.wet.set(0x576d65);
RICH_PALETTE_V330.bank.set(0x675d49);
RICH_PALETTE_V330.sand.set(0x81765b);
RICH_PALETTE_V330.waterDeep.set(0x2d5b5c);
RICH_PALETTE_V330.waterMid.set(0x416f6b);
RICH_PALETTE_V330.waterEdge.set(0x70877b);

function parcelFrameV348(worldX,worldY,seed=0,scale=1){
  const tileSize=260*scale,tileX=Math.floor(worldX/tileSize),tileY=Math.floor(worldY/tileSize),tileSeed=hash21(tileX,tileY,seed+31);
  const angle=fbm(worldX*(.00058/scale),worldY*(.00058/scale),seed+47,4)*.66+(tileSeed-.5)*.40;
  const ca=Math.cos(angle),sa=Math.sin(angle);
  const warpU=fbm(worldX*(.00155/scale),worldY*(.00155/scale),seed+61,4)*(20*scale)+fbm(worldX*(.0062/scale),worldY*(.0062/scale),seed+79,3)*(4.2*scale);
  const warpV=fbm(worldX*(.00155/scale)+6.4,worldY*(.00155/scale)-4.2,seed+97,4)*(20*scale)+fbm(worldX*(.0062/scale)-4.1,worldY*(.0062/scale)+7.3,seed+113,3)*(4.2*scale);
  const u=(worldX+warpU)*ca+(worldY+warpV)*sa,v=-(worldX+warpU)*sa+(worldY+warpV)*ca;
  const widthU=(32+hash21(tileX,tileY,seed+131)*26)*scale,widthV=(58+hash21(tileX,tileY,seed+149)*48)*scale;
  const cellU=Math.floor(u/widthU),cellV=Math.floor(v/widthV),fu=fract(u/widthU),fv=fract(v/widthV),du=Math.min(fu,1-fu),dv=Math.min(fv,1-fv);
  const edgeU=1-smoothstep(.020,.072,du),edgeV=1-smoothstep(.013,.048,dv);
  const seedU=hash21(cellU,cellV,seed+173),seedV=hash21(cellU,cellV,seed+191),mergeU=seedU<.24?.14:1,mergeV=seedV<.17?.18:1;
  const contour=Math.abs(Math.sin((u+fbm(worldX*(.0022/scale),worldY*(.0022/scale),seed+211,3)*(18*scale))*(.0062/scale)));
  const contourBund=(1-smoothstep(.012,.046,contour))*smoothstep(.70,.93,tileSeed);
  const boundary=Math.max(edgeU*mergeU,edgeV*mergeV,contourBund*.34);
  const majorU=edgeU*(hash21(cellU,Math.floor(cellV/3),seed+229)>.84?1:0),majorV=edgeV*(hash21(Math.floor(cellU/4),cellV,seed+241)>.88?1:0);
  const meander=Math.abs(Math.sin(worldX*(.0032/scale)+worldY*(.00125/scale)+fbm(worldX*(.00105/scale),worldY*(.00105/scale),seed+257,4)*3.0));
  const drainage=(1-smoothstep(.009,.036,meander))*.70;
  const irrigation=Math.max(majorU,majorV,drainage*smoothstep(.035,.22,Math.min(du,dv)));
  const fieldSeed=hash21(cellU,cellV,seed+277),wetness=clamp((fieldSeed-.40)*1.68,0,1)*(.58+.42*fbm(worldX*(.0021/scale),worldY*(.0021/scale),seed+293,3));
  return{angle,u,v,widthU,widthV,cellU,cellV,fu,fv,du,dv,boundary,irrigation,fieldSeed,wetness,split:Math.max(edgeU,edgeV)};
}

parcelFrameV345=function(worldX,worldY,seed=0){return parcelFrameV348(worldX,worldY,seed,1)};

function fieldStageColourV348(stage){
  let colour=RICH_PALETTE_V330.fieldDark.clone().lerp(RICH_PALETTE_V330.fieldGreen,smoothstep(.08,.48,stage));
  colour.lerp(RICH_PALETTE_V330.fieldBright,smoothstep(.42,.78,stage)*.52);
  colour.lerp(RICH_PALETTE_V330.fieldGold,smoothstep(.76,.98,stage)*.22);
  return colour;
}

fieldColourV330=function(worldX,worldY,mask,layer){
  if(layer==='regional'){
    const broad=fbm(worldX*.00022,worldY*.00022,6001,4),medium=fbm(worldX*.00060+5.3,worldY*.00060-4.2,6011,4),stage=clamp(.49+broad*.26+medium*.17,0,1);
    const colour=fieldStageColourV348(stage);colour.lerp(RICH_PALETTE_V330.wet,clamp((.45-broad)*.08*mask,0,.075));colour.lerp(RICH_PALETTE_V330.distant,.12);return colour;
  }
  const scale=layer==='context'?2.05:1,frame=parcelFrameV348(worldX,worldY,601,scale),broad=fbm(worldX*(layer==='context'?.00072:.0012),worldY*(layer==='context'?.00072:.0012),6037,4);
  const stage=clamp(.48+broad*.27+(frame.fieldSeed-.5)*(layer==='context'?.20:.38),0,1),colour=fieldStageColourV348(stage);
  const boundaryStrength=layer==='context'?.18:.46,channelStrength=layer==='context'?.34:.64,wetStrength=layer==='context'?.10:.16;
  colour.lerp(RICH_PALETTE_V330.bund,clamp(frame.boundary*boundaryStrength*mask,0,boundaryStrength));
  colour.lerp(RICH_PALETTE_V330.channel,clamp(frame.irrigation*channelStrength*mask,0,channelStrength));
  colour.lerp(RICH_PALETTE_V330.wet,clamp(frame.wetness*wetStrength*mask,0,wetStrength));
  colour.offsetHSL(broad*.003,broad*.003,broad*.004);return colour;
};

const buildContextFieldsV348Base=buildContextFields;
buildContextFields=function(analysis,peaks,mode){
  const field=buildContextFieldsV348Base(analysis,peaks,mode);
  if(state.enhanceMix===0)return field;
  let detailMin=Infinity,detailMax=-Infinity;
  for(let z=1;z<field.n-1;z++)for(let x=1;x<field.n-1;x++){
    const i=z*field.n+x,karst=field.karst?.[i]||0,valley=field.valley?.[i]||0,slope=field.slope?.[i]||0;
    const mask=karst*smoothstep(11,35,slope)*(1-smoothstep(.36,.70,valley));if(mask<.008)continue;
    const wx=field.worldX[x],wy=field.worldY[z],gx=field.gradX?.[i]||0,gy=field.gradY?.[i]||0,magnitude=Math.hypot(gx,gy)||1,downX=-gx/magnitude,downY=-gy/magnitude,acrossX=-downY,acrossY=downX;
    const along=wx*downX+wy*downY,across=wx*acrossX+wy*acrossY,warp=fbm(wx*.0018,wy*.0018,6079,4);
    const mass=(ridged((wx+warp*54)*.0026,(wy-warp*43)*.0026,6091,4)-.56)*2.05;
    const flute=-smoothstep(.72,.96,ridged(along*.0062+warp*.28,across*.0018,6113,4))*2.35;
    const ledge=Math.sin((field.final[i]||field.truth[i])*.118+fbm(wx*.0041,wy*.0041,6131,3)*1.9)*.48;
    const pocket=worley(wx*.0068+warp*.22,wy*.0068-warp*.17,6143),collapse=-smoothstep(.24,.055,pocket.f1)*.72;
    const edge=edgeFeather(wx-field.center.x,wy-field.center.y,field.extent,.09),detail=clamp((mass+flute+ledge+collapse)*mask*edge*state.process,-3.4,1.65);
    field.final[i]+=detail;if(field.micro)field.micro[i]+=detail;detailMin=Math.min(detailMin,detail);detailMax=Math.max(detailMax,detail);
  }
  if(field.stats){
    field.stats.contextFaceDetailMin=Number.isFinite(detailMin)?detailMin:0;field.stats.contextFaceDetailMax=Number.isFinite(detailMax)?detailMax:0;
    field.stats.microMin=Math.min(field.stats.microMin||0,field.stats.contextFaceDetailMin);field.stats.microMax=Math.max(field.stats.microMax||0,field.stats.contextFaceDetailMax);
  }
  return field;
};

const terrainColourV348Base=terrainColourRichV330;
terrainColourRichV330=function(field,index,heightNorm,worldX,worldY,layer,slopeDeg){
  const colour=terrainColourV348Base(field,index,heightNorm,worldX,worldY,layer,slopeDeg);
  if(layer==='context'||layer==='regional'){
    const karst=field.karst?.[index]||smoothstep(10,38,slopeDeg),valley=field.valley?.[index]||0,exposure=smoothstep(18,52,slopeDeg)*(1-valley),patch=ridged(worldX*.00235+fbm(worldX*.0009,worldY*.0009,6181,3)*.28,worldY*.00235,6197,4);
    const rockMix=clamp(karst*exposure*(.055+smoothstep(.60,.92,patch)*.13),0,.17);
    colour.lerp(RICH_PALETTE_V330.limestone.clone().lerp(RICH_PALETTE_V330.limestoneLight,.22),rockMix);
    colour.lerp(RICH_PALETTE_V330.karstDark,clamp(karst*exposure*smoothstep(.80,.97,ridged(worldX*.0054,worldY*.0031,6211,3))*.055,0,.055));
  }
  if(layer==='local'&&state.preset.id==='paddy')colour.lerp(RICH_PALETTE_V330.soil,.018);
  return colour;
};

createRiverMarginMeshV330=function(build){
  const sections=build.riverSections;if(!sections?.length)return null;
  const field=build.context,vertices=[],colours=[],indices=[],bands=[1.004,1.065,1.17,1.34],caps=[.035,.24,.72,1.65];
  const add=(x,h,y,c)=>{vertices.push(x-build.origin.x,h-build.datum,y-build.origin.y);colours.push(c.r,c.g,c.b);return vertices.length/3-1};
  const palettes=[RICH_PALETTE_V330.wet.clone().lerp(RICH_PALETTE_V330.bank,.48),RICH_PALETTE_V330.sand.clone().lerp(RICH_PALETTE_V330.bank,.58),RICH_PALETTE_V330.bank.clone().lerp(RICH_PALETTE_V330.soil,.32),RICH_PALETTE_V330.soil.clone().lerp(RICH_PALETTE_V330.moss,.18)];
  for(const side of [-1,1]){
    let previous=null;
    for(let i=0;i<sections.length;i+=2){
      const section=sections[i],pair=[];
      for(let b=0;b<bands.length;b++){
        const q=bands[b],x=section.x+section.nx*section.width*.5*q*side,y=section.y+section.ny*section.width*.5*q*side,sampled=sampleField(field,x,y,'final'),h=b===0?section.water+.020:Math.min(sampled+.014,section.water+caps[b]),colour=palettes[b].clone();
        colour.offsetHSL(0,0,fbm(x*.0048,y*.0048,6257+b,2)*.008);pair.push(add(x,h,y,colour));
      }
      if(previous)for(let b=0;b<bands.length-1;b++)indices.push(previous[b],pair[b],previous[b+1],previous[b+1],pair[b],pair[b+1]);previous=pair;
    }
  }
  if(!indices.length)return null;const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colours,3));geometry.setIndex(indices);geometry.computeVertexNormals();const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.99,metalness:0,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1.1,polygonOffsetUnits:-1.1});material.dithering=true;const mesh=new THREE.Mesh(geometry,material);mesh.name='river-margin-sediment';mesh.castShadow=false;mesh.receiveShadow=false;mesh.renderOrder=5;return mesh;
};

createPaddyWaterV330=function(build){
  if(state.preset.id!=='paddy'||state.enhanceMix===0)return null;
  const field=build.local,{n,spacing,worldX,worldY,final}=field,step=isMobile?20:17,positions=[],colours=[],indices=[];
  const add=(x,h,y,c)=>{positions.push(x-build.origin.x,h-build.datum,y-build.origin.y);colours.push(c.r,c.g,c.b);return positions.length/3-1};
  for(let z=step;z<n-step;z+=step)for(let x=step;x<n-step;x+=step){
    const i=z*n+x,mask=field.paddyMask?.[i]||0;if(mask<.55)continue;const grammar=parcelGrammarV330(worldX[x],worldY[z],601),chance=hash21(Math.floor(worldX[x]/21),Math.floor(worldY[z]/21),6299);if(grammar.wetness<.58||grammar.boundary>.18||chance<.64)continue;
    const halfX=step*spacing*(.10+.03*chance),halfY=halfX*(1.20+.38*grammar.fieldSeed),angle=grammar.orientation||0,ca=Math.cos(angle),sa=Math.sin(angle),corners=[[-halfX,-halfY],[halfX,-halfY],[-halfX,halfY],[halfX,halfY]],ids=[],colour=RICH_PALETTE_V330.wet.clone().lerp(RICH_PALETTE_V330.waterEdge,.10+.08*grammar.wetness),h=final[i]+.018;
    for(const [px,py] of corners)ids.push(add(worldX[x]+px*ca-py*sa,h,worldY[z]+px*sa+py*ca,colour));indices.push(ids[0],ids[2],ids[1],ids[1],ids[2],ids[3]);
  }
  if(!indices.length)return null;const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colours,3));geometry.setIndex(indices);geometry.computeVertexNormals();const material=new THREE.MeshPhysicalMaterial({vertexColors:true,roughness:.55,transparent:true,opacity:.22,depthWrite:false,clearcoat:.05,side:THREE.DoubleSide});const mesh=new THREE.Mesh(geometry,material);mesh.name='paddy-shallow-water';mesh.renderOrder=6;return mesh;
};

const initRendererV348Base=initRenderer;
initRenderer=async function(){
  await initRendererV348Base();renderer.toneMappingExposure=1.19;if(scene.fog){scene.fog.near=8500;scene.fog.far=25200;scene.fog.color.set(0xc9cfcb)}scene.background.set(0xc9cfcb);
  sun.intensity=2.62;sun.shadow.normalBias=1.05;sun.shadow.radius=2.2;
  scene.traverse(object=>{if(object.isHemisphereLight)object.intensity=1.58;if(object.name==='cool-fill')object.intensity=.56});
};

const configureCameraV348Base=configureCamera;
configureCamera=function(view,build=state.currentBuild){
  if(!build)return;if(state.preset.id!=='paddy'){configureCameraV348Base(view,build);return}
  const offset=build.localOffset||{x:0,z:0},targetHeight=build.localTargetHeight||260;
  camera.fov=35;camera.position.set(offset.x+220,targetHeight+1510,offset.z+390);controls.target.set(offset.x-45,targetHeight+5,offset.z-45);camera.updateProjectionMatrix();controls.update();
};

const makeQAV348Base=makeQA;
makeQA=function(build){
  const qa=makeQAV348Base(build),stats=build.context?.stats||{};
  qa.richTerrainPass='v3.4.8';qa.paddyParcelScaleMeters=[32,106];qa.contextPaddyParcelScaleMeters=[66,217];qa.paddyReviewCamera='high-aerial-oblique-local-patch';qa.contextKarstFaceDetail='slope-led-mass+flute+ledge+collapse';qa.contextFaceDetailRangeMeters=[Number((stats.contextFaceDetailMin||0).toFixed(3)),Number((stats.contextFaceDetailMax||0).toFixed(3))];qa.riverMarginProfile='wide-restrained-wet+sand+bank+soil';qa.visualAcceptance=false;qa.productionReady=false;return qa;
};

document.title='小王 · 桂林地貌蒸馏实验室 v3.4.8';
const brandSmallV348=document.querySelector('.brand small');if(brandSmallV348)brandSmallV348.textContent='XIAOWANG · GUILIN GEOMORPHOLOGY DISTILLATION v3.4.8';
