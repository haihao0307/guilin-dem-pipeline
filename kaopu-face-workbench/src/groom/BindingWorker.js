import {snapshotModel,createBinding,dehydrateBinding} from './GroomFactory.js';
self.onmessage=({data})=>{
  try{const model=snapshotModel(data.model),out={};for(const region of data.regions||['hair','brows','lashes']){self.postMessage({type:'progress',region});out[region]=dehydrateBinding(createBinding(model,region,data.browHeight||0));}
    const buffers=new Set();function visit(value){if(ArrayBuffer.isView(value)){buffers.add(value.buffer);return;}if(!value||typeof value!=='object'||value instanceof Set)return;for(const child of Object.values(value))visit(child);}visit(out);self.postMessage({type:'complete',bindings:out},[...buffers]);
  }catch(e){self.postMessage({type:'error',error:e.message||String(e)});}
};
