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
function fnv1a64(text) {
  let h=0xcbf29ce484222325n;
  for(let i=0;i<text.length;i++){h^=BigInt(text.charCodeAt(i));h=BigInt.asUintN(64,h*0x100000001b3n);}
  return h.toString(16).padStart(16,'0');
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

// Fit a per-axis affine transform from a parent action to a same-topology
// variant. Residuals preserve the individual action's measured differences.
function fitAffineTrack(parent,child){
  const {width}=flattenFrames(parent);flattenFrames(child);
  assert(parent.length===child.length&&child[0].length===width,'parent/variant channel shapes must match');
  const scale=new Array(width),offset=new Array(width),residual=child.map(()=>new Array(width));
  for(let j=0;j<width;j++){
    let mx=0,my=0;for(let i=0;i<parent.length;i++){mx+=parent[i][j];my+=child[i][j];}
    mx/=parent.length;my/=parent.length;
    let covariance=0,variance=0;
    for(let i=0;i<parent.length;i++){const x=parent[i][j]-mx;covariance+=x*(child[i][j]-my);variance+=x*x;}
    scale[j]=variance>1e-12?covariance/variance:0;
    offset[j]=my-scale[j]*mx;
    for(let i=0;i<parent.length;i++)residual[i][j]=child[i][j]-(parent[i][j]*scale[j]+offset[j]);
  }
  return {scale,offset,residual};
}
export function encodeParameterizedVariant(parentChannels,variantChannels,{maxError=0.00005,minSavings=0.08}={}){
  const names=Object.keys(parentChannels).sort();
  assert(names.length>0&&stable(names)===stable(Object.keys(variantChannels).sort()),'parent and variant channel sets must match');
  const channels={};let standaloneBytes=0,encodedBytes=0,maxObservedError=0;
  for(const name of names){
    const parent=parentChannels[name],variant=variantChannels[name],fit=fitAffineTrack(parent,variant);
    const residual=encodeDeltaChannel(fit.residual,{maxError});
    const decoded=decodeDeltaChannel(residual);
    for(let i=0;i<variant.length;i++)for(let j=0;j<variant[i].length;j++){
      const reconstructed=parent[i][j]*fit.scale[j]+fit.offset[j]+decoded[i][j];
      maxObservedError=Math.max(maxObservedError,Math.abs(reconstructed-variant[i][j]));
    }
    const original=encodeDeltaChannel(variant,{maxError});
    standaloneBytes+=JSON.stringify(original).length;
    const entry={scale:fit.scale,offset:fit.offset,residual};
    encodedBytes+=JSON.stringify(entry).length;channels[name]=entry;
  }
  const savings=standaloneBytes?1-encodedBytes/standaloneBytes:0;
  if(maxObservedError>maxError+1e-7||savings<minSavings)return null;
  return {encoding:'parent-affine-residual/1',channels,standaloneBytes,encodedBytes,savings,savedBytes:standaloneBytes-encodedBytes,maxObservedError};
}
export function decodeParameterizedVariant(parentChannels,packet){
  assert(packet?.encoding==='parent-affine-residual/1','unsupported parameterized motion encoding');
  const result={};
  for(const [name,entry] of Object.entries(packet.channels)){
    const parent=parentChannels[name],residual=decodeDeltaChannel(entry.residual);
    assert(parent&&parent.length===residual.length,'parent channel frame count mismatch');
    result[name]=parent.map((frame,i)=>frame.map((v,j)=>v*entry.scale[j]+entry.offset[j]+residual[i][j]));
  }
  return result;
}

export function buildCompactMotionLibrary({skeletons=[],clips=[],maxError=0.00005}={}) {
  const skeletonByKey=new Map(), skeletonRegistry={}, payloadByKey=new Map(), records=[],motionFamilies={},clipIds=new Set();
  // Only skeletons referenced by accepted clips are emitted. An unrelated
  // preloaded skeleton must not leak into the data-only output.
  for(const clip of clips){
    assert(clip&&typeof clip.id==='string'&&clip.id.trim(),'clip id required');
    assert(!clipIds.has(clip.id),'duplicate clip id');
    clipIds.add(clip.id);
    const source=String(clip.source?.kind??clip.source??'').toLowerCase().replace(/[^a-z0-9]/g,'');
    const clipKey=String(clip.id??'').toLowerCase().replace(/[^a-z0-9]/g,'');
    // The production library is intentionally limited to CMU and Mesh2Motion.
    // R41/R4E, Quaternius prototypes and unrelated source families never enter it.
    if(!source.startsWith('cmu')&&!source.startsWith('mesh2motion')) continue;
    if(['r41','r4e'].some(tag=>source.includes(tag)||clipKey.includes(tag))) continue;
    assert(clip.skeleton&&Array.isArray(clip.skeleton.names)&&Array.isArray(clip.skeleton.parents)&&clip.skeleton.names.length>0&&clip.skeleton.names.length===clip.skeleton.parents.length,'valid clip skeleton required');
    assert(finite(clip.fps)&&clip.fps>0,'positive clip fps required');
    const skKey=stable({names:clip.skeleton.names,parents:clip.skeleton.parents,rest:clip.skeleton.restFingerprint??null});
    let skeletonId=skeletonByKey.get(skKey);
    if(!skeletonId){skeletonId='sk-'+fnv1a64(skKey);skeletonByKey.set(skKey,skeletonId);skeletonRegistry[skeletonId]={id:skeletonId,names:clip.skeleton.names,parents:clip.skeleton.parents,restFingerprint:clip.skeleton.restFingerprint??null};}
    const channelRefs={},channels=clip.channels??{},frameCount=clip.frameCount??Object.values(channels)[0]?.length??0;
    assert(Object.keys(channels).length>0,'clip must contain at least one motion channel');
    const signature=stable(Object.keys(channels).sort().map(name=>[name,channels[name]?.length,channels[name]?.[0]?.length]));
    const category=source.startsWith('cmu')?'CMU':'Mesh2Motion';
    const familyId='mf-'+fnv1a64(stable({category,skeletonId,fps:clip.fps,frameCount,signature}));
    const family=motionFamilies[familyId];
    let familyVariant=null;
    if(family&&family.frameCount===frameCount){
      familyVariant=encodeParameterizedVariant(family.parentChannels,channels,{maxError});
    }
    if(familyVariant){
      family.variants.push({clipId:clip.id,encoding:familyVariant.encoding,channels:familyVariant.channels,
        savings:familyVariant.savings,savedBytes:familyVariant.savedBytes,maxObservedError:familyVariant.maxObservedError});
      records.push({id:clip.id,source:category,category,skeletonId,fps:clip.fps,frameCount,
        familyRef:familyId,variant:true});
    }else{
      for(const [name,frames] of Object.entries(channels)){
        const packet=encodeDeltaChannel(frames,{maxError}),key=fnv1a64(stable(packet));
        if(!payloadByKey.has(key))payloadByKey.set(key,{id:'ch-'+key,...packet});
        channelRefs[name]='ch-'+key;
      }
      if(!family){
        motionFamilies[familyId]={id:familyId,parentClipId:clip.id,skeletonId,fps:clip.fps,frameCount,
          parentChannels:channels,parentChannelRefs:{...channelRefs},variants:[]};
      }
      records.push({id:clip.id,source:source.startsWith('cmu')?'CMU':'Mesh2Motion',category:source.startsWith('cmu')?'CMU':'Mesh2Motion',skeletonId,fps:clip.fps,
        frameCount,channels:channelRefs,familyParent:!family?familyId:undefined});
    }
  }
  const compactFamilies=Object.fromEntries(Object.entries(motionFamilies).map(([id,f])=>[id,{id,parentClipId:f.parentClipId,skeletonId:f.skeletonId,
    fps:f.fps,frameCount:f.frameCount,parentChannelRefs:f.parentChannelRefs,variants:f.variants}]));
  // Channel references use the public ch-<hash> identifier; key the payload
  // table by that same identifier so references resolve without a second lookup.
  const channelTable=Object.fromEntries([...payloadByKey.values()].map(packet=>[packet.id,packet]));
  const libraryCore={schema:'kaopu-motion-library/2',skeletons:skeletonRegistry,clips:records,channels:channelTable,motionFamilies:compactFamilies};
  const byteLength=value=>typeof TextEncoder!=='undefined'?new TextEncoder().encode(value).byteLength:value.length;
  const encodedBytes=byteLength(JSON.stringify(libraryCore));
  const rawMotionRecords=clips.filter(clip=>{
    const s=String(clip.source?.kind??clip.source??'').toLowerCase().replace(/[^a-z0-9]/g,'');
    const id=String(clip.id??'').toLowerCase().replace(/[^a-z0-9]/g,'');
    return (s.startsWith('cmu')||s.startsWith('mesh2motion'))&&!['r41','r4e'].some(tag=>s.includes(tag)||id.includes(tag));
  }).map(clip=>({id:clip.id,source:clip.source?.kind??clip.source,fps:clip.fps,frameCount:clip.frameCount,
    skeleton:clip.skeleton,channels:clip.channels}));
  const sourceBytes=byteLength(JSON.stringify(rawMotionRecords));
  const parameterizedSavingsBytes=Object.values(compactFamilies).reduce((n,f)=>n+f.variants.reduce((s,v)=>s+(v.savedBytes??0),0),0);
  return {...libraryCore,stats:{clipCount:records.length,skeletonCount:Object.keys(skeletonRegistry).length,uniqueChannelCount:payloadByKey.size,
    familyCount:Object.keys(compactFamilies).length,parameterizedClipCount:records.filter(r=>r.variant).length,
    inputActionBytes:sourceBytes,encodedBytes,bytesSaved:sourceBytes-encodedBytes,compressionRatio:sourceBytes?encodedBytes/sourceBytes:1,
    parameterizedSavingsBytes}};
}
export function smoothVectorTrack(frames,{fps=120,minCutoff=1.2,beta=0.015,derivativeCutoff=1,contactMask=null}={}) {
  const {width}=flattenFrames(frames); assert(width===3,'vector track must contain XYZ');
  assert(finite(fps)&&fps>0&&finite(minCutoff)&&minCutoff>0&&finite(beta)&&beta>=0,'invalid filter settings');
  const alpha=(cutoff)=>{const tau=1/(2*Math.PI*cutoff),te=1/fps;return 1/(1+tau/te);};
  const out=[Array.from(frames[0])]; let prev=Array.from(frames[0]),prevD=[0,0,0];
  // A contact interval must stay at the position where contact began, not
  // chase the preceding filtered sample (which can accumulate foot drift).
  let contactAnchor=null, wasInContact=Boolean(contactMask?.[0]);
  if(wasInContact) contactAnchor=[prev[0],prev[2]];
  for(let i=1;i<frames.length;i++){
    const next=frames[i],row=[],inContact=Boolean(contactMask?.[i]);
    if(inContact&&!wasInContact) contactAnchor=[next[0],next[2]];
    if(!inContact) contactAnchor=null;
    for(let j=0;j<3;j++){
      const d=(next[j]-prev[j])*fps, ed=prevD[j]+alpha(derivativeCutoff)*(d-prevD[j]);
      const cutoff=minCutoff+beta*Math.abs(ed), a=alpha(cutoff);
      row[j]=prev[j]+a*(next[j]-prev[j]); prevD[j]=ed;
    }
    if(inContact&&contactAnchor) { row[0]=contactAnchor[0];row[2]=contactAnchor[1]; }
    out.push(row);prev=row;wasInContact=inContact;
  }
  // Remove low-frequency endpoint drift introduced by causal filtering without
  // changing the first or final sample; this keeps clip root displacement intact.
  if(out.length>1){
    const last=out.length-1;
    for(let j=0;j<3;j++){
      // Never distribute root-drift correction through planted-foot X/Z axes.
      if(contactMask&& (j===0||j===2)) continue;
      const correction=frames[last][j]-out[last][j];
      for(let i=1;i<=last;i++) out[i][j]+=correction*(i/last);
    }
  }
  return out;
}

/**
 * Smooth quaternion tracks without crossing the q/-q representation seam.
 * Input/output use [x,y,z,w]; filtering is performed by shortest-arc slerp.
 * This is deliberately conservative: it removes frame-to-frame spikes but
 * does not invent new poses or alter the clip's first/last orientation.
 */
export function smoothQuaternionTrack(frames,{fps=120,minCutoff=2,beta=0.02}={}) {
  assert(Array.isArray(frames)&&frames.length>0,'non-empty quaternion frames required');
  assert(frames.every(q=>Array.isArray(q)&&q.length===4&&q.every(finite)),'finite XYZW quaternion frames required');
  assert(finite(fps)&&fps>0&&finite(minCutoff)&&minCutoff>0&&finite(beta)&&beta>=0,'invalid quaternion filter settings');
  const normalize=q=>{const n=Math.hypot(...q)||1;return q.map(v=>v/n);};
  const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
  const slerp=(a,b,t)=>{
    let cos=dot(a,b),end=b;
    if(cos<0){cos=-cos;end=b.map(v=>-v);}
    if(cos>0.9995)return normalize(a.map((v,i)=>v+(end[i]-v)*t));
    const theta=Math.acos(Math.max(-1,Math.min(1,cos))),sin=Math.sin(theta);
    const x=Math.sin((1-t)*theta)/sin,y=Math.sin(t*theta)/sin;
    return normalize(a.map((v,i)=>v*x+end[i]*y));
  };
  const alpha=cutoff=>{const tau=1/(2*Math.PI*cutoff),te=1/fps;return 1/(1+tau/te);};
  const source=frames.map(normalize),out=[source[0]],velocity=0;
  let speed=velocity;
  for(let i=1;i<source.length;i++){
    const prev=out[i-1],next=dot(prev,source[i])<0?source[i].map(v=>-v):source[i];
    const angle=2*Math.acos(Math.max(-1,Math.min(1,Math.abs(dot(prev,next)))));
    const angularSpeed=angle*fps;
    speed+=alpha(1)*(angularSpeed-speed);
    const cutoff=minCutoff+beta*speed;
    out.push(slerp(prev,next,alpha(cutoff)));
  }
  // Preserve exact endpoint orientation while distributing only the residual
  // angular correction over the track; no discontinuous final-frame snap.
  if(out.length>1){
    const last=out.length-1, target=source[last];
    const signedTarget=dot(out[last],target)<0?target.map(v=>-v):target;
    for(let i=1;i<=last;i++)out[i]=slerp(out[i],signedTarget,i/last);
  }
  return out;
}

export function motionJitterReport(frames,{fps=120}={}) {
  const {width}=flattenFrames(frames); const energy=[];
  for(let i=2;i<frames.length;i++){let e=0;for(let j=0;j<width;j++)e+=(frames[i][j]-2*frames[i-1][j]+frames[i-2][j])**2;energy.push(Math.sqrt(e)*fps*fps);}
  const sorted=[...energy].sort((a,b)=>a-b), at=q=>sorted[Math.min(sorted.length-1,Math.floor(q*(sorted.length-1)))]??0;
  return {samples:energy.length,rms:energy.length?Math.sqrt(energy.reduce((s,x)=>s+x*x,0)/energy.length):0,p95:at(.95),max:at(.999)};
}
