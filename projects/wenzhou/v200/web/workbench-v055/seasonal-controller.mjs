const MONTH_NAMES = Object.freeze(['一月','二月','三月','四月','五月','六月','七月','八月','九月','十月','十一月','十二月']);
const CLOUD_NAMES = Object.freeze({
  ci:'卷云 Ci', cc:'卷积云 Cc', cs:'卷层云 Cs', ac:'高积云 Ac', as:'高层云 As',
  ns:'雨层云 Ns', sc:'层积云 Sc', st:'层云 St', cu:'积云 Cu', cb:'积雨云 Cb', typhoon:'台风组织云系'
});
const PHYSICAL_LAYERS_M = Object.freeze({
  ci:Object.freeze([8000,12000]), cc:Object.freeze([7000,11000]), cs:Object.freeze([6000,12000]),
  ac:Object.freeze([3000,6000]), as:Object.freeze([2500,7000]), ns:Object.freeze([600,6000]),
  sc:Object.freeze([600,2200]), st:Object.freeze([80,900]), cu:Object.freeze([700,3500]), cb:Object.freeze([600,14000])
});
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const isoDate=date=>`${date.getUTCFullYear()}-${String(date.getUTCMonth()+1).padStart(2,'0')}-${String(date.getUTCDate()).padStart(2,'0')}`;

function profileFor(month,day,hour,c){
  const phase=((day-1)%6+6)%6;
  const early=hour<8, daylit=hour>=8&&hour<17, afternoon=hour>=12&&hour<19, night=hour>=19||hour<5;
  const wet=c.prectotcorr>=4.5||c.rh2m>=82;
  const veryWet=c.prectotcorr>=7.0||c.rh2m>=88;
  if(month===6||month===7||month===8){
    if(afternoon&&veryWet)return{id:'cb',process:'暖湿季午后深对流候选',reason:'月平均暖湿背景与午后加热共同触发积雨云过程候选'};
    if(afternoon)return{id:'cu',process:'盛夏午后积云发展',reason:'日间边界层加热对应积云发展阶段'};
    if(early&&wet)return{id:'sc',process:'清晨海岸层积云',reason:'高湿清晨优先采用低层海洋云系'};
    if(night&&veryWet)return{id:'ns',process:'夜间持续降水云系',reason:'高湿高降水月份采用深厚层状降水云'};
    return phase<3?{id:'cu',process:'暖季积云场',reason:'暖季日间常规积云候选'}:{id:'ac',process:'暖季中层波状云',reason:'暖湿层结中的中层云候选'};
  }
  if(month===5||month===9){
    if(veryWet&&phase>=3)return{id:'ns',process:'季风雨带层状降水',reason:'月平均降水与湿度处于高值'};
    if(afternoon&&wet)return{id:'cb',process:'过渡季强对流候选',reason:'暖湿背景叠加午后不稳定'};
    if(early)return{id:'st',process:'海岸晨雾层云',reason:'高湿清晨采用最低层云属'};
    return phase<2?{id:'as',process:'锋前高层云',reason:'过渡季湿润层结对应高层云'}:{id:'ac',process:'过渡季高积云',reason:'中层水汽与波动对应高积云'};
  }
  if(month>=3&&month<=4){
    if(veryWet)return{id:'ns',process:'春季连续雨',reason:'湿润月份采用雨层云过程'};
    if(early&&wet)return{id:'st',process:'春晨低云或雾',reason:'清晨高湿与弱日照对应层云'};
    if(phase===0||phase===1)return{id:'ac',process:'春季高积云',reason:'春季中层波动候选'};
    if(phase===2||phase===3)return{id:'as',process:'春季高层云',reason:'锋面前中层云幕候选'};
    return{id:'cs',process:'春季卷层云',reason:'锋面远端高云幕候选'};
  }
  if(month===10||month===11){
    if(early&&wet)return{id:'sc',process:'秋季近海层积云',reason:'清晨海气边界层湿度较高'};
    if(phase===0)return{id:'ci',process:'秋季晴空卷云',reason:'较干背景中的高层冰云候选'};
    if(phase===1||phase===2)return{id:'cc',process:'秋季卷积云',reason:'高层波动云系候选'};
    if(phase===3)return{id:'cs',process:'秋季卷层云',reason:'高层云幕候选'};
    return{id:'ac',process:'秋季高积云',reason:'中层波状云候选'};
  }
  if(early&&wet)return{id:'sc',process:'冬季海岸层积云',reason:'冬季清晨海洋边界层低云候选'};
  if(night&&veryWet)return{id:'ns',process:'冬季冷雨云系',reason:'湿冷背景中的层状降水候选'};
  if(phase===0)return{id:'ci',process:'冬季晴空卷云',reason:'较干冷季背景中的高层冰云'};
  if(phase===1)return{id:'cc',process:'冬季卷积云',reason:'高层波状结构候选'};
  if(phase===2)return{id:'cs',process:'冬季卷层云',reason:'高云幕候选'};
  if(daylit&&wet)return{id:'as',process:'冬季高层云',reason:'湿冷锋面前云幕候选'};
  return{id:'sc',process:'冬季层积云',reason:'冷季海洋边界层云候选'};
}

