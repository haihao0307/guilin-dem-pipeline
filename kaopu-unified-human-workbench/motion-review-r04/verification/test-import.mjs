import fs from 'node:fs';import assert from 'node:assert/strict';import zlib from 'node:zlib';
import * as THREE from '../../vendor/three.module.js';
import {packetFromAnimation} from '../MixamoImport.mjs';
import {FBXLoader} from '../../../tooling/node_modules/three/examples/jsm/loaders/FBXLoader.js';
import {RigidPoseSampler} from '../Core.mjs';
import {ArmContinuity,canonicalSource} from '../ArmContinuity.mjs';
import {buildCapturedClip} from '../CapturedCycles.mjs';
const f=JSON.parse(zlib.gunzipSync(fs.readFileSync('qa/native-fixture.json.gz'))),target={...f,N:f.positions.length/3,names:f.rig.names};
const definition=[['Hips',null,[0,1,0]],['Spine','Hips',[0,.16,0]],['Spine1','Spine',[0,.16,0]],['Spine2','Spine1',[0,.15,0]],['Neck','Spine2',[0,.13,0]],['Head','Neck',[0,.12,0]],...['Left','Right'].flatMap(s=>{const a=s==='Left'?1:-1;return[[s+'UpLeg','Hips',[a*.12,0,0]],[s+'Leg',s+'UpLeg',[0,-.42,0]],[s+'Foot',s+'Leg',[0,-.42,0]],[s+'ToeBase',s+'Foot',[0,-.08,.16]],[s+'Arm','Spine2',[a*.2,.03,0]],[s+'ForeArm',s+'Arm',[a*.28,0,0]],[s+'Hand',s+'ForeArm',[a*.26,0,0]]];})];
function skeleton(scale){const root=new THREE.Group();root.scale.setScalar(scale);const bones={};for(const [name,parent,p]of definition){const bone=new THREE.Bone();bone.name='mixamorig'+name;bone.position.fromArray(p);bones[name]=bone;(parent?bones[parent]:root).add(bone);}root.updateMatrixWorld(true);return root;}
const clip=new THREE.AnimationClip('SyntheticTargetIndependence',1,[new THREE.VectorKeyframeTrack('mixamorigHips.position',[0,1],[0,1,0,0,1,.4])]);
const a=packetFromAnimation(skeleton(1),clip),b=packetFromAnimation(skeleton(100),clip);
assert(a.points.at(-1)[0][2]>a.points[0][0][2]+.3);
assert.equal(a.points.length,121);let unitError=0;for(let i=0;i<a.points.length;i++)for(let j=0;j<a.names.length;j++)for(let k=0;k<3;k++)unitError=Math.max(unitError,Math.abs(a.points[i][j][k]-b.points[i][j][k]));assert(unitError<1e-10);
assert.throws(()=>packetFromAnimation(new THREE.Group(),clip),/缺少骨骼/);
assert.throws(()=>packetFromAnimation(skeleton(1),new THREE.AnimationClip('TooLong',61,[])),/60/);
const sampler=new RigidPoseSampler(target.rig),arms=new ArmContinuity(target),source=canonicalSource(a),out=await buildCapturedClip(target,{id:'synthetic-import',label:'synthetic import',continuous:false},source,sampler,{decorate:f=>arms.apply(f)});
let maxBoneLengthError=0;for(const p of out.frames){assert(p.q.every(Number.isFinite)&&p.p.every(Number.isFinite));sampler.apply(p);maxBoneLengthError=Math.max(maxBoneLengthError,sampler.boneError());}assert(maxBoneLengthError<1e-6);
// A real ASCII FBX interchange fixture with no mesh, exported in centimetres.
const ids=Object.fromEntries(definition.map(([n],i)=>[n,100+i]));
const lines=['; FBX 7.4.0 project file','FBXHeaderExtension:  {','\tFBXVersion: 7400','}','Objects:  {'];
for(const [name,parent,p]of definition){lines.push(`\tModel: ${ids[name]}, "Model::mixamorig:${name}", "LimbNode" {`,'\t\tVersion: 232','\t\tProperties70:  {',`\t\t\tP: "Lcl Translation", "Lcl Translation", "", "A",${p.map(v=>v*100).join(',')}`,'\t\t\tP: "Lcl Rotation", "Lcl Rotation", "", "A",0,0,0','\t\t\tP: "Lcl Scaling", "Lcl Scaling", "", "A",1,1,1','\t\t}','\t}');}
lines.push('\tAnimationStack: 500, "AnimStack::SyntheticWalk", "" {','\t}','\tAnimationLayer: 501, "AnimLayer::BaseLayer", "" {','\t}','\tAnimationCurveNode: 502, "AnimCurveNode::T", "" {','\t\tProperties70:  {','\t\t\tP: "d|X", "Number", "", "A",0','\t\t\tP: "d|Y", "Number", "", "A",100','\t\t\tP: "d|Z", "Number", "", "A",0','\t\t}','\t}','\tAnimationCurve: 503, "AnimCurve::Z", "" {','\t\tDefault: 0','\t\tKeyVer: 4008','\t\tKeyTime: *2 {','\t\t\ta: 0,46186158000','\t\t}','\t\tKeyValueFloat: *2 {','\t\t\ta: 0,40','\t\t}','\t}','}','Connections:  {');
for(const [name,parent]of definition)lines.push(`\tC: "OO",${ids[name]},${parent?ids[parent]:0}`);
lines.push('\tC: "OO",501,500','\tC: "OO",502,501',`\tC: "OP",502,${ids.Hips},"Lcl Translation"`,'\tC: "OP",503,502,"d|Z"','}','');
const text=lines.join('\n'),bytes=new TextEncoder().encode(text),parsed=new FBXLoader().parse(bytes.buffer,'');
assert.equal(parsed.animations.length,1);const fbxPacket=packetFromAnimation(parsed,parsed.animations[0],{filename:'synthetic-without-skin.fbx'});assert.equal(fbxPacket.points.length,121);assert(fbxPacket.points.at(-1)[0][2]>fbxPacket.points[0][0][2]+.3);
fs.mkdirSync('qa/import',{recursive:true});fs.writeFileSync('qa/import/synthetic-without-skin.fbx',text);
const report={kind:'synthetic interchange / target independence; not a Mixamo-library visual acceptance',checks:['centimetre/metre invariance','missing bones rejected','overlong clip rejected','fixed original target bones','finite full retarget','actual ASCII FBX parser without mesh','root translation decoded'],unitScaleMaxErrorM:unitError,maxTargetBoneLengthErrorM:maxBoneLengthError,fbxFrames:fbxPacket.points.length,externalCharacterRendered:false,pass:true};fs.writeFileSync('qa/import/qa.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
