import test from 'node:test';
import assert from 'node:assert/strict';
import {encodeDeltaChannel,decodeDeltaChannel,buildCompactMotionLibrary,smoothVectorTrack,smoothQuaternionTrack,motionJitterReport,encodeParameterizedVariant,decodeParameterizedVariant} from '../motion-architecture/motion-library-r02.mjs';

test('delta channel round-trips within declared error',()=>{
 const src=Array.from({length:80},(_,i)=>[Math.sin(i*.04),i*.002,Math.cos(i*.04)]);
 const p=encodeDeltaChannel(src,{maxError:.0001}),dst=decodeDeltaChannel(p);
 assert.equal(dst.length,src.length);
 let max=0;for(let i=0;i<src.length;i++)for(let j=0;j<3;j++)max=Math.max(max,Math.abs(src[i][j]-dst[i][j]));
 assert.ok(max<=p.maxErrorBound+1e-6);
});
test('shared skeletons and identical channels are stored once; R4E and R41 clips are excluded',()=>{
 const skeleton={names:['root','hip'],parents:[-1,0],restFingerprint:'rest-a'};
 const channels={root:Array.from({length:5},(_,i)=>[i*.01,0,0])};
 const db=buildCompactMotionLibrary({clips:[
  {id:'cmu-1',source:'cmu',skeleton,fps:120,channels},
  {id:'mesh-1',source:'mesh2motion',skeleton,fps:30,channels},
  {id:'r41-walk',source:'r41',skeleton,fps:30,channels},
  {id:'r41-turn',source:'r41',skeleton,fps:30,channels},
  {id:'r41-idle',source:'R41',skeleton,fps:30,channels},
  {id:'r4e-run',source:'R4E',skeleton,fps:30,channels},
  {id:'quaternius-idle',source:'Quaternius',skeleton,fps:30,channels}
 ]});
 assert.equal(db.clips.length,2);assert.equal(db.stats.skeletonCount,1);assert.equal(db.stats.uniqueChannelCount,1);
});
test('adaptive vector filter reduces high-frequency jitter while retaining slow movement',()=>{
 const src=Array.from({length:240},(_,i)=>[i/120,Math.sin(i*.02)+(i%2?.03:-.03),0]);
 const dst=smoothVectorTrack(src,{fps:120,minCutoff:1,beta:.01});
 const before=motionJitterReport(src),after=motionJitterReport(dst);
 assert.ok(after.rms<before.rms*.8);
 assert.ok(Math.abs(dst.at(-1)[0]-src.at(-1)[0])<.01);
});

test('contact intervals hold the landing anchor without cumulative foot drift',()=>{
 const src=Array.from({length:12},(_,i)=>[i*.01,0,0]);
 const mask=Array.from({length:12},(_,i)=>i>=4&&i<=8);
 const dst=smoothVectorTrack(src,{fps:60,contactMask:mask});
 for(let i=4;i<=8;i++){assert.ok(Math.abs(dst[i][0]-src[4][0])<1e-9);assert.ok(Math.abs(dst[i][2]-src[4][2])<1e-9);}
});
test('quaternion smoothing handles q/-q equivalence and preserves unit length',()=>{
 const src=Array.from({length:40},(_,i)=>{
  const a=i*.01+(i%2?.08:-.08),q=[0,Math.sin(a/2),0,Math.cos(a/2)];
  return i%2?q.map(v=>-v):q;
 });
 const dst=smoothQuaternionTrack(src,{fps:60,minCutoff:1.5,beta:.01});
 assert.equal(dst.length,src.length);
 for(const q of dst)assert.ok(Math.abs(Math.hypot(...q)-1)<1e-6);
 assert.ok(Math.abs(dst[0][3]-Math.abs(src[0][3]))<1e-6);
});

