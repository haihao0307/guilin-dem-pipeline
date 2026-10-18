/** Actual A4 teacher meridian + all 22 shared-form, endpoint-trimmed spoke directions. No student/A6 dependency.
 * Integration intentionally preserves source topology, untouched detail, authored normals and UVs.
 * R03: 60 wheel meridian + 263 spoke family + 42 hub meridian shape scalars; no packaged vertex buffer.
 */
import {DEFAULT_WHEEL_RULES as SHELL_RULES} from './wheel-profile-data.mjs';
import {SPOKE_FAMILY,buildSpokeReferenceSamples,measuredSpokePoint} from './wheel-spoke-family.mjs';
import {HUB_PATCH_RULES,reconstructHubPatchPositions} from './hub-lathe-rules.mjs';
export {HUB_PATCH_RULES,hubMeridian,hubSurfacePoint,generateHubPatchData} from './hub-lathe-rules.mjs';
export {SPOKE_FAMILY,measuredSpokePoint,generateMeasuredSpoke,generateMeasuredSpokeData} from './wheel-spoke-family.mjs';
export const DEFAULT_WHEEL_RULES={...SHELL_RULES,schema:'a4-wheel-surface-rules/3',spokeFamily:SPOKE_FAMILY,limitations:[
 'All 22 teacher spoke directions (44 mirrored spokes) now share an elliptical section and measured root/rim trim surfaces; this is not a claim about real A4 spoke counts.',
 '30 meridian stations contribute 60 numeric shape dimensions; spoke family contributes 263 numeric shape dimensions and 2 material-seam sampling dimensions.',
 'Integrated geometry still uses original topology, authored split normals, UVs and material partitioning.',
 'R03 adds 21 mirrored hub meridian stations (42 shape scalars); the eccentric central shaft, nonuniform end caps, crank/counterweight and unmodeled shell patches remain source-dependent.',
 'Hub controls are local sensitivity experiments; moving generated boundary rings can deform source-retained transition triangles and is not an engineering dimensional redesign.'
]};
const sampleCache=new WeakMap();
function samplesFor(rules){let q=sampleCache.get(rules);if(!q){q=buildSpokeReferenceSamples(rules.spokeFamily||SPOKE_FAMILY);sampleCache.set(rules,q);}return q;}
const TAU=Math.PI*2;
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);

