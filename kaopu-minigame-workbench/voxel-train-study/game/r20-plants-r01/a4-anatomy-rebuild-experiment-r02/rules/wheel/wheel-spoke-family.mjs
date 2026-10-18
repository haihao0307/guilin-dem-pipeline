/** Shared source-free elliptical section and explicit measured trim surfaces for all 22 directions.
 * Only 263 shape scalars plus 2 material-seam sampling scalars; no source vertex/index/UV buffers.
 * This family is the teacher's 22 directions, not a claim about real A4 spoke count.
 */
import {SPOKE_FAMILY} from './wheel-spoke-data.mjs';
export {SPOKE_FAMILY};
const TAU=2*Math.PI;
const mod=(v,n)=>(v%n+n)%n;
export function spokeTrimPoint(curve,s) {
  const h=curve.kink===undefined?0:Math.max(0,s-curve.kink),d=curve.delta||[0,0];
  return [curve.base[0]+s*curve.slope[0]+h*d[0],curve.base[1]+s*curve.slope[1]+h*d[1]];
}
/** phi is continuous. faceted=true follows the source 32-segment section polygon. */
export function measuredSpokePoint(index,e,phi,side=1,options={}) {
  const family=options.spokeFamily||SPOKE_FAMILY,p=family.spokes[index],section=family.sharedSection,N=family.segments;
  let c=Math.cos(phi),s=Math.sin(phi);
  if(options.faceted) {const u=mod(phi,TAU)*N/TAU,j=Math.floor(u),f=u-j,a=j*TAU/N,b=(j+1)*TAU/N;c=Math.cos(a)*(1-f)+Math.cos(b)*f;s=Math.sin(a)*(1-f)+Math.sin(b)*f;}
  const root=spokeTrimPoint(p.root,s),rim=spokeTrimPoint(p.rim,s),center=section.centerX+(p.centerXOffset||0);
  let x=center+section.halfWidthX*c*(options.spoke?.axialScale??1),y=root[0]*(1-e)+rim[0]*e,z=root[1]*(1-e)+rim[1]*e;
  // Whole-wheel dimensional controls apply consistently across the new family and shell.
  const datum=options.axialDatum??section.centerX;
  x=datum+(x-datum)*(options.axialWidthScale??1)+(options.halfGaugeDelta??0);
  y*=options.radiusScale??1;z*=options.radiusScale??1;
  return [side*x,y,z];
}
/** Locate all polygon-edge intersections with a tangential trim plane s=value. */
export function sectionCutPhis(value,N=SPOKE_FAMILY.segments) {
  const phis=[];
  if(value<=-1||value>=1)return phis;
  for(let j=0;j<N;j++) {const a=j*TAU/N,b=(j+1)*TAU/N,sa=Math.sin(a),sb=Math.sin(b);if(value>Math.min(sa,sb)+1e-8&&value<Math.max(sa,sb)-1e-8)phis.push(a+(b-a)*(value-sa)/(sb-sa));}
  return phis;
}
export function spokeBoundaryPhis(index,e,family=SPOKE_FAMILY) {
  const p=family.spokes[index],curve=e===0?p.root:p.rim,N=family.segments,phis=Array.from({length:N},(_,j)=>j*TAU/N);
  if(curve.kink!==undefined&&Math.abs(curve.kink)>1e-4)phis.push(...sectionCutPhis(curve.kink,N));
  if(e===1)for(const s of p.rimMaterialSeamS||[])phis.push(...sectionCutPhis(s,N));
  return phis.sort((a,b)=>a-b).filter((v,i,a)=>i===0||Math.abs(v-a[i-1])>1e-7);
}
export function buildSpokeReferenceSamples(family=SPOKE_FAMILY) {
  const out=[];
  for(let index=0;index<family.spokes.length;index++)for(let e=0;e<2;e++)for(const phi of spokeBoundaryPhis(index,e,family))out.push({index,e,phi,point:measuredSpokePoint(index,e,phi,1,{spokeFamily:family,faceted:true})});
  return out;
}
/** A source-free spoke surface, with cap triangles split along every trim crease.
 * Four teacher spokes (directions 8 and 15, both sides) keep their original open roots.
 * Source material split patches, authored normals and UVs are intentionally NOT claimed here.
 */
export function generateMeasuredSpokeData(index,options={}) {
  const family=options.spokeFamily||SPOKE_FAMILY,side=options.side??1,all=[...spokeBoundaryPhis(index,0,family),...spokeBoundaryPhis(index,1,family)].sort((a,b)=>a-b);
  const phis=all.filter((v,i)=>!i||Math.abs(v-all[i-1])>1e-7),N=phis.length,positions=[],indices=[],groups=[];
  for(let e=0;e<2;e++)for(const phi of phis)positions.push(...measuredSpokePoint(index,e,phi,side,{...options,faceted:true}));
  const center=[0,0,0];for(let i=0;i<positions.length;i+=3)for(let d=0;d<3;d++)center[d]+=positions[i+d]/(positions.length/3);
  const tri=(a,b,c)=>{
    const A=positions.slice(a*3,a*3+3),B=positions.slice(b*3,b*3+3),C=positions.slice(c*3,c*3+3),u=B.map((v,d)=>v-A[d]),v=C.map((v,d)=>v-A[d]);
    const normal=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
    const facing=normal.reduce((s,v,d)=>s+v*((A[d]+B[d]+C[d])/3-center[d]),0);
    indices.push(...(facing>=0?[a,b,c]:[a,c,b]));
  };
  for(let j=0;j<N;j++){const k=(j+1)%N;tri(j,k,N+j);tri(k,N+k,N+j);}
  groups.push({start:0,count:indices.length,materialIndex:0});
  for(let e=0;e<2;e++) {
    if(e===0&&family.spokes[index].openRoot)continue;
    const start=indices.length,rows=[];
    for(let j=0;j<N;j++) {
      const phi=phis[j],u=mod(phi,TAU)*family.segments/TAU,k=Math.floor(u),f=u-k,s=Math.sin(k*TAU/family.segments)*(1-f)+Math.sin((k+1)*TAU/family.segments)*f;
      let row=rows.find(r=>Math.abs(r.s-s)<1e-7);if(!row){row={s,ids:[]};rows.push(row);}row.ids.push(e*N+j);
    }
    rows.sort((a,b)=>a.s-b.s);for(const r of rows)r.ids.sort((a,b)=>positions[a*3]-positions[b*3]);
    for(let j=0;j<rows.length-1;j++) {
      const a=rows[j].ids,b=rows[j+1].ids;
      if(a.length===1)tri(a[0],b[0],b.at(-1));
      else if(b.length===1)tri(a[0],b[0],a.at(-1));
      else {tri(a[0],b[0],a.at(-1));tri(a.at(-1),b[0],b.at(-1));}
    }
    groups.push({start,count:indices.length-start,materialIndex:e===1?1:0});
  }
  return {positions:new Float32Array(positions),indices:new Uint32Array(indices),groups,spokeIndex:index,side,sourceIndependent:true,openRoot:Boolean(family.spokes[index].openRoot),limits:'Independent topology and computed normals; original material seam patches and UVs are not reconstructed.'};
}
export function generateMeasuredSpoke(T,index,options={}) {
  const r=generateMeasuredSpokeData(index,options),g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(r.positions,3));g.setIndex(new T.BufferAttribute(r.indices,1));for(const q of r.groups)g.addGroup(q.start,q.count,q.materialIndex);g.computeVertexNormals();return g;
}