function makePanel(){
  const style=document.createElement('style');
  style.textContent=`
  #wzSeasonal{position:fixed;z-index:6;right:6px;top:49px;width:272px;max-height:calc(100vh - 80px);overflow:auto;background:#102d36ed;border:1px solid #9ebabb4d;border-radius:6px;color:#ecf5f2;padding:8px;font:10px/1.45 system-ui,"Microsoft YaHei",sans-serif;box-shadow:0 4px 18px #00151c2d;backdrop-filter:blur(10px)}
  #wzSeasonal.hidden{display:none}#wzSeasonal h2{font-size:11px;margin:2px 0 7px;color:#d5e7e2}#wzSeasonal .srow{display:flex;align-items:center;justify-content:space-between;gap:7px;margin:4px 0}#wzSeasonal select,#wzSeasonal button,#wzSeasonal input{font:inherit;color:inherit;background:#173740e6;border:1px solid #9ebabb4d;border-radius:5px;padding:3px 5px}#wzSeasonal button{cursor:pointer}#wzSeasonal .grid{display:grid;grid-template-columns:1fr 1fr;gap:4px;margin:6px 0}#wzSeasonal .cell{border:1px solid #8daaa82e;border-radius:4px;background:#6f9b9a12;padding:5px;min-height:40px}#wzSeasonal .cell span{display:block;color:#9fb8b8;font-size:8px}#wzSeasonal .cell b{display:block;margin-top:2px;font-size:10px}#wzSeasonal .lock{border:1px solid #8bc2b84a;border-radius:5px;background:#5f9a8f16;padding:6px;margin-top:6px;color:#cce1dc;font-size:9px}#wzSeasonal .source{color:#a8c0c0;font-size:8px;margin-top:7px;word-break:break-word}#wzSeasonal .bad{color:#ffb39a}#wzSeasonalToggle{position:fixed;z-index:7;right:8px;top:8px;background:#173740e6;color:#ecf5f2;border:1px solid #9ebabb4d;border-radius:5px;padding:4px 8px;font:10px system-ui,"Microsoft YaHei",sans-serif;cursor:pointer}@media(max-width:900px){#wzSeasonal{width:248px;right:4px;transform:translateX(260px);transition:transform .16s ease}#wzSeasonal.open{transform:none}}
  `;
  document.head.append(style);
  const toggle=document.createElement('button');
  toggle.id='wzSeasonalToggle';toggle.textContent='四季';document.body.append(toggle);
  const panel=document.createElement('section');panel.id='wzSeasonal';
  panel.innerHTML=`
    <h2>温州四季与昼夜驱动</h2>
    <div class="srow"><label><input id="wzClimateAuto" type="checkbox" checked> 气候自动选云</label><b id="wzSeasonName">读取中</b></div>
    <div class="srow"><label><input id="wzAnnualPlay" type="checkbox"> 一年循环</label><select id="wzAnnualSpeed"><option value="0.25">0.25 日/秒</option><option value="1">1 日/秒</option><option value="5" selected>5 日/秒</option><option value="15">15 日/秒</option></select></div>
    <div class="srow"><button id="wzPrevMonth">上月</button><b id="wzMonthName">读取中</b><button id="wzNextMonth">下月</button></div>
    <div class="grid">
      <div class="cell"><span>月平均 2 m 气温</span><b id="wzT2m">读取中</b></div>
      <div class="cell"><span>月平均 2 m 相对湿度</span><b id="wzRh2m">读取中</b></div>
      <div class="cell"><span>月平均校正降水</span><b id="wzRain">读取中</b></div>
      <div class="cell"><span>月平均 10 m 风速</span><b id="wzWind">读取中</b></div>
      <div class="cell"><span>自动云属</span><b id="wzAutoCloud">读取中</b></div>
      <div class="cell"><span>天气过程候选</span><b id="wzProcess">读取中</b></div>
    </div>
    <div id="wzReason" class="source">读取中</div>
    <div id="wzPhysicalLock" class="lock">核对真实米制云层中</div>
    <div class="source">月尺度背景来自随页面归档的 NASA POWER 官方接口响应。自动选云属于显式规则模型，不能替代逐时观测、探空或历史再分析。台风等极端事件必须由事件资料驱动，月平均值不会自动伪造台风。</div>
  `;
  document.body.append(panel);
  toggle.onclick=()=>{if(innerWidth<900)panel.classList.toggle('open');else panel.classList.toggle('hidden');};
  return panel;
}

