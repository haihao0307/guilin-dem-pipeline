const fs=require('fs'),path=require('path');
const P=JSON.parse(fs.readFileSync(path.join(__dirname,'frame-support-study/SUPPORT_EXPORT.json')));
fs.writeFileSync(path.join(__dirname,'frame-support-fields.js'),'window.FRAME_SUPPORT='+JSON.stringify(P)+';\n');
console.log(JSON.stringify({parts:P.parts.length,replaces:P.replaceStackIds,conditionalApertures:P.frameHostCuts.length}));
