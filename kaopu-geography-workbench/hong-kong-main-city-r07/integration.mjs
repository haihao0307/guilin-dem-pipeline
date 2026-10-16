import{installGameControlBridge}from './game/control-bridge.mjs';
import{installR06Views}from './display/scene-views.mjs';
import{installTunnelScene}from './tunnel/curved-tunnel.mjs';
import {installCompleteConsist}from './train/install.mjs';
import {installTinhauYard}from './yard/install.mjs';
import {installNewRouteUI}from './route/ui.mjs';
import {installRailVerticalProfile}from './route/install-rail-profile.mjs';
import {loadSharedProjectionIntegration}from './route/bundle-loader.mjs';
import {installRegionOverview}from '../hong-kong-main-city-r02/projection/camera.mjs';
import {createAirportRenderer}from './airport.mjs';
import {createCityBuildings}from './city-buildings/runtime.mjs';
import {installDiagnosticsUI}from './display/diagnostics.mjs';
import {createOuterTerrain}from '../hong-kong-main-city-r02/runtime/outer-renderer.mjs';
import {createOuterOcean}from '../hong-kong-main-city-r02/ocean/extend-existing-ocean.mjs';
export async function createIntegration(host){
 try{
 await installRailVerticalProfile();
 const baseURL=new URL('../hong-kong-main-city-r01/',import.meta.url),{createIntegration:base}=await loadSharedProjectionIntegration({bundleURL:new URL('integration-aligned.js',baseURL),assetBaseURL:baseURL});
 const game=await base(host),airport=createAirportRenderer(host,window.KaiTakSetup),ocean=await createOuterOcean(host),city=await createCityBuildings(host),outer=await createOuterTerrain(host),draw=game.draw;
 window.HKLionRockTunnelScene=installTunnelScene(game);
 await installTinhauYard(game);
 window.HKOuterOcean=ocean;window.HKCityBuildings=city;window.HKOuterTerrain=outer;window.HKKaiTak=airport;
 const toolbar=document.createElement('nav');toolbar.id='nextMapToolbar';toolbar.setAttribute('aria-label','地图范围和显示控制');toolbar.innerHTML='<button data-focus="city">原九龙楼群</button><button data-focus="newKowloon">九龙新裸地</button><button data-focus="island">岛屿近览</button><button data-focus="kowloon">旧九龙站</button><button id="nextPanels" aria-expanded="false">显示面板</button><span id="nextMapSummary"></span><details id="railProfileNotice"><summary>线路纵坡与桥隧候选</summary><p>平面线路待调整；当前纵坡最大约5.42‰，游戏上限15‰，站内平段。固定平面导致约8.24km穿山候选、1.78km桥候选，最深覆土约483m，桥隧结构尚未建设。粉色地表规划覆盖线只标平面位置，不是实际轨顶；地下列车不抬到地面。站高为作品设计值，非铁路测量。</p></details>';const terrainNote=document.createElement('details');terrainNote.id='terrainIncrementNotice';terrainNote.innerHTML='<summary>真实裸地与未核支撑</summary><p>新增4块CEDD 2020裸地：0.5m原始源，2m节点显示，同高程链。新旧地形边缘最高相差28.64m，以明确的显示连接面封住两侧高度间的露天缝，不改变两侧高度或向内羽化；该面不是真实挡土墙。新增492个部件具完整陆地覆盖，其中69个高底塔体待复合体支撑核实离场；另2个岸边候选未入。现642候选是旧219+新423；不代表逐栋地基或1997外形验收。本批无纹理。</p>';toolbar.append(terrainNote);document.body.append(toolbar);
 const overview=installRegionOverview(host,game,{buttonParent:toolbar});toolbar.prepend(toolbar.querySelector('[data-view="whole-hong-kong"]'));
 document.body.classList.add('map-panels-folded');const fold=toolbar.querySelector('#nextPanels');fold.onclick=()=>{const hidden=document.body.classList.toggle('map-panels-folded');fold.textContent=hidden?'显示面板':'收起面板';fold.setAttribute('aria-expanded',String(!hidden));};
 toolbar.querySelector('[data-focus="city"]').onclick=()=>{overview.cancel();city.focusTile('11-NW-15B');host.mapState.distance=1300;host.mapState.target=[3280,38,5680];host.requestFrame();};toolbar.querySelector('[data-focus="island"]').onclick=()=>{overview.cancel();game.setMode('map');Object.assign(host.mapState,{target:[-12945,45,19120],distance:6000,yaw:-.25,pitch:-1.1});host.requestFrame();};toolbar.querySelector('[data-focus="kowloon"]').onclick=()=>{overview.cancel();game.setMode('map');window.HKMap.focus('kowloon');host.requestFrame();};
 let consist;
 game.draw=(c,s,e)=>{consist?.update();draw(c,s,e);airport.draw(c);city.draw(c,s,e);outer.draw(c,s,e);const cs=city.stats(),os=outer.stats();toolbar.querySelector('#nextMapSummary').textContent=`建筑 ${cs.visibleModels} 当前可见 / ${cs.defaultDisplayAllowedModels} 默认候选（${cs.terrainPendingModels} 地面或复合体支撑待核） · ${cs.agePolicy.enabled?"仅早于1997证据候选":"现代档案预览"}；旧入伙不证明旧外形 · 外围 ${os.visibleChunks}/${os.exteriorNonOceanChunks} 块 · 红磡局部高精待补（显示30m背景） · 本批无纹理，带图样本未接`;host.qa.nextMap={projection:{near:c.clipNear,far:c.clipFar,mode:c.clipMode},cityGPUBytes:cs.gpuBytes,outerGPUBytes:os.gpuBytes,oceanMaskGPUBytes:ocean.stats().maskGPUBytes,incrementalGPUBudgetBytes:192*1048576+ocean.stats().maskGPUBytes,existingHostGPUBytes:'not_included',sourceFilesModified:false,protectedStoryAndOldDetailModified:false,newSourceGroundOverlay:true,displaySeamClosure:window.HKCEDDTerrain.stats().seamClosure};};
 game.cityBuildings=city;game.outerTerrain=outer;game.airport=airport;
 window.HKMainCityNext={ready:true,terrain:window.HKCEDDTerrain,focusKowloonCombined:()=>{overview.cancel();game.setMode('map');Object.assign(host.mapState,{target:[3500,30,6400],distance:2800,yaw:-.55,pitch:-.85});host.requestFrame();},focusNewGroundClose:()=>{overview.cancel();game.setMode('map');Object.assign(host.mapState,{target:[3670,10,7050],distance:900,yaw:-.4,pitch:-.55});host.requestFrame();},focusNewKowloon:()=>{overview.cancel();game.setMode('map');Object.assign(host.mapState,{target:[3700,12,6900],distance:1600,yaw:-.55,pitch:-.72});host.requestFrame();},focusOverview:overview.focus,focusCity:()=>toolbar.querySelector('[data-focus="city"]').click(),focusIsland:()=>toolbar.querySelector('[data-focus="island"]').click(),stats:()=>({terrain:window.HKCEDDTerrain.stats(),rail:{status:window.HKRailVertical.status,validation:window.HKRailVertical.validation,designLabel:window.HKRailVertical.designLabel,bridgeConstruction:'not_built_candidates_only',tunnel:window.HKLionRockTunnelScene?.stats(),originalRoleCutawayRetained:false},city:city.stats(),outer:outer.stats(),ocean:ocean.stats(),projection:host.qa.clipProjection,overview:overview.getState(),coast:window.HKCoastClosure.stats(),diagnostics:window.HKMapDiagnostics?.stats(),scope:host.qa.nextMap})};
 toolbar.querySelector('[data-focus="newKowloon"]').onclick=()=>window.HKMainCityNext.focusNewKowloon();document.querySelector('#panel')?.classList.add('closed');document.title='香港主地图 · 全港外围与建筑谱';const title=document.querySelector('#mast h1');if(title)title.textContent='香港主地图 · 全港 / 建筑 / 88 / 启德';
 const routeUI=installNewRouteUI(host,game,{overview});
 installDiagnosticsUI(host,{city,toolbar});
 installR06Views(host,game,{overview});
 consist=await installCompleteConsist(host,game);game.completeConsist=consist;installGameControlBridge(host,game);
 if(window.HKConsistSetup.config.coachCount>4){const option=document.querySelector('#reviewLocation option[value="kowloon"]');if(option){option.disabled=true;option.textContent+='（本编组不适配）';}}
 setTimeout(()=>{const view=new URLSearchParams(location.search).get('view');if(view==='city')window.HKMainCityNext.focusCity();else if(view==='overview')overview.focus();else if(view==='new-close')window.HKMainCityNext.focusNewGroundClose();else if(view==='yard')routeUI.focusYard();else if(view==='tunnel')routeUI.focusTunnel();else if(view==='bridge')routeUI.focusBridge();else if(view==='route')routeUI.focusRoute();else if(view==='steam')consist.focusSteam();else consist.focusWhole();},0);
 return game;
 }catch(error){window.HKNextFatal=String(error.stack||error);const notice=document.getElementById('trainNotice');if(notice)notice.textContent='地图装配失败：'+error.message;throw error;}
}
