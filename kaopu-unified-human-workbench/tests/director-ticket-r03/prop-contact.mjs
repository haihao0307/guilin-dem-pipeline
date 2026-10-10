import {IDENTITY,mul,point,rigid,BlockedDependency} from './hand-anchor-r02.mjs';
const distance=(a,b)=>Math.hypot(...a.map((x,i)=>x-b[i])),dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0),sub=(a,b)=>a.map((x,i)=>x-b[i]);
/** Ticket geometry only. This creates no person, no texture and no animation clock. */
export function createContactTicket(THREE){const size=[.085,.0008,.045],geometry=new THREE.BoxGeometry(...size),material=new THREE.MeshStandardMaterial({color:0xe1d8bb,roughness:.92}),root=new THREE.Mesh(geometry,material);root.name='Original unprinted contact ticket';let dead=false;return {root,size,dispose(){if(dead)return;dead=true;root.removeFromParent();geometry.dispose();material.dispose();}};}
/** Pure attachment/contact state machine. applyWorldMatrix must bind an existing prop.
 * Mandatory canPlace checks existing tea items, hands and other scene obstacles. */
export function createPropContact({handAnchor,surface,readWorldMatrix,applyWorldMatrix,gripToProp=IDENTITY,size=[.085,.0008,.045],settleSeconds=.12,contactTolerance=.003,maxContactSpeed=.05,onRelease=()=>{}}={}){
 if(typeof handAnchor!=='function'||typeof surface!=='function'||typeof readWorldMatrix!=='function'||typeof applyWorldMatrix!=='function')throw new BlockedDependency('Native hand, real table surface, and existing prop world-matrix hooks required');rigid(gripToProp);
 if(!Array.isArray(size)||size.length!==3||!size.every(x=>Number.isFinite(x)&&x>0))throw Error('Positive metre dimensions required');
 let state='idle',saved=null,lastTime=null,lastMatrix=null,contactSince=null,releasedOnce=false,latest=null;
 function cancel(){if(!['held','contact'].includes(state))return false;applyWorldMatrix(saved.slice());state='cancelled';contactSince=null;return true;}
 function update(host){if(!['held','contact'].includes(state))return snapshot();if(!Number.isFinite(host?.elapsed)||host.elapsed<lastTime)throw Error('Monotonic host elapsed required');
  const a=handAnchor(host);if(a.units!=='metre'||a.axis!=='Y_UP'||Math.abs(a.elapsed-host.elapsed)>1e-7)throw new BlockedDependency('Stale or wrong-coordinate hand anchor');rigid(a.matrix);const m=mul(a.matrix,gripToProp);rigid(m);
  if(host.elapsed===lastTime&&lastMatrix&&m.some((x,i)=>Math.abs(x-lastMatrix[i])>1e-8))throw Error('Pose changed while host time was paused');
  const s=surface(host);if(!s||typeof s.canPlace!=='function')throw new BlockedDependency('Real surface obstacle check missing');
  if(![s.center,s.normal,s.u,s.v].every(v=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite))||!Array.isArray(s.halfExtents)||s.halfExtents.length!==2||!s.halfExtents.every(v=>Number.isFinite(v)&&v>0))throw Error('Invalid surface frame');for(const v of [s.normal,s.u,s.v])if(Math.abs(dot(v,v)-1)>1e-5)throw Error('Surface axes must be unit');if(Math.abs(dot(s.normal,s.u))+Math.abs(dot(s.normal,s.v))+Math.abs(dot(s.u,s.v))>1e-5)throw Error('Surface axes must be orthogonal');
  const corners=[];for(const x of [-1,1])for(const y of [-1,1])for(const z of [-1,1])corners.push(point(m,[x*size[0]/2,y*size[1]/2,z*size[2]/2]));
  const gaps=corners.map(p=>dot(sub(p,s.center),s.normal)),minGap=Math.min(...gaps);if(minGap<-.001)throw Error('Ticket would penetrate table; no snap or hidden hand teleport');
  const inside=corners.every(p=>Math.abs(dot(sub(p,s.center),s.u))<=s.halfExtents[0]&&Math.abs(dot(sub(p,s.center),s.v))<=s.halfExtents[1]);
  const aligned=dot([m[1],m[5],m[9]],s.normal)>=Math.cos(5*Math.PI/180),dt=host.elapsed-lastTime,speed=lastMatrix&&dt>0?distance(point(m,[0,0,0]),point(lastMatrix,[0,0,0]))/dt:0;
  const free=s.canPlace({matrix:m.slice(),size:size.slice(),corners});if(free!==true)throw new BlockedDependency('Scene obstacle veto; prop remains at last valid pose');const contact=inside&&aligned&&minGap<=contactTolerance&&speed<=maxContactSpeed&&free===true;
  if(contact){if(contactSince===null)contactSince=host.elapsed;state='contact';}else{contactSince=null;state='held';}
  applyWorldMatrix(m.slice());lastTime=host.elapsed;lastMatrix=m.slice();latest={minGap,inside,aligned,speed,obstacleClear:free===true,stableSeconds:contactSince===null?0:host.elapsed-contactSince};return snapshot();
 }
 function snapshot(){return{schema:'kaopu.director.prop-contact/1',state,elapsed:lastTime,contact:latest?{...latest}:null,releasedOnce,worldTimeMutation:false};}
 return {begin(host){if(state!=='idle')throw Error('Begin once; create a new take after cancel or release');if(!Number.isFinite(host?.elapsed)||host.elapsed<0)throw Error('host.elapsed required');saved=readWorldMatrix().slice();rigid(saved);lastTime=host.elapsed;state='held';return update(host);},update,release(host){if(releasedOnce)return false;update(host);if(state!=='contact'||latest.stableSeconds+1e-8<settleSeconds)return false;state='released';releasedOnce=true;onRelease({elapsed:host.elapsed,matrix:lastMatrix.slice()});return true;},cancel,snapshot,dispose(){cancel();state='disposed';}};
}