/** Editable piecewise-linear meridian; u addresses source section stations, not mesh vertices. */
export function wheelMeridian(u,options={}) {
  const rules=options.rules||DEFAULT_WHEEL_RULES,p=rules.profile,L=p.length;
  const a=((Math.floor(u)%L)+L)%L,b=(a+1)%L,f=u-Math.floor(u);
  let x=p[a].x*(1-f)+p[b].x*f,r=p[a].radius*(1-f)+p[b].radius*f;
  const datum=options.axialDatum??rules.spoke.centerX;
  x=datum+(x-datum)*(options.axialWidthScale??1)+(options.halfGaugeDelta??0);
  r*=options.radiusScale??1;
  if(options.editMeridian) [x,r]=options.editMeridian(u,x,r);
  return [x,r];
}
export function wheelSurfacePoint(u,theta,side=1,options={}) {
  const [x,r]=wheelMeridian(u,options),c=(options.rules||DEFAULT_WHEEL_RULES).centerYZ;
  return [side*x,c[0]+r*Math.cos(theta),c[1]+r*Math.sin(theta)];
}
/** Elliptic section extruded radially, with the measured V-shaped end/root shear. */
export function spokePoint(end,phi,side=1,options={}) {
  const p=(options.rules||DEFAULT_WHEEL_RULES).spoke,s=options.spoke||{};
  const x=p.centerX+(p.halfWidthX*(s.axialScale??1))*Math.cos(phi)+(options.halfGaugeDelta??0);
  const tang=p.centerTangential+p.halfWidthTangential*(s.tangentialScale??1)*Math.sin(phi);
  const rad=p.rootRadial+(s.rootDelta??0)+end*p.length*(s.lengthScale??1)+p.endRadialSinAbs*Math.abs(Math.sin(phi));
  // This certified pair points at -Y. A free rotation is available in standalone generation.
  const rotation=s.rotation??0,c=Math.cos(rotation),sn=Math.sin(rotation);
  return [side*x,-rad*c-tang*sn,-rad*sn+tang*c];
}
function matchRule(v,node,rules) {
  const [x,y,z]=v,r=Math.hypot(y-rules.centerYZ[0],z-rules.centerYZ[1]),side=x<0?-1:1,tol=rules.selectionTolerance;
  if(r>.89&&Math.abs(x)>.69&&Math.abs(x)<.86) {
    for(let k=0;k<rules.profile.length;k++) {
      const p=rules.profile[k];
      if(Math.hypot(Math.abs(x)-p.x,r-p.radius)>tol)continue;
      const theta=Math.round(Math.atan2(z-rules.centerYZ[1],y-rules.centerYZ[0])*rules.angularSegments/TAU)*TAU/rules.angularSegments;
      if(distance(v,wheelSurfacePoint(k,theta,side,{rules}))<=tol)return {kind:'lathe',k,theta,side};
    }
  }
  if((node===8||node===10)&&Math.abs(x)>.713&&Math.abs(x)<.848&&r>.17&&r<1.001) {
    let best=null,bestDistance=tol;
    for(const q of samplesFor(rules)) {
      const p=q.point,d=Math.hypot(Math.abs(x)-p[0],y-p[1],z-p[2]);
      if(d<=bestDistance){bestDistance=d;best={kind:'spoke',index:q.index,end:q.e,phi:q.phi,side};}
    }
    if(best)return best;
  }
  return null;
}
/** Pure-array core shared by the Three integration and CPU test. Topology is never discarded. */
export function reconstructPositions(positions,node,options={}) {
  const rules=options.rules||DEFAULT_WHEEL_RULES,out=new Float32Array(positions),kinds=new Uint8Array(positions.length/3),spokeIndices=new Int16Array(positions.length/3).fill(-1);
  let maxDisplacement=0;
  for(let i=0;i<kinds.length;i++) {
    const v=[positions[i*3],positions[i*3+1],positions[i*3+2]],m=matchRule(v,node,rules);
    if(!m)continue;
    const q=m.kind==='lathe'?wheelSurfacePoint(m.k,m.theta,m.side,options):measuredSpokePoint(m.index,m.end,m.phi,m.side,{...options,spokeFamily:rules.spokeFamily,faceted:true});
    out.set(q,i*3);kinds[i]=m.kind==='lathe'?1:2;if(m.kind==='spoke')spokeIndices[i]=m.index;
    maxDisplacement=Math.max(maxDisplacement,distance(v,[out[i*3],out[i*3+1],out[i*3+2]]));
  }
  const hubStations=new Int16Array(kinds.length).fill(-1);let hubOverlapVertices=0;
  if(node===10) {
    const hub=reconstructHubPatchPositions(positions,{...(options.hub||{}),rules:options.hubRules||HUB_PATCH_RULES});
    for(let i=0;i<kinds.length;i++)if(hub.kinds[i]) {
      if(kinds[i]){hubOverlapVertices++;throw new Error('HUB_PATCH_OVERLAPS_EXISTING_WHEEL_RULE');}
      out.set(hub.positions.subarray(i*3,i*3+3),i*3);kinds[i]=3;hubStations[i]=hub.stations[i];
      maxDisplacement=Math.max(maxDisplacement,Math.hypot(out[i*3]-positions[i*3],out[i*3+1]-positions[i*3+1],out[i*3+2]-positions[i*3+2]));
    }
  }
  return {positions:out,kinds,spokeIndices,hubStations,hubOverlapVertices,maxDisplacement};
}
export function coverageForIndices(kinds,indices) {
  const r={triangles:indices.length/3,fullyRuleGenerated:0,hybridRuleAndSource:0,unchangedSourceFallback:0,fullyLathe:0,fullySpoke:0,fullyHub:0};
  for(let i=0;i<indices.length;i+=3) {
    const q=[kinds[indices[i]],kinds[indices[i+1]],kinds[indices[i+2]]];
    if(q.every(Boolean)){r.fullyRuleGenerated++;if(q.every(k=>k===1))r.fullyLathe++;if(q.every(k=>k===2))r.fullySpoke++;if(q.every(k=>k===3))r.fullyHub++;}
    else if(q.some(Boolean))r.hybridRuleAndSource++;
    else r.unchangedSourceFallback++;
  }
  return r;
}
/** Expected integration: clone original scene and replace only node 8/9/10 geometries. */
export function rebuildSourceWheel(T,sourceGeometryByNode,options={}) {
  const geometriesByNode={},nodes={};
  for(const node of [8,9,10]) {
    const original=sourceGeometryByNode[node];
    if(!original?.attributes?.position||!original.index)throw new Error(`Indexed original geometry required for node ${node}`);
    const position=original.attributes.position;
    if(position.itemSize!==3||position.isInterleavedBufferAttribute)throw new Error('Provide original noninterleaved VEC3 positions');
    const result=reconstructPositions(position.array,node,options),geometry=original.clone();
    geometry.setAttribute('position',new T.BufferAttribute(result.positions,3));
    if(options.recomputeNormals)geometry.computeVertexNormals();
    geometry.computeBoundingBox();geometry.computeBoundingSphere();
    const counts=coverageForIndices(result.kinds,original.index.array);
    nodes[node]={...counts,vertices:result.kinds.length,latheVertices:Array.from(result.kinds).filter(k=>k===1).length,spokeVertices:Array.from(result.kinds).filter(k=>k===2).length,hubVertices:Array.from(result.kinds).filter(k=>k===3).length,hubOverlapVertices:result.hubOverlapVertices,maxSourceVertexDisplacement:result.maxDisplacement,materialIndex:{8:1,9:2,10:3}[node]};
    geometry.userData={...original.userData,wheelRuleCoverage:nodes[node]};geometriesByNode[node]=geometry;
  }
  return {geometriesByNode,report:{units:'UNCHANGED_SOURCE_UNITS_NOT_METRES',nodes,topology:'Original indices and all triangles retained; no closure caps inserted',normals:options.recomputeNormals?'Recomputed on existing split vertex topology; compare separately':'Original authored split normals retained, not generated by these rules',materials:'Keep original mesh materials 1/2/3 unchanged; no textures bound',parameterAccounting:{meridianShapeScalars:60,spokeFamilyShapeScalars:SPOKE_FAMILY.parameterAccounting.shapeScalars,hubMeridianShapeScalars:42,totalShapeScalars:365,topologyMaterialSeamScalars:2,openRootTopologyFlags:2,sourceCoordinatesStored:0},limitations:DEFAULT_WHEEL_RULES.limitations}};
}
/** Independent regular lathe preview. This includes the complete meridian, but intentionally
 * does not claim to encode the irregular source inner-wall patches or material seam holes. */
