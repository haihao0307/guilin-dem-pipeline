/**
 * Small, dependency-free glTF 2 skeletal animation reader.
 * Authored for this study. It reads node transforms and animation channels only;
 * it does not instantiate or display an external mesh.
 * Matrix arrays in this module are ROW MAJOR, matching NativeRig.mjs.
 */
const EPS=1e-10;
export const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export const vAdd=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
export const vSub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
export const vScale=(a,s)=>[a[0]*s,a[1]*s,a[2]*s];
export const vDot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
export const vCross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export const vLength=a=>Math.hypot(...a);
export function vUnit(a,fallback=[0,1,0]){const l=vLength(a);return l>EPS?vScale(a,1/l):fallback.slice();}
export function qNormalize(q){const n=Math.hypot(...q);return n>EPS?q.map(v=>v/n):[0,0,0,1];}
export const qInverse=q=>[-q[0],-q[1],-q[2],q[3]];
export function qMultiply(a,b){const [x,y,z,w]=a,[X,Y,Z,W]=b;return [w*X+x*W+y*Z-z*Y,w*Y-x*Z+y*W+z*X,w*Z+x*Y-y*X+z*W,w*W-x*X-y*Y-z*Z];}
export function qRotate(q,p){const u=[q[0],q[1],q[2]],uv=vCross(u,p),uuv=vCross(u,uv);return vAdd(p,vAdd(vScale(uv,2*q[3]),vScale(uuv,2)));}
export function qSlerp(a,b,t){
  let d=a[0]*b[0]+a[1]*b[1]+a[2]*b[2]+a[3]*b[3],sign=1;
  if(d<0){d=-d;sign=-1;}
  if(d>.9995)return qNormalize(a.map((v,i)=>v+(sign*b[i]-v)*t));
  const theta=Math.acos(clamp(d,-1,1)),s=Math.sin(theta),wa=Math.sin((1-t)*theta)/s,wb=Math.sin(t*theta)/s*sign;
  return a.map((v,i)=>v*wa+b[i]*wb);
}
export function qFromTo(a,b){a=vUnit(a);b=vUnit(b);const d=clamp(vDot(a,b),-1,1);if(d>1-1e-8)return [0,0,0,1];if(d< -1+1e-8){const axis=vUnit(vCross(a,Math.abs(a[0])<.8?[1,0,0]:[0,1,0]));return [...axis,0];}return qNormalize([...vCross(a,b),1+d]);}
export const identity4=()=>new Float64Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
export function qToMatrix(q,p=[0,0,0],s=[1,1,1]){
  const [x,y,z,w]=q,xx=x*x,yy=y*y,zz=z*z,xy=x*y,xz=x*z,yz=y*z,wx=w*x,wy=w*y,wz=w*z;
  return new Float64Array([(1-2*(yy+zz))*s[0],2*(xy-wz)*s[1],2*(xz+wy)*s[2],p[0],2*(xy+wz)*s[0],(1-2*(xx+zz))*s[1],2*(yz-wx)*s[2],p[1],2*(xz-wy)*s[0],2*(yz+wx)*s[1],(1-2*(xx+yy))*s[2],p[2],0,0,0,1]);
}
export function multiply4(a,b,out=identity4()){for(let r=0;r<4;r++)for(let c=0;c<4;c++){let v=0;for(let k=0;k<4;k++)v+=a[r*4+k]*b[k*4+c];out[r*4+c]=v;}return out;}
export function matrixQuaternion(m){
  const m00=m[0],m01=m[1],m02=m[2],m10=m[4],m11=m[5],m12=m[6],m20=m[8],m21=m[9],m22=m[10],tr=m00+m11+m22;
  let x,y,z,w;
  if(tr>0){const s=Math.sqrt(tr+1)*2;w=.25*s;x=(m21-m12)/s;y=(m02-m20)/s;z=(m10-m01)/s;}
  else if(m00>m11&&m00>m22){const s=Math.sqrt(Math.max(0,1+m00-m11-m22))*2;x=.25*s;y=(m01+m10)/s;z=(m02+m20)/s;w=(m21-m12)/s;}
  else if(m11>m22){const s=Math.sqrt(Math.max(0,1+m11-m00-m22))*2;x=(m01+m10)/s;y=.25*s;z=(m12+m21)/s;w=(m02-m20)/s;}
  else{const s=Math.sqrt(Math.max(0,1+m22-m00-m11))*2;x=(m02+m20)/s;y=(m12+m21)/s;z=.25*s;w=(m10-m01)/s;}
  return qNormalize([x,y,z,w]);
}
export function decompose4(m){
  const s=[Math.hypot(m[0],m[4],m[8]),Math.hypot(m[1],m[5],m[9]),Math.hypot(m[2],m[6],m[10])];
  const det=m[0]*(m[5]*m[10]-m[6]*m[9])-m[1]*(m[4]*m[10]-m[6]*m[8])+m[2]*(m[4]*m[9]-m[5]*m[8]);if(det<0)s[0]*=-1;
  const r=Float64Array.from(m);for(let row=0;row<3;row++)for(let col=0;col<3;col++)r[row*4+col]/=Math.abs(s[col])>EPS?s[col]:1;
  return {translation:[m[3],m[7],m[11]],rotation:matrixQuaternion(r),scale:s};
}
export function topologicalOrder(parents){
  const state=new Uint8Array(parents.length),order=[];
  const visit=j=>{if(state[j]===2)return;if(state[j]===1)throw Error('Invalid glTF: cyclic node hierarchy');state[j]=1;const p=parents[j];if(p>=0){if(p>=parents.length)throw Error('Invalid glTF: parent outside node range');visit(p);}state[j]=2;order.push(j);};
  for(let j=0;j<parents.length;j++)visit(j);return order;
}