async function waitForRuntime(){
  for(let i=0;i<1200;i++){
    if(window.__WZ_API__&&window.__WZ_FULL__?.weather?.ready)return;
    await sleep(100);
  }
  throw new Error('温州主运行器未在规定时间内进入可交互状态');
}

function seasonName(month){return month<=2||month===12?'冬季':month<=5?'春季':month<=8?'夏季':'秋季';}
function setText(id,value){const node=document.getElementById(id);if(node)node.textContent=value;}
function currentClock(){
  const state=window.__WZ_FULL__;
  const date=new Date(`${state.weather.clock.dateIso}T00:00:00Z`);
  return{date,month:date.getUTCMonth()+1,day:date.getUTCDate(),hour:state.weather.clock.hour};
}

async function main(){
  makePanel();
  const response=await fetch('./seasonal-climatology.json',{cache:'no-store'});
  if(!response.ok)throw new Error(`季节气候数据读取失败 ${response.status}`);
  const climate=await response.json();
  if(!Array.isArray(climate.months)||climate.months.length!==12)throw new Error('季节气候数据月份不完整');
  await waitForRuntime();
  const api=window.__WZ_API__;
  const auto=document.getElementById('wzClimateAuto');
  const annual=document.getElementById('wzAnnualPlay');
  const speed=document.getElementById('wzAnnualSpeed');
  let simDate=null,lastWall=performance.now(),pending=false,lastTarget='',lastApply=0,physicalOk=true;

  function climateMonth(month){return climate.months[month-1];}
  function verifyPhysical(){
    const state=window.__WZ_FULL__,id=state?.weather?.caseId,metrics=state?.weather?.fieldMetrics;
    if(!PHYSICAL_LAYERS_M[id]||!metrics)return true;
    const expected=PHYSICAL_LAYERS_M[id];
    const ok=metrics.baseM===expected[0]&&metrics.topM===expected[1]&&metrics.verticalScale===1&&metrics.altitudeOffsetM===0;
    physicalOk=ok;
    const node=document.getElementById('wzPhysicalLock');
    node.textContent=ok?`真实高度锁定：${expected[0].toLocaleString()} 至 ${expected[1].toLocaleString()} m AMSL，垂直 1:1，高度偏移 0 m`:`高度契约失败：${id}`;
    node.classList.toggle('bad',!ok);
    if(!ok){auto.checked=false;annual.checked=false;}
    return ok;
  }

  async function applyTarget(target){
    const now=performance.now();
    if(!auto.checked||pending||!physicalOk||target.id===window.__WZ_FULL__?.weather?.caseId||now-lastApply<900)return;
    pending=true;
    try{await api.setWeather(target.id);lastTarget=target.id;lastApply=performance.now();verifyPhysical();}
    finally{pending=false;}
  }

  function updatePanel(){
    const clock=currentClock(),c=climateMonth(clock.month),target=profileFor(clock.month,clock.day,clock.hour,c);
    setText('wzSeasonName',seasonName(clock.month));setText('wzMonthName',MONTH_NAMES[clock.month-1]);
    setText('wzT2m',`${c.t2m.toFixed(1)} °C`);setText('wzRh2m',`${c.rh2m.toFixed(1)} %`);
    setText('wzRain',`${c.prectotcorr.toFixed(2)} mm/day`);setText('wzWind',`${c.ws10m.toFixed(1)} m/s`);
    setText('wzAutoCloud',CLOUD_NAMES[target.id]);setText('wzProcess',target.process);
    setText('wzReason',`${target.reason}。确定性天气相位采用当月第 ${clock.day} 日，当前本地太阳时 ${clock.hour.toFixed(2)}。`);
    verifyPhysical();
    applyTarget(target).catch(error=>{physicalOk=false;setText('wzPhysicalLock',String(error));});
    window.__WZ_SEASONAL__={
      ready:true,version:'wenzhou-seasonal-controller-0.5.5',source:climate.source,sourceSha256:climate.sourceSha256,
      automatic:auto.checked,annualCycle:annual.checked,daysPerSecond:+speed.value,month:clock.month,day:clock.day,hour:clock.hour,
      climate:c,target,activeCloud:window.__WZ_FULL__?.weather?.caseId,physicalHeightLock:physicalOk,
      physicalLayersM:PHYSICAL_LAYERS_M,visualLift:false,verticalCompression:false,altitudeOffsetM:0,verticalScale:1,
      historicalObservation:false,liveObservation:false,reanalysisConnected:false
    };
  }

  function shiftMonth(delta){
    annual.checked=false;
    const {date}=currentClock();date.setUTCDate(15);date.setUTCMonth(date.getUTCMonth()+delta);
    api.setDate(isoDate(date));simDate=date;updatePanel();
  }
  document.getElementById('wzPrevMonth').onclick=()=>shiftMonth(-1);
  document.getElementById('wzNextMonth').onclick=()=>shiftMonth(1);
  auto.onchange=()=>{lastTarget='';updatePanel();};
  annual.onchange=()=>{const clock=currentClock();simDate=new Date(clock.date);simDate.setUTCHours(Math.floor(clock.hour),Math.round((clock.hour%1)*60),0,0);lastWall=performance.now();};

  function loop(now){
    if(annual.checked){
      if(!simDate){const clock=currentClock();simDate=new Date(clock.date);simDate.setUTCHours(Math.floor(clock.hour),Math.round((clock.hour%1)*60),0,0);}
      const elapsed=Math.min(1,(now-lastWall)/1000);simDate=new Date(simDate.getTime()+elapsed*(+speed.value)*86400000);
      api.setDate(isoDate(simDate));api.setHour(simDate.getUTCHours()+simDate.getUTCMinutes()/60+simDate.getUTCSeconds()/3600);
    }
    lastWall=now;updatePanel();requestAnimationFrame(loop);
  }
  updatePanel();requestAnimationFrame(loop);
}

main().catch(error=>{
  console.error(error);
  const panel=document.getElementById('wzSeasonal')||makePanel();
  panel.classList.add('bad');panel.textContent=`四季控制器启动失败：${error.stack||error}`;
  window.__WZ_SEASONAL__={ready:false,error:String(error.stack||error)};
});
