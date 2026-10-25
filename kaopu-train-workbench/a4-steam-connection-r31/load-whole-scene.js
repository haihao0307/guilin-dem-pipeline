'use strict';const fs=require('fs'),path=require('path'),vm=require('vm'),crypto=require('crypto');
module.exports=function(root=__dirname){
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 const excluded=new Set(['app.js','controls.js','steam-inspection.js']);
 const files=[...html.matchAll(/<script src="([^"]+)"/g)].map(m=>m[1]).filter(x=>!excluded.has(x));
 const C={};C.window=C;vm.createContext(C);
 for(const f of files){if(path.isAbsolute(f)||f.split('/').includes('..'))throw Error('Unexpected page script location');vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),C,{filename:f});}
 return {context:C,scene:C.SCENE,dynamic:C.DYNAMIC,files,sha256:Object.fromEntries(files.map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,f))).digest('hex')]))};
};
