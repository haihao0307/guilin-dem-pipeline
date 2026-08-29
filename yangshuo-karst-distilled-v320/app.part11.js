/* v3.2.6 visual QA repair: remove shadow acne and expose paddy field grammar. */
const initRendererV326=initRenderer;
initRenderer=async function(){
  await initRendererV326();
  sun.shadow.bias=.0008;
  sun.shadow.normalBias=3.2;
  sun.shadow.radius=2;
};

const createTerrainMeshV326=createTerrainMesh;
createTerrainMesh=function(...args){
  const mesh=createTerrainMeshV326(...args);
  mesh.castShadow=false;
  mesh.receiveShadow=false;
  return mesh;
};

terrainColor=function(tone,heightNorm,worldX,worldY,layer){
  const variation=fbm(worldX*.0022,worldY*.0022,811,4)*.018;
  if(state.preset.id==='paddy'&&layer==='local'){
    const warpX=fbm(worldX*.004,worldY*.004,612,3)*18,warpY=fbm(worldX*.004+5.1,worldY*.004-2.3,632,3)*18;
    const cell=worley((worldX+warpX)*.021,(worldY+warpY)*.012,654);
    const boundary=smoothstep(.18,.035,cell.f2-cell.f1);
    const channelPhase=Math.abs(Math.sin((worldX*.021+worldY*.013)+fbm(worldX*.006,worldY*.006,722,3)*2.2));
    const channel=smoothstep(.12,.015,channelPhase)*smoothstep(.08,.28,cell.f1);
    const fieldSeed=hash21(cell.cellX,cell.cellZ,744);
    const fieldA=new THREE.Color(0x7d8d57),fieldB=new THREE.Color(0xa39b58),bundColour=new THREE.Color(0x5f573f),channelColour=new THREE.Color(0x70858a);
    const colour=fieldA.clone().lerp(fieldB,fieldSeed*.72+.12);
    colour.lerp(bundColour,clamp(boundary*.92,0,.92));
    colour.lerp(channelColour,clamp(channel*.72,0,.72));
    colour.offsetHSL(0,0,variation);
    return colour;
  }
  if(!state.tone){
    const grey=clamp(.59+heightNorm*.095+variation,.46,.76);
    return new THREE.Color(grey,grey,grey);
  }
  const rock=new THREE.Color(layer==='regional'?0x747a74:0x7c817a),plain=new THREE.Color(0x989576),high=new THREE.Color(0x898e86);
  const colour=rock.clone().lerp(plain,clamp(tone,0,1));colour.lerp(high,clamp(heightNorm*.22,0,.22));colour.offsetHSL(0,0,variation);return colour;
};

const configureCameraV326=configureCamera;
configureCamera=function(view,build=state.currentBuild){
  configureCameraV326(view,build);
  if(!build)return;
  if(state.preset.id==='paddy'){
    const offset=build.localOffset||{x:0,z:0},targetHeight=build.localTargetHeight||260;
    camera.fov=36;camera.updateProjectionMatrix();
    camera.position.set(offset.x+470,targetHeight+265,offset.z+620);
    controls.target.set(offset.x,targetHeight+3,offset.z);
    controls.update();
  }
};
