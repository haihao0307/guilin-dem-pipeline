// Original procedural station interiors. No external meshes, images or textures.
import * as THREE from '../vendor/three.module.js';
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
  b.box(0,.73,0,3.3,.18,2.1,0x8d8874);
  for(let i=0;i<12;i++)b.box(-1.51+i*.274,.812,0,.26,.016,2.0,i%3===0?0xb8ae8c:0xc9ba96);
  // Plinth and side cutaway walls retain the room's scale without hiding the tea.
  b.box(0,1.13,.98,3.2,.62,.12,plaster);
  b.box(-1.54,1.28,0,.12,.92,2.0,plaster);
  b.box(1.54,1.08,.30,.12,.52,1.4,plaster);
  for(const x of [-1.54,1.54])b.box(x,1.43,.98,.15,1.24,.17,trim);
  b.box(0,.90,.904,3.08,.12,.03,trim);
  b.box(-1.468,.90,0,.026,.12,1.92,trim);
  // Open back window with slender mullions and a projecting sill.
  const wx=staff?-.53:-.62,ww=staff?1.5:1.38;
  const left=wx-ww/2,right=wx+ww/2;
  const leftWidth=left+1.6,rightWidth=1.6-right;
  b.box(-1.6+leftWidth/2,2.045,.98,leftWidth,.99,.12,plaster);
  b.box(right+rightWidth/2,2.045,.98,rightWidth,.99,.12,plaster);
  b.box(0,2.575,.98,3.2,.2,.12,plaster);
  b.box(wx,1.56,.90,ww+.14,.085,.3,trim);
  b.box(wx,2.5,.955,ww+.16,.065,.17,trim);
  for(const x of [left,right])b.box(x,2.035,.955,.063,.9,.17,trim);
  b.box(wx,2.035,.965,.038,.9,.10,trim);
  if(!staff)b.box(wx,2.045,.965,ww,.037,.10,trim);
  // Front doorway is an open frame: a broad, unobstructed entrance to the bench.
  for(const x of [-1.55,1.55])b.box(x,1.73,-.97,.11,1.82,.12,trim);
  b.box(0,2.66,-.97,3.28,.12,.16,trim);
  for(const x of [-1.30,1.30])b.box(x,2.48,-.97,.49,.055,.105,trim,x<0?Math.PI/4:-Math.PI/4);
  // Only the rear roof slice is present, an intentional cutaway for top/front views.
  // Two pitched eaves, ridge and exposed rafters read as a building, not solid cubes.
  const roof=staff?0x665b4a:0x775f4c;
  for(const side of [-1,1]){
    appendGeometry(b,new THREE.BoxGeometry(1.83,.075,.66),roof,{
      position:[side*.79,2.91,.77],rotation:[0,0,-side*.255]
    });
    b.box(side*.80,2.93,-.97,1.68,.075,.095,trim,-side*.255);
    b.box(side*1.66,2.70,.145,.06,.08,1.91,roof);
  }
  b.box(0,3.125,.24,.12,.12,1.72,roof);
  b.box(0,2.66,.98,3.36,.105,.20,trim);
  // Tongue-and-groove lower timber panels distinguish the country staff nook.
  if(staff)for(let i=0;i<13;i++)b.box(-1.44+i*.24,1.20,.906,.026,.50,.026,wood);
  // Slatted, armrest-equipped bench lives to the left of the service table.
  bench(b,-.74,.52,1.30,wood,trim);
  const tx=.88,tz=staff?-.24:.04;
  for(const dx of [-.49,.49])for(const dz of [-.27,.27])b.box(tx+dx,1.145,tz+dz,.067,.65,.067,trim);
  b.box(tx,1.43,tz,1.15,.065,.68,wood);
  b.box(tx,1.34,tz-.25,1.04,.105,.052,trim);
  b.box(tx,1.02,tz,1.02,.055,.48,wood);
  // Back shelf, towel and two closed storage tins are quiet practical details.
  b.box(.93,1.99,.83,1.02,.05,.27,wood);
  b.box(1.22,1.29,tz-.32,.22,.36,.018,0xbebda3);
  b.box(.72,2.08,.83,.16,.13,.15,0x86745b);
  b.box(.99,2.075,.84,.15,.12,.15,0x536256);
  return {table:[tx,1.482,tz],wood,trim};
}

/** Station-local decorative room, with no simulation actors or audio. */
export function createStationRoom(plan={}, {variant}={}) {
  const selected=variant??(plan.index===0?'city-waiting-room':plan.index===5?'staff-tea-corner':null);
  if(selected&&!['city-waiting-room','staff-tea-corner'].includes(selected))throw new Error(`Unknown station room variant: ${selected}`);
  const group=new THREE.Group();
  group.name=selected==='staff-tea-corner'?'Station staff tea corner':'Station cutaway waiting room';
  group.position.set(...ROOM_ORIGIN);
  let disposed=false;
  const proof={enabled:!!selected,variant:selected,origin:[...ROOM_ORIGIN],floorY:FLOOR_Y,frontOpen:true,windowOpen:true,roofCutaway:true,triangles:0,drawCalls:0,teaItems:[],bounds:null};
  if(selected){
    const shell=new Blocks(),service=new Blocks(),staff=selected==='staff-tea-corner';
    const {table}=roomShell(shell,staff);
    teaService(service,shell,...table,staff);
    for(const [blocks,name,roughness,metalness] of [[shell,'Cutaway room, bench and tea table',.91,.015],[service,'Enamel kettle, two cups and water jug',.53,.11]]){
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
