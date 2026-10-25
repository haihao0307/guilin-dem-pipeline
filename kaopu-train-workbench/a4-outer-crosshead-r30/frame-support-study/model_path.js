'use strict';
const fs=require('fs'),path=require('path');
function modelPath(argv=process.argv.slice(2)){
 const i=argv.indexOf('--model');
 if(i>=0){if(!argv[i+1])throw Error('--model requires a directory');const p=path.resolve(argv[i+1]);if(!fs.existsSync(path.join(p,'scene.js')))throw Error('No scene.js under '+p);return p;}
 for(const p of [path.resolve(__dirname,'..'),path.resolve(__dirname,'../r29')])if(fs.existsSync(path.join(p,'scene.js')))return p;
 throw Error('Model not found; supply --model /absolute/path/to/r29');
}
function topologyPath(model=modelPath()){
 for(const p of [path.join(model,'installation-topology-study'),path.resolve(__dirname,'../installation-topology-study'),path.resolve(__dirname,'../installation-topology-r29-study')])if(fs.existsSync(path.join(p,'side_offset_solver.js')))return p;
 throw Error('Side-offset solver package not found beside selected model');
}
module.exports={modelPath,topologyPath};
