}

function makeTerrainMaterial(layer){
  const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:layer==='local'?.9:.96,metalness:0,side:THREE.DoubleSide});material.polygonOffset=true;material.polygonOffsetFactor=layer==='regional'?3:layer==='context'?2:1;material.polygonOffsetUnits=material.polygonOffsetFactor;material.wireframe=state.wire;return material;
}

function terrainColor(tone,heightNorm,worldX,worldY,layer){
  const micro=fbm(worldX*.0022,worldY*.0022,811,4)*.045;let c;
  if(!state.tone){const g=clamp(.50+heightNorm*.16+micro,.34,.76);c=new THREE.Color(g,g,g)}else{
    const rock=new THREE.Color(layer==='regional'?0x707770:0x777d74),plain=new THREE.Color(0x9d9a73),high=new THREE.Color(0x858b82);c=rock.clone().lerp(plain,clamp(tone,0,1));c.lerp(high,clamp(heightNorm*.34,0,.34));c.offsetHSL(0,0,micro)
  }
  return c;
}

function createTerrainMesh(field,origin,datum,layer,yOffset=0){
  const {n,worldX,worldY,final,tone}=field,count=n*n,positions=new Float32Array(count*3),colors=new Float32Array(count*3);let min=Infinity,max=-Infinity;for(let i=0;i<final.length;i++){min=Math.min(min,final[i]);max=Math.max(max,final[i])}const range=Math.max(1,max-min);
  for(let z=0;z<n;z++)for(let x=0;x<n;x++){const i=z*n+x,o=i*3,h=final[i];positions[o]=worldX[x]-origin.x;positions[o+1]=h-datum+yOffset;positions[o+2]=worldY[z]-origin.y;const c=terrainColor(tone[i]||0,(h-min)/range,worldX[x],worldY[z],layer);colors[o]=c.r;colors[o+1]=c.g;colors[o+2]=c.b}
  const indices=new Uint32Array((n-1)*(n-1)*6);let p=0;for(let z=0;z<n-1;z++)for(let x=0;x<n-1;x++){const a=z*n+x,b=a+1,c=a+n,d=c+1;if((x+z)&1){indices[p++]=a;indices[p++]=c;indices[p++]=d;indices[p++]=a;indices[p++]=d;indices[p++]=b}else{indices[p++]=a;indices[p++]=c;indices[p++]=b;indices[p++]=b;indices[p++]=c;indices[p++]=d}}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));geometry.setIndex(new THREE.BufferAttribute(indices,1));geometry.computeVertexNormals();geometry.computeBoundingSphere();const mesh=new THREE.Mesh(geometry,makeTerrainMaterial(layer));mesh.name=`terrain-${layer}`;mesh.castShadow=layer!=='regional';mesh.receiveShadow=true;return mesh;
}

function createWaterMesh(sections,origin,datum){
  if(!sections||sections.length<3)return null;const cross=10,cols=cross+1,positions=new Float32Array(sections.length*cols*3),colors=new Float32Array(sections.length*cols*3);let p=0;
  for(const s of sections){for(let j=0;j<=cross;j++){const q=j/cross*2-1,bankBias=q*s.curvature*12,x=s.x+s.nx*(s.width*.5*q+bankBias),y=s.y+s.ny*(s.width*.5*q+bankBias);positions[p]=x-origin.x;positions[p+1]=s.water-datum+.05;positions[p+2]=y-origin.y;const edge=Math.abs(q),c=new THREE.Color(0x78b4ba).lerp(new THREE.Color(0x4e8e9d),1-edge);colors[p]=c.r;colors[p+1]=c.g;colors[p+2]=c.b;p+=3}}
  const indices=new Uint32Array((sections.length-1)*cross*6);let k=0;for(let i=0;i<sections.length-1;i++)for(let j=0;j<cross;j++){const a=i*cols+j,b=a+1,c=a+cols,d=c+1;indices[k++]=a;indices[k++]=c;indices[k++]=b;indices[k++]=b;indices[k++]=c;indices[k++]=d}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));geometry.setIndex(new THREE.BufferAttribute(indices,1));geometry.computeVertexNormals();const material=new THREE.MeshPhysicalMaterial({vertexColors:true,roughness:.28,metalness:0,transparent:true,opacity:.82,depthWrite:false,side:THREE.DoubleSide,clearcoat:.35});const mesh=new THREE.Mesh(geometry,material);mesh.name='lijiang-water-surface';mesh.receiveShadow=true;return mesh;
}

