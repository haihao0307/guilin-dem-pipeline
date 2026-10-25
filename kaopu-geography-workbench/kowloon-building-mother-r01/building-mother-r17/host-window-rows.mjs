/** Exact candidate scheduling only. Bounds and uncertainty guards can admit
 * extra windows; they never alter wall/window domains or stored pixel size. */
export function prepareHostWindowRows(packed){const out={...packed,data:packed.data.slice(),rowIndexVersion:1},d=out.data;let low=Infinity;for(let i=out.count-1;i>=0;i--){low=Math.min(low,d[i*20+13]);d[i*20+15]=low;}let high=-Infinity;for(let i=0;i<out.count;i++){high=Math.max(high,d[i*20+17]);d[i*20+19]=high;}return out;}
export function hostRowsSorted(packed){if(packed.rowIndexVersion!==1)return false;const d=packed.data;for(let i=0;i<packed.count;i++){const lo=d[i*20+15],hi=d[i*20+19];if(!Number.isFinite(lo)||!Number.isFinite(hi)||lo>hi)return false;if(i&&(lo<d[(i-1)*20+15]||hi<d[(i-1)*20+19]))return false;}return true;}
const ROWS=`
uniform bool uHostRowsEnabled;uniform vec3 uHostBoundsMin,uHostBoundsMax;
void hostSelectWindowRows(vec3 ro,vec3 rd,float nearest){
 hostWindowStart=0;hostWindowEnd=uHostWindowCount;if(!uHostRowsEnabled)return;
 vec2 span=hostBoxInterval(ro,rd,uHostBoundsMin,uHostBoundsMax);float first=max(0.,span.x),last=min(nearest,span.y);if(last<first){hostWindowEnd=0;return;}
 float y0=ro.y+rd.y*first,y1=ro.y+rd.y*last;
 float guard=apertureEPS+128.*0.00000011920928955078125*(1.+abs(ro.y)+abs(rd.y)*max(abs(first),abs(last)));
 float low=min(y0,y1)-guard,high=max(y0,y1)+guard;
 int a=0,b=uHostWindowCount;while(a<b){int m=(a+b)/2;if(hostRecord(m*5+4).w<low)a=m+1;else b=m;}hostWindowStart=a;
 a=hostWindowStart;b=uHostWindowCount;while(a<b){int m=(a+b)/2;if(hostRecord(m*5+3).w<=high)a=m+1;else b=m;}hostWindowEnd=a;
}
`;
export function withHostWindowRows(source){if(source.includes('hostSelectWindowRows('))throw Error('Host row index applied twice');let s=source.replace('int hostPrimitiveStart=0,hostPrimitiveEnd=0;','int hostPrimitiveStart=0,hostPrimitiveEnd=0;int hostWindowStart=0,hostWindowEnd=0;');if(s===source)throw Error('Host domain declaration missing');s=s.replaceAll('for(int i=0;i<uHostWindowCount;i++)','for(int i=hostWindowStart;i<hostWindowEnd;i++)');s=s.replace('face<6+4*uHostWindowCount','face<6+4*(hostWindowEnd-hostWindowStart)').replace('int i=(face-6)/4,j=(face-6)%4;','int i=hostWindowStart+(face-6)/4,j=(face-6)%4;');const marker='void hostPlane(';if(s.split(marker).length!==2)throw Error('Host boundary declaration missing');s=s.replace(marker,ROWS+'\n'+marker);const main='d=vec3(dot(rd,uHostU),dot(rd,uHostV),dot(rd,uHostN));';if(s.split(main).length!==2)throw Error('Host ray declaration missing');s=s.replace(main,main+'hostSelectWindowRows(ro,rd,outHit.x);');return s;}