test('similar motion variants store one parent plus compact parameters and residuals',()=>{
 const parent={root:Array.from({length:120},(_,i)=>[Math.sin(i*.045),i*.001,Math.cos(i*.045)])};
 const variant={root:parent.root.map((p,i)=>[p[0]*1.08+.015,p[1]*.97-.004,p[2]*1.08-.01+i%3*.000001])};
 const packet=encodeParameterizedVariant(parent,variant,{maxError:.00005,minSavings:.08});
 assert.ok(packet,'similar clip should qualify for parent encoding');
 assert.ok(packet.savedBytes>0);
 const decoded=decodeParameterizedVariant(parent,packet);
 let max=0;for(let i=0;i<120;i++)for(let j=0;j<3;j++)max=Math.max(max,Math.abs(decoded.root[i][j]-variant.root[i][j]));
 assert.ok(max<=.00005+1e-7);
});
test('compact library links variant records to a retained parent channel record',()=>{
 const skeleton={names:['root'],parents:[-1],restFingerprint:'r1'};
 const parent={root:Array.from({length:120},(_,i)=>[Math.sin(i*.045),i*.001,Math.cos(i*.045)])};
 const variant={root:parent.root.map((p,i)=>[p[0]*1.08+.015,p[1]*.97-.004,p[2]*1.08-.01+i%3*.000001])};
 const db=buildCompactMotionLibrary({clips:[
  {id:'cmu-parent',source:'cmu',skeleton,fps:30,channels:parent},
  {id:'cmu-variant',source:'cmu',skeleton,fps:30,channels:variant}
 ]});
 assert.equal(db.stats.clipCount,2);
 assert.equal(db.stats.parameterizedClipCount,1);
 const family=db.motionFamilies[db.clips[1].familyRef];
 assert.ok(family.parentChannelRefs.root);
 const decodedParent={root:decodeDeltaChannel(db.channels[family.parentChannelRefs.root])};
 const decoded=decodeParameterizedVariant(decodedParent,family.variants[0]);
 let max=0;for(let i=0;i<120;i++)for(let j=0;j<3;j++)max=Math.max(max,Math.abs(decoded.root[i][j]-variant.root[i][j]));
 assert.ok(max<=.00005+1e-7);
});

test('output contains only action records and CMU/Mesh2Motion categories',()=>{
 const skeleton={names:['root'],parents:[-1],restFingerprint:'r'};
 const channels={root:[[0,0,0],[.1,0,0],[.2,0,0]]};
 const db=buildCompactMotionLibrary({clips:[
  {id:'cmu-walk',source:'CMU',skeleton,fps:30,channels,model:{mesh:'ignored'},previewImage:'ignored.png'},
  {id:'mesh2motion-run',source:'Mesh2Motion',skeleton,fps:30,channels,video:'ignored.mp4'},
  {id:'r41-a',source:'R41',skeleton,fps:30,channels},
  {id:'r41-b',source:'R41',skeleton,fps:30,channels},
  {id:'r41-c',source:'R41',skeleton,fps:30,channels},
  {id:'quaternius-idle',source:'Quaternius',skeleton,fps:30,channels}
 ]});
 assert.deepEqual(db.clips.map(x=>x.source),['CMU','Mesh2Motion']);
 assert.ok(!JSON.stringify(db).includes('ignored.mp4'));
 assert.ok(!JSON.stringify(db).includes('ignored.png'));
 assert.ok(!JSON.stringify(db).includes('Quaternius'));
 assert.ok(db.stats.encodedBytes>0&&db.stats.inputActionBytes>0);
});

test('unused skeletons and unrelated metadata do not leak into the compact catalogue',()=>{
 const used={names:['root'],parents:[-1],restFingerprint:'used'};
 const unused={names:['unused-root','unused-arm'],parents:[-1,0],restFingerprint:'unused'};
 const db=buildCompactMotionLibrary({skeletons:[unused],clips:[
  {id:'cmu-only',source:'CMU',skeleton:used,fps:30,channels:{root:[[0,0,0],[1,0,0]]},thumbnail:'not-in-output'}
 ]});
 assert.equal(db.stats.skeletonCount,1);
 assert.ok(!JSON.stringify(db).includes('unused-root'));
 assert.ok(!JSON.stringify(db).includes('not-in-output'));
});
