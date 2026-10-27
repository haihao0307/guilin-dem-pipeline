'use strict';
const fs=require('fs'),vm=require('vm'),path=require('path');
const files=['scene.js','dynamic.js','outside_valve_solver.js','valve-dynamic.js','gresley_solver.js','topology-parameters.js','side_offset_solver.js','gresley-dynamic.js','stack-fields.js','stack-dynamic.js','middle-chest-fields.js','middle-chest-dynamic.js','frame-support-fields.js','frame-support-dynamic.js','material-wave-study/material-waves.js','material-wave-study/rigid-coordinates.js','material-renderer.js'];
module.exports=function(baseDirectory){
 const root=path.resolve(baseDirectory||process.env.A4_BASE_SCENE||process.argv[2]||process.cwd());
 if(!fs.existsSync(path.join(root,'scene.js')))throw Error('Pass the scene directory: node test-candidate.js /path/to/scene, or set A4_BASE_SCENE. No workspace-specific path is assumed.');
 const c={};c.window=c;vm.createContext(c);for(const f of files)vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),c,{filename:f});return c;
};
module.exports.files=files;
