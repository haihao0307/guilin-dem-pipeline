from pathlib import Path
import hashlib
root=Path('kaopu-unified-human-workbench/cinematic-r01')
expected={'CineSkin.mjs':'ff1f91f6ab78e7d92961b110ea92c3c7e59c72fafb4ece1c56e99ad92ab9f5f1','CineRig.mjs':'ae7c9fdab8e88e8f3bb3e5cba5ca2d697dd7ffdddc6b95231c73dcc51b93e4b6'}
for name,h in expected.items():assert hashlib.sha256((root/name).read_bytes()).hexdigest()==h,name+' changed; stop'
p=root/'CineSkin.mjs';s=p.read_text();a=s.index('float cShadow(){');b=s.index('// Jittered, elliptical pores',a)
s=s[:a]+'''float cCompareShadow(vec2 uv,vec3 receiver,vec2 slope,float bias){
 float depth=receiver.z+dot(slope,uv-receiver.xy)-bias;
 return step(depth,texture2D(uCShadowMap,uv).r);
}
float cBilinearShadow(vec2 uv,vec3 receiver,vec2 slope,float bias){
 vec2 texel=uv*1024.-.5,base=floor(texel),f=fract(texel);
 vec2 q=(base+.5)/1024.;
 float a=cCompareShadow(q,receiver,slope,bias);
 float b=cCompareShadow(q+vec2(1./1024.,0.),receiver,slope,bias);
 float c=cCompareShadow(q+vec2(0.,1./1024.),receiver,slope,bias);
 float d=cCompareShadow(q+vec2(1./1024.),receiver,slope,bias);
 return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);
}
float cShadow(){
 vec4 q=uCShadowMatrix*vec4(vCWorld,1.);vec3 p=q.xyz/q.w;
 // Derivatives are taken before any divergent bounds branch.
 vec3 dx=dFdx(p),dy=dFdy(p);float det=dx.x*dy.y-dx.y*dy.x;
 vec2 slope=abs(det)>1e-12?vec2(dy.y*dx.z-dx.y*dy.z,dx.x*dy.z-dy.x*dx.z)/det:vec2(0.);
 slope=clamp(slope,vec2(-8.),vec2(8.));
 if(uCShadowEnable<.5||q.w<=0.)return 1.;
 if(p.x<=0.||p.x>=1.||p.y<=0.||p.y>=1.||p.z<=0.||p.z>=1.)return 1.;
 // Bounded 0.6 mm receiver bias; avoids interpreting raster mismatch as pores.
 // This is shadow comparison tolerance, not a displacement of the skin mesh.
 vec3 towardLight=normalize(uCKeyPosition-vCWorld);
 vec4 biased=uCShadowMatrix*vec4(vCWorld+towardLight*.0006,1.);
 float bias=max(.000015,p.z-biased.z/biased.w);
 // Filter comparison coverage, not raw depth or the skin image.
 // 3x3 tent with four bilinear texel comparisons per tap: 36 reads total.
 float total=0.;
 for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
  float weight=(x==0?2.:1.)*(y==0?2.:1.);
  vec2 offset=vec2(float(x),float(y))*uCShadowSoftness/1024.;
  total+=weight*cBilinearShadow(p.xy+offset,p,slope,bias);
 }return total/16.;
}
'''+s[b:]
s=s.replace('/ET20-dualGGX-shadow-receiver-plane-v2','/ET20-dualGGX-shadow-bilinear-tent-v3');p.write_text(s)
p=root/'CineRig.mjs';s=p.read_text().replace('single center depth projection + 16-tap PCF; not area-light ray tracing','single center depth projection + receiver-plane bilinear tent PCF (36 reads); 0.6mm comparison tolerance; not area-light ray tracing');p.write_text(s)
p=root/'build.cjs';s=p.read_text().replace('one key-center depth projection with 16-tap PCF','one key-center depth projection with receiver-plane bilinear tent PCF (36 reads, 0.6mm comparison tolerance)');p.write_text(s)
p=root/'RESEARCH.md';s=p.read_text().replace('主光中心深度投影+16次PCF采样近似','主光中心深度投影+双线性比较/3x3帐篷核PCF近似（36次深度读取，0.6mm比较容差）');p.write_text(s)
p=root/'REVIEW_FIX.md';p.write_text(p.read_text()+'''\n## 第二轮人工复核：阴影覆盖量化与曲面自遮挡\n\nRun38133912491的17/16项功能回归均通过，但真实截图仍显示鼻翼/眼下阴影毛刺，不能因功能检查通过就交付为成品。额部单区域范围检查不足以覆盖此缺陷。\n\n本次保留receiver-plane校正，改为每个邻近texel单独进行深度比较后双线性混合，再使用3x3帐篷权重。它连续过滤可见比例，不模糊深度图/皮肤贴图，也不关闭投影阴影。比较容差改为朝光源0.6毫米的投影深度差，未移动任何网格；小于该量级的真实接触阴影可能弱化，不能声称微米级眼睑/皮肤接触精确。取样36次而非16次，增加纹理带宽；仍只一个1024平方深度目标，不是面积光线追踪。\n\n依据：Microsoft官方PCF文档明确指出，不进行texel内双线性覆盖插值会产生离散灰阶，扩大偏移会引入Peter Panning。https://learn.microsoft.com/en-us/windows/win32/dxtecharts/cascaded-shadow-maps\n\n修正后需要重新读取全部source/public报告并审查鼻颊、闭眼和不同灯光；不能仅凭这份说明判定通过。\n''')
print('Shadow comparison repaired without touching original human or skin controls')
