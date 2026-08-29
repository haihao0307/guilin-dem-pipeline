/* v3.2.3 watertight river carve, restrained surface colour and review cameras. */
carveRiverSampleV322=function(base,nearest,edge=1){
  if(!nearest)return{height:base,q:Infinity,clearance:0};
  const q=nearest.distance/(nearest.section.width*.5),bankBlend=q<=1?1:1-smoothstep(1,1.22,q);
  if(bankBlend<=0)return{height:base,q,clearance:0};
  const channel=clamp(1-q,0,1),clearance=.42+3.18*Math.pow(channel,1.32),target=nearest.section.water-clearance;
  const strength=state.enhanceMix*state.river*bankBlend;
  const height=q<=1&&state.enhanceMix>0?Math.min(base,target):lerp(base,Math.min(base,target),strength);
  return{height,q,clearance};
};

terrainColor=function(tone,heightNorm,worldX,worldY,layer){
  const variation=fbm(worldX*.0022,worldY*.0022,811,4)*.025;
  if(state.preset.id==='paddy'&&layer==='local'){
    const dry=new THREE.Color(0x9b9270),field=new THREE.Color(0x77855d),wet=new THREE.Color(0x758889);
    const colour=dry.clone().lerp(field,clamp(tone,0,1));if(tone>.76)colour.lerp(wet,(tone-.76)/.24*.32);colour.offsetHSL(0,0,variation);return colour;
  }
  if(!state.tone){const grey=clamp(.56+heightNorm*.11+variation,.42,.76);return new THREE.Color(grey,grey,grey)}
  const rock=new THREE.Color(layer==='regional'?0x727972:0x7c8178),plain=new THREE.Color(0x999675),high=new THREE.Color(0x888d84);
  const colour=rock.clone().lerp(plain,clamp(tone,0,1));colour.lerp(high,clamp(heightNorm*.26,0,.26));colour.offsetHSL(0,0,variation);return colour;
};

configureCamera=function(view,build=state.currentBuild){
  if(!build)return;
  const offset=build.localOffset||{x:0,z:0},targetHeight=build.localTargetHeight||260,id=state.preset.id;
  camera.fov=id==='atlas'?32:id==='paddy'?42:38;camera.updateProjectionMatrix();
  if(id==='atlas'){camera.position.set(3650,1900,4550);controls.target.set(0,245,0)}
  else if(id==='paddy'){camera.position.set(offset.x+720,targetHeight+360,offset.z+900);controls.target.set(offset.x,targetHeight+5,offset.z)}
  else if(id==='river'){camera.position.set(offset.x+1220,targetHeight+520,offset.z+1500);controls.target.set(offset.x,targetHeight+10,offset.z)}
  else{camera.position.set(offset.x+610,targetHeight+360,offset.z+760);controls.target.set(offset.x,targetHeight+90,offset.z)}
  controls.update();
};
