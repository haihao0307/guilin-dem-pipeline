import {rootBank,domain,SETTINGS,normalArray,signature} from './approved/BoundaryKernel.mjs';
import {GuideBuilder,validate} from './GuideKernel.mjs';
import {buildCoverage,exportGroom}from'./GuideExchange.mjs';
let head,roots,normals,scalp,builder,last,coverage;
self.onmessage=e=>{const {id,type}=e.data;try{if(type==='init'){head=e.data.head;roots=rootBank(head);normals=normalArray(head.positions,head.triangles);scalp=domain(head,SETTINGS);if(signature(roots.flatMap(r=>[r.f,...r.b]))!=='a624b76f')throw Error('已通过根库签名不符');builder=new GuideBuilder(head,roots,normals);}
 if(type==='pack'){coverage??=buildCoverage(head,roots,last.curves);self.postMessage({id,type:'pack',pack:exportGroom(head,roots,last,e.data.design,coverage,normals)});return;}
 if(type==='audit'){self.postMessage({id,type:'audit',audit:builder.audit(last,e.data.probeMM||6)});return;}
 const recipe=validate(e.data.recipe);last=builder.build(recipe);self.postMessage({id,type:'result',...(type==='init'?{roots,normals,scalp}:{}),...last});
}catch(error){self.postMessage({id,error:String(error.stack||error)});}};
