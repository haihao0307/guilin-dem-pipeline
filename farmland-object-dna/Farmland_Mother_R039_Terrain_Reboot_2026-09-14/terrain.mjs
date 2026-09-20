import * as THREE from 'three';
const S=window.R39S,{mobile,scene,MAT,mesh,R}=S;
const {clamp,mix,sm,hash,noise,ridged,rng,geomDetail,fineDetail,mountains,mountainField,baseNatural,terraceMask,terraceInfoFromNatural,gx,gz,nodes,flatFields,pointInPoly,flatFieldAt,riverZ,sourcePath,mainCanal,branchA,branchB,branchC,plainCanal,dseg,polyProjection,dpoly,terrainNoCuts,channelSpecs,channelSurface,terrainY}=window.W;
// Single continuous terrain.
const EXT={xmin:-220,xmax:220,zmin:-290,zmax:185,step:mobile?2.2:1.75};const sx=Math.round((EXT.xmax-EXT.xmin)/EXT.step),sz=Math.round((EXT.zmax-EXT.zmin)/EXT.step);const tg=new THREE.PlaneGeometry(EXT.xmax-EXT.xmin,EXT.zmax-EXT.zmin,sx,sz);tg.rotateX(-Math.PI/2);tg.translate((EXT.xmin+EXT.xmax)/2,0,(EXT.zmin+EXT.zmax)/2);const tp=tg.attributes.position,vc=new Float32Array(tp.count*3),C=new THREE.Color();for(let i=0;i<tp.count;i++){const x=tp.getX(i),z=tp.getZ(i),y=terrainY(x,z);tp.setY(i,y);const nat=baseNatural(x,z),tm=terraceMask(x,z),ff=flatFieldAt(x,z),fine=fineDetail(x,z);if(z>125&&Math.abs(z-riverZ(x))<14)C.set('#496b54');else if(ff)C.set(ff.wet?'#687a45':'#72884b');else if(tm>.45){const ti=terraceInfoFromNatural(nat,x,z);C.set(ti.f>.76?'#76573a':(ti.k%3===0?'#61803f':'#6d8543'));}else if(nat>34)C.set('#354f40');else if(nat>18)C.set('#3f6a3e');else C.set('#5f8247');C.multiplyScalar(.92+fine*.055);vc[i*3]=C.r;vc[i*3+1]=C.g;vc[i*3+2]=C.b;}tg.setAttribute('color',new THREE.BufferAttribute(vc,3));tg.computeVertexNormals();const terrain=mesh(tg,MAT.terrain);terrain.receiveShadow=true;

function ribbon2D(points,width,mat,offset=.05){const pos=[],ix=[];for(let i=0;i<points.length;i++){const a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)],dx=b[0]-a[0],dz=b[1]-a[1],L=Math.hypot(dx,dz)||1,nx=-dz/L,nz=dx/L;for(const s of[-1,1]){const x=points[i][0]+nx*width*.5*s,z=points[i][1]+nz*width*.5*s;pos.push(x,terrainY(x,z)+offset,z);}if(i<points.length-1){const n=i*2;ix.push(n,n+2,n+1,n+2,n+3,n+1)}}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(ix);g.computeVertexNormals();return mesh(g,mat)}
function waterRibbon(spec,width=spec.w){const points=spec.p,pos=[],ix=[];let lens=[],total=0;for(let i=0;i<points.length-1;i++){const l=Math.hypot(points[i+1][0]-points[i][0],points[i+1][1]-points[i][1]);lens.push(l);total+=l}let acc=0;for(let i=0;i<points.length;i++){const a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)],dx=b[0]-a[0],dz=b[1]-a[1],L=Math.hypot(dx,dz)||1,nx=-dz/L,nz=dx/L,t=i===points.length-1?1:acc/(total||1),y=channelSurface(spec,t)+.02;for(const side of[-1,1])pos.push(points[i][0]+nx*width*.5*side,y,points[i][1]+nz*width*.5*side);if(i<points.length-1){const n=i*2;ix.push(n,n+2,n+1,n+2,n+3,n+1);acc+=lens[i]}}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(ix);g.computeVertexNormals();return mesh(g,MAT.water)}
// Wet banks are grounded on the cut terrain; water follows an explicit monotone hydraulic profile.
for(const spec of channelSpecs.filter(s=>s.p!==sourcePath)){ribbon2D(spec.p,spec.w*2.15,MAT.wet,.015);waterRibbon(spec,spec.w*.92)}
waterRibbon(channelSpecs[0],.92);

