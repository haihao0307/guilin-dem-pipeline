import{terminalHallBounds}from'../kowloon-station-r04/native-terminal-hall.mjs';
import{stationWaterfrontCoverageBounds}from'../kowloon-station-r04/native-station-waterfront.mjs';
import{STATION_SCORE}from'../kowloon-station-r04/station-score.mjs';
// Source-audited domain enclosures, SI metres. These restrict GPU dispatch only;
// they never substitute for a surface/material query. See station-envelope-proof.
const box=(name,lo,hi)=>Object.freeze({name,lo:Object.freeze(lo),hi:Object.freeze(hi)});
const hall=terminalHallBounds(STATION_SCORE.hall);
export const STATION_COVERAGE_BOUNDS=Object.freeze([
 box('hall-domain',hall.min,hall.max),
 box('clock-tower-domain',[17.2,-2,-2.8],[30.8,48,10.8]),
 box('complete-shed-domain',[-36,-3,-149.2],[36,17,-5.8]),
 box('goods-domain',[32.5,-2.8,-103],[50.5,8.8,-13]),
 box('passenger-walk-domain',[28.5,-2.1,8.8],[69.5,7.1,17.2]),
 box('forecourt-floor',[-31.20021,-.30021,8.79979],[31.20021,.85021,14.80021]),
 box('entrance-steps',[-4.704,-.154,14.676],[4.704,.714,16.324]),
 box('approach-rails',[-25.822425,-.06025,-221],[25.822425,.0985,-145]),
 box('approach-timber',[-26.165274,-.250524,-221.555274],[26.165274,-.089976,-144.524726]),
 box('siding-rails',[49.177575,-.06025,-170],[50.822425,.0985,-12]),
 box('siding-timber',[48.834726,-.250524,-169.715274],[51.165274,-.089976,-12.044726]),
 box('approach-bearing-plates',[-25.842425,-.09025,-221.55],[25.842425,-.06025,-144.53]),
 box('siding-bearing-plates',[49.157575,-.09025,-169.71],[50.842425,-.06025,-12.05]),
 box('full-track-foundation',[-29.004,-.454,-221.004],[29.004,-.246,-9.996]),
 ...stationWaterfrontCoverageBounds({site:STATION_SCORE.site}).map(b=>box(b.name,b.min,b.max)),
 box('transfer-chords',[-10.15,9.155,-70.11],[30.15,10.945,-17.39]),
 box('transfer-diagonals',[-11.294,9.206,-70.044],[31.294,10.894,-17.456]),
 box('exit-apron-0',[11.149790,-.400210,-51.180931],[13.416156,.850325,-35.545119]),
 box('exit-apron-1',[11.149790,-.400210,-30.393931],[13.416156,.850325,-14.758119]),
]);
export const STATION_RAY_BOUNDS=box('station-ray',[-61,-4,-224],[85,49,30]);
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
export function stationDispatchCoverage(matrix,width,height,{tileSize=32,bounds=STATION_COVERAGE_BOUNDS}={}){
 if(matrix.length!==16||!matrix.every(Number.isFinite)||![width,height,tileSize].every(x=>Number.isInteger(x)&&x>0))throw Error('Invalid station coverage frame');
 const nx=Math.ceil(width/tileSize),ny=Math.ceil(height/tileSize),mask=new Uint8Array(nx*ny),projected=[];
 for(const b of bounds){const r=projectBoxPixels(b,matrix,width,height);if(!r)continue;projected.push({name:b.name,...r});for(let y=Math.floor(r.y/tileSize);y<Math.ceil((r.y+r.h)/tileSize);y++)for(let x=Math.floor(r.x/tileSize);x<Math.ceil((r.x+r.w)/tileSize);x++)mask[y*nx+x]=1;}
 const rects=[];let previous=new Map();for(let y=0;y<ny;y++){const next=new Map();for(let x=0;x<nx;){if(!mask[y*nx+x]){x++;continue;}const first=x;while(x<nx&&mask[y*nx+x])x++;const key=first+':'+x;let r=previous.get(key);if(r)r.h=Math.min(height,(y+1)*tileSize)-r.y;else{r={x:first*tileSize,y:y*tileSize,w:Math.min(width,x*tileSize)-first*tileSize,h:Math.min(tileSize,height-y*tileSize)};rects.push(r);}next.set(key,r);}previous=next;}
 const coveredPixels=rects.reduce((s,r)=>s+r.w*r.h,0);return{rects,projected,coveredPixels,totalPixels:width*height,coverageFraction:coveredPixels/(width*height),tileSize};
}
