// Version-bound transport only: the scalp/person are shared, and unchanged
// complete guides are reused exactly. No geometric interpolation at load time.
export function packExperiment(baseline,lab,baseSHA256){
 const patch={schema:'kaopu/flow-experiment-patch@1',baseSHA256,fields:{},guides:[],unshapedGuides:[]};
 for(const[key,value]of Object.entries(lab)){
  if(key==='guides'||key==='unshapedGuides'){for(const g of value){const old=baseline[key].find(q=>q.id===g.id);if(JSON.stringify(g)!==JSON.stringify(old))patch[key].push(g);}}
  else if(JSON.stringify(value)!==JSON.stringify(baseline[key]))patch.fields[key]=value;
 }return patch;
}
export function unpackExperiment(baseline,patch,baseSHA256){
 if(patch.schema!=='kaopu/flow-experiment-patch@1'||patch.baseSHA256!==baseSHA256)throw Error('Experiment baseline version mismatch');
 const lab={...baseline,...patch.fields};for(const key of ['guides','unshapedGuides']){const changed=new Map(patch[key].map(g=>[g.id,g]));if(changed.size!==patch[key].length||[...changed.keys()].some(id=>!baseline[key].some(g=>g.id===id)))throw Error('Invalid experiment guide identity');lab[key]=baseline[key].map(g=>changed.get(g.id)||g);}
 return lab;
}
