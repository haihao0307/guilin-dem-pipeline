'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'evidence'),kind=process.argv[2];
const check=()=>{try{const q=JSON.parse(fs.readFileSync(path.join(root,'QA.json')));if(q.passed===false){console.error(q.failure);process.exitCode=1;return;}const ready=kind==='first'?fs.existsSync(path.join(root,'public-r23-desktop.png')):kind==='controls'?q.tests.length>=2:kind==='camera'?q.tests.length>=3:typeof q.passed==='boolean';if(ready){console.log(JSON.stringify({kind,stage:q.stage,tests:q.tests.map(x=>x.name),passed:q.passed,commit:q.commit}));return;}}catch{}setTimeout(check,1000);};check();
