// CPU-only look-ahead. A prepared group never belongs to the world/renderer,
// and is not part of the live station map used by audio, crew or stationProof.
export const STATION_PREPARATION_METRES=70;
// Session.advance clamps one update to two seconds and velocity to 18 m/s.
// This renderer-side discontinuity threshold does not change either unit/rule.
export const STATION_MAX_CONTINUOUS_STEP=36;
const modelKey=plan=>JSON.stringify([plan.index,plan.target,plan.name,plan.english,plan.radius]);

function sourceBytes(group){
  const buffers=new Set(),images=new Set();let geometryBytes=0,textureBytes=0;
  const add=attribute=>{const array=attribute?.array||attribute?.data?.array,buffer=array?.buffer;if(buffer&&!buffers.has(buffer)){buffers.add(buffer);geometryBytes+=buffer.byteLength;}};
  group.traverse(object=>{
    for(const attribute of Object.values(object.geometry?.attributes||{}))add(attribute);
    add(object.geometry?.index);add(object.instanceMatrix);add(object.instanceColor);
    for(const material of Array.isArray(object.material)?object.material:object.material?[object.material]:[])
      for(const value of Object.values(material))if(value?.isTexture){const image=value.source?.data||value.image;if(image&&!images.has(image)){images.add(image);textureBytes+=image.data?.byteLength??((image.width||0)*(image.height||0)*4);}}
  });
  return{geometryBytes,textureBytes,cpuBytes:geometryBytes+textureBytes};
}

