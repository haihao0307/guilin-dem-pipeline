/* v3.4.7 review repair: field-scale parcels, wider local feather, contracted cliff feet and collision-safe cameras. */

RICH_PALETTE_V330.fieldDark.set(0x4d5d35);
RICH_PALETTE_V330.fieldGreen.set(0x64733d);
RICH_PALETTE_V330.fieldBright.set(0x788345);
RICH_PALETTE_V330.fieldGold.set(0x887849);
RICH_PALETTE_V330.bund.set(0x514735);
RICH_PALETTE_V330.channel.set(0x49625b);
RICH_PALETTE_V330.wet.set(0x5c7169);
RICH_PALETTE_V330.waterDeep.set(0x315e5e);
RICH_PALETTE_V330.waterMid.set(0x4b7570);
RICH_PALETTE_V330.waterEdge.set(0x74877b);

parcelFrameV345=function(worldX,worldY,seed=0){
  const tileX=Math.floor(worldX/420),tileY=Math.floor(worldY/420),tileSeed=hash21(tileX,tileY,seed+31);
  const angle=fbm(worldX*.00042,worldY*.00042,seed+47,4)*.62+(tileSeed-.5)*.34;
  const ca=Math.cos(angle),sa=Math.sin(angle);
  const warpU=fbm(worldX*.0011,worldY*.0011,seed+61,4)*31+fbm(worldX*.0048,worldY*.0048,seed+79,3)*5.5;
  const warpV=fbm(worldX*.0011+6.4,worldY*.0011-4.2,seed+97,4)*31+fbm(worldX*.0048-4.1,worldY*.0048+7.3,seed+113,3)*5.5;
  const u=(worldX+warpU)*ca+(worldY+warpV)*sa,v=-(worldX+warpU)*sa+(worldY+warpV)*ca;
  const widthU=58+hash21(tileX,tileY,seed+131)*42,widthV=102+hash21(tileX,tileY,seed+149)*72;
  const cellU=Math.floor(u/widthU),cellV=Math.floor(v/widthV),fu=fract(u/widthU),fv=fract(v/widthV),du=Math.min(fu,1-fu),dv=Math.min(fv,1-fv);
  const edgeU=1-smoothstep(.018,.058,du),edgeV=1-smoothstep(.012,.042,dv);
  const seedU=hash21(cellU,cellV,seed+173),seedV=hash21(cellU,cellV,seed+191),mergeU=seedU<.22?.12:1,mergeV=seedV<.16?.18:1;
  const contour=Math.abs(Math.sin((u+fbm(worldX*.0018,worldY*.0018,seed+211,3)*24)*.0048));
  const contourBund=(1-smoothstep(.012,.045,contour))*smoothstep(.67,.91,tileSeed);
  const boundary=Math.max(edgeU*mergeU,edgeV*mergeV,contourBund*.38);
  const majorU=edgeU*(hash21(cellU,Math.floor(cellV/2),seed+229)>.82?1:0),majorV=edgeV*(hash21(Math.floor(cellU/3),cellV,seed+241)>.86?1:0);
  const meander=Math.abs(Math.sin(worldX*.0026+worldY*.00105+fbm(worldX*.00095,worldY*.00095,seed+257,4)*3.1));
  const drainage=(1-smoothstep(.009,.036,meander))*.72;
  const irrigation=Math.max(majorU,majorV,drainage*smoothstep(.035,.22,Math.min(du,dv)));
  const fieldSeed=hash21(cellU,cellV,seed+277),wetness=clamp((fieldSeed-.42)*1.75,0,1)*(.58+.42*fbm(worldX*.0018,worldY*.0018,seed+293,3));
  return{angle,u,v,widthU,widthV,cellU,cellV,fu,fv,du,dv,boundary,irrigation,fieldSeed,wetness,split:Math.max(edgeU,edgeV)};
};

const fieldColourV347Base=fieldColourV330;
fieldColourV330=function(worldX,worldY,mask,layer){
  if(layer==='context'){
    const warpX=fbm(worldX*.00072,worldY*.00072,5407,4)*78,warpY=fbm(worldX*.00072+5.2,worldY*.00072-3.7,5423,4)*78;
    const cell=worley((worldX+warpX)*.0046,(worldY+warpY)*.0038,5441),seed=hash21(cell.cellX,cell.cellZ,5459);
    let colour=seed<.23?RICH_PALETTE_V330.fieldDark.clone():seed<.58?RICH_PALETTE_V330.fieldGreen.clone():seed<.86?RICH_PALETTE_V330.fieldBright.clone():RICH_PALETTE_V330.fieldGold.clone();
    const boundary=smoothstep(.058,.012,cell.f2-cell.f1),broad=fbm(worldX*.0010,worldY*.0010,5477,3);
    colour.offsetHSL(broad*.003,broad*.004,broad*.004);
    colour.lerp(RICH_PALETTE_V330.bund,clamp(boundary*.22*mask,0,.22));
    colour.lerp(RICH_PALETTE_V330.wet,clamp((.5-broad)*.10*mask,0,.09));
    return colour;
  }
  return fieldColourV347Base(worldX,worldY,mask,layer);
};

