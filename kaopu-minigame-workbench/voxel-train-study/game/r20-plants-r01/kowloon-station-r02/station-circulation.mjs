// Public circulation is a deterministic view of the one host Session clock.
// Routes use real rail-side arcade openings and the terminal cross-concourse.
export function stationCirculation(plan,count=28){
 const paths=[];
 for(let i=0;i<count;i++){
  const pf=plan.platforms[1+i%2],edge=i%2?pf.bounds.min[2]+1:pf.bounds.max[2]-1,step=(plan.hall.max[2]-plan.hall.min[2])/8,doorZ=plan.hall.min[2]+(Math.floor((pf.centerZ-plan.hall.min[2])/step)+.5)*step;
  paths.push({id:'station-walker-'+i,appearance:i%12,kind:'walking',frame:'station',pose:'walking',age:0,walk:0,lastThrow:-100,position:[0,1.1,0],floorY:1.1,route:[[22,1.1,plan.hall.max[2]-2],[22,1.1,doorZ],[10.8,1.1,doorZ],[10.8,1.1,edge],[8,1.1,edge],[-66+(i%6)*7,1.1,edge]],offset:i*2.63});
 }
 return paths;
}
export function sampleStationPath(route,d){
 const segments=route.slice(1).map((p,i)=>Math.hypot(...p.map((v,j)=>v-route[i][j]))),length=segments.reduce((a,b)=>a+b,0),q=((d%(2*length))+2*length)%(2*length),back=q>length;
 let left=back?2*length-q:q;
 for(let i=0;i<segments.length;i++){if(left<=segments[i]){const t=left/segments[i],a=route[i],b=route[i+1];return{position:a.map((v,j)=>v+(b[j]-v)*t),heading:Math.atan2((back?-1:1)*(b[2]-a[2]),(back?-1:1)*(b[0]-a[0]))};}left-=segments[i];}
 return{position:route.at(-1),heading:0};
}
