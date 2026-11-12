struct Params { eye:vec4<f32>, forward:vec4<f32>, right:vec4<f32>, up:vec4<f32>, view:vec4<f32>, material:vec4<f32>, colorA:vec4<f32>, colorB:vec4<f32>, extra:vec4<f32>, };
@group(0) @binding(0) var<uniform> u:Params;
const PI:f32=3.14159265359;
fn hash21(p:vec2<f32>)->f32{let q=vec3<f32>(p.x,p.y,p.x)*vec3<f32>(127.1,311.7,74.7);return fract(sin(dot(q,vec3<f32>(1.,57.,113.)))*43758.5453);}
fn noise2(p:vec2<f32>)->f32{let i=floor(p);let f=fract(p);let a=hash21(i);let b=hash21(i+vec2<f32>(1.,0.));let c=hash21(i+vec2<f32>(0.,1.));let d=hash21(i+vec2<f32>(1.,1.));let q=f*f*(3.-2.*f);return mix(mix(a,b,q.x),mix(c,d,q.x),q.y);}
fn ridge(x:f32)->f32{return 1.-abs(2.*fract(x)-1.);}
fn pattern(p:vec2<f32>,kind:f32)->vec4<f32>{let q=p*max(1.,u.material.x);let cell=floor(q);let f=fract(q);let warp=noise2(vec2<f32>(q.x*.21,q.y*.07));let weft=noise2(vec2<f32>(q.x*.08,q.y*.23));let n=noise2(q*4.);var h=0.;var fiber=0.;var ink=0.;
if(kind<.5){let a=ridge(q.x);let b=ridge(q.y);h=mix(a,b,select(0.,1.,fract(cell.x+cell.y)>.5))*.52;fiber=abs(warp-.5)*.10+abs(weft-.5)*.08;}
else if(kind<1.5){let d=q.x+q.y*.42;h=ridge(d)*.62+ridge(q.y)*.08;fiber=abs(noise2(q*2.7)-.5)*.16;}
else if(kind<2.5){let d=q.x+q.y*.35;h=ridge(d)*.42+ridge(q.y)*.12;fiber=abs(noise2(q*8.)-.5)*.22;ink=select(0.,1.,noise2(q*.8)>.58);}
else if(kind<3.5){let a=ridge(q.x*.55);let b=ridge(q.y*.55);h=mix(a,b,select(.25,.75,fract(cell.x+cell.y)>.5))*.72;fiber=abs(noise2(q*1.8)-.5)*.12;}
else if(kind<4.5){let row=fract(q.y*.5);let col=fract(q.x);let loop=sin(col*PI)*sin(row*PI);h=pow(max(0.,loop),.55)*.88+ridge(q.y*.5)*.12;fiber=abs(noise2(q*7.)-.5)*.18;}
else if(kind<5.5){h=noise2(q*2.)*.18+noise2(q*7.)*.08;fiber=pow(max(0.,noise2(q*12.)-.35),2.);}
else{let a=ridge(q.x*1.2);let b=ridge(q.y*1.2);h=mix(a,b,select(.35,.65,fract(cell.x+cell.y)>.5))*.5;fiber=abs(noise2(q*5.)-.5)*.12;ink=select(0.,1.,sin(q.x*1.2)*sin(q.y*1.2)>.72);}
return vec4<f32>(h+fiber,fiber,ink,n);}
fn heightAt(p:vec2<f32>)->f32{return pattern(p,u.material.w).x*u.material.y;}
fn shade(rd:vec3<f32>,p:vec2<f32>)->vec4<f32>{let v=pattern(p,u.material.w);let e=max(.0004,.012/u.material.x);let hx=heightAt(p+vec2<f32>(e,0.))-heightAt(p-vec2<f32>(e,0.));let hy=heightAt(p+vec2<f32>(0.,e))-heightAt(p-vec2<f32>(0.,e));let N=normalize(vec3<f32>(-hx/(2.*e),-hy/(2.*e),1.));let L=normalize(vec3<f32>(-.48,.62,.78));let V=normalize(-rd);let H=normalize(L+V);let ndl=max(0.,dot(N,L));let ndv=max(.04,dot(N,V));let rough=clamp(u.material.z+v.y*.18,.08,1.);let spec=pow(max(0.,dot(N,H)),mix(100.,5.,rough))*(1.-rough)*.42;let dye=clamp(v.z*.7+select(0.,.22,sin((p.x+p.y*.035)*u.material.x*PI*2.)>.88),0.,.55);let base=mix(u.colorA.rgb,u.colorB.rgb,dye+v.w*.10);let diffuse=base*(.22+ndl*.82);let sheen=pow(1.-ndv,3.)*(1.-rough)*.12;return vec4<f32>(diffuse+vec3<f32>(spec+sheen),1.);}
@vertex fn vs(@builtin(vertex_index)i:u32)->@builtin(position)vec4<f32>{var p=array<vec2<f32>,3>(vec2<f32>(-1.,-1.),vec2<f32>(3.,-1.),vec2<f32>(-1.,3.));return vec4<f32>(p[i],0.,1.);}
@fragment fn fs(@builtin(position)px:vec4<f32>)->@location(0)vec4<f32>{let ndc=vec2<f32>(px.x/u.view.x*2.-1.,1.-px.y/u.view.y*2.);let rd=normalize(u.forward.xyz+u.view.z*(u.right.xyz*ndc.x+u.up.xyz*ndc.y));if(abs(rd.z)<.0001){return vec4<f32>(.035,.04,.045,1.);}let t=-u.eye.z/rd.z;if(t<0.){return vec4<f32>(.035,.04,.045,1.);}let hit=u.eye.xyz+rd*t;if(abs(hit.x)>1.25||abs(hit.y)>.88){return vec4<f32>(.035,.04,.045,1.);}let p=hit.xy+vec2<f32>(.5);let c=shade(rd,p);let edge=1.-smoothstep(0.,.012,min(.625-abs(hit.x),.44-abs(hit.y)));return vec4<f32>(mix(vec3<f32>(.035),c.rgb,edge),1.);}