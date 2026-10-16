import{ORIGINAL_CONTROL_ICONS}from './control-icons.mjs';
export function installGameInterface(host,game,cameras){
 const $=id=>document.getElementById(id);document.body.classList.add('r08-landscape-game');
 const nav=document.createElement('nav');nav.id='r08GameViews';nav.setAttribute('aria-label','列车观察位置');
 const choices=[['side','车侧'],['front','车头前视'],['cab','驾驶室'],['engine-interior','机车内部'],['coach-interior','车厢内'],['tail','车尾后视'],['free-follow','自由跟车'],['map','整图']];
 let selected='side';const buttons=[];
 function select(mode){selected=mode;if(mode==='map')cameras.release('map');else if(mode==='free-follow')cameras.release('follow');else cameras.setMode(mode);for(const b of buttons)b.setAttribute('aria-pressed',String(b.dataset.mode===mode));host.requestFrame();}
 for(const[mode,label]of choices){const b=document.createElement('button');b.dataset.mode=mode;b.textContent=label;b.onclick=()=>select(mode);nav.append(b);buttons.push(b);}
 const detailsButton=document.createElement('button');detailsButton.id='r08MapTools';detailsButton.textContent='地图 / 设置';detailsButton.setAttribute('aria-expanded','false');detailsButton.onclick=()=>{const open=document.body.classList.toggle('r08-tools-open');detailsButton.setAttribute('aria-expanded',String(open));detailsButton.textContent=open?'收起设置':'地图 / 设置';};nav.append(detailsButton);document.body.append(nav);
 for(const[id,key]of[['accelerateR08','accelerate'],['decelerateR08','decelerate'],['holdBrakeR08','brake']]){const b=$(id);const text=b.textContent;b.innerHTML=ORIGINAL_CONTROL_ICONS[key]+'<span>'+text+'</span>';}
 $('trainButtons').prepend($('depart'),$('accelerateR08'),$('decelerateR08'),$('holdBrakeR08'),$('serviceStopR08'),$('drivePause'));
 const boarding=$('stationAction');const reason=document.createElement('small');reason.id='boardingReasonR08';reason.textContent='乘降暂未接入：中心通过轨无贴邻站台，原门位与乘客服务仍需接齐。';boarding.after(reason);
 const options=document.createElement('details');options.id='r08DriveSettings';options.innerHTML='<summary>汽门 / 制动 / 起步参数</summary>';options.append($('sliders'));const config=window.HKGameR08.settings;
 for(const[key,label]of[['purgeDurationS','预排汽 秒'],['launchDurationS','柔起步 秒']]){const wrap=document.createElement('label'),input=document.createElement('input');input.type='number';input.min='.1';input.max='30';input.step='.1';input.value=String(config[key]);input.id='r08-'+key;input.onchange=()=>{const v=Number(input.value);if(!Number.isFinite(v)||v<.1||v>30){input.value=String(config[key]);return;}config[key]=v;};wrap.append(label,input);options.append(wrap);}
 const label=document.createElement('small');label.textContent='起步时长为本版可调游戏参数；原120Hz物理推进。';options.append(label);$('driver').append(options);
 const landscapeHint=document.createElement('p');landscapeHint.id='r08LandscapeHint';landscapeHint.textContent='横置屏幕可获得完整横版视野';document.body.append(landscapeHint);
 const legacy=$('sceneTools')?.querySelector('.cameras');if(legacy){for(const b of legacy.querySelectorAll('[data-camera]')){const m=b.dataset.camera;b.onclick=()=>{if(m==='follow')select('free-follow');else if(m==='side')select('side');else{cameras.release(m);selected=m;}};}}
 const initial=new URLSearchParams(location.search).get('camera');select(choices.some(v=>v[0]===initial)?initial:'side');
 return{select,stats:()=>({selected,originalControlArtwork:true,landscapeDesktop:true,portraitRotation:false,portraitHintVisible:innerHeight>innerWidth,boardingAvailable:false})};
}
