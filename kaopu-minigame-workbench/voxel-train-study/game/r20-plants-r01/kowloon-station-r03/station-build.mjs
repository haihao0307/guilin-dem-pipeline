import{createDetailedStationStone,isDetailedStone}from'./stone-copings.mjs';
import{createStationLeatherSeats}from'./leather-seats.mjs';
import{createOriginalBrickFacing}from'./brick-facing.mjs';
import{normalizeStationScore}from'./station-score.mjs';
import{compileStationRecipe}from'./station-recipe.mjs';
import{terminalArchitecture}from'./terminal-architecture.mjs';
import{geometryForPart}from'./geometry-extra.mjs';
import{stationSurfaceCatalog}from'./surface-bindings.mjs';
import{createTimberMember}from'./timber/three-adapter.mjs';
import{batchStationDisplay}from'./station-batching.mjs';
import{createStationFabricRecipe,resolveMemberFabric,applyFabricGeometry}from'./station-fabric.mjs';
import{fabricGeometry}from'./fabric-geometry.mjs';
import{stationConstructionDetails}from'./construction-details.mjs';
import{createWordFactory}from'../street/glyphs.mjs';
import{createWordFactory as createPlatformWordFactory}from'./station-labels.mjs';
import{Blocks}from'../heritage.mjs';
import{appendRailSection}from'../wheel-rail-profile.mjs';
import{TRACK,TRACK_SUPPORT}from'../metre-scale.mjs';
export const DEFAULT_STATION_RUNTIME_SCORE=normalizeStationScore({tracks:{activeIndex:2},placement:{position:[-68,0,0],yaw:Math.PI},surface:{ironTint:'#577267',stoneTint:'#b6b3a6',wetness:.06}});
export function buildWholeStation(T,input=DEFAULT_STATION_RUNTIME_SCORE,{renderer=null,stoneDetail=true}={}){
 const started=performance.now(),recipe=compileStationRecipe(input,{scope:'whole-shed'}),architecture=terminalArchitecture(recipe.plan),root=new T.Group(),staticRoot=new T.Group(),woodRoot=new T.Group(),clockRoot=new T.Group(),catalog=stationSurfaceCatalog(recipe.score),wordFactory=createWordFactory(T),platformWords=createPlatformWordFactory(T),timbers=[];
 root.name='Imagined Kowloon terminal / unified original recipe';root.rotation.y=recipe.score.placement.yaw;root.position.fromArray(recipe.score.placement.position);root.add(staticRoot,woodRoot,clockRoot);
 const proof={version:'kowloon-full-station-r03-candidate',recipeParts:recipe.parts.length,architectureParts:architecture.parts.length,units:'metre',gaugeM:TRACK.gauge,oneClock:'Session.elapsed and scheduleMinutes',originalTrainMaterials:catalog.proof,timber:{source:'Library-v3',originalMemberCalls:0,shaderRewritten:false,hostLights:false,displacedShadows:false},publicAppChanged:false,fictionalUpgrade:true,fullStationGPU:false,firstMaterialReviewPending:true};
 const parts=[...recipe.parts,...architecture.parts,...stationConstructionDetails(recipe.plan,[...recipe.parts,...architecture.parts])],fabric=createStationFabricRecipe(recipe.plan,parts,recipe.score.fabric);proof.fabric={revision:fabric.revision,sourceEvents:fabric.sources.length,repairs:fabric.repairs,geometryReceiverCalls:0,changedVertices:0,maxSectionLossM:0,chainedOriginalCalls:catalog.proof.fabric.chainedOriginalCalls,limitations:['authored age is not calibrated years','geometry limits are artwork not structural engineering','ceramic mother not recovered']};
 for(const part of parts){
  const state=resolveMemberFabric(fabric,part);
  if(stoneDetail&&isDetailedStone(part))continue;
  if(part.surface.role==='aged-wood'){
   const [length,height,depth]=part.shape.size,handle=createTimberMember(T,{id:part.id,sourceId:part.surface.stockId,seed:recipe.score.object.seed,length,height,depth,grainOffset:part.surface.grainOffset,position:part.shape.center,presetId:state.authoredAge<.2?'yunnan_light_weathered_v2':'yunnan_dark_aged_v2',geometryMode:'hewn',fabricFinish:{roughnessDelta:state.sample(part.shape.center,[0,1,0]).roughnessDelta,reliefScale:.8+state.authoredAge*.3},tessellation:{segmentsLength:18,segmentsCross:3,seed:recipe.score.object.seed,macroAmplitude:.00035*state.authoredAge*(1-state.sample(part.shape.center).repair),macroFrequency:1.6},settings:{reliefMode:'inspection',reliefStrength:.75+state.authoredAge*.45}});handle.mesh.castShadow=false;handle.mesh.receiveShadow=false;woodRoot.add(handle.mesh);timbers.push(handle);proof.timber.originalMemberCalls++;continue;
  }
  const m=catalog.get(part.surface.role),g=applyFabricGeometry(T,fabricGeometry(T,part),part,state),mesh=new T.Mesh(g,m);proof.fabric.geometryReceiverCalls++;proof.fabric.changedVertices+=g.userData.fabric.changedVertices;proof.fabric.maxSectionLossM=Math.max(proof.fabric.maxSectionLossM,g.userData.fabric.maxSectionLossM);mesh.name=part.id;mesh.castShadow=mesh.receiveShadow=true;staticRoot.add(mesh);
 }
 const glyphMat=catalog.get('paint-cream');
 for(const anchor of architecture.anchors){const group=wordFactory.makeWord(anchor.text,{style:'serif',height:anchor.height,depth:.020,material:catalog.get('clock-ink')});group.position.fromArray(anchor.at);if(anchor.axis==='x')group.rotation.y=Math.PI/2;staticRoot.add(group);}
 // Existing licensed native outline functions, no canvas labels or text image.
 for(const part of recipe.parts.filter(p=>p.surface.feature==='platform-sign-face')){
  const [x,y,z]=part.shape.center,number=part.surface.lettering.line2;
  for(const side of[-1,1])for(const[text,height,dy]of [['PLATFORM',.12,.075],['No. '+number,.17,-.16]]){const group=platformWords.makeWord(text,{style:'serif',height,depth:0,material:glyphMat});group.position.set(x,y+dy,z+side*.027);if(side<0)group.rotation.y=Math.PI;staticRoot.add(group);}
 }
 proof.platformSigns={nativeOutlineSource:'Noto Serif CJK HK / existing generator runtime',images:0,doubleSided:true,boardCount:recipe.parts.filter(p=>p.surface.feature==='platform-sign-face').length};
 const hands=[];for(const spec of architecture.clockHands){const g=new T.Group();g.position.fromArray(spec.center);g.position.addScaledVector(new T.Vector3(...spec.normal),.065);if(spec.axis==='x')g.rotation.y=spec.normal[0]>0?Math.PI/2:-Math.PI/2;else if(spec.normal[2]<0)g.rotation.y=Math.PI;
  const hour=new T.Mesh(new T.BoxGeometry(.09,.77,.025),catalog.get('clock-ink')),minute=new T.Mesh(new T.BoxGeometry(.055,1.02,.025),catalog.get('clock-ink'));hour.geometry.translate(0,.31,0);minute.geometry.translate(0,.44,.025);g.add(hour,minute);g.add(new T.Mesh(new T.SphereGeometry(.095,12,8),catalog.get('brass')));clockRoot.add(g);hands.push({hour,minute});}
 // Exact current wheel/rail profile is reused for all track reservations.
 const rails=new Blocks(),sleepers=new Blocks();for(const track of recipe.plan.tracks){for(const sign of[-1,1])appendRailSection(T,rails,{lengthM:track.active?339:128,centerXM:track.active?-160.5:-54,centerZM:track.centerZ+sign*TRACK.railCenterZ,railTopM:TRACK.railHead});for(let x=track.active?-330:-118;x<10;x+=.64)sleepers.box(x,TRACK_SUPPORT.sleeperCenterM,track.centerZ,.23,TRACK_SUPPORT.sleeperThicknessM,2.33,0x6d6554);}
 const railMesh=new T.Mesh(rails.geometry(),catalog.get('structural-iron')),sleepMesh=new T.Mesh(sleepers.geometry(),catalog.get('quay-stone'));railMesh.castShadow=false;railMesh.receiveShadow=true;staticRoot.add(railMesh,sleepMesh);
 // The platform end is genuinely a terminus. Buffer beam is outside vehicle fit.
 for(const track of recipe.plan.tracks){const m=catalog.get('cast-iron');for(const dz of[-.72,.72]){const leg=new T.Mesh(new T.BoxGeometry(.27,.70,.28),m);leg.position.set(9.2,.65,track.centerZ+dz);staticRoot.add(leg);}const bar=new T.Mesh(new T.BoxGeometry(.36,.20,2.15),catalog.get('boat-black'));bar.position.set(9.2,1.0,track.centerZ);staticRoot.add(bar);}
 const ballast=new T.Mesh(new T.BoxGeometry(206,.20,58),catalog.get('quay-stone'));ballast.position.set(-13,-.10,-3.2);ballast.receiveShadow=true;staticRoot.add(ballast);
 const detailedStone=createDetailedStationStone(T,parts,fabric,{construct:stoneDetail});root.add(detailedStone.root);proof.detailedStone=detailedStone.proof;
 const leather=createStationLeatherSeats(T,fabric);root.add(leather.root);proof.leather=leather.proof;
 const brickFacing=createOriginalBrickFacing(T,renderer,parts,fabric);root.add(brickFacing.group);proof.brickFacing=brickFacing.proof;
 // Opaque only; original wood stays outside to preserve all source attributes.
 const batch=batchStationDisplay(T,staticRoot);for(const mesh of batch.sources)mesh.geometry.dispose();
 proof.staticBatches=batch.displays.length;proof.staticSourceMeshes=batch.sources.length;proof.buildMs=performance.now()-started;
 return{root,recipe,architecture,proof,catalog,staticRoot,woodRoot,clockRoot,parts,fabric,
 update(view){root.position.x=recipe.score.placement.position[0]-view.distance;const minutes=view.timetable?.minutes??380+view.elapsed/60;for(const h of hands){h.minute.rotation.z=-(minutes%60)*Math.PI/30;h.hour.rotation.z=-(minutes%720)*Math.PI/360;}},
 dispose(){root.removeFromParent();brickFacing.dispose();leather.dispose();detailedStone.dispose();for(const h of timbers)h.dispose();wordFactory.dispose();platformWords.dispose();const geometries=new Set();root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);});for(const g of geometries)g.dispose();for(const m of catalog.materials.values())m.dispose();root.clear();}};
}
