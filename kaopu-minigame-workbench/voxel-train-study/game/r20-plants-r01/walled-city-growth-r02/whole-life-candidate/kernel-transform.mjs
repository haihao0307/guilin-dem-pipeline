import {LIFE_FUNCTIONS} from './life-functions.mjs';
/** Same scalar specification is generated to CPU and WGSL. Frozen prior kernel untouched. */
const once=(s,a,b)=>{if(s.split(a).length!==2)throw Error('Life anchor changed: '+a.slice(0,100));return s.replace(a,b);};
export function wholeLifeScalarSource(source){let s=source;
 s=once(s,"fn('geoFabric'",LIFE_FUNCTIONS.replaceAll('\\`','`')+"\nfn('geoFabric'");
 s=once(s,"fn('geoObjectId','componentId:u32','u32',`","fn('geoObjectId','componentId:u32','u32',`\n if(componentId>=4000000u&&componentId<4014336u){return 100000u+u32(floor(f32(componentId-4000000u)/32.0));}");
 s=once(s,'var f0=0;if(y>=b.x)', 'var publicFront=geo_get(off+7).w==2.0;var f0=0;if(y>=b.x)');
 // This wall partitions the public strip from the first private room on the borrowed level.
 s=once(s,'  for(var j=1;j<zones;j=j+1){',`  if(publicFront&&hasBorrow){var pu=vec4f(roomMid,0.0,1.02,2.1);h=geo_panel(h,u,y,v,1,1.44,(cw+W-wt)*0.5,W-wt-cw,by,fh,0.18,pu,empty,bid,cid+12u,sid);h=geo_port(h,u,y,v,1,1.44,roomMid,by,1.02,2.1,0.0,1,doors.z,bid,cid+58u,sid);}
  for(var j=1;j<zones;j=j+1){`);
 s=once(s,'  if(f==0){h=geo_cube(h,u-ent.x',`  var life=geo_get(sg+5);if(f==i32(life.x)&&life.y>0.0){h=geo_cube(h,u-life.y,y-by-fh*0.5,v-1.68,life.z*0.5,fh*0.5,1.68,1u,bid,cid+19u,sid);}
  if(f==0){h=geo_cube(h,u-ent.x`);
 const oldBed="if(kind==1){h=geo_cube(h,u-x,y-base-0.32,v-z,0.43,0.08,0.95,4u,bid,c,sid);h=geo_cube(h,u-x,y-base-0.62,v-z+0.94,0.43,0.38,0.035,4u,bid,c,sid);}";
 const bed="if(kind==1){var object=100000u+u32(rule.x)*32u+u32(localIndex)*4u+u32(k);h=life_bed(h,u-x,y-base,v-z,bid,4000000u+(object-100000u)*32u,sid);}";
 s=once(s,oldBed,bed);
 s=once(s,"else if(kind==4){h=geo_cube", "else if(kind==7){var object=100000u+u32(rule.x)*32u+u32(localIndex)*4u+u32(k);h=life_water(h,u-x,y-base,v-z,bid,4000000u+(object-100000u)*32u,sid);}\n  else if(kind==4){h=geo_cube");
 s=once(s,'var nr=i32(ceil(fh/0.18));var na=i32(ceil(f32(nr)*0.5));','var stairCounts=geo_get(i32(head.y)+fi*2+1);var nr=i32(stairCounts.z);var na=i32(stairCounts.w);');
 s=once(s,'var nr=i32(ceil(fh/0.18));var na=i32(floor(f32(nr+1)*0.5));','var stairCounts=geo_get(i32(head.y)+fi*2+1);var nr=i32(stairCounts.z);var na=i32(stairCounts.w);');
 // Walls stop at the underside of the next slab. Their former coincident top
 // surface could win the material query over the actual load-bearing floor.
 if(s.split('by,fh,').length!==12)throw Error('Expected eleven wall-panel clear-height sites');
 s=s.replaceAll('by,fh,','by,fh-slab,');
 s=s.replaceAll('y-by-fh*0.5,v-1.68','y-by-(fh-slab)*0.5,v-1.68').replaceAll('fh*0.5,1.68,1u','(fh-slab)*0.5,1.68,1u');
 return s;
}