export function generateRegularWheelShell(T,options={}) {
  const rules=options.rules||DEFAULT_WHEEL_RULES,N=options.angularSegments||rules.angularSegments,L=rules.profile.length,side=options.side??1;
  const pos=[],idx=[],groups=[];
  for(let k=0;k<L;k++)for(let j=0;j<N;j++)pos.push(...wheelSurfacePoint(k,TAU*j/N,side,options));
  for(let k=0;k<L;k++) {
    const band=rules.bands.find(b=>b.from<=b.to?(k>=b.from&&k<b.to):k>=b.from||k<b.to);
    const start=idx.length;
    for(let j=0;j<N;j++) {const a=k*N+j,b=k*N+(j+1)%N,c=((k+1)%L)*N+j,d=((k+1)%L)*N+(j+1)%N;if(side>0)idx.push(a,b,c,b,d,c);else idx.push(a,c,b,b,c,d);}
    groups.push({start,count:idx.length-start,materialIndex:band.material-1});
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setIndex(idx);for(const q of groups)g.addGroup(q.start,q.count,q.materialIndex);g.computeVertexNormals();return g;
}
/** Independent true section/endpoint rule; materials [black source 3, silver source 1]. */
export function generateEllipticSpoke(T,options={}) {
  const p=(options.rules||DEFAULT_WHEEL_RULES).spoke,N=options.spokeSegments||p.segments,side=options.side??1,pos=[],idx=[];
  for(let e=0;e<2;e++)for(let j=0;j<N;j++)pos.push(...spokePoint(e,TAU*j/N,side,options));
  for(let j=0;j<N;j++){const a=j,b=(j+1)%N,c=N+j,d=N+(j+1)%N;idx.push(a,c,b,b,c,d);}
  for(let j=1;j<N-1;j++)idx.push(0,j,j+1);
  const silverStart=idx.length;for(let j=1;j<N-1;j++)idx.push(N,N+j+1,N+j);
  if(side<0)for(let i=0;i<idx.length;i+=3)[idx[i+1],idx[i+2]]=[idx[i+2],idx[i+1]];
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setIndex(idx);g.addGroup(0,silverStart,0);g.addGroup(silverStart,idx.length-silverStart,1);g.computeVertexNormals();return g;
}
