const once=(s,a,b)=>{if(s.split(a).length!==2)throw Error('Life material anchor: '+a);return s.replace(a,b);};
export function wholeLifeMaterialDomain(s){
 s=once(s,'fn woodCoordinates(h:GeoHit)->vec3<f32>{','fn woodCoordinates(h:GeoHit)->vec3<f32>{\n if(h.componentId>=4000000u&&h.componentId<4014336u){let member=(h.componentId-4000000u)%32u;return h.q+vec3<f32>(f32(h.objectId%17u)*.137,f32(member)*.014,0.);}')
 s=once(s,'fn woodNormal(h:GeoHit,n:vec3<f32>)->vec3<f32>{',`fn woodNormal(h:GeoHit,n:vec3<f32>)->vec3<f32>{
 if(h.componentId>=4000000u&&h.componentId<4014336u){let axes=geo_get(i32(geo_get(1).x)+(i32(h.buildingId)-1)*8+2);let localN=vec3<f32>(-n.x*axes.x,n.y,-n.z*axes.y);let member=(h.componentId-4000000u)%32u;if(member<4u){return localN.yxz;}if(member<6u){return localN.zyx;}return localN;}`);
 s=once(s,' if(h.materialId==5u){s=KpSurface',' if(h.materialId==7u){s=kpClothCoarseSurface(h.q.xz,footprint);spec=.6;}\n if(h.materialId==5u){s=KpSurface');
 s=once(s,' else if(h.materialId==6u){let a=stoneParameters(h);d-=', ' else if(h.materialId==7u){d-=kpClothCoarseSurface(h.q.xz,0.).height;}\n else if(h.materialId==6u){let a=stoneParameters(h);d-=');
 return s;
}
export function wholeLifeReceiver(s){return once(s,'let sh=prepared.w;let nl=',`let sh=prepared.w;
 if(h.materialId==7u){let axis=select(vec3<f32>(1.,0.,0.),vec3<f32>(0.,0.,1.),abs(n.x)>.85);let t=normalize(axis-n*dot(axis,n));let b=normalize(cross(n,t));let cp=kpClothCoarsePattern(h.q.xz,fp);let cm=kpClothCoarseParams();let base=kpClothCoarseBase(h.q.xz,cp);let ambient=base*(.04+sourceSky(h)*(.20+.16*max(n.y,0.)));let direct=kpClothCoarseLight(h.q.xz,fp,ld,vec3<f32>(1.25*sh),n,-rd,t,b);let transmission=base*max(dot(-n,ld),0.)*cm.trans*(.35+2.1*cp.gap*cm.open)*sh;return ambient+direct+transmission;}
 let nl=`);}
