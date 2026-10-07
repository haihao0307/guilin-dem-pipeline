// CI-only fixture adapter, appended to app.mjs by Playwright after real-input testing.
// This file is excluded from the production manifest and is never imported by the app.
let fixtureLegacySmoke=null;
window.__trainDriver.test={
  start,
  command:(type,value)=>command(type,value),
  stepTicks:n=>{game.stepTicks(n);const view=game.view();events(view);draw(view,1,true);updateHUD(view);return view;},
  pause:value=>setPaused(value),
  render:()=>draw(game.view(),1,true),
  session:()=>game,
  smokeFrame:mode=>{game.paused=true;game.elapsed=0;draw(game.view(),1,true);smoke.root.visible=mode!=='legacy';if(mode==='legacy'){if(!fixtureLegacySmoke){fixtureLegacySmoke=createGameSmoke({legacy:true});scene.add(fixtureLegacySmoke.root);}fixtureLegacySmoke.update(0,camera,{comparison:true});}else smoke.update(0,camera,{comparison:true});renderer.render(scene,camera);needsRender=false;}
};
