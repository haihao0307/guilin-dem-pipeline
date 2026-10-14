from pathlib import Path
import hashlib
P=Path(__file__).resolve().parent;B=P.parent/'fiber-r04'
def rep(s,a,b):
 if s.count(a)!=1:raise ValueError('Expected unique anchor: '+a[:110]+' count='+str(s.count(a)))
 return s.replace(a,b,1)
a=(B/'app.mjs').read_text();assert hashlib.sha256(a.encode()).hexdigest()=='26a18dca0d0d37dfedeb3b59c78f31cba6ad92771a34f1305be598e6d4a405cd'
a=a.replace('HAIR-FIBER-R04-FUR1','HAIR-FIBER-R05-M3').replace('kaopu.hair.fiber-r04','kaopu.hair.fiber-r05')
a=rep(a,"import {movingPositionFragment,fastNodeRadianceFragment,fastStableVertex} from './motion-shaders.mjs';","import {movingPositionFragment,fastNodeRadianceFragment,fastStableVertex,layer8Fragment,shadowPairFragment,packShadowFragment} from './shaders.mjs';")
a=rep(a,'const gl=r.getContext();','const gl=r.getContext();\nconst supports8=gl.getParameter(gl.MAX_DRAW_BUFFERS)>=8&&gl.getParameter(gl.MAX_COLOR_ATTACHMENTS)>=8;let optimized=true,packed=supports8;')
a=rep(a,'const resolveMat=mk(old.fullscreenVertex,resolveFragment);','const layer8Mat=supports8?mk(fastStableVertex,layer8Fragment,{glslVersion:THREE.GLSL3,side:THREE.DoubleSide,transparent:true,blending:THREE.CustomBlending,blendSrc:THREE.OneFactor,blendDst:THREE.OneFactor,blendEquation:THREE.AddEquation}):null;\nconst resolveMat=mk(old.fullscreenVertex,resolveFragment);')
a=rep(a,'const shadowRT=Array.from', '''const pairRT=new THREE.WebGLRenderTarget(384,512,{count:2,type:THREE.HalfFloatType,depthBuffer:false,minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter});
const pairMat=new THREE.ShaderMaterial({uniforms:du,vertexShader:old.vertex,fragmentShader:shadowPairFragment,glslVersion:THREE.GLSL3,side:THREE.DoubleSide,transparent:true,depthTest:false,depthWrite:false,blending:THREE.CustomBlending,blendSrc:THREE.OneFactor,blendDst:THREE.OneFactor,blendEquation:THREE.AddEquation});
const packMat=new THREE.ShaderMaterial({uniforms:{nearMap:{value:pairRT.textures[0]},farMap:{value:pairRT.textures[1]}},vertexShader:old.fullscreenVertex,fragmentShader:packShadowFragment,depthTest:false,depthWrite:false});
const shadowRT=Array.from''')
a=rep(a,'for(let s=0;s<2;s++){du.slab.value=s;r.setViewport(s*384,0,384,512);r.render(scene,c);}', '''if(optimized){mesh.material=pairMat;r.setRenderTarget(pairRT);r.setViewport(0,0,384,512);r.clear(true,false,false);r.render(scene,c);fullpass(packMat,shadowRT[i]);mesh.material=depthMat;}
  else for(let s=0;s<2;s++){du.slab.value=s;r.setViewport(s*384,0,384,512);r.render(scene,c);}''')
