/** Optional recovery-only scheduling. Never activate without same-scene GPU QA.
 * The owner must replace the descriptor texture and this table atomically under
 * a NEW positive token whenever ANY descriptor bit changes (including doors).
 * Token reuse after movement is invalid even if IDs/count stay the same.
 */
export const HOST_RECOVERY_CANDIDATE_MAGIC=7846123;
export const HOST_RECOVERY_CANDIDATE_VERSION=1;
const integer=(v,lo,hi)=>Number.isInteger(v)&&v>=lo&&v<=hi,MAX=1048576;
export function packHostGlassRecoveryCandidates(analysis,{descriptorToken}={}){
 if(analysis?.schema!=='kaopu.host-glass-recovery-analysis/1'||!integer(descriptorToken,1,16777215)||!integer(analysis.primitiveCount,1,4096))throw Error('Validated recovery analysis and fresh descriptor token required');
 const rows=analysis.rows.filter(r=>r.domain&&r.uncertain.length===0).slice().sort((a,b)=>a.ownObjectId-b.ownObjectId),count=analysis.primitiveCount;
 if(rows.length>4096||new Set(rows.map(r=>r.ownObjectId)).size!==rows.length)throw Error('Unique bounded recovery-own rows required');
 const records=2+4*rows.length+rows.reduce((n,r)=>n+r.candidatePrimitiveIndices.length,0);if(records>MAX)throw Error('Recovery candidate table budget exceeded');
 const width=Math.min(256,2**Math.ceil(Math.log2(Math.max(1,Math.sqrt(records))))),height=Math.ceil(records/width),data=new Float32Array(width*height*4);let cursor=2+4*rows.length;
 data.set([HOST_RECOVERY_CANDIDATE_MAGIC,descriptorToken,count,rows.length]);data.set([records,HOST_RECOVERY_CANDIDATE_VERSION,0,0],4);
 rows.forEach((row,i)=>{const base=4*(2+4*i),covered=new Set([row.ownPrimitiveIndex]);if(!integer(row.ownObjectId,1,16777215)||!integer(row.ownPrimitiveIndex,0,count-1)||!(row.ownErrorLimit>0&&row.ownErrorLimit<=row.ownErrorMax&&row.ownErrorMax<=1)||![...row.domain.min,...row.domain.max,row.ownErrorLimit,row.ownErrorMax].every(v=>Number.isFinite(v)&&Math.fround(v)===v)||row.domain.min.some((v,k)=>v>row.domain.max[k]))throw Error('Invalid recovery row');
  let last=-1;for(const k of row.candidatePrimitiveIndices){if(!integer(k,0,count-1)||k<=last||covered.has(k))throw Error('Recovery candidates must preserve original order');covered.add(k);last=k}
  for(const p of row.omitted){if(!integer(p.primitiveIndex,0,count-1)||covered.has(p.primitiveIndex)||!(p.distanceLower>p.bandUpper))throw Error('Strict recovery exclusion certificate required');covered.add(p.primitiveIndex)}if(covered.size!==count)throw Error('Recovery partition is incomplete');
  data.set([row.ownObjectId,cursor,row.candidatePrimitiveIndices.length,row.ownErrorLimit],base);data.set([...row.domain.min,row.ownErrorMax],base+4);data.set([...row.domain.max,row.ownPrimitiveIndex+1],base+8);data.set([descriptorToken,count,row.ownObjectId,HOST_RECOVERY_CANDIDATE_VERSION],base+12);
  for(const k of row.candidatePrimitiveIndices){const bits=analysis.descriptorBits[4*(1+9*k)+7],one=new Uint32Array([bits]),objectId=new Float32Array(one.buffer)[0];data.set([k+1,objectId,descriptorToken,HOST_RECOVERY_CANDIDATE_VERSION],4*cursor++);}
 });
 return{width,height,data,token:descriptorToken,rowCount:rows.length,primitiveCount:count,records,candidateCount:rows.reduce((n,r)=>n+r.candidatePrimitiveIndices.length,0),activationAutomatic:false};
}
/** CPU mirror of the GPU structural/token/domain guards. null is FULL SCAN.
 * This token contract is not a content hash; readHostGlassRecoveryCandidates in
 * the analysis module additionally supports exact CPU descriptor-bit checking. */
