import {buildSettlement,PARCELS} from '../input/r01/prototype/settlement.mjs';
export const BUILDING_STRIDE=8,FLOOR_STRIDE=2,BRIDGE_STRIDE=4;
export const MATERIALS=Object.freeze({plaster:1,brick:2,metal:3,wood:4,glass:5,stone:6});
const seed=s=>{let h=2166136261;for(const c of s)h=Math.imul(h^c.charCodeAt(0),16777619);return (h>>>0)/4294967295;};
/** Compact parameters, never meshes, implicit sample grids, individual bricks or stair instances. */
export function compileSettlementRecipe(year=50){
 const source=buildSettlement(year),B=source.buildings.length,F=source.buildings.reduce((s,b)=>s+b.floorElevationsM.length,0),R=source.routes.filter(r=>r.kind==='borrow'),K=R.length;
 const layout={header:4,buildingOffset:4,buildingStride:8,floorOffset:4+B*8,floorStride:2,bridgeOffset:4+B*8+F*2,bridgeStride:4};
 layout.stateOffset=layout.bridgeOffset+K*4;layout.stateCount=1+F+K;layout.doorOffset=layout.stateOffset+layout.stateCount;layout.doorCount=F;layout.vec4Count=layout.doorOffset+F;
 const packed=new Float32Array(layout.vec4Count*4),set=(i,a)=>packed.set(a,i*4),buildings=[],bridges=[];
 set(0,[20261011,B,F,K]);set(1,[layout.buildingOffset,layout.floorOffset,layout.bridgeOffset,layout.stateOffset]);set(2,[layout.doorOffset,F,year,12*3600]);set(3,[-38,38,-25,25]);set(layout.stateOffset,[1,0,0,0]);
 let fi=0;
 for(let bi=0;bi<B;bi++){
  const b=source.buildings[bi],p=PARCELS.find(p=>p.id===b.id),street=source.spaces.find(s=>s.id===b.id+'-street'),frontSign=Math.sign(street.positionM[2]-p.z),at=layout.buildingOffset+bi*8,n=b.floorElevationsM.length;
  const rec={id:b.id,index:bi,buildingId:bi+1,x:p.x,z:p.z,width:p.width,depth:p.depth,coreSide:p.coreSide,frontSign,groundRise:p.groundRise,rise:p.rise,top:b.topM,floors:n,floorStart:fi,coreWidth:2.7,landing:1.35,flightWidth:1.05,wall:.18,slab:.18,tread:.245,turnLanding:1.05,street:street.positionM,programme:p.programme};
  buildings.push(rec);
  set(at,[p.x,p.z,p.width,p.depth]);set(at+1,[p.groundRise,p.rise,n,b.topM]);set(at+2,[p.coreSide,frontSign,fi,bi+1]);set(at+3,[-1,-1,-1,-1]);set(at+4,[p.width-.3,-.12,fi,p.foundYear]);set(at+5,[2.7,1.35,1.05,.18]);set(at+6,[.18,.245,1.05,fi+n]);set(at+7,[0,0,0,0]);
  for(let f=0;f<n;f++,fi++){
   const y=b.floorElevationsM[f],h=f?p.rise:p.groundRise,e=source.events.find(e=>e.id===`${p.id}-event-${f}`),zoneCount=source.spaces.filter(s=>s.buildingId===p.id&&s.id.startsWith(`${p.id}-room-${f}`)&&(s.id===`${p.id}-room-${f}`||s.id.startsWith(`${p.id}-room-${f}-zone-`))).length;
   set(layout.floorOffset+fi*2,[y,h,zoneCount,e.tick]);set(layout.floorOffset+fi*2+1,[fi+1,fi,0,0]);set(layout.stateOffset+fi+1,[Math.max(0,year-e.tick)/50,seed(e.id),0,y]);set(layout.doorOffset+fi,[f===0?-Math.PI/2:Math.PI/2,Math.PI/2,Math.PI/2,Math.PI/2]);
  }
 }
 for(let i=0;i<K;i++){
  const r=R[i],aa=r.from.match(/^borrow-(B\d+)-(B\d+)/),a=buildings.find(b=>b.id===aa[1]),b=buildings.find(b=>b.id===aa[2]),f=r.crossesRail?3:2;
  const fa=source.buildings.find(x=>x.id===a.id).floorElevationsM[f],fb=source.buildings.find(x=>x.id===b.id).floorElevationsM[f];
  const local=(b,u,v,y)=>[b.x+b.coreSide*(b.width/2-u),y,b.z+b.frontSign*(b.depth/2-v)];
  const aw=r.crossesRail?2:(Math.sign(b.x-a.x)===a.coreSide?0:1),bw=r.crossesRail?2:(Math.sign(a.x-b.x)===b.coreSide?0:1),alongA=r.crossesRail?(a.coreWidth+a.width-a.wall)/2:.72,alongB=r.crossesRail?(b.coreWidth+b.width-b.wall)/2:.72;
  let pa=aw===2?local(a,alongA,0,fa):local(a,aw===0?0:a.width,alongA,fa),pb=bw===2?local(b,alongB,0,fb):local(b,bw===0?0:b.width,alongB,fb);
  const low=fa<=fb?pa:pb,high=fa<=fb?pb:pa,length=Math.hypot(high[0]-low[0],high[2]-low[2]),dy=high[1]-low[1],steps=dy<1e-5?0:Math.ceil(dy/.16);
  const bridge={id:r.id,index:i,a:a.id,b:b.id,aId:a.buildingId,bId:b.buildingId,floor:f,pa,pb,low,high,length,width:1.05,depth:.18,steps,stateId:F+1+i,crossesRail:!!r.crossesRail,gateId:r.gateId,endpointCorrection:'Landing-aligned facade ports replace centre-of-core endpoints; actual height mismatch has procedural treads.'};bridges.push(bridge);
  set(layout.bridgeOffset+i*4,[low[0],low[2],high[0],high[2]]);set(layout.bridgeOffset+i*4+1,[low[1],high[1],1.05,.18]);set(layout.bridgeOffset+i*4+2,[a.buildingId,b.buildingId,F+1+i,0]);set(layout.bridgeOffset+i*4+3,[Math.PI/2,length,steps,0]);set(layout.stateOffset+F+1+i,[(year-24)/50,seed(r.id),0,low[1]]);
  set(layout.buildingOffset+a.index*8+3,[i,f,aw,alongA]);set(layout.buildingOffset+b.index*8+3,[i,f,bw,alongB]);a.bridge={index:i,floor:f,wall:aw,along:alongA};b.bridge={index:i,floor:f,wall:bw,along:alongB};
 }
 return {version:'settlement-analytic-compiler-r02',packed,layout,buildings,bridges,year,counts:{buildings:B,floors:F,bridges:K,sourceGraphRoutes:source.routes.length},sourceRouteIds:source.routes.map(r=>r.id),rail:source.rail,corrections:[
 'Core landing positions are consistent on every floor; independent stairs no longer connect arbitrarily mirrored landing centres.',
 'Stair holes penetrate every upper slab and roof. Two opposing procedural flights and intermediate landings use true floor elevations.',
 'Borrow ports move to near-facade landing corridors instead of opening directly into mid-flight stairs. Differing floor levels create actual treads.',
 'Doors have physical openings, frames and rotating leaves. Graph gate permission alone does not rotate a closed gate.',
 'Roof service and rail geometry is bounded outside the conservative rail reservation; train swept envelope and steam remain external tests.'
 ]};
}
export function updateSnapshot(recipe,{hostSeconds,doorAngles={},gateAngles={}}={}){
 const {packed:p,layout:l}=recipe;if(Number.isFinite(hostSeconds)){p[2*4+3]=hostSeconds;const hour=((hostSeconds/3600)%24+24)%24;for(const b of recipe.bridges)p[(l.bridgeOffset+b.index*4+3)*4]=hour>=6&&hour<22?Math.PI/2:0;}
 for(const [key,v]of Object.entries(doorAngles)){const [building,floor,slot]=key.split(':');const b=recipe.buildings.find(b=>b.id===building);if(!b||!Number.isInteger(+floor)||+floor<0||+floor>=b.floors||+slot<0||+slot>3||!Number.isFinite(v))throw Error(`Invalid door angle ${key}`);p[(l.doorOffset+b.floorStart+(+floor))*4+(+slot)]=v;}
 for(const [key,v]of Object.entries(gateAngles)){const b=recipe.bridges.find(b=>b.id===key||b.gateId===key);if(!b||!Number.isFinite(v))throw Error(`Invalid gate angle ${key}`);p[(l.bridgeOffset+b.index*4+3)*4]=v;}
 return recipe;
}
export function localToWorld(b,[u,y,v]){return [b.x+b.coreSide*(b.width/2-u),y,b.z+b.frontSign*(b.depth/2-v)];}
export function floorY(b,f){return f?b.groundRise+(f-1)*b.rise:0;}
export function floorH(b,f){return f?b.rise:b.groundRise;}
