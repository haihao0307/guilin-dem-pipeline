import test from 'node:test';
import assert from 'node:assert/strict';
import {encodeDeltaChannel,decodeDeltaChannel,buildCompactMotionLibrary,smoothVectorTrack,motionJitterReport} from '../motion-architecture/motion-library-r02.mjs';

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
  {id:'r4e-run',source:'R4E',skeleton,fps:30,channels}
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