function disposeTerrain(){terrainGroup.traverse(o=>{o.geometry?.dispose();if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else o.material?.dispose()});terrainGroup.clear()}
function applyWire(){terrainGroup.traverse(o=>{if(o.isMesh&&o.name.startsWith('terrain-'))o.material.wireframe=state.wire})}

function configureCamera(view,build=state.currentBuild){if(!build)return;const offset=build.localOffset||{x:0,z:0},targetHeight=build.localTargetHeight||260;if(view==='overview'){camera.position.set(5600,3000,6500);controls.target.set(0,350,0)}else if(view==='valley'){camera.position.set(offset.x+2300,targetHeight+1050,offset.z+2750);controls.target.set(offset.x,targetHeight+80,offset.z)}else{camera.position.set(offset.x+720,targetHeight+420,offset.z+900);controls.target.set(offset.x,targetHeight+170,offset.z)}controls.update()}

function clampLocalCenter(center,origin){const limit=CONTEXT_EXTENT*.5-DETAIL_EXTENT*.58,dx=center.x-origin.x,dy=center.y-origin.y,d=Math.hypot(dx,dy);if(d<=limit)return center;const s=limit/(d||1);return{x:origin.x+dx*s,y:origin.y+dy*s}}

function updatePresetButtons(){document.querySelectorAll('[data-preset]').forEach(b=>b.classList.toggle('active',b.dataset.preset===state.preset.id))}
function updateMetric(id,text){$(id).textContent=text}
function setCheck(id,ok){$(id).className='dot '+(ok?'ok':'bad')}

function makeQA(build){
  const c=build.context,l=build.local,river=build.riverSections,waterVertices=river?river.length*11:0,ratioMin=c.stats.ratioMin,ratioMax=c.stats.ratioMax;
  return{
    schema:'guilin-yangshuo-karst-distilled-online-qa/v3.2.0',ready:true,error:null,preset:state.preset.id,
    truthSourceSha256:SOURCE_SHA,referenceSha256:EXPECTED_REFERENCE_SHA,sourceGrid:[2048,2048],sourceSpacingMeters:12.5,truthMutationCount:0,vegetationInstances:0,
    regionalGrid:[REGIONAL_GRID,REGIONAL_GRID],regionalExtentMeters:REGIONAL_EXTENT,contextGrid:[CONTEXT_GRID,CONTEXT_GRID],contextExtentMeters:CONTEXT_EXTENT,detailGrid:[DETAIL_GRID,DETAIL_GRID],detailExtentMeters:DETAIL_EXTENT,detailSpacingMeters:DETAIL_SPACING,
    detectedPeakCount:c.peaks.length,referencePeakLayerTarget:[5,7],heightFootprintRatioRange:[Number(ratioMin.toFixed(3)),Number(ratioMax.toFixed(3))],referenceRatioTarget:[1.22,2.14],
    valleyProtectedFraction:Number(c.valleyFraction.toFixed(5)),valleyMeanMacroAbsMeters:Number(c.stats.valleyMeanMacroAbs.toFixed(5)),macroDeltaRangeMeters:[Number(c.stats.macroMin.toFixed(3)),Number(c.stats.macroMax.toFixed(3))],microDeltaRangeMeters:[Number(c.stats.microMin.toFixed(3)),Number(c.stats.microMax.toFixed(3))],
    paddyMaskVertices:l.stats.paddyVertices,paddyBundMaximumMeters:Number(l.stats.bundMax.toFixed(3)),karstMaskVertices:l.stats.karstVertices,
    riverGeometry:'multi-cross-section-water-surface',riverSampleMeters:RIVER_SAMPLE_METERS,riverCrossSectionVertices:11,riverSectionCount:river?.length||0,riverVertexCount:waterVertices,
    minimumRiverClearanceMeters:Number(l.stats.minClear.toFixed(3)),maximumRiverClearanceMeters:Number(l.stats.maxClear.toFixed(3)),meanRiverClearanceMeters:Number(l.stats.meanClear.toFixed(3)),riverClearanceSampleCount:l.stats.clearSamples,maximumWaterTerrainPenetrationMeters:Number(l.stats.penetration.toFixed(4)),tubeGeometryUsed:false,
    rendererBackend:renderer.backend?.isWebGPUBackend?'WebGPU':'WebGL2 fallback',enhanceMix:state.enhanceMix,macroStrength:state.macro,processStrength:state.process,bundStrength:state.bund,riverStrength:state.river,
