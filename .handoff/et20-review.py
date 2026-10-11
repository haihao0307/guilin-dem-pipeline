from pathlib import Path
import hashlib
root=Path('kaopu-unified-human-workbench/cinematic-r01')
expected={'CineSkin.mjs':'8d33c6b53dc263888d242e8f1638c613a758880a11261ce89e294cdb6c371da4','verify.cjs':'6c6abbfb87aeb34574d98d97b14b1eb5ea72bcfea90809e52207b9e78821913b'}
for name,h in expected.items():assert hashlib.sha256((root/name).read_bytes()).hexdigest()==h,name+' changed; stop rather than overwrite'
p=root/'CineSkin.mjs';s=p.read_text();a=s.index('float cShadow(){');b=s.index('// Jittered, elliptical pores',a)
s=s[:a]+'''float cShadow(){
 // Compare each PCF tap with receiver depth at that actual texel center.
 vec4 q=uCShadowMatrix*vec4(vCWorld,1.);vec3 p=q.xyz/q.w;
 vec3 dx=dFdx(p),dy=dFdy(p);float det=dx.x*dy.y-dx.y*dy.x;
 vec2 slope=abs(det)>1e-12?vec2(dy.y*dx.z-dx.y*dy.z,dx.x*dy.z-dy.x*dx.z)/det:vec2(0.);
 slope=clamp(slope,vec2(-8.),vec2(8.));
 if(uCShadowEnable<.5||q.w<=0.)return 1.;
 if(p.x<=0.||p.x>=1.||p.y<=0.||p.y>=1.||p.z<=0.||p.z>=1.)return 1.;
 float bias=.00012+min(.0015,(abs(slope.x)+abs(slope.y))*.00012);float total=0.;
 for(int j=0;j<4;j++)for(int i=0;i<4;i++){
  vec2 offset=(vec2(float(i),float(j))-1.5)*uCShadowSoftness/1024.;
  vec2 uv=(floor((p.xy+offset)*1024.)+.5)/1024.;
  float receiver=p.z+dot(slope,uv-p.xy);
  float z=texture2D(uCShadowMap,uv).r;total+=step(receiver-bias,z);
 }return total/16.;
}
'''+s[b:];s=s.replace('/ET20-dualGGX-shadow-v1','/ET20-dualGGX-shadow-receiver-plane-v2');p.write_text(s)
p=root/'verify.cjs';s=p.read_text();lines=s.splitlines();ids=[i for i,l in enumerate(lines) if "test('inherited-idle-still-plays-and-pauses')" in l];assert len(ids)==1
lines[ids[0]]='''await p.bringToFront();await p.evaluate(()=>{cinematicLook.preset('window');lifelikeIdle.pause(true);lifelikeIdle.seek(0);});
const beforePlayback=await p.evaluate(()=>({time:lifelikeIdle.report().time,frames:lifelikeIdle.report().frames,hidden:document.hidden,disposed:lifelikeIdle.runtime().disposed,mode:fullCommonWorkbench.motion().mode}));await p.waitForTimeout(150);assert.equal(await p.evaluate(()=>lifelikeIdle.report().time),beforePlayback.time);assert.equal(beforePlayback.hidden,false);assert.equal(beforePlayback.disposed,false);const playbackStarted=Date.now();
await p.evaluate(()=>lifelikeIdle.pause(false));
await p.waitForFunction(b=>lifelikeIdle.report().time>b.time&&lifelikeIdle.report().frames>=b.frames+3,beforePlayback,{timeout:60000,polling:100});
await p.evaluate(()=>lifelikeIdle.pause(true));const afterPlayback=await p.evaluate(()=>({time:lifelikeIdle.report().time,frames:lifelikeIdle.report().frames,hidden:document.hidden}));await p.waitForTimeout(250);assert.equal(await p.evaluate(()=>lifelikeIdle.report().time),afterPlayback.time);test('inherited-idle-still-plays-and-pauses',{beforePlayback,afterPlayback,waitWallMS:Date.now()-playbackStarted,notFPSBenchmark:true});'''
s='\n'.join(lines)+'\n';s=s.replace('/载入失败/','/(?:载入|加载)失败/')
anchor="test('actual-key-depth-occlusion',{shadow,unshadowed});";assert s.count(anchor)==1
s=s.replace(anchor,anchor+'''
await p.evaluate(()=>cinematicLook.set({shadow:true}));
const shadowPatch=await p.evaluate(()=>{const v=__IDENTITY_QA__.viewer();v.render();const gl=v.renderer.getContext(),w=gl.drawingBufferWidth,h=gl.drawingBufferHeight,pixels=new Uint8Array(w*h*4);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,pixels);const values=[];for(let y=Math.floor(h*.63);y<Math.floor(h*.70);y++)for(let x=Math.floor(w*.45);x<Math.floor(w*.50);x++){values.push(pixels[(y*w+x)*4]);}const lo=Math.min(...values),hi=Math.max(...values),mean=values.reduce((a,b)=>a+b,0)/values.length;return{pixelRegionNormalized:[.45,.63,.50,.70],samples:values.length,min:lo,max:hi,mean,range:hi-lo};});report.shadowForehead=shadowPatch;write();assert(shadowPatch.range<20,'Visible PCF bands in smooth lit forehead');test('smooth-lit-forehead-shadow-is-not-pore-noise',shadowPatch);
''');p.write_text(s)
p=root/'RESEARCH.md';s=p.read_text();assert s.count('23个连续')==1;p.write_text(s.replace('23个连续','21个连续'))
(root/'REVIEW_FIX.md').write_text('''# ET20 首次浏览器审片与修正

首轮 source run 38133116272 未发布：布光、分量、7项肤质参数、几何不变量与档案恢复通过；固定等待800ms的待机播放断言失败。记录中无JS/GLSL错误，待机ready/enabled均为true。下一轮改为等待真实时钟推进并完成至少3帧，保留60秒超时；不是删除待机验证，也不将等待时间称为性能认证。

人工查看光照/肤质四组合和独立阴影画面后，额颊的规则波纹可在shadow-only中复现，确认不是皮肤毛孔。PCF原实现用中心深度比较全部偏移采样，现为每个实际texel中心计算receiver-plane深度，保留投影阴影并限制极端坡度；新增光照额部的GPU阴影局部变化检查。方法参考Microsoft官方深度偏移与PCF说明：https://learn.microsoft.com/en-us/windows/win32/dxtecharts/cascaded-shadow-maps 。不以压黑背景、关闭阴影或磨平原皮肤掩盖伪影。

这份修正说明不等于测试通过；下一次完整source/public浏览器报告与人工审片决定交付状态。
''')
print('Updated only cinematic sources and regression; inherited files untouched')
