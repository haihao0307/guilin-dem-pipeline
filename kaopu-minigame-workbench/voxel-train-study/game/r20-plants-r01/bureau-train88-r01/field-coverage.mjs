// Bounds only gate ray dispatch, never replace the original building field.
const box=(name,lo,hi)=>Object.freeze({name,lo:Object.freeze(lo),hi:Object.freeze(hi)});
export const BUREAU_COVERAGE_BOUNDS=Object.freeze([box('whole-original-bureau-site',[-91,-.70,-76],[91,32,76])]);
export const BUREAU_RAY_BOUNDS=BUREAU_COVERAGE_BOUNDS[0];
export function projectBoxPixels(b,m,width,height,padding=2){
 const corners=[];for(const x of[b.lo[0],b.hi[0]])for(const y of[b.lo[1],b.hi[1]])for(const z of[b.lo[2],b.hi[2]])corners.push([m[0]*x+m[4]*y+m[8]*z+m[12],m[1]*x+m[5]*y+m[9]*z+m[13],m[2]*x+m[6]*y+m[10]*z+m[14],m[3]*x+m[7]*y+m[11]*z+m[15]]);
 if(corners.some(c=>c.some(x=>!Number.isFinite(x))))throw Error('Nonfinite projected station bound');
 // Frustum halfspaces are linear before division. Reject only if every corner
 // is outside the same plane. A bound crossing the eye gets full coverage.
 for(let a=0;a<3;a++)for(const sign of[-1,1])if(corners.every(c=>sign*c[a]>c[3]))return null;
 if(corners.some(c=>c[3]<=1e-7))return{x:0,y:0,w:width,h:height};
 const xs=corners.map(c=>(c[0]/c[3]*.5+.5)*width),ys=corners.map(c=>(c[1]/c[3]*.5+.5)*height);
 const x=Math.max(0,Math.floor(Math.min(...xs))-padding),y=Math.max(0,Math.floor(Math.min(...ys))-padding),right=Math.min(width,Math.ceil(Math.max(...xs))+padding),top=Math.min(height,Math.ceil(Math.max(...ys))+padding);
 return right>x&&top>y?{x,y,w:right-x,h:top-y}:null;
}
export function bureauDispatchCoverage(matrix,width,height,{tileSize=32,bounds=BUREAU_COVERAGE_BOUNDS}={}){
 if(matrix.length!==16||!matrix.every(Number.isFinite)||![width,height,tileSize].every(x=>Number.isInteger(x)&&x>0))throw Error('Invalid station coverage frame');
 const nx=Math.ceil(width/tileSize),ny=Math.ceil(height/tileSize),mask=new Uint8Array(nx*ny),projected=[];
 for(const b of bounds){const r=projectBoxPixels(b,matrix,width,height);if(!r)continue;projected.push({name:b.name,...r});for(let y=Math.floor(r.y/tileSize);y<Math.ceil((r.y+r.h)/tileSize);y++)for(let x=Math.floor(r.x/tileSize);x<Math.ceil((r.x+r.w)/tileSize);x++)mask[y*nx+x]=1;}
 const rects=[];let previous=new Map();for(let y=0;y<ny;y++){const next=new Map();for(let x=0;x<nx;){if(!mask[y*nx+x]){x++;continue;}const first=x;while(x<nx&&mask[y*nx+x])x++;const key=first+':'+x;let r=previous.get(key);if(r)r.h=Math.min(height,(y+1)*tileSize)-r.y;else{r={x:first*tileSize,y:y*tileSize,w:Math.min(width,x*tileSize)-first*tileSize,h:Math.min(tileSize,height-y*tileSize)};rects.push(r);}next.set(key,r);}previous=next;}
 const coveredPixels=rects.reduce((s,r)=>s+r.w*r.h,0);return{rects,projected,coveredPixels,totalPixels:width*height,coverageFraction:coveredPixels/(width*height),tileSize};
}
