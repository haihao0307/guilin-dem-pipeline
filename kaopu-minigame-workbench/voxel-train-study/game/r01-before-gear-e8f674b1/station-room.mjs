// Original procedural station interiors. No external meshes, images or textures.
import * as THREE from '../../vendor/three.module.js';
import {Blocks} from './heritage.mjs';

const ROOM_ORIGIN = Object.freeze([-22, 0, 6.55]);
const FLOOR_Y = .82;
const UP = new THREE.Vector3(0, 1, 0);

// Bake the few round silhouettes into the same vertex-colour batch as the cups.
// Temporary primitive geometries are disposed immediately after their data is copied.
function appendGeometry(batch, geometry, color, {position=[0,0,0], rotation=[0,0,0], scale=[1,1,1], quaternion=null}={}) {
  const matrix = new THREE.Matrix4().compose(
    new THREE.Vector3(...position),
    quaternion || new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)),
    new THREE.Vector3(...scale)
  );
  geometry.applyMatrix4(matrix);
  const p=geometry.attributes.position,n=geometry.attributes.normal,c=new THREE.Color(color),base=batch.p.length/3;
  for(let i=0;i<p.count;i++){
    batch.p.push(p.getX(i),p.getY(i),p.getZ(i));
    batch.n.push(n.getX(i),n.getY(i),n.getZ(i));
    batch.c.push(c.r,c.g,c.b);
  }
  const indices=geometry.index?.array;
  if(indices)for(const index of indices)batch.i.push(base+index);
  else for(let i=0;i<p.count;i++)batch.i.push(base+i);
  geometry.dispose();
}

function lathe(batch, profile, color, position, segments=12) {
  appendGeometry(batch,new THREE.LatheGeometry(profile.map(([r,y])=>new THREE.Vector2(r,y)),segments),color,{position});
}

function tubeBetween(batch, start, end, radius, color, topRadius=radius) {
  const a=new THREE.Vector3(...start),b=new THREE.Vector3(...end),delta=b.clone().sub(a);
  appendGeometry(batch,new THREE.CylinderGeometry(topRadius,radius,delta.length(),10,1),color,{
    position:a.add(b).multiplyScalar(.5).toArray(),quaternion:new THREE.Quaternion().setFromUnitVectors(UP,delta.normalize())
  });
}

function teaService(batch, shell, x, y, z, staff) {
  const enamel=staff?0xd8ddd0:0xe3dfc5,rim=0x3b6260,iron=0x353e38;
  // Low serving tray, raised rounded kettle, lid and a real loop handle.
  shell.box(x,y-.018,z,.93,.035,.46,0x8d774f);
  for(const edge of [-1,1])shell.box(x,y+.01,z+edge*.223,.93,.04,.022,0xb59a64);
  const kx=x-.14,kz=z+.02;
  lathe(batch,[[0,0],[.1,0],[.145,.04],[.154,.13],[.128,.21],[.074,.235],[0,.235]],enamel,[kx,y,kz]);
  lathe(batch,[[0,0],[.092,0],[.093,.018],[.073,.038],[0,.047]],rim,[kx,y+.228,kz]);
  appendGeometry(batch,new THREE.SphereGeometry(.029,8,4),iron,{position:[kx,y+.299,kz],scale:[1,.7,1]});
  appendGeometry(batch,new THREE.TorusGeometry(.135,.019,5,14,Math.PI*1.68),iron,{
    position:[kx-.104,y+.151,kz],rotation:[0,0,Math.PI*.16],scale:[.88,1,1]
  });
  tubeBetween(batch,[kx+.1,y+.105,kz],[kx+.205,y+.16,kz],.04,enamel,.03);
  tubeBetween(batch,[kx+.205,y+.16,kz],[kx+.255,y+.232,kz],.03,enamel,.024);
  // A dark open tip separates the spout from the pale kettle silhouette.
  appendGeometry(batch,new THREE.CylinderGeometry(.018,.018,.004,10),iron,{
    position:[kx+.257,y+.237,kz],rotation:[0,0,-.54]
  });
  // Hollow cups have an inner wall, dark tea surface, saucer and small loop handle.
  for(const [cx,cz] of [[x+.20,z-.10],[x+.34,z+.12]]){
    lathe(batch,[[0,0],[.085,0],[.087,.01],[.06,.02],[0,.02]],rim,[cx,y,cz],10);
    lathe(batch,[[0,.02],[.035,.02],[.055,.085],[.059,.105],[.049,.105],[.045,.086],[.028,.036],[0,.036]],enamel,[cx,y,cz],10);
    appendGeometry(batch,new THREE.CylinderGeometry(.045,.045,.004,10),0x6e4e2c,{position:[cx,y+.08,cz]});
    appendGeometry(batch,new THREE.TorusGeometry(.027,.009,4,10),rim,{position:[cx+.064,y+.066,cz],scale:[.8,1,1]});
  }
  // Tall enamel water jug, clearly separate from the smaller round kettle.
  const jx=x-.48,jz=z+.16;
  lathe(batch,[[0,0],[.082,0],[.10,.035],[.11,.245],[.084,.31],[.086,.335],[.074,.335],[.073,.30],[.068,.28]],enamel,[jx,y,jz],12);
  lathe(batch,[[.074,0],[.093,0],[.093,.016],[.074,.016]],rim,[jx,y+.326,jz],12);
  appendGeometry(batch,new THREE.TorusGeometry(.09,.014,5,12),rim,{position:[jx-.095,y+.175,jz],scale:[.73,1.18,1]});
  tubeBetween(batch,[jx+.066,y+.285,jz],[jx+.125,y+.324,jz],.03,enamel,.025);
}