export function readPackedHostGlassRecoveryCandidates(index,ownObjectId,point,error,{descriptors,descriptorToken,expectedToken=index?.token,enabled=true}={}){
 if(!enabled||!(index?.data instanceof Float32Array)||!integer(index.width,1,16384)||!integer(index.height,1,16384)||index.data.length!==index.width*index.height*4||!(descriptors?.data instanceof Float32Array))return null;
 const d=index.data,count=descriptors.data[0],n=d[3],records=d[4],version=HOST_RECOVERY_CANDIDATE_VERSION;
 if(d[0]!==HOST_RECOVERY_CANDIDATE_MAGIC||d[1]!==descriptorToken||d[1]!==expectedToken||!integer(descriptorToken,1,16777215)||!integer(count,1,4096)||d[2]!==count||descriptors.data[1]!==9||!integer(n,0,4096)||!integer(records,2+4*n,Math.min(MAX,index.width*index.height))||d[5]!==version)return null;
 if(!point||point.length!==3||!Array.from(point).every(Number.isFinite)||!Number.isFinite(error))return null;
 let low=0,high=n-1,row=-1;while(low<=high){const mid=(low+high)>>1,id=d[4*(2+4*mid)];if(id===ownObjectId){row=mid;break}if(id<ownObjectId)low=mid+1;else high=mid-1}if(row<0)return null;
 const b=4*(2+4*row),start=d[b+1],length=d[b+2],limit=d[b+3],errorMax=d[b+7],own=d[b+11]-1;
 if(d[b+12]!==descriptorToken||d[b+13]!==count||d[b+14]!==ownObjectId||d[b+15]!==version||!integer(start,2+4*n,records)||!integer(length,0,count-1)||start+length>records||!integer(own,0,count-1)||!(error>0&&error<limit&&limit<=errorMax&&errorMax<=1)||point.some((v,k)=>!(v>=d[b+4+k]&&v<=d[b+8+k]))||descriptors.data[4*(1+9*own)+7]!==ownObjectId)return null;
 const out=[];let previous=-1;for(let i=0;i<length;i++){const a=4*(start+i),k=d[a]-1;if(!integer(k,0,count-1)||k<=previous||k===own||d[a+2]!==descriptorToken||d[a+3]!==version||descriptors.data[4*(1+9*k)+7]!==d[a+1])return null;out.push(k);previous=k}return out;
}
export const HOST_RECOVERY_CANDIDATE_GLSL=`
uniform highp sampler2D uHostRecoveryCandidates;
uniform bool uHostRecoveryCandidatesEnabled;
uniform int uHostRecoveryCandidateToken,uHostRecoveryDescriptorToken;
vec4 hostRecoveryCandidateRecord(int i){int w=textureSize(uHostRecoveryCandidates,0).x;return texelFetch(uHostRecoveryCandidates,ivec2(i%w,i/w),0);}
bool hostRecoveryCandidateInteger(float x,float lo,float hi){return x>=lo&&x<=hi&&floor(x)==x;}
ivec2 hostRecoveryCandidateRange(float ownId,vec3 point,float error,int primitiveCount){
 if(!uHostRecoveryCandidatesEnabled)return ivec2(-1,primitiveCount);
 ivec2 size=textureSize(uHostRecoveryCandidates,0);int capacity=size.x*size.y;if(capacity<2)return ivec2(-1,primitiveCount);
 vec4 head=hostRecoveryCandidateRecord(0),meta=hostRecoveryCandidateRecord(1);float token=float(uHostRecoveryDescriptorToken);
 if(head.x!=7846123.||head.y!=token||head.y!=float(uHostRecoveryCandidateToken)||!hostRecoveryCandidateInteger(token,1.,16777215.)||head.z!=float(primitiveCount)||!hostRecoveryCandidateInteger(head.w,0.,4096.)||meta.y!=1.||!hostRecoveryCandidateInteger(meta.x,2.+4.*head.w,min(1048576.,float(capacity)))||hostRecoveryRecord(0).y!=9.)return ivec2(-1,primitiveCount);
 int lower=0,upper=int(head.w)-1,row=-1;while(lower<=upper){int middle=(lower+upper)/2;float id=hostRecoveryCandidateRecord(2+4*middle).x;if(id==ownId){row=middle;break;}if(id<ownId)lower=middle+1;else upper=middle-1;}if(row<0)return ivec2(-1,primitiveCount);
 int base=2+4*row;vec4 r=hostRecoveryCandidateRecord(base),low=hostRecoveryCandidateRecord(base+1),high=hostRecoveryCandidateRecord(base+2),identity=hostRecoveryCandidateRecord(base+3);
 if(identity.x!=token||identity.y!=float(primitiveCount)||identity.z!=ownId||identity.w!=1.||!hostRecoveryCandidateInteger(r.y,2.+4.*head.w,meta.x)||!hostRecoveryCandidateInteger(r.z,0.,float(primitiveCount-1))||r.y+r.z>meta.x||!hostRecoveryCandidateInteger(high.w,1.,float(primitiveCount))||!(error>0.&&error<r.w&&r.w<=low.w&&low.w<=1.)||!all(greaterThanEqual(point,low.xyz))||!all(lessThanEqual(point,high.xyz)))return ivec2(-1,primitiveCount);
 int own=int(high.w)-1;if(hostRecoveryRecord(1+9*own+1).w!=ownId)return ivec2(-1,primitiveCount);
 int start=int(r.y),count=int(r.z),previous=-1;for(int i=0;i<count;i++){vec4 item=hostRecoveryCandidateRecord(start+i);if(!hostRecoveryCandidateInteger(item.x,1.,float(primitiveCount)))return ivec2(-1,primitiveCount);int k=int(item.x)-1;if(k<=previous||k==own||item.z!=token||item.w!=1.||hostRecoveryRecord(1+9*k+1).w!=item.y)return ivec2(-1,primitiveCount);previous=k;}
 return ivec2(start,count);
}
`;
const HEADER='int count=int(hostRecoveryRecord(0).x);float ownId=apertureLoad(own).objectId;',LOOP='for(int k=0;k<count;k++){';
export function withHostGlassRecoveryCandidates(source){
 if(typeof source!=='string'||source.includes('hostRecoveryCandidateRange('))throw Error('Recovery candidate wrapper requires unwrapped host source');
 const a=source.indexOf('bool apertureGlassRecoveryIsolated('),b=source.indexOf('bool apertureOwnEndpointVerified(',a);if(a<0||b<a)throw Error('Host recovery declaration contract changed');
 const original=source.slice(a,b);if(original.split(HEADER).length!==2||original.split(LOOP).length!==2)throw Error('Full-scene host recovery loop contract changed');
 const indexed=original.replace(HEADER,HEADER+'ivec2 recoveryRange=hostRecoveryCandidateRange(ownId,point,error,count);int recoveryCount=recoveryRange.x<0?count:recoveryRange.y;').replace(LOOP,'for(int recoveryCandidate=0;recoveryCandidate<recoveryCount;recoveryCandidate++){int k=recoveryRange.x<0?recoveryCandidate:int(hostRecoveryCandidateRecord(recoveryRange.x+recoveryCandidate).x)-1;');
 return source.slice(0,a)+HOST_RECOVERY_CANDIDATE_GLSL+indexed+source.slice(b);
}
