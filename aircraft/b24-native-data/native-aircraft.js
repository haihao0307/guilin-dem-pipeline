import * as T from 'three';
import {MotionSystem} from './motion-system.js';
import {createAssetLoader} from './asset-loader.js?boot=20260905-native-r1';
import {LAYOUT} from './asset-layout.js?boot=20260905-native-r1';
export const SOURCE = Object.freeze({reviewFile:'B24_V012_PROPELLER_INTERFACE_REVIEW.html',reviewSha256:'7cf4c78cea99f9bf3aed5507cbcb2bdb49a71465b3c4aabc29563214f3da2fde',payloadBytes:8131628,payloadSha256:'f5ff859a7ff0e38112fa099d8c7d3a4cd8e859434701fb4dd9d81629374c5e3e',exactV016Recovered:false});
const tireIds=new Set([598,613,1189,1200,681,689,698]);
const spindleIds=[1454,1385,1431,1408];
const clamp=T.MathUtils.clamp;
export class NativeAircraft {
  static async load(progress){
    progress(.05,'连接整机数据分段');
    const loader=createAssetLoader(LAYOUT,{baseURL:import.meta.url,signal:window.__B24_STARTUP__?.signal,
      onProgress:s=>{window.__B24_STARTUP__?.report(s);
        const label={download:'下载整机数据',retry:'连接中断，正在重试当前分段','verify-compressed':'校验已下载的完整数据',decompress:'解压原始几何与机械动画','verify-decoded':'核对原始载荷身份',complete:'整机数据校验完成'}[s.stage];
        if(label)progress(s.stage==='download'||s.stage==='retry'?.05+.45*s.receivedBytes/s.totalBytes:s.stage==='complete'?.67:.57,label);
      }});
    const {json:manifestBytes,bin:payload}=await loader.load();
    const m=JSON.parse(new TextDecoder().decode(manifestBytes));
    if(!globalThis.crypto?.subtle)throw new Error('请通过 HTTPS 在线地址打开工作台。');
    const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',payload))].map(v=>v.toString(16).padStart(2,'0')).join('');
    if(payload.byteLength!==SOURCE.payloadBytes||digest!==SOURCE.payloadSha256)throw new Error('整机数字载荷校验失败，已停止载入。');
    if(m.components.length!==1784||m.meshes.length!==348)throw new Error('当前审查资产结构与已锁定版本不符。');
    progress(.70,'恢复已核验部件姿态与独立机械控制器');
    await new Promise(resolve=>requestAnimationFrame(resolve));
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
    this.motion=new MotionSystem(this.nodes,m.motion,i=>this.block(i));
    this.spindles=this.motion.spindles;this.angles=this.motion.angles;this.speeds=this.motion.speeds;
    this.gearTracks=m.motion.actuators.gear.bindings;this.bayTracks=m.motion.actuators.bay.bindings;
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
  setMechanics(gear,bay){this.motion.set('gear',gear);this.motion.set('bay',bay);}
  spin(dt,rpm){this.motion.spin(dt,rpm);}
  minY(ids){let min=Infinity;const p=new T.Vector3();for(const id of ids){const mesh=this.meshes.find(m=>m.userData.sourceNode===id);if(!mesh)continue;const attr=mesh.geometry.attributes.position;for(let i=0;i<attr.count;i++){p.fromBufferAttribute(attr,i).applyMatrix4(mesh.matrixWorld);min=Math.min(min,p.y);}}return min;}
  reset(){this.motion.reset();}
}
