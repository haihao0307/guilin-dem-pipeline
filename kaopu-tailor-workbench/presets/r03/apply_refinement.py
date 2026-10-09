"""One-time, idempotent migration of the R03 candidate to connected fitted shells."""
from pathlib import Path
p=Path(__file__).resolve().parent
f=p/'garment-surfaces.mjs';g=f.read_text()
if "from './anatomical-cloth.mjs'" not in g:
 a=g.index('function top(');z=g.index('function skirt(',a);g=g[:a]+g[z:]
 a=g.index('function pants(');z=g.index('export function garment(',a);g=g[:a]+g[z:]
 g="import {anatomicalTop as top,anatomicalPants as pants} from './anatomical-cloth.mjs';\nimport {fitProfile} from './surface-kernel.mjs';\n"+g
 old='return[rx*Math.sin(a),y,rz*Math.cos(a)];}'
 new="const p=[rx*Math.sin(a),y,rz*Math.cos(a)],f=fitProfile(y,Math.atan2(p[0],p[2]-.02)),r=Math.hypot(p[0],p[2]-f.cz),target=f.r+.026,rr=(r+target+Math.sqrt((r-target)**2+.000016))/2;if(r>1e-8){p[0]*=rr/r;p[2]=f.cz+(p[2]-f.cz)*rr/r}return p;}"
 assert old in g;g=g.replace(old,new);f.write_text(g)
f=p/'surface-kernel.mjs';k=f.read_text()
if 'export function fitProfile' not in k:
 k+='''\n// Garment fitting changes clothing only, never mannequin vertices.
export function fitProfile(y,a,region='torso'){
 const p=BODY.fitProfiles[region],t=clamp((y-p.minY)/p.stepY,0,p.countY-1),i=Math.min(p.countY-2,Math.floor(t)),f=t-i;
 const k=((a/TAU)%1+1)%1*p.countA,j=Math.floor(k),g=k-j,j1=(j+1)%p.countA;
 const r=mix(mix(p.radii[i*p.countA+j],p.radii[i*p.countA+j1],g),mix(p.radii[(i+1)*p.countA+j],p.radii[(i+1)*p.countA+j1],g),f);
 return {r,cx:mix(p.centres[i][0],p.centres[i+1][0],f),cz:mix(p.centres[i][1],p.centres[i+1][1],f)};
}
export function bodyRing(y,a,ease=.025){const f=fitProfile(y,a);return[(f.r+ease)*Math.sin(a),y,f.cz+(f.r+ease)*Math.cos(a)];}
'''
if 'anatomically-fitted-waistband' not in k:
 a=k.index('function band(');z=k.index('\nexport {T',a)
 k=k[:a]+'''function band(group,row,color,y,width=null){
 const curved=get(row,'meta.wb',null)==='FittedWB'||row.style==='FittedWB';
 const h=width??(.018+num(row,'waistband.width',.25)*.08),mat=cloth(color),edge=plain(new T.Color(color).multiplyScalar(.84));
 const ring=(u,v)=>{const yy=y+(v-.5)*h,p=bodyRing(curved?yy:y,u*TAU,.028);p[1]=yy;return p;};
 patch(group,'anatomically-fitted-waistband',ring,96,8,mat);hem(group,u=>ring(u,1),mat,.0015,'open-waistband-facing');line(group,trace(u=>ring(u,.12),90),edge,.00065,'waistband-stitch');
}'''+k[z:]
 k=k.replace('grad*.035*aa','grad*.008*aa')
f.write_text(k)
f=p/'surfaces.mjs';s=f.read_text()
if 'this.scratchContext.drawImage' not in s:
 s=s.replace('this.renderer.toneMappingExposure=1.04','this.renderer.toneMappingExposure=.99')
 s=s.replace("'#a9a196',1.45","'#a9a196',1.0").replace("'#fff5e5',3.8","'#fff5e5',3.0").replace("'#e4edff',1.25","'#e4edff',.9").replace("'#ffffff',2.2","'#ffffff',1.5")
 s=s.replace("new T.PlaneGeometry(200,200),plain('#e7e4de',.85)","new T.PlaneGeometry(200,200),new T.ShadowMaterial({color:'#57504a',opacity:.14})")
 a=s.index(' capture(row){');z=s.index('\n autoRotate(',a)
 s=s[:a]+''' capture(row){
  if(this.contextLost)throw Error('WebGL context lost');
  const temp=garment(row,this.library),prior=this.current?.visible,bodyVisible=this.body.visible,size=this.renderer.getSize(new T.Vector2()),ratio=this.renderer.getPixelRatio();
  if(this.current)this.current.visible=false;this.body.visible=true;this.scene.add(temp);
  try{
   this.renderer.setPixelRatio(1);this.renderer.setSize(270,360,false);this.renderer.setRenderTarget(null);this.renderer.render(this.scene,this.thumbCamera);
   this.scratchContext.drawImage(this.canvas,0,0,270,360);
   return{src:this.scratch.toDataURL('image/webp',.91),metrics:temp.userData.metrics};
  }finally{
   this.scene.remove(temp);dispose(temp);if(this.current)this.current.visible=prior;this.body.visible=bodyVisible;
   this.renderer.setPixelRatio(ratio);this.renderer.setSize(size.x,size.y,false);this.render();
  }
 }'''+s[z:]
 f.write_text(s)
r=p/'README.md';text=r.read_text()
if 'R03.2 连续衣壳' not in text:r.write_text(text+'\n## R03.2 连续衣壳\n\n首轮浏览器功能测试虽通过，但视觉检查发现躯干、腿部穿模和肩袖断开，未发布该候选。R03.2 从原人体三角面的实际截面提取躯干与腿部拟合包络；上衣和裤装使用连续拓扑衣壳、实际开口裁切与厚度回边，代替断开的衣身和袖筒。服装拟合变形不缩小、不遮除展示人体。缩略图改为同一默认帧缓冲的真实渲染，避免离屏色彩处理偏差。仍为静态设计展示，不冒充真实纸样缝合或动态碰撞认证。\n')
print('R03_CONNECTED_SHELL_MIGRATION_COMPLETE')
