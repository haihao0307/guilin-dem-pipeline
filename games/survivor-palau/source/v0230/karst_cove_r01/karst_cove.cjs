/* Stone Money Island Karst Cove R01.
 * Candidate metre-scale implicit rock/cavity field derived from the authored shelter region.
 * fieldAt is an occupancy score, NOT a proven signed-distance function.
 * Rendering mesh, contact, normals and occlusion all derive from this same field.
 */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports) module.exports=api;
  if(root) root.SMIKarstCove=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const VERSION='smi-karst-cove-r01/0.1';
const EPS=1e-9;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const mix=(a,b,t)=>a+(b-a)*t;
const smooth01=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
const len=v=>Math.hypot(v[0],v[1],v[2]);
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const norm=v=>{const d=len(v);return d>EPS?[v[0]/d,v[1]/d,v[2]/d]:[0,1,0];};
const CONFIG=Object.freeze({
  id:'SMI_KARST_COVE_R01',
  evidence:'candidate-authored-from-G05-morphology-and-existing-shelter-frame',
  units:'metre', axes:Object.freeze({east:'+X',up:'+Y',north:'-Z'}),
  center:Object.freeze([27.0,3.20,13.75]),
  outerRadii:Object.freeze([4.55,2.75,5.15]),
  floorBase:1.35,
  bounds:Object.freeze({min:Object.freeze([22.10,0.45,8.45]),max:Object.freeze([31.90,6.35,19.45])}),
  sourceAuthoredSolidBounds:Object.freeze({min:Object.freeze([22.8,1.0,9.1]),max:Object.freeze([31.2,5.68,18.5])}),
  sourceGroundPatch:Object.freeze({x:Object.freeze([23.3,30.7]),z:Object.freeze([9.7,18.1]),minY:1.35}),
  sourcePlayerXZ:Object.freeze([24.0,22.8]), sourceShelterXZ:Object.freeze([25.2,12.1])
});
function superNorm3(a,b,c,p=4){return Math.pow(Math.pow(Math.abs(a),p)+Math.pow(Math.abs(b),p)+Math.pow(Math.abs(c),p),1/p);}
function floorAt(x,z){
  const dz=z-14.0, dx=x-27.0;
  return CONFIG.floorBase + 0.018*dz + 0.018*Math.sin(dx*0.78)*Math.exp(-Math.abs(dz)*0.18);
}
function cavityFrame(x,y,z){
  const t=clamp((z-10.15)/(18.95-10.15),0,1);
  const floor=floorAt(x,z);
  const ceiling=3.38 + 1.18*smooth01(t) + 0.10*Math.cos((z-14.2)*0.65);
  const halfHeight=Math.max(0.52,(ceiling-floor)*0.5);
  const mid=floor+halfHeight;
  const vertical=Math.abs((y-mid)/halfHeight);
  const baseWidth=mix(1.55,2.70,smooth01(t));
  // Wider lower cavity with a narrower high shoulder creates an entrance undercut/overhang.
  const widthScale=1.14-0.20*clamp(vertical,0,1.4);
  const asym=0.12*Math.sin((z-12.2)*0.9);
  const halfWidth=Math.max(0.70,baseWidth*widthScale);
  return {t,floor,ceiling,halfHeight,mid,halfWidth,asym};
}
function outerScore(x,y,z){
  const c=CONFIG.center,r=CONFIG.outerRadii;
  const u=(x-c[0])/r[0], v=(y-c[1])/r[1], w=(z-c[2])/r[2];
  let s=1-superNorm3(u,v,w,4);
  // Deterministic low-amplitude form variation. This is shape expression, not surveyed rock relief.
  const q=0.050*Math.sin((x-21.7)*1.31)+0.034*Math.sin((z-7.9)*1.77)+0.022*Math.sin((x+z)*0.83);
  s+=q;
  return s;
}
function cavityScore(x,y,z){
  const f=cavityFrame(x,y,z);
  const ux=(x-(CONFIG.center[0]+f.asym))/f.halfWidth;
  const uy=(y-f.mid)/f.halfHeight;
  const cross=1-Math.pow(Math.pow(Math.abs(ux),4)+Math.pow(Math.abs(uy),4),1/4);
  // Signed longitudinal gates: negative outside the cave's back/front interval.
  const back=(z-10.15)/0.55;
  const front=(19.65-z)/0.35;
  return Math.min(cross,back,front);
}
function fieldAt(x,y,z){
  if(![x,y,z].every(Number.isFinite)) throw new TypeError('finite xyz required');
  const outer=outerScore(x,y,z);
  const cavity=cavityScore(x,y,z);
  // Positive means rock, negative means air/outside. Not metric distance.
  return Math.min(outer,-cavity);
}
function insideRock(x,y,z,margin=0){return fieldAt(x,y,z)>margin;}
function normalAt(x,y,z,h=0.012){
  if(!(h>0)) throw new RangeError('positive normal step required');
  const g=[fieldAt(x+h,y,z)-fieldAt(x-h,y,z),fieldAt(x,y+h,z)-fieldAt(x,y-h,z),fieldAt(x,y,z+h)-fieldAt(x,y,z-h)];
  return norm(g);
}
function clearanceAt(x,z,options={}){
  const y0=Number.isFinite(options.floorY)?options.floorY:floorAt(x,z)+0.04;
  const top=Number.isFinite(options.top)?options.top:CONFIG.bounds.max[1];
  const step=Number.isFinite(options.step)?options.step:0.015;
  if(!(step>0)) throw new RangeError('positive clearance step required');
  for(let y=y0;y<=top;y+=step){if(insideRock(x,y,z))return {floorY:y0,ceilingY:y,clearance:y-y0,hit:true};}
  return {floorY:y0,ceilingY:null,clearance:Infinity,hit:false};
}
function rayOccluded(a,b,options={}){
  if(!Array.isArray(a)||!Array.isArray(b)||a.length!==3||b.length!==3||![...a,...b].every(Number.isFinite))throw new TypeError('finite ray endpoints required');
  const d=sub(b,a),distance=len(d);if(distance<EPS)return insideRock(...a);
  const step=Number.isFinite(options.step)?options.step:0.045;if(!(step>0))throw new RangeError('positive ray step required');
  const n=Math.ceil(distance/step);
  for(let i=1;i<n;i++){
    const t=i/n,x=a[0]+d[0]*t,y=a[1]+d[1]*t,z=a[2]+d[2]*t;
    if(insideRock(x,y,z))return true;
  }
  return false;
}
function contactAt(p,options={}){
  if(!Array.isArray(p)||p.length!==3||!p.every(Number.isFinite))throw new TypeError('finite point required');
  const radius=Number.isFinite(options.radius)?options.radius:0.18;
  const samples=Number.isInteger(options.samples)?options.samples:32;
  if(!(radius>0)||samples<6)throw new RangeError('invalid contact probe');
  let best=null;
  const dirs=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
  for(let i=0;i<samples;i++){
    const a=2.399963229728653*i, y=1-2*(i+.5)/samples, r=Math.sqrt(Math.max(0,1-y*y));dirs.push([Math.cos(a)*r,y,Math.sin(a)*r]);
  }
  for(const d of dirs){
    const q=[p[0]+d[0]*radius,p[1]+d[1]*radius,p[2]+d[2]*radius],s=fieldAt(...q);
    if(!best||s>best.score)best={score:s,point:q};
  }
  return Object.freeze({contact:best.score>0,score:best.score,normal:normalAt(...best.point),probeRadius:radius});
}
function buildDiagnosticMesh(options={}){
  const step=Number.isFinite(options.step)?options.step:0.30;
  if(!(step>=0.16&&step<=0.8))throw new RangeError('mesh step must be 0.16..0.8 m');
  const b=CONFIG.bounds,min=b.min,max=b.max;
  const nx=Math.ceil((max[0]-min[0])/step),ny=Math.ceil((max[1]-min[1])/step),nz=Math.ceil((max[2]-min[2])/step);
  const occ=new Uint8Array(nx*ny*nz),idx=(i,j,k)=>i+nx*(j+ny*k);
  const center=(i,j,k)=>[min[0]+(i+.5)*step,min[1]+(j+.5)*step,min[2]+(k+.5)*step];
  for(let k=0;k<nz;k++)for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){const p=center(i,j,k);occ[idx(i,j,k)]=insideRock(...p)?1:0;}
  const positions=[],normals=[],faces=[];
  const faceDefs=[
    {d:[-1,0,0],n:[-1,0,0],c:[[0,0,0],[0,0,1],[0,1,1],[0,1,0]]},
    {d:[ 1,0,0],n:[ 1,0,0],c:[[1,0,1],[1,0,0],[1,1,0],[1,1,1]]},
    {d:[0,-1,0],n:[0,-1,0],c:[[0,0,1],[0,0,0],[1,0,0],[1,0,1]]},
    {d:[0, 1,0],n:[0, 1,0],c:[[0,1,0],[0,1,1],[1,1,1],[1,1,0]]},
    {d:[0,0,-1],n:[0,0,-1],c:[[1,0,0],[0,0,0],[0,1,0],[1,1,0]]},
    {d:[0,0, 1],n:[0,0, 1],c:[[0,0,1],[1,0,1],[1,1,1],[0,1,1]]}
  ];
  function pushVertex(p,n){positions.push(p[0],p[1],p[2]);normals.push(n[0],n[1],n[2]);}
  for(let k=0;k<nz;k++)for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){
    if(!occ[idx(i,j,k)])continue;
    for(const f of faceDefs){
      const ii=i+f.d[0],jj=j+f.d[1],kk=k+f.d[2];
      const neighbor=ii>=0&&jj>=0&&kk>=0&&ii<nx&&jj<ny&&kk<nz?occ[idx(ii,jj,kk)]:0;
      if(neighbor)continue;
      const base=positions.length/3,pts=f.c.map(c=>[min[0]+(i+c[0])*step,min[1]+(j+c[1])*step,min[2]+(k+c[2])*step]);
      pushVertex(pts[0],f.n);pushVertex(pts[1],f.n);pushVertex(pts[2],f.n);pushVertex(pts[3],f.n);
      faces.push(base,base+1,base+2,base,base+2,base+3);
    }
  }
  return Object.freeze({version:VERSION,fieldId:CONFIG.id,step,bounds:CONFIG.bounds,positions:Object.freeze(positions),normals:Object.freeze(normals),indices:Object.freeze(faces),triangles:faces.length/3});
}
return Object.freeze({VERSION,CONFIG,floorAt,cavityFrame,outerScore,cavityScore,fieldAt,insideRock,normalAt,clearanceAt,rayOccluded,contactAt,buildDiagnosticMesh});
});
