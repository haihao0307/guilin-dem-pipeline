import{makeNativeGroom}from './NativeGroom.mjs';
import{buildDenseStrands}from './DenseStrands.mjs';
import{splitRootPatches,buildBundleVolumes,populationBudget,samplePatchRoots}from './BundleVolumes.mjs';
import{buildNativeSurface,projectDomain,normalArray,verifyNativeInput}from'./NativeSurface.mjs';
import{GuideBuilder,validate}from'./GuideKernel.mjs';
import{buildCoverage}from'./GuideExchange.mjs';
let surface,builder,last,coverage,scalp,rootPatches,volumeKey,volumeCurves,volumePlan,strandKey,strands,nativeReference;
function enrich(progress){const key=JSON.stringify({...last.recipe,hairDensity:0});if(volumeKey!==key){rootPatches=splitRootPatches(scalp,last.recipe);last.volumes=buildBundleVolumes(rootPatches,last,builder);volumeCurves=last.curves;volumePlan=last.bundlePlan;volumeKey=key;}else{last.curves=volumeCurves;last.bundlePlan=volumePlan;}last.population=populationBudget(rootPatches,last.recipe.hairDensity);const sk=JSON.stringify(last.recipe);if(sk!==strandKey){strands=buildDenseStrands(builder,last.population,progress);strandKey=sk;}last.strands=strands;last.volumes.denseFollowersGenerated=true;return last;}
self.onmessage=async e=>{const{id,type}=e.data;const progress=(generated,total)=>self.postMessage({id,type:'progress',generated,total});try{
 if(type==='init'){nativeReference={positions:e.data.input.positions,triangles:e.data.input.triangles};await verifyNativeInput(e.data.input);surface=buildNativeSurface(e.data.input);scalp=projectDomain(surface,e.data.input.chart);const normals=normalArray(surface.head.positions,surface.head.triangles);builder=new GuideBuilder(surface.head,surface.roots,normals);last=builder.build(validate(e.data.recipe));enrich(progress);self.postMessage({id,type:'result',...last,roots:surface.roots,scalp,nativeReport:surface.report});return;}
 if(!builder)throw Error('完整人物尚未完成绑定');
 if(type==='groom-download'){coverage??=buildCoverage(surface.head,surface.roots,last.curves,last.recipe);const pack=makeNativeGroom(surface,last,rootPatches,coverage,nativeReference,e.data.native,e.data.design,e.data.archive,e.data.placement),blob=new Blob([JSON.stringify(pack)]),bytes=await new Response(blob.stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer();self.postMessage({id,type,bytes,summary:{rootCount:pack.coverage.rootCount,guideCount:pack.guides.length}},[bytes]);return;}
 if(type==='audit'){self.postMessage({id,type:'audit',audit:builder.audit(last,e.data.probeMM||8)});return;}
 if(type==='population'){self.postMessage({id,type:'population',budget:last.population,rootPatches:rootPatches.patches.map(p=>({id:p.id,parent:p.parent,area:p.area,cells:p.cells.map(c=>({f:c.f,v:c.v.map(v=>({b:v.b,chartP:v.chartP})),area:c.area,cdf:c.cdf}))}))});return;}
 if(type==='coverage'){coverage??=buildCoverage(surface.head,surface.roots,last.curves,last.recipe);self.postMessage({id,type:'coverage',coverage});return;}
 const previousVolumes=last.volumes;last=builder.build(validate(e.data.recipe));last.volumes=previousVolumes;enrich(progress);coverage=null;self.postMessage({id,type:'result',...last});
 }catch(error){self.postMessage({id,error:String(error.stack||error)});}};
