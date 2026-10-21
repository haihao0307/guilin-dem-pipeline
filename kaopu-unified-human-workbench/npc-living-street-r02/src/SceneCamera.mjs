/** Camera placement against the actual visible street meshes.
 * A follow view keeps the native character readable without removing scenery.
 * Six body probes and 24 azimuths at two elevations are checked on selection
 * and after a material movement, rather than raycasting on every render.
 */
export function createSceneCamera({THREE,viewer,street,actors}) {
  const T=THREE,camera=viewer.camera,orbit=viewer.orbit,occluders=[];
  street.traverse(node=>{if(node.isMesh&&node.geometry)occluders.push(node);});
  const ray=new T.Raycaster(),direction=new T.Vector3(),delta=new T.Vector3();
  const visible=node=>{for(let p=node;p;p=p.parent)if(!p.visible)return false;return true;};
  let last=null,report=null;
  const angleDistance=(a,b)=>Math.abs(Math.atan2(Math.sin(a-b),Math.cos(a-b)));
  const body=id=>actors.find(actor=>actor.id===id);

  function inspect(position,probes) {
    const hits=[];
    for(const probe of probes){
      direction.copy(position).sub(probe);const distance=direction.length();
      ray.set(probe,direction.multiplyScalar(1/distance));ray.near=.025;ray.far=Math.max(.025,distance-.08);
      const intersection=ray.intersectObjects(occluders,false).find(hit=>visible(hit.object));
      if(intersection)hits.push({object:intersection.object.name||intersection.object.type,distanceM:intersection.distance});
    }
    return hits;
  }

  function place(state,{mode='follow',force=false}={}) {
    const actor=body(state.id);if(!actor)throw Error('Camera target has no native character: '+state.id);
    const height=actor.measurements.heightM;
    if(!Number.isFinite(height)||height<.5)throw Error('Camera requires measured native height');
    const center=new T.Vector3(state.x,height*.51,state.z);
    if(last&&last.id===state.id&&last.mode===mode&&!force){
      delta.copy(center).sub(last.center);orbit.target.add(delta);camera.position.add(delta);
      last.center.copy(center);orbit.update();
      if(Math.hypot(state.x-last.checkedX,state.z-last.checkedZ)<.65)return report;
    }
    street.updateWorldMatrix(true,true);
    const fraction=mode==='follow'?.58:.36,tan=Math.tan(T.MathUtils.degToRad(camera.fov*.5));
    const right=new T.Vector3(Math.cos(state.yaw),0,-Math.sin(state.yaw)),width=height*.105;
    const probes=[new T.Vector3(state.x,.07,state.z).addScaledVector(right,-width*.55),
      new T.Vector3(state.x,.07,state.z).addScaledVector(right,width*.55),
      new T.Vector3(state.x,height*.45,state.z),
      new T.Vector3(state.x,height*.72,state.z).addScaledVector(right,-width),
      new T.Vector3(state.x,height*.72,state.z).addScaledVector(right,width),
      new T.Vector3(state.x,height*.94,state.z)];
    const current=Math.atan2(camera.position.x-center.x,camera.position.z-center.z);
    const preferred=force?state.yaw+.38:current,candidates=[];
    for(const elevation of [.19,.34])for(let i=0;i<24;i++){
      const yaw=preferred+i*Math.PI/12;
      // Fit the standing extent with an extra perspective margin. Body size
      // comes from this actor, so short and tall residents occupy equal space.
      const distance=height/(2*tan*fraction)*1.035;
      const position=center.clone().add(new T.Vector3(Math.sin(yaw)*Math.cos(elevation),Math.sin(elevation),Math.cos(yaw)*Math.cos(elevation)).multiplyScalar(distance));
      const hits=inspect(position,probes);
      candidates.push({position,yaw,elevation,distance,hits,
        score:hits.length*100+angleDistance(yaw,preferred)+elevation*.15});
    }
    candidates.sort((a,b)=>a.score-b.score);const best=candidates[0];
    orbit.target.copy(center);camera.position.copy(best.position);camera.zoom=1;orbit.update();camera.updateProjectionMatrix();
    last={id:state.id,mode,center:center.clone(),checkedX:state.x,checkedZ:state.z};
    report={actor:state.id,mode,heightM:height,targetHeightFraction:fraction,
      candidates:candidates.length,probes:probes.length,occludedProbes:best.hits.length,
      occluders:best.hits,position:camera.position.toArray(),target:center.toArray(),
      method:'visible native street mesh raycasts; no mesh hiding or replacement'};
    return report;
  }
  return {place,reset(){last=null;report=null;},report:()=>report};
}
