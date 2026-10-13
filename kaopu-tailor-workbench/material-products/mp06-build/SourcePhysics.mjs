import {CoupledCloth} from '../parent/coupled-cloth.mjs';
import {MeshContact,closestTriangle} from '../parent/mesh-contact.mjs';
import {accelerateWorld,loadClothKernel} from '../parent/wasm-cloth.mjs';
import {SourceActor} from './SourceActor.mjs';
/** Adapt the original paper to the latest native body by exact body vertex correspondence.
 * This is a recorded rest-fit transfer, not motion skinning and not a new paper measurement. */
export function fitRows(rows,oldBody,actor,faces){if(oldBody.length!==actor.native.length)throw Error('Body correspondence vertex count changed');const old=new Float32Array(oldBody.length);for(let i=0;i<old.length;i+=3){old[i]=oldBody[i];old[i+1]=oldBody[i+2];old[i+2]=-oldBody[i+1];}const mesh=new MeshContact(old,faces),q=new Float64Array(7);let max=0;
 const fitted=rows.map(r=>{const p=Float32Array.from(r.positions);for(let i=0;i<p.length;i+=3){const f=mesh.nearest(p[i],p[i+1],p[i+2]);closestTriangle(old,mesh.faces,f,p[i],p[i+1],p[i+2],q);for(let k=0;k<3;k++){let delta=0;for(let v=0;v<3;v++){const j=mesh.faces[f+v]*3+k;delta+=(actor.positions[j]-old[j])*q[4+v];}max=Math.max(max,Math.abs(delta));p[i+k]+=delta;}}return{...r,positions:p};});return{rows:fitted,maxTransferredCoordinateM:max};
}
export async function makeSourceWorld({rows,oldBody,actor:packet,settings,wasm}){
 const actor=new SourceActor(packet),surface=new MeshContact(actor.positions,packet.faces),fitted=fitRows(rows,oldBody,actor,packet.faces);
 // The C solver always uses current-body triangles (kind=1). These metadata only
 // satisfy the unused legacy grid allocation interface; no grid collision is used.
 Object.assign(surface,{data:new Int16Array(8),n:[2,2,2],o:[0,0,0],h:1,q:1,shift:0});
 const world=new CoupledCloth(fitted.rows,{sdf:surface,settings});world.actor=actor;world.actorPacket=packet;world.body=surface;world.bodyActive=true;world.motion='source';
 // Preserve every original constraint and safety threshold. Dense contact audits remain explicit.
 for(const s of world.solvers){const prior=s.audit.bind(s);s.audit=(dense=false)=>{if(dense)return prior(true);let lo=Infinity,hi=0;for(const e of s.edges){const a=e.a*3,b=e.b*3,r=Math.hypot(s.p[a]-s.p[b],s.p[a+1]-s.p[b+1],s.p[a+2]-s.p[b+2])/e.rest;lo=Math.min(lo,r);hi=Math.max(hi,r);}return{type:'original XPBD distance/dihedral',particles:s.count,minEdgeStretch:lo,maxEdgeStretch:hi,seconds:s.time,sewnPairs:s.seamPairs.length,bodyDistanceNotSampled:true};};}
 accelerateWorld(world,await loadClothKernel(wasm));world.fit=fitted;world.stepSource=(frame,dt=1/30)=>{const before={skin:actor.skin.map(m=>m.slice()),world:actor.world.map(m=>m.slice())};actor.pending=frame;try{world.step(dt,true);}catch(e){actor.pending=before;actor.at();surface.refit();world.acceleration.actorPrevious.set(actor.positions);world.acceleration.actorTarget.set(actor.positions);throw e;}surface.refit();return world.rows();};world.motionTime=0;
 return world;
}
