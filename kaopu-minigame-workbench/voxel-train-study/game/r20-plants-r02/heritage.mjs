import {TRACK,CONSIST_BOUNDS} from './metre-scale.mjs';
// Game-only derivative of the approved procedural builders. Classic source remains unchanged.
// Original buildTrain() is retained verbatim and verified against the approved mesh.
import * as THREE from '../../vendor/three.module.js';

// Original, procedural study geometry. No author mesh, texture or image is embedded.
export const SPEC = Object.freeze({ halfRun:7.93554791, radius:3.8, width:12.2, nearEdge:7.6, farEdge:-4.6, period:6, scale:1, phase:0 });
export const LENGTH = 4 * SPEC.halfRun + 2 * Math.PI * SPEC.radius;
export const PALETTE = Object.freeze({green:0x405f5c,greenDark:0x304c49,greenLight:0x54736d,orange:0xf5a014,steel:0x59616d,black:0x202427,grass:0x546233,gravel:0xc5c1aa});
function random(seed){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}

const cube=new THREE.BoxGeometry(1,1,1);
const cp=cube.attributes.position.array,cn=cube.attributes.normal.array,ci=cube.index.array;
class Blocks {
  constructor(){this.p=[];this.n=[];this.c=[];this.i=[];this.count=0;}
  surfaceBox(x,y,z,w,h,d,color,keep){
    const colorValue=new THREE.Color(color);
    for(let face=0;face<6;face++){const first=face*4,j=first*3,n=[cn[j],cn[j+1],cn[j+2]];if(!keep(n))continue;const base=this.p.length/3;for(let v=0;v<4;v++){const k=(first+v)*3;this.p.push(x+cp[k]*w,y+cp[k+1]*h,z+cp[k+2]*d);this.n.push(...n);this.c.push(colorValue.r,colorValue.g,colorValue.b);}for(let k=face*6;k<face*6+6;k++)this.i.push(base+ci[k]-first);}
  }
  box(x,y,z,w,h,d,color,rotation=0,openEnds=false){
    if(this.floraVoxels&&rotation===0&&w>.08&&w<.086&&Math.abs(w-h)<.001&&Math.abs(w-d)<.001){const q=.085,key=[x,y,z].map(v=>Math.round(v/q)).join(',');if(!this.floraVoxels.has(key))this.floraVoxels.set(key,{x,y,z,color});this.count++;return;}
    if(this.gameTerrain&&rotation===0&&y>.09&&y<.30&&h<.08&&w<1&&d<.3){this.surfaceBox(x,y,z,w,h,d,color,n=>n[1]>.9);this.count++;return;}
    const base=this.p.length/3,c=new THREE.Color(color),co=Math.cos(rotation),si=Math.sin(rotation);
    for(let j=0;j<cp.length;j+=3){const px=cp[j]*w,py=cp[j+1]*h;this.p.push(x+co*px-si*py,y+si*px+co*py,z+cp[j+2]*d);this.n.push(co*cn[j]-si*cn[j+1],si*cn[j]+co*cn[j+1],cn[j+2]);this.c.push(c.r,c.g,c.b);}
    for(let k=0;k<ci.length;k+=3){if(openEnds&&Math.abs(cn[ci[k]*3])>.9)continue;if(this.thinGround&&y<.4&&cn[ci[k]*3+1]<-.9)continue;this.i.push(base+ci[k],base+ci[k+1],base+ci[k+2]);}this.count++;
  }
  beam(x1,y1,z1,x2,y2,z2,size,color){
    const length=Math.hypot(x2-x1,y2-y1,z2-z1);
    if(length>.28){const n=Math.ceil(length/.24);for(let j=0;j<n;j++){const a=j/n,b=(j+1)/n;this.beam(x1+(x2-x1)*a,y1+(y2-y1)*a,z1+(z2-z1)*a,x1+(x2-x1)*b,y1+(y2-y1)*b,z1+(z2-z1)*b,size,color);}return;}
    const start=new THREE.Vector3(x1,y1,z1),end=new THREE.Vector3(x2,y2,z2),dir=end.clone().sub(start),q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),dir.clone().normalize());
    const base=this.p.length/3,c=new THREE.Color(color),center=start.add(end).multiplyScalar(.5);
    for(let j=0;j<cp.length;j+=3){const p=new THREE.Vector3(cp[j]*size,cp[j+1]*dir.length(),cp[j+2]*size).applyQuaternion(q).add(center),n=new THREE.Vector3(cn[j],cn[j+1],cn[j+2]).applyQuaternion(q);this.p.push(p.x,p.y,p.z);this.n.push(n.x,n.y,n.z);this.c.push(c.r,c.g,c.b);} for(const idx of ci)this.i.push(base+idx);this.count++;
  }
  geometry(){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(this.p,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(this.n,3));g.setAttribute('color',new THREE.Float32BufferAttribute(this.c,3));g.setIndex(this.i);g.computeBoundingSphere();return g;}
}
const FONT={
'W':['10101','10101','10101','10101','10101','11011','10001'],'E':['11111','10000','10000','11110','10000','10000','11111'],'S':['11111','10000','10000','11111','00001','00001','11111'],'T':['11111','00100','00100','00100','00100','00100','00100'],'R':['11110','10001','10001','11110','10100','10010','10001'],'N':['10001','11001','11001','10101','10011','10011','10001'],'P':['11110','10001','10001','11110','10000','10000','10000'],'A':['01110','10001','10001','11111','10001','10001','10001'],'C':['01111','10000','10000','10000','10000','10000','01111'],'I':['111','010','010','010','010','010','111'],'F':['11111','10000','10000','11110','10000','10000','10000'],'U':['10001','10001','10001','10001','10001','10001','01110'],'L':['10000','10000','10000','10000','10000','10000','11111'],'2':['11110','00001','00001','01110','10000','10000','11111'],'0':['01110','10001','10011','10101','11001','10001','01110'],'1':['010','110','010','010','010','010','111'],' ':['000','000','000','000','000','000','000']};
function letters(b,text,x,y,z,pixel,color){let u=x;for(const ch of text){const rows=FONT[ch]||FONT[' '];for(let row=0;row<7;row++)for(let col=0;col<rows[row].length;col++)if(rows[row][col]==='1')b.box(u+col*pixel,y-row*pixel,z,pixel*.94,pixel*.94,.024,color);u+=(rows[0].length+1)*pixel;}}
function tree(b,x,z,h=3.1,seed=11,crown=.66,vertical=.34){
  const rng=random(seed);b.box(x,h*.37,z,.17,h*.74,.18,0x56472a);
  for(const side of [-1,1])b.beam(x,h*.46,z,x+side*crown*.54,h*.72,z+side*.15,.095,0x544629);
  const leaves=[0x354321,0x475627,0x5e6d2e,0x718137,0x3b4c28],occupied=new Set(),q=.085;
  for(let i=0;i<2600;i++){
    const a=rng()*Math.PI*2,u=rng()*2-1,r=.7+.3*Math.cbrt(rng());
    const sideLobe=vertical>=.3&&i%5<2,lobeSide=i%2?1:-1,dx=Math.cos(a)*Math.sqrt(1-u*u)*r*crown*(sideLobe?.65:.9)+(sideLobe?lobeSide*crown*.38:0),dz=Math.sin(a)*Math.sqrt(1-u*u)*r*crown*.82,dy=u*r*h*(sideLobe?.19:vertical)+(sideLobe?-h*.24:0);
    const ix=Math.round(dx/q),iy=Math.round(dy/q),iz=Math.round(dz/q),key=ix+','+iy+','+iz;
    if(occupied.has(key))continue;occupied.add(key);
    b.box(x+ix*q,h*.8+iy*q,z+iz*q,q*.98,q*.98,q*.98,leaves[Math.floor(rng()*leaves.length)]);
  }
}

