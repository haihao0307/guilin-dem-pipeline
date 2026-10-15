import {physicalObstacles,TRANSFER_ZONE} from './transport-layout.mjs';
// Slab intersection of a segment with an obstacle inflated by the actual cargo.
export function segmentHits(a,b,obstacle,half){let lo=0,hi=1;for(let k=0;k<3;k++){const min=obstacle.center[k]-obstacle.half[k]-half[k],max=obstacle.center[k]+obstacle.half[k]+half[k],d=b[k]-a[k];if(Math.abs(d)<1e-12){if(a[k]<min||a[k]>max)return false;}else{let p=(min-a[k])/d,q=(max-a[k])/d;if(p>q)[p,q]=[q,p];lo=Math.max(lo,p);hi=Math.min(hi,q);if(lo>hi)return false;}}return true;}
export function pathHits(path,obstacle,half){return path.slice(1).some((b,n)=>segmentHits(path[n],b,obstacle,half));}
export function cargoHalf(dimensions,mechanical=false){return[dimensions[2],dimensions[1],dimensions[0]].map(v=>v/2+(mechanical?0:.025));}
export function routeObstructions(path,half,state,{includeLock=true}={}){const obstacles=physicalObstacles(state.machine);if(includeLock&&state.machine?.trafficLock?.held)obstacles.push(TRANSFER_ZONE);return obstacles.filter(o=>pathHits(path,o,half)).map(o=>o.id);}
export function conflictsTransfer(path,half){return pathHits(path,TRANSFER_ZONE,half);}
