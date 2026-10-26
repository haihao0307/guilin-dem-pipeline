// Display descriptors only: shared analytic capsule kernel, never a mesh.
import{roundTemplate,packStairRailDescriptors,ROUND_SHADOW_GLSL}from'../building-mother-workbench-r05/round-display.mjs';
export const ROUND_LIMIT=1024,GROUP_LIMIT=32;
export function groupRounds(rounds){
 if(rounds.length>ROUND_LIMIT)throw Error('Tower round-member display budget exceeded (1024), no truncation');
 const byFloor=new Map();for(const r of rounds){if(!Number.isInteger(r.objectId)||!Number.isFinite(r.radius)||r.radius<=0||Math.hypot(...r.end.map((v,k)=>v-r.start[k]))<=1e-9)throw Error('Invalid round descriptor');const key=r.floorId??null;if(!byFloor.has(key))byFloor.set(key,[]);byFloor.get(key).push(r);}
 const groups=[];for(const[floorId,list]of byFloor)for(let i=0;i<list.length;i+=64){const items=list.slice(i,i+64),template=roundTemplate(items);groups.push({floorId,items,template,packed:packStairRailDescriptors(template)});}
 if(groups.length>GROUP_LIMIT)throw Error('Tower round group budget exceeded (32), no truncation');
 const data=new Float32Array(Math.max(1,rounds.length)*32),bounds=new Float32Array(Math.max(1,groups.length)*8);let at=0;
 groups.forEach((g,i)=>{data.set(g.packed.data,at*32);bounds.set([...g.template.bounds.min,at,...g.template.bounds.max,g.items.length],i*8);at+=g.items.length;});
 return{groups,packed:{width:8,height:Math.max(1,rounds.length),data},bounds:{width:2,height:Math.max(1,groups.length),data:bounds}};
}
export const GROUP_SHADOW_GLSL=ROUND_SHADOW_GLSL.replace('uniform int uRoundCount;','uniform int uRoundCount;uniform highp sampler2D uRoundGroups;uniform int uRoundGroupCount;').replace('for(int i=0;i<64;i++){if(i>=uRoundCount)break;',`for(int group=0;group<32;group++){if(group>=uRoundGroupCount)break;vec4 mn=texelFetch(uRoundGroups,ivec2(0,group),0),mx=texelFetch(uRoundGroups,ivec2(1,group),0);if(!boxHit(ro,rd,mn.xyz,mx.xyz,limit))continue;for(int j0=0;j0<64;j0++){if(j0>=int(mx.w))break;int i=int(mn.w)+j0;`).replace('return true;}return false;}','return true;}}return false;}');