// Foreground river and muddy banks.
const river=[];for(let i=0;i<=150;i++){const x=-215+i*430/150;river.push([x,riverZ(x)])}ribbon2D(river,20.5,MAT.water,.08);const rb1=river.map(p=>[p[0],p[1]-12]),rb2=river.map(p=>[p[0],p[1]+12]);ribbon2D(rb1,2.4,MAT.wet,.03);ribbon2D(rb2,2.4,MAT.wet,.03);

// Flat fields: common polygons, visible water/crop surfaces; bunds come from shared grid lines.
const fieldSurfaces=[];for(const f of flatFields){const sh=new THREE.Shape(f.poly.map(p=>new THREE.Vector2(p[0],p[1]))),g=new THREE.ShapeGeometry(sh);g.rotateX(-Math.PI/2);const m=mesh(g,f.wet?MAT.water:new THREE.MeshStandardMaterial({color:f.stage%2?'#75913d':'#88a044',roughness:.9}));m.position.y=f.bed+.055;fieldSurfaces.push(m)}
function makeBundLine(a,b){const pts=[];for(let i=0;i<=22;i++){const t=i/22;pts.push([mix(a[0],b[0],t),mix(a[1],b[1],t)])}ribbon2D(pts,1.45,MAT.soil,.18);ribbon2D(pts,.68,MAT.grass,.44)}
for(let j=0;j<nodes.length;j++)for(let i=0;i<nodes[j].length-1;i++)makeBundLine(nodes[j][i],nodes[j][i+1]);for(let i=0;i<nodes[0].length;i++)for(let j=0;j<nodes.length-1;j++)makeBundLine(nodes[j][i],nodes[j+1][i]);

// Cross-bunds break the terrace ribbons into real parcels without changing the contour-generated landform.
const crossXs=[-105,-70,-24,22,68];for(let q=0;q<crossXs.length;q++){const pts=[];for(let z=-118;z<10;z+=4){const x=crossXs[q]+7*Math.sin((z+q*19)*.035)+2*Math.sin(z*.11+q);if(terraceMask(x,z)>.5)pts.push([x,z]);}if(pts.length>2){ribbon2D(pts,1.15,MAT.soil,.17);ribbon2D(pts,.52,MAT.grass,.39)}}

// Shallow water patches on selected terrace flats, sampled from the actual terrace level.
const waterPos=[],waterIx=[];let wi=0;const cell=3.0;for(let x=-138;x<100;x+=cell)for(let z=-132;z<20;z+=cell){const tm=terraceMask(x+cell*.5,z+cell*.5);if(tm<.72)continue;const nat=baseNatural(x+cell*.5,z+cell*.5),ti=terraceInfoFromNatural(nat,x+cell*.5,z+cell*.5);if(ti.f>.56||ti.k%4===2)continue;const y=terrainY(x+cell*.5,z+cell*.5)+.055;waterPos.push(x,y,z,x+cell,y,z,x+cell,y,z+cell,x,y,z+cell);waterIx.push(wi,wi+1,wi+2,wi,wi+2,wi+3);wi+=4}if(waterPos.length){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(waterPos,3));g.setIndex(waterIx);g.computeVertexNormals();mesh(g,MAT.water)}

Object.assign(S,{terrain,ribbon2D,waterRibbon,river,fieldSurfaces});
import('./life.mjs');
