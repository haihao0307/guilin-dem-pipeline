import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {buildA6CoachShell,A6_COACH_DEFAULTS,sampleA6CoachHem,sampleA6CoachSurface} from './a6-coach-shell.mjs';
import {buildA6TenderShell,sampleTenderHalfWidth,sampleA6TenderSection,sampleA6TenderSideSurface} from './a6-tender-shell.mjs';
import {buildA6StaticCoupling} from './a6-static-coupling.mjs';
import {buildLocomotiveMechanics} from '../../student-native-r01/src/locomotive-mechanics.mjs';
import {buildMark3Mechanics} from '../../student-native-r01/src/coach-mechanics.mjs';
const coach=buildA6CoachShell(),tender=buildA6TenderShell(),mechanics=buildMark3Mechanics();
const report={schema:'kaopu.a6-connected-shell-cpu-qa/1',checkedOn:'2026-10-17',scope:'Native coach and closed tender only; no browser, suspension or coupled-motion certification',tests:[],counts:{coachParts:coach.parts.length,coachOpenings:coach.openings.length,glassSolids:coach.parts.filter(p=>p.material==='glass').length,tenderParts:tender.parts.length,externalCoachMechanics:mechanics.parts.length}};
const record=(name,fn)=>test(name,()=>{fn();report.tests.push({name,status:'pass'});});
const partsHash=parts=>{const h=createHash('sha256');for(const p of parts){h.update(p.name);for(const k of ['positions','normals','uvs','indices'])h.update(new Uint8Array(p[k].buffer,p[k].byteOffset,p[k].byteLength));}return h.digest('hex');};
const near=(a,b,tol=1e-5)=>Math.abs(a-b)<=tol;
const find=(out,name)=>out.parts.find(p=>p.name===name);
function geometryHealth(out){
  for(const p of out.parts){
    assert.ok(p.positions instanceof Float32Array&&p.normals instanceof Float32Array&&p.uvs instanceof Float32Array&&p.indices instanceof Uint32Array,p.name);
    assert.equal(p.positions.length,p.normals.length);assert.equal(p.positions.length/3*2,p.uvs.length);assert.equal(p.indices.length%3,0);
    for(const k of ['positions','normals','uvs'])assert.ok(p[k].every(Number.isFinite),`${p.name}: ${k}`);
    assert.ok(p.indices.every(i=>i<p.positions.length/3));
    for(let i=0;i<p.normals.length;i+=3)assert.ok(near(Math.hypot(p.normals[i],p.normals[i+1],p.normals[i+2]),1,2e-6),`${p.name}: nonunit normal`);
    assert.equal(p.materialGroups.reduce((s,g)=>s+g.count,0),p.indices.length);
    for(let i=0;i<p.indices.length;i+=3){const [a,b,c]=[0,1,2].map(j=>p.indices[i+j]*3),u=[0,1,2].map(k=>p.positions[b+k]-p.positions[a+k]),v=[0,1,2].map(k=>p.positions[c+k]-p.positions[a+k]),cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],n=[0,1,2].map(k=>p.normals[a+k]+p.normals[b+k]+p.normals[c+k]);assert.ok(Math.hypot(...cross)>1e-12,`${p.name}: degenerate Float32 triangle`);assert.ok(cross.reduce((s,x,k)=>s+x*n[k],0)>-1e-8,`${p.name}: reversed triangle`);}
  }
}
function projectedTriangleHits(parts,y,z){
  for(const p of parts)for(let i=0;i<p.indices.length;i+=3){const [a,b,c]=[0,1,2].map(j=>p.indices[i+j]*3),ay=p.positions[a+1],az=p.positions[a+2],by=p.positions[b+1],bz=p.positions[b+2],cy=p.positions[c+1],cz=p.positions[c+2];if(y<Math.min(ay,by,cy)-1e-7||y>Math.max(ay,by,cy)+1e-7||z<Math.min(az,bz,cz)-1e-7||z>Math.max(az,bz,cz)+1e-7)continue;const d=(bz-cz)*(ay-cy)+(cy-by)*(az-cz);if(Math.abs(d)<1e-12)continue;const u=((bz-cz)*(y-cy)+(cy-by)*(z-cz))/d,v=((cz-az)*(y-cy)+(ay-cy)*(z-cz))/d;if(u>=-1e-8&&v>=-1e-8&&u+v<=1+1e-8)return true;}return false;
}
function manifold(parts){
  const vertices=new Map(),edges=new Map();
  function id(p,i){const k=[0,1,2].map(j=>Math.round(p.positions[i*3+j]*1e6)).join(',');if(!vertices.has(k))vertices.set(k,vertices.size);return vertices.get(k);}
  let volume=0;
  for(const p of parts)for(let i=0;i<p.indices.length;i+=3){const t=[0,1,2].map(j=>id(p,p.indices[i+j]));for(let j=0;j<3;j++){const a=t[j],b=t[(j+1)%3],key=a<b?`${a},${b}`:`${b},${a}`;edges.set(key,(edges.get(key)||0)+1);}const [a,b,c]=[0,1,2].map(j=>p.indices[i+j]*3),P=p.positions;volume+=(P[a]*(P[b+1]*P[c+2]-P[b+2]*P[c+1])+P[a+1]*(P[b+2]*P[c]-P[b]*P[c+2])+P[a+2]*(P[b]*P[c+1]-P[b+1]*P[c]))/6;}
  return {vertices:vertices.size,edges:edges.size,nonManifoldEdges:[...edges.values()].filter(c=>c!==2).length,signedVolume:volume};
}
function sliceRange(parts,z){let min=Infinity,max=-Infinity;for(const p of parts)for(let k=0;k<p.indices.length;k+=3){const ids=[p.indices[k]*3,p.indices[k+1]*3,p.indices[k+2]*3];for(let i=0;i<3;i++){const a=ids[i],b=ids[(i+1)%3],za=p.positions[a+2],zb=p.positions[b+2];if(z<Math.min(za,zb)-1e-7||z>Math.max(za,zb)+1e-7)continue;const t=Math.abs(zb-za)>1e-8?(z-za)/(zb-za):0,y=p.positions[a+1]+t*(p.positions[b+1]-p.positions[a+1]);min=Math.min(min,y);max=Math.max(max,y);}}return {min,max};}
record('deterministic native arrays and semantic material contract',()=>{assert.equal(partsHash(coach.parts),partsHash(buildA6CoachShell().parts));assert.equal(partsHash(tender.parts),partsHash(buildA6TenderShell().parts));const materials=new Set(['paint','interior','blackPaint','rubber','glass','brushedMetal','trim-brass']);assert.ok([...coach.parts,...tender.parts].every(p=>materials.has(p.material)));});
record('coach Float32 triangles, normals and typed attributes are valid',()=>geometryHealth(coach));
record('tender Float32 triangles, normals and typed attributes are valid',()=>geometryHealth(tender));
record('all 24 original apertures remain real independent shell holes',()=>{
  assert.equal(coach.openings.length,24);for(const o of coach.openings){const side=o.side<0?'left':'right',skin=coach.parts.filter(p=>p.name.startsWith(`shell-side-${side}-`)||p.name===`lining-side-${side}`);for(const du of [-.24,0,.24])for(const dv of [-.24,0,.24])assert.equal(projectedTriangleHits(skin,o.cy+dv*o.height,o.cx+du*o.width),false,`${side}-${o.id}`);assert.ok(find(coach,`${side}-${o.id}-reveal`));assert.ok(find(coach,`${side}-${o.id}-gasket`));}
  const o=coach.openings.find(x=>x.id==='saloon-4'&&x.side===1),skin=coach.parts.filter(p=>p.name.startsWith('shell-side-right-'));assert.ok(projectedTriangleHits(skin,o.bottom+.005,o.left+.005),'rounded corner remains body');assert.equal(projectedTriangleHits(skin,o.bottom+o.radius+.04,o.left+.02),false);
});
record('24 panes each have two optical faces, sealed rims and measured 14 mm thickness',()=>{
  const panes=coach.parts.filter(p=>p.material==='glass');assert.equal(panes.length,24);const list=[];
  for(const p of panes){assert.equal(p.metadata.closedSolid,true);assert.equal(p.doubleSided,false);const check=manifold([p]);assert.equal(check.nonManifoldEdges,0,p.name);assert.ok(check.signedVolume>0,p.name);const count=p.metadata.opticalFaceVertexCount;let maxThicknessError=0;for(let i=0;i<count;i++){const a=i*3,b=(count+i)*3,d=Math.hypot(...[0,1,2].map(k=>p.positions[a+k]-p.positions[b+k]));maxThicknessError=Math.max(maxThicknessError,Math.abs(d-.014));}assert.ok(maxThicknessError<3e-6,p.name);list.push({name:p.name,...check,thicknessM:.014,maxThicknessErrorM:maxThicknessError});}report.glazing=list;
});
record('door leaf, closed glass, gasket and gold inlay use the same hinge',()=>{
  const opened=buildA6CoachShell({doorOpenAngleDeg:38});for(const side of ['left','right'])for(const end of ['front','rear']){const prefix=`${side}-vestibule-door-${end}`,leaf=find(opened,prefix+'-leaf');for(const suffix of ['-window-glass','-window-gasket','-flush-gold-line'])assert.deepEqual(find(opened,prefix+suffix).metadata.hinge,leaf.metadata.hinge);assert.equal(manifold([find(opened,prefix+'-window-glass')]).nonManifoldEdges,0);}
});
record('roof and shoulder are tangent continuous convex surfaces, not pipe strips',()=>{
  for(const z of [-11.285,-10.7,0,10.7,11.285])for(const side of [-1,1]){const a=sampleA6CoachSurface({},'side',z,3.15,side),b=sampleA6CoachSurface({},'roof',z,side>0?0:Math.PI);assert.ok(a.point.every((x,k)=>near(x,b.point[k],1e-9)));assert.ok(a.normal.every((x,k)=>near(x,b.normal[k],1e-6)));}
  for(let i=0;i<=64;i++){const s=sampleA6CoachSurface({},'roof',0,i*Math.PI/64);assert.ok(s.normal[1]>=-1e-8);assert.ok(s.normal[0]*s.point[0]>=-1e-8);}
  const section=sampleA6TenderSection();for(const s of section)if(s.point[1]>=3.15)assert.ok(s.normal[1]>=-1e-8&&s.normal[0]*s.point[0]>=-1e-8);
});
record('all outer tender surfaces form one watertight oriented closed body',()=>{const solid=manifold(tender.parts.filter(p=>['shell','end-cap','closed-end-face'].includes(p.category)));assert.equal(solid.nonManifoldEdges,0);assert.ok(solid.signedVolume>0);assert.equal(tender.completion.coal,false);assert.equal(tender.openings.length,0);report.tenderOuterClosedness=solid;});
record('tender inner lining is independently closed and contained',()=>{const inner=manifold(tender.parts.filter(p=>p.category==='lining'));assert.equal(inner.nonManifoldEdges,0);assert.ok(inner.signedVolume<0);for(const p of tender.parts.filter(p=>p.category==='lining'))for(let i=0;i<p.positions.length;i+=3){assert.ok(p.positions[i+2]>12.9+.0449);assert.ok(p.positions[i+2]<20.5-.0449);}report.tenderInnerClosedness=inner;});
record('body crowns match at 4.03 and compact interfaces preserve fixed mechanical ends',()=>{
  assert.ok(near(coach.bounds.max[1],4.03));assert.ok(near(tender.bounds.max[1],4.03));assert.equal(coach.interfaces.commonGoldLineY,1.96);assert.equal(tender.interfaces.commonGoldLineY,1.96);
  assert.ok(near(coach.bounds.max[2],11.475));assert.ok(coach.bounds.max[2]<11.49);assert.ok(near(tender.bounds.min[2],12.9));assert.ok(near(tender.bounds.max[2],20.5));assert.ok(coach.parts.filter(p=>p.category==='aero-interface').every(p=>p.metadata.openBottomY===1.60));assert.equal(coach.parts.filter(p=>p.category==='aero-interface').length,2);
});
record('tender stays above the complete frozen bearing plane with 35 mm minimum',()=>{for(const p of tender.parts)for(let i=1;i<p.positions.length;i+=3)assert.ok(p.positions[i]>=1.60-1e-6);assert.ok(near(tender.interfaces.minimumVerticalBearingMargin,.035));assert.deepEqual(tender.interfaces.axleCentresZ,[13.681075,15.281275,16.957675,18.557875]);});
record('actual coach triangle slices clear the full original bogies over both ends',()=>{
  const bogies=mechanics.parts.filter(p=>p.metadata.assembly.startsWith('bogie-')),skin=coach.parts.filter(p=>p.name.startsWith('shell-side-')||p.category==='shell-edge');let minimum=Infinity,at=null,samples=0;
  for(const sign of [-1,1])for(let j=0;j<=102;j++){const z=sign*(5.5+j*.05),a=sliceRange(bogies,z);if(a.max===-Infinity)continue;const b=sliceRange(skin,z),gap=b.min-a.max;assert.ok(gap>.06,`z ${z}: ${gap}`);samples++;if(gap<minimum){minimum=gap;at={z,mechanicalTop:a.max,actualSideHem:b.min};}}
  report.staticBogieProjection={triangleSliceSamples:samples,minimumMarginM:minimum,at,meaning:'Complete original native bogie projected height remains below the actual finite outer hem; static geometric visibility screen only.'};
});
record('floor and all 238 mechanical parts remain immutable during shell edits',()=>{
  const before=partsHash(mechanics.parts);assert.equal(mechanics.parts.length,238);assert.equal(coach.interfaces.floor.undersideY,1.175);for(const params of [{crownHeight:3.9},{crownHeight:4.2,bodyWidth:2.86},{windowWidth:1.5},{doorOpenAngleDeg:55}]){const out=buildA6CoachShell(params);assert.equal(out.interfaces.floor.undersideY,1.175);assert.equal(out.openings.length,24);assert.equal(partsHash(mechanics.parts),before);assert.equal(out.interfaces.mechanicalPartsGenerated,0);}assert.equal(partsHash(buildMark3Mechanics().parts),before);report.mechanicsHash=before;
});
record('crown and width edits regenerate surfaces, normals and glazing without mesh assets',()=>{
  const a=buildA6CoachShell({crownHeight:4.18,bodyWidth:2.86}),b=buildA6TenderShell({crownHeight:4.18,width:2.86});assert.ok(near(a.bounds.max[1],4.18)&&near(b.bounds.max[1],4.18));assert.notEqual(partsHash(a.parts),partsHash(coach.parts));assert.notEqual(partsHash(b.parts),partsHash(tender.parts));geometryHealth(a);geometryHealth(b);
});
record('tender emblem surface registration follows its curved roof shoulder',()=>{assert.ok(near(sampleTenderHalfWidth(2.7,17),2.743/2,1e-12));assert.ok(sampleTenderHalfWidth(3.23,17)<2.743/2);for(const y of [2.37,2.7,3.15,3.23])for(const z of [16.85,17.7,18.55]){const s=sampleA6TenderSideSurface(y,z);assert.ok(near(s.point[0],sampleTenderHalfWidth(y,z),1e-10));assert.ok(near(Math.hypot(...s.normal),1,1e-10));}assert.ok(tender.parts.filter(p=>p.category==='sealed-service-panel').every(p=>{let max=-Infinity;for(let i=2;i<p.positions.length;i+=3)max=Math.max(max,p.positions[i]);return max<16.85;}));});
record('invalid edits fail rather than move protected mechanisms or create unsafe intersections',()=>{for(const p of [{floorY:1.3},{floorThickness:.08},{bogieCentres:15},{bodyLength:22},{glassThickness:.008},{crownHeight:NaN},{bogieHemHeight:1.0},{gangwayLength:.3}])assert.throws(()=>buildA6CoachShell(p));for(const p of [{bottom:1.55},{crownHeight:3},{sideTop:4},{width:0},{endCapLength:2}])assert.throws(()=>buildA6TenderShell(p));});
record('runtime shell functions are isolated from teacher arrays, I/O and old cases',()=>{for(const file of ['a6-coach-shell.mjs','a6-tender-shell.mjs','a6-shell-geometry.mjs','a6-static-coupling.mjs']){const text=readFileSync(new URL(file,import.meta.url),'utf8');assert.doesNotMatch(text,/\b(?:fetch|XMLHttpRequest|require|readFile|DecompressionStream)\s*\(/);assert.doesNotMatch(text,/fields\.bin|object\.json|source-assets|geometryResidual|vertexResidual|base64/);assert.doesNotMatch(text,/from\s*['"]\.\.\//);assert.ok(text.length<50000);}});
record('new six-part static connection uses actual dragbox and coach-head construction datums',()=>{
  const link=buildA6StaticCoupling({coachOffsetZ:32.34}),loco=buildLocomotiveMechanics(),e=link.evidence;
  assert.ok(near(e.tender.nativeConstructionCentre[2],loco.parameters.derived.tenderFrameEnd,1e-9));
  assert.equal(e.coach.nativeConstructionCentre[1],mechanics.parameters.couplingHeight);
  assert.ok(near(e.coach.nativeConstructionCentre[2],-mechanics.parameters.bodyLength/2-.145,1e-9));
  assert.ok(near(e.coach.assembledConstructionCentre[2],20.91,1e-9));assert.equal(e.heightDifferenceM,.48);
  const original=loco.parts.find(p=>p.name==='tender-end-dragbox-1');assert.ok(original.positions.some((v,i)=>i%3===2&&near(v,e.tender.mainBeamRearFaceZ,1e-8)));
  assert.equal(link.parts.length,6);assert.ok(link.parts.every(p=>p.metadata.originalMechanicalComponent===false&&p.metadata.provisional&&p.metadata.visibleWhenShellHidden));
  assert.ok(link.bounds.max[1]<1.60);assert.equal(link.interfaces.noOriginalPartsChanged,true);
  report.newStaticCoupling={separateFromFrozenMechanics:true,partCount:6,bounds:link.bounds,evidence:link.evidence,provisional:true,structuralOrKinematicCertification:false};
});
record('new static coupling is closed, finite and editable without changing existing mechanics',()=>{
  const hash=partsHash(mechanics.parts),link=buildA6StaticCoupling();geometryHealth(link);for(const p of link.parts){const topology=manifold([p]);assert.equal(topology.nonManifoldEdges,0,p.name);assert.ok(topology.signedVolume>0,p.name);}
  const shifted=buildA6StaticCoupling({coachOffsetZ:32.55});assert.ok(near(shifted.evidence.coach.assembledConstructionCentre[2]-link.evidence.coach.assembledConstructionCentre[2],.21));assert.deepEqual(shifted.evidence.tender,link.evidence.tender);assert.equal(partsHash(mechanics.parts),hash);assert.equal(mechanics.parts.length,238);assert.throws(()=>buildA6StaticCoupling({coachOffsetZ:31}));
});
test('write detailed CPU evidence',()=>{report.coachHash=partsHash(coach.parts);report.tenderHash=partsHash(tender.parts);report.counts.coachTriangles=coach.parts.reduce((n,p)=>n+p.indices.length/3,0);report.counts.tenderTriangles=tender.parts.reduce((n,p)=>n+p.indices.length/3,0);writeFileSync(new URL('a6-connected-shells.qa.json',import.meta.url),JSON.stringify(report,null,2)+'\n');});
