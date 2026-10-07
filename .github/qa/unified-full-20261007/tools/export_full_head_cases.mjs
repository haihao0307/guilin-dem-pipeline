import{mixedState}from'../qa/mixed-states.mjs';
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {createCommon} from '../create-common.mjs';
import {defaultState} from '../src/State.mjs';
const model=createCommon({headDriver:true}),dir=new URL('../research/full-head-cases/',import.meta.url),cases=[];
fs.mkdirSync(dir,{recursive:true});
const sha=a=>crypto.createHash('sha256').update(a).digest('hex');
function add(name,state,meaning){const p=model.compute(state).slice();assert(p.every(Number.isFinite));fs.writeFileSync(new URL(name+'.f32',dir),new Uint8Array(p.buffer));const row={name,state:structuredClone(state),meaning,sha256:sha(p),headDiagnostics:structuredClone(model.headTransfer.last)};if(state.owners.headShape==='anny'){const pose=structuredClone(model.lastBodyDriver.effectiveInputs.annyPose||{});if(state.owners.gaze==='rig'&&state.owners.rig==='anny')for(const key of['eye.L','eye.R'])pose[key]={rotation:state.anny.pose[key]||[0,0,0],translation:state.anny.translations[key]||[0,0,0]};const v=model.anny.forward({phenotypes:state.anny.phenotypes,localChanges:state.anny.localChanges,facialActions:state.owners.expression==='anny'?model.headTransfer.actions(state):{},pose}).vertices;fs.writeFileSync(new URL(name+'-native.f32',dir),new Uint8Array(v.buffer));row.nativeComparison={teacher:'anny',file:name+'-native.f32',sha256:sha(v),bodyPoseApplied:state.owners.rig==='anny',nativeEyeBonePoseApplied:state.owners.gaze==='rig'&&state.owners.rig==='anny',zeroHeadPoseComparison:state.gnm.rotation.every(x=>x===0),nativeAge:state.anny.phenotypes.age};}cases.push(row);}
const state=(source)=>{const s=defaultState();s.owners.headShape=source;s.owners.expression=source;return s;};
add('gnm-neutral',defaultState(),'Frozen shared neutral and native GNM head');
{const s=defaultState();s.gnm.identity[0]=.4;s.gnm.expression[200]=.7;s.gnm.rotation[1]=.2;s.gnm.rotation[7]=.1;add('gnm-native-combined',s,'Native identity basis, expression basis and cranial/eye rotvec; expression 200 has no semantic blink label');}
for(const source of ['anny','mhr']){
 const s=state(source),set=(st,key,value)=>{if(source==='anny')st.anny.facialActions[key]=value;else{const i=model.mhrMeta.expression_names.indexOf(key);assert(i>=0,key);st.mhr.expression[i]=value;}};
 add(source+'-neutral',s,'Selected head shape and expression owner at neutral');
 const blink=structuredClone(s);for(const k of source==='anny'?['eyeBlinkLeft','eyeBlinkRight']:['eyesClosed_L','eyesClosed_R'])set(blink,k,1);add(source+'-blink',blink,'Both source-native eyelid closure fields');
 const jaw=structuredClone(s);set(jaw,source==='anny'?'jawOpen':'jawDrop',1);add(source+'-jaw',jaw,'Source-native jaw opening; GNM dental topology retained');
 const gaze=structuredClone(s);gaze.owners.gaze='expression';for(const k of source==='anny'?['eyeLookDownLeft','eyeLookDownRight']:['eyesLookDown_L','eyesLookDown_R'])set(gaze,k,.8);add(source+'-gaze',gaze,'Native eye-look field; MHR cap-to-rigid-globe inference is deliberately not used');
 const mixed=structuredClone(jaw);for(const k of source==='anny'?['eyeBlinkLeft','eyeBlinkRight']:['eyesClosed_L','eyesClosed_R'])set(mixed,k,.45);mixed.gnm.rotation[1]=.18;mixed.anny.pose['upperarm01.L']=[10,15,-20];if(source==='mhr'){mixed.owners.rig='mhr';mixed.mhr.identity[22]=.25;mixed.mhr.pose[46]=.7;}add(source+'-mixed',mixed,'Jaw plus partial closure, head turn and body rig');
}
{const s=state('anny');s.anny.facialActions={jawOpen:.6,tongueOut:1};add('anny-tongue',s,'Native isolated tongue component through fixed tongue correspondence');}
{const s=state('anny');s.owners.gaze='rig';s.anny.pose['eye.L']=[14,-10,0];s.anny.pose['eye.R']=[14,-10,0];add('anny-native-eye-bones',s,'Official native eye-bone transforms, independent of head-rig ownership');}
{const s=state('anny');s.anny.facialActions={jawOpen:1,eyeBlinkLeft:1,eyeBlinkRight:1};add('anny-jaw-blink',s,'Full simultaneous jaw opening and bilateral closure');}
const anchors=[['newborn',-1/3],['baby',0],['child',1/3],['old',1]];
for(const[name,age]of anchors){const s=state('anny');s.anny.phenotypes.age=age;s.anny.facialActions={jawOpen:.3,eyeBlinkLeft:.2,eyeBlinkRight:.2};add(name,s,`Official Anny age=${age}; source field and cranial placement factored once`);}
assert.equal(cases.find(c=>c.name==='newborn').state.anny.phenotypes.age,-1/3);assert.equal(cases.find(c=>c.name==='baby').state.anny.phenotypes.age,0);
for(const[name,owners]of[
 ['mixed-gnm-shape-anny-expression-mhr-rig',{rig:'mhr',headRig:'gnm',headShape:'gnm',expression:'anny',gaze:'expression'}],
 ['mixed-anny-shape-mhr-expression-anny-rig',{rig:'anny',headRig:'body',headShape:'anny',expression:'mhr',gaze:'gnm'}],
 ['mixed-mhr-shape-gnm-expression-mhr-rig',{rig:'mhr',headRig:'body',headShape:'mhr',expression:'gnm',gaze:'gnm'}]
])add(name,mixedState(owners,model.mhrMeta),'Moderate cross-source combination; every inactive saved field remains present in the same record');
for(const row of cases){assert.equal(sha(model.compute(row.state)),row.sha256,'Fixture input mutated: '+row.name);const saved=model.archive();model.compute(defaultState());model.restore(saved);assert.equal(sha(model.positions),row.sha256,'Archive mismatch: '+row.name);}
fs.writeFileSync(new URL('anny-faces.u32',dir),new Uint8Array(model.anny.arrays.faces.buffer,model.anny.arrays.faces.byteOffset,model.anny.arrays.faces.byteLength));
fs.writeFileSync(new URL('faces.u32',dir),new Uint8Array(model.faces.buffer));
fs.writeFileSync(new URL('manifest.json',dir),JSON.stringify({fingerprint:model.adapterFingerprint,topology:model.canonical.topologySha256,cases,visualAcceptance:false,sourceComparisonsRequired:true},null,2));
console.log({headCases:cases.length,fingerprint:model.adapterFingerprint,finiteAndArchiveByteExact:true});
