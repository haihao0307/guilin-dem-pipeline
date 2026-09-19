function upgradeOceanR02(base,files){
 'use strict';
 function replaceOnce(s,a,b){if(!s.includes(a))throw Error('R02 baseline marker missing: '+a.slice(0,80));return s.replace(a,b)}
 function removeBetween(s,a,b){const start=s.indexOf(a),end=s.indexOf(b,start);if(start<0||end<0)throw Error('R02 function boundary missing');return s.slice(0,start)+s.slice(end)}
 let h=base;
 h=replaceOnce(h,'<title>Ocean Life Mother R01','<title>Ocean Life Mother R02');
 h=replaceOnce(h,'<h1>Ocean Life Mother R01</h1>','<h1>Ocean Life Mother R02</h1>');
 h=replaceOnce(h,'Fish · Bird · Coral | 原生骨链 · 水域约束 · 动作研究','热带海岛生命 · 分区栖息 · 捕食与避让 · 自然观察');
 h=replaceOnce(h,'R01 候选','R02 生态候选');h=replaceOnce(h,'综合生态 · 20 × 24 米','综合生态 · 80 × 96 米实验域');
 h=replaceOnce(h,'value="18"','value="32"');
 h=replaceOnce(h,'>浅水加鱼<','>加定居鱼<');h=replaceOnce(h,'>礁区加鱼<','>加饵鱼<');h=replaceOnce(h,'>外侧加鱼<','>加捕食鱼<');
 const ui=`<section class="group"><h3>从全岛到近处观察</h3><div class="row"><button id="overviewView">全岛与外礁</button><button id="reefView">礁边近看</button><button id="foodwebView">通道鱼群</button><button id="shoreView">岸鸟活动</button></div><div class="row" style="margin-top:8px"><button id="approach">玩家接近</button><button id="retreat">玩家离开</button><button id="recordObservation">记入观察簿</button></div><p class="note" id="observeNote">先到礁边近看。鱼的避让、返回与捕食会留下事件；没有投饵与自动捕鱼。</p><div class="row"><button id="downloadJournal">导出观察簿</button></div><pre class="note" id="eventLog" style="white-space:pre-wrap">等待行为事件…</pre><label class="control"><span>演示时段</span><input id="hour" type="range" min="0" max="23" step="1" value="9"><output id="hourOut">9:00</output></label><label class="control"><span>演示潮相</span><input id="tidePhase" type="range" min="0" max="100" value="0"><output>非实测</output></label><details><summary>生态目录与待接入物种</summary><div class="note" id="catalogue"></div></details></section>`;
 h=replaceOnce(h,'<section class="group on" data-panel="assembly">',ui+'<section class="group on" data-panel="assembly">');
 h=replaceOnce(h,'<section class="group" data-panel="coral">','<section class="group" data-panel="coral"><div class="row"><button data-coral-form="branching" class="on">分枝型</button><button data-coral-form="table">桌面型</button><button data-coral-form="massive">块状型</button></div><p class="note">这是三种生长形态候选，不是三个已鉴定珊瑚种。脑纹与真实珊瑚杯尚未完成。</p>');
 h=replaceOnce(h,'</head>','<style>#panel{max-height:calc(100dvh - 32px)}#catalogue{max-height:250px;overflow:auto}#catalogue p{margin:0 0 8px}summary{cursor:pointer;margin-top:8px;font-size:12px;color:#acd3d9}@media(max-width:760px){#panel{max-height:48dvh}header h1{font-size:17px}#panel:not(.folded)~#status{display:none}}</style></head>');
 h=replaceOnce(h,'<aside id="panel">','<div id="quickviews" style="position:fixed;z-index:5;left:12px;top:116px;display:flex;gap:5px"><button data-focus-life="reef">礁边看鱼</button><button data-focus-life="foodweb">通道鱼群</button><button data-focus-life="birds">看鸟</button><button data-focus-life="overview">全岛</button></div><aside id="panel">');
 const start=h.indexOf('const HabitatLife='),end=h.indexOf('/* Restore H5B',start);if(start<0||end<0)throw Error('R01 habitat marker absent');
 h=h.slice(0,start)+files.habitat+'\n'+files.coral+'\nconst OceanLifeCatalogue='+JSON.stringify(files.catalogue).replace(/</g,'\\u003c')+';\n'+h.slice(end);
 h=replaceOnce(h,"let x=isolated?0:-3.0+id*2.4,z=isolated?-4.3:-5.5+(returning?1.92:.0)+(returning?-1:1)*.16*Math.min(12,travel),yaw=returning?Math.PI:0;","let x=isolated?0:-3.0+id*4+(returning?1.92:0)+(returning?-1:1)*.16*Math.min(12,travel),z=isolated?1:.6,yaw=(returning?Math.PI:0)+Math.PI*.5;");
 h=replaceOnce(h,"yaw=(returning?Math.PI:0)+smooth(u)*Math.PI","yaw=(returning?Math.PI:0)+Math.PI*.5+smooth(u)*Math.PI");
 h=replaceOnce(h,"if(action!=='walk')z=isolated?-4.3:-4.4;","if(action!=='walk')z=isolated?1:.6;");
 h=replaceOnce(h,'y=2.0+id*.4+.08*Math.sin(t*.7+id)','y=Math.max(2.0+id*.4+.08*Math.sin(t*.7+id),HabitatLife.bed(x,z)+1.8)');
 h=replaceOnce(h,"Object.assign(isolatedBird,{x:0,y:.1,z:-4.3,yaw:0})","Object.assign(isolatedBird,{x:0,y:HabitatLife.bed(0,1)+1,z:1,yaw:0})");
 h=replaceOnce(h,"schoolCount:18","schoolCount:32");
 h=replaceOnce(h,'assembly:{target:[0,.15,1.7],yaw:.48,pitch:.52,dist:14.8}','assembly:{target:[0,-1,12],yaw:.44,pitch:.63,dist:72}');
 h=replaceOnce(h,'fish:{target:[0,-.62,3.8]','fish:{target:[0,-1,9]');
 h=replaceOnce(h,'bird:{target:[0,.71,-4.3]','bird:{target:[0,HabitatLife.bed(0,1)+.71,1]');
 h=replaceOnce(h,'coral:{target:[0,-.48,3.8]','coral:{target:[0,HabitatLife.bed(0,9)+.50,9]');
 h=replaceOnce(h,'ocean:{target:[0,-.42,2],yaw:.62,pitch:.48,dist:17}','ocean:{target:[0,-2,18],yaw:.62,pitch:.48,dist:76}');
 h=replaceOnce(h,'canvas.width/canvas.height,.01,100','canvas.width/canvas.height,.02,220');
 h=replaceOnce(h,'camera.dist*Math.exp(e.deltaY*.0011),.28,38','camera.dist*Math.exp(e.deltaY*.0011),.28,150');
 h=replaceOnce(h,'attribute vec3 aP,aN,aC;uniform mat4 uVP,uModel;','attribute vec3 aP,aN,aC,aPN,aNN;uniform float uMorph;uniform mat4 uVP,uModel;');
 h=replaceOnce(h,'uModel*vec4(aP,1.0)','uModel*vec4(mix(aP,aPN,uMorph),1.0)');
 h=replaceOnce(h,'mat3(uModel)*aN','mat3(uModel)*mix(aN,aNN,uMorph)');
 h=replaceOnce(h,"['uVP','uModel','uEye'","['uMorph','uVP','uModel','uEye'");
 h=replaceOnce(h,"c:gl.getAttribLocation(P,'aC')","c:gl.getAttribLocation(P,'aC'),np:gl.getAttribLocation(P,'aPN'),nn:gl.getAttribLocation(P,'aNN')");
 h=replaceOnce(h,'[this.bc,attr.c]])','[this.bc,attr.c],[(opt.next||this).bp,attr.np],[(opt.next||this).bn,attr.nn]])');
 h=replaceOnce(h,'gl.uniformMatrix4fv(loc.uVP,false,VP)','gl.uniform1f(loc.uMorph,opt.blend||0);gl.uniformMatrix4fv(loc.uVP,false,VP)');
 h=replaceOnce(h,"const dt=Math.min(.10,(now-last)/1000)","const dt=Math.max(0,Math.min(.10,(now-last)/1000))");
 h=replaceOnce(h,"uniform float uMode,uAlpha,uWater,uGlow;","uniform float uMode,uAlpha,uWater,uGlow,uTide,uTime;");
 h=replaceOnce(h,"['uMorph','uVP'","['uTide','uTime','uMorph','uVP'");
 h=replaceOnce(h,"gl.uniform1f(loc.uMorph,opt.blend||0)","gl.uniform1f(loc.uTide,HabitatLife.tide(state.time));gl.uniform1f(loc.uTime,state.time);gl.uniform1f(loc.uMorph,opt.blend||0)");
 h=replaceOnce(h,"float fog=clamp((length(uEye-vW)-24.)/42.,0.,1.);lit=mix(lit,uFog,fog);","float distanceM=length(uEye-vW);float fog=clamp((distanceM-75.)/150.,0.,1.);vec3 fogColor=uFog;if(uEye.y<uTide){fog=clamp(1.-exp(-distanceM*.025),0.,.94);fogColor=vec3(.12,.40,.47);}if(vW.y<uTide&&uWater<.5){float depth=uTide-vW.y;lit*=exp(-vec3(.075,.030,.019)*depth);float caustic=pow(.5+.5*sin(vW.x*8.+sin(vW.z*5.+uTime*.7)),14.)*.04;lit+=caustic*max(n.y,0.)*exp(-depth*.2);}lit=mix(lit,fogColor,fog);");
 // Remove only the old view glue. Core generation, original editor and recipe reader stay intact.
 for(const[a,b]of[['function animateLife()','function animateBirds()'],['function drawFishSchool(','function drawBird('],['function drawScene()','function checkBodies()'],['function checkBodies()','function modeTitle()'],['function updateStatus()','function setMode('],['function addZone(','$(\'zoneShallow\')']])h=removeBetween(h,a,b);
 h=replaceOnce(h,'function syncSchool(){',files.runtime+'\nfunction syncSchool(){');
 h=replaceOnce(h,"revision:'OCEAN-LIFE-MOTHER-R01'","revision:'OCEAN-LIFE-MOTHER-R02'");
 const init="for(const item of OceanLifeCatalogue.life){const p=document.createElement('p');p.textContent=item.label+' — '+item.runtimeStatus;document.getElementById('catalogue').append(p)}\n";
 h=replaceOnce(h,"if(innerWidth<760)$('panel')",init+"if(innerWidth<760)$('panel')");
 return h;
}
if(typeof module!=='undefined')module.exports=upgradeOceanR02;
