/** Native dimensional geometry only. x = lateral, y = up, z = rearwards.
 * Angular coordinates about X are ALWAYS y = r*cos(angle), z = r*sin(angle).
 * No sampled source mesh, vertex dictionary, or animation data is used here.
 */
const TAU = 2 * Math.PI;
const EPS = 1e-12;
const add = (a,b) => a.map((v,i) => v+b[i]);
const sub = (a,b) => a.map((v,i) => v-b[i]);
const mul = (a,s) => a.map(v => v*s);
const dot = (a,b) => a.reduce((s,v,i) => s+v*b[i],0);
const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const cross2 = (a,b) => a[0]*b[1]-a[1]*b[0];
function point(a,n=3) { if(!Array.isArray(a)||a.length!==n||!a.every(Number.isFinite)) throw Error(`Expected finite ${n}D point`); }
function positive(v,name) { if(!Number.isFinite(v)||v<=0) throw Error(`Expected positive finite ${name}`); }
function count(v,min=3) { if(!Number.isInteger(v)||v<min||v>4096) throw Error(`Expected integer segments from ${min} to 4096`); }
function unit(v) { const l=Math.hypot(...v); if(!Number.isFinite(l)||l<EPS) throw Error('Degenerate primitive direction'); return mul(v,1/l); }
function basis(axis) { const w=unit(axis),u=unit(cross(Math.abs(w[1])<.85?[0,1,0]:[0,0,1],w)); return [u,cross(w,u),w]; }
function vertex(m,p,n,uv) { const i=m.positions.length/3; m.positions.push(...p); m.normals.push(...n); m.uvs.push(...uv); return i; }
function triangle(m,a,b,c,n) {
  const ids=[a,b,c].map((p,i)=>vertex(m,p,n,[[.5,.5],[0,1],[1,1]][i]));
  if(dot(cross(sub(b,a),sub(c,a)),n)>0) m.indices.push(...ids); else m.indices.push(ids[0],ids[2],ids[1]);
}
function quad(m,a,b,c,d,normals=null) {
  const geometric=unit(cross(sub(b,a),sub(c,a))),ns=normals??[geometric,geometric,geometric,geometric];
  const ids=[a,b,c,d].map((p,i)=>vertex(m,p,ns[i],[[0,0],[1,0],[1,1],[0,1]][i]));
  if(dot(geometric,ns[0])>0) m.indices.push(ids[0],ids[1],ids[2],ids[0],ids[2],ids[3]);
  else m.indices.push(ids[0],ids[2],ids[1],ids[0],ids[3],ids[2]);
}
function faces(m,v) { for(const ids of [[0,3,2,1],[4,5,6,7],[0,4,7,3],[1,2,6,5],[0,1,5,4],[3,7,6,2]]) quad(m,...ids.map(i=>v[i])); }
function feature(m,value) { (m.metadata.features??=[]).push(value); }

