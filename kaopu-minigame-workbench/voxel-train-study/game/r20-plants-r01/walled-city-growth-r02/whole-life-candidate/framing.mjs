/** Camera-only proposal. It never changes the world, cut geometry, navigation or age. */
const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),mul=(a,s)=>a.map(v=>v*s),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),unit=a=>mul(a,1/Math.hypot(...a)),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export function frameWholeBuildings(recipe,{ids=['B08','B09'],aspect=1.5,tanFov=.43,margin=.90,roofAllowanceM=2.4}={}){
 const selected=ids.map(id=>{const b=recipe.buildings.find(b=>b.id===id);if(!b)throw Error('Missing authoritative building '+id);return b;});
 const corners=selected.flatMap(b=>[b.x-b.width/2-1.25,b.x+b.width/2+1.25].flatMap(x=>[0,b.top+roofAllowanceM].flatMap(y=>[b.z-b.depth/2-1.25,b.z+b.depth/2+1.25].map(z=>[x,y,z]))));
 const lo=[0,1,2].map(i=>Math.min(...corners.map(p=>p[i]))),hi=[0,1,2].map(i=>Math.max(...corners.map(p=>p[i]))),target=mul(add(lo,hi),.5),back=unit([-.18,.12,-1]),fw=mul(back,-1),rt=unit(cross(fw,[0,1,0])),up=unit(cross(rt,fw));
 let distance=1;for(const p of corners){const q=sub(p,target),ax=Math.abs(dot(q,rt)),ay=Math.abs(dot(q,up)),depth=dot(q,fw);distance=Math.max(distance,ax/(tanFov*aspect*margin)-depth,ay/(tanFov*margin)-depth);}
 const eye=add(target,mul(back,distance)),ndc=corners.map(p=>{const q=sub(p,eye),z=dot(q,fw);return [dot(q,rt)/(z*tanFov*aspect),dot(q,up)/(z*tanFov)];});
 return {ids,sourceWorldId:recipe.worldId,camera:{eye,target,tanFov,cut:[0,0,1,1e6]},bounds:{lo,hi,roofAllowanceM,edgeAllowanceM:1.25,authoredAllowances:true},coverage:{allFoundationAndRoofBoundsInFrame:ndc.every(p=>p.every(x=>Math.abs(x)<=margin+1e-12)),maxAbsNdc:Math.max(...ndc.flat().map(Math.abs)),margin},notVerified:['real GPU view','occlusion by foreground buildings','life density and furniture quality','borrowed passage connection']};
}
