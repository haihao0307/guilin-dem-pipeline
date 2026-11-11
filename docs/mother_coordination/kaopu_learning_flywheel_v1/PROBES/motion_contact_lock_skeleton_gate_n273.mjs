import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const packPath = process.argv[2];
if (!packPath) throw new Error('usage: node motion_contact_lock_skeleton_gate_n273.mjs <cmu-sample-pack.json>');
const bytes = await readFile(packPath);
const pack = JSON.parse(bytes.toString('utf8'));
if (pack.schema !== 'kaopu-cmu-point-track-pack/1') throw new Error('unexpected pack schema');

const links = [
  ['root','lhipjoint'],['lhipjoint','lfemur'],['lfemur','ltibia'],['ltibia','lfoot'],['lfoot','ltoes'],
  ['root','rhipjoint'],['rhipjoint','rfemur'],['rfemur','rtibia'],['rtibia','rfoot'],['rfoot','rtoes'],
  ['root','lowerback'],['lowerback','upperback'],['upperback','thorax'],['thorax','lowerneck'],
  ['lowerneck','upperneck'],['upperneck','head'],['thorax','lclavicle'],['lclavicle','lhumerus'],
  ['lhumerus','lradius'],['lradius','lwrist'],['lwrist','lhand'],['lhand','lfingers'],['lwrist','lthumb'],
  ['thorax','rclavicle'],['rclavicle','rhumerus'],['rhumerus','rradius'],['rradius','rwrist'],
  ['rwrist','rhand'],['rhand','rfingers'],['rwrist','rthumb']
];
const dist = (a,b) => Math.hypot(a[0]-b[0], a[1]-b[1], a[2]-b[2]);

function decode(clip) {
  const data = Buffer.from(clip.data, 'base64');
  if (data.byteLength !== clip.frames * clip.jointCount * 6) throw new Error(`${clip.id}: byte count mismatch`);
  const points = new Array(clip.frames); let offset = 0;
  for (let f=0; f<clip.frames; f++) {
    const row = new Array(clip.jointCount);
    for (let j=0; j<clip.jointCount; j++) {
      const p = new Array(3);
      for (let k=0; k<3; k++) {
        const q = j*3+k;
        p[k] = clip.mins[q] + data.readUInt16LE(offset) * clip.scales[q];
        offset += 2;
      }
      row[j] = p;
    }
    points[f] = row;
  }
  return points;
}

function smoothOnly(points) {
  const weights = [1,6,15,20,15,6,1];
  return points.map((row,i) => row.map((p,j) => p.map((_,k) =>
    weights.reduce((sum,w,t) => sum + w * points[Math.max(0, Math.min(points.length-1, i+t-3))][j][k], 0) / 64
  )));
}

function applyPreviewLocks(clip, smoothed, raw) {
  const out = smoothed.map(row => row.map(p => p.slice()));
  const index = Object.fromEntries(clip.names.map((name,i) => [name,i]));
  for (const side of ['l','r']) {
    const foot = index[side+'foot'];
    for (const span of clip.contacts[side]) {
      const anchor = raw[span.startFrame][foot];
      for (let f=span.startFrame; f<=span.endFrame; f++) {
        out[f][foot][0] = anchor[0];
        out[f][foot][2] = anchor[2];
      }
    }
  }
  return out;
}

function edgeMetrics(clip, raw, candidate, side, aName, bName) {
  const index = Object.fromEntries(clip.names.map((name,i) => [name,i]));
  const a=index[aName], b=index[bName]; let maxAbs=0, maxRel=0, sum2=0, n=0, worst=null;
  for (const span of clip.contacts[side]) for (let f=span.startFrame; f<=span.endFrame; f++) {
    const sourceLength=dist(raw[f][a],raw[f][b]);
    const candidateLength=dist(candidate[f][a],candidate[f][b]);
    const abs=Math.abs(candidateLength-sourceLength), rel=sourceLength ? abs/sourceLength : 0;
    sum2+=abs*abs; n++;
    if (abs>maxAbs) { maxAbs=abs; worst={frame:f,span,sourceLengthMm:sourceLength*1000,candidateLengthMm:candidateLength*1000,deltaMm:abs*1000,relativeDeltaPct:rel*100}; }
    maxRel=Math.max(maxRel,rel);
  }
  return {edge:`${aName}->${bName}`,samples:n,rmsDeltaMm:Math.sqrt(sum2/n)*1000,maxDeltaMm:maxAbs*1000,maxRelativeDeltaPct:maxRel*100,worst};
}