export function createStationStreaming({root,createModel,minOffset,maxOffset,isVisible=offset=>offset>=minOffset&&offset<=maxOffset,prepareMetres=STATION_PREPARATION_METRES}){
  const stations=new Map(),resources=new Map();let pending=null,lastDistance=null,lastRoute=null,lastRouteKey=null,direction=1,closed=false;
  const proof={prepareMetres,maxContinuousStep:STATION_MAX_CONTINUOUS_STEP,
    accounting:'CPU typed-array backing bytes plus RGBA8 canvas-source estimate; excludes JS objects, temporary build allocations and GPU storage',
    buildCount:0,preparationCount:0,reuseCount:0,disposeCount:0,pendingDisposeCount:0,
    liveCount:0,pendingCount:0,pendingId:null,pendingPrepareDistance:null,pendingCpuBytes:0,peakPendingCpuBytes:0,
    liveCpuBytes:0,cpuGeometryBytes:0,cpuTextureSourceBytesEstimate:0,cpuSourceBytes:0,peakCpuSourceBytes:0,
    lastUpdatePreparationCount:0,lastUpdateBuildCount:0,lastUpdateReuseCount:0,lastUpdateDisposeCount:0,lastUpdateBuildMs:0,
    lastUpdateEvents:[],events:[],eventSequence:0,distance:null,direction:1,disposed:false};
  const now=()=>globalThis.performance?.now?.()??Date.now();
  function event(type,record,extra={}){const entry={sequence:++proof.eventSequence,type,index:record?.index??null,distance:proof.distance,...extra};proof.lastUpdateEvents.push(entry);proof.events.push(entry);if(proof.events.length>128)proof.events.shift();}
  function begin(){proof.lastUpdatePreparationCount=0;proof.lastUpdateBuildCount=0;proof.lastUpdateReuseCount=0;proof.lastUpdateDisposeCount=0;proof.lastUpdateBuildMs=0;proof.lastUpdateEvents=[];}
  function account(){
    let geometryBytes=pending?.bytes.geometryBytes||0,textureBytes=pending?.bytes.textureBytes||0,liveBytes=0;
    for(const record of resources.values()){geometryBytes+=record.bytes.geometryBytes;textureBytes+=record.bytes.textureBytes;liveBytes+=record.bytes.cpuBytes;}
    proof.liveCount=stations.size;proof.pendingCount=pending?1:0;proof.pendingId=pending?.index??null;proof.pendingPrepareDistance=pending?.preparedAt??null;
    proof.pendingCpuBytes=pending?.bytes.cpuBytes||0;proof.liveCpuBytes=liveBytes;proof.cpuGeometryBytes=geometryBytes;proof.cpuTextureSourceBytesEstimate=textureBytes;proof.cpuSourceBytes=geometryBytes+textureBytes;
    proof.peakPendingCpuBytes=Math.max(proof.peakPendingCpuBytes,proof.pendingCpuBytes);proof.peakCpuSourceBytes=Math.max(proof.peakCpuSourceBytes,proof.cpuSourceBytes);
  }
  function build(plan,preparation){
    const start=now(),model=createModel(plan),bytes=sourceBytes(model.group),durationMs=now()-start;
    const record={index:plan.index,key:modelKey(plan),target:plan.target,model,bytes,preparedAt:preparation?proof.distance:null};
    // Include construction-before-retirement overlap, not only end-of-frame
    // residency. Temporary builder arrays/canvas internals remain unmeasured.
    const retained=(pending?.bytes.cpuBytes||0)+[...resources.values()].reduce((sum,r)=>sum+r.bytes.cpuBytes,0);
    proof.peakCpuSourceBytes=Math.max(proof.peakCpuSourceBytes,retained+bytes.cpuBytes);
    proof.buildCount++;proof.lastUpdateBuildCount++;proof.lastUpdateBuildMs+=durationMs;
    if(preparation){proof.preparationCount++;proof.lastUpdatePreparationCount++;model.group.visible=false;}
    event(preparation?'prepare':'build-visible',record,{cpuBytes:bytes.cpuBytes,durationMs,preparedAt:record.preparedAt});return record;
  }
  function release(record,reason,isPending=false){
    record.model.group.removeFromParent();record.model.dispose();proof.disposeCount++;proof.lastUpdateDisposeCount++;if(isPending)proof.pendingDisposeCount++;
    event('dispose',record,{reason,pending:isPending,cpuBytes:record.bytes.cpuBytes});
  }
  function clearPending(reason){if(pending){release(pending,reason,true);pending=null;}}
  function reset(){if(closed)return;begin();clearPending('reset');lastDistance=null;lastRoute=null;lastRouteKey=null;direction=1;account();}
  function update(view,route){
    if(closed)return;begin();proof.distance=view.distance;
    const delta=lastDistance===null?0:view.distance-lastDistance,
      routeKey=route.map(modelKey).join('|'),routeChanged=lastRoute!==null&&(lastRoute!==route||lastRouteKey!==routeKey),
      jump=lastDistance!==null&&Math.abs(delta)>STATION_MAX_CONTINUOUS_STEP+1e-6;
    if(routeChanged)clearPending('route-change');else if(jump)clearPending('jump');
    if(delta!==0)direction=Math.sign(delta);else if(Number.isFinite(view.velocity)&&view.velocity!==0)direction=Math.sign(view.velocity);
    proof.direction=direction;
    const visible=new Set(),nearby=new Map(view.nearbyStations.map(plan=>[plan.index,plan]));let candidate=null,candidateGap=Infinity;
    // Preserve the old inclusive attach/detach predicate and original route order.
    for(const source of route){
      const offset=source.target-view.distance,plan=nearby.get(source.index)||source;
      if(!isVisible(offset)){
        const gap=direction>0?offset-maxOffset:minOffset-offset;
        if(gap>0&&gap<=prepareMetres&&gap<candidateGap){candidate=plan;candidateGap=gap;}
        continue;
      }
      visible.add(plan.index);
      if(!stations.has(plan.index)){
        let record;
        if(pending?.index===plan.index){
          if(pending.key===modelKey(plan)){record=pending;pending=null;proof.reuseCount++;proof.lastUpdateReuseCount++;event('reuse',record,{preparedAt:record.preparedAt,cpuBytes:record.bytes.cpuBytes});}
          else clearPending('plan-change');
        }
        record??=build(plan,false);stations.set(plan.index,record.model);resources.set(plan.index,record);
      }
      const model=stations.get(plan.index);if(!model.group.parent)root.add(model.group);model.update(view,plan);
    }
    for(const id of stations.keys())if(!visible.has(id)){release(resources.get(id),'left-visible-window');stations.delete(id);resources.delete(id);}
    // A reversal may retain at most this same detached model inside the bounded
    // halo. Moving away cannot repeatedly dispose/rebuild it at the prep edge.
    if(pending){const source=route.find(plan=>plan.index===pending.index),plan=source&&(nearby.get(source.index)||source),offset=source?.target-view.distance;
      if(!plan||pending.key!==modelKey(plan))clearPending('plan-change');
      else if(offset<minOffset-prepareMetres||offset>maxOffset+prepareMetres)clearPending('left-preparation-window');
    }
    if(!pending&&candidate&&!stations.has(candidate.index)&&!routeChanged&&!jump)pending=build(candidate,true);
    lastDistance=view.distance;lastRoute=route;lastRouteKey=routeKey;account();
  }
  function dispose(){if(closed)return;begin();clearPending('world-dispose');for(const [id,record] of resources){release(record,'world-dispose');stations.delete(id);}resources.clear();closed=true;proof.disposed=true;lastRoute=null;lastRouteKey=null;account();}
  return{stations,update,reset,dispose,snapshot:()=>({...proof,lastUpdateEvents:proof.lastUpdateEvents.map(e=>({...e})),events:proof.events.map(e=>({...e}))})};
}