const COMPONENTS={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT2:4,MAT3:9,MAT4:16};
const COMPONENT_BYTES={5120:1,5121:1,5122:2,5123:2,5125:4,5126:4};
function scalarAt(view,offset,type){switch(type){case 5120:return view.getInt8(offset);case 5121:return view.getUint8(offset);case 5122:return view.getInt16(offset,true);case 5123:return view.getUint16(offset,true);case 5125:return view.getUint32(offset,true);case 5126:return view.getFloat32(offset,true);default:throw Error('Unsupported accessor component type '+type);}}
function normalized(v,type){switch(type){case 5120:return Math.max(v/127,-1);case 5121:return v/255;case 5122:return Math.max(v/32767,-1);case 5123:return v/65535;case 5125:return v/4294967295;default:return v;}}
export function readAccessor(gltf,buffers,index){
  const a=gltf.accessors?.[index];if(!a)throw Error('Missing glTF accessor '+index);
  const size=COMPONENTS[a.type],bytes=COMPONENT_BYTES[a.componentType];if(!size||!bytes)throw Error('Unsupported accessor '+index);
  if(a.type.startsWith('MAT')&&bytes<4)throw Error('Compact matrix accessors are not supported by the motion-only reader');
  const out=new Float64Array(a.count*size);
  if(a.bufferView!==undefined){const bv=gltf.bufferViews?.[a.bufferView];if(!bv)throw Error('Missing bufferView');const buffer=buffers[bv.buffer];if(!buffer)throw Error('Missing binary buffer '+bv.buffer);const view=new DataView(buffer),start=(bv.byteOffset||0)+(a.byteOffset||0),stride=bv.byteStride||size*bytes;
    if(start+(Math.max(0,a.count-1))*stride+size*bytes>buffer.byteLength)throw Error('Accessor exceeds buffer boundary');
    for(let i=0;i<a.count;i++)for(let k=0;k<size;k++){let v=scalarAt(view,start+i*stride+k*bytes,a.componentType);out[i*size+k]=a.normalized?normalized(v,a.componentType):v;}}
  if(a.sparse){const sp=a.sparse,ibv=gltf.bufferViews[sp.indices.bufferView],vbv=gltf.bufferViews[sp.values.bufferView],iv=new DataView(buffers[ibv.buffer]),vv=new DataView(buffers[vbv.buffer]),ib=COMPONENT_BYTES[sp.indices.componentType],io=(ibv.byteOffset||0)+(sp.indices.byteOffset||0),vo=(vbv.byteOffset||0)+(sp.values.byteOffset||0);
    for(let n=0;n<sp.count;n++){const i=scalarAt(iv,io+n*ib,sp.indices.componentType);if(i>=a.count)throw Error('Sparse accessor index out of range');for(let k=0;k<size;k++){let v=scalarAt(vv,vo+(n*size+k)*bytes,a.componentType);out[i*size+k]=a.normalized?normalized(v,a.componentType):v;}}}
  return {values:out,count:a.count,size,type:a.type,componentType:a.componentType};
}

