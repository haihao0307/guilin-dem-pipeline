import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {renderPaper} from './paper.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
const pack=JSON.parse(fs.readFileSync(path.join(root,'data/all-patterns.json'),'utf8'));
if(!pack.catalogue.allPatternsStructurallyPassed)throw Error('Not publishing an incomplete pattern batch');
fs.mkdirSync(path.join(root,'data/svg'),{recursive:true});
for(const ticket of pack.patterns)fs.writeFileSync(path.join(root,'data/svg',ticket.id+'.svg'),renderPaper(ticket,{seams:true,grain:true}));
let html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'style.css'),'utf8');
const paper=fs.readFileSync(path.join(root,'paper.mjs'),'utf8').replace(/^export /gm,'');
const app=fs.readFileSync(path.join(root,'app.mjs'),'utf8').replace(/^import .*?;\r?\n/,'');
const payload=gzipSync(JSON.stringify(pack),{level:9,mtime:0}).toString('base64');
html=html.replace('<link rel="stylesheet" href="style.css">',`<style>${css}</style>`)
 .replace('<script type="module" src="app.mjs"></script>',`<script id="batch-payload" type="application/octet-stream">${payload}</script><script>${paper}\n${app}</script>`);
fs.writeFileSync(path.join(root,'版型总览.html'),html);
const sums={};
function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory()){if(!['qa','__pycache__'].includes(e.name))walk(p)}else if(!['PACKAGE_MANIFEST.json','progress.json'].includes(e.name)&&!e.name.endsWith('.pyc'))sums[path.relative(root,p).replaceAll('\\','/')]=createHash('sha256').update(fs.readFileSync(p)).digest('hex')}}
walk(root);
fs.writeFileSync(path.join(root,'PACKAGE_MANIFEST.json'),JSON.stringify({schema:'kaopu-pattern-batch-files@1',sourceBaseline:pack.catalogue.sourceBaseline,files:sums,patterns:60,portableBytes:Buffer.byteLength(html),physicalSolveRun:false},null,2));
console.log(JSON.stringify({patterns:60,portableBytes:Buffer.byteLength(html),svgCount:pack.patterns.length,files:Object.keys(sums).length}));
