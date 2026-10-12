import {ROUTE_OBSERVER_POLICY,observerSamplingFrame,observerNeeded,observerLocalExclusions,observerStationPlans} from './route-observer-policy.mjs';

const EARTH='Broad continuous earth, no exposed strip edge';
const RAIL='Unbroken straight ballast and rails';
const FIELDS='Fields extending on both sides of railway';
const highIndex=name=>/^Original close detail (\d+):\d+$/.exec(name)?.[1];
const lowIndex=name=>/^Distant sleepers and fence (\d+)$/.exec(name)?.[1];
const plant=name=>/^Preserved original tree or shrub \d+:\d+$/.test(name);
const proxy=name=>/^Distant source-derived (crown variant \d+|low shrubs)$/.test(name);
const key=(index,x)=>index+':'+Math.round(x*1e5);
const planKey=plan=>JSON.stringify([plan.index,plan.target,plan.name,plan.english,plan.radius]);

function collectResources(root,resources){
  root.traverse(object=>{
    if(object.isInstancedMesh)resources.instances.add(object);
    if(object.geometry)resources.geometries.add(object.geometry);
    for(const material of Array.isArray(object.material)?object.material:object.material?[object.material]:[]){
      resources.materials.add(material);
      for(const value of Object.values(material))if(value?.isTexture)resources.textures.add(value);
    }
  });
}
const resourceSet=()=>({instances:new Set(),geometries:new Set(),materials:new Set(),textures:new Set()});
function disposeResources(root,resources){
  collectResources(root,resources);
  root.removeFromParent();
  for(const kind of ['instances','textures','materials','geometries'])for(const value of resources[kind])value.dispose();
  root.clear();
}

// Clip only the auxiliary continuous railway. The train's original railway is
// untouched and remains the exclusive owner of the overlap, including ballast.
// No new appearance/material model is introduced: preserve its compile hook.
function installRailOwnership(rail,hostRail,THREE){
  const nativeBounds=new THREE.Box3().setFromBufferAttribute(hostRail.geometry.attributes.position);
  const interval={value:new THREE.Vector2()},old=rail.material,material=old.clone();
  const prior=old.onBeforeCompile,priorKey=old.customProgramCacheKey?.bind(old);
  material.onBeforeCompile=function(shader,renderer){
    prior?.call(this,shader,renderer);
    const vertex='#include <project_vertex>',fragment='#include <clipping_planes_fragment>';
    if(!shader.vertexShader.includes(vertex)||!shader.fragmentShader.includes(fragment))throw Error('Original railway shader contract changed');
    shader.uniforms.routeObserverHostRail=interval;
    shader.vertexShader='varying float routeObserverWorldX;\n'+shader.vertexShader.replace(vertex,vertex+'\nrouteObserverWorldX=(modelMatrix*vec4(transformed,1.)).x;');
    shader.fragmentShader='varying float routeObserverWorldX;uniform vec2 routeObserverHostRail;\n'+shader.fragmentShader.replace(fragment,fragment+'\nif(routeObserverWorldX>=routeObserverHostRail.x&&routeObserverWorldX<=routeObserverHostRail.y)discard;');
  };
  material.customProgramCacheKey=()=>String(priorKey?.()||'')+'|route-observer-exclusive-rail-v1';
  material.needsUpdate=true;rail.material=material;
  const box=new THREE.Box3();
  function update(){hostRail.updateWorldMatrix(true,false);box.copy(nativeBounds).applyMatrix4(hostRail.matrixWorld);interval.value.set(box.min.x,box.max.x);}
  update();return {update,interval};
}

