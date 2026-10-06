import * as THREE from './vendor/three.module.js';

// Original, procedural study geometry. No author mesh, texture or image is embedded.
export const SPEC = Object.freeze({ halfRun:7.93554791, radius:3.8, width:12.2, nearEdge:7.6, farEdge:-4.6, period:6, scale:1, phase:0 });
export const LENGTH = 4 * SPEC.halfRun + 2 * Math.PI * SPEC.radius;
export const PALETTE = Object.freeze({green:0x405f5c,greenDark:0x304c49,greenLight:0x54736d,orange:0xf5a014,steel:0x59616d,black:0x202427,grass:0x546233,gravel:0xc5c1aa});
export function pathAt(distance, elevation=0, z=0) {
  const a=SPEC.halfRun,r=SPEC.radius,l=2*a,c=Math.PI*r;
  let s=((distance+a)%LENGTH+LENGTH)%LENGTH, x,y,tx,ty;
  if(s<l){x=s-a;y=0;tx=1;ty=0;}
  else if(s<l+c){const t=(s-l)/r;x=a+r*Math.sin(t);y=-r+r*Math.cos(t);tx=Math.cos(t);ty=-Math.sin(t);}
  else if(s<2*l+c){x=a-(s-l-c);y=-2*r;tx=-1;ty=0;}
  else{const t=(s-2*l-c)/r;x=-a-r*Math.sin(t);y=-r-r*Math.cos(t);tx=-Math.cos(t);ty=Math.sin(t);}
  return {position:[x-elevation*ty,y+elevation*tx,z],tangent:[tx,ty,0],normal:[-ty,tx,0]};
}
function random(seed){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}

