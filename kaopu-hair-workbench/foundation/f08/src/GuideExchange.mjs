import {validateBundlePlan,bundleOf,BUNDLES} from './BundlePlan.mjs';
import {validateStyleRules} from './StyleRules.mjs';
import {enabled,SETTINGS,point,V,normalArray,growth} from './NativeSurface.mjs';
import {unit,sub,add,mul,dot,cross,len} from './approved/LegacyFoundation.mjs';
import {region} from './GuideKernel.mjs';
import {TARGET,validateDesign} from './Design.mjs';
// Attachment basis uses actual triangle edges in double precision. Smoothed
// Float32 shading normals are deliberately not the attachment coordinate frame.
export function nativeFrame(head,face,bary){const ids=head.triangles.slice(face*3,face*3+3),origin=point(head,face,bary),edge=sub(V(head.positions,ids[1]),V(head.positions,ids[0])),other=sub(V(head.positions,ids[2]),V(head.positions,ids[0])),n=unit(cross(edge,other)),t=unit(edge),b=unit(cross(n,t));return{origin,t,b,n};}
export function localOffsets(points,f){const out=[];for(let j=0;j<points.length;j+=3){const d=sub(points.slice(j,j+3),f.origin);out.push(dot(d,f.t),dot(d,f.b),dot(d,f.n));}return out;}
export function bindGuide(head,guide){const f=nativeFrame(head,guide.binding.triangle,guide.binding.barycentric),p=[];for(let j=0;j<guide.localOffsets.length;j+=3)p.push(...add(f.origin,add(mul(f.t,guide.localOffsets[j]),add(mul(f.b,guide.localOffsets[j+1]),mul(f.n,guide.localOffsets[j+2])))));return p;}
export function nativeDisplayHead(model,viewer){if(model.canonical.topologySha256!==TARGET.topology||model.adapterFingerprint!==TARGET.adapterFingerprint||model.vertexCount!==25417)throw Error('完整人物适配器不兼容');return{positions:Array.from(viewer.geometry.attributes.position.array.slice(0,model.vertexCount*3)),triangles:Array.from(model.faces),topology:model.canonical.topologySha256,coordinateSystem:TARGET.positionAuthority};}
export function buildCoverage(head,roots,guides,recipe=null){
 const active=roots.filter(r=>enabled(r,SETTINGS)),bundleMode=recipe?.family==='portrait-bob';
 // Coverage stays inside the SAME scalp root patch and whole-bundle identity.
 // Distances use the intrinsic scalp chart samples, not through-head chords.
 // This is a sparse ownership map, not generated follower geometry.
 const guideSet=new Set(guides.map(g=>g.rootId));let missing=0;
 const bindings=active.map(r=>{
  const reg=region(r.chartP||r.p),bundleId=bundleMode?bundleOf(r,recipe):null;
  const candidates=guides.filter(g=>bundleMode?g.bundleId===bundleId:g.region===reg).map(g=>{const q=roots[g.rootId].chartP||roots[g.rootId].p,p=r.chartP||r.p;return[g.rootId,len(sub(p,q))];}).sort((a,b)=>a[1]-b[1]||a[0]-b[0]);
  const selected=guideSet.has(r.id)?[[r.id,0]]:candidates.slice(0,3);if(!selected.length)missing++;
  const weights=selected.map(([,d])=>1/Math.max(.001,d)**2),sum=weights.reduce((a,b)=>a+b,0);
  return{rootId:r.id,region:reg,bundleId,partSide:null,triangle:r.f,barycentric:r.b.slice(),influences:selected.map(([guideRootId,distance],i)=>({guideRootId,distanceMM:distance*1000,weight:weights[i]/sum})),status:selected.length?'covered':'uncovered'};
 });
 return{method:'K=3 intrinsic-chart sample distance WITHIN exclusive root patch; not exact geodesic or dense interpolation',rootCount:bindings.length,guideCount:guides.length,uncovered:missing,bindings};
}

