import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {embedReconstruction} from './standalone.mjs';
const root=resolve(process.argv[2]),out=resolve(process.argv[3]);
const source='c595390448b7c307ebf1fcd26566bd947411c319';
const {assemble}=await import(pathToFileURL(join(root,'tools/build-pure.mjs')));
let {body}=assemble();
const continuationFiles=['ShortsWaistContinuation.js','ShortsContinuation.js'];
const continuation=continuationFiles.map(name=>readFileSync(new URL('./'+name,import.meta.url),'utf8')).join('\n');
const clothSource=readFileSync(join(root,'clothing/ClothShorts.js'),'utf8');
if(!body.includes(clothSource))throw Error('Original cloth source insertion point missing');
body=body.replace(clothSource,clothSource+'\n'+continuation);
// Show actual authoring geometry and step progress during original validation.
body=body.replaceAll('this.body.update();this.simulation.step(1);this.dirty=true;','this.body.update();this.simulation.step(1);this.dirty=true;this.displayReady=true;onProgress((step+1)/maximumSteps);');
const originalProgress="$('loading').textContent='正在缝合短裤 · '+sim.seams.filter(s=>s.pairs.every(p=>sim.dofs?.same(p.a,p.b))).length+' / '+sim.seams.length+' 条缝';";
if(!body.includes(originalProgress))throw Error('Original startup progress callback missing');
body=body.replace(originalProgress,"const lab=window.HumanLab,h=lab.human,r=lab.renderer,hip=h.world('hips').p,scale=h.bodyMetrics.statureScale;if(!window.__shortsStartupCamera){r.target=[hip[0],hip[1]-.10*scale,hip[2]];r.distance=1.18*scale;r.yaw=lab.agent.yaw;r.pitch=.025;window.__shortsStartupCamera=true;}const message=(lab.compact.skirt.assemblyState.startsWith('continuation')?'正在检查腰头':'正在检查原 R2.4')+' · 第 '+(sim.authoringProjectionIteration||sim.stepIndex)+' 步';$('loading').textContent=message;window.__humanStartup.message=message;lab.render();");
// Only delivery defaults and a reversible review-colour switch change.
// The accepted paper, material shader, six seams and R2.4 solver stay intact.
body=body.replaceAll("window.parent?.location?.search||window.location?.search||''",'window.__SHORTS_REVIEW_QUERY__').replaceAll('window.parent.location.search','window.__SHORTS_REVIEW_QUERY__');
body=body.replace('uPanelReview:this.stagedReview?1:0','uPanelReview:this.stagedReview&&window.__SHORTS_PANEL_COLORS__!==false?1:0');
const config=`<script>window.__SHORTS_REVIEW_QUERY__='?shorts=1&shortsSteps=0&shortsStage=r2.4-rise&qa=1';window.__SHORTS_PANEL_COLORS__=true;window.__SHORTS_R24_SOURCE__='${source}';</script>`;
const css=`<style>body{margin:0!important;font-family:system-ui!important}body>header,.layout>aside,.toolbar,.hud,.metrics,.bottom,#labels,#shorts-controls,.compact-panel,#body-settings-open,#body-settings{display:none!important}.layout{display:block!important;height:100dvh!important}.stage{position:fixed!important;inset:64px 0 0!important;min-width:0!important}#view{width:100%!important;height:100%!important}#r24-ui{position:fixed;inset:0;pointer-events:none;z-index:90;color:#e7ece5;font:13px/1.6 system-ui}#r24-top{height:64px;box-sizing:border-box;padding:10px 18px;background:#152022;border-bottom:1px solid #53655c}#r24-top b{font-size:18px;margin-right:18px}#r24-status{color:#b9d3b2}#r24-buttons{position:absolute;bottom:16px;left:16px;right:16px;display:flex;flex-wrap:wrap;gap:6px;justify-content:center}#r24-ui button,#r24-ui details{pointer-events:auto}#r24-ui button{background:#263632;color:#e1e6d8;border:1px solid #53655c;border-radius:6px;padding:9px 12px;font:inherit;cursor:pointer}#r24-ui button:disabled{opacity:.45;cursor:wait}#r24-info{position:absolute;right:12px;top:78px;padding:10px 12px;border:1px solid #53655c;border-radius:8px;background:#152022ed;max-width:290px}#r24-info summary{cursor:pointer}#r24-info p{margin:8px 0;font-size:12px}#r24-info button{width:100%}@media(max-width:600px){#r24-top{height:82px;padding:8px 10px}#r24-top b{display:block;font-size:16px}.stage{top:82px!important}#r24-status{font-size:11px}#r24-info{top:92px;max-width:240px;font-size:11px}#r24-buttons{left:7px;right:7px;bottom:10px;gap:4px}#r24-ui button{padding:8px;font-size:11px}}</style>`;
const ui=`<div id="r24-ui"><div id="r24-top"><b>亚麻短裤 · R2.4 缝合接续</b><span id="r24-status">正在从原参数构造人物与裁片…</span></div><details id="r24-info"><summary>当前完成范围</summary><p>沿用你选定的 R2.4 原纸样、人物和亚麻织纹，安装四片腰头。主裤片与橙色接缝保持原来的位置。</p><p id="r24-scope">正在核对接缝、布料形变和身体接触。动作验收尚未开放。</p><p>彩色用于识别裁片；点击“原亚麻材质”可看统一布料效果。</p><button id="r24-export" disabled>导出当前阶段报告</button></details><div id="r24-buttons"><button disabled data-r24-view="angle">全身</button><button disabled data-r24-view="front">正面</button><button disabled data-r24-view="back">背面</button><button disabled data-r24-view="left">左侧</button><button disabled data-r24-view="right">右侧</button><button disabled data-r24-view="cloth">近看</button><button disabled data-r24-view="below">裆部下视</button><button disabled id="r24-material">原亚麻材质</button></div></div><script>${readFileSync(new URL('./review.js',import.meta.url),'utf8')}</script>`;
body=body.replace(/<title>[^<]*<\/title>/,'<title>亚麻短裤 R2.4 · 接续工作台</title>').replace('<head>','<head>'+config).replace('</head>','<link rel="icon" href="data:,">'+css+'</head>').replace('</body>',ui+'</body>');
const embedded=embedReconstruction(body,root);body=embedded.html;
mkdirSync(out,{recursive:true});writeFileSync(join(out,'index.html'),body);
const receipt={revision:'R2.4-open-waist-continuation-20261001',source,taskId:'shorts-r24-missing-seams-20261001',continuationSHA256:createHash('sha256').update(continuation).digest('hex'),continuationFiles,htmlSHA256:createHash('sha256').update(body).digest('hex'),...embedded.report,sourceGeometryChanged:true,sourceMaterialChanged:false,priorClosedSeams:6,expectedGusset:false,expectedWaistbandAttached:true,expectedWaistbandRingClosed:false,expectedSideClosure:false,motionValidated:false,visualAcceptance:false,productionReady:false};writeFileSync(join(out,'BUILD.json'),JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt));

