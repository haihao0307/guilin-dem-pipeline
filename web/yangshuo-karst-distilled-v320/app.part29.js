/* v3.5.0 paddy-floor correction: select a broad flat valley floor, keep clear of the main channel and frame the 512 m field patch without exposing its LOD seam. */

state.paddyFocusCacheV350=state.paddyFocusCacheV350||new Map();
state.paddyFocusV350=state.paddyFocusV350||null;
state.paddyCameraV350=state.paddyCameraV350||null;

function samplePaddyWindowV350(data,candidate,x,y){
  const radii=[70,140,220],heights=[sampleSource(data,candidate,x,y)];
  let sumAbs=0,maxRise=-Infinity,minRise=Infinity,ringSlopeMax=0;
  for(const radius of radii){
    const count=radius===220?16:12;
    for(let k=0;k<count;k++){
      const angle=k/count*Math.PI*2,px=x+Math.cos(angle)*radius,py=y+Math.sin(angle)*radius,h=sampleSource(data,candidate,px,py),rise=h-heights[0];
      heights.push(h);sumAbs+=Math.abs(rise);maxRise=Math.max(maxRise,rise);minRise=Math.min(minRise,rise);
      if(radius<=140)ringSlopeMax=Math.max(ringSlopeMax,slopeAtSource(data,candidate,px,py,25));
    }
  }
  let min=Infinity,max=-Infinity,mean=0;
  for(const h of heights){min=Math.min(min,h);max=Math.max(max,h);mean+=h}
  mean/=heights.length;let variance=0;for(const h of heights)variance+=(h-mean)*(h-mean);variance/=heights.length;
  return{center:heights[0],range:max-min,std:Math.sqrt(variance),meanAbsRise:sumAbs/Math.max(1,heights.length-1),maxRise,minRise,ringSlopeMax};
}

function paddyRiverSamplesV350(candidate){
  if(!state.projectedRiverLines?.length)return[];
  const [minX,minY,maxX,maxY]=candidate.bounds,out=[];
  for(const line of state.projectedRiverLines){
    for(let i=0;i<line.length;i+=12){const p=line[i];if(p[0]>=minX&&p[0]<=maxX&&p[1]>=minY&&p[1]<=maxY)out.push(p)}
  }
  return out;
}

function approximateRiverDistanceV350(points,x,y){
  let best=Infinity;
  for(const point of points){const d=Math.hypot(point[0]-x,point[1]-y);if(d<best)best=d}
  return best;
}

const pickFocusV350Base=pickFocus;
pickFocus=function(data,candidate,mode){
  if(mode!=='paddy')return pickFocusV350Base(data,candidate,mode);
  const cached=state.paddyFocusCacheV350.get(candidate.id);if(cached){state.paddyFocusV350={...cached};return{...cached}}
  const [minX,minY,maxX,maxY]=candidate.bounds,cx=(minX+maxX)*.5,cy=(minY+maxY)*.5,radius=2850,step=75,riverPoints=paddyRiverSamplesV350(candidate);
  let best=null,fallback=null;
  for(let y=cy-radius;y<=cy+radius;y+=step)for(let x=cx-radius;x<=cx+radius;x+=step){
    if(x<minX+760||x>maxX-760||y<minY+760||y>maxY-760)continue;
    const height=sampleSource(data,candidate,x,y),slope25=slopeAtSource(data,candidate,x,y,25),slope75=slopeAtSource(data,candidate,x,y,75);
    if(!Number.isFinite(height)||height<=0||slope25>7.5||slope75>5.5)continue;
    const window=samplePaddyWindowV350(data,candidate,x,y),ring320=ringReliefAt(data,candidate,x,y,320),ring520=ringReliefAt(data,candidate,x,y,520),ring760=ringReliefAt(data,candidate,x,y,760),riverDistance=approximateRiverDistanceV350(riverPoints,x,y),dist=Math.hypot(x-cx,y-cy);
    const openFloor=Math.max(0,12-window.range)*5.2+Math.max(0,5.5-window.std)*4.6+Math.max(0,4.0-window.meanAbsRise)*3.4;
    const valleyContext=clamp(ring320,0,55)*.92+clamp(ring520,0,95)*.54+clamp(ring760,0,135)*.23;
    const riverScore=riverDistance<90?-160-(90-riverDistance)*1.6:riverDistance<720?24-Math.abs(riverDistance-330)*.042:-Math.min(46,(riverDistance-720)*.025);
    const roughPenalty=window.range*7.4+window.std*6.2+window.meanAbsRise*4.8+Math.max(0,window.ringSlopeMax-4)*3.5;
    const score=openFloor+valleyContext+riverScore-roughPenalty-slope25*32-slope75*23-height*.012-dist*.00055;
    const candidateFocus={x,y,score,height,slope:slope25,slope25,slope75,windowRange:window.range,windowStd:window.std,windowMeanAbsRise:window.meanAbsRise,windowMaxRise:window.maxRise,windowMinRise:window.minRise,ringSlopeMax:window.ringSlopeMax,ring320,ring520,ring760,riverDistance};
    if(!fallback||score>fallback.score)fallback=candidateFocus;
    const strict=window.range<=14&&window.std<=5.2&&window.meanAbsRise<=4.4&&slope25<=3.6&&slope75<=3.0&&window.ringSlopeMax<=8.0&&riverDistance>=90;
    if(strict&&(!best||score>best.score))best=candidateFocus;
  }
  const result=best||fallback||pickFocusV350Base(data,candidate,mode);
  result.selectionGate=best?'strict-flat-valley':'best-available-flat-valley';
  state.paddyFocusCacheV350.set(candidate.id,{...result});state.paddyFocusV350={...result};return{...result};
};

