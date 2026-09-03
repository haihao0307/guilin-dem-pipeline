import * as T from 'three';
export const SOURCE = Object.freeze({reviewFile:'B24_V012_PROPELLER_INTERFACE_REVIEW.html',reviewSha256:'7cf4c78cea99f9bf3aed5507cbcb2bdb49a71465b3c4aabc29563214f3da2fde',payloadBytes:16647376,payloadSha256:'7ba1b923844f5161911e9aa63b18191e0d08ff8de4b3750204aa544320bd34c2',exactV016Recovered:false});
const tireIds=new Set([598,613,1189,1200,681,689,698]);
const spindleIds=[1454,1385,1431,1408];
const clamp=T.MathUtils.clamp;
async function decompressed(url){const r=await fetch(url);if(!r.ok)throw new Error(`${url}: HTTP ${r.status}`);const bytes=await r.arrayBuffer();return new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();}
export class NativeAircraft {
  static async load(progress){
    progress(.12,'解压当前审查页的整机几何和原始机械动画');
    const [manifestBytes,payload]=await Promise.all([decompressed('./assets/native.json.gz'),decompressed('./assets/native.bin.gz')]);
    const m=JSON.parse(new TextDecoder().decode(manifestBytes));
    if(!globalThis.crypto?.subtle)throw new Error('请通过 HTTPS 在线地址打开工作台。');
    const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',payload))].map(v=>v.toString(16).padStart(2,'0')).join('');
    if(payload.byteLength!==SOURCE.payloadBytes||digest!==SOURCE.payloadSha256)throw new Error('整机数字载荷校验失败，已停止载入。');
    if(m.components.length!==1784||m.meshes.length!==348)throw new Error('当前审查资产结构与已锁定版本不符。');
    progress(.50,'保留源节点层级，建立金属、玻璃和机械分区');
    return new NativeAircraft(m,payload,digest);
  }
  constructor(m,payload,digest){
    this.m=m;this.payload=payload;this.digest=digest;this.cache=new Map();this.group=new T.Group();this.group.name='B24_INHERITED_AIRCRAFT';this.group.userData.source=SOURCE;
    this.nodes=[];this.meshes=[];this.skinMaterials=[];this.angles=[0,0,0,0];this.speeds=[0,0,0,0];this.previousGear=-1;this.previousBay=-1;
    const pathFor=(id)=>{const d=m.components[id];return d.parent===null?d.name:pathFor(d.parent)+'/'+d.name;};
    this.paths=m.components.map(d=>d.semanticPath||pathFor(d.id));
    this.geometries=m.meshes.map(d=>{const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(this.block(d.positionBlock),3));g.setAttribute('normal',new T.BufferAttribute(this.block(d.normalBlock),3));g.setIndex(new T.BufferAttribute(this.block(d.indexBlock),1));g.computeBoundingBox();g.computeBoundingSphere();return g;});
    for(const d of m.components){
      const n=new T.Group();n.name=d.name;n.userData.sourceNode=d.id;
      if(d.matrix){n.matrix.fromArray(d.matrix);n.matrix.decompose(n.position,n.quaternion,n.scale);}else{n.position.fromArray(d.translation||[0,0,0]);n.quaternion.fromArray(d.rotation||[0,0,0,1]);n.scale.fromArray(d.scale||[1,1,1]);}
      this.nodes.push(n);
    }
    for(const d of m.components){const n=this.nodes[d.id];if(d.parent===null)this.group.add(n);else this.nodes[d.parent].add(n);
      if(d.mesh!==null&&d.mesh!==undefined){
        const md=m.meshes[d.mesh],mat=this.material(d,md);const mesh=new T.Mesh(this.geometries[d.mesh],mat);mesh.name='source-mesh-'+d.id;mesh.userData.sourceNode=d.id;mesh.userData.family=d.semanticFamily;
        mesh.castShadow=d.semanticFamily!=='glass'&&d.semanticFamily!=='legacy-surface-overlay';mesh.receiveShadow=d.semanticFamily!=='glass';
        n.add(mesh);this.meshes.push(mesh);
        if(d.semanticFamily==='legacy-surface-overlay')mesh.visible=false;
        if(d.semanticFamily==='propeller'&&(/(?:_slow_|_blurred_)/i.test(this.paths[d.id])))n.visible=false;
      }
    }
    this.tracks=m.animations[0].tracks.map(t=>({...t,times:this.block(t.timeBlock),values:this.block(t.valueBlock)}));
    this.gearTracks=this.tracks.filter(t=>/(?:[lrc]_gear_|[lrc]_wheel_)/i.test(this.paths[t.targetNode]));
    this.bayTracks=this.tracks.filter(t=>/bomb_door/i.test(this.paths[t.targetNode]));
    for(const tr of this.tracks)this.sample(tr,0);
    // Four independent original spindle channels. The axis and sign come from
    // source quaternions, never from alternating engine array indices.
    this.spindles=spindleIds.map((id,engine)=>{
      const tr=this.tracks.find(t=>t.targetNode===id&&t.path==='rotation');if(!tr)throw new Error(`缺少第 ${engine+1} 台发动机原始旋转轨道`);
      const a=new T.Quaternion().fromArray(tr.values,0),b=new T.Quaternion().fromArray(tr.values,4);if(a.dot(b)<0)b.set(-b.x,-b.y,-b.z,-b.w);
      const delta=a.clone().invert().multiply(b);const axis=new T.Vector3(delta.x,delta.y,delta.z).normalize();if(axis.lengthSq()<.9)throw new Error('无法从原始螺旋桨动画确定旋转轴');
      return {id,node:this.nodes[id],axis,base:a,engine};
    });
    this.setMechanics(1,0);this.group.updateMatrixWorld(true);
    const front=this.minY([681,689]),main=this.minY([598,613,1189,1200]);
    this.groundPitch=(front-main)/4.95;
    this.group.rotation.x=this.groundPitch;this.group.updateMatrixWorld(true);
    this.groundY=-this.minY([598,613,1189,1200,681,689])+.026;
    this.group.rotation.x=0;this.group.position.y=this.groundY;this.group.updateMatrixWorld(true);
    this.gearMeshIds=[598,613,1189,1200,681,689];
    this.stats={components:m.components.length,meshes:m.meshes.length,triangles:m.statistics.triangles,sourcePayloadSHA256:digest,spindles:this.spindles.map(s=>({id:s.id,axis:s.axis.toArray()})),groundY:this.groundY,groundPitch:this.groundPitch,gearTracks:this.gearTracks.length,bayTracks:this.bayTracks.length};
  }
  block(i){if(this.cache.has(i))return this.cache.get(i);const b=this.m.blocks[i];const C={f32:Float32Array,u32:Uint32Array,u16:Uint16Array,u8:Uint8Array,i16:Int16Array}[b.dtype];if(!C)throw new Error('不支持的原始数据块 '+b.dtype);const out=new C(this.payload,b.offset,b.byteLength/C.BYTES_PER_ELEMENT);this.cache.set(i,out);return out;}
  material(d,md){
    const family=d.semanticFamily,path=this.paths[d.id].toLowerCase();
    const metal=new T.MeshStandardMaterial({color:0xb3b8b6,metalness:.96,roughness:.265,envMapIntensity:1.1,side:T.DoubleSide});
    if(tireIds.has(d.id)){metal.color.set(0x1b1d1a);metal.metalness=0;metal.roughness=.96;return metal;}
    if(family==='glass')return new T.MeshPhysicalMaterial({color:0xbad6d3,metalness:.05,roughness:.065,transparent:true,opacity:.23,depthWrite:false,side:T.DoubleSide,envMapIntensity:1.8,clearcoat:1});
    if(family==='propeller'){
      if(md.triangleCount===1128){metal.color.set(0x8c9190);metal.roughness=.31;return metal;}
      metal.color.set(0x171c1d);metal.metalness=.32;metal.roughness=.42;
      if(md.triangleCount===1119&&path.includes('_still_')){
        const min=md.bounds.min[2],max=md.bounds.max[2];
        metal.onBeforeCompile=shader=>{shader.uniforms.bladeMin={value:min};shader.uniforms.bladeMax={value:max};shader.vertexShader='varying float vBladeZ;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvBladeZ=position.z;');shader.fragmentShader='varying float vBladeZ;uniform float bladeMin;uniform float bladeMax;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\nfloat tip=smoothstep(.87,.89,(vBladeZ-bladeMin)/(bladeMax-bladeMin));diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.64,.39,.035),tip);');};metal.customProgramCacheKey=()=>`source-blade-yellow-tip`;
      }return metal;
    }
    const gear=/[lrc]_gear_|[lrc]_wheel_/i.test(path);
    if(gear||family==='landing-mechanism'){metal.color.set(0x8e9693);metal.roughness=.30;metal.metalness=.87;return metal;}
    if(family==='propulsion-mechanism'||family==='interior-detail'||family==='legacy-weapon'){metal.color.set(family==='interior-detail'?0x333f34:0x434946);metal.roughness=.43;metal.metalness=.65;return metal;}
    // Reversible aluminum appearance. Raw native data is never rewritten.
    const variation=((d.mesh*73)%29)/29;
    metal.color.setRGB(.43+variation*.07,.47+variation*.06,.48+variation*.045);
    metal.roughness=.245+variation*.035;
    if(/fabric|rudder|elevator|aileron/.test(path)){metal.roughness=.35;metal.metalness=.78;}
    this.skinMaterials.push(metal);return metal;
  }
  sample(tr,time){const ts=tr.times,vs=tr.values,n=this.nodes[tr.targetNode];let lo=0,hi=ts.length-1;while(hi-lo>1){const mid=(lo+hi)>>1;if(ts[mid]<=time)lo=mid;else hi=mid;}const u=clamp((time-ts[lo])/(ts[hi]-ts[lo]||1),0,1);if(tr.path==='rotation'){n.quaternion.fromArray(vs,lo*4);this._q??=new T.Quaternion();this._q.fromArray(vs,hi*4);n.quaternion.slerp(this._q,u);}else{const v=tr.path==='translation'?n.position:n.scale;v.set(T.MathUtils.lerp(vs[lo*3],vs[hi*3],u),T.MathUtils.lerp(vs[lo*3+1],vs[hi*3+1],u),T.MathUtils.lerp(vs[lo*3+2],vs[hi*3+2],u));}}
  setMechanics(gear,bay){
    if(Math.abs(gear-this.previousGear)>1e-5){for(const tr of this.gearTracks)this.sample(tr,gear*5);this.previousGear=gear;}
    if(Math.abs(bay-this.previousBay)>1e-5){for(const tr of this.bayTracks)this.sample(tr,bay*2.15);this.previousBay=bay;}
  }
  spin(dt,rpm){for(const s of this.spindles){this.speeds[s.engine]=rpm[s.engine];this.angles[s.engine]+=dt*rpm[s.engine]*Math.PI/30;this._spin??=new T.Quaternion();this._spin.setFromAxisAngle(s.axis,this.angles[s.engine]%(Math.PI*2));s.node.quaternion.copy(s.base).multiply(this._spin);}}
  minY(ids){let min=Infinity;const p=new T.Vector3();for(const id of ids){const mesh=this.meshes.find(m=>m.userData.sourceNode===id);if(!mesh)continue;const attr=mesh.geometry.attributes.position;for(let i=0;i<attr.count;i++){p.fromBufferAttribute(attr,i).applyMatrix4(mesh.matrixWorld);min=Math.min(min,p.y);}}return min;}
  reset(){this.angles.fill(0);this.speeds.fill(0);this.setMechanics(1,0);this.spin(0,this.speeds);}
}
