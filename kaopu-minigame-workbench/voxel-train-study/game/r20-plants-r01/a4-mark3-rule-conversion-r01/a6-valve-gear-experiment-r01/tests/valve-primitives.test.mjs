import assert from 'node:assert/strict';
import test from 'node:test';
import {mesh,cuboid,beam,cylinder,annulus,sector,eyeLink,extrudedDieWithBore,mergeInto,finish} from '../src/valve-native-primitives.mjs';

const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const near=(a,b,t=1e-10)=>assert(Math.abs(a-b)<t,`${a} differs from ${b}`);
const triangles=m=>Array.from({length:m.indices.length/3},(_,i)=>m.indices.slice(i*3,i*3+3).map(j=>m.positions.slice(j*3,j*3+3)));
const volume=m=>triangles(m).reduce((v,[a,b,c])=>v+dot(a,cross(b,c))/6,0);
const key=p=>p.map(v=>Math.round(v*1e9)).join(',');
function validateClosed(m) {
  finish(m);
  const edges=new Map();
  for(let i=0;i<m.indices.length;i+=3) {
    const ids=m.indices.slice(i,i+3),points=ids.map(j=>m.positions.slice(j*3,j*3+3));
    const n=cross(sub(points[1],points[0]),sub(points[2],points[0]));
    assert(Math.hypot(...n)>1e-14,'No degenerate triangle');
    for(const id of ids) {
      const normal=m.normals.slice(id*3,id*3+3);
      near(Math.hypot(...normal),1,1e-8);
      assert(dot(n,normal)>0,'Vertex normals agree with triangle winding');
    }
    for(let j=0;j<3;j++) {
      const a=key(points[j]),b=key(points[(j+1)%3]),edge=[a,b].sort().join('|');
      const entry=edges.get(edge)??{count:0,winding:0};
      entry.count++; entry.winding+=a<b?1:-1; edges.set(edge,entry);
    }
  }
  for(const entry of edges.values()) { assert.equal(entry.count,2,'Every welded edge has two incident triangles'); assert.equal(entry.winding,0,'Incident triangle edge directions oppose'); }
  assert(volume(m)>0,'Outward winding encloses positive volume');
}
// Intersection of a full X-directed line with triangles, using YZ barycentrics.
// Only actual surfaces count; feature metadata cannot make this test pass.
function lineHits(m,y,z) {
  const hits=[];
  for(const [a,b,c] of triangles(m)) {
    const d=(b[2]-c[2])*(a[1]-c[1])+(c[1]-b[1])*(a[2]-c[2]);
    if(Math.abs(d)<1e-15) continue;
    const u=((b[2]-c[2])*(y-c[1])+(c[1]-b[1])*(z-c[2]))/d;
    const v=((c[2]-a[2])*(y-c[1])+(a[1]-c[1])*(z-c[2]))/d,w=1-u-v;
    if(u>=-1e-10&&v>=-1e-10&&w>=-1e-10) hits.push(u*a[0]+v*b[0]+w*c[0]);
  }
  return hits;
}
function assertOpenBore(m,center,r) {
  assert.equal(lineHits(m,...center).length,0,'Center X ray must pass through both caps');
  for(let i=0;i<96;i++) {
    const a=2*Math.PI*i/96;
    assert.equal(lineHits(m,center[0]+.98*r*Math.cos(a),center[1]+.98*r*Math.sin(a)).length,0,'Inner bore X rays must not meet cap or shank');
  }
}

test('cuboids and arbitrary beams have complete outward finite indexed buffers',()=>{
  const box=mesh('box'); assert.equal(box.material,'brushedMetal');
  assert.equal(cuboid(box,[1,2,3],[.2,.3,.4]),box); validateClosed(box); near(volume(box),.024);
  const rod=mesh('beam'); beam(rod,[.2,.7,-.4],[.9,1.2,2.1],.04,.07); validateClosed(rod);
  near(volume(rod),Math.hypot(.7,.5,2.5)*.04*.07);
});

