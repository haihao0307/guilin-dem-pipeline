import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=fs.readFileSync(path.join(root,'src/learning.js'),'utf8');
const data=fs.readFileSync(path.join(root,'src/learning-teachers.json'),'utf8');
JSON.parse(data);
const marker="import TEACHERS_DATA from './learning-teachers.json';";
if(source.split(marker).length!==2)throw new Error('The data import must appear exactly once');
const js=source.replace(marker,'const TEACHERS_DATA = '+data+';').replaceAll('export function ','function ').replaceAll('export const ','const ');
if(/(^|\n)\s*(import|export)\s/.test(js))throw new Error('Unbundled module syntax');
const html='<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#121c22"><meta name="referrer" content="no-referrer"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\'; style-src \'unsafe-inline\'; img-src blob: data:; font-src \'none\'; connect-src \'none\'; base-uri \'none\'; form-action \'none\'"><link rel="icon" href="data:,"><title>动物方法学习 · 图像观察、三维与动作研究 R02</title><style>html,body{margin:0;background:#121c22}body{min-height:100dvh}</style></head><body><div id="animal-learning"></div><noscript>本学习模块需要 JavaScript；原系统来源见随附方法资料。</noscript><script>'+js.replaceAll('</script','<\\/script')+'\nmountLearning(document.getElementById("animal-learning"));</script></body></html>';

fs.writeFileSync(path.join(root,'index.html'),html);
const manifest={schema:'kaopu/animal-learning-build@1',version:'1.1.0',builtAtUtc:new Date().toISOString(),path:'index.html',bytes:Buffer.byteLength(html),sha256:crypto.createHash('sha256').update(html).digest('hex'),coreNetworkDependencies:0,teacherInferenceIncluded:false,authorMediaIncluded:false,originalAtlasModelsIncluded:false};
fs.writeFileSync(path.join(root,'BUILD.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify(manifest,null,2));
