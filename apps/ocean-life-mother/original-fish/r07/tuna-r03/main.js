const files=['runtime/main-00.txt','runtime/main-01.txt','runtime/main-02.txt','runtime/main-03.txt','runtime/main-04.txt','runtime/main-05.txt','runtime/main-06.txt'];
const base=new URL('.',import.meta.url);
const text=(await Promise.all(files.map(async f=>{const r=await fetch(new URL(f,base));if(!r.ok)throw new Error(`${f}:${r.status}`);return r.text()}))).join('');
const bundle=new URL('./source-bundle.mjs',base).href;
const code=text.replace("'./source-bundle.mjs'",JSON.stringify(bundle));
if(code===text)throw new Error('source-bundle import marker missing');
const url=URL.createObjectURL(new Blob([code],{type:'text/javascript'}));
try{await import(url)}finally{URL.revokeObjectURL(url)}