export function mesh(name,material='brushedMetal') { return {name,material,positions:[],normals:[],uvs:[],indices:[],metadata:{}}; }
export function mergeInto(m,source) {
  if(m===source) throw Error('Cannot merge a mesh into itself');
  const offset=m.positions.length/3;
  // Avoid spread argument limits when merging a tessellated assembly.
  for(const key of ['positions','normals','uvs']) for(const v of source[key]) m[key].push(v);
  for(const i of source.indices) m.indices.push(i+offset);
  for(const item of source.metadata?.features??[]) feature(m,structuredClone(item));
  return m;
}
export function finish(m,metadata={}) {
  const n=m.positions.length/3;
  if(!Number.isInteger(n)||n===0||m.normals.length!==3*n||m.uvs.length!==2*n||!m.indices.length||m.indices.length%3) throw Error('Incomplete native geometry buffers');
  for(const key of ['positions','normals','uvs']) if(!m[key].every(Number.isFinite)) throw Error(`Non-finite ${key}`);
  if(!m.indices.every(i=>Number.isInteger(i)&&i>=0&&i<n)) throw Error('Invalid native triangle index');
  for(let i=0;i<m.indices.length;i+=3) {
    const [a,b,c]=m.indices.slice(i,i+3).map(j=>m.positions.slice(j*3,j*3+3));
    if(Math.hypot(...cross(sub(b,a),sub(c,a)))<1e-16) throw Error('Degenerate native triangle');
  }
  m.metadata={...m.metadata,...metadata,nativeGeometry:true,indexed:true};
  return m;
}
export function cuboid(m,center,size) {
  point(center); point(size); size.forEach(v=>positive(v,'cuboid size'));
  const [a,b,c]=size.map(v=>v/2);
  faces(m,[[-a,-b,-c],[a,-b,-c],[a,b,-c],[-a,b,-c],[-a,-b,c],[a,-b,c],[a,b,c],[-a,b,c]].map(p=>add(p,center)));
  return m;
}
export function beam(m,a,b,width,height) {
  point(a); point(b); positive(width,'beam width'); positive(height,'beam height');
  const [u,v]=basis(sub(b,a)),corners=p=>[[-1,-1],[1,-1],[1,1],[-1,1]].map(([i,j])=>add(p,add(mul(u,i*width/2),mul(v,j*height/2))));
  faces(m,[...corners(a),...corners(b)]); return m;
}
export function cylinder(m,a,b,r,segments=32) {
  point(a); point(b); positive(r,'cylinder radius'); count(segments);
  const [u,v,w]=basis(sub(b,a)),rad=t=>add(mul(u,Math.cos(t)),mul(v,Math.sin(t)));
  for(let i=0;i<segments;i++) {
    const n0=rad(i*TAU/segments),n1=rad((i+1)*TAU/segments),a0=add(a,mul(n0,r)),a1=add(a,mul(n1,r)),b0=add(b,mul(n0,r)),b1=add(b,mul(n1,r));
    quad(m,a0,b0,b1,a1,[n0,n0,n1,n1]); triangle(m,a,a1,a0,mul(w,-1)); triangle(m,b,b0,b1,w);
  }
  return m;
}
export function annulus(m,a,b,inner,outer,segments=48) {
  point(a); point(b); positive(inner,'inner radius'); positive(outer,'outer radius'); count(segments);
  if(outer<=inner) throw Error('Annulus outer radius must exceed inner radius');
  const [u,v,w]=basis(sub(b,a)),rad=t=>add(mul(u,Math.cos(t)),mul(v,Math.sin(t))),at=(p,r,n)=>add(p,mul(n,r));
  for(let i=0;i<segments;i++) {
    const n0=rad(i*TAU/segments),n1=rad((i+1)*TAU/segments);
    quad(m,at(a,outer,n0),at(b,outer,n0),at(b,outer,n1),at(a,outer,n1),[n0,n0,n1,n1]);
    quad(m,at(a,inner,n0),at(a,inner,n1),at(b,inner,n1),at(b,inner,n0),[mul(n0,-1),mul(n1,-1),mul(n1,-1),mul(n0,-1)]);
    quad(m,at(a,inner,n0),at(a,outer,n0),at(a,outer,n1),at(a,inner,n1),Array(4).fill(mul(w,-1)));
    quad(m,at(b,inner,n0),at(b,inner,n1),at(b,outer,n1),at(b,outer,n0),Array(4).fill(w));
  }
  return m;
}
/** Closed annular sector about X. Both end walls are real geometry. */
export function sector(m,center,xDepth,r0,r1,a0,a1,segments=40) {
  point(center); positive(xDepth,'sector depth'); positive(r0,'sector inner radius'); positive(r1,'sector outer radius'); count(segments,1);
  if(r1<=r0||!Number.isFinite(a0)||!Number.isFinite(a1)||Math.abs(a1-a0)<EPS||Math.abs(a1-a0)>TAU+EPS) throw Error('Invalid sector interval or radii');
  if(a1<a0) [a0,a1]=[a1,a0];
  const full=Math.abs(a1-a0-TAU)<EPS;
  if((a1-a0)/segments>=Math.PI) throw Error('Sector needs more angular segments');
  const at=(x,r,a)=>[center[0]+x,center[1]+r*Math.cos(a),center[2]+r*Math.sin(a)],rad=a=>[0,Math.cos(a),Math.sin(a)];
  for(let i=0;i<segments;i++) {
    const a=a0+(a1-a0)*i/segments,b=a0+(a1-a0)*(i+1)/segments,lo=-xDepth/2,hi=xDepth/2;
    quad(m,at(lo,r1,a),at(hi,r1,a),at(hi,r1,b),at(lo,r1,b),[rad(a),rad(a),rad(b),rad(b)]);
    quad(m,at(lo,r0,a),at(lo,r0,b),at(hi,r0,b),at(hi,r0,a),[mul(rad(a),-1),mul(rad(b),-1),mul(rad(b),-1),mul(rad(a),-1)]);
    quad(m,at(lo,r0,a),at(lo,r1,a),at(lo,r1,b),at(lo,r0,b),Array(4).fill([-1,0,0]));
    quad(m,at(hi,r0,a),at(hi,r0,b),at(hi,r1,b),at(hi,r1,a),Array(4).fill([1,0,0]));
  }
  if(!full) for(const [a,sign] of [[a0,-1],[a1,1]]) {
    const n=[0,-Math.sin(a)*sign,Math.cos(a)*sign];
    quad(m,at(-xDepth/2,r0,a),at(xDepth/2,r0,a),at(xDepth/2,r1,a),at(-xDepth/2,r1,a),Array(4).fill(n));
  }
  return m;
}
/** A shank and two separate open eyes, all in the same x-plane. */
export function eyeLink(m,a,b,{depth=.035,width=.035,outerA=.038,outerB=.038,holeA=.022,holeB=.022}={}) {
  point(a); point(b);
  for(const [key,v] of Object.entries({depth,width,outerA,outerB,holeA,holeB})) positive(v,key);
  if(Math.abs(a[0]-b[0])>1e-9) throw Error('Eye link endpoints must share an x-plane');
  if(holeA>=outerA||holeB>=outerB) throw Error('Eye hole must be smaller than its outer radius');
  const axis=sub(b,a),length=Math.hypot(...axis),dir=unit(axis);
  if(length<=outerA+outerB) throw Error('Eye link eyes must be distinct');
  const start=(holeA+outerA)/2,end=(holeB+outerB)/2;
  // Every shank point is farther from either pin center than its bore radius.
  beam(m,add(a,mul(dir,start)),add(b,mul(dir,-end)),depth,width);
  for(const [c,hole,outer] of [[a,holeA,outerA],[b,holeB,outerB]]) annulus(m,add(c,[-depth/2,0,0]),add(c,[depth/2,0,0]),hole,outer);
  feature(m,{kind:'two-open-pin-eyes',centers:[a.slice(),b.slice()],holeRadii:[holeA,holeB],outerRadii:[outerA,outerB],depth});
  return m;
}
/** Extrude a star-shaped YZ boundary around a real through bore along X.
 * Uniform angular rays preserve bore resolution; vertex rays preserve every
 * outer corner. Pairing the two loops creates caps without covering the bore.
 */