export async function decodePossibleGzip(bytes){
  let data=bytes instanceof ArrayBuffer?bytes:bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),layers=0;
  while(data.byteLength>=2){const u=new Uint8Array(data);if(u[0]!==0x1f||u[1]!==0x8b)break;if(typeof DecompressionStream==='undefined')throw Error('This browser lacks gzip DecompressionStream');if(layers++>2)throw Error('Excessive nested gzip layers');const stream=new Blob([data]).stream().pipeThrough(new DecompressionStream('gzip'));data=await new Response(stream).arrayBuffer();}
  return {buffer:data,gzipLayers:layers};
}
export function parseGLB(bytes){
  const buffer=bytes instanceof ArrayBuffer?bytes:bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),view=new DataView(buffer);
  if(buffer.byteLength>=12&&view.getUint32(0,true)===0x46546c67){
    if(view.getUint32(4,true)!==2)throw Error('Only glTF 2 GLB is supported');const total=view.getUint32(8,true);if(total>buffer.byteLength||total<12)throw Error('Truncated GLB');let json=null,bin=null;
    for(let offset=12;offset+8<=total;){const len=view.getUint32(offset,true),type=view.getUint32(offset+4,true);offset+=8;if(offset+len>total)throw Error('Invalid GLB chunk size');const chunk=buffer.slice(offset,offset+len);if(type===0x4e4f534a)json=JSON.parse(new TextDecoder().decode(chunk).replace(/[\u0000\s]+$/,''));else if(type===0x004e4942)bin=chunk;offset+=len;}
    if(!json)throw Error('GLB contains no JSON chunk');return {gltf:json,binary:bin};
  }
  const text=new TextDecoder().decode(buffer);try{return {gltf:JSON.parse(text),binary:null};}catch{throw Error('Asset is neither GLB nor glTF JSON. First bytes: '+Array.from(new Uint8Array(buffer).slice(0,12)).map(x=>x.toString(16).padStart(2,'0')).join(' '));}
}
function dataURI(uri){const comma=uri.indexOf(','),meta=uri.slice(0,comma),payload=uri.slice(comma+1);if(/;base64/i.test(meta)){const s=atob(payload);return Uint8Array.from(s,c=>c.charCodeAt(0)).buffer;}return new TextEncoder().encode(decodeURIComponent(payload)).buffer;}