// Inject the actual retained host exports. This adapter cannot create a Session,
// train, crowd, street district, game clock or alternate model implementation.
export function createRouteObserverDomain({THREE,world,source,applyGroundClearance,getExclusions=()=>[]}){
  const {createStationModel,createFlatTerrain,partitionTerrain,buildEnvironment,WORLD,FLAT_WORLD:spec,PLATFORM_LAYOUT:platform}=source||{};
  if(!THREE?.Group||!world?.root||!world.terrain||typeof world.stationProof!=='function'||![createStationModel,createFlatTerrain,partitionTerrain,buildEnvironment].every(v=>typeof v==='function')||!spec||!platform)throw Error('Actual retained host factories and terrain required');
  if(spec.slotCount!==7||spec.chunkCount!==8||spec.terrainRadius!==224||!Number.isFinite(spec.period)||spec.period<=0||spec.period>100)throw Error('Bounded original seven-slot terrain specification required');
  if(typeof applyGroundClearance!=='function')throw Error('Existing bureau ground-clearance callback required');
  const hostRail=world.terrain.getObjectByName(RAIL);
  if(!hostRail?.geometry||!world.terrain.getObjectByName(EARTH))throw Error('Retained host ground/rail contract changed');
  const root=new THREE.Group();root.name='Bounded same-world route observation';world.root.add(root);
  const stations=new Map(),matrix=new THREE.Matrix4();let terrain=null,currentView=null,currentRoute=null,closed=false;
  const proof={schema:'kaopu.route-observer/1',policy:ROUTE_OBSERVER_POLICY,source:'unchanged retained host factories',simulationWrites:0,
    active:false,auxiliaryEarthMeshes:0,terrainBuilds:0,terrainDisposals:0,stationBuilds:0,stationDisposals:0,
    activeStationIndices:[],frame:null,hostRailWorld:null,groundClearance:null,droppedDuplicateChunks:0,droppedDuplicateFields:0,droppedOverlapPlants:0,
    browserVerified:false,gpuVerified:false};
  const snapshot=()=>structuredClone(proof);

  function releaseStation(index){const record=stations.get(index);if(!record)return;record.model.group.removeFromParent();record.model.dispose();stations.delete(index);proof.stationDisposals++;}
  function releaseTerrain(){if(!terrain)return;disposeResources(terrain.model.root,terrain.resources);terrain=null;proof.terrainDisposals++;proof.groundClearance=null;proof.hostRailWorld=null;}
  function leave(){if(closed)return;for(const index of [...stations.keys()])releaseStation(index);releaseTerrain();currentView=null;currentRoute=null;proof.active=false;proof.activeStationIndices=[];proof.frame=null;proof.droppedDuplicateChunks=proof.droppedDuplicateFields=proof.droppedOverlapPlants=0;}

  function buildTerrain(){
    // Exactly the host's own source construction and fixed seven-slot budget.
    const model=createFlatTerrain(partitionTerrain(buildEnvironment(WORLD,{platformCorridor:true,includeBridge:false,optimizeGeometry:true})),spec),resources=resourceSet();
    collectResources(model.root,resources);
    try{
      const ground=model.root.getObjectByName(EARTH),rail=model.root.getObjectByName(RAIL),fields=model.root.getObjectByName(FIELDS);
      if(!ground||!rail||!fields)throw Error('Retained terrain object contract changed');
      // Existing helper expects both original earth and fields. Install it before
      // detaching duplicate earth; the one host plane already covers this site.
      const groundClearance=applyGroundClearance({root:model.root},()=>currentView,()=>currentRoute);
      collectResources(model.root,resources);
      ground.removeFromParent();
      const railOwnership=installRailOwnership(rail,hostRail,THREE);
      collectResources(model.root,resources);
      root.add(model.root);terrain={model,resources,railOwnership,groundClearance};proof.terrainBuilds++;
    }catch(error){disposeResources(model.root,resources);throw error;}
  }

  function deduplicateTerrain(frame){
    // Same source tile is identified by chunk index and translated original
    // offset, not slot number (the two seven-slot rings can recycle differently).
    const chunks=new Set(),fields=new Set();
    const hostShift=world.terrain.position.x;
    world.terrain.traverse(object=>{
      if(!object.visible)return;
      const high=highIndex(object.name),low=lowIndex(object.name);
      if(high!==undefined)chunks.add(key(high,hostShift+object.position.x));
      if(low!==undefined||object.name===FIELDS)for(let i=0;i<object.count;i++){
        object.getMatrixAt(i,matrix);const x=hostShift+object.position.x+matrix.elements[12];
        if(low!==undefined)chunks.add(key(low,x));else fields.add(key('field',x));
      }
    });
    let droppedChunks=0,droppedFields=0,droppedPlants=0;
    const inHostPlants=x=>x>=frame.hostMinX&&x<=frame.hostMaxX;
    terrain.model.root.traverse(object=>{
      const high=highIndex(object.name),low=lowIndex(object.name),isFields=object.name===FIELDS,isProxy=proxy(object.name);
      const globalX=frame.shiftX+object.position.x;
      if(high!==undefined&&object.visible&&chunks.has(key(high,globalX))){object.visible=false;droppedChunks++;}
      if(plant(object.name)&&object.visible&&inHostPlants(globalX)){object.visible=false;droppedPlants++;}
      if(low!==undefined||isFields||isProxy){let count=0;
        for(let i=0;i<object.count;i++){
          object.getMatrixAt(i,matrix);const x=globalX+matrix.elements[12];
          if(low!==undefined&&chunks.has(key(low,x))){droppedChunks++;continue;}
          if(isFields&&fields.has(key('field',x))){droppedFields++;continue;}
          if(isProxy&&inHostPlants(x)){droppedPlants++;continue;}
          if(count!==i)object.setMatrixAt(count,matrix);count++;
        }
        object.count=count;object.instanceMatrix.needsUpdate=true;
      }
    });
    proof.droppedDuplicateChunks=droppedChunks;proof.droppedDuplicateFields=droppedFields;proof.droppedOverlapPlants=droppedPlants;
  }

  function update(view,route,{enabled=false,centerX=spec.centerX}={}){
    if(closed)return snapshot();
    if(!Array.isArray(route))throw Error('Actual route array required');
    const frame=observerSamplingFrame(view.distance,centerX,spec);
    if(!observerNeeded(enabled,frame)){leave();return snapshot();}
    // Do not promise earth beyond the actual pre-existing finite plane.
    if(Math.abs(centerX)+spec.terrainRadius+spec.period>spec.groundHalfSize)throw Error('Observer domain would exceed retained broad earth');
    currentView=view;currentRoute=route;
    if(!terrain)buildTerrain();
    terrain.model.root.position.x=frame.shiftX;
    terrain.model.update(frame.samplingChainage,observerLocalExclusions(getExclusions(view,route),frame.shiftX));
    deduplicateTerrain(frame);terrain.railOwnership.update();
    const hostIndices=new Set((world.stationProof?.()||[]).map(plan=>plan.index));
    const desired=observerStationPlans(view,route,frame,platform,hostIndices),desiredKeys=new Map(desired.map(plan=>[plan.index,planKey(plan)]));
    // Retire before constructing replacement, keeping the two-station cap even
    // during route replacement or the handover to native host streaming.
    for(const [index,record]of stations)if(desiredKeys.get(index)!==record.key)releaseStation(index);
    for(const plan of desired){
      if(!stations.has(plan.index)){const model=createStationModel(plan);stations.set(plan.index,{model,key:planKey(plan)});root.add(model.group);proof.stationBuilds++;}
      const {model}=stations.get(plan.index);model.update(view,plan);
      // Override only the source model's train-domain draw cull. The model got
      // the exact authoritative view object and its original route station.
      model.group.visible=true;
    }
    proof.active=true;proof.frame=frame;proof.activeStationIndices=[...stations.keys()];proof.hostRailWorld=terrain.railOwnership.interval.value.toArray();proof.groundClearance=terrain.groundClearance;
    return snapshot();
  }

  function dispose(){if(closed)return;leave();closed=true;currentView=null;currentRoute=null;root.removeFromParent();root.clear();}
  return {root,update,leave,dispose,snapshot,get proof(){return snapshot();}};
}