const cube=new THREE.BoxGeometry(1,1,1);
const cp=cube.attributes.position.array,cn=cube.attributes.normal.array,ci=cube.index.array;
class Blocks {
  constructor(){this.p=[];this.n=[];this.c=[];this.i=[];this.count=0;}
  box(x,y,z,w,h,d,color,rotation=0,openEnds=false){
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
function steppedWheel(b,x,y,z,r=.39){const step=.105;for(let i=-4;i<=4;i++)for(let j=-4;j<=4;j++){const d=Math.hypot(i*step,j*step);if(d<r)b.box(x+i*step,y+j*step,z,step,step,.15,d<.15?0x4b5152:d>r-.12?0x353739:0x151c1d);}b.box(x,y,z+.09,.13,.13,.04,0x70746c);}
function bogie(b,x,length=1.68){for(const z of [-.78,.78]){b.box(x,.61,z,length,.39,.17,PALETTE.black);for(const dx of [-.55,.55])steppedWheel(b,x+dx,.48,z+(z>0?.12:-.12));for(let i=-3;i<=3;i++)b.box(x+i*.2,.7,z+Math.sign(z)*.1,.12,.09,.03,0x535550);}b.box(x,.79,0,length,.23,1.65,0x242b29);}
function buildTrain(){const b=new Blocks(),p=PALETTE;
  // Diesel underframe, fuel tank, truck sideframes and walkways.
  b.box(1.42,1.01,0,6.65,.25,2.08,p.green);b.box(1.18,.62,0,1.35,.65,1.13,0x202729);
  bogie(b,-.62);bogie(b,3.35);b.box(1.36,1.2,0,6.27,.17,1.92,p.greenLight);
  b.box(.48,1.955,0,3.63,1.43,1.35,p.green);b.box(.47,2.72,0,3.58,.14,1.4,p.greenLight);
  // Long-hood access panels, fine slit grilles and top cooling fans.
  for(const z of [-.686,.686]){
    for(let x=-1.16;x<1.55;x+=.45){b.box(x,1.64,z,.35,.57,.035,0x355f57);b.box(x+.14,1.8,z+Math.sign(z)*.035,.025,.14,.032,0x1d3835);}
    for(const x of [-1.1,-.23,1.1])for(let y=2.22;y<2.70;y+=.12)b.box(x,y,z+Math.sign(z)*.025,.6,.059,.03,0x17342f);
    letters(b,'WESTERN',-1.28,2.17,z+Math.sign(z)*.035,.06,p.orange);letters(b,'PACIFIC',-.48,1.70,z+Math.sign(z)*.035,.06,p.orange);
  }
  for(const x of [-1.06,.72]){b.box(x,2.79,0,.68,.17,.77,p.greenDark);for(let i=-3;i<=3;i++)for(let j=-3;j<=3;j++)if(i*i+j*j<12)b.box(x+i*.105,2.91,j*.105,.104,.1,.104,p.greenLight);for(let a=0;a<8;a++){const t=a*Math.PI/4;b.box(x+Math.cos(t)*.28,3.01,Math.sin(t)*.28,.09,.12,.09,p.greenDark);}}
  b.box(-.17,2.82,0,.47,.28,.44,p.green);b.box(-.17,2.99,0,.52,.08,.49,p.greenLight);
  // Cab and characteristic stepped slate roof, high short nose.
  b.box(2.12,2.04,0,1.24,1.62,1.79,p.green);b.box(3.47,2.22,0,1.51,1.98,1.52,p.green);
  for(let j=0;j<10;j++){const z=(j-4.5)*.198,height=2.88+.36*Math.sqrt(Math.max(0,1-(z/1.01)**2));b.box(2.12,height,z,1.54,.10,.201,p.steel);}
  for(const z of [-.913,.913]){for(const x of [1.75,2.12]){b.box(x,2.41,z,.32,.62,.05,0xc7c6ad);b.box(x,2.43,z+Math.sign(z)*.03,.22,.50,.045,0x46575a);b.box(x,2.46,z+Math.sign(z)*.055,.021,.50,.02,0xdbd5ba);}b.box(2.62,2.33,z,.17,.77,.035,0xcdcfb9);letters(b,'2001',2.91,2.97,Math.sign(z)*.773,.057,0xe3e3cf);}
  // Front's orange stair-step diagonal banding is modeled, not a texture.
  for(let iz=0;iz<13;iz++){const z=(iz-6)*.12;for(let band=-3;band<6;band++){const y=1.2+band*.43+iz*.095;if(y>1.3&&y<3.2)b.box(4.236,y,z,.043,.15,.119,p.orange);}}
  b.box(4.34,2.69,0,.23,.44,.53,p.greenDark);b.box(4.47,2.69,0,.026,.27,.31,0xf9f4c1);
  b.box(4.52,1.14,0,.53,.19,1.98,p.green);b.box(4.7,.65,0,.18,.5,1.38,0x283c39);b.box(4.96,.61,0,.59,.15,.18,0x414444);
  for(const z of [-.79,.79])for(let i=0;i<4;i++){b.box(4.14+i*.19,.48+i*.18,z,.29,.08,.42,p.green);b.box(4.26+i*.19,.51+i*.18,z,.035,.039,.42,p.orange);}
  // Thin handrails with bright end railings.
  for(const z of [-1,1]){for(let x=-1.62;x<=4.46;x+=.51)b.box(x,1.66,z,.055,1.02,.055,x>3.6?p.orange:p.greenLight);b.box(1.1,2.18,z,5.46,.055,.055,p.greenLight);b.box(4.28,2.05,z,.66,.055,.055,p.orange);}
  for(const x of [-1.79,4.74]){for(const z of [-.94,-.36,.36,.94])b.box(x,1.65,z,.061,1.06,.06,p.orange);b.box(x,2.19,0,.06,.06,1.94,p.orange);}
  // Cylindrical FUEL tank built from a rectangular voxel grid.
  const tx=-4.895,cy=2.0,rad=.835,step=.129,length=5.6,nr=Math.floor(rad/step);
  b.box(tx,1.03,0,length+.28,.23,1.9,0x2b4240);bogie(b,-6.93,1.24);bogie(b,-2.83,1.24);
  for(let iy=-nr;iy<=nr;iy++)for(let iz=-nr;iz<=nr;iz++){if(Math.hypot(iy*step,iz*step)>rad)continue;const edge=Math.hypot(iy*step,iz*step)>rad-step*1.5;if(edge)b.box(tx,cy+iy*step,iz*step,length,step,step,iy>3?0x567974:p.green);else{b.box(tx-length/2+.064,cy+iy*step,iz*step,step,step,step,p.green);b.box(tx+length/2-.064,cy+iy*step,iz*step,step,step,step,p.green);}}
  for(let iz=-nr;iz<=nr;iz++){const z=iz*step,dy=Math.sqrt(Math.max(0,rad*rad-z*z));b.box(tx+length/2+.018,cy+dy,z,.06,.078,.13,0xe2e9bd);if(dy>.12)b.box(tx+length/2+.026,cy+dy-.085,z,.045,.08,.127,0xa8c196);}
  for(const x of [tx-length/2+.42,tx+length/2-.42])for(let iz=-nr;iz<=nr;iz++){const z=iz*step;const dy=Math.sqrt(Math.max(0,rad*rad-z*z));b.box(x,cy+dy,z,.07,.059,.12,0x57847b);b.box(x,cy-dy,z,.07,.059,.12,0x284b47);}
  for(const z of [-.858,.858]){b.box(tx,1.86,z,length,.05,.035,0xc7cbb8);letters(b,'FUEL',tx-.45,2.50,z,.112,0xe5e7ce);}
  b.box(tx,2.89,0,.63,.17,.66,p.greenLight);b.box(tx,3.02,0,.47,.12,.5,p.green);
  for(const z of [-.62,.62]){b.box(tx,3.42,z,1.28,.052,.052,0x252e30);for(const x of [tx-.62,tx+.62])b.box(x,3.14,z,.052,.6,.052,0x252e30);}
  for(const x of [tx-.62,tx+.62])b.box(x,3.42,0,.052,.052,1.3,0x252e30);
  for(const z of [-.925,.925]){for(const x of [tx-.28,tx+.28])b.box(x,1.80,z,.045,2.14,.055,0x2c3331);for(let y=.8;y<2.96;y+=.2)b.box(tx,y,z,.56,.043,.043,0x2c3331);}
  b.box(-1.95,1.03,0,.7,.12,.2,0x292d2a);
  return b;
}
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

function bridge(b,x){const L=14.05576,H=4.33704,panels=5;
  // The source's apparent rear arch is the belt deformation of a straight truss.
  for(const z of [-1.95164,1.95164]){
    b.beam(x-L/2,H,z,x+L/2,H,z,.15,0x6f5b4b);
    for(let i=0;i<=panels;i++){const u=-L/2+i*L/panels;b.box(x+u,H/2,z,.12,H,.12,0x49443e);if(i<panels){const v=u+L/panels;const direction=i%2;b.beam(x+u,direction?H-.06:.2,z,x+v,direction?.2:H-.06,z,.085,0x514940);}}
  }
  for(let i=0;i<=panels;i++){const u=-L/2+i*L/panels;b.box(x+u,H,0,.17,.16,4.06328,0x866641);}
}
function buildEnvironment(){const rand=random(19790214),b=new Blocks(),p=PALETTE;b.thinGround=false;const start=-SPEC.halfRun,end=LENGTH-SPEC.halfRun;
  // One closed belt, discretized along its full arc-length; motion is a deformation of the same geometry.
  const segments=Math.ceil(LENGTH/.20),pitch=LENGTH/segments;
  for(let j=0;j<segments;j++){const x=start+(j+.5)*pitch;b.box(x,.015,1.5,pitch,.14,SPEC.width,p.grass,0,true);b.box(x,-.09,1.5,pitch,.065,SPEC.width,0x1c1e23,0,true);b.box(x,.13,0,pitch,.10,3.02,0xaba995,0,true);for(const z of [-.76,.76]){b.box(x,.245,z,pitch,.155,.13,0x625e53,0,true);b.box(x,.331,z,pitch,.035,.15,0x9d9a88,0,true);}}
  for(let x=start;x<end;x+=.64){b.box(x,.184,0,.23,.16,2.33,0x514839);for(const z of [-.76,.76])b.box(x,.277,z,.28,.03,.29,0x423e36);}
  for(let i=0;i<12500;i++){const x=start+rand()*LENGTH;let z=SPEC.farEdge+rand()*SPEC.width;if(Math.abs(z)<1.6){if(Math.abs(z)>.89||rand()>.65){const size=.035+rand()*.09;b.box(x,.22+rand()*.09,z,size,.025+rand()*.045,size,[0xcac8b0,0xa5a58f,0xe1ddc3,0x797e69,0xbab59b][Math.floor(rand()*5)]);}}else{const width=.03+rand()*.025;b.box(x,.104+rand()*.008,z,.04+rand()*.12,.012+rand()*.01,width,[0x64763a,0x77853e,0x414f2b,0x96a044,0x4a5931][Math.floor(rand()*5)]);}}
  // Long crop-like bands are visible on the original flat terrain module.
  for(let i=0;i<1900;i++){const x=start+rand()*LENGTH,z=SPEC.farEdge+rand()*SPEC.width;if(Math.abs(z)<1.75)continue;b.box(x,.11+rand()*.025,z,.15+rand()*.72,.018+rand()*.019,.025+rand()*.025,rand()>.52?0x809042:0x40562d);}
  for(const z of [2.75,3.55,4.55,5.55,6.5,7.1])for(let x=start;x<end;x+=.6){if(rand()<.24)continue;const band=Math.floor((x-start)/3.2),height=.032+.018*Math.sin(band*1.7+z);b.box(x,.105+height/2,z+(rand()-.5)*.08,.42+rand()*.24,height,.15+.08*Math.sin(z),z>5?0x4e632f:0x566c36);}
  for(let x=start;x<end;x+=1.07){b.box(x,.56,-3.01,.11,1.12,.11,0xc3c6b2);b.box(x,.99,-3.01,.17,.08,.17,0xd8d9c7);b.box(x+.53,.72,-3.01,1.06,.09,.076,0xc9cbb8);b.box(x+.53,.32,-3.01,1.06,.08,.075,0xb4b7a7);}
  // Two ground motifs per bridge period, as observed in the source loop.
  for(const offset of [0,LENGTH/2]){
    tree(b,-5.9+offset,-3.94,2.9,23);tree(b,7.15+offset,-3.94,5.8,32,.95);tree(b,11.75+offset,6.2,3.8,21,.85,.25);
    const rng=random(71),colors=[0x4b572a,0x647232,0x758039,0x3d4b27];
    for(let i=0;i<1400;i++){const a=rng()*Math.PI*2,u=rng()*2-1,r=Math.cbrt(rng());const dx=Math.cos(a)*Math.sqrt(1-u*u)*r,dz=Math.sin(a)*Math.sqrt(1-u*u)*r,q=.085;b.box(7.33+offset+Math.round(dx*1.55/q)*q,.53+Math.round(u*r*.56/q)*q,5.24+Math.round(dz*1.1/q)*q,q*.99,q*.99,q*.99,colors[Math.floor(rng()*colors.length)]);}
    for(const [dx,z] of [[1.9,6.0],[11.94,4.1],[15.52,5.02]]){const x=dx+offset;b.box(x,.18,z,.73,.22,.53,0xa5aba3);b.box(x+.34,.14,z-.13,.47,.20,.38,0xb6bab0);b.box(x-.13,.28,z,.38,.16,.30,0xd2d4c3);}
  }
  bridge(b,-7.715);return b;
}
const BEND_GLSL=`
uniform float beltPhase;
vec4 beltFrame(float xx) {
  float a=${SPEC.halfRun.toFixed(6)}, r=${SPEC.radius.toFixed(6)}, l=2.0*a, c=3.141592653589793*r;
  float s=mod(xx+beltPhase+a,2.0*l+2.0*c);
  if(s<l) return vec4(s-a,0.0,1.0,0.0);
  if(s<l+c){float t=(s-l)/r;return vec4(a+r*sin(t),-r+r*cos(t),cos(t),-sin(t));}
  if(s<2.0*l+c)return vec4(a-(s-l-c),-2.0*r,-1.0,0.0);
  float t=(s-2.0*l-c)/r;return vec4(-a-r*sin(t),-r-r*cos(t),-cos(t),sin(t));
}
vec3 beltPosition(vec3 pos){vec4 f=beltFrame(pos.x);return vec3(f.x-pos.y*f.w,f.y+pos.y*f.z,pos.z);}
vec3 beltNormal(vec3 pos,vec3 norm){vec4 f=beltFrame(pos.x);return vec3(norm.x*f.z-norm.y*f.w,norm.x*f.w+norm.y*f.z,norm.z);}
`;
function bentMaterial(material,phase){material.onBeforeCompile=shader=>{shader.uniforms.beltPhase=phase;shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\n'+BEND_GLSL).replace('#include <beginnormal_vertex>','#include <beginnormal_vertex>\nobjectNormal = beltNormal(position, objectNormal);').replace('#include <begin_vertex>','vec3 transformed = beltPosition(position);');};material.customProgramCacheKey=()=> 'kaopu-train-bend-v1';return material;}
export function createSceneModel(){const trainBlocks=buildTrain(),environmentBlocks=buildEnvironment();const root=new THREE.Group();root.name='Procedural voxel train study';const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.79,metalness:.14});const train=new THREE.Mesh(trainBlocks.geometry(),material);train.name='Diesel locomotive and FUEL tank';train.castShadow=train.receiveShadow=true;root.add(train);
  const phase={value:0};const environment=new THREE.Mesh(environmentBlocks.geometry(),bentMaterial(new THREE.MeshStandardMaterial({vertexColors:true,roughness:.96,metalness:.02}),phase));environment.name='Continuously deformed closed terrain belt';environment.castShadow=environment.receiveShadow=true;environment.frustumCulled=false;environment.customDepthMaterial=bentMaterial(new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking}),phase);root.add(environment);
  return {root,train,environment,phase,stats:{trainBlocks:trainBlocks.count,environmentBlocks:environmentBlocks.count,vertices:train.geometry.attributes.position.count+environment.geometry.attributes.position.count},setTime(seconds){phase.value=-seconds*LENGTH/SPEC.period;},dispose(){for(const mesh of [train,environment]){mesh.geometry.dispose();mesh.material.dispose();mesh.customDepthMaterial?.dispose();}}};
}
