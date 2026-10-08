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

window.__trainDriver.test.heroArea=()=>{const bounds=new THREE.Box3().setFromObject(world.train.root),w=wrap.clientWidth,h=wrap.clientHeight;function projected(cam,width,height){cam.updateMatrixWorld();const points=[];for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z])points.push(new THREE.Vector3(x,y,z).project(cam));const minX=Math.max(-1,Math.min(...points.map(p=>p.x))),maxX=Math.min(1,Math.max(...points.map(p=>p.x))),minY=Math.max(-1,Math.min(...points.map(p=>p.y))),maxY=Math.min(1,Math.max(...points.map(p=>p.y)));return{width:(maxX-minX)*width/2,height:(maxY-minY)*height/2,area:(maxX-minX)*(maxY-minY)*width*height/4};}const oldW=$('driverGame').clientWidth-190,oldH=$('driverGame').clientHeight,old=new THREE.PerspectiveCamera(32,oldW/oldH,.1,180);old.position.set(19,24,38);old.lookAt(-8.8,-.8,1);return{current:projected(camera,w,h),acceptedAnchor:projected(old,oldW,oldH),canvas:[w,h],oldCanvas:[oldW,oldH]};};

window.__trainDriver.test.heroRect=()=>{camera.updateMatrixWorld();const bounds=new THREE.Box3().setFromObject(world.train.root),pts=[];for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z])pts.push(new THREE.Vector3(x,y,z).project(camera));return{left:(Math.min(...pts.map(p=>p.x))+1)*wrap.clientWidth/2,right:(Math.max(...pts.map(p=>p.x))+1)*wrap.clientWidth/2,top:(1-Math.max(...pts.map(p=>p.y)))*wrap.clientHeight/2,bottom:(1-Math.min(...pts.map(p=>p.y)))*wrap.clientHeight/2};};

// Read-only camera evidence: exact fixed subject used by production zoom logic.
window.__trainDriver.test.cameraEvidence=()=>{camera.updateMatrixWorld();const pts=zoomPoints.map(p=>p.clone().project(camera)),w=wrap.clientWidth,h=wrap.clientHeight;return{position:camera.position.toArray(),target:cameraTarget.toArray(),zoom:camera.zoom,fov:camera.fov,aspect:camera.aspect,width:w,height:h,center:[(Math.min(...pts.map(p=>p.x))+Math.max(...pts.map(p=>p.x))+2)*w/4,(2-Math.min(...pts.map(p=>p.y))-Math.max(...pts.map(p=>p.y)))*h/4],span:[(Math.max(...pts.map(p=>p.x))-Math.min(...pts.map(p=>p.x)))*w/2,(Math.max(...pts.map(p=>p.y))-Math.min(...pts.map(p=>p.y)))*h/2],profile:viewControls.state()};};
