/**
 * KAOPU Motion Library R02
 * Shared skeleton registry + content-addressed motion channels + bounded delta quantization.
 * Runtime-independent ES module. Original source clips remain immutable inputs.
 */
const finite = v => typeof v === 'number' && Number.isFinite(v);
const assert = (ok, message) => { if (!ok) throw new Error(message); };
const stable = value => {
  if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(k => JSON.stringify(k)+':'+stable(value[k])).join(',') + '}';
  return JSON.stringify(value);
};
const bytesToBase64 = bytes => {
  if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
  let s=''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s);
};
const base64ToBytes = value => {
  if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(value,'base64'));
  const s=atob(value); return Uint8Array.from(s,c=>c.charCodeAt(0));
};
function fnv1a(text) {
  let h=0x811c9dc5;
  for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,0x01000193);}
  return (h>>>0).toString(16).padStart(8,'0');
}
function flattenFrames(frames) {
  assert(Array.isArray(frames)&&frames.length>0,'non-empty channel frames required');
  const width=frames[0].length;
  assert(Number.isInteger(width)&&width>0,'fixed channel width required');
  for(const frame of frames) assert(Array.isArray(frame)&&frame.length===width&&frame.every(finite),'finite fixed-width numeric frames required');
  return {width,frames};
}
export function encodeDeltaChannel(frames,{maxError=0.00005}={}) {
  assert(finite(maxError)&&maxError>0,'positive maxError required');
  const {width}=flattenFrames(frames), count=frames.length, base=Float32Array.from(frames[0]);
  let maxDelta=0;
  for(let f=1;f<count;f++) for(let j=0;j<width;j++) maxDelta=Math.max(maxDelta,Math.abs(frames[f][j]-frames[f-1][j]));
  const scale=maxDelta===0?1:maxDelta/32767;
  // Quantization error accumulates when deltas are reconstructed sequentially.
  // Use Int16 only when the worst-case cumulative bound stays within maxError.
  const useInt16=scale*0.5*(count-1)<=maxError;
  const raw=useInt16?new Int16Array((count-1)*width):new Float32Array((count-1)*width);
  let p=0;
  for(let f=1;f<count;f++) for(let j=0;j<width;j++){
    const d=frames[f][j]-frames[f-1][j];
    raw[p++]=useInt16?Math.max(-32767,Math.min(32767,Math.round(d/scale))):d;
  }
  return {encoding:useInt16?'delta-i16':'delta-f32',width,count,scale:useInt16?scale:1,maxErrorBound:useInt16?scale*0.5*(count-1):0,
    base:Array.from(base),data:bytesToBase64(new Uint8Array(raw.buffer))};
}
export function decodeDeltaChannel(packet) {
  assert(packet&&['delta-i16','delta-f32'].includes(packet.encoding),'unsupported channel encoding');
  const {width,count,base,scale}=packet;
  assert(Number.isInteger(width)&&width>0&&Number.isInteger(count)&&count>0&&base?.length===width,'invalid channel shape');
  const bytes=base64ToBytes(packet.data), Type=packet.encoding==='delta-i16'?Int16Array:Float32Array;
  assert(bytes.byteLength===((count-1)*width*Type.BYTES_PER_ELEMENT),'channel byte length mismatch');
  const deltas=new Type(bytes.buffer,bytes.byteOffset,bytes.byteLength/Type.BYTES_PER_ELEMENT);
  const frames=new Array(count); frames[0]=Array.from(base); let p=0;
  for(let f=1;f<count;f++){const row=new Array(width);for(let j=0;j<width;j++)row[j]=frames[f-1][j]+(packet.encoding==='delta-i16'?deltas[p++]*scale:deltas[p++]);frames[f]=row;}
  return frames;
}
export function buildCompactMotionLibrary({skeletons=[],clips=[],maxError=0.00005}={}) {
  const skeletonByKey=new Map(), skeletonRegistry={}, payloadByKey=new Map(), records=[];
  for(const s of skeletons){
    assert(s&&Array.isArray(s.names)&&Array.isArray(s.parents)&&s.names.length===s.parents.length,'valid skeleton required');
    const key=stable({names:s.names,parents:s.parents,rest:s.restFingerprint??null});
    const id='sk-'+fnv1a(key); skeletonByKey.set(key,id); skeletonRegistry[id]={id,names:s.names,parents:s.parents,restFingerprint:s.restFingerprint??null};
  }
  for(const clip of clips){
    const source=String(clip.source?.kind??clip.source??'').toLowerCase();
    const clipKey=String(clip.id??'').toLowerCase();
    // Exclude both the previous R41 label and the R4E label explicitly named in the current Atlas cleanup.
    if(['r41','r4e'].some(tag=>source===tag||source.startsWith(tag+'-')||clipKey===tag||clipKey.startsWith(tag+'-'))) continue;
    const skKey=stable({names:clip.skeleton.names,parents:clip.skeleton.parents,rest:clip.skeleton.restFingerprint??null});
    let skeletonId=skeletonByKey.get(skKey);
    if(!skeletonId){skeletonId='sk-'+fnv1a(skKey);skeletonByKey.set(skKey,skeletonId);skeletonRegistry[skeletonId]={id:skeletonId,names:clip.skeleton.names,parents:clip.skeleton.parents,restFingerprint:clip.skeleton.restFingerprint??null};}
    const channelRefs={};
    for(const [name,frames] of Object.entries(clip.channels??{})){
      const packet=encodeDeltaChannel(frames,{maxError}), key=fnv1a(stable(packet));
      if(!payloadByKey.has(key)) payloadByKey.set(key,{id:'ch-'+key,...packet});
      channelRefs[name]='ch-'+key;
    }
    records.push({id:clip.id,source:clip.source?.kind??clip.source??'unknown',skeletonId,fps:clip.fps,
      frameCount:clip.frameCount??Object.values(clip.channels??{})[0]?.length??0,channels:channelRefs});
  }
  return {schema:'kaopu-motion-library/2',skeletons:skeletonRegistry,clips:records,channels:Object.fromEntries(payloadByKey),
    stats:{clipCount:records.length,skeletonCount:Object.keys(skeletonRegistry).length,uniqueChannelCount:payloadByKey.size,
      encodedBytes:Object.values(payloadByKey).reduce((n,p)=>n+p.data.length*3/4,0)}};
}
export function smoothVectorTrack(frames,{fps=120,minCutoff=1.2,beta=0.015,derivativeCutoff=1,contactMask=null}={}) {
  const {width}=flattenFrames(frames); assert(width===3,'vector track must contain XYZ');
  assert(finite(fps)&&fps>0&&finite(minCutoff)&&minCutoff>0&&finite(beta)&&beta>=0,'invalid filter settings');
  const alpha=(cutoff)=>{const tau=1/(2*Math.PI*cutoff),te=1/fps;return 1/(1+tau/te);};
  const out=[Array.from(frames[0])]; let prev=Array.from(frames[0]),prevD=[0,0,0];
  for(let i=1;i<frames.length;i++){
    const next=frames[i],row=[];
    for(let j=0;j<3;j++){
      const d=(next[j]-prev[j])*fps, ed=prevD[j]+alpha(derivativeCutoff)*(d-prevD[j]);
      const cutoff=minCutoff+beta*Math.abs(ed), a=alpha(cutoff);
      row[j]=prev[j]+a*(next[j]-prev[j]); prevD[j]=ed;
    }
    if(contactMask?.[i]) { const anchor=out[i-1]; row[0]=anchor[0];row[2]=anchor[2]; }
    out.push(row);prev=row;
  }
  // Remove low-frequency endpoint drift introduced by causal filtering without
  // changing the first or final sample; this keeps clip root displacement intact.
  if(out.length>1){
    const last=out.length-1;
    for(let j=0;j<3;j++){
      const correction=frames[last][j]-out[last][j];
      for(let i=1;i<=last;i++) out[i][j]+=correction*(i/last);
    }
  }
  return out;
}
export function motionJitterReport(frames,{fps=120}={}) {
  const {width}=flattenFrames(frames); const energy=[];
  for(let i=2;i<frames.length;i++){let e=0;for(let j=0;j<width;j++)e+=(frames[i][j]-2*frames[i-1][j]+frames[i-2][j])**2;energy.push(Math.sqrt(e)*fps*fps);}
  const sorted=[...energy].sort((a,b)=>a-b), at=q=>sorted[Math.min(sorted.length-1,Math.floor(q*(sorted.length-1)))]??0;
  return {samples:energy.length,rms:energy.length?Math.sqrt(energy.reduce((s,x)=>s+x*x,0)/energy.length):0,p95:at(.95),max:at(.999)};
}
