import {createIntegration as base} from './integration-aligned.js';
import {createAirportRenderer} from './airport.mjs';
import {createCityBuildings} from './city-buildings/runtime.mjs';
export async function createIntegration(host){
 const game=await base(host),airport=createAirportRenderer(host,window.KaiTakSetup),draw=game.draw;
 let city=null;try{city=await createCityBuildings(host);}catch(error){host.qa.cityBuildings={ready:false,fatalError:String(error.stack||error)};console.error('CITY_LAYER_FAILED',error);const p=document.createElement('aside');p.id='cityBuildingsPanel';p.textContent='建筑谱层未载入，原地图继续保留：'+error.message;document.body.append(p);}
 game.draw=(...args)=>{draw(...args);airport.draw(args[0]);city?.draw(...args);};game.airport=airport;game.cityBuildings=city;window.HKKaiTak=airport;window.HKCityBuildings=city;
 document.querySelector('#panel')?.classList.add('closed');document.title='香港主地图 · 已下载建筑谱层';const title=document.querySelector('#mast h1');if(title)title.textContent='香港主地图 · 建筑 / 88 / 启德';
 setTimeout(()=>{game.setMode('map');const first=city?.manifest.tiles.find(t=>t.readyModels>0);if(first)city.focusTile(first.id);else window.HKMap.focus('kaitak_world');},0);
 return game;
}
