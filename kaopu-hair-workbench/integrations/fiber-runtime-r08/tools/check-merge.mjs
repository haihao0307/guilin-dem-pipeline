import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {RuntimeController} from '../RuntimeController.mjs';
import {connectHairRuntime} from '../index.mjs';
import {photoRuntimePorts} from '../F14Backend.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),repo=path.resolve(root,'../../..');
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'MERGE_MANIFEST.json'),'utf8'));
for(const [name,item] of Object.entries(manifest.files))assert.equal(sha(path.join(root,name)),item.sha256,name);
for(const name of Object.keys(manifest.files).filter(n=>n.endsWith('.mjs'))){
 const source=fs.readFileSync(path.join(root,name),'utf8');
 for(const match of source.matchAll(/\bfrom\s*['"]([^'"]+)['"]/g))if(match[1].startsWith('.'))assert.ok(fs.existsSync(path.resolve(root,path.dirname(name),match[1])),name+' -> '+match[1]);
}
let animation=0,simulated=0,poseUpdates=0,solves=0;const order=[];
const ports={advanceMotion:h=>animation+=h,updatePose:()=>poseUpdates++,simulate:h=>{simulated+=h;solves++;},prepareMotion:()=>order.push('motion'),prepareContacts:()=>order.push('contacts'),invalidateShadows:()=>order.push('shadow')};
const pending={id:'fixture',PhysicsProfile:{stage:2,enabled:false},RestShape:{acceptance:'pending multi-view structure review'}};
assert.throws(()=>connectHairRuntime({profile:pending,ports}),/locked/);
const profile={id:'fixture',PhysicsProfile:{stage:2,enabled:true},RestShape:{acceptance:'accepted'}},digest='a'.repeat(64);
assert.throws(()=>connectHairRuntime({profile,ports,structureSHA256:digest}),/receipt/);
const receipt={approvedBy:'user',approvedUTC:'2026-10-16T09:00:00Z',profileId:profile.id,structureSHA256:digest};
const before=JSON.stringify(profile),runtime=connectHairRuntime({profile,receipt,structureSHA256:digest,ports});
for(let i=0;i<120;i++)runtime.advance(1/120);
assert.ok(Math.abs(animation-1)<1e-12);assert.ok(Math.abs(simulated-1)<1e-12);assert.equal(solves,60);assert.equal(poseUpdates,120);
runtime.setProjectedPixels(0);solves=0;for(let i=0;i<120;i++)runtime.advance(1/120);
assert.equal(solves,15);assert.ok(Math.abs(simulated-2)<1e-12);assert.ok(Math.abs(animation-2)<1e-12);
runtime.advance(.05,{speed:.5});assert.ok(Math.abs(animation-2.025)<1e-12);
const pausedAnimation=animation;runtime.advance(.1,{paused:true});assert.equal(animation,pausedAnimation);
runtime.advance(1);assert.ok(runtime.report().droppedSeconds>=.9);
for(let i=0;i<1000;i++)runtime.observeFrame(50);assert.equal(runtime.quality,.38);assert.equal(runtime.fastSolve,true);
for(let i=0;i<1000;i++)runtime.observeFrame(8);assert.equal(runtime.quality,1);assert.equal(runtime.fastSolve,false);
runtime.prepareRender();assert.deepEqual(order,['motion','contacts','shadow']);assert.equal(JSON.stringify(profile),before);
assert.throws(()=>runtime.advance(NaN));assert.throws(()=>runtime.setProjectedPixels(-1));runtime.dispose();assert.throws(()=>runtime.advance(.01),/disposed/);

