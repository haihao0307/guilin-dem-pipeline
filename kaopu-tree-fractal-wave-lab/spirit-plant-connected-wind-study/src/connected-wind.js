/** Independent bounded study. Not Spirit Plant source or recovered physics.
 * Reference: https://variable.io/expo-2025-spirit-plant/
 * Preserve R03 rest geometry; pose only existing instances, never generate organs.
 */
export const RULE_VERSION = 'r03-connected-wind-study-20261005-v1';
export function makeConnectedWind(THREE, graph, seed=123303) {
  const V=THREE.Vector3,Q=THREE.Quaternion,up=new V(0,1,0);
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  const nodes=[],keys=new Map();
  for(let i=0;i<graph.segments.length;i++){
    const s=graph.segments[i],delta=s.b.clone().sub(s.a),length=delta.length();
    if(!(length>0)||s.parent>=i)throw Error('Invalid parent ordering or zero branch');
    const T=delta.clone().normalize();
    let N;
    if(s.parent>=0){const p=nodes[s.parent];N=p.N.clone().applyQuaternion(new Q().setFromUnitVectors(p.T,T));}
    else N=Math.abs(T.dot(up))>.92?new V(1,0,0):up.clone().cross(T);
    N.addScaledVector(T,-N.dot(T)).normalize();const B=T.clone().cross(N).normalize();
    let attachment=0;
    if(s.parent>=0){const p=nodes[s.parent];attachment=s.a.clone().sub(p.restA).dot(p.T)/p.length;
      const error=p.restA.clone().addScaledVector(p.T,attachment*p.length).distanceTo(s.a);
      if(error>1e-9||attachment<0||attachment>1+1e-9)throw Error('Disconnected R03 branch '+s.key);
    }
    const node={id:seed+':'+s.key,parent:s.parent,attachment,restA:s.a.clone(),restB:s.b.clone(),T,N,B,length,order:s.order,depth:s.depth,support:s.support,
      a:s.a.clone(),b:s.b.clone(),dir:T.clone(),rotation:new Q(),wind:new V(),response:0,
      // Unitless study gain, not material stiffness or a measured plant parameter.
      compliance:clamp((.24+.11*s.order+.03*s.depth)/(1+.10*Math.sqrt(s.support)),.03,.85)};
    nodes.push(node);keys.set(s.key,i);
  }
  const buds=graph.buds.map(b=>{
    const parent=keys.get(b.key.replace(/(?:L|B\d+)$/,''));
    if(parent===undefined)throw Error('Missing bud parent '+b.key);
    const p=nodes[parent],local=b.pos.clone().sub(p.restA);
    return {rest:b.pos.clone(),pos:b.pos.clone(),parent,local,state:b.state,type:b.type,key:b.key};
  });
  const tmp=new V(),axis=new V(),q=new Q(),sample=new V();
  // One continuous world field, sampled at immutable rest midpoints (one-way kinematic approximation). Position changes phase; orientation affects cross-wind load.
  // No per-branch random time offset and no camera input.
  function field(position,time,strength=1,azimuth=35,out=new V()){
    const a=azimuth*Math.PI/180,dx=Math.cos(a),dz=Math.sin(a);
    const along=position.x*dx+position.z*dz,across=-position.x*dz+position.z*dx;
    const gust=.55+.27*Math.sin(along*.78+position.y*.43-time*1.1)+.18*Math.sin(across*.63-position.y*.27-time*.61);
    const cross=.19*Math.sin(along*.44+across*.57+position.y*.24-time*.83);
    return out.set(dx*gust-dz*cross,.05*Math.sin(position.y*.61+along*.32-time*.77),dz*gust+dx*cross).multiplyScalar(strength);
  }
  function pose(time,{strength=.65,azimuth=35,offsetX=0,offsetZ=0}={}){
    if(!Number.isFinite(time)||![strength,azimuth,offsetX,offsetZ].every(Number.isFinite))throw Error('Nonfinite wind input');
    strength=clamp(strength,0,1.5);
    for(const n of nodes){
      // Exact zero-wind restoration: copy authoritative bytes, avoid accumulated transform error.
      if(strength===0){n.a.copy(n.restA);n.b.copy(n.restB);n.dir.copy(n.T);n.rotation.identity();n.wind.set(0,0,0);n.response=0;continue;}
      const p=n.parent>=0?nodes[n.parent]:null;
      if(p){n.a.copy(p.a).addScaledVector(p.dir,p.length*n.attachment);n.dir.copy(n.T).applyQuaternion(p.rotation);}
      else {n.a.copy(n.restA);n.dir.copy(n.T);}
      sample.copy(n.restA).lerp(n.restB,.5);sample.x+=offsetX;sample.z+=offsetZ;
      field(sample,time,strength,azimuth,n.wind);
      tmp.copy(n.wind).addScaledVector(n.dir,-n.wind.dot(n.dir));
      const magnitude=tmp.length();n.response=Math.min(.065,.10*n.compliance*magnitude);
      if(magnitude>1e-12){axis.crossVectors(n.dir,tmp).normalize();q.setFromAxisAngle(axis,n.response);n.dir.applyQuaternion(q).normalize();}
      n.b.copy(n.a).addScaledVector(n.dir,n.length);
      // Transport the complete inherited local frame, including parent roll.
      if(p)n.rotation.copy(p.rotation);else n.rotation.identity();
      if(magnitude>1e-12)n.rotation.premultiply(q);
    }
    for(const b of buds){const n=nodes[b.parent];b.pos.copy(b.local).applyQuaternion(n.rotation).add(n.a);if(strength===0)b.pos.copy(b.rest);}
    return nodes;
  }
  let hash=2166136261>>>0;
  const identityText=JSON.stringify({rule:RULE_VERSION,seed,segments:graph.segments.map(s=>[s.key,s.parent,...s.a.toArray(),...s.b.toArray(),s.support]),buds:graph.buds.map(b=>[b.key,b.state,...b.pos.toArray()])});
  for(let i=0;i<identityText.length;i++){hash^=identityText.charCodeAt(i);hash=Math.imul(hash,16777619)>>>0;}
  const identity={rule:RULE_VERSION,seed,topologyHash:hash.toString(16).padStart(8,'0'),segments:nodes.length,buds:buds.length};
  function metrics(){
    let connectionError=0,lengthError=0,frameError=0,maxDisplacement=0;
    for(const n of nodes){
      lengthError=Math.max(lengthError,Math.abs(n.a.distanceTo(n.b)-n.length));
      maxDisplacement=Math.max(maxDisplacement,n.b.distanceTo(n.restB));
      const t=n.T.clone().applyQuaternion(n.rotation),nn=n.N.clone().applyQuaternion(n.rotation),bb=n.B.clone().applyQuaternion(n.rotation);
      frameError=Math.max(frameError,Math.abs(t.dot(nn)),Math.abs(t.dot(bb)),Math.abs(nn.dot(bb)),Math.abs(t.length()-1),t.distanceTo(n.dir));
      if(n.parent>=0){const p=nodes[n.parent];connectionError=Math.max(connectionError,n.a.distanceTo(p.a.clone().addScaledVector(p.dir,p.length*n.attachment)));}
    }
    return {connectionError,lengthError,frameError,rootError:nodes[0]?.a.distanceTo(nodes[0].restA)||0,maxDisplacement};
  }
  return {nodes,buds,identity,pose,field,metrics};
}
