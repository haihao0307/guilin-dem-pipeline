/** Experimental anatomical rest calibration: official SOMA Hips + LeftForeArm
 * to existing Anny root + lowerarm01.L. NOT a general 77 -> 104 retargeter.
 * All other target local-ref inputs remain identity, not world-space frozen.
 */
const fail=(x,s)=>{if(!x)throw Error(s)},I=[1,0,0,0,1,0,0,0,1];
export const C=Object.freeze([1,0,0,0,0,-1,0,1,0]);
export const transpose=a=>[a[0],a[3],a[6],a[1],a[4],a[7],a[2],a[5],a[8]];
export const mul=(a,b)=>Array.from({length:9},(_,i)=>{const r=Math.floor(i/3),c=i%3;return a[3*r]*b[c]+a[3*r+1]*b[c+3]+a[3*r+2]*b[c+6]});
export const mv=(a,v)=>[0,1,2].map(r=>a[3*r]*v[0]+a[3*r+1]*v[1]+a[3*r+2]*v[2]);
const sub=(a,b)=>a.map((x,i)=>x-b[i]),dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],norm=a=>Math.hypot(...a);
const unit=a=>{const n=norm(a);fail(n>1e-5,'degenerate anatomical landmark span');return a.map(x=>x/n)};
const maxdiff=(a,b)=>Math.max(...a.map((x,i)=>Math.abs(x-b[i])));
const rot=m=>[m[0],m[1],m[2],m[4],m[5],m[6],m[8],m[9],m[10]],pos=m=>[m[3],m[7],m[11]];
const so3=a=>a.length===9&&a.every(Number.isFinite)&&maxdiff(mul(a,transpose(a)),I)<2e-5&&Math.abs(dot(a.slice(0,3),cross(a.slice(3,6),a.slice(6,9)))-1)<2e-5;
function frame(longitudinal,radial){const x=unit(longitudinal),project=dot(radial,x),y=unit(radial.map((v,i)=>v-project*x[i])),z=cross(x,y);return[x[0],y[0],z[0],x[1],y[1],z[1],x[2],y[2],z[2]];}
function normalizedMatrices(ms,count){fail(Array.isArray(ms)&&ms.length===count,'matrix count');return ms.map(m=>{const a=m.flat?m.flat():Array.from(m);fail(a.length===16&&a.every(Number.isFinite)&&so3(rot(a)),'finite rigid matrix required');fail(maxdiff(a.slice(12),[0,0,0,1])<1e-6,'homogeneous matrix required');return a.slice()})}
function rvDegrees(r){fail(so3(r),'rotation must be SO3');const v=[r[7]-r[5],r[2]-r[6],r[3]-r[1]],s=norm(v)/2,c=Math.max(-1,Math.min(1,(r[0]+r[4]+r[8]-1)/2)),a=Math.atan2(s,c);fail(a<Math.PI-.001,'near-pi outside calibration prototype');return s<1e-9?[0,0,0]:v.map(x=>x*a/(2*s)*180/Math.PI)}
export function createSomaForearmCalibration({sourceNames,sourceParents,sourceZeroTransforms,targetNames,targetParents,targetRestMatrices,restFingerprint}) {
 fail(sourceNames?.length===78&&new Set(sourceNames).size===78,'exact public SOMA78 names required');fail(sourceNames[0]==='Root'&&sourceNames[1]==='Hips','virtual Root / Hips ordering');
 fail(sourceParents?.length===78&&sourceParents[0]===-1&&sourceParents.slice(1).every((x,i)=>Number.isInteger(x)&&x>=0&&x<=i),'source parent hierarchy');
 fail(targetNames?.length===104&&new Set(targetNames).size===104&&targetNames[0]==='root','exact Anny104 required');fail(targetParents?.length===104&&targetParents[0]===-1&&targetParents.slice(1).every((x,i)=>Number.isInteger(x)&&x>=0&&x<=i),'target hierarchy');
 fail(/^[a-f0-9]{64}$/.test(restFingerprint||''),'shape-specific rest fingerprint required');
 const sn=Array.from(sourceNames),sp=Array.from(sourceParents),tn=Array.from(targetNames),tp=Array.from(targetParents),sr=normalizedMatrices(sourceZeroTransforms,78),tr=normalizedMatrices(targetRestMatrices,104);
 const identity4=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];fail(maxdiff(sr[0],identity4)<2e-5,'source rest virtual Root must remain identity');fail(maxdiff(tr[0],identity4)<2e-5,'prototype expects native identity target rest root');
 const si=n=>{const k=sn.indexOf(n);fail(k>=0,'missing source '+n);return k},ti=n=>{const k=tn.indexOf(n);fail(k>=0,'missing target '+n);return k};
 const arm=si('LeftForeArm'),hand=si('LeftHand'),targetArm=ti('lowerarm01.L'),wrist=ti('wrist.L');
 fail(sp[hand]===arm,'source anatomical hand chain');fail(tp[wrist]===ti('lowerarm02.L')&&tp[ti('lowerarm02.L')]===targetArm,'target forearm twist chain');
 const sourceLong=mv(C,sub(pos(sr[hand]),pos(sr[arm]))),sourceRadial=mv(C,sub(pos(sr[si('LeftHandIndex2')]),pos(sr[si('LeftHandPinky2')])));
 const targetLong=sub(pos(tr[wrist]),pos(tr[targetArm])),targetRadial=sub(pos(tr[ti('finger2-1.L')]),pos(tr[ti('finger5-1.L')]));
 const sb=frame(sourceLong,sourceRadial),tb=frame(targetLong,targetRadial),Q=mul(tb,transpose(sb));fail(so3(Q),'anatomical mapping must be proper rotation');
 const calibration={schema:'soma-anny-root-left-forearm-calibration/1',restFingerprint,sourceNames:sn,targetNames:tn,mapped:[['Hips','root'],['LeftForeArm','lowerarm01.L']],unmappedTargetLocalInputs:tn.filter(n=>!['root','lowerarm01.L'].includes(n)),sourceBasis:sb,targetBasis:tb,Q,sourceForearmLength:norm(sourceLong),targetForearmLength:norm(targetLong),twistPolicy:'lowerarm02.L local delta remains identity; inherits primary forearm motion; no automatic axial twist distribution',calibrationOnly:true};
 return {metadata:structuredClone(calibration),convert({transforms}, {expectedRestFingerprint}={}) {
  fail(expectedRestFingerprint===restFingerprint,'shape rest mismatch; recalibrate');const mats=normalizedMatrices(transforms,78),world=mats.map((m,i)=>mul(rot(m),transpose(rot(sr[i]))));
  fail(maxdiff(mats[0],[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1])<2e-5,'virtual Root must remain identity');
  const local=world.map((r,i)=>i===0?r:mul(transpose(world[sp[i]]),r));
  for(let i=2;i<78;i++){const parent=sp[i],expected=mv(world[parent],sub(pos(sr[i]),pos(sr[parent]))).map((x,k)=>x+pos(mats[parent])[k]);fail(maxdiff(pos(mats[i]),expected)<2e-5,'source translation/identity change outside calibrated rest: '+sn[i]);}
  for(let i=2;i<78;i++)if(i!==arm)fail(maxdiff(local[i],I)<2e-5,'unmapped source articulation: '+sn[i]);
  const rootR=mul(mul(C,world[1]),transpose(C));const canonicalArm=mul(mul(C,local[arm]),transpose(C));const armR=mul(mul(Q,canonicalArm),transpose(Q));
  const rootTranslation=mv(C,sub(pos(mats[1]),mv(world[1],pos(sr[1]))));
  return {pose:{root:{rotation:rvDegrees(rootR),translation:rootTranslation},'lowerarm01.L':{rotation:rvDegrees(armR)}},rootTranslation,calibrationOnly:true,mappedBones:2,unmappedLocalDelta:'identity',restFingerprint,sourceLocalArmRotation:canonicalArm,targetLocalArmRotation:armR,rootRotation:rootR};
 }};
}
