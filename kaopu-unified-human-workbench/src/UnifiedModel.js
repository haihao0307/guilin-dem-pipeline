/** One immutable canonical person, independent teacher parameter spaces. */
import {multiply4,rigidInverse4} from './AnnyModel.js';
export const DEFAULT_STATE=()=>({schema:'kaopu-unified-person/1',personId:'canonical-person-001',phenotypes:{gender:.5,age:2/3,muscle:.5,weight:.5,height:.5,proportions:.5},localChanges:{},pose:{},headIdentity:Array(253).fill(0),headExpression:Array(383).fill(0),mhr:{amount:0,channel:null}});
const point=(m,p)=>[m[0]*p[0]+m[1]*p[1]+m[2]*p[2]+m[3],m[4]*p[0]+m[5]*p[1]+m[6]*p[2]+m[7],m[8]*p[0]+m[9]*p[1]+m[10]*p[2]+m[11]];
const dist=(a,b)=>Math.hypot(...a.map((x,i)=>x-b[i]));
export class UnifiedModel {
 constructor(anny,gnm,canonical,mhr=null,fingerprint=null){
  if(!fingerprint||!/^[0-9a-f]{64}$/.test(fingerprint.id))throw Error('Versioned adapter fingerprint required');
  this.adapterFingerprint=fingerprint.id;
  this.mhr=mhr;
  if(mhr&&mhr.topologySha256!==canonical.topologySha256)throw Error('MHR delta topology mismatch');
  this.anny=anny;this.gnm=gnm;this.canonical=canonical;this.faces=new Uint32Array(canonical.faces);
  this.bodyCount=canonical.annyRecipes.length;this.headCount=canonical.gnmRecipes.length;this.vertexCount=this.bodyCount+this.headCount;
  if(mhr&&(mhr.vertexCount!==this.bodyCount||mhr.positive?.length!==this.bodyCount*3||mhr.negative?.length!==this.bodyCount*3||!mhr.positive.every(Number.isFinite)||!mhr.negative.every(Number.isFinite)))throw Error('Invalid MHR displacement asset dimensions');
  this.positions=new Float32Array(this.vertexCount*3);this.headNative=new Float32Array(gnm.numVertices*3);
  this.neutral=anny.forward({phenotypes:canonical.referenceAnnyPhenotypes});
  this.headBone=anny.boneLabels.indexOf('head');this.neckBone=anny.boneLabels.indexOf('neck01');this.revision=0;
  this.referenceHead=this.neutral.boneHeads.slice(this.headBone*3,this.headBone*3+3);this.referenceNeck=this.neutral.boneHeads.slice(this.neckBone*3,this.neckBone*3+3);
 }
 compute(state){
  const amount=state.mhr?.amount??0;
  if(typeof amount!=='number'||!Number.isFinite(amount)||Math.abs(amount)>1)throw Error('MHR torso experiment requires a finite number in [-1,1]');
  const channel=state.mhr?.channel??null;
  if(![null,'identity_000'].includes(channel)||(amount!==0&&channel!=='identity_000'))throw Error('Unsupported MHR channel');
  const bodyRest=this.anny.forward({phenotypes:state.phenotypes,localChanges:state.localChanges});
  const body=this.anny.forward({phenotypes:state.phenotypes,localChanges:state.localChanges,pose:state.pose});
  this.gnm.setIdentityVector(state.headIdentity);this.gnm.setExpressionVector(state.headExpression);this.gnm.computeVertices(this.headNative);
  const c=this.canonical,pos=this.positions;
  for(let i=0;i<this.bodyCount;i++){const [a,b,t]=c.annyRecipes[i];for(let k=0;k<3;k++)pos[i*3+k]=body.vertices[a*3+k]*(1-t)+body.vertices[b*3+k]*t;}
  const head=bodyRest.boneHeads.slice(this.headBone*3,this.headBone*3+3),neck=bodyRest.boneHeads.slice(this.neckBone*3,this.neckBone*3+3);
  // Only uniform head scale and attachment move with Anny shape. GNM coefficients
  // stay identical; Anny age does not claim to age facial appearance.
  const scale=dist(head,neck)/dist(this.referenceHead,this.referenceNeck);
  const poseDeltas=Array.from({length:this.anny.boneCount},(_,j)=>multiply4(body.bonePoses.slice(j*16,j*16+16),rigidInverse4(bodyRest.bonePoses.slice(j*16,j*16+16))));
  // MHR teacher contribution is an actual transported torso displacement,
  // not a relabelled Anny control. It stays in this one canonical vertex array.
  if(amount&&!this.mhr)throw Error('MHR transfer asset unavailable');
  if(amount){const delta=amount>=0?this.mhr.positive:this.mhr.negative,a=this.anny.arrays;
   for(let i=0;i<this.bodyCount;i++){const d=[0,1,2].map(k=>delta[i*3+k]*Math.abs(amount));if(!d.some(x=>x))continue;const [src0,src1,t]=c.annyRecipes[i],out=[0,0,0];for(const [src,blend] of [[src0,1-t],[src1,t]]){if(!blend)continue;for(let k=0;k<this.anny.influences;k++){const slot=src*this.anny.influences+k,w=a.vertex_bone_weights[slot]*blend;if(!w)continue;const m=poseDeltas[a.vertex_bone_indices[slot]];for(let row=0;row<3;row++)out[row]+=w*(m[row*4]*d[0]+m[row*4+1]*d[1]+m[row*4+2]*d[2]);}}
    for(let k=0;k<3;k++)pos[i*3+k]+=out[k];
   }
  }
  for(let i=0;i<this.headCount;i++){
   const [a,b,t0]=c.gnmRecipes[i],v=this.headNative;const t=c.headTransform.translation,raw=[0,1,2].map(k=>v[a*3+k]*(1-t0)+v[b*3+k]*t0);
   const original=[raw[0]+t[0],-raw[2]+t[1],raw[1]+t[2]];
   let p=original.map((x,k)=>(x-this.referenceHead[k])*scale+head[k]);
   const out=[0,0,0];for(let k=0;k<c.headSkinIndices[i].length;k++){const pp=point(poseDeltas[c.headSkinIndices[i][k]],p),w=c.headSkinWeights[i][k];for(let a=0;a<3;a++)out[a]+=w*pp[a];}
   pos.set(out,(i+this.bodyCount)*3);
  }
  const beforeContour=pos.slice();
  const contour=c.neckContour;
  if(contour){const corrections=new Map(),m=poseDeltas[this.anny.boneLabels.indexOf('neck02')],up=[m[2],m[6],m[10]].map(x=>x*contour.gapMetres*scale);
   contour.headRing.forEach((vi,i)=>{const [a,b,t]=contour.targets[i];corrections.set(vi,[0,1,2].map(k=>pos[a*3+k]*(1-t)+pos[b*3+k]*t+up[k]-pos[vi*3+k]));});
   for(const [hi,a,b,t,w] of contour.headLinks){const da=corrections.get(a),db=corrections.get(b),vi=this.bodyCount+hi;for(let k=0;k<3;k++)pos[vi*3+k]+=w*(da[k]*(1-t)+db[k]*t);}
  }
  this.neckContourMaxMM=0;for(let i=this.bodyCount*3;i<pos.length;i+=3)this.neckContourMaxMM=Math.max(this.neckContourMaxMM,1000*Math.hypot(pos[i]-beforeContour[i],pos[i+1]-beforeContour[i+1],pos[i+2]-beforeContour[i+2]));
  // A canonical transition owns this narrow neck band. Never smooth a face,
  // swap topology, or mutate either source model. Report its displacement.
  const beforeFair=pos.slice(),fair=c.neckFairing;
  if(fair){const next=pos.slice();for(let it=0;it<fair.iterations;it++)for(const coefficient of [fair.lambda,fair.mu]){next.set(pos);for(const row of fair.band){for(let k=0;k<3;k++){let avg=0;for(const n of row.neighbors)avg+=pos[n*3+k];avg/=row.neighbors.length;next[row.index*3+k]=pos[row.index*3+k]+coefficient*row.weight*(avg-pos[row.index*3+k]);}}pos.set(next);}}
  this.neckFairingMaxMM=0;for(let i=0;i<pos.length;i+=3)this.neckFairingMaxMM=Math.max(this.neckFairingMaxMM,1000*Math.hypot(pos[i]-beforeFair[i],pos[i+1]-beforeFair[i+1],pos[i+2]-beforeFair[i+2]));
  if(!Array.from(pos).every(Number.isFinite))throw Error('Non-finite canonical geometry');
  this.lastBody=body;this.headScale=scale;this.revision++;return pos;
 }
 metrics(){
  const p=this.positions,c=this.canonical;let maxSeamEdge=0,minArea=Infinity;
  const first=c.report.bodyFaces+c.report.headFaces;
  for(let i=first*3;i<this.faces.length;i+=3){const v=[0,1,2].map(k=>Array.from(p.subarray(this.faces[i+k]*3,this.faces[i+k]*3+3)));for(let k=0;k<3;k++)maxSeamEdge=Math.max(maxSeamEdge,dist(v[k],v[(k+1)%3]));const a=v[1].map((x,k)=>x-v[0][k]),b=v[2].map((x,k)=>x-v[0][k]);minArea=Math.min(minArea,.5*Math.hypot(a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]));}
  return {vertices:this.vertexCount,triangles:this.faces.length/3,topologySha256:c.topologySha256,bodyVertices:this.bodyCount,headVertices:this.headCount,seamTriangles:c.report.seamFaces,maxSeamEdgeMM:maxSeamEdge*1000,minSeamTriangleAreaMM2:minArea*1e6,headScale:this.headScale,neckContourMaxMM:this.neckContourMaxMM,neckFairingMaxMM:this.neckFairingMaxMM,revision:this.revision};
 }
}

