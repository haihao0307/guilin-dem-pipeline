// Adapter only. Frozen V001 shaders, field worker, spectrum and defaults are not edited.
window.createStoneMoneyOcean = async function(gl,canvas){
 'use strict';
 const nodes=new Map(),$=id=>{if(!nodes.has(id))nodes.set(id,{style:{},classList:{add(){},remove(){},toggle(){}},textContent:'',hidden:true,checked:true});return nodes.get(id)};
 const W=window.OceanWeather;
 const qa={ready:false,errors:[],cloudAtlasFrames:0,baselineVerified:false,source:'original-deep-v001',sourceByteIdentical:true};
 function fail(e){qa.errors.push(e?.stack||String(e));throw e instanceof Error?e:new Error(String(e));}
 // __FROZEN_KERNEL__
 let lastWorldTime=0,preparedNow=0;
 function prepare(now,worldTime){
  preparedNow=now;
  const dt=Math.max(0,worldTime-lastWorldTime);lastWorldTime=worldTime;
  W.tick(dt);seaTime=worldTime;
  gl.activeTexture(gl.TEXTURE0);
  if(pendingNoise){upload3(noise,pendingNoise.data,[96,96,96],1);pendingNoise=null;noiseReady=true;}
  if(pendingVolume){const d=pendingVolume;pendingVolume=null;if(d.borderMax!==0||!d.supportSafe)throw Error('Frozen cloud support boundary failed');upload3(macro,d.data,dims);upload3(shadow,d.tau,d.shadowSize,2);upload3(occupancy,d.occupancy.data,d.occupancy.size,3);occupancySize=d.occupancy.size;groups=d.groups;volumeReady=true;shadowSun=d.sun;qa.cloudVolumeBytes=d.data.byteLength;qa.cloudKind=d.kind;qa.cloudSeed=d.seed;envForce=true;baking=false;}
  if(pendingLight){upload3(shadow,pendingLight.tau,pendingLight.shadowSize,2);shadowSun=pendingLight.sun;pendingLight=null;envForce=true;baking=false;}
  const s=W.snapshot(),e=W.getEnvironment(),sun=e.sun.direction[1]>=0?e.sun.direction:e.sun.direction.map(x=>-x);
  if(volumeReady&&!lightBusy&&shadowSun&&Math.hypot(...sun.map((v,k)=>v-shadowSun[k]))>.025){lightBusy=true;shadowRequested=[...sun];worker.postMessage({light:true,id:workerJob,revision:workerJob,sun});}
  if(waveDirty)makeWaves();for(let k=0;k<96;k++){currentK[k]+=(waveK[k]-currentK[k])*Math.min(1,dt*2);currentA[k]+=(waveA[k]-currentA[k])*Math.min(1,dt*2);}
  gl.depthMask(true);gl.colorMask(true,true,true,true);gl.disable(gl.BLEND);gl.disable(gl.CULL_FACE);
  bakeTile(now);envMix=envCompleted<=1?1:clamp((now-lastEnvSwap)/400,0,1);
  qa.worldTime=worldTime;qa.cloudReady=readyEnvironment;qa.environment=e;qa.oceanState={...S};
  gl.disable(gl.SCISSOR_TEST);
 }
 function view(c){return{cam:[c.eye[0],c.eye[1],c.eye[2]+8000],fw:c.forward,right:c.right,up:c.up,flat:norm([c.forward[0],0,c.forward[2]])};}
 function bindOriginal(p,c){const s=W.snapshot(),e=W.getEnvironment();common(p,preparedNow,s,e,view(c));f(p,'tanFov',Math.tan(c.fov/2));return{s,e};}
 function target(fbo){gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);gl.viewport(0,0,canvas.width,canvas.height);gl.disable(gl.SCISSOR_TEST);gl.disable(gl.CULL_FACE);gl.disable(gl.BLEND);gl.colorMask(true,true,true,true);}
 function drawSky(fbo,c){target(fbo);gl.disable(gl.DEPTH_TEST);gl.depthMask(false);bindOriginal(skyProgram,c);gl.bindVertexArray(fullVao);gl.drawArrays(gl.TRIANGLES,0,3);gl.depthMask(true);}
 function drawSea(fbo,c){target(fbo);gl.enable(gl.DEPTH_TEST);gl.depthMask(true);gl.depthFunc(gl.LESS);const{s,e}=bindOriginal(seaProgram,c);f(seaProgram,'chop',S.chop);f(seaProgram,'gridRows',gridRows);v3(seaProgram,'flatForward',view(c).flat);f(seaProgram,'rough',S.rough);f(seaProgram,'waterTint',S.tint);f(seaProgram,'foamGain',S.foam);f(seaProgram,'windSpeed',s.wind);v2(seaProgram,'windTo',e.wind.direction[0],e.wind.direction[2]);f(seaProgram,'doFoam',1);f(seaProgram,'doReflection',1);gl.uniform4fv(loc(seaProgram,'uWaveK[0]'),currentK);gl.uniform4fv(loc(seaProgram,'uWaveA[0]'),currentA);gl.bindVertexArray(gridVao.vao);gl.drawElements(gl.TRIANGLES,gridIndexCount,gl.UNSIGNED_INT,0);}
 function bindGame(p){const s=W.snapshot(),e=W.getEnvironment();lighting(p,s,e);for(const[unit,texture]of[[6,atlases[(envIndex+2)%3].texture],[7,atlases[envIndex].texture]]){gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,texture);}i(p,'smiEnvA',6);i(p,'smiEnvB',7);f(p,'smiEnvMix',envMix);f(p,'smiEncodedEnv',hdr?0:1);gl.uniform4fv(loc(p,'smiWaveK[0]'),currentK);gl.uniform4fv(loc(p,'smiWaveA[0]'),currentA);}
 function setWeatherParameter(key,value){W.set(key,value);if(key==='wind'||key==='direction')waveDirty=true;if(['hour','density'].includes(key)){envForce=true;envDirty=true;baking=false;}}
 quality();worker.postMessage({noise:true});
 const initial=seaPresets.breeze;for(const k of ['swell','period','chop','rough','foam','tint','height'])S[k]=initial[k];W.setWeather(initial.weather);W.set('wind',initial.wind);W.set('hour',initial.hour);W.set('direction',270);makeWaves();rebuild();
 const api={qa,prepare,drawSky,drawSea,bindGame,sampleHeight:(x,z,t=seaTime)=>surface(x,z+8000,t),setWeatherParameter,getEnvironment:W.getEnvironment,getWeather:W.snapshot,getOriginalConfiguration:()=>({ocean:{...S},weather:W.snapshot()}),dispose:()=>worker.terminate()};
 window.StoneMoneyFrozenOcean=api;return api;
};
