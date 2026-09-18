"""Corrections to the game adapter and newly authored chapter only."""
def apply(s):
 def rep(a,b):
  nonlocal s
  assert s.count(a)==1,(a[:100],s.count(a))
  s=s.replace(a,b)
 # QA exposes controls, but does not substitute a cheaper terrain/rock representation.
 rep("QA_MODE=query.has('qa');","QA_MODE=false;")
 # Original Ocean V001 projects with near=.15. All interacting geometry must agree.
 rep('host.perspective(camera.proj,camera.fov,aspect,.08,60000)','host.perspective(camera.proj,camera.fov,aspect,.15,60000)')
 rep('player:{x:24,z:22.8,yaw:-.22,pitch:-.16','player:{x:24,z:22.8,yaw:2.65,pitch:-.10')
 rep("name:'落下的宽叶',x:24,z:18.5","name:'落下的宽叶',x:24.8,z:19.1")
 rep("name:'石钱',x:23,z:16.5","name:'石钱',x:21,z:18")
 # Rock-looking shelter envelope; its bounding contact remains conservative and explicitly provisional.
 rock='''function rock(c,r,col){const signed=(v,e)=>Math.sign(v)*Math.pow(Math.abs(v),e),pt=(v,u)=>{const a=[signed(Math.sin(v),.23)*signed(Math.cos(u),.24),signed(Math.cos(v),.25),signed(Math.sin(v),.23)*signed(Math.sin(u),.24)],w=.973+.012*Math.sin(u*5.1+v*3.3+c[0])+.013*Math.sin(u*9.3-v*7.2+c[2]);return a.map((x,k)=>c[k]+x*r[k]*w);};for(let i=0;i<16;i++)for(let j=0;j<28;j++)quad(pt(i/16*Math.PI,j/28*TAU),pt((i+1)/16*Math.PI,j/28*TAU),pt((i+1)/16*Math.PI,(j+1)/28*TAU),pt(i/16*Math.PI,(j+1)/28*TAU),col);}
'''
 rep('return{tri,quad,box,ell,rod,ring,upload};}',rock+'return{tri,quad,box,ell,rod,ring,rock,upload};}')
 rep("for(const v of slabs)b.box(v.c,v.r,v.id==='floor'?palette.sand:[.34,.35,.31]);","for(const v of slabs){if(v.id==='floor')b.box(v.c,v.r,palette.sand);else b.rock(v.c,v.r,[.34,.35,.31]);}")
 a='''float gh(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
float gn(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(gh(i),gh(i+vec3(1,0,0)),f.x),mix(gh(i+vec3(0,1,0)),gh(i+vec3(1,1,0)),f.x),f.y),mix(mix(gh(i+vec3(0,0,1)),gh(i+vec3(1,0,1)),f.x),mix(gh(i+vec3(0,1,1)),gh(i+vec3(1,1,1)),f.x),f.y),f.z);}
'''
 rep('uniform float shade;out vec4 O;void main(){float l=', 'uniform float shade;out vec4 O;'+a+'void main(){float l=')
 rep('float grain=.96+.04*sin(W.x*39.+sin(W.z*37.)+W.y*27.);','float grain=.84+.11*gn(W*2.3)+.05*gn(W*17.);')
 return s
