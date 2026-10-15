const fs=require('fs'),path=require('path');
const source=path.join(__dirname,'public-check-template.cjs');
let code=fs.readFileSync(source,'utf8');
const old='skin-natural-traces-r03-v1',next='skin-natural-traces-r03-v2',count=code.split(old).length-1;
if(count!==1)throw Error('Expected one R03 kernel assertion in public-check template, found '+count);
code=code.replace(old,next);
new Function('require','process','__dirname','__filename',code)(require,process,__dirname,source);