function bench(b, x, z, width, wood, trim) {
  for(let i=0;i<4;i++)b.box(x,1.26,z-.22+i*.145,width,.072,.13,i%2?wood:trim);
  for(const side of [-1,1]){
    b.box(x+side*(width/2-.18),1.02,z,.085,.4,.42,trim);
    b.box(x+side*(width/2-.18),1.49,z+.27,.075,.59,.075,trim);
    b.box(x+side*(width/2-.08),1.46,z,.062,.34,.065,trim);
    b.box(x+side*(width/2-.08),1.65,z,.075,.07,.51,wood);
  }
  for(const h of [1.49,1.67])b.box(x,h,z+.28,width,.115,.062,wood);
}

function roomShell(b, staff) {
  const plaster=staff?0xb9b396:0xdfd2ae,trim=staff?0x5e6651:0x47675b,wood=staff?0x8c7250:0x92734b;
  for(const x of [-1.35,1.35])for(const z of [-.78,.78]){
    b.box(x,.34,z,.26,.60,.28,0x777869);
    b.box(x,.15,z,.36,.16,.38,0x858573);
  }
  // The slab stops below the floorboards: their visible tops are never coplanar.
  b.box(0,.718,0,3.3,.16,2.1,0x8d8874);
  for(let i=0;i<12;i++)b.box(-1.51+i*.274,.808,0,.26,.024,2.0,i%3===0?0xb8ae8c:0xc9ba96);
  // Complete side and rear walls surround generous real window openings.
  // Window trim projects beyond both wall faces instead of sharing their planes.
  b.box(0,1.08,.98,3.2,.52,.12,plaster);
  b.box(0,2.60,.98,3.2,.20,.12,plaster);
  for(const x of [-1.53,0,1.53])b.box(x,1.93,.98,x===0?.16:.14,1.18,.12,plaster);
  b.box(0,.90,.892,3.08,.12,.035,trim);
  for(const wx of [-.765,.765]){
    const width=1.34,half=width/2;
    b.box(wx,1.355,.97,width+.10,.075,.27,trim);
    b.box(wx,2.545,.97,width+.10,.075,.23,trim);
    for(const x of [wx-half,wx+half])b.box(x,1.950,.97,.06,1.110,.22,trim);
    // The tea-side opening stays clear; only the bench window has a mullion.
    if(wx<0){
      b.box(wx,1.950,.973,.034,1.110,.17,trim);
      if(!staff)b.box(wx,1.96,.982,width-.06,.035,.12,trim);
    }
  }
  for(const side of [-1,1]){
    const x=side*1.54;
    b.box(x,1.08,0,.12,.52,1.94,plaster);
    b.box(x,2.60,0,.12,.20,1.94,plaster);
    // Joined corner posts carry the entire roof; no deliberately removed wall.
    for(const z of [-.96,.96])b.box(x,1.735,z,.18,1.83,.18,trim);
    b.box(x,1.355,0,.23,.075,1.78,trim);
    b.box(x,2.545,0,.22,.075,1.78,trim);
    if(side<0)b.box(x,1.95,0,.16,1.11,.036,trim);
  }
  // A broad front doorway provides a practical entrance from the platform.
  for(const side of [-1,1])b.box(side*1.40,1.74,-.965,.28,1.84,.12,plaster);
  for(const x of [-1.55,1.55])b.box(x,1.73,-.97,.11,1.82,.12,trim);
  b.box(0,2.66,-.97,3.28,.12,.16,trim);
  for(const x of [-1.30,1.30])b.box(x,2.48,-.97,.49,.055,.105,trim,x<0?Math.PI/4:-Math.PI/4);
  // Two continuous slopes cover the complete room; the ridge closes their seam.
  const roof=staff?0x665b4a:0x775f4c;
  for(const side of [-1,1]){
    appendGeometry(b,new THREE.BoxGeometry(1.79,.09,2.19),roof,{
      position:[side*.83,2.91,.05],rotation:[0,0,-side*.255]
    });
    // Shallow roof courses give the intact roof a quiet period texture.
    for(const z of [-.87,-.47,-.07,.33,.73,1.11])b.box(side*.83,2.971,z,1.79,.025,.018,staff?0x736852:0x866e55,-side*.255);
    for(const z of [-1.0275,1.14])b.box(side*.83,2.907,z,1.81,.13,.035,trim,-side*.255);
    b.box(side*1.70,2.695,.05,.065,.09,2.20,roof);
  }
  b.box(0,3.166,.05,.12,.115,2.20,roof);
  b.box(0,2.66,.98,3.36,.105,.20,trim);
  // Tongue-and-groove lower timber panels distinguish the country staff nook.
  if(staff)for(let i=0;i<13;i++)b.box(-1.44+i*.24,1.12,.896,.026,.36,.026,wood);
  // Slatted, armrest-equipped bench lives to the left of the service table.
  bench(b,-.74,.52,1.30,wood,trim);
  const tx=.82,tz=staff?.32:.43;
  for(const dx of [-.49,.49])for(const dz of [-.27,.27])b.box(tx+dx,1.145,tz+dz,.067,.65,.067,trim);
  b.box(tx,1.43,tz,1.15,.065,.68,wood);
  b.box(tx,1.34,tz-.25,1.04,.105,.052,trim);
  b.box(tx,1.02,tz,1.02,.055,.48,wood);
  // A low service shelf leaves the window sightline to kettle and cups clear.
  b.box(.93,1.16,.83,1.02,.05,.27,wood);
  b.box(1.22,1.29,tz-.32,.22,.36,.018,0xbebda3);
  b.box(.72,1.25,.83,.16,.13,.15,0x86745b);
  b.box(.99,1.245,.84,.15,.12,.15,0x536256);
  return {table:[tx,1.482,tz],wood,trim};
}

