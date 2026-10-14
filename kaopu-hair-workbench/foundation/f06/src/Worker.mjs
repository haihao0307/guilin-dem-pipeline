import{buildNativeSurface,projectDomain,normalArray,verifyNativeInput}from'./NativeSurface.mjs';
import{GuideBuilder,validate}from'./GuideKernel.mjs';
import{buildCoverage}from'./GuideExchange.mjs';
let surface,builder,last,coverage;
self.onmessage=async e=>{const{id,type}=e.data;try{
 if(type==='init'){await verifyNativeInput(e.data.input);surface=buildNativeSurface(e.data.input);const scalp=projectDomain(surface,e.data.input.chart),normals=normalArray(surface.head.positions,surface.head.triangles);builder=new GuideBuilder(surface.head,surface.roots,normals);last=builder.build(validate(e.data.recipe));self.postMessage({id,type:'result',...last,roots:surface.roots,scalp,nativeReport:surface.report});return;}
 if(!builder)throw Error('完整人物尚未完成绑定');
 if(type==='audit'){self.postMessage({id,type:'audit',audit:builder.audit(last,e.data.probeMM||8)});return;}
 if(type==='coverage'){coverage??=buildCoverage(surface.head,surface.roots,last.curves);self.postMessage({id,type:'coverage',coverage});return;}
 last=builder.build(validate(e.data.recipe));self.postMessage({id,type:'result',...last});
 }catch(error){self.postMessage({id,error:String(error.stack||error)});}};