a=rep(a,'layers=Array.from({length:2},()=>new THREE.WebGLRenderTarget(width,height,{count:4,type:THREE.HalfFloatType,depthBuffer:false,...nearest}));','layers=Array.from({length:packed?1:2},()=>new THREE.WebGLRenderTarget(width,height,{count:packed?8:4,type:THREE.HalfFloatType,depthBuffer:false,...nearest}));')
a=rep(a,"layers[Math.floor(i/4)].textures[i%4]","layers[packed?0:Math.floor(i/4)].textures[packed?i:i%4]")
a=rep(a,'for(let b=0;b<2;b++){u.layerBase.value=b*4;geometry(layerMat,layers[b]);}','if(packed){geometry(layer8Mat,layers[0]);}else for(let b=0;b<2;b++){u.layerBase.value=b*4;geometry(layerMat,layers[b]);}')
a=rep(a,'dynamics.offsets,17,5','dynamics.offsets,17,15')
a=rep(a,'guideTexture.minFilter=guideTexture.magFilter=THREE.NearestFilter;','const guideLinear=!!gl.getExtension("OES_texture_float_linear");guideTexture.minFilter=guideTexture.magFilter=guideLinear?THREE.LinearFilter:THREE.NearestFilter;')
a=rep(a,'u.shadeCount={value:21};u.shadeStride={value:4};','u.shadeCount={value:81};u.shadeStride={value:1};\nconst basisTexture=new THREE.DataTexture(dynamics.basisData,81,1,THREE.RGBAFormat,THREE.FloatType);basisTexture.needsUpdate=true;u.modalBasis={value:basisTexture};u.guideLinear={value:guideLinear};')
a=rep(a,"function setOpticalSamples(n){if(![21,81].includes(n))throw Error('Invalid optical sampling');", "function setOpticalSamples(n){if(n!==81)throw Error('R05 retains all 81 optical nodes');")
a=a.replace('setOpticalSamples(21)','setOpticalSamples(81)')
a=rep(a,"function wakeDynamics(){dynamicsClock=performance.now();invalidate('geometry');}","function wakeDynamics(){if(!request&&!fence)dynamicsClock=performance.now();invalidate('geometry');}")
a=rep(a,'window.HAIR_LAB={version:VERSION,',(P/'bridge.js').read_text()+'\nwindow.HAIR_LAB={version:VERSION,')
a=rep(a,'physics:"bounded-guide-spring",','physics:"three-mode-bending",pipeline:optimized?"merged":"reference",packedLayers:packed,drawBufferLimit:gl.getParameter(gl.MAX_DRAW_BUFFERS),')
a=rep(a,'setWindEnabled:windEnabled,','setPipeline,profileFrame:async()=>{if(!manual)throw Error("Manual profiling required");posDirty=shadowDirty=shadeDirty=viewDirty=true;passTimings=[];profiling=true;try{await HAIR_LAB.renderFrame();return passTimings.slice();}finally{profiling=false;}},\n setWindEnabled:windEnabled,')
a=rep(a,'capture:()=>r.domElement.toDataURL','impulse:()=>{dynamics.impulse();dirtyDynamics();},testGrab:(t,delta)=>{const w=new Float32Array(85);for(let i=0;i<85;i++)w[i]=Math.exp(-(dynamics.positions[i*3]**2)/.0001);dynamics.setGrab(w,t,delta);dirtyDynamics();},releaseGrab:()=>{dynamics.release();dirtyDynamics();},\n capture:()=>r.domElement.toDataURL')
a=a.replace('R04 · 原光学 / 导向毛梢运动','R05 · 三模式弯曲 / 原精度光学')
a=a.replace('`导向 ${dynamics.snapshot().guides} · CPU', '`导向 ${dynamics.snapshot().guides} × 3 模式 · CPU')
# Context inspection is unchanged; no runtime history accumulation added.
(P/'app.mjs').write_text(a)
h=(B/'index.html').read_text().replace('R04','R05').replace('FUR1','M3')
h=h.replace('毛领运动逻辑 / 保留头发质感','连续弯曲 / 松手回弹')
h=h.replace('<option value="21">21 点光学插值 / 实验加速</option>','').replace('81 点原精度 / 静态对照','81 点原精度 / 始终保留')
h=h.replace('<label>光学计算对照', '<label style="display:none">光学计算对照')
h=h.replace('<h2>绘制对照</h2>','<label>渲染计算对照<select id="pipeline"><option value="merged">合并通道 / 同样 8 层</option><option value="reference">原分离通道 / 对照</option></select><h2>绘制对照</h2>')
h=h.replace('微风来自导向弹簧，不是整束旋转','微风与拨动驱动三种弯曲响应，不是整束旋转').replace('两种光学计算都保留','始终保留')
h=h.replace('已接入毛领导向毛梢弹簧；未实现完整弹性杆、碰撞、EB1 或整头人物。','已接入三模式弯曲和位置抓取；不是完整不可伸长杆，尚无人体/衣物碰撞。')
h=h.replace('KAOPU / 发丝动态稳定 R05','KAOPU / 发丝连续弯曲 R05')
h=h.replace('同一发样 · 同一光学 · 先检查运动画质','原精度质感 · 三模式弯曲 · 真实鼠标拨动')
h=h.replace('0.32','0.38')
(P/'index.html').write_text(h)
print('R05 source prepared',len(a),len(h))
