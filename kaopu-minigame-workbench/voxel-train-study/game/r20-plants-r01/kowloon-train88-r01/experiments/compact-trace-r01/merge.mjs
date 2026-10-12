export const finiteA=a=>a.every(x=>Math.abs(x)<1e30);
export function projectFull(a,rawCount,overflow){return [a[0],a[1],rawCount,(overflow?1:0)+(finiteA(a)?0:2)];}
export function compactMerge(previous,a,raw,overflow){const count=previous[2]+raw,ov=(previous[3]&1)!==0||overflow||count>96;let next=previous.slice();if(a[0]<next[0]){next[0]=a[0];next[1]=a[1];next[3]=finiteA(a)?0:2;}next[2]=count;if(ov)next=[0,999,count,1];return next;}
export function fullMerge(previous,a,raw,overflow){const count=previous.raw+raw,ov=previous.overflow||overflow||count>96;let hit=previous.a;if(a[0]<hit[0])hit=a.slice();if(ov)hit=[0,999,0,0];return{a:hit,raw:count,overflow:ov};}
