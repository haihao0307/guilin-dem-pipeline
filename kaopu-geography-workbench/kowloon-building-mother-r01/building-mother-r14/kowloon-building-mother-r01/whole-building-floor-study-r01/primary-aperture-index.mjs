/** Primary aperture candidate scheduling only. Authoritative descriptors,
 * interval algebra, part ownership, full union-neighbour validation and every
 * secondary ray remain unchanged. Invalid metadata always fails open. */
import {buildAperturesGLSL} from '../r07/apertures.mjs';
import {prepareTileFrustum,aabbIntersectsTile} from '../whole-building-ground-r01/tile-visibility.mjs';
export const APERTURE_INDEX_MAGIC=6721351;
export const MAX_APERTURE_INDEX_RECORDS=1048576;
export const MAX_APERTURE_INDEX_PARTS=4096;
const APERTURE_EPS=0.000002,FLOAT_EPS=2**-23;
const integer=(v,lo,hi)=>Number.isInteger(v)&&v>=lo&&v<=hi;
const finite3=v=>v?.length===3&&Array.from(v).every(Number.isFinite);
const floatScratch=new Float32Array(1),bitsScratch=new Uint32Array(floatScratch.buffer);
function outwardFloat(v,up){
 if(!Number.isFinite(v))return NaN;floatScratch[0]=v;const rounded=floatScratch[0];if(!Number.isFinite(rounded))return NaN;
 if((up&&rounded>=v)||(!up&&rounded<=v))return rounded;
 if(rounded===0){bitsScratch[0]=up?1:0x80000001;return floatScratch[0];}
 bitsScratch[0]+=((rounded>0)===up)?1:-1;return floatScratch[0];
}
const normInfinity=m=>Math.max(...m.map(row=>row.reduce((sum,x)=>sum+Math.abs(x),0)));
/** Bounds of the packed shader field, not an assumption of exactly rigid F32
 * axes. Shader local = M*(world-origin), so the finite outer support is mapped
 * by inverse(M). An inner cutter/rounding can only remove this outer support.
 * Generous scale-dependent outward guards cover expected highp F32 arithmetic;
 * this is not a universal GPU floating-point proof. Unreliable inputs retain
 * the original full part by returning null for its individual bounds. */
export function aperturePackedBounds(packed,expectedCount){
 if(!(packed?.data instanceof Float32Array)||!integer(packed.width,1,16384)||!integer(packed.height,1,16384)||packed.data.length!==packed.width*packed.height*4||!integer(expectedCount,1,MAX_APERTURE_INDEX_PARTS))return null;
 const d=packed.data;if(d[0]!==expectedCount||d[1]!==9||1+9*expectedCount>packed.width*packed.height)return null;
 return Array.from({length:expectedCount},(_,k)=>{
  const base=4*(1+9*k),record=n=>Array.from(d.slice(base+4*n,base+4*n+4));
  const origin=record(0).slice(0,3),u=record(1).slice(0,3),v=record(2).slice(0,3),wRecord=record(3),w=wRecord.slice(0,3),outer=record(4),radii=record(5),oldLow=record(7).slice(0,3),oldHigh=record(8).slice(0,3),depth=wRecord[3];
  if(![origin,u,v,w,oldLow,oldHigh].every(finite3)||!outer.every(Number.isFinite)||!radii.every(Number.isFinite)||!Number.isFinite(depth)||depth<=0||outer[2]<=0||outer[3]<=0||radii[0]<0||radii[0]>Math.min(outer[2],outer[3])||oldLow.some((x,i)=>x>oldHigh[i]))return null;
  const M=[u,v,w],dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
  // Uploaded recipes promise a rigid basis. Unexpected scale/shear fails open.
  for(let i=0;i<3;i++)for(let j=0;j<3;j++)if(Math.abs(dot(M[i],M[j])-(i===j?1:0))>0.00001)return null;
  const [a,b,c]=u,[dd,e,f]=v,[g,h,i]=w,det=a*(e*i-f*h)-b*(dd*i-f*g)+c*(dd*h-e*g);
  if(!Number.isFinite(det)||Math.abs(det)<.999||Math.abs(det)>1.001)return null;
  const inverse=[[e*i-f*h,c*h-b*i,b*f-c*e],[f*g-dd*i,a*i-c*g,c*dd-a*f],[dd*h-e*g,b*g-a*h,a*e-b*dd]].map(row=>row.map(x=>x/det));
  const inverseNorm=normInfinity(inverse),condition=normInfinity(M)*inverseNorm;
  if(!Number.isFinite(condition)||condition>4)return null;
  const center=inverse.map((row,j)=>origin[j]+row[0]*outer[0]+row[1]*outer[1]);
  const extent=inverse.map(row=>Math.abs(row[0])*outer[2]+Math.abs(row[1])*outer[3]+Math.abs(row[2])*depth);
  const localScale=Math.abs(outer[0])+Math.abs(outer[1])+outer[2]+outer[3]+depth;
  const scale=1+Math.max(...origin.map(Math.abs))+inverseNorm*localScale+Math.max(...extent);
  // Outward-only: origin subtraction/dots, inverse-support construction and
  // interval endpoints receive a large F32 margin plus the existing union EPS.
  const padding=APERTURE_EPS+128*FLOAT_EPS*scale;
  const min=center.map((x,j)=>outwardFloat(Math.min(x-extent[j],oldLow[j])-padding,false));
  const max=center.map((x,j)=>outwardFloat(Math.max(x+extent[j],oldHigh[j])+padding,true));
  return finite3(min)&&finite3(max)&&min.every((x,j)=>x<=max[j])?{min,max}:null;
 });
}
/** One immutable record texture per frame, one row per closed camera tile.
 * Nonfinite/near-up-branch cameras disable the entire optional index. Individual
 * bad part bounds pass aabbIntersectsTile's fail-open branch. */
