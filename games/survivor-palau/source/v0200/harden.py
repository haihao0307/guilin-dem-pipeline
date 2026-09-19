"""Corrections to the game adapter and newly authored chapter only.

This revision keeps the frozen Ocean Mother V001 shader/worker strings intact.  It
changes the authored island/beach defaults, the shared CPU+GLSL bed profile and
adds one shoreline query consumed by the game contact path.
"""
def apply(s):
 def rep(a,b):
  nonlocal s
  assert s.count(a)==1,(a[:120],s.count(a))
  s=s.replace(a,b)

 # QA exposes controls, but does not substitute a cheaper terrain/rock representation.
 rep("QA_MODE=query.has('qa');","QA_MODE=false;")
 # Original Ocean V001 projects with near=.15. All interacting geometry must agree.
 rep('host.perspective(camera.proj,camera.fov,aspect,.08,60000)','host.perspective(camera.proj,camera.fov,aspect,.15,60000)')

 # Reef-protected wake-up bay: larger island, broad low-gradient white beach and
 # wider shallow shelf.  These are authored candidate dimensions, not survey data.
 for a,b in [
  ('"key":"radius","label":"海岛半径","min":18,"max":38,"step":0.5,"value":27',
   '"key":"radius","label":"海岛半径","min":18,"max":42,"step":0.5,"value":36'),
  ('"key":"roundness","label":"岸线轻微起伏","min":0,"max":0.6,"step":0.005,"value":0.43',
   '"key":"roundness","label":"岸线轻微起伏","min":0,"max":0.6,"step":0.005,"value":0.24'),
  ('"key":"islandHeight","label":"岛心高度","min":1.5,"max":7.5,"step":0.1,"value":6.4',
   '"key":"islandHeight","label":"岛心高度","min":1.5,"max":8.5,"step":0.1,"value":5.8'),
  ('"key":"beachWidth","label":"沙滩宽度","min":5,"max":17,"step":0.5,"value":11',
   '"key":"beachWidth","label":"沙滩宽度","min":5,"max":22,"step":0.5,"value":16.5'),
  ('"key":"beachSlope","label":"滩面坡形","min":0.8,"max":2.4,"step":0.05,"value":1.3',
   '"key":"beachSlope","label":"滩面坡形","min":0.6,"max":2.4,"step":0.05,"value":1.05'),
  ('"key":"shelfWidth","label":"浅海平台宽度","min":12,"max":40,"step":1,"value":22',
   '"key":"shelfWidth","label":"浅海平台宽度","min":12,"max":52,"step":1,"value":34'),
  ('"key":"seaDepth","label":"外海深度","min":5,"max":18,"step":0.5,"value":10',
   '"key":"seaDepth","label":"外海深度","min":5,"max":18,"step":0.5,"value":11.5'),
  ('"key":"bedRelief","label":"海床起伏","min":0,"max":0.75,"step":0.01,"value":0.34',
   '"key":"bedRelief","label":"海床起伏","min":0,"max":0.75,"step":0.01,"value":0.22'),
  ('"key":"swell","label":"主涌浪高度","min":0.15,"max":2.4,"step":0.05,"value":1.1',
   '"key":"swell","label":"主涌浪高度","min":0.15,"max":2.4,"step":0.05,"value":0.62'),
  ('"key":"period","label":"主涌浪周期","min":4,"max":13,"step":0.1,"value":8.5',
   '"key":"period","label":"主涌浪周期","min":4,"max":13,"step":0.1,"value":6.6'),
  ('"key":"secondary","label":"次涌浪高度","min":0,"max":1,"step":0.02,"value":0.26',
   '"key":"secondary","label":"次涌浪高度","min":0,"max":1,"step":0.02,"value":0.14'),
  ('"key":"crest","label":"浪峰尖锐度","min":0,"max":0.55,"step":0.01,"value":0.18',
   '"key":"crest","label":"浪峰尖锐度","min":0,"max":0.55,"step":0.01,"value":0.10'),
  ('"key":"breakWidth","label":"破浪带宽度","min":1.5,"max":7,"step":0.1,"value":3.35',
   '"key":"breakWidth","label":"破浪带宽度","min":1.5,"max":7,"step":0.1,"value":2.5'),
  ('"key":"breakThreshold","label":"破碎触发阈值","min":0.2,"max":0.85,"step":0.01,"value":0.4',
   '"key":"breakThreshold","label":"破碎触发阈值","min":0.2,"max":0.85,"step":0.01,"value":0.49'),
  ('"key":"runup","label":"贴岸上冲","min":0,"max":1.5,"step":0.05,"value":0.7',
   '"key":"runup","label":"贴岸上冲","min":0,"max":1.5,"step":0.05,"value":0.38'),
  ('"key":"backwash","label":"回洗速度","min":0,"max":1.8,"step":0.05,"value":0.8',
   '"key":"backwash","label":"回洗速度","min":0,"max":1.8,"step":0.05,"value":0.48'),
  ('"key":"foam","label":"泡沫生成强度","min":0,"max":2,"step":0.05,"value":1.18',
   '"key":"foam","label":"泡沫生成强度","min":0,"max":2,"step":0.05,"value":0.84'),
  ('"key":"shoreFoam","label":"贴岸白沫增强","min":0,"max":2,"step":0.05,"value":0.58',
   '"key":"shoreFoam","label":"贴岸白沫增强","min":0,"max":2,"step":0.05,"value":0.42'),
  ('"key":"rockFoam","label":"撞岩泡沫增强","min":0,"max":3,"step":0.05,"value":1.2',
   '"key":"rockFoam","label":"撞岩泡沫增强","min":0,"max":3,"step":0.05,"value":0.88'),
  ('"key":"cloudiness","label":"云量","min":0,"max":1,"step":0.02,"value":0.46',
   '"key":"cloudiness","label":"云量","min":0,"max":1,"step":0.02,"value":0.62'),
  ('"key":"waterRough","label":"海面粗糙度","min":0.08,"max":0.5,"step":0.01,"value":0.21',
   '"key":"waterRough","label":"海面粗糙度","min":0.08,"max":0.5,"step":0.01,"value":0.16')
 ]:
  rep(a,b)

 # One continuous cross-shore profile.  The old shelf fell about three metres in
 # 22 m and the old exponent produced a visibly abrupt water/sand boundary.
 rep("""  const shelf=-.13*Math.min(s,c.shelfWidth)-.38*Math.pow(clamp(s/c.shelfWidth,0,1),2);
  const deep=-c.seaDepth*(1-Math.exp(-Math.max(0,s-c.shelfWidth)/42));""",
 """  const shelfU=clamp(s/c.shelfWidth,0,1),shelf=-.035*Math.min(s,c.shelfWidth)-.85*Math.pow(shelfU,2.2);
  const deep=-c.seaDepth*(1-Math.exp(-Math.max(0,s-c.shelfWidth)/48));""")
 rep(""" const inland=-s,beach=1.02*Math.pow(clamp(inland/B,0,1),c.beachSlope),interior=smooth(B*.66,B+3.2,inland),core=Math.pow(clamp(inland/Math.max(1,R),0,1),.68);""",
 """ const inland=-s,q=clamp(inland/B,0,1),beach=.18*q+.78*q*q*(3-2*q),interior=smooth(B*.82,B+4.5,inland),core=Math.pow(clamp(inland/Math.max(1,R),0,1),.68);""")
 rep("""  float shelf=-.13*min(s,p_shelfWidth)-.38*pow(clamp(s/p_shelfWidth,0.0,1.0),2.0);
  float deep=-p_seaDepth*(1.0-exp(-max(0.0,s-p_shelfWidth)/42.0));""",
 """  float shelfU=clamp(s/p_shelfWidth,0.0,1.0),shelf=-.035*min(s,p_shelfWidth)-.85*pow(shelfU,2.2);
  float deep=-p_seaDepth*(1.0-exp(-max(0.0,s-p_shelfWidth)/48.0));""")
 rep(""" float inland=-s,beach=1.02*pow(clamp(inland/B,0.0,1.0),p_beachSlope),interior=smoothstep(B*.66,B+3.2,inland),core=pow(clamp(inland/max(1.0,R),0.0,1.0),.68);""",
 """ float inland=-s,q=clamp(inland/B,0.0,1.0),beach=.18*q+.78*q*q*(3.0-2.0*q),interior=smoothstep(B*.82,B+4.5,inland),core=pow(clamp(inland/max(1.0,R),0.0,1.0),.68);""")

 # Derive the visible wet/dry boundary from the same bed and water, rather than
 # the old geometric radius.  CPU and GLSL use the same finite-difference rule.
 rep('function waveAt(x,z,time,c=SURFACE){',"""function shorelineAt(x,z,time,c=SURFACE){
 const surface=waterLevel(time,c),bed=bedHeight(x,z),e=.25;
 const gx=(bedHeight(x+e,z)-bedHeight(x-e,z))/(2*e),gz=(bedHeight(x,z+e)-bedHeight(x,z-e))/(2*e),slope=Math.max(.025,Math.hypot(gx,gz));
 return{surface,bed,depth:surface-bed,signedDistance:clamp((surface-bed)/slope,-40,40),slope};
}
function waveAt(x,z,time,c=SURFACE){""")
 rep("float smiShoreDistance(vec2 p){float s=length(p)-islandR(p);for(int i=0;i<3;i++)s=min(s,smiLocalShoreG(p,i));return s;}\nfloat bedH(vec2 p){",
 "float bedH(vec2 p);\nfloat smiShoreDistance(vec2 p){float e=.25,h=bedH(p);vec2 g=vec2(bedH(p+vec2(e,0))-bedH(p-vec2(e,0)),bedH(p+vec2(0,e))-bedH(p-vec2(0,e)))/(2.*e);return clamp((uSeaLevel-h)/max(.025,length(g)),-40.,40.);}\nfloat bedH(vec2 p){")

 # The game now consumes the shared shoreline query for contact/depth decisions.
 rep('ready:()=>qa.ready,bed:renderedBed,rock:', 'ready:()=>qa.ready,bed:renderedBed,shore:(x,z)=>shorelineAt(x,z,physicalTime,config),rock:')
 rep("function canStand(x,z){const y=ground(x,z),sea=host.water(x,z).eta;if(sea-y>1.05)return '水已经太深了，先留在浅水里';",
 "function canStand(x,z){const y=ground(x,z),shore=host.shore?host.shore(x,z):null,sea=shore?shore.surface:host.water(x,z).eta,depth=shore?shore.depth:sea-y;if(depth>1.05)return '水已经太深了，先留在浅水里';")
 rep("document.body.classList.add('smiGame');qa.chapter='shore-survival';qa.visualAcceptance=false;",
 "window.StoneMoneyShoreline={shoreAt:(x,z,t=physicalTime)=>shorelineAt(x,z,t,config)};document.body.classList.add('smiGame');qa.chapter='shore-survival';qa.shoreline='bed-and-water-shared';qa.visualAcceptance=false;")

 # Spawn and stone money are moved onto the enlarged upper beach.
 rep('player:{x:24,z:22.8,yaw:-.22,pitch:-.16','player:{x:21,z:26.5,yaw:2.58,pitch:-.10')
 rep("name:'落下的宽叶',x:24,z:18.5","name:'落下的宽叶',x:24.8,z:19.1")
 rep("name:'石钱',x:23,z:16.5","name:'石钱',x:18.2,z:13.6")
 rep("if(Math.hypot(x,z)>85)return '先认识这片海岸，不要冒险远行';","if(Math.hypot(x,z)>118)return '先认识这片海岸，不要冒险远行';")

 # Rock-looking shelter envelope; its bounding contact remains conservative and explicitly provisional.
 rock='''function rock(c,r,col){const signed=(v,e)=>Math.sign(v)*Math.pow(Math.abs(v),e),pt=(v,u)=>{const a=[signed(Math.sin(v),.23)*signed(Math.cos(u),.24),signed(Math.cos(v),.25),signed(Math.sin(v),.23)*signed(Math.sin(u),.24)],w=.973+.012*Math.sin(u*5.1+v*3.3+c[0])+.013*Math.sin(u*9.3-v*7.2+c[2]);return a.map((x,k)=>c[k]+x*r[k]*w);};for(let i=0;i<16;i++)for(let j=0;j<28;j++)quad(pt(i/16*Math.PI,j/28*TAU),pt((i+1)/16*Math.PI,j/28*TAU),pt((i+1)/16*Math.PI,(j+1)/28*TAU),pt(i/16*Math.PI,(j+1)/28*TAU),col);}\n'''
 rep('return{tri,quad,box,ell,rod,ring,upload};}',rock+'return{tri,quad,box,ell,rod,ring,rock,upload};}')
 rep("for(const v of slabs)b.box(v.c,v.r,v.id==='floor'?palette.sand:[.34,.35,.31]);","for(const v of slabs){if(v.id==='floor')b.box(v.c,v.r,palette.sand);else b.rock(v.c,v.r,[.34,.35,.31]);}")
 a='''float gh(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}\nfloat gn(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(gh(i),gh(i+vec3(1,0,0)),f.x),mix(gh(i+vec3(0,1,0)),gh(i+vec3(1,1,0)),f.x),f.y),mix(mix(gh(i+vec3(0,0,1)),gh(i+vec3(1,0,1)),f.x),mix(gh(i+vec3(0,1,1)),gh(i+vec3(1,1,1)),f.x),f.y),f.z);}\n'''
 rep('uniform float shade;out vec4 O;void main(){float l=', 'uniform float shade;out vec4 O;'+a+'void main(){float l=')
 rep('float grain=.96+.04*sin(W.x*39.+sin(W.z*37.)+W.y*27.);','float grain=.84+.11*gn(W*2.3)+.05*gn(W*17.);')
 return s