// Exercise the recipient bridge's actual call protocol without a renderer.
let doubleClock=0,kinematics=0,updates=0;
const hook=()=>doubleClock++,frame={},binding={frame,updateFrame(){updates++;}};
const photo={binding,motion:{playing:true,advance(h){doubleClock+=h;},updateKinematics(){kinematics++;},prepareRender(){}},dynamics:{beforeStep:hook,fastSolve:undefined},viewer:{renderer:{shadowMap:{needsUpdate:false}}},update(h){this.dynamics.beforeStep(h);return true;},prepareRender(){this.viewer.renderer.shadowMap.needsUpdate=false;}};
const bridge=new RuntimeController(photoRuntimePorts(photo));bridge.advance(.05);bridge.prepareRender();
assert.equal(doubleClock,.05);assert.equal(kinematics,1);assert.equal(photo.dynamics.beforeStep,hook);assert.equal(photo.viewer.renderer.shadowMap.needsUpdate,true);assert.ok(updates>=2);
bridge.observeFrame(1000);bridge.dispose();assert.equal(photo.dynamics.fastSolve,undefined);
const failing={...photo,dynamics:{beforeStep:hook},update(){throw Error('fixture solver failure');}};
assert.throws(()=>new RuntimeController(photoRuntimePorts(failing)).advance(.1),/fixture solver/);assert.equal(failing.dynamics.beforeStep,hook);

const target=await import('../../../foundation/structure-r01/src/HairStyleProfile.mjs');
const entry=await import('../../../foundation/structure-r01/integrations/R08Runtime.mjs');assert.equal(entry.connectHairRuntime,connectHairRuntime);
assert.equal(target.PROFILE.PhysicsProfile.enabled,false);assert.equal(target.PROFILE.ChildStrandProfile.enabled,false);
assert.throws(()=>connectHairRuntime({profile:target.PROFILE,ports}),/locked/);
const protectedBefore=JSON.parse(fs.readFileSync(path.join(root,'PROTECTED_BEFORE.json'),'utf8'));
const concurrentlyChanged=Object.entries(protectedBefore).filter(([n,h])=>!fs.existsSync(path.join(repo,n))||sha(path.join(repo,n))!==h).map(([n])=>n);
assert.deepEqual(concurrentlyChanged.filter(n=>/\/foundation\/f(?:12|14)\//.test(n)),[],'Existing F12/F14 programs must remain unchanged');
const ownFiles=[];
function walk(dir){for(const item of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,item.name);if(item.isDirectory()){if(item.name!=='.qa')walk(p);}else if(!['CHECK_REPORT.json','PROTECTED_BEFORE.json'].includes(item.name))ownFiles.push([path.relative(root,p).replaceAll('\\','/'),sha(p)]);}}
walk(root);
const targetAdditions=['kaopu-hair-workbench/foundation/structure-r01/integrations/R08Runtime.mjs','kaopu-hair-workbench/foundation/structure-r01/docs/R08_RUNTIME_HANDOFF.md'];
const report={checkedUTC:new Date().toISOString(),passed:true,snapshotFiles:Object.keys(manifest.files).length,checks:['snapshot SHA256 and local imports','phase-one remains locked','target optional entry exports','matching human receipt required','120 Hz animation / 60 Hz simulation','far 15 Hz physics remains active','half speed and pause','bounded no-catch-up frame work','budget hysteresis','shadow invalidation after off-screen passes','target hook restoration including errors','no profile mutation','existing F12/F14 file hashes unchanged'],protectedFiles:Object.keys(protectedBefore).length,concurrentlyChangedProtectedFiles:concurrentlyChanged,writeScope:'Only integrations/fiber-runtime-r08 and the two listed new target entry/document files',targetAdditions:Object.fromEntries(targetAdditions.map(n=>[n,sha(path.join(repo,n))])),integrationFiles:Object.fromEntries(ownFiles),visualChange:false,liveStructurePhysicsEnabled:false,legacyPerformanceGatePassed:manifest.evidence['r08-performance.json'].reportedPassed};
fs.writeFileSync(path.join(root,'CHECK_REPORT.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:report.passed,snapshotFiles:report.snapshotFiles,checks:report.checks,concurrentlyChangedProtectedFiles:concurrentlyChanged,liveStructurePhysicsEnabled:false},null,2));