export function validateProfile(raw,model){
 if(!raw||raw.schema!=='kaopu-unified-person/1'||raw.topologySha256!==model.canonical.topologySha256||raw.adapterFingerprint!==model.adapterFingerprint)throw Error('档案或固定拓扑版本不匹配');
 const s=DEFAULT_STATE();if(typeof raw.personId!=='string'||raw.personId.length>100)throw Error('角色标识无效');s.personId=raw.personId;
 for(const k of Object.keys(s.phenotypes)){const v=raw.phenotypes?.[k];if(!Number.isFinite(v)||v<(k==='age'?1/3:0)||v>1)throw Error('身体参数范围无效');s.phenotypes[k]=v;}
 for(const [name,size] of [['headIdentity',253],['headExpression',383]]){const v=raw[name];if(!Array.isArray(v)||v.length!==size||!v.every(x=>Number.isFinite(x)&&Math.abs(x)<=3))throw Error('头部参数无效');s[name]=v.slice();}
 if(!raw.pose||typeof raw.pose!=='object'||Array.isArray(raw.pose))throw Error('动作参数无效');for(const [key,value] of Object.entries(raw.pose)){if(!model.anny.boneLabels.includes(key)||!Array.isArray(value)||value.length!==3||!value.every(x=>Number.isFinite(x)&&Math.abs(x)<=90))throw Error('骨骼动作参数无效');s.pose[key]=value.slice();}
 if(raw.localChanges&&Object.keys(raw.localChanges).length)throw Error('此实验版档案暂不接收局部自由修改');
 const n=raw.mhr?.amount;if(!Number.isFinite(n)||Math.abs(n)>1)throw Error('MHR实验范围无效');const channel=raw.mhr?.channel??null;if(![null,'identity_000'].includes(channel)||(n!==0&&channel!=='identity_000'))throw Error('不支持该 MHR 通道');s.mhr={amount:n,channel};return s;
}