test('cylinder is capped and annulus has an actual open bore',()=>{
  const solid=mesh('pin'); cylinder(solid,[-.2,0,0],[.2,0,0],.12); validateClosed(solid);
  assert(lineHits(solid,0,0).length>0);
  const ring=mesh('eye'); annulus(ring,[-.2,0,0],[.2,0,0],.05,.12); validateClosed(ring); assertOpenBore(ring,[0,0],.05);
  assert(lineHits(ring,.08,0).length>0,'The ring wall is material, not a decorative outline');
  const diagonal=mesh('diagonal-eye'); annulus(diagonal,[-.2,.1,.3],[.2,.4,.5],.03,.09,24); validateClosed(diagonal);
});

test('sector uses y=radius*cos(angle), z=radius*sin(angle), and closes both ends',()=>{
  const m=mesh('sector'),center=[.4,2,3]; sector(m,center,.05,.5,.7,0,Math.PI/2); validateClosed(m);
  const ys=m.positions.filter((_,i)=>i%3===1),zs=m.positions.filter((_,i)=>i%3===2);
  near(Math.min(...ys),2); near(Math.max(...ys),2.7); near(Math.min(...zs),3); near(Math.max(...zs),3.7);
  assert(triangles(m).flat().some(p=>Math.abs(p[1]-2.7)<1e-10&&Math.abs(p[2]-3)<1e-10),'Zero angle points along positive Y');
  const reverse=mesh('reverse'); sector(reverse,center,.05,.5,.7,Math.PI/2,0); validateClosed(reverse); near(volume(reverse),volume(m));
  const full=mesh('full'); sector(full,[0,0,0],.05,.5,.7,0,2*Math.PI,48); validateClosed(full); assertOpenBore(full,[0,0],.5);
});

test('eye link keeps both distinct holes open and its shank joins the eyes',()=>{
  for(const [a,b] of [[[.8,0,0],[.8,.2,.4]],[[.8,0,0],[.8,.4,.03]],[[.8,0,0],[.8,.08,0]]]) {
    const m=mesh('link'); eyeLink(m,a,b); validateClosed(m);
    assertOpenBore(m,a.slice(1),.022); assertOpenBore(m,b.slice(1),.022);
    assert(lineHits(m,(a[1]+b[1])/2,(a[2]+b[2])/2).length>0,'Shank is a solid native beam');
    assert.equal(m.metadata.features[0].kind,'two-open-pin-eyes');
  }
});

test('die has closed caps, outer walls, inner bore walls, and preserved polygon corners',()=>{
  const center=[1.3,-.4],polygon=[[1.19,-.47],[1.42,-.46],[1.45,-.35],[1.22,-.30]],radius=.027;
  const m=mesh('die'); extrudedDieWithBore(m,{x:.9,depth:.045,centerYZ:center,outerBoundaryYZ:polygon,holeRadius:radius}); validateClosed(m);
  assertOpenBore(m,center,radius);
  for(const corner of polygon) assert(triangles(m).flat().some(p=>Math.hypot(p[1]-corner[0],p[2]-corner[1])<1e-10),'Every original outer corner survives ray sampling');
  assert(lineHits(m,center[0]+.06,center[1]).length>0,'The annular cap is real solid geometry');
  const info=m.metadata.features[0];
  assert.equal(info.openThroughBore,true); assert(info.angularSegments>=64); assert.equal(info.outerCornerCount,4);
  near(info.xMin,.8775); near(info.xMax,.9225);
  const outerArea=Math.abs(polygon.reduce((s,a,i)=>{const b=polygon[(i+1)%polygon.length]; return s+a[0]*b[1]-a[1]*b[0];},0))/2;
  const innerPoints=new Map();
  for(const p of triangles(m).flat()) if(Math.abs(Math.hypot(p[1]-center[0],p[2]-center[1])-radius)<1e-10) innerPoints.set(key(p.slice(1)),p.slice(1));
  const inner=[...innerPoints.values()].sort((a,b)=>Math.atan2(a[1]-center[1],a[0]-center[0])-Math.atan2(b[1]-center[1],b[0]-center[0]));
  const holeArea=Math.abs(inner.reduce((s,a,i)=>{const b=inner[(i+1)%inner.length];return s+a[0]*b[1]-a[1]*b[0];},0))/2;
  near(volume(m),.045*(outerArea-holeArea),1e-10);
});