export function buildPrimaryApertureIndex({bounds,frame,width,height,tileSize,token}){
 if(!Array.isArray(bounds)||!integer(bounds.length,1,MAX_APERTURE_INDEX_PARTS)||!integer(width,1,4096)||!integer(height,1,4096)||!integer(tileSize,1,256)||!integer(token,1,16777215)||frame?.width!==width||frame?.height!==height||!frame.valid||!frame.sidePlanesReliable)return null;
 const tilesX=Math.ceil(width/tileSize),tilesY=Math.ceil(height/tileSize),rangeCount=tilesX*tilesY;
 if(!integer(rangeCount,1,MAX_APERTURE_INDEX_RECORDS-1))return null;
 const ranges=[],indices=[],primitiveCount=bounds.length;
 for(let y=0;y<height;y+=tileSize)for(let x=0;x<width;x+=tileSize){
  const tile=prepareTileFrustum(frame,{x,y,width:Math.min(tileSize,width-x),height:Math.min(tileSize,height-y)}),selected=[];
  for(let k=0;k<primitiveCount;k++)if(aabbIntersectsTile(tile,bounds[k]))selected.push(k);
  const start=1+rangeCount+indices.length;ranges.push([start,selected.length,primitiveCount,token]);indices.push(...selected);
  if(1+rangeCount+indices.length>MAX_APERTURE_INDEX_RECORDS)return null;
 }
 const records=1+rangeCount+indices.length,textureWidth=Math.min(256,2**Math.ceil(Math.log2(Math.sqrt(records)))),textureHeight=Math.ceil(records/textureWidth),data=new Float32Array(textureWidth*textureHeight*4);
 data.set([APERTURE_INDEX_MAGIC,token,rangeCount,records]);ranges.forEach((r,k)=>data.set(r,4*(1+k)));indices.forEach((k,j)=>data[4*(1+rangeCount+j)]=k+1);
 return{data,width:textureWidth,height:textureHeight,token,rangeCount,indexCount:indices.length,records,tilesX,tilesY,primitiveCount};
}
export function apertureTileRow(index,tileIndex){return index&&integer(tileIndex,0,index.rangeCount-1)?1+tileIndex:-1;}
/** null means original full list, [] is a validated empty list. */
export function readPrimaryApertureList(index,row,primitiveCount,{enabled=true,primaryRay=true,token=index?.token}={}){
 if(!enabled||!primaryRay||!index||!(index.data instanceof Float32Array)||!integer(index.width,1,16384)||!integer(index.height,1,16384)||index.data.length!==index.width*index.height*4)return null;
 const d=index.data,capacity=index.width*index.height,rangeCount=d[2],records=d[3];
 if(d[0]!==APERTURE_INDEX_MAGIC||d[1]!==token||!integer(token,1,16777215)||!integer(rangeCount,1,capacity-1)||!integer(records,rangeCount+1,capacity)||!integer(row,1,rangeCount))return null;
 const b=row*4,start=d[b],count=d[b+1];if(d[b+2]!==primitiveCount||d[b+3]!==token||!integer(start,rangeCount+1,records)||!integer(count,0,primitiveCount)||start+count>records)return null;
 if(count===primitiveCount)return null;
 const out=[];let previous=-1;for(let j=0;j<count;j++){const encoded=d[(start+j)*4],k=encoded-1;if(!integer(encoded,1,primitiveCount)||k<=previous)return null;out.push(k);previous=k;}return out;
}
export const PRIMARY_APERTURE_INDEX_GLSL=`
uniform highp sampler2D uPrimaryApertureIndex;
uniform bool uPrimaryApertureIndexEnabled;
uniform int uPrimaryApertureIndexToken;
uniform int uPrimaryApertureIndexRow;
bool floorPrimaryApertureRay=false;
vec4 floorApertureIndexRecord(int record){int width=textureSize(uPrimaryApertureIndex,0).x;return texelFetch(uPrimaryApertureIndex,ivec2(record%width,record/width),0);}
bool floorApertureInteger(float x,float lo,float hi){return x>=lo&&x<=hi&&floor(x)==x;}
ivec2 floorApertureCandidateRange(int primitiveCount){
 if(!uPrimaryApertureIndexEnabled||!floorPrimaryApertureRay)return ivec2(-1,primitiveCount);
 ivec2 size=textureSize(uPrimaryApertureIndex,0);int capacity=size.x*size.y;if(capacity<2)return ivec2(-1,primitiveCount);
 vec4 head=floorApertureIndexRecord(0);float token=float(uPrimaryApertureIndexToken);
 if(head.x!=6721351.||head.y!=token||!floorApertureInteger(token,1.,16777215.)||!floorApertureInteger(head.z,1.,float(capacity-1))||!floorApertureInteger(head.w,head.z+1.,float(capacity)))return ivec2(-1,primitiveCount);
 int row=uPrimaryApertureIndexRow;if(row<1||row>int(head.z))return ivec2(-1,primitiveCount);
 vec4 range=floorApertureIndexRecord(row);if(range.z!=float(primitiveCount)||range.w!=token||!floorApertureInteger(range.x,head.z+1.,head.w)||!floorApertureInteger(range.y,0.,float(primitiveCount))||range.x+range.y>head.w)return ivec2(-1,primitiveCount);
 int start=int(range.x),count=int(range.y);if(count==primitiveCount)return ivec2(-1,primitiveCount);
 int previous=-1;for(int j=0;j<count;j++){float encoded=floorApertureIndexRecord(start+j).x;if(!floorApertureInteger(encoded,1.,float(primitiveCount)))return ivec2(-1,primitiveCount);int k=int(encoded)-1;if(k<=previous)return ivec2(-1,primitiveCount);previous=k;}
 return ivec2(start,count);
}
`;
const TRACE_PREFIX='h.local=ro;int count=int(apertureRecord(0).x);for(int k=0;k<count;k++){AperturePart p=apertureLoad(k);';
export function buildPrimaryTileAperturesGLSL(input){
 const source=buildAperturesGLSL(input);if(source.split(TRACE_PREFIX).length!==2)throw Error('Frozen aperture primary trace candidate contract changed');
 const cover='if(k==own)continue;AperturePart p=apertureLoad(k);';if(source.split(cover).length!==2)throw Error('Own coverage contract changed');
 const bounded=source.replace(cover,'if(k==own)continue;int bb=1+9*k;vec3 low=apertureRecord(bb+7).xyz,high=apertureRecord(bb+8).xyz;if(any(lessThan(point,low-vec3(apertureEPS)))||any(greaterThan(point,high+vec3(apertureEPS))))continue;AperturePart p=apertureLoad(k);');
 return PRIMARY_APERTURE_INDEX_GLSL+bounded.replace(TRACE_PREFIX,'h.local=ro;int count=int(apertureRecord(0).x);ivec2 primaryRange=floorApertureCandidateRange(count);int candidateCount=primaryRange.x<0?count:primaryRange.y;for(int candidateIndex=0;candidateIndex<candidateCount;candidateIndex++){int k=primaryRange.x<0?candidateIndex:int(floorApertureIndexRecord(primaryRange.x+candidateIndex).x)-1;AperturePart p=apertureLoad(k);');
}
