// Idempotent, explicit source edits after inspecting actual ET13 browser
// geometry and screenshots. No native parameter vectors or assets are replaced.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
function edit(file,changes){const p=path.join(__dirname,file);let s=fs.readFileSync(p,'utf8');for(const[a,b]of changes){if(s.includes(b))continue;assert.equal(s.split(a).length,2,'Expected one reviewed source anchor in '+file+': '+a.slice(0,70));s=s.replace(a,()=>b);}fs.writeFileSync(p,s);}
edit('Catalogue.mjs',[
 ["'眼裂高度 · 原生分区1'","'眼裂高度 · 鼻侧'"],
 ["'眼裂高度 · 原生分区2'","'眼裂高度 · 中央'"],
 ["'眼裂高度 · 原生分区3'","'眼裂高度 · 颞侧'"],
 ["'眼角高度 · 原生端点1'","'外眼角高度'"],
 ["'眼角高度 · 原生端点2'","'内眼角高度'"],
 ["'eye-corner2-up':-.18","'eye-corner1-up':-.18"],
 ["'eye-corner2-up':.22","'eye-corner1-up':.22"],
 ["single:{label:'单眼皮倾向',native:{'eye-eyefold-up':-.30}","single:{label:'单眼皮倾向',native:{'eye-eyefold-up':0}"]
]);
edit('IdentityModel.mjs',[
 ["import {paintTraitMaps} from './TraitMaps.mjs';","import {paintTraitMaps} from './TraitMaps.mjs';\nimport {fairUpperLids} from './LidFairing.mjs';"],
 ["if(s.crease<0){const ns=fields.adjacency[i];let average=0,w=0;for(const j of ns){const v=point(before,j),len=Math.hypot(...sub(P,v));const a=1/Math.max(.0002,len);average+=dot(sub(v,P),front)*a;w+=a;}if(w)displacement=average/w*2.4*(-s.crease);}","if(s.crease<0){displacement=0;} // Bounded whole-band fairing follows below."],
 ["if(!p.every(Number.isFinite))throw Error('身份层生成非有限几何');","const fairing=s.crease<0?fairUpperLids(model,before,front,eyeInfo,fields,scale,-s.crease):null;if(fairing){max=Math.max(max,fairing.maxMM/1000);affected+=fairing.changed;lidVertices=fairing.vertices;}\n  if(!p.every(Number.isFinite))throw Error('身份层生成非有限几何');"],
 ["affectedVertices:affected,noseVertices,lidVertices,maxAddedDisplacementMM:","affectedVertices:affected,noseVertices,lidVertices,fairing,maxAddedDisplacementMM:"]
]);
edit('TraitMaps.mjs',[
 ["const length=[44,48,40,33][i],y=332+i*9.8;wrinkle(wrinklePath(-length,y,length*.94,y+.8,3.5,rw,s.wrinkleIrregularity)","const length=[39,44,37,29][i],y=337+i*8.5;wrinkle(wrinklePath(-length,y,length*(.86+i*.025),y+1.8,1.8+i*.35,rw,s.wrinkleIrregularity)"],
 ["for(let i=0;i<3;i++)wrinkle(wrinklePath(-6+i*5,319,-7+i*6,340,1.5,rw,s.wrinkleIrregularity),s.wrinkleWidth*.8,s.frown*(i===1?.65:1));","for(let i=0;i<2;i++)wrinkle(wrinklePath(-5+i*9,314.5+i,-7+i*13,332-i*1.5,.8,rw,s.wrinkleIrregularity),s.wrinkleWidth*.8,s.frown*(i===1?.82:1));"]
]);
edit('IdentityUI.mjs',[
 ["端点1/2与分区1/2/3保留上游编号，避免把未标定区域误称具体解剖位置。","眼角与眼裂分区名称已按本模型实际地标位移核对；其余原生分区保留编号，不将未标定语义冒充真人测量。"]
]);