test('curved die boundary is accepted without filling its bore',()=>{
  const cy=.8,cz=2,r=.6,half=.12,center=[cy+r,cz],boundary=[];
  for(let i=0;i<=12;i++) { const a=-half+2*half*i/12; boundary.push([cy+(r+.045)*Math.cos(a),cz+(r+.045)*Math.sin(a)]); }
  for(let i=12;i>=0;i--) { const a=-half+2*half*i/12; boundary.push([cy+(r-.045)*Math.cos(a),cz+(r-.045)*Math.sin(a)]); }
  const m=mesh('curved-die'); extrudedDieWithBore(m,{x:1.1,depth:.035,centerYZ:center,outerBoundaryYZ:boundary,holeRadius:.02}); validateClosed(m); assertOpenBore(m,center,.02);
});

test('concave star-shaped die and clockwise input preserve through-bore topology',()=>{
  const boundary=Array.from({length:10},(_,i)=>{const a=i*2*Math.PI/10,r=i%2?.07:.12;return [r*Math.cos(a),r*Math.sin(a)];});
  const forward=mesh('star'),reverse=mesh('star-reversed');
  extrudedDieWithBore(forward,{x:0,depth:.04,centerYZ:[0,0],outerBoundaryYZ:boundary,holeRadius:.02});
  extrudedDieWithBore(reverse,{x:0,depth:.04,centerYZ:[0,0],outerBoundaryYZ:[...boundary].reverse(),holeRadius:.02});
  validateClosed(forward); validateClosed(reverse); assertOpenBore(forward,[0,0],.02); near(volume(forward),volume(reverse));
});

test('merge offsets indices, preserves independent source buffers and bore metadata',()=>{
  const a=mesh('assembly'),b=mesh('link'); cuboid(a,[0,0,0],[.1,.1,.1]); eyeLink(b,[1,0,0],[1,.3,0]);
  const saved=JSON.stringify(b),offset=a.positions.length/3,old=a.indices.length;
  assert.throws(()=>mergeInto(a,a),/itself/);
  assert.equal(mergeInto(a,b),a); assert.equal(a.indices[old],b.indices[0]+offset);
  finish(a,{assembly:'native-valve-gear',nativeGeometry:false}); assert.equal(a.metadata.nativeGeometry,true); assert.equal(a.metadata.assembly,'native-valve-gear');
  assert.equal(a.metadata.features.length,1); assert.equal(JSON.stringify(b),saved); validateClosed(a);
});

test('invalid dimensions, directions and bore containment fail explicitly',()=>{
  assert.throws(()=>cuboid(mesh('x'),[0,0,0],[1,-1,1]),/positive/);
  assert.throws(()=>beam(mesh('x'),[0,0,0],[0,0,0],1,1),/Degenerate/);
  assert.throws(()=>cylinder(mesh('x'),[0,0,0],[1,0,0],NaN),/positive/);
  assert.throws(()=>annulus(mesh('x'),[0,0,0],[1,0,0],.2,.1),/outer/);
  assert.throws(()=>sector(mesh('x'),[0,0,0],1,.2,.3,0,0),/Invalid/);
  assert.throws(()=>eyeLink(mesh('x'),[0,0,0],[.1,.2,0]),/x-plane/);
  assert.throws(()=>eyeLink(mesh('x'),[0,0,0],[0,.04,0]),/distinct/);
  const args={x:0,depth:.03,centerYZ:[0,0],outerBoundaryYZ:[[-.1,-.1],[.1,-.1],[.1,.1],[-.1,.1]],holeRadius:.11};
  assert.throws(()=>extrudedDieWithBore(mesh('x'),args),/bore crosses/);
  assert.throws(()=>extrudedDieWithBore(mesh('x'),{...args,holeRadius:.01,centerYZ:[2,2]}),/star-shaped/);
  assert.throws(()=>finish(mesh('empty')),/Incomplete/);
  const bad=mesh('bad'); cuboid(bad,[0,0,0],[1,1,1]);bad.positions[0]=Infinity;assert.throws(()=>finish(bad),/Non-finite/);
});
