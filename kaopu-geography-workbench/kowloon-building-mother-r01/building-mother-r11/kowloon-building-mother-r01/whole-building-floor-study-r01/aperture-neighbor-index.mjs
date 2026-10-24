/** Ordered conservative neighbours for aperture outward-coverage queries only.
 * Not the primary-ray tile index. Every shader query first checks that its exact
 * computed point lies in the stored own-query domain; otherwise it scans all
 * original parts. Neighbour guard boxes enclose the unchanged low/high +/- EPS
 * predicate. No assumption about ray endpoint accuracy is needed for exclusion.
 */
import {aperturePackedBounds} from './primary-aperture-index.mjs';
export const NEIGHBOR_MAGIC=6721357,MAX_NEIGHBOR_RECORDS=131072;
const EPS=Math.fround(.000002),integer=(v,a,b)=>Number.isInteger(v)&&v>=a&&v<=b;
const finite3=a=>a?.length===3&&Array.from(a).every(Number.isFinite);
const valid=b=>finite3(b?.min)&&finite3(b?.max)&&b.min.every((v,k)=>v<=b.max[k]);
const overlap=(a,b)=>!valid(a)||!valid(b)||a.min.every((v,k)=>v<=b.max[k]&&b.min[k]<=a.max[k]);
const scratch=new Float32Array(1),bits=new Uint32Array(scratch.buffer);
function outward(v,up){scratch[0]=Math.fround(v);if(!Number.isFinite(scratch[0]))return NaN;if(scratch[0]===0){bits[0]=up?1:0x80000001;return scratch[0]}bits[0]+=((scratch[0]>0)===up)?1:-1;return scratch[0]}
export function packApertureNeighbors(packed,token){
 if(!(packed?.data instanceof Float32Array)||!integer(token,1,16777215)||packed.data.length!==packed.width*packed.height*4)return null;
 const count=packed.data[0];if(!integer(count,1,256)||4*(1+9*count)>packed.data.length)return null;
 const domains=aperturePackedBounds(packed,count);if(!domains||domains.length!==count)return null;
 const guards=Array.from({length:count},(_,k)=>{const base=4*(1+9*k);return{min:Array.from(packed.data.slice(base+28,base+31),v=>outward(Math.fround(v-EPS),false)),max:Array.from(packed.data.slice(base+32,base+35),v=>outward(Math.fround(v+EPS),true))}});
 const lists=domains.map((domain,own)=>valid(domain)?guards.flatMap((b,k)=>k!==own&&overlap(domain,b)?[k]:[]):null),base=1+3*count,records=base+lists.reduce((n,list)=>n+(list?.length??0),0);
 if(records>MAX_NEIGHBOR_RECORDS)return null;
 const width=Math.min(256,2**Math.ceil(Math.log2(Math.sqrt(records)))),height=Math.ceil(records/width),data=new Float32Array(width*height*4);data.set([NEIGHBOR_MAGIC,token,count,records]);let cursor=base;
 for(let k=0;k<count;k++){const row=1+3*k,list=lists[k],domain=domains[k];data.set([list?cursor:-1,list?.length??0,k,token],4*row);if(valid(domain)){data.set(domain.min,4*(row+1));data.set(domain.max,4*(row+2));}if(list)for(const neighbor of list)data[4*cursor++]=neighbor+1;}
 return{data,width,height,token,primitiveCount:count,records,domains,guards,lists,neighborPairs:lists.reduce((n,list)=>n+(list?.length??count-1),0),fullNeighborPairs:count*(count-1)};
}
/** null restores original full list, including its original own-part skip. */
export function readApertureNeighbors(index,own,point,primitiveCount,{enabled=true,token=index?.token}={}){
 if(!enabled||!index||!(index.data instanceof Float32Array)||!integer(index.width,1,16384)||!integer(index.height,1,16384)||index.data.length!==index.width*index.height*4||!integer(own,0,primitiveCount-1)||!finite3(point))return null;
 const d=index.data,capacity=index.width*index.height,base=1+3*primitiveCount;
 if(d[0]!==NEIGHBOR_MAGIC||d[1]!==token||!integer(token,1,16777215)||d[2]!==primitiveCount||!integer(d[3],base,capacity))return null;
 const row=1+3*own,b=4*row,start=d[b],count=d[b+1],low=Array.from(d.slice(b+4,b+7)),high=Array.from(d.slice(b+8,b+11));
 if(d[b+2]!==own||d[b+3]!==token||!integer(start,base,d[3])||!integer(count,0,primitiveCount-1)||start+count>d[3]||!valid({min:low,max:high})||point.some((v,k)=>v<low[k]||v>high[k]))return null;
 if(count===primitiveCount-1)return null;
 const result=[];let previous=-1;for(let j=0;j<count;j++){const k=d[4*(start+j)]-1;if(!integer(k,0,primitiveCount-1)||k===own||k<=previous)return null;result.push(k);previous=k;}return result;
}
const ORIGINAL='bool apertureOutwardCovered(int own,vec3 point,vec3 normal,bool skipGlass,float skipObjectId){int count=int(apertureRecord(0).x);for(int k=0;k<count;k++){if(k==own)continue;AperturePart p=apertureLoad(k);if((skipGlass&&p.role==6.0)||p.objectId==skipObjectId||!apertureInBounds(p,point))continue;if(aperturePositiveNeighbour(apertureIntervals(p,point,normal)))return true;}return false;}';
const HELPERS=`
uniform highp sampler2D uApertureNeighbors;
uniform bool uApertureNeighborIndexEnabled,uApertureNeighborAabbFirst;
uniform int uApertureNeighborToken;
vec4 apertureNeighborRecord(int index){int width=textureSize(uApertureNeighbors,0).x;return texelFetch(uApertureNeighbors,ivec2(index%width,index/width),0);}
bool apertureNeighborInteger(float x,float lo,float hi){return x>=lo&&x<=hi&&floor(x)==x;}
ivec2 apertureNeighborRange(int own,vec3 point,int primitiveCount){
 if(!uApertureNeighborIndexEnabled||own<0||own>=primitiveCount)return ivec2(-1,primitiveCount);
 ivec2 size=textureSize(uApertureNeighbors,0);int capacity=size.x*size.y,base=1+3*primitiveCount;if(capacity<base)return ivec2(-1,primitiveCount);
 vec4 head=apertureNeighborRecord(0);float token=float(uApertureNeighborToken);
 if(head.x!=6721357.||head.y!=token||head.z!=float(primitiveCount)||!apertureNeighborInteger(token,1.,16777215.)||!apertureNeighborInteger(head.w,float(base),float(capacity)))return ivec2(-1,primitiveCount);
 int row=1+3*own;vec4 range=apertureNeighborRecord(row);vec3 low=apertureNeighborRecord(row+1).xyz,high=apertureNeighborRecord(row+2).xyz;
 if(range.z!=float(own)||range.w!=token||!apertureNeighborInteger(range.x,float(base),head.w)||!apertureNeighborInteger(range.y,0.,float(primitiveCount-1))||range.x+range.y>head.w||any(isnan(low))||any(isnan(high))||any(isinf(low))||any(isinf(high))||any(greaterThan(low,high))||!all(greaterThanEqual(point,low))||!all(lessThanEqual(point,high)))return ivec2(-1,primitiveCount);
 int start=int(range.x),count=int(range.y);if(count==primitiveCount-1)return ivec2(-1,primitiveCount);
 int previous=-1;for(int j=0;j<count;j++){float encoded=apertureNeighborRecord(start+j).x;if(!apertureNeighborInteger(encoded,1.,float(primitiveCount)))return ivec2(-1,primitiveCount);int k=int(encoded)-1;if(k==own||k<=previous)return ivec2(-1,primitiveCount);previous=k;}return ivec2(start,count);
}
bool apertureBoundsBeforeLoad(int k,vec3 point){int b=1+9*k;vec3 low=apertureRecord(b+7).xyz,high=apertureRecord(b+8).xyz;return all(greaterThanEqual(point,low-vec3(apertureEPS)))&&all(lessThanEqual(point,high+vec3(apertureEPS)));}
`;
const REPLACEMENT='bool apertureOutwardCovered(int own,vec3 point,vec3 normal,bool skipGlass,float skipObjectId){int count=int(apertureRecord(0).x);ivec2 range=apertureNeighborRange(own,point,count);int candidateCount=range.x<0?count:range.y;for(int j=0;j<candidateCount;j++){int k=range.x<0?j:int(apertureNeighborRecord(range.x+j).x)-1;if(k==own)continue;if(uApertureNeighborAabbFirst&&!apertureBoundsBeforeLoad(k,point))continue;AperturePart p=apertureLoad(k);if((skipGlass&&p.role==6.0)||p.objectId==skipObjectId||!apertureInBounds(p,point))continue;if(aperturePositiveNeighbour(apertureIntervals(p,point,normal)))return true;}return false;}';
export function withApertureNeighborIndex(source){if(source.split(ORIGINAL).length!==2)throw Error('Frozen aperture outward-cover contract changed');return source.replace(ORIGINAL,HELPERS+REPLACEMENT);}
