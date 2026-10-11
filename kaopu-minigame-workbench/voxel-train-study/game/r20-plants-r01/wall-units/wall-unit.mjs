import {WALL_OPERATOR,normalizeWallScore} from './wall-score.mjs';
import {planWallUnit,buildWallGeometry} from './wall-geometry.mjs';
import {createWallMaterials} from './wall-materials.mjs';
export {WALL_SCHEMA,WALL_KINDS,normalizeWallScore,canonicalWallScore} from './wall-score.mjs';
export {planWallUnit} from './wall-geometry.mjs';
export const WALL_ABI='KWU1';

export function buildWallUnit(input,{THREE,materials}={}) {
  if(!THREE?.BufferGeometry||!THREE?.Mesh)throw TypeError('Host THREE is required');
  const plan=planWallUnit(input),s=plan.score;
  const used=new Set(plan.parts.map(p=>p.material));
  const surface=createWallMaterials(materials,s,Object.fromEntries(Object.entries(plan.recipes).filter(([k])=>used.has(k))));
  let built;
  try{built=buildWallGeometry(plan,THREE,surface);}catch(e){surface.dispose();throw e;}
  const {root,doorGroup}=built;root.position.fromArray(s.placement.position);root.rotation.y=s.placement.yaw;
  const bounds=new THREE.Box3();let disposed=false,time=0,wetness=s.material.wetness;
  const proof={schema:s.schema,operator:WALL_OPERATOR,abi:WALL_ABI,id:s.object.id,kind:s.kind,
    units:'metres',upAxis:'Y',outwardAxis:'+Z',originalProcedural:true,externalMesh:false,externalImageTextures:false,
    materialCoordinates:'whole-unit-local-metres',sourceMaterialRevision:surface.materials[0]?.userData.wall.sourceRevision,
    materialsAndShapeShareScore:true,opening:structuredClone(plan.opening),graph:structuredClone(plan.graph),
    utilityPorts:structuredClone(plan.ports),utilityPaths:structuredClone(plan.pipePaths),hangingSockets:structuredClone(plan.attachments),
    runoffSources:structuredClone(plan.runoffSources),repairRegions:structuredClone(plan.repairRegions),stats:{...built.stats,materials:surface.materials.length,textures:0},
    cageIsWalkableBalcony:false,standingFloorProvided:false,stairsProvided:false,populationProvided:false,
    clock:'host world seconds',time,wetness,visualValidated:false,gpuShaderCompiled:false};
  root.userData.wallUnit=proof;root.userData.requiresUnitLocalMaterialCoordinates=true;
  function alive(){if(disposed)throw Error('Wall unit disposed');if(!root.getWorldScale(new THREE.Vector3()).toArray().every(v=>Math.abs(v-1)<1e-6))throw Error('Wall unit and ancestors must remain scale 1; regenerate dimensions instead');}
  function measure(){alive();root.updateWorldMatrix(true,true);bounds.setFromObject(root);return{...proof.stats,worldBounds:{min:bounds.min.toArray(),max:bounds.max.toArray()}};}
  function setDoorOpen(open){alive();if(typeof open!=='boolean')throw TypeError('Door state must be boolean');if(!plan.hinge)throw Error('This wall has no door leaf');s.door.open=open;doorGroup.rotation.y=open?plan.hinge.openAngle:0;const edge=proof.graph.edges.find(e=>e.id==='through-door');edge.enabled=open;proof.doorOpen=open;root.updateWorldMatrix(true,true);return open;}
  if(plan.hinge)setDoorOpen(s.door.open);
  surface.update(time,wetness);
  function worldGraph(){alive();root.updateWorldMatrix(true,true);const point=p=>new THREE.Vector3(...p).applyMatrix4(root.matrixWorld).toArray(),direction=n=>new THREE.Vector3(...n).transformDirection(root.matrixWorld).toArray();
    return{nodes:proof.graph.nodes.map(n=>({...structuredClone(n),position:point(n.position),normal:direction(n.normal)})),edges:structuredClone(proof.graph.edges),
      utilityPorts:proof.utilityPorts.map(n=>({...structuredClone(n),position:point(n.position),normal:direction(n.normal)})),
      hangingSockets:proof.hangingSockets.map(n=>({...structuredClone(n),position:point(n.position),normal:direction(n.normal)}))};}
  return{root,proof,plan,materials:surface.materials,
    update(nextTime,world={}){alive();if(!Number.isFinite(nextTime))throw Error('A finite authoritative time is required');time=nextTime;if(world.wetness!=null){if(!Number.isFinite(world.wetness)||world.wetness<0||world.wetness>1)throw Error('Invalid world wetness');wetness=world.wetness;}surface.update(time,wetness);proof.time=time;proof.wetness=wetness;},
    setDoorOpen,worldGraph,measure,
    passageFits({width,height}){alive();if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)throw Error('Supply actual body envelope in metres');const edge=proof.graph.edges[0];return{fits:!!edge&&edge.enabled&&width<=edge.clearWidth&&height<=edge.clearHeight,edge:edge?structuredClone(edge):null,body:{width,height},codeComplianceClaim:false};},
    snapshot(){alive();return{score:normalizeWallScore(s),proof:structuredClone(proof),measure:measure()};},
    dispose(){if(disposed)return;built.dispose();surface.dispose();disposed=true;proof.disposed=true;},get disposed(){return disposed;}};
}

// Connectors are explicit. No automatic layout, root transforms, or doors.
export function checkWallJoin(a,aNodeId,b,bNodeId,{tolerance=.002}={}){
  if(!Number.isFinite(tolerance)||tolerance<0)throw Error('Invalid join tolerance');
  const an=a.worldGraph().nodes.find(n=>n.id===aNodeId),bn=b.worldGraph().nodes.find(n=>n.id===bNodeId);
  if(!an||!bn)throw Error('Unknown join node');
  const distance=Math.hypot(...an.position.map((v,i)=>v-bn.position[i]));
  const dot=an.normal.reduce((v,n,i)=>v+n*bn.normal[i],0);
  return{connected:an.type===bn.type&&distance<=tolerance&&dot<-.999,distance,opposedNormals:dot<-.999,
    note:'Endpoint check only; the host must also test full geometry and walking-clearance overlap.'};
}
