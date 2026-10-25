/* Builds only this study. Copy alongside r29 sources only after parent review. */
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),P=require('./topology-parameters'),E=require('./middle_cover_export');
const model=fs.existsSync(path.join(__dirname,'scene.js'))?__dirname:path.resolve(__dirname,'../r29'),c={};c.window=c;vm.createContext(c);
for(const name of ['scene.js','dynamic.js','outside_valve_solver.js','valve-dynamic.js','gresley_solver.js','side_offset_solver.js','gresley-dynamic.js','stack-fields.js']){if(name==='side_offset_solver.js')vm.runInContext(fs.readFileSync(path.join(__dirname,'topology-parameters.js'),'utf8'),c);vm.runInContext(fs.readFileSync(path.join(model,name),'utf8'),c,{filename:name});}
const G=c.DYNAMIC.gresleySolver,pose=G.pose(.4),pack=E.pack(P,{qRef:pose.qMiddle,pinMRef:pose.pins.M});
const prefix=c.SCENE.sources.motion.slice(0,c.SCENE.sources.motion.indexOf('float '+c.SCENE.parts.find(p=>p.source==='motion').glsl_function+'('));
const strip=p=>{const {glsl,shape,...part}=p;return part;},data={...pack,source:prefix+pack.source,parts:pack.parts.filter(p=>p.source==='installation').map(strip),movingParts:pack.parts.filter(p=>p.source==='stack').map(strip)};
delete data.helper;
fs.writeFileSync(path.join(__dirname,'middle-chest-fields.js'),'window.MIDDLE_CHEST='+JSON.stringify(data)+';\n');
fs.writeFileSync(path.join(__dirname,'COVER_EXPORT.json'),JSON.stringify(pack,null,2)+'\n');
fs.writeFileSync(path.join(__dirname,'COVER_FIELDS.glsl'),pack.source+'\n'+pack.movingSource+'\n');
console.log(JSON.stringify({static:data.parts.length,moving:data.movingParts.length,minimumAnalyticMargins:pack.minimumAnalyticMargins,output:__dirname}));