/** Station-local decorative room, with no simulation actors or audio. */
export function createStationRoom(plan={}, {variant}={}) {
  const selected=variant??(plan.index===0?'city-waiting-room':plan.index===5?'staff-tea-corner':null);
  if(selected&&!['city-waiting-room','staff-tea-corner'].includes(selected))throw new Error(`Unknown station room variant: ${selected}`);
  const group=new THREE.Group();
  group.name=selected==='staff-tea-corner'?'Station staff tea corner':'Station waiting room';
  group.position.set(...ROOM_ORIGIN);
  let disposed=false;
  const proof={enabled:!!selected,variant:selected,origin:[...ROOM_ORIGIN],floorY:FLOOR_Y,frontOpen:true,windowOpen:true,roofCutaway:false,completeRoof:true,triangles:0,drawCalls:0,teaItems:[],bounds:null};
  if(selected){
    const shell=new Blocks(),service=new Blocks(),staff=selected==='staff-tea-corner';
    const {table}=roomShell(shell,staff);
    teaService(service,shell,...table,staff);
    for(const [blocks,name,roughness,metalness] of [[shell,'Complete roofed room, bench and tea table',.91,.015],[service,'Enamel kettle, two cups and water jug',.53,.11]]){
      const geometry=blocks.geometry(),material=new THREE.MeshStandardMaterial({vertexColors:true,roughness,metalness});
      const mesh=new THREE.Mesh(geometry,material);mesh.name=name;mesh.castShadow=mesh.receiveShadow=true;
      group.add(mesh);proof.triangles+=geometry.index.count/3;proof.drawCalls++;
    }
    proof.teaItems=['kettle','cup-1','cup-2','enamel-water-jug'];
    group.updateMatrixWorld(true);
    const bounds=new THREE.Box3().setFromObject(group);
    proof.bounds={min:bounds.min.toArray(),max:bounds.max.toArray()};
  }
  group.userData.stationRoom=proof;
  return {group,proof,dispose(){
    if(disposed)return;disposed=true;
    group.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});
    group.clear();
  }};
}