const buildLocalFieldsV347Base=buildLocalFields;
buildLocalFields=function(contextField,localCenter,mode,data,candidate,riverSections){
  const field=buildLocalFieldsV347Base(contextField,localCenter,mode,data,candidate,riverSections),count=field.n*field.n;
  field.visualEdgeV347=new Float32Array(count);
  const band=mode==='paddy'?.38:mode==='cliff'?.27:.25,peak=mode==='cliff'?state.selectedCliffPeakV346:null;
  let footCutMax=0,boundaryMax=0,boundarySum=0,boundaryCount=0;
  for(let z=0;z<field.n;z++)for(let x=0;x<field.n;x++){
    const i=z*field.n+x,wx=field.worldX[x],wy=field.worldY[z],visualEdge=edgeFeather(wx-localCenter.x,wy-localCenter.y,field.extent,band);
    field.visualEdgeV347[i]=visualEdge;
    if(peak&&state.enhanceMix>0){
      const ca=Math.cos(peak.angle),sa=Math.sin(peak.angle),dx=wx-peak.x,dy=wy-peak.y,qx=(dx*ca+dy*sa)/peak.radiusX,qy=(-dx*sa+dy*ca)/peak.radiusY,r=superellipseRadiusV340(qx,qy,peak.superPower||2.7);
      const ring=smoothstep(.86,1.015,r)*(1-smoothstep(1.015,1.42,r));
      if(ring>0){
        const target=peak.floor+5.5+fbm(wx*.0022,wy*.0022,5501,3)*1.8,excess=Math.max(0,field.final[i]-target),cut=Math.min(42,excess*.70)*ring*visualEdge;
        field.final[i]-=cut;footCutMax=Math.max(footCutMax,cut);
      }
    }
    const contextHeight=field.contextFinalV346?.[i]??sampleField(contextField,wx,wy,'final');
    if(state.enhanceMix>0){const blend=visualEdge*visualEdge*(3-2*visualEdge);field.final[i]=lerp(contextHeight,field.final[i],blend)}
    if(visualEdge<.08){const difference=Math.abs(field.final[i]-contextHeight);boundaryMax=Math.max(boundaryMax,difference);boundarySum+=difference;boundaryCount++}
  }
  if(field.stats){
    field.stats.visualBoundaryMaxAbs=boundaryMax;field.stats.visualBoundaryMeanAbs=boundaryCount?boundarySum/boundaryCount:0;field.stats.visualBoundarySamples=boundaryCount;field.stats.cliffFootCutMax=footCutMax;
  }
  return field;
};

const terrainColourV347Base=terrainColourRichV330;
terrainColourRichV330=function(field,index,heightNorm,worldX,worldY,layer,slopeDeg){
  const colour=terrainColourV347Base(field,index,heightNorm,worldX,worldY,layer,slopeDeg);
  if(layer==='local'){
    const edge=field.visualEdgeV347?.[index]??field.localEdge?.[index]??1;
    if(edge<.999){
      const contextColour=terrainColourV347Base(field,index,heightNorm,worldX,worldY,'context',slopeDeg),blend=edge*edge*(3-2*edge);
      colour.lerp(contextColour,1-blend);
    }
  }
  return colour;
};

configureCamera=function(view,build=state.currentBuild){
  if(!build)return;const offset=build.localOffset||{x:0,z:0},targetHeight=build.localTargetHeight||260,id=state.preset.id;
  if(id==='atlas'){
    camera.fov=39;camera.position.set(3050,1390,4300);controls.target.set(0,225,-285);
  }else if(id==='paddy'){
    camera.fov=42;camera.position.set(offset.x+1460,targetHeight+730,offset.z+1880);controls.target.set(offset.x-70,targetHeight+12,offset.z-110);
  }else if(id==='river'){
    camera.fov=40;camera.position.set(offset.x+1240,targetHeight+560,offset.z+1650);controls.target.set(offset.x-100,targetHeight+12,offset.z-235);
  }else{
    const frame=localSurfaceFrameV346(build),baseY=frame.base-build.datum,summitY=frame.maximum-build.datum,targetY=baseY+frame.height*.56,distance=clamp(frame.height*4.0,900,1320);
    const px=frame.x+distance*.72,pz=frame.z+distance,worldX=build.origin.x+px,worldY=build.origin.y+pz;
    const contextGround=sampleField(build.context,worldX,worldY,'final')-build.datum,regionalGround=sampleField(build.regional,worldX,worldY,'final')-build.datum;
    const cameraY=Math.max(summitY+170,contextGround+230,regionalGround+230,targetY+210);
    camera.fov=43;camera.position.set(px,cameraY,pz);controls.target.set(frame.x,targetY,frame.z);
  }
  camera.updateProjectionMatrix();controls.update();
};

const makeQAV347Base=makeQA;
makeQA=function(build){
  const qa=makeQAV347Base(build),stats=build.local?.stats||{};
  qa.richTerrainPass='v3.4.7';qa.paddyParcelScaleMeters=[58,174];qa.localVisualFeather=state.preset.detailMode==='paddy'?.38:state.preset.detailMode==='cliff'?.27:.25;
  qa.visualBoundaryMaxAbsMeters=Number((stats.visualBoundaryMaxAbs||0).toFixed(5));qa.visualBoundaryMeanAbsMeters=Number((stats.visualBoundaryMeanAbs||0).toFixed(5));qa.cliffFootContractionMaximumMeters=Number((stats.cliffFootCutMax||0).toFixed(3));
  qa.cliffCamera='terrain-sampled-collision-safe-high-oblique';qa.fieldColourLOD='regional-continuous+context-large-parcels+local-field-parcels';qa.visualAcceptance=false;qa.productionReady=false;return qa;
};

document.title='小王 · 桂林地貌蒸馏实验室 v3.4.7';
const brandSmallV347=document.querySelector('.brand small');if(brandSmallV347)brandSmallV347.textContent='XIAOWANG · GUILIN GEOMORPHOLOGY DISTILLATION v3.4.7';