export function createMotion(gltf,buffers,{sourceUrl='',byteLength=0,gzipLayers=0,sha256=null}={}){
  if(String(gltf.asset?.version)!=='2.0')throw Error('Expected a glTF 2.0 document');
  const rawNodes=gltf.nodes||[],parents=Array(rawNodes.length).fill(-1),warnings=[];
  rawNodes.forEach((node,i)=>(node.children||[]).forEach(child=>{if(!Number.isInteger(child)||child<0||child>=rawNodes.length)throw Error('Invalid child node index');if(parents[child]!==-1)throw Error('glTF node has multiple parents');parents[child]=i;}));
  const nodes=rawNodes.map((node,i)=>{
    let trs;if(node.matrix){const m=identity4();for(let r=0;r<4;r++)for(let c=0;c<4;c++)m[r*4+c]=node.matrix[c*4+r];trs=decompose4(m);}else trs={translation:(node.translation||[0,0,0]).slice(),rotation:qNormalize(node.rotation||[0,0,0,1]),scale:(node.scale||[1,1,1]).slice()};
    return {index:i,name:node.name||'node_'+i,parent:parents[i],children:(node.children||[]).slice(),...trs};
  });
  const order=topologicalOrder(parents),cache=new Map(),get=i=>{if(!cache.has(i))cache.set(i,readAccessor(gltf,buffers,i));return cache.get(i);};
  const animations=(gltf.animations||[]).map((anim,index)=>{
    const channels=[];let startTime=Infinity,endTime=-Infinity;
    for(const c of anim.channels||[]){const node=c.target?.node,path=c.target?.path;if(node===undefined||!nodes[node])continue;if(!['rotation','translation','scale'].includes(path)){warnings.push('Ignored animation channel '+path);continue;}const sampler=anim.samplers[c.sampler],times=get(sampler.input),output=get(sampler.output),interpolation=sampler.interpolation||'LINEAR',size=path==='rotation'?4:3;
      if(times.size!==1||output.size!==size)throw Error('Invalid animation channel dimensions');if(!['LINEAR','STEP','CUBICSPLINE'].includes(interpolation))throw Error('Unsupported animation interpolation '+interpolation);if(output.count!==times.count*(interpolation==='CUBICSPLINE'?3:1))throw Error('Animation sample count mismatch');
      if(times.count){startTime=Math.min(startTime,times.values[0]);endTime=Math.max(endTime,times.values[times.count-1]);}channels.push({node,path,size,times:times.values,values:output.values,interpolation});
    }
    if(!Number.isFinite(startTime)){startTime=0;endTime=0;}return {index,name:anim.name||'animation_'+index,channels,startTime,endTime,duration:endTime-startTime};
  });
  const jointSet=new Set();for(const skin of gltf.skins||[])for(const j of skin.joints||[])jointSet.add(j);
  const newPose=()=>({localTranslations:nodes.map(n=>n.translation.slice()),localRotations:nodes.map(n=>n.rotation.slice()),localScales:nodes.map(n=>n.scale.slice()),worldPositions:nodes.map(()=>[0,0,0]),worldRotations:nodes.map(()=>[0,0,0,1]),worldMatrices:nodes.map(identity4),time:0,clip:null});
  const compose=pose=>{for(const j of order){const local=qToMatrix(pose.localRotations[j],pose.localTranslations[j],pose.localScales[j]),p=parents[j];if(p<0){pose.worldMatrices[j].set(local);pose.worldRotations[j]=pose.localRotations[j].slice();}else{multiply4(pose.worldMatrices[p],local,pose.worldMatrices[j]);pose.worldRotations[j]=qNormalize(qMultiply(pose.worldRotations[p],pose.localRotations[j]));}const m=pose.worldMatrices[j],v=pose.worldPositions[j];v[0]=m[3];v[1]=m[7];v[2]=m[11];}pose.positions=pose.worldPositions;pose.rotations=pose.worldRotations;return pose;};
  const rest=compose(newPose());
  const sampleChannel=(channel,t)=>{
    const {times,values,size,interpolation}=channel,n=times.length;if(!n)return null;let lo=0,hi=n-1;
    if(t<=times[0])hi=lo=0;else if(t>=times[n-1])lo=hi=n-1;else {while(hi-lo>1){const m=(lo+hi)>>1;if(times[m]<=t)lo=m;else hi=m;}}
    const stride=size*(interpolation==='CUBICSPLINE'?3:1),base=k=>k*stride+(interpolation==='CUBICSPLINE'?size:0),a=Array.from(values.slice(base(lo),base(lo)+size));
    if(lo===hi||interpolation==='STEP')return channel.path==='rotation'?qNormalize(a):a;
    const dt=times[hi]-times[lo],u=dt>EPS?(t-times[lo])/dt:0,b=Array.from(values.slice(base(hi),base(hi)+size));
    if(interpolation==='CUBICSPLINE'){const u2=u*u,u3=u2*u,h00=2*u3-3*u2+1,h10=u3-2*u2+u,h01=-2*u3+3*u2,h11=u3-u2,out=a.map((x,k)=>h00*x+h10*dt*values[lo*stride+2*size+k]+h01*b[k]+h11*dt*values[hi*stride+k]);return channel.path==='rotation'?qNormalize(out):out;}
    return channel.path==='rotation'?qSlerp(a,b,u):a.map((x,k)=>x+(b[k]-x)*u);
  };
  const sampleInto=(time,pose,options={})=>{
    const selector=options.clip??0,clip=typeof selector==='string'?animations.find(a=>a.name===selector):animations[selector];
    if(!clip){if(animations.length)throw Error('Animation not found: '+selector);return compose(pose);}
    for(let j=0;j<nodes.length;j++){pose.localTranslations[j]=nodes[j].translation.slice();pose.localRotations[j]=nodes[j].rotation.slice();pose.localScales[j]=nodes[j].scale.slice();}
    const relative=(options.loop??true)&&clip.duration>0?((time%clip.duration)+clip.duration)%clip.duration:clamp(time,0,clip.duration),t=clip.startTime+relative;
    for(const c of clip.channels){const v=sampleChannel(c,t);if(!v)continue;pose[c.path==='rotation'?'localRotations':c.path==='translation'?'localTranslations':'localScales'][c.node]=v;}
    pose.time=relative;pose.clip=clip.name;return compose(pose);
  };
  const animatedNodeIndices=[...new Set(animations.flatMap(a=>a.channels.map(c=>c.node)))];
  const motion={sourceUrl,gltf,nodes,parents,order,jointIndices:[...jointSet],animatedNodeIndices,rest,animations,duration:animations[0]?.duration||0,createPoseBuffer:newPose,sampleInto,poseAt:(t,options={})=>sampleInto(t,newPose(),options)};
  motion.diagnostics={sourceUrl,byteLength,gzipLayers,sha256,nodeCount:nodes.length,jointCount:jointSet.size,animatedNodeCount:animatedNodeIndices.length,animationCount:animations.length,animations:animations.map(a=>({name:a.name,duration:a.duration,channels:a.channels.length})),nodes:nodes.map(n=>({index:n.index,name:n.name,parent:n.parent,joint:jointSet.has(n.index),animated:animatedNodeIndices.includes(n.index)})),warnings:[...new Set(warnings)],externalMeshInstantiated:false};
  return motion;
}