export function extrudedDieWithBore(m,{x,depth,centerYZ,outerBoundaryYZ,holeRadius}) {
  if(!Number.isFinite(x)) throw Error('Expected finite die x');
  positive(depth,'die depth'); positive(holeRadius,'die hole radius'); point(centerYZ,2);
  if(!Array.isArray(outerBoundaryYZ)||outerBoundaryYZ.length<3) throw Error('Die requires an outer polygon');
  outerBoundaryYZ.forEach(p=>point(p,2));
  let polygon=outerBoundaryYZ.map(p=>sub(p,centerYZ));
  if(Math.hypot(...sub(polygon[0],polygon.at(-1)))<EPS) polygon.pop();
  if(polygon.length<3) throw Error('Die requires at least three distinct corners');
  let area=polygon.reduce((s,p,i)=>s+cross2(p,polygon[(i+1)%polygon.length]),0);
  if(Math.abs(area)<EPS) throw Error('Degenerate die polygon');
  if(area<0) polygon.reverse();
  let winding=0;
  for(let i=0;i<polygon.length;i++) {
    const a=polygon[i],b=polygon[(i+1)%polygon.length],e=sub(b,a),det=cross2(a,b);
    if(Math.hypot(...e)<EPS||det<=EPS) throw Error('Die polygon must be star-shaped about its bore center');
    // The bore must fit inside every boundary edge, not merely inside vertices.
    if(det/Math.hypot(...e)<=holeRadius+EPS) throw Error('Die bore crosses the outer boundary');
    winding+=Math.atan2(det,dot(a,b));
  }
  if(Math.abs(winding-TAU)>1e-8) throw Error('Die polygon must be simple and star-shaped');
  const angle=p=>(Math.atan2(p[1],p[0])+TAU)%TAU;
  const raw=[...Array.from({length:64},(_,i)=>i*TAU/64),...polygon.map(angle)].sort((a,b)=>a-b);
  const angles=raw.filter((v,i)=>i===0||v-raw[i-1]>1e-10);
  if(TAU-angles.at(-1)<1e-10) angles.pop();
  const radii=angles.map(t=>{
    const d=[Math.cos(t),Math.sin(t)]; let nearest=Infinity;
    for(let j=0;j<polygon.length;j++) {
      const a=polygon[j],e=sub(polygon[(j+1)%polygon.length],a),den=cross2(d,e);
      if(Math.abs(den)<EPS) continue;
      const distance=cross2(a,e)/den,u=cross2(a,d)/den;
      if(distance>0&&u>=-1e-9&&u<=1+1e-9) nearest=Math.min(nearest,distance);
    }
    if(!Number.isFinite(nearest)||nearest<=holeRadius) throw Error('Invalid ray intersection for die boundary');
    return nearest;
  });
  const ring=angles.map((a,i)=>({outer:[centerYZ[0]+radii[i]*Math.cos(a),centerYZ[1]+radii[i]*Math.sin(a)],inner:[centerYZ[0]+holeRadius*Math.cos(a),centerYZ[1]+holeRadius*Math.sin(a)],rad:[0,Math.cos(a),Math.sin(a)]}));
  const lo=x-depth/2,hi=x+depth/2,p=(xx,yz)=>[xx,...yz];
  for(let i=0;i<ring.length;i++) {
    const a=ring[i],b=ring[(i+1)%ring.length],edge=sub(b.outer,a.outer),normal=unit([0,edge[1],-edge[0]]);
    quad(m,p(lo,a.outer),p(hi,a.outer),p(hi,b.outer),p(lo,b.outer),Array(4).fill(normal));
    quad(m,p(lo,a.inner),p(lo,b.inner),p(hi,b.inner),p(hi,a.inner),[mul(a.rad,-1),mul(b.rad,-1),mul(b.rad,-1),mul(a.rad,-1)]);
    quad(m,p(lo,a.inner),p(lo,a.outer),p(lo,b.outer),p(lo,b.inner),Array(4).fill([-1,0,0]));
    quad(m,p(hi,a.inner),p(hi,b.inner),p(hi,b.outer),p(hi,a.outer),Array(4).fill([1,0,0]));
  }
  feature(m,{kind:'extruded-die-through-bore',axis:'x',centerYZ:centerYZ.slice(),xMin:lo,xMax:hi,holeRadius,angularSegments:ring.length,outerCornerCount:polygon.length,capConstruction:'ray-edge-intersection-annular-strips',openThroughBore:true});
  return m;
}
