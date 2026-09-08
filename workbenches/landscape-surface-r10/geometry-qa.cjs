const fs=require('fs'),path=require('path'),assert=require('assert/strict');
function load(version){const html=fs.readFileSync(path.join(__dirname,`../landscape-surface-r${version}/index.html`),'utf8');const code=html.match(/<script id="worldSource" type="text\/plain">([\s\S]*?)<\/script>/)[1];return new Function(code+';return {World,TerrainSupport}')();}
function inspect(version){
 const {World:W,TerrainSupport:T}=load(version),w=W.create(W.DEFAULT),h=.32;
 const raw=W.mesh(w.rock,w.bounds[0],w.bounds[1],h,undefined,1),m=W.splitComponents(raw)[0];T.orient(m);
 const P=m.positions,I=m.indices,n=P.length/3,edges=new Map(),normals=new Float32Array(I.length),metrics={version,vertices:n,triangles:I.length/3,signature:W.checksum(P)+':'+W.checksum(I),boundary:0,nonmanifold:0,windingMismatch:0,degenerateFaces:0,sharp60:0,sharp90:0,totalInteriorEdges:0,volume:W.volume(m)};
 for(const x of P)assert(Number.isFinite(x));
 for(let i=0;i<I.length;i+=3){const a=I[i]*3,b=I[i+1]*3,c=I[i+2]*3;assert(c<P.length&&b<P.length&&a<P.length);
 const ux=P[b]-P[a],uy=P[b+1]-P[a+1],uz=P[b+2]-P[a+2],vx=P[c]-P[a],vy=P[c+1]-P[a+1],vz=P[c+2]-P[a+2];
 const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx,l=Math.hypot(nx,ny,nz);
 if(l<1e-14)metrics.degenerateFaces++;normals[i]=nx/(l||1);normals[i+1]=ny/(l||1);normals[i+2]=nz/(l||1);
 for(let j=0;j<3;j++){const u=I[i+j],v=I[i+(j+1)%3],key=Math.min(u,v)*n+Math.max(u,v),sign=u<v?1:-1,e=edges.get(key);if(!e)edges.set(key,{face:i,sign,count:1});else{e.count++;if(e.count===2){metrics.totalInteriorEdges++;if(e.sign===sign)metrics.windingMismatch++;const k=e.face,d=normals[k]*normals[i]+normals[k+1]*normals[i+1]+normals[k+2]*normals[i+2];if(d<.5)metrics.sharp60++;if(d<0)metrics.sharp90++;}}}
 }
 for(const e of edges.values()){if(e.count===1)metrics.boundary++;if(e.count>2)metrics.nonmanifold++;}
 assert.equal(metrics.boundary,0);assert.equal(metrics.nonmanifold,0);assert.equal(metrics.windingMismatch,0);assert(metrics.volume>0);
 metrics.sharp60Fraction=metrics.sharp60/metrics.totalInteriorEdges;
 metrics.sharp90Fraction=metrics.sharp90/metrics.totalInteriorEdges;
 const pts=Array.from({length:101},(_,i)=>[-35+i*.7,Math.sin(i)*18+23,Math.cos(i*1.3)*24]);const forward=pts.map(p=>w.rock(...p));assert.deepEqual(pts.slice().reverse().map(p=>w.rock(...p)).reverse(),forward);
 console.log(JSON.stringify(metrics));return metrics;
}
const r9=inspect(9),r10=inspect(10);
assert(r10.sharp60Fraction<.035);assert(r10.sharp90Fraction<.012);
assert(r10.volume/r9.volume>.96&&r10.volume/r9.volume<1.01);assert.equal(r10.degenerateFaces,0);
const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');let code=html.match(/<script id="worldSource" type="text\/plain">([\s\S]*?)<\/script>/)[1];code=code.replace('return {splitComponents,DEFAULT','return {facetCell,chipRelief,splitComponents,DEFAULT');const W=new Function(code+';return World')();let maxError=0,maxTilt=0;
for(let i=0;i<100;i++){const R=W.facetCell(i-50,i%9-4,i%17-8,i%2).R;for(let a=0;a<3;a++)for(let b=0;b<3;b++){let dot=0;for(let k=0;k<3;k++)dot+=R[a*3+k]*R[b*3+k];maxError=Math.max(maxError,Math.abs(dot-(a===b?1:0)));}const det=R[0]*(R[4]*R[8]-R[5]*R[7])-R[1]*(R[3]*R[8]-R[5]*R[6])+R[2]*(R[3]*R[7]-R[4]*R[6]);assert(Math.abs(det-1)<1e-12);maxTilt=Math.max(maxTilt,Math.hypot(R[1],R[7]));}
assert(maxError<1e-12);assert(maxTilt>.9);
const samples=Array.from({length:80},(_,i)=>[i*.73-25,Math.sin(i*.7)*22+25,Math.cos(i*.3)*18]);const forward=samples.map(p=>W.chipRelief(...p));assert.deepEqual(samples.slice().reverse().map(p=>W.chipRelief(...p)).reverse(),forward);assert(forward.every(x=>x>=0&&x<=.72));
const result={date:new Date().toISOString(),r9,r10,volumeRatio:r10.volume/r9.volume,rotation:{tested:100,maxOrthogonalityError:maxError,maxOutOfVerticalAxis:maxTilt},scope:'Fixed-geometry and rotation diagnostics, not artistic approval'};
fs.writeFileSync(path.join(__dirname,'geometry-QA.json'),JSON.stringify(result,null,2)+'\n');