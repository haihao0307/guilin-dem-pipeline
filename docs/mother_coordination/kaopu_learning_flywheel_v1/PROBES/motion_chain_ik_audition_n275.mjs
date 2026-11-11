let input='';
for await (const chunk of process.stdin) input+=chunk;
const pack = JSON.parse(input);
if (pack.schema !== 'kaopu-cmu-point-track-pack/1') throw new Error('unexpected pack schema');

const W = [1, 6, 15, 20, 15, 6, 1];
const EPS = 1e-12;
const sub = (a,b) => [a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const add = (a,b) => [a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const mul = (a,s) => [a[0]*s,a[1]*s,a[2]*s];
const dot = (a,b) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const len = a => Math.hypot(a[0],a[1],a[2]);
const dist = (a,b) => len(sub(a,b));
const norm = a => { const l=len(a); return l>EPS ? mul(a,1/l) : [1,0,0]; };

function decode(clip) {
  const data=Buffer.from(clip.data,'base64');
  const points=[]; let off=0;
  for(let f=0;f<clip.frames;f++){
    const row=[];
    for(let j=0;j<clip.jointCount;j++){
      const p=[];
      for(let k=0;k<3;k++){
        const q=j*3+k;
        p[k]=clip.mins[q]+data.readUInt16LE(off)*clip.scales[q]; off+=2;
      }
      row.push(p);
    }
    points.push(row);
  }
  return points;
}

function smooth(points){
  return points.map((row,i)=>row.map((p,j)=>p.map((_,k)=>
    W.reduce((s,w,t)=>s+w*points[Math.max(0,Math.min(points.length-1,i+t-3))][j][k],0)/64
  )));
}

// Position-space replay of the teacher's local-rotation principle: keep the hip fixed,
// solve the knee for an ankle target with the two source segment lengths, and carry the
// toe from the solved ankle. It intentionally clamps unreachable targets instead of
// stretching a bone. This is an audition probe, not production animation code.
function solveTwoBone(hip,knee,ankle,target,L1,L2){
  let axis=sub(target,hip); let d=len(axis);
  if(d<EPS) axis=norm(sub(ankle,hip)); else axis=mul(axis,1/d);
  const minD=Math.abs(L1-L2)+1e-9, maxD=L1+L2-1e-9;
  const usedD=Math.max(minD,Math.min(maxD,d));
  const solvedAnkle=add(hip,mul(axis,usedD));
  let bend=sub(sub(knee,hip),mul(axis,dot(sub(knee,hip),axis)));
  if(len(bend)<1e-8){
    const seed=Math.abs(axis[1])<0.9?[0,1,0]:[1,0,0];
    bend=sub(seed,mul(axis,dot(seed,axis)));
  }
  bend=norm(bend);
  const x=(L1*L1-L2*L2+usedD*usedD)/(2*usedD);
  const h=Math.sqrt(Math.max(0,L1*L1-x*x));
  return {knee:add(add(hip,mul(axis,x)),mul(bend,h)),ankle:solvedAnkle,
    reachable:Math.abs(usedD-d)<1e-8,targetResidual:dist(solvedAnkle,target)};
}

function runClip(clip){
  const raw=decode(clip), base=smooth(raw), out=base.map(r=>r.map(p=>p.slice()));
  const ix=Object.fromEntries(clip.names.map((n,i)=>[n,i]));
  let unreachable=0,maxTargetResidual=0,maxJointMove=0,samples=0;
  for(const side of ['l','r']){
    const hip=ix[side+'femur'], knee=ix[side+'tibia'], ankle=ix[side+'foot'], toe=ix[side+'toes'];
    for(const span of clip.contacts[side]){
      const anchor=raw[span.startFrame][ankle];
      for(let f=span.startFrame;f<=span.endFrame;f++){
        const desired=[anchor[0],base[f][ankle][1],anchor[2]];
        const L1=dist(raw[f][hip],raw[f][knee]);
        const L2=dist(raw[f][knee],raw[f][ankle]);
        const toeL=dist(raw[f][ankle],raw[f][toe]);
        const solved=solveTwoBone(base[f][hip],base[f][knee],base[f][ankle],desired,L1,L2);
        const toeDir=norm(sub(base[f][toe],base[f][ankle]));
        out[f][knee]=solved.knee;
        out[f][ankle]=solved.ankle;
        out[f][toe]=add(solved.ankle,mul(toeDir,toeL));
        unreachable+=solved.reachable?0:1;
        maxTargetResidual=Math.max(maxTargetResidual,solved.targetResidual);
        maxJointMove=Math.max(maxJointMove,dist(base[f][knee],out[f][knee]),dist(base[f][ankle],out[f][ankle]),dist(base[f][toe],out[f][toe]));
        samples++;
      }
    }
  }
  let maxEdgeAbs=0,maxEdgeRel=0,worstEdge=null,maxFootDrift=0;
  for(const side of ['l','r']){
    const hip=ix[side+'femur'], knee=ix[side+'tibia'], ankle=ix[side+'foot'], toe=ix[side+'toes'];
    for(const span of clip.contacts[side]){
      const anchor=raw[span.startFrame][ankle];
      for(let f=span.startFrame;f<=span.endFrame;f++){
        maxFootDrift=Math.max(maxFootDrift,Math.hypot(out[f][ankle][0]-anchor[0],out[f][ankle][2]-anchor[2]));
        for(const [a,b,name] of [[hip,knee,'femur->tibia'],[knee,ankle,'tibia->foot'],[ankle,toe,'foot->toes']]){
          const src=dist(raw[f][a],raw[f][b]), cand=dist(out[f][a],out[f][b]);
          const abs=Math.abs(cand-src), rel=src?abs/src:0;
          if(abs>maxEdgeAbs){maxEdgeAbs=abs;worstEdge={side,frame:f,edge:name,sourceLengthMm:src*1000,candidateLengthMm:cand*1000,deltaMm:abs*1000,relativeDeltaPct:rel*100};}
          maxEdgeRel=Math.max(maxEdgeRel,rel);
        }
      }
    }
  }
  return {id:clip.id,contactSamples:samples,unreachableTargets:unreachable,
    maxTargetResidualMm:maxTargetResidual*1000,maxHorizontalFootDriftMm:maxFootDrift*1000,
    maxAdjacentEdgeDeltaMm:maxEdgeAbs*1000,maxAdjacentEdgeRelativeDeltaPct:maxEdgeRel*100,
    maxJointMoveMm:maxJointMove*1000,worstEdge};
}

const clips=pack.clips.map(runClip);
const obs={
  clipCount:clips.length,
  contactSamples:clips.reduce((s,c)=>s+c.contactSamples,0),
  unreachableTargets:clips.reduce((s,c)=>s+c.unreachableTargets,0),
  maxTargetResidualMm:Math.max(...clips.map(c=>c.maxTargetResidualMm)),
  maxHorizontalFootDriftMm:Math.max(...clips.map(c=>c.maxHorizontalFootDriftMm)),
  maxAdjacentEdgeDeltaMm:Math.max(...clips.map(c=>c.maxAdjacentEdgeDeltaMm)),
  maxAdjacentEdgeRelativeDeltaPct:Math.max(...clips.map(c=>c.maxAdjacentEdgeRelativeDeltaPct)),
  maxJointMoveMm:Math.max(...clips.map(c=>c.maxJointMoveMm))
};
const assertions=[
  {id:'EXACT_THREE_CMU_CLIPS',pass:pack.clips.length===3&&pack.clips.every(c=>c.source==='CMU')},
  {id:'FIXED_LENGTH_IK_WITHIN_N273_SENTINEL',pass:obs.maxAdjacentEdgeDeltaMm<=5&&obs.maxAdjacentEdgeRelativeDeltaPct<=5},
  {id:'SAME_FOOT_TARGET_WITHIN_ONE_MM',pass:obs.maxHorizontalFootDriftMm<=1&&obs.maxTargetResidualMm<=1},
  {id:'NO_UNREACHABLE_TARGETS',pass:obs.unreachableTargets===0}
];
console.log(JSON.stringify({schema:'kaopu-motion-chain-ik-audition-result/1',
  subject:{packGitBlobSHA:'8fb1c53c733832bdbf727d82f21fe01aa8fff4e9',teacherRepoHead:'3b9920c7dd5436c5bc05f045002a64f085c69a9d'},
  boundedQuestion:'Can a fixed-length two-bone chain solve hit the same contact-foot target without the N273 edge stretch?',
  methodBoundary:'Independent position-space replay of the teacher principle; not copied production code and not a visual acceptance result.',
  n273Baseline:{maxPreviewLockEdgeDeltaMm:44.29503697753934,maxPreviewLockRelativeDeltaPct:70.97837341109756},
  observations:obs,assertions,passCount:assertions.filter(x=>x.pass).length,clips,
  decision:assertions.every(x=>x.pass)?'PASS_TEACHER_PRINCIPLE_AUDITION_FIXED_LENGTH_CHAIN':'HOLD_TEACHER_PRINCIPLE_AUDITION'
},null,2));