function paddyCameraAzimuthV350(build){
  const field=build.local,center=field.center,target=sampleField(field,center.x,center.y,'final'),frame=typeof parcelFrameV348==='function'?parcelFrameV348(center.x,center.y,601,1):{angle:0};
  let best={angle:(frame.angle||0)+.72,score:Infinity,maxRise:Infinity,meanRise:Infinity};
  for(let k=0;k<16;k++){
    const angle=k/16*Math.PI*2,dx=Math.cos(angle),dy=Math.sin(angle);let maxRise=-Infinity,sum=0,count=0;
    for(const radius of [65,110,155,205]){
      const h=sampleField(field,center.x+dx*radius,center.y+dy*radius,'final'),rise=h-target;maxRise=Math.max(maxRise,rise);sum+=Math.max(0,rise);count++;
    }
    const parcelBias=Math.abs(Math.sin(angle-(frame.angle||0)))*2.2,score=Math.max(0,maxRise)*2.5+sum/Math.max(1,count)+parcelBias;
    if(score<best.score)best={angle,score,maxRise,meanRise:sum/Math.max(1,count)};
  }
  return best;
}

const configureCameraV350Base=configureCamera;
configureCamera=function(view,build=state.currentBuild){
  if(!build||state.preset.id!=='paddy'){configureCameraV350Base(view,build);return}
  const field=build.local,offset=build.localOffset||{x:0,z:0},center=field.center,terrainHeight=sampleField(field,center.x,center.y,'final')-build.datum,clear=paddyCameraAzimuthV350(build),distance=isMobile?82:105,height=isMobile?620:650;
  camera.fov=isMobile?29:26;camera.position.set(offset.x+Math.cos(clear.angle)*distance,terrainHeight+height,offset.z+Math.sin(clear.angle)*distance);controls.target.set(offset.x,terrainHeight+3,offset.z);camera.near=.5;camera.updateProjectionMatrix();controls.update();
  state.paddyCameraV350={azimuthRadians:clear.angle,obstructionScore:clear.score,maxRiseMeters:clear.maxRise,meanPositiveRiseMeters:clear.meanRise,horizontalDistanceMeters:distance,heightMeters:height,fovDegrees:camera.fov};
};

const makeTerrainMaterialV350Base=makeTerrainMaterialRichV330;
makeTerrainMaterialRichV330=function(layer){
  const material=makeTerrainMaterialV350Base(layer);
  if(layer==='local'&&state.preset.id==='paddy'){
    material.bumpMap=null;material.roughnessMap=null;material.roughness=1;material.metalness=0;material.dithering=true;material.needsUpdate=true;
  }
  return material;
};

const terrainColourV350Base=terrainColourRichV330;
terrainColourRichV330=function(field,index,heightNorm,worldX,worldY,layer,slopeDeg){
  const colour=terrainColourV350Base(field,index,heightNorm,worldX,worldY,layer,slopeDeg);
  if(layer==='local'&&state.preset.id==='paddy'){
    const frame=parcelFrameV348(worldX,worldY,601,1),broad=fbm(worldX*.00115,worldY*.00115,6719,4),plain=smoothstep(8.5,1.2,slopeDeg);
    colour.lerp(RICH_PALETTE_V330.soil,clamp(frame.boundary*.11*plain,0,.11));
    colour.lerp(RICH_PALETTE_V330.channel,clamp(frame.irrigation*.18*plain,0,.18));
    colour.offsetHSL(0,broad*.002,broad*.004);
  }
  return colour;
};

const makeQAV350Base=makeQA;
makeQA=function(build){
  const qa=makeQAV350Base(build),focus=state.paddyFocusV350||{},cameraState=state.paddyCameraV350||{};
  qa.richTerrainPass='v3.5.0';qa.paddyFocusSelection=focus.selectionGate||null;qa.paddyFocusDiagnostics={heightMeters:Number((focus.height||0).toFixed(3)),slope25Degrees:Number((focus.slope25||0).toFixed(3)),slope75Degrees:Number((focus.slope75||0).toFixed(3)),windowRangeMeters:Number((focus.windowRange||0).toFixed(3)),windowStdMeters:Number((focus.windowStd||0).toFixed(3)),windowMeanAbsRiseMeters:Number((focus.windowMeanAbsRise||0).toFixed(3)),ring320Meters:Number((focus.ring320||0).toFixed(3)),ring520Meters:Number((focus.ring520||0).toFixed(3)),ring760Meters:Number((focus.ring760||0).toFixed(3)),riverDistanceMeters:Number((focus.riverDistance||0).toFixed(3))};qa.paddyCameraDiagnostics={azimuthRadians:Number((cameraState.azimuthRadians||0).toFixed(4)),obstructionScore:Number((cameraState.obstructionScore||0).toFixed(3)),maxRiseMeters:Number((cameraState.maxRiseMeters||0).toFixed(3)),horizontalDistanceMeters:cameraState.horizontalDistanceMeters||0,heightMeters:cameraState.heightMeters||0,fovDegrees:cameraState.fovDegrees||0};qa.paddyReviewCamera='terrain-aware-near-vertical-cropped-512m';qa.paddyLodSeamVisible=false;qa.visualAcceptance=false;qa.productionReady=false;return qa;
};

document.title='小王 · 桂林地貌蒸馏实验室 v3.5.0';
const brandSmallV350=document.querySelector('.brand small');if(brandSmallV350)brandSmallV350.textContent='XIAOWANG · GUILIN GEOMORPHOLOGY DISTILLATION v3.5.0';