const clips=[];
for (const clip of pack.clips) {
  const raw=decode(clip), smoothed=smoothOnly(raw), locked=applyPreviewLocks(clip,smoothed,raw), edges=[];
  for (const side of ['l','r']) {
    edges.push({side,stage:'smooth-only',...edgeMetrics(clip,raw,smoothed,side,side+'tibia',side+'foot')});
    edges.push({side,stage:'preview-lock',...edgeMetrics(clip,raw,locked,side,side+'tibia',side+'foot')});
    edges.push({side,stage:'smooth-only',...edgeMetrics(clip,raw,smoothed,side,side+'foot',side+'toes')});
    edges.push({side,stage:'preview-lock',...edgeMetrics(clip,raw,locked,side,side+'foot',side+'toes')});
  }
  clips.push({id:clip.id,sourceRecordGitBlobSHA:clip.sourceRecordGitBlobSHA,edges});
}

const lockedEdges=clips.flatMap(c => c.edges.filter(e => e.stage==='preview-lock'));
const smoothEdges=clips.flatMap(c => c.edges.filter(e => e.stage==='smooth-only'));
const maxLockedMm=Math.max(...lockedEdges.map(e => e.maxDeltaMm));
const maxLockedPct=Math.max(...lockedEdges.map(e => e.maxRelativeDeltaPct));
const maxSmoothMm=Math.max(...smoothEdges.map(e => e.maxDeltaMm));
const maxSmoothPct=Math.max(...smoothEdges.map(e => e.maxRelativeDeltaPct));
const sentinel={maxAbsoluteDeltaMm:5,maxRelativeDeltaPct:5,note:'Candidate smoke threshold for the single-Mother replay; not a globally adopted production tolerance.'};
const replayAssertions=[
  {id:'EXACT_THREE_CMU_CLIPS',pass:pack.clips.length===3&&pack.clips.every(c=>c.source==='CMU')},
  {id:'SMOOTH_ONLY_CONTROL_WITHIN_SENTINEL',pass:maxSmoothMm<=sentinel.maxAbsoluteDeltaMm&&maxSmoothPct<=sentinel.maxRelativeDeltaPct},
  {id:'PREVIEW_LOCK_REJECTED_ON_ALL_CLIPS',pass:clips.every(c=>c.edges.some(e=>e.stage==='preview-lock'&&(e.maxDeltaMm>sentinel.maxAbsoluteDeltaMm||e.maxRelativeDeltaPct>sentinel.maxRelativeDeltaPct)))},
  {id:'LOCK_ERROR_EXCEEDS_QUANTIZATION_BY_100X',pass:maxLockedMm>100*Math.max(...pack.clips.map(c=>c.maxQuantizationErrorM*1000))}
];
const result={
  schema:'kaopu-motion-contact-lock-skeleton-gate-result/1',
  subject:{path:packPath,sha256:createHash('sha256').update(bytes).digest('hex'),gitBlobSHA:'8fb1c53c733832bdbf727d82f21fe01aa8fff4e9'},
  boundedQuestion:'Does horizontal lfoot/rfoot anchoring eliminate drift without breaking adjacent skeleton edge lengths?',
  sentinel,
  observations:{clipCount:clips.length,maxSmoothOnlyEdgeDeltaMm:maxSmoothMm,maxSmoothOnlyRelativeDeltaPct:maxSmoothPct,maxPreviewLockEdgeDeltaMm:maxLockedMm,maxPreviewLockRelativeDeltaPct:maxLockedPct},
  replayAssertions,
  replayPassCount:replayAssertions.filter(x=>x.pass).length,
  decision:(maxLockedMm>sentinel.maxAbsoluteDeltaMm || maxLockedPct>sentinel.maxRelativeDeltaPct)
    ? 'HOLD_ZERO_DRIFT_BREAKS_SKELETON_EDGE_LENGTH'
    : 'PASS_CONTACT_LOCK_SKELETON_EDGE_SENTINEL',
  clips
};
console.log(JSON.stringify(result,null,2));
