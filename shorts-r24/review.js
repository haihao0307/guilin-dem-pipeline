(()=>{
const $=id=>document.getElementById(id),status=message=>$('r24-status').textContent=message;
const timer=setInterval(()=>{
 if(window.__startupError){clearInterval(timer);status('构造失败：'+window.__humanStartup?.error);return;}
 if(window.__humanStartup?.status!=='ready'){status(window.__humanStartup?.message||'正在构造原人物…');return;}
 clearInterval(timer);const lab=window.HumanLab,garment=lab.compact.skirt;lab.setAuto(false);
 const report=lab.garment.report();
 if(garment.assemblyState!=='continuation-ready'||report.continuation?.valid!==true){status('新接缝检查未通过，保持诊断状态。');return;}
 const camera=view=>{lab.setCameraFollow(false);const r=lab.renderer,h=lab.human,s=h.bodyMetrics.statureScale,hip=h.world('hips').p;r.target=[hip[0],hip[1]-.10*s,hip[2]];r.distance=(view==='cloth'?.74:view==='below'?.88:view==='angle'?2.9:1.18)*s;r.yaw=lab.agent.yaw+({front:0,back:Math.PI,left:-Math.PI/2,right:Math.PI/2,angle:.46,cloth:.35,below:0}[view]??0);r.pitch=view==='below'?-.66:.025;r.projection='perspective';lab.render();};
 for(const button of document.querySelectorAll('[data-r24-view]'))button.onclick=()=>camera(button.dataset.r24View);
 $('r24-material').onclick=()=>{window.__SHORTS_PANEL_COLORS__=!window.__SHORTS_PANEL_COLORS__;$('r24-material').textContent=window.__SHORTS_PANEL_COLORS__?'原亚麻材质':'裁片身份色';lab.render();};
 $('r24-export').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify({source:window.__SHORTS_R24_SOURCE__,revision:'R2.4-open-waist-continuation-20261001',report:lab.garment.report()},null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='SHORTS_R24_REPORT.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 for(const button of document.querySelectorAll('#r24-ui button'))button.disabled=false;
 window.ShortsR24={version:'R2.4-open-waist-continuation-20261001',source:window.__SHORTS_R24_SOURCE__,camera,report:()=>lab.garment.report(),ready:true};
 const c=report.continuation;$('r24-scope').textContent='四片腰头已安装，三处腰头拼接已缝合。左侧开口、腰头左扣合和裆补片仍待处理。动作验收尚未开放。';
 status('腰头已安装 · 左侧开口与裆补片待处理');camera('front');
},250);
})();
