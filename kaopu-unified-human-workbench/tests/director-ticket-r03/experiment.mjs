import {createNativeActorHostBinding,createNativePalmSurfaceProvider} from './hand-anchor-r02.mjs';
import {bindExistingWorkbenchHand} from './existing-wrapper.mjs';
import {createContactTicket,createPropContact} from './prop-contact.mjs';
export async function createTicketExperiment({api,calibrationRecord,THREE,createStationRoom}) {
 const s=api.motion(),scene=s.viewer.scene,originalCamera=s.viewer.camera.position.clone(),originalTarget=s.viewer.orbit.target.clone();
 // Actually exercise the delivered wrapper, then release its parent ownership.
 const wrapper=await bindExistingWorkbenchHand({api,parent:scene,calibrationRecord});
 const wrapped=wrapper.update({elapsed:0}),paused=wrapper.update({elapsed:0});
 if(wrapped.revision!==paused.revision)throw Error('Wrapper pause failed');wrapper.restoreParent();
 const a=s.actors[0],h=a.human,rig=s.hand.rig,cal=calibrationRecord.calibrations.find(c=>c.side==='R');
 const originalParent=a.group.parent,originalPosition=a.group.position.clone(),originalQuaternion=a.group.quaternion.clone();
 const world=new THREE.Group();world.name='director-ticket-isolated-take';scene.add(world);world.add(a.group);
 a.group.position.set(.88,h.floorOffset,-.38);a.group.rotation.set(0,0,0);world.updateWorldMatrix(true,true);
 const room=createStationRoom({}, {variant:'city-waiting-room'});room.group.position.set(0,-.82,0);world.add(room.group);world.updateWorldMatrix(true,true);
 const realTableTop=room.group.localToWorld(new THREE.Vector3(.82,1.4625,.43));if(realTableTop.distanceTo(new THREE.Vector3(.82,.6425,.43))>1e-8)throw Error('Room/table anchor mismatch');
 const tableY=.6425,contactPalmY=tableY+.0016,ticket=createContactTicket(THREE);world.add(ticket.root);
 ticket.root.position.set(.63,tableY+.0004,.15);ticket.root.updateMatrixWorld(true);
 const initialTicket=ticket.root.matrixWorld.clone(),identity={topologySha256:cal.topologySha256,adapterFingerprint:cal.adapterFingerprint,shapeFingerprint:wrapper.shapeFingerprint};
 const wrist=rig.index.get('wrist.R'),limb=rig.limbs.armR,localGrip=new THREE.Matrix4().set(...cal.wristToGrip),restWrist=new THREE.Matrix4().set(...rig.rest[wrist]);
 const row=m=>Array.from(m.clone().transpose().elements),position=m=>new THREE.Vector3(m[3],m[7],m[11]);
 const matrixRotation=m=>[m.elements[0],m.elements[4],m.elements[8],m.elements[1],m.elements[5],m.elements[9],m.elements[2],m.elements[6],m.elements[10]];
 const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
 const keys=[[0,.63,.89,.15],[1.5,.63,contactPalmY,.15],[2,.63,contactPalmY,.15],[3.5,.63,.90,.15],[5.5,.80,.90,.15],[7.5,.80,contactPalmY,.15],[8.4,.80,contactPalmY,.15],[10,.80,.87,.04]];
 const targetAt=t=>{let j=1;while(j<keys.length-1&&t>keys[j][0])j++;const l=keys[j-1],r=keys[j],q=smooth((t-l[0])/(r[0]-l[0]));return new THREE.Vector3(...l.slice(1).map((v,i)=>v+(r[i+1]-v)*q));};
 const sampleRig=(v)=>{const out=[0,0,0];for(let n=0;n<h.range[v*2+1];n++){const k=(h.range[v*2]+n)*8,m=rig.skinMatrices[h.packed[k+3]],w=h.packed[k+4];for(let q=0;q<3;q++)out[q]+=w*(m[q*4]*h.packed[k]+m[q*4+1]*h.packed[k+1]+m[q*4+2]*h.packed[k+2]+m[q*4+3]);}return new THREE.Vector3(...out);};
 let metrics={},frameTime=0;
 const binding=createNativeActorHostBinding({actor:a,readIdentity:()=>{if(s.actors[0]!==a)throw Error('Actor replaced');return identity;},isAutonomouslyPlaying:()=>s.playing||s.hand.playing,evaluateFrame:elapsed=>{
   const t=elapsed-1;frameTime=t;const f=rig.evaluate(1.8,{task:'open',duration:6,side:'R'});
   // New bounded action experiment: existing native torso joint and arm IK only.
   const angle=65*Math.PI/180,c=Math.cos(angle),q=Math.sin(angle);rig.rotateSubtree(rig.index.get('spine05'),[1,0,0,0,c,-q,0,q,c]);
   const desiredWorld=new THREE.Matrix4().set(-1,0,0,0,0,-1,0,0,0,0,1,0,0,0,0,1).setPosition(targetAt(t));
   h.mesh.updateWorldMatrix(true,false);const desiredNative=h.mesh.matrixWorld.clone().invert().multiply(desiredWorld),wantedPalm=new THREE.Vector3().setFromMatrixPosition(desiredNative),desiredWrist=desiredNative.clone().multiply(localGrip.clone().invert());
   let goal=new THREE.Vector3().setFromMatrixPosition(desiredWrist),solved;
   const skinRotation=matrixRotation(desiredWrist.clone().multiply(restWrist.clone().invert()));
   const shoulder=position(rig.posedMatrices[limb.a]),pole=shoulder.clone().add(new THREE.Vector3(-.35,0,-.3));
   for(let i=0;i<4;i++){solved=rig.solveLimb(limb,goal.toArray(),pole.toArray(),.995);rig.orientSkin(wrist,skinRotation);const actual=cal.vertices.reduce((out,v,k)=>out.addScaledVector(sampleRig(v),cal.barycentric[k]),new THREE.Vector3());goal.add(wantedPalm.clone().sub(actual));}
   const actual=cal.vertices.reduce((out,v,k)=>out.addScaledVector(sampleRig(v),cal.barycentric[k]),new THREE.Vector3());
   metrics={target:targetAt(t).toArray(),palmReachErrorM:actual.distanceTo(wantedPalm),clamped:solved.clamped,iterations:4,torsoBendDegrees:65};return f;
 }});
 const palm=createNativePalmSurfaceProvider({readNativeFrame:()=>binding.readFrame(),readNativeVertex:i=>h.sampleVertex(i),readNativeToWorld:()=>row(h.mesh.matrixWorld),side:'R',expectedTopology:identity.topologySha256,expectedFingerprint:identity.adapterFingerprint,expectedShapeFingerprint:identity.shapeFingerprint,calibration:cal});
 const staticTriangles=[];room.group.traverse(o=>{if(!o.isMesh)return;const p=o.geometry.attributes.position,idx=o.geometry.index;for(let i=0;i<(idx?.count??p.count);i+=3){const pts=[0,1,2].map(k=>new THREE.Vector3().fromBufferAttribute(p,idx?idx.getX(i+k):i+k).applyMatrix4(o.matrixWorld));if(pts.every(v=>Math.abs(v.y-tableY)<1e-6))continue;staticTriangles.push({pts,name:o.name,triangle:i/3});}});
 const overlap=(worldMatrix,pts)=>{const inv=new THREE.Matrix4().set(...worldMatrix).invert();return new THREE.Box3(new THREE.Vector3(-.0425,-.0004,-.0225),new THREE.Vector3(.0425,.0004,.0225)).intersectsTriangle(new THREE.Triangle(...pts.map(v=>v.clone().applyMatrix4(inv))));};
 const obstacleCheck=m=>{for(const tri of staticTriangles)if(overlap(m,tri.pts))return {clear:false,mesh:tri.name,triangle:tri.triangle};return {clear:true};};
 const handVertices=new Set();for(let v=0;v<h.N;v++)for(let n=0;n<h.range[v*2+1];n++){const k=(h.range[v*2]+n)*8;if(/^(wrist|finger|metacarpal).*\.R$/.test(h.names[h.packed[k+3]])&&h.packed[k+4]>.05)handVertices.add(v);}
 const handTriangles=[];for(let i=0;i<h.faces.length;i+=3){const ids=Array.from(h.faces.slice(i,i+3));if(ids.some(v=>handVertices.has(v)))handTriangles.push({ids,triangle:i/3});}
 const handOverlap=m=>{let count=0,first=null;const cache=new Map();for(const tri of handTriangles){const pts=tri.ids.map(v=>{if(!cache.has(v))cache.set(v,new THREE.Vector3(...h.sampleVertex(v)).applyMatrix4(h.mesh.matrixWorld));return cache.get(v);});if(overlap(m,pts)){count++;if(first===null)first=tri.triangle;}}return {intersectingTriangles:count,first,scope:'Actual current CSR right-hand triangles versus ticket OBB only; no garment dynamics, solid containment or sweep.'};};
 const apply=m=>{ticket.root.matrixAutoUpdate=false;ticket.root.matrix.copy(world.matrixWorld.clone().invert().multiply(new THREE.Matrix4().set(...m)));ticket.root.updateWorldMatrix(false,false);};
 const gripToProp=[-1,0,0,0,0,-1,0,.0012,0,0,1,0,0,0,0,1];let releaseEvents=0,contact=null,latestPalm=null,attempted=false,failures=[];
 const makeContact=()=>createPropContact({handAnchor:()=>latestPalm,surface:()=>({center:[.82,tableY,.43],normal:[0,1,0],u:[1,0,0],v:[0,0,1],halfExtents:[.575,.34],canPlace:({matrix})=>obstacleCheck(matrix).clear}),readWorldMatrix:()=>row(ticket.root.matrixWorld),applyWorldMatrix:apply,gripToProp,onRelease:()=>releaseEvents++});
 const hud=document.createElement('div');hud.style='position:fixed;left:18px;top:18px;padding:10px;background:#111d;color:white;font:16px monospace;z-index:9999';document.body.append(hud);
 s.viewer.camera.position.set(-.4,1.35,-1.5);s.viewer.orbit.target.set(.82,.88,.17);s.viewer.orbit.update();
 const frame=t=>{const host={elapsed:1+t};binding.update(host);latestPalm=palm(host);let event=null;
   if(t>=2&&!attempted){attempted=true;const desired=new THREE.Matrix4().set(...latestPalm.matrix).multiply(new THREE.Matrix4().set(...gripToProp));const gap=new THREE.Vector3().setFromMatrixPosition(desired).distanceTo(new THREE.Vector3().setFromMatrixPosition(ticket.root.matrixWorld));if(gap>.002){failures.push({t,stage:'pickup',reason:'Palm cannot reach resting ticket without teleport',gap});}else{contact=makeContact();try{contact.begin(host);event='kinematic-attach; anatomical grip UNVERIFIED';}catch(e){failures.push({t,stage:'attach',reason:String(e)});contact=null;}}}
   if(contact&&['held','contact'].includes(contact.snapshot().state)){try{contact.update(host);if(t>=8.1&&t<=8.4){if(contact.release(host))event='release';}}catch(e){failures.push({t,stage:'move/contact',reason:String(e)});contact.cancel();event='cancelled';}}
   ticket.root.updateWorldMatrix(true,false);const matrix=row(ticket.root.matrixWorld),skin=handOverlap(matrix),obstacle=obstacleCheck(matrix);hud.textContent=`S01 TECHNICAL TAKE | ${t.toFixed(1)}s | ${contact?.snapshot().state||'resting'} | grip NOT certified | hand intersections ${skin.intersectingTriangles}`;s.viewer.render();
   return {t,hostElapsed:host.elapsed,palmRevision:latestPalm.revision,event,metrics:{...metrics},palm:latestPalm.matrix,ticket:matrix,skin,obstacle,state:contact?.snapshot()||{state:'resting'},releaseEvents};
 };
 return {frame,setup:{wrapperExecuted:true,wrapperPausePassed:true,originalActor:true,vertices:h.N,triangles:h.faces.length/3,handTriangles:handTriangles.length,staticTriangles:staticTriangles.length,identity,clock:'host.elapsed only',scope:'New experimental original-joint IK. Anatomical grip and dynamic collision not certified.'},checks(){const host={elapsed:11},before=row(ticket.root.matrixWorld);let rewindRejected=false;try{binding.update({elapsed:10});}catch{rewindRejected=true;}const paused=binding.update(host),same=binding.update(host);const duplicateRelease=contact?.release(host)??false;const second=makeContact();const old=latestPalm;let cancelRestore=false,repeatBeginRejected=false;try{second.begin(host);try{second.begin(host);}catch{repeatBeginRejected=true;}second.cancel();cancelRestore=row(ticket.root.matrixWorld).every((v,i)=>Math.abs(v-before[i])<1e-9);}catch(e){failures.push({stage:'cancel-test',reason:String(e)});}latestPalm=old;return {rewindRejected,pauseRevisionStable:paused.revision===same.revision,duplicateRelease,releaseEvents,cancelRestore,repeatBeginRejected,failures,storyActionPassed:false,reason:'Kinematic binding does not prove actual finger opposition or secure pickup; audit intersections before accepting.'};},dispose(){contact?.cancel();ticket.dispose();room.group.removeFromParent();room.dispose();originalParent.add(a.group);a.group.position.copy(originalPosition);a.group.quaternion.copy(originalQuaternion);world.removeFromParent();hud.remove();s.viewer.camera.position.copy(originalCamera);s.viewer.orbit.target.copy(originalTarget);s.viewer.orbit.update();s.viewer.render();return {parentRestored:a.group.parent===originalParent,actorRetained:s.actors[0]===a};}};
}