export function exportGroom(head,roots,result,design,coverage,normals){
 const doc=validateDesign(design);if(JSON.stringify(doc.recipe)!==JSON.stringify(result.recipe))throw Error('方案已变化，等待最新导向后再导出');if(coverage.uncovered)throw Error('仍有未覆盖毛根，不导出不完整绑定包');
 const guides=result.curves.map(g=>{const frame=nativeFrame(head,g.face,g.barycentric,normals);return{id:'guide-'+g.rootId,rootId:g.rootId,region:g.region,bundleId:g.bundleId||null,binding:{triangle:g.face,barycentric:g.barycentric.slice()},frame,localOffsets:localOffsets(g.points,frame),designPoints:g.points.slice(),arcLengthMM:g.actualMM,styleProfile:g.styleProfile?structuredClone(g.styleProfile):null};});
 return{schema:'kaopu/guide-groom@4',target:{...TARGET,vertexCount:head.positions.length/3,triangleCount:head.triangles.length/3},units:'metre',coordinates:TARGET.positionAuthority,design:doc,states:{design:doc.recipe.family==='portrait-bob'?'authored-from-single-front-reference':'static-gravity-directed-reference',rest:null,equilibrium:null,runtime:null},guides,coverage:structuredClone(coverage),extensions:{appearance:null,physics:null},limits:['Root chart distances are approximate, not surface geodesics','No dense followers generated','No physics/rest-equilibrium calibration','Local-frame attachment tested on rigid transforms; nonrigid deformation not certified','Finite-radius follower collision still required']};
}
export function validateGroom(pack){
 if(pack?.schema!=='kaopu/guide-groom@4'||pack.units!=='metre'||pack.coordinates!==TARGET.positionAuthority||Object.entries(TARGET).some(([k,v])=>pack.target?.[k]!==v)||pack.target.vertexCount!==25417||pack.target.triangleCount!==50624)throw Error('绑定包目标或版本无效');
 validateDesign(pack.design);
 if(!Array.isArray(pack.guides)||pack.guides.length!==192||new Set(pack.guides.map(g=>g.rootId)).size!==192)throw Error('导向集合无效');
 const validBinding=b=>Number.isInteger(b.triangle)&&b.triangle>=0&&b.triangle<50624&&Array.isArray(b.barycentric)&&b.barycentric.length===3&&b.barycentric.every(v=>Number.isFinite(v)&&v>=-1e-8&&v<=1+1e-8)&&Math.abs(b.barycentric.reduce((s,v)=>s+v,0)-1)<1e-8;
 const guideMap=new Map();for(const g of pack.guides){if(!Number.isInteger(g.rootId)||g.rootId<0||g.rootId>=3300||!validBinding(g.binding)||!Number.isInteger(g.region)||g.region<0||g.region>5||!Array.isArray(g.localOffsets)||g.localOffsets.length<6||g.localOffsets.length>1503||g.localOffsets.length%3||g.localOffsets.some(v=>!Number.isFinite(v)||Math.abs(v)>1)||g.localOffsets.slice(0,3).some(v=>Math.abs(v)>1e-8)||!Array.isArray(g.designPoints)||g.designPoints.length!==g.localOffsets.length||g.designPoints.some(v=>!Number.isFinite(v)))throw Error('导向绑定数据无效');guideMap.set(g.rootId,g);}
 const coverage=pack.coverage;if(!coverage||coverage.uncovered!==0||coverage.rootCount!==3067||!Array.isArray(coverage.bindings)||coverage.bindings.length!==3067||new Set(coverage.bindings.map(b=>b.rootId)).size!==3067)throw Error('根点覆盖不完整');
 for(const r of coverage.bindings){if(!validBinding(r)||r.status!=='covered'||!Number.isInteger(r.rootId)||r.rootId<0||r.rootId>=3300||!Array.isArray(r.influences)||r.influences.length<1||r.influences.length>3||new Set(r.influences.map(i=>i.guideRootId)).size!==r.influences.length||r.influences.some(i=>!guideMap.has(i.guideRootId)||(r.bundleId?guideMap.get(i.guideRootId).bundleId!==r.bundleId:guideMap.get(i.guideRootId).region!==r.region)||(r.partSide!==null&&r.partSide!==undefined&&guideMap.get(i.guideRootId).styleProfile?.sign!==r.partSide)||!Number.isFinite(i.weight)||i.weight<0||!Number.isFinite(i.distanceMM)||i.distanceMM<0)||Math.abs(r.influences.reduce((s,i)=>s+i.weight,0)-1)>1e-8)throw Error('根点覆盖权重或区域无效');}
 if(pack.extensions?.motionRules)validateStyleRules(pack.extensions.motionRules,pack.guides);if(pack.extensions?.shapeVolume)throw Error('F08 不接受旧版独立外壳');if(pack.design.recipe.family==='portrait-bob'&&!pack.extensions?.bundlePlan)throw Error('参考发型必须带根区与整束契约');if(pack.extensions?.bundlePlan){validateBundlePlan(pack.extensions.bundlePlan,pack.guides);const owners=new Map(pack.extensions.bundlePlan.rootBindings.map(b=>[b.rootId,b]));for(const b of coverage.bindings){const o=owners.get(b.rootId);if(!o||o.bundleId!==b.bundleId||o.triangle!==b.triangle||JSON.stringify(o.barycentric)!==JSON.stringify(b.barycentric))throw Error('覆盖与根区原生绑定不一致');}}
 return pack;
}
// Minimal consumer for the other workbench. No renderer or physics dependency.
// Verify actual triangle ordering, not just a self-declared topology string.
export async function attachGroom(head,pack){
 validateGroom(pack);if(head.topology!==TARGET.topology||head.coordinateSystem!==TARGET.positionAuthority||head.positions.length!==25417*3||head.triangles.length!==50624*3||head.positions.some(v=>!Number.isFinite(v)))throw Error('完整人物网格或坐标系不兼容；请使用 nativeDisplayHead');
 const data=new TextEncoder().encode(JSON.stringify(Array.from(head.triangles))),digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',data)),v=>v.toString(16).padStart(2,'0')).join('');if(digest!==TARGET.indexSHA256)throw Error('原生三角面顺序不匹配');
 return{schema:'kaopu/attached-guide-groom@4',designId:pack.design.id,revision:pack.design.revision,guides:pack.guides.map(g=>({id:g.id,rootId:g.rootId,region:g.region,points:bindGuide(head,g)})),coverage:pack.coverage,physicsState:null};
}