function bridge(b,x){const L=14.05576,H=CONSIST_BOUNDS.max[1]+.25+.08,panels=5;
  // R17 full-height envelope plus 250mm design clearance below the .16m top beams.
  // The source's apparent rear arch is the belt deformation of a straight truss.
  for(const z of [-1.95164,1.95164]){
    b.beam(x-L/2,H,z,x+L/2,H,z,.15,0x6f5b4b);
    for(let i=0;i<=panels;i++){const u=-L/2+i*L/panels;b.box(x+u,H/2,z,.12,H,.12,0x49443e);if(i<panels){const v=u+L/panels;const direction=i%2;b.beam(x+u,direction?H-.06:.2,z,x+v,direction?.2:H-.06,z,.085,0x514940);}}
  }
  for(let i=0;i<=panels;i++){const u=-L/2+i*L/panels;b.box(x+u,H,0,.17,.16,4.06328,0x866641);}
}
function buildEnvironment(spec=SPEC,options={}){const length=4*spec.halfRun+2*Math.PI*spec.radius;const rand=random(19790214),b=new Blocks(),p=PALETTE;b.thinGround=false;const start=-spec.halfRun,end=length-spec.halfRun;b.gameTerrain=!!options.optimizeGeometry;b.floraRanges=[];const flora=(x,z,build)=>{const first=b.p.length/3;if(options.optimizeGeometry)b.floraVoxels=new Map();build();if(b.floraVoxels){const voxels=b.floraVoxels,q=.085;for(const voxel of voxels.values()){const {x,y,z,color}=voxel;b.surfaceBox(x,y,z,q,q,q,color,n=>!voxels.has([x+n[0]*q,y+n[1]*q,z+n[2]*q].map(v=>Math.round(v/q)).join(',')));}b.floraVoxels=null;}b.floraRanges.push({first,count:b.p.length/3-first,x,z});};
  // One closed belt, discretized along its full arc-length; motion is a deformation of the same geometry.
  const segments=Math.ceil(length/.20),pitch=length/segments;
  for(let j=0;j<segments;j++){const x=start+(j+.5)*pitch;b.box(x,.015,1.5,pitch,.14,spec.width,p.grass,0,true);b.box(x,-.09,1.5,pitch,.065,spec.width,0x1c1e23,0,true);b.box(x,.13,0,pitch,.10,3.02,0xaba995,0,true);for(const z of [-TRACK.centerOffset,TRACK.centerOffset]){b.box(x,.245,z,pitch,.155,.13,0x625e53,0,true);b.box(x,.331,z,pitch,.035,.15,0x9d9a88,0,true);}}
  for(let x=start;x<end;x+=.64){b.box(x,.184,0,.23,.16,2.33,0x514839);for(const z of [-TRACK.centerOffset,TRACK.centerOffset])b.box(x,.277,z,.28,.03,.29,0x423e36);}
  for(let i=0;i<12500;i++){const x=start+rand()*length;let z=spec.farEdge+rand()*spec.width;if(Math.abs(z)<1.6){if(Math.abs(z)>.89||rand()>.65){const size=.035+rand()*.09;b.box(x,.22+rand()*.09,z,size,.025+rand()*.045,size,[0xcac8b0,0xa5a58f,0xe1ddc3,0x797e69,0xbab59b][Math.floor(rand()*5)]);}}else{const width=.03+rand()*.025;b.box(x,.104+rand()*.008,z,.04+rand()*.12,.012+rand()*.01,width,[0x64763a,0x77853e,0x414f2b,0x96a044,0x4a5931][Math.floor(rand()*5)]);}}
  // Long crop-like bands are visible on the original flat terrain module.
  for(let i=0;i<1900;i++){const x=start+rand()*length,z=spec.farEdge+rand()*spec.width;if(Math.abs(z)<1.75)continue;b.box(x,.11+rand()*.025,z,.15+rand()*.72,.018+rand()*.019,.025+rand()*.025,rand()>.52?0x809042:0x40562d);}
  for(const z of [2.75,3.55,4.55,5.55,6.5,7.1])for(let x=start;x<end;x+=.6){if(rand()<.24)continue;const band=Math.floor((x-start)/3.2),height=.032+.018*Math.sin(band*1.7+z);b.box(x,.105+height/2,z+(rand()-.5)*.08,.42+rand()*.24,height,.15+.08*Math.sin(z),z>5?0x4e632f:0x566c36);}
  for(let x=start;x<end;x+=1.07){b.box(x,.56,-3.01,.11,1.12,.11,0xc3c6b2);b.box(x,.99,-3.01,.17,.08,.17,0xd8d9c7);b.box(x+.53,.72,-3.01,1.06,.09,.076,0xc9cbb8);b.box(x+.53,.32,-3.01,1.06,.08,.075,0xb4b7a7);}
  // Two ground motifs per bridge period, as observed in the source loop.
  for(const offset of [0,length/2]){
    flora(-5.9+offset,-3.94,()=>tree(b,-5.9+offset,-3.94,2.9,23));flora(7.15+offset,-3.94,()=>tree(b,7.15+offset,-3.94,5.8,32,.95));flora(11.75+offset,options.platformCorridor?7.05:6.2,()=>tree(b,11.75+offset,options.platformCorridor?7.05:6.2,3.8,21,options.platformCorridor?.5:.85,.25));
    const rng=random(71),colors=[0x4b572a,0x647232,0x758039,0x3d4b27];
    flora(7.33+offset,options.platformCorridor?6.85:5.24,()=>{for(let i=0;i<1400;i++){const a=rng()*Math.PI*2,u=rng()*2-1,r=Math.cbrt(rng());const dx=Math.cos(a)*Math.sqrt(1-u*u)*r,dz=Math.sin(a)*Math.sqrt(1-u*u)*r,q=.085;b.box(7.33+offset+Math.round(dx*1.55/q)*q,.53+Math.round(u*r*.56/q)*q,(options.platformCorridor?6.85:5.24)+Math.round(dz*(options.platformCorridor?.6:1.1)/q)*q,q*.99,q*.99,q*.99,colors[Math.floor(rng()*colors.length)]);}});
    for(const [dx,z] of [[1.9,6.0],[11.94,4.1],[15.52,5.02]]){const x=dx+offset;b.box(x,.18,z,.73,.22,.53,0xa5aba3);b.box(x+.34,.14,z-.13,.47,.20,.38,0xb6bab0);b.box(x-.13,.28,z,.38,.16,.30,0xd2d4c3);}
  }
  if(options.includeBridge!==false)bridge(b,-7.715);return b;
}
export {Blocks,buildEnvironment,tree,bridge,letters};
