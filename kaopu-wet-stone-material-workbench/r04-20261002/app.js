/* KAOPU material lab R04. TDM research derivative: CC BY-NC-SA 3.0. */
'use strict';
(async function(){
const $=id=>document.getElementById(id);
const EXPECTED='f03a5c354f54bef8d9c7d3e9b1b406e34e8a93759e592fb4d30ef1558a09e4db';
const PALETTES=[
 ['原调暖褐','#73513b','#bf9e78'],['砂米','#a49578','#e3d4b6'],['冷灰','#636d75','#bdc6cf'],['炭黑','#22272c','#626b72'],['铁锈红','#7f3324','#cf8660'],['赭黄','#8b601c','#d8b661'],['青绿','#285f52','#8fba98'],['蓝灰','#334c72','#96b1ce'],['灰紫','#65455f','#b7a0b8'],['象牙白','#b1ac9c','#ece5d5']
];
const DEFINITIONS=[
 ['roughness','基底粗糙度',.1,.95,.01,.72],['wet','湿润 / 水膜',0,1,.01,.65],
 ['crack','裂纹深度',0,.075,.001,0],['crackWidth','裂纹宽度',.004,.04,.001,.018],
 ['crackScale','裂纹密度',.65,3,.01,1.35],['moss','青苔覆盖',0,1,.01,0],
 ['relief','苔层厚度',0,.035,.001,.014],['lichen','地衣斑点',0,1,.01,0],
 ['exposure','曝光',.4,2.5,.01,1.2],['seed','分布种子',1,99,1,11],['zoom','右侧近看',1,2.2,.01,1]
];
let params=Object.fromEntries(DEFINITIONS.map(d=>[d[0],d[5]]));
let camera={yaw:1.155,pitch:.2},light=-.65,view=0,pbr=1,baseline=false,paletteIndex=0,materialColor=null;
let running=false,busy=false,dirty=true,lastTime=0,sourceHash='',renderers=[],teacherURL=null;
const hexToLinear=hex=>[1,3,5].map(i=>{const s=parseInt(hex.slice(i,i+2),16)/255;return s<=.04045?s/12.92:((s+.055)/1.055)**2.4;});
const copy=o=>JSON.parse(JSON.stringify(o));
function colorFor(i){return {name:PALETTES[i][0],base:hexToLinear(PALETTES[i][1]),grain:hexToLinear(PALETTES[i][2])};}
materialColor=colorFor(0);
function fail(e){$('error').style.display='block';$('error').textContent='工作台错误：'+(e.message||e);$('status').textContent='错误，未完成';console.error(e);}
window.addEventListener('unhandledrejection',e=>fail(e.reason));
function score(){return {schema:'kaopu.material-score/1.0',id:'MATERIAL-001-R04',source:{teacher:'Alexander Alekseev / TDM — Wet stone (2014)',baseline:'R03',fragmentSHA256:sourceHash,license:'CC-BY-NC-SA-3.0',stage:'USER_AUTHORIZED_DERIVATION'},instrument:'kaopu.wetstone.ggx.r04',units:{geometry:'normalized-teacher-units',referenceSphereDiameter:2,physicalMeters:null},material:{color:copy(materialColor),metallic:0,...copy(params)},render:{baseline,pbr:!!pbr,view,light,exposure:params.exposure,environment:'analytic-studio-approximation',camera:copy(camera)},limits:['not-measured-mineral-properties','heuristic-moss-and-fracture','no-full-HDRI-or-GI','noncommercial-teacher-derived-sample']};}
function updateUI(){
 for(const [key]of DEFINITIONS){$('param-'+key).value=params[key];$('out-'+key).textContent=key==='crack'||key==='relief'?(params[key]/2*100).toFixed(2)+'%':Number(params[key]).toFixed(key==='seed'?0:2);}
 $('lighting').value=pbr?'pbr':'legacy';$('view').value=String(view);$('light').value=light;
 $('variantTitle').textContent=baseline?'已还原 · 与左侧同一复刻基线':'衍生材质 · '+materialColor.name;
 $('variantStamp').textContent=baseline?'BASELINE · 全部衍生关闭':pbr?'PBR / GGX · 衍生实验':'LEGACY · 沿用老师光照词汇';
 document.querySelectorAll('.palette').forEach((b,i)=>b.classList.toggle('on',i===paletteIndex));
 $('score').textContent=JSON.stringify(score(),null,2);dirty=true;
}
function setPalette(i){if(!Number.isInteger(i)||i<0||i>=PALETTES.length)throw Error('配色编号无效');paletteIndex=i;materialColor=colorFor(i);baseline=false;updateUI();}
function applyEffect(name){
 const defs={dry:{wet:0,roughness:.9,crack:0,moss:0,lichen:0},wet:{wet:.9,roughness:.65,crack:0,moss:0,lichen:0},cracked:{wet:.12,roughness:.86,crack:.04,moss:0,lichen:0},moss:{wet:.2,roughness:.82,crack:.01,moss:.70,lichen:0},lichen:{wet:.05,roughness:.88,crack:.015,moss:0,lichen:.9},forest:{wet:.78,roughness:.72,crack:.045,moss:.63,lichen:.6}};
 if(!defs[name])throw Error('未知表面状态');Object.assign(params,defs[name]);baseline=false;updateUI();
 document.querySelectorAll('#effects button').forEach(b=>b.classList.toggle('on',b.dataset.effect===name));
}
function setScore(s){
 if(s?.schema!=='kaopu.material-score/1.0'||s.instrument!=='kaopu.wetstone.ggx.r04'||s.source?.fragmentSHA256!==EXPECTED)throw Error('谱版本、乐器或基线指纹不匹配');
 const mat=s.material;if(!mat||mat.metallic!==0)throw Error('此石材谱限定 metallic = 0');
 const next={};for(const [key,label,min,max]of DEFINITIONS){const n=mat[key];if(typeof n!=='number'||!Number.isFinite(n)||n<min||n>max)throw Error(label+'超出范围');next[key]=n;}
 for(const key of ['base','grain'])if(!Array.isArray(mat.color?.[key])||mat.color[key].length!==3||mat.color[key].some(v=>typeof v!=='number'||!Number.isFinite(v)||v<0||v>1))throw Error('颜色字段无效');
 const r=s.render;if(!r||typeof r.baseline!=='boolean'||typeof r.pbr!=='boolean'||!Number.isInteger(r.view)||r.view<0||r.view>6||!Number.isFinite(r.light)||Math.abs(r.light)>3.14||!Number.isFinite(r.camera?.yaw)||Math.abs(r.camera.yaw)>10000||!Number.isFinite(r.camera?.pitch)||r.camera.pitch<0||r.camera.pitch>Math.PI)throw Error('渲染字段无效');
 params=next;materialColor={name:String(mat.color.name).slice(0,32),base:[...mat.color.base],grain:[...mat.color.grain]};paletteIndex=PALETTES.findIndex(p=>p[0]===materialColor.name);camera=copy(r.camera);light=r.light;view=r.view;pbr=r.pbr?1:0;baseline=r.baseline;updateUI();return score();
}
for(let i=0;i<PALETTES.length;i++){const p=PALETTES[i],b=document.createElement('button');b.className='palette';b.dataset.index=i;b.innerHTML='<span class="swatch"></span><span></span>';b.querySelector('.swatch').style.background=`linear-gradient(105deg,${p[1]},${p[2]})`;b.lastElementChild.textContent=String(i+1).padStart(2,'0')+' '+p[0];b.onclick=()=>setPalette(i);$('palettes').append(b);}
for(const [id,name]of [['dry','干燥粗石'],['wet','雨后湿石'],['cracked','开裂石'],['moss','青苔覆盖'],['lichen','地衣风化'],['forest','潮湿苔裂叠层']]){const b=document.createElement('button');b.textContent=name;b.dataset.effect=id;b.onclick=()=>applyEffect(id);$('effects').append(b);}
for(const [key,label,min,max,step,value]of DEFINITIONS){const l=document.createElement('label');l.className='control';l.innerHTML=`<span>${label}</span><input id="param-${key}" type="range" min="${min}" max="${max}" step="${step}" value="${value}"><output id="out-${key}"></output>`;$('controls').append(l);$('param-'+key).oninput=e=>{params[key]=Number(e.target.value);baseline=false;updateUI();};}
async function fetchText(url){const r=await fetch(url,{cache:'no-cache'});if(!r.ok)throw Error(url+' HTTP '+r.status);return r.text();}
const VERTEX='#version 300 es\nprecision highp float;\nconst vec2 P[3]=vec2[3](vec2(-1,-1),vec2(3,-1),vec2(-1,3));void main(){gl_Position=vec4(P[gl_VertexID],0,1);}';
function renderer(canvas,fragment){
 const gl=canvas.getContext('webgl2',{alpha:false,antialias:false,preserveDrawingBuffer:true,powerPreference:'high-performance'});if(!gl)throw Error('浏览器未启用 WebGL2');
 function compile(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){const log=gl.getShaderInfoLog(s);gl.deleteShader(s);throw Error(log);}return s;}
 const vs=compile(gl.VERTEX_SHADER,VERTEX),fs=compile(gl.FRAGMENT_SHADER,fragment),program=gl.createProgram();gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));gl.deleteShader(vs);gl.deleteShader(fs);
 const vao=gl.createVertexArray();const locations={};function loc(k){if(!(k in locations))locations[k]=gl.getUniformLocation(program,k);return locations[k];}
 canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();running=false;fail(Error('WebGL 上下文丢失，请刷新恢复。材质谱仍可导出。'));});
 return {gl,canvas,draw(isBase=false){gl.viewport(0,0,canvas.width,canvas.height);gl.useProgram(program);gl.bindVertexArray(vao);gl.uniform3f(loc('iResolution'),canvas.width,canvas.height,1);gl.uniform1f(loc('iTime'),3.85);gl.uniform4f(loc('iMouse'),camera.yaw*100,(2-camera.pitch)*100,1,0);
  const floats={uRoughness:params.roughness,uWet:params.wet,uCrack:params.crack,uCrackWidth:params.crackWidth,uCrackScale:params.crackScale,uMoss:params.moss,uRelief:params.relief,uLichen:params.lichen,uSeed:params.seed,uExposure:params.exposure,uLight:light,uZoom:params.zoom};for(const [k,v]of Object.entries(floats))gl.uniform1f(loc(k),v);
  gl.uniform1i(loc('uBaseline'),isBase||baseline?1:0);gl.uniform1i(loc('uPBR'),pbr);gl.uniform1i(loc('uView'),view);gl.uniform3fv(loc('uBase'),materialColor.base);gl.uniform3fv(loc('uGrain'),materialColor.grain);gl.drawArrays(gl.TRIANGLES,0,3);
 },pixels(){const out=new Uint8Array(canvas.width*canvas.height*4);gl.readPixels(0,0,canvas.width,canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,out);return out;}};
}
function render(){renderers[0].draw(true);renderers[1].draw();dirty=false;}
function tick(t){if(!busy){if(running){camera.yaw+=(Math.min(t-lastTime,100)/1000)*.16;dirty=true;}if(dirty&&renderers.length===2)render();}lastTime=t;requestAnimationFrame(tick);}
function save(name,blob){const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}
$('export').onclick=()=>save('KAOPU_MATERIAL_001_R04.json',new Blob([JSON.stringify(score(),null,2)],{type:'application/json'}));
$('import').onclick=()=>$('importInput').click();$('importInput').onchange=async e=>{try{const f=e.target.files[0];if(!f)return;if(f.size>100000)throw Error('材质谱文件过大');setScore(JSON.parse(await f.text()));$('status').textContent='材质谱已校验并重演';}catch(e){fail(e);}finally{e.target.value='';}};
$('capture').onclick=()=>{render();$('variant').toBlob(blob=>save('KAOPU_R04_'+materialColor.name+'.png',blob));};
$('reset').onclick=()=>{baseline=true;view=0;params.zoom=1;updateUI();};
$('lighting').onchange=e=>{pbr=e.target.value==='pbr'?1:0;baseline=false;updateUI();};
$('view').onchange=e=>{view=Number(e.target.value);baseline=false;updateUI();};$('light').oninput=e=>{light=Number(e.target.value);baseline=false;updateUI();};
$('home').onclick=()=>{camera={yaw:1.155,pitch:.2};params.zoom=1;updateUI();};$('focus').onclick=()=>$('stage').classList.toggle('fullscreen');
$('rotate').onclick=()=>{running=!running;$('rotate').textContent=running?'暂停旋转':'开始旋转';};
for(const c of [$('baseline'),$('variant')]){let drag=null;c.onpointerdown=e=>{if(busy)return;drag={x:e.clientX,y:e.clientY,yaw:camera.yaw,pitch:camera.pitch};c.setPointerCapture(e.pointerId);};c.onpointermove=e=>{if(!drag)return;camera.yaw=drag.yaw+(e.clientX-drag.x)*.006;camera.pitch=Math.min(2.5,Math.max(.015,drag.pitch+(e.clientY-drag.y)*.006));dirty=true;};c.onpointerup=()=>{drag=null;updateUI();};c.onpointercancel=()=>{drag=null;};}
$('teacher').onclick=()=>$('teacherInput').click();$('teacherInput').onchange=e=>{const f=e.target.files[0];if(!f)return;if(teacherURL)URL.revokeObjectURL(teacherURL);teacherURL=URL.createObjectURL(f);const v=$('originalVideo');v.src=teacherURL;v.onloadedmetadata=()=>{$('baseInfo').textContent=`原片 ${v.videoWidth}×${v.videoHeight} · ${v.duration.toFixed(3)}s`;$('baseTitle').textContent='老师原录像 · 未转码 · 旁看';$('baseStamp').textContent='TEACHER ORIGINAL';};v.style.display='block';$('baseline').style.display='none';};
$('live').onclick=()=>{$('originalVideo').pause();$('originalVideo').style.display='none';$('baseline').style.display='block';$('baseTitle').textContent='已认可复刻基线 · 不改材质';$('baseInfo').textContent='LIVE GLSL · 960×540';$('baseStamp').textContent='R03 源码基线 · 非录像';dirty=true;};
$('galleryButton').onclick=async()=>{if(busy)return;busy=true;const saved=score();const wasRunning=running;running=false;$('galleryButton').disabled=true;$('gallery').replaceChildren();try{baseline=false;view=0;const c=document.createElement('canvas');c.width=320;c.height=180;const ctx=c.getContext('2d');for(let i=0;i<PALETTES.length;i++){materialColor=colorFor(i);renderers[1].draw();ctx.drawImage($('variant'),0,0,320,180);const f=document.createElement('figure'),img=document.createElement('img'),cap=document.createElement('figcaption');img.src=c.toDataURL('image/png');img.alt=PALETTES[i][0]+' 程序渲染';cap.textContent=String(i+1).padStart(2,'0')+' / '+PALETTES[i][0];f.append(img,cap);f.onclick=()=>setPalette(i);$('gallery').append(f);$('galleryButton').textContent=`渲染 ${i+1}/10`;await new Promise(r=>setTimeout(r,30));}}catch(e){fail(e);}finally{setScore(saved);running=wasRunning;busy=false;dirty=true;$('galleryButton').disabled=false;$('galleryButton').textContent='重新生成十色对照';}};
try{
 const [teacher,material]=await Promise.all([fetchText('teacher.frag'),fetchText('material.glsl')]);
 sourceHash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(teacher)))).map(b=>b.toString(16).padStart(2,'0')).join('');if(sourceHash!==EXPECTED)throw Error('老师源码指纹改变，停止运行');
 const entry='void main(){mainImage(outColor,gl_FragCoord.xy);}';if(!teacher.includes(entry))throw Error('找不到老师片元入口');
 renderers=[renderer($('baseline'),teacher),renderer($('variant'),teacher.replace(entry,'')+'\n'+material)];
 updateUI();render();$('status').textContent='基线指纹通过 · WebGL2 就绪';
 window.KAOPU={ready:true,palettes:PALETTES,getScore:score,setScore,setPalette,applyEffect,render,readPixels:side=>Array.from(renderers[side].pixels()),stop:()=>{running=false;},setCamera:c=>{camera=copy(c);updateUI();},getGL:()=>renderers.map(r=>r.gl.getError())};requestAnimationFrame(tick);
}catch(e){fail(e);}
})();
