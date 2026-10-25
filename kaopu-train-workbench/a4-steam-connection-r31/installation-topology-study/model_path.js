'use strict';const fs=require('fs'),path=require('path');
function modelPath(argv=process.argv.slice(2)){
 const i=argv.indexOf('--model');if(i>=0){if(!argv[i+1])throw Error('--model requires a directory');return path.resolve(argv[i+1]);}
 for(const p of [path.resolve(__dirname,'../r29'),path.resolve(__dirname,'..')])if(fs.existsSync(path.join(p,'scene.js')))return p;
 throw Error('Model not found; supply --model /absolute/path/to/r29');
}
module.exports={modelPath};
