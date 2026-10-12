export function enforceTrim(root,points,d){
 const w=zoneWeights(root),floor=w.sideburn>.80&&root[1]>.278?.278:w.nape>.90&&root[1]>.261?.261:null;
 if(floor===null)return;
 let hit=-1;for(let j=1;j<points.length;j++)if(points[j][1]<floor){hit=j;break;}
 if(hit<0)return;
 // Cut at the first crossing; never squash a tail onto a horizontal plane.
 const a=points[hit-1],b=points[hit],t=(a[1]-floor)/Math.max(1e-12,a[1]-b[1]);
 const kept=points.slice(0,hit).map(p=>p.slice());kept.push(a.map((v,k)=>mix(v,b[k],t)));
 const arc=[0];for(let j=1;j<kept.length;j++)arc.push(arc.at(-1)+Math.hypot(...kept[j].map((v,k)=>v-kept[j-1][k])));
 const length=arc.at(-1);if(length<1e-9)return;let k=1;
 for(let j=1;j<points.length;j++){const s=length*j/(points.length-1);while(k<arc.length-1&&arc[k]<s)k++;const u=(s-arc[k-1])/Math.max(1e-12,arc[k]-arc[k-1]);points[j]=kept[k-1].map((v,c)=>mix(v,kept[k][c],u));}
}
