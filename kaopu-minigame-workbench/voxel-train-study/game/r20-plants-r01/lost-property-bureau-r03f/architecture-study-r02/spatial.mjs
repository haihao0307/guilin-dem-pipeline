import * as T from '../geometry-orbit-r01/vendor/three.module.js';

// Author-declared route centerlines in model metres. These are sampled geometric
// clearance probes, not a navigation graph or a safety/accessibility certification.
export const PASSAGE_PATHS=Object.freeze({
 entry:[[-48,1.7,-17.5],[-39,1.7,-17.5]],
 vestibuleTurn:[[-39,1.7,-17.5],[-39,1.7,-14]],
 vestibuleToNeck:[[-39,1.7,-14],[-35,1.7,-14]],
 neckToHall:[[-35,1.7,-14],[-35,1.7,-8]],
 publicHall:[[-36.7,1.7,-7],[-36.7,1.7,18]],
 staffTower:[[-29.9,1.7,-32],[-29.9,1.7,18]],
 officeStore:[[-24,1.7,-32],[-24,1.7,-24]],
 receivingEntry:[[10,1.7,44],[10,1.7,37.5]],
 rearAisle:[[10,1.7,37.5],[-32.2,1.7,37.5]],
 receivingDoor:[[-32.2,1.7,37.5],[-32.2,1.7,31.85]],
 storeIntake:[[-32.2,1.7,31.85],[-23,1.7,31.85]],
 storeRear:[[-23,1.7,31.85],[10,1.7,31.85]],
 storeMain:[[10,1.7,31.85],[10,1.7,-24]],
 storeHandover:[[10,1.7,6.65],[-27,1.7,6.65]],
});

export function resolveElement(hit,elements=[]){
 if(!Number.isInteger(hit.faceIndex))return null;
 const vertex=hit.faceIndex*3;
 const e=elements.find(e=>e.layer===hit.object.userData.layer&&e.material===hit.object.userData.material&&vertex>=e.start&&vertex<e.start+e.count);
 return e?{id:e.id,group:e.group,layer:e.layer,material:e.material}:null;
}

export function checkPassages(root,{lateralOffsets=[0,-.35,.35],elements=[]}={}){
 root.updateMatrixWorld(true);
 const objects=root.children.filter(o=>!['routes','site'].includes(o.userData.layer));
 const out={};
 for(const[name,[a,b]]of Object.entries(PASSAGE_PATHS)){
  const direction=new T.Vector3(...b).sub(new T.Vector3(...a)),length=direction.length();
  const lateral=new T.Vector3(-direction.z,0,direction.x).normalize();
  const offsets=lateral.lengthSq()>0?lateralOffsets:[0];
  const samples=offsets.map(offset=>{
   const delta=lateral.clone().multiplyScalar(offset),start=new T.Vector3(...a).add(delta),end=new T.Vector3(...b).add(delta);
   const ray=new T.Raycaster(start,direction.clone().normalize(),.01,length-.01),hits=ray.intersectObjects(objects,false);
   const describe=hit=>({object:hit.object.name,point:hit.point.toArray(),distance:hit.distance,faceIndex:hit.faceIndex,element:resolveElement(hit,elements)});
   return{offset,a:start.toArray(),b:end.toArray(),hits:hits.length,first:hits[0]?describe(hits[0]):null,hitDetails:hits.slice(0,12).map(describe)};
  });
  const first=samples.find(s=>s.hits>0);
  out[name]={a,b,hits:samples.reduce((n,s)=>n+s.hits,0),centerHits:samples.find(s=>s.offset===0)?.hits??null,
   first:first?{offset:first.offset,...first.first}:null,samples};
 }
 return out;
}