export async function loadMotion(url,{fetchImpl=globalThis.fetch,signal,onProgress}={}){
  onProgress?.({stage:'fetch',url});const response=await fetchImpl(url,{signal,mode:'cors'});if(!response.ok)throw Error('Official asset request failed: HTTP '+response.status+' '+url);
  const downloaded=await response.arrayBuffer();onProgress?.({stage:'decode',downloadBytes:downloaded.byteLength});const {buffer,gzipLayers}=await decodePossibleGzip(downloaded),{gltf,binary}=parseGLB(buffer),buffers=[];
  for(let i=0;i<(gltf.buffers||[]).length;i++){const b=gltf.buffers[i];if(!b.uri){if(i!==0||!binary)throw Error('Missing GLB binary buffer');buffers[i]=binary;}else if(b.uri.startsWith('data:'))buffers[i]=dataURI(b.uri);else{const u=new URL(b.uri,response.url||url).href,r=await fetchImpl(u,{signal,mode:'cors'});if(!r.ok)throw Error('glTF external buffer failed: '+r.status);buffers[i]=await r.arrayBuffer();}}
  let sha256=null;if(globalThis.crypto?.subtle)sha256=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',buffer)),b=>b.toString(16).padStart(2,'0')).join('');
  const motion=createMotion(gltf,buffers,{sourceUrl:url,byteLength:buffer.byteLength,gzipLayers,sha256});motion.diagnostics.downloadBytes=downloaded.byteLength;motion.diagnostics.contentType=response.headers.get('content-type');motion.diagnostics.contentEncoding=response.headers.get('content-encoding');onProgress?.({stage:'ready',diagnostics:motion.diagnostics});return motion;
}
