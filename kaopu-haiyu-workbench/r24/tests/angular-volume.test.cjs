'use strict';
// node tests/angular-volume.test.cjs [--full-clock]
// Independent untouched p5-script parity, rendered-mesh geometry, and controls.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const assert = require('node:assert/strict'), crypto = require('node:crypto');
const root = path.resolve(__dirname, '..'), filename = path.join(root, 'src/angular-volume.js');
const A = require(filename), hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const originalPath = path.join(root, 'stages.json'), frozenPath = path.join(root, 'src/phase-volume.js');
const originalHash = hash(originalPath), frozenHash = hash(frozenPath), moduleHash = hash(filename);
const stages = JSON.parse(fs.readFileSync(originalPath, 'utf8'));
const report = {generatedAt: new Date().toISOString(), version: A.version, moduleSha256: moduleHash, originalSourcesSha256: originalHash, frozen06and07Sha256: frozenHash, parity: [], geometry: [], controls: [], radialPlaneIntersections: [], fullClock: []};
const xyz = (p, i) => [p[3 * i], p[3 * i + 1], p[3 * i + 2]];
const sub = (a,b)=>a.map((v,i)=>v-b[i]), dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0), cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
function signedVolume(mesh) {
  let result = 0; const p = mesh.positions, ix = mesh.indices;
  for (let k=0;k<ix.length;k+=3) result += dot(xyz(p,ix[k]),cross(xyz(p,ix[k+1]),xyz(p,ix[k+2])))/6;
  return result;
}
function minDoubleArea(mesh) {
  let area=Infinity;const p=mesh.positions,ix=mesh.indices;
  for(let k=0;k<ix.length;k+=3){const a=xyz(p,ix[k]),b=xyz(p,ix[k+1]),c=xyz(p,ix[k+2]);area=Math.min(area,Math.hypot(...cross(sub(b,a),sub(c,a))));}
  return area;
}
// Independent Möller–Trumbore ray parity on every actual shell face.
function rayInside(mesh,point) {
  const direction=[.137237,.259163,1], hits=[],p=mesh.positions,ix=mesh.indices;
  for(let k=0;k<ix.length;k+=3){const a=xyz(p,ix[k]),e1=sub(xyz(p,ix[k+1]),a),e2=sub(xyz(p,ix[k+2]),a),h=cross(direction,e2),det=dot(e1,h);if(Math.abs(det)<1e-12)continue;const uvec=sub(point,a),u=dot(uvec,h)/det;if(u<-1e-10||u>1+1e-10)continue;const q=cross(uvec,e1),v=dot(direction,q)/det;if(v<-1e-10||u+v>1+1e-10)continue;const t=dot(e2,q)/det;if(t>1e-8)hits.push(t);}
  hits.sort((a,b)=>a-b);let count=0,last=-Infinity;for(const t of hits)if(t-last>1e-7){count++;last=t;}return count%2===1;
}
// Brute-force plane intersections scan all triangles, independently of the
// production slab indexing, graph construction, or original double rings.
function bruteIntersections(mesh,c) {
  const normal=[Math.cos(c),Math.sin(c),0], radial=[Math.sin(c),-Math.cos(c),0],p=mesh.positions,ix=mesh.indices,points=[];
  for(let j=0;j<ix.length;j+=3){const v=[xyz(p,ix[j]),xyz(p,ix[j+1]),xyz(p,ix[j+2])],d=v.map(a=>dot(a,normal));for(let k=0;k<3;k++){const l=(k+1)%3;if(d[k]*d[l]>=0)continue;const t=d[k]/(d[k]-d[l]),w=v[k].map((x,a)=>x+t*(v[l][a]-x)),q=dot(w,radial);if(q>0)points.push([q,w[2]]);}}
  return points;
}
function simplePolygon(poly) {
  const orient=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  for(let i=0;i<poly.length;i++)for(let j=i+2;j<poly.length;j++){if(i===0&&j===poly.length-1)continue;const a=poly[i],b=poly[(i+1)%poly.length],c=poly[j],d=poly[(j+1)%poly.length];if(orient(a,b,c)*orient(a,b,d)<-1e-9&&orient(c,d,a)*orient(c,d,b)<-1e-9)return false;}return true;
}
for(const source of [4,5]) {
  for(const frame of [1,77,239,480]) {
    const g=A.evaluate(source,frame);let count=0,mismatches=0;
    const context={w:400,sin:Math.sin,cos:Math.cos,mag:(x,y)=>Math.sqrt(x*x+y*y),PI:Math.PI,createCanvas(){},background:()=>({stroke(){}}),point(x,y){assert.equal(g.cloud.sourceIndices[count],19999-count);if(x!==g.cloud.originalXY[2*count]||y!==g.cloud.originalXY[2*count+1]||x-200!==g.cloud.positions[3*count]||200-y!==g.cloud.positions[3*count+1])mismatches++;count++;}};
    vm.createContext(context);vm.runInContext(stages[source-1],context);context.t=0;for(let j=1;j<frame;j++)context.t+=Math.PI/30;vm.runInContext('draw()',context);
    assert.equal(count,20000);assert.equal(mismatches,0);assert.equal(context.t,g.time);
    for(let j=0;j<count;j++){const i=19999-j,u=i/598,k=(5+Math.sin(u))*Math.cos(i/7),e=u/5-11,d=Math.sqrt(k*k+e*e)/.6-6,q=99+d*Math.sin(context.t-d)+u/23*k*(3*Math.sin(e)+e*Math.sin(e*2)+Math.sin(d*4)),c=d/4-context.t/8+(source===5?Math.cos(context.t+e)/9:0);assert.equal(g.cloud.parameters.q[j],q);assert.equal(g.cloud.parameters.d[j],d);assert.equal(g.cloud.parameters.c[j],c);}
    report.parity.push({source,frame,points:count,exactXYMismatches:mismatches,exactQDC:true,exactRepeatedClock:true});
  }
  for(const frame of [1,60,120]) {
    const controlPackets=[];
    for(const archedThicknessRatio of [.3,.65,1])for(const depth of [.25,1,1.5]){
      const start=performance.now(),g=A.evaluate(source,frame,{archedThicknessRatio,depth}),evaluateMs=performance.now()-start;
      const result=A.validate(g,true);assert.ok(result.ok,JSON.stringify({source,frame,archedThicknessRatio,depth,result}));
      const shellVolume=signedVolume(g.shell),spineVolume=signedVolume(g.spine);assert.ok(shellVolume>0&&spineVolume>0);const minimumFaceDoubleArea=Math.min(minDoubleArea(g.shell),minDoubleArea(g.spine));assert.ok(minimumFaceDoubleArea>1e-6);
      assert.ok(g.stats.minimumTriangleRadiusBound>0&&g.stats.unwrappedCSpan<2*Math.PI&&g.stats.spineEuclideanClearanceLowerBound>0);
      let independentRayPoints=0;
      for(let j=0;j<12;j++){const index=Math.floor(j*(g.spine.positions.length/3-1)/11),p=xyz(g.spine.positions,index);assert.ok(rayInside(g.shell,p),'independent ray rejected tube vertex');independentRayPoints++;}
      for(let j=1;j<g.spine.indices.length/3;j+=Math.floor(g.spine.indices.length/21)){const p=[0,0,0];for(let k=0;k<3;k++){const v=xyz(g.spine.positions,g.spine.indices[j*3+k]);for(let a=0;a<3;a++)p[a]+=v[a]/3;}assert.ok(rayInside(g.shell,p),'independent ray rejected tube face');independentRayPoints++;}
      assert.equal(rayInside(g.shell,[0,0,0]),false);assert.equal(A.contains(g,[0,0,0]),false);
      controlPackets.push(g);report.geometry.push({source,frame,archedThicknessRatio,depth,evaluateMs,...result,shellSignedVolume:shellVolume,spineSignedVolume:spineVolume,minimumFaceDoubleArea,independentRayPoints,minimumTriangleRadiusBound:g.stats.minimumTriangleRadiusBound,spineEuclideanClearanceLowerBound:g.stats.spineEuclideanClearanceLowerBound});
    }
    const base=controlPackets.find(g=>g.options.archedThicknessRatio===.3&&g.options.depth===1);let shellZChanged=false;
    for(const g of controlPackets){assert.deepEqual(g.cloud.originalXY,base.cloud.originalXY);for(let j=0;j<base.cloud.positions.length;j++)if(j%3!==2)assert.equal(g.cloud.positions[j],base.cloud.positions[j]);for(let j=0;j<base.shell.positions.length;j++){if(j%3!==2)assert.equal(g.shell.positions[j],base.shell.positions[j]);else if(g.options.depth===1&&g.options.archedThicknessRatio!==.3&&g.shell.positions[j]!==base.shell.positions[j])shellZChanged=true;}assert.deepEqual(g.cloud.parameters,base.cloud.parameters);}
    for(const g of controlPackets){
      const reference=controlPackets.find(v=>v.options.archedThicknessRatio===g.options.archedThicknessRatio&&v.options.depth===1),depth=g.options.depth;
      for(const name of ['cloud','shell','spine','sections'])for(let j=0;j<g[name].positions.length;j++){
        let expected=reference[name].positions[j];if(j%3===2)expected*=depth;if(name!=='cloud')expected=Math.fround(expected);assert.equal(g[name].positions[j],expected,name+' depth transform');
      }
      for(let j=0;j<g.rings.length;j++){assert.equal(g.rings[j].localCenter[1],reference.rings[j].localCenter[1]*depth);for(let k=0;k<g.rings[j].localPoints.length;k++){assert.equal(g.rings[j].localPoints[k][0],reference.rings[j].localPoints[k][0]);assert.equal(g.rings[j].localPoints[k][1],reference.rings[j].localPoints[k][1]*depth);}}
      for(let j=0;j<g.axis.length;j++)assert.equal(g.axis[j][2],reference.axis[j][2]*depth);
      for(let j=0;j<g.spine.centers.length;j++){assert.equal(g.spine.centers[j][2],reference.spine.centers[j][2]*depth);assert.equal(g.spine.radiiZ[j],reference.spine.radiiZ[j]*depth);}
    }
    assert.ok(shellZChanged);report.controls.push({source,frame,cloudAndShellXYInvariant:true,sourceParametersInvariant:true,archActuallyChangesShellZ:true,depthScalesEveryPacket:true});
    const g=controlPackets.find(g=>g.options.archedThicknessRatio===.65&&g.options.depth===1);
    let tested=0,maximumIntersectionError=0;
    for(let slab=0;slab<g.rings.length-1;slab++){
      const c=g.rings[slab].c+.371*(g.rings[slab+1].c-g.rings[slab].c),poly=A.sectionPolygon(g,c);assert.ok(poly&&poly.length>=3);assert.ok(simplePolygon(poly),'folded actual angular section');assert.ok(poly.every(p=>p[0]>0));tested++;
      if(slab%7===0){const all=bruteIntersections(g.shell,c);assert.ok(all.length>0);for(const p of all){const error=Math.min(...poly.map(q=>Math.hypot(p[0]-q[0],p[1]-q[1])));maximumIntersectionError=Math.max(maximumIntersectionError,error);assert.ok(error<1e-6);}for(const p of poly)assert.ok(Math.min(...all.map(q=>Math.hypot(p[0]-q[0],p[1]-q[1])))<1e-6);}
    }
    assert.equal(A.sectionPolygon(g,g.rings[0].c-.01),null);assert.equal(A.sectionPolygon(g,g.rings.at(-1).c+.01),null);
    report.radialPlaneIntersections.push({source,frame,actualNonfoldingSections:tested,maximumIntersectionError,oppositeHalfPlaneExcluded:true});
    console.log(JSON.stringify({source,frame,geometryCases:controlPackets.length,status:'passed'}));
  }
}
if(process.argv.includes('--full-clock'))for(const source of [4,5]){
  const start=performance.now();let minimumQ=Infinity,minimumTriangleRadiusBound=Infinity,minimumSpineEuclideanClearance=Infinity,maximumSpan=0;
  for(let frame=1;frame<=480;frame++){
    const g=A.evaluate(source,frame);assert.equal(g.cloud.sourceIndices.length,20000);assert.ok(g.stats.minimumTriangleRadiusBound>0&&g.stats.unwrappedCSpan<2*Math.PI&&g.stats.spineEuclideanClearanceLowerBound>0);
    minimumQ=Math.min(minimumQ,g.stats.sourceQRange[0]);minimumTriangleRadiusBound=Math.min(minimumTriangleRadiusBound,g.stats.minimumTriangleRadiusBound);minimumSpineEuclideanClearance=Math.min(minimumSpineEuclideanClearance,g.stats.spineEuclideanClearanceLowerBound);maximumSpan=Math.max(maximumSpan,g.stats.unwrappedCSpan);
    if(frame%120===0)console.log(JSON.stringify({source,fullClockFrames:frame,status:'passed'}));
  }
  report.fullClock.push({source,frames:480,minimumQ,minimumTriangleRadiusBound,minimumSpineEuclideanClearance,maximumSpan,runtimeMs:performance.now()-start});
}
const browserContext={};vm.createContext(browserContext);vm.runInContext(fs.readFileSync(filename,'utf8'),browserContext);assert.equal(typeof browserContext.HaiyuAngularVolume.evaluate,'function');assert.equal(browserContext.HaiyuAngularVolume.version,A.version);
assert.throws(()=>A.evaluate(6,1),/Only original sources 04 and 05/);assert.throws(()=>A.evaluate(4,1,{depth:0}),/depth outside/);assert.throws(()=>A.evaluate(5,1,{archedThicknessRatio:.2}),/archedThicknessRatio outside/);
assert.equal(hash(originalPath),originalHash);assert.equal(hash(frozenPath),frozenHash);assert.equal(hash(filename),moduleHash);
report.ok=true;report.browserExport=true;report.originalSourcesAndFrozenModuleUnchanged=true;
fs.writeFileSync(path.join(__dirname,'angular-volume-validation.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({ok:true,exactOriginalXYPairs:report.parity.reduce((n,x)=>n+x.points,0),geometryCases:report.geometry.length,actualRadialSections:report.radialPlaneIntersections.reduce((n,x)=>n+x.actualNonfoldingSections,0),fullClockFrames:report.fullClock.reduce((n,x)=>n+x.frames,0),report:'tests/angular-volume-validation.json'}));
