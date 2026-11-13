struct U { mvp:mat4x4<f32>, material:vec4<f32>, colorA:vec4<f32>, colorB:vec4<f32> };
@group(0) @binding(0) var<uniform> u:U;
struct In { @location(0) position:vec3<f32>, @location(1) normal:vec3<f32>, @location(2) uv:vec2<f32> };
struct Out { @builtin(position) clip:vec4<f32>, @location(0) uv:vec2<f32>, @location(1) normal:vec3<f32>, @location(2) world:vec3<f32> };
const PI:f32=3.14159265359;
fn hash21(p:vec2<f32>)->f32{let q=vec3<f32>(p.x,p.y,p.x)*vec3<f32>(127.1,311.7,74.7);return fract(sin(dot(q,vec3<f32>(1.,57.,113.)))*43758.5453);}
fn noise2(p:vec2<f32>)->f32{let i=floor(p);let f=fract(p);let a=hash21(i);let b=hash21(i+vec2<f32>(1.,0.));let c=hash21(i+vec2<f32>(0.,1.));let d=hash21(i+vec2<f32>(1.,1.));let q=f*f*(3.-2.*f);return mix(mix(a,b,q.x),mix(c,d,q.x),q.y);}
fn ridge(x:f32)->f32{return 1.-abs(2.*fract(x)-1.);}
fn pattern(p:vec2<f32>,kind:f32)->vec4<f32>{let q=p*u.material.x;let cell=floor(q);let warp=noise2(vec2<f32>(q.x*.21,q.y*.07));let weft=noise2(vec2<f32>(q.x*.08,q.y*.23));var h=0.;var fiber=0.;var ink=0.;var n=noise2(q*4.);
if(kind<.5){h=mix(ridge(q.x),ridge(q.y),select(0.,1.,fract(cell.x+cell.y)>.5))*.52;fiber=abs(warp-.5)*.10+abs(weft-.5)*.08;}
else if(kind<1.5){let d=q.x+q.y*.42;h=ridge(d)*.62+ridge(q.y)*.08;fiber=abs(noise2(q*2.7)-.5)*.16;}
else if(kind<2.5){let x=q.x*.5+q.y*.5;h=ridge(x)*.56+ridge(q.y)*.08;fiber=abs(noise2(q*5.)-.5)*.15;}
else if(kind<3.5){let a=ridge(q.x*.55);let b=ridge(q.y*.55);h=mix(a,b,select(.25,.75,fract(cell.x+cell.y)>.5))*.72;fiber=abs(noise2(q*1.8)-.5)*.12;}
else if(kind<4.5){let row=fract(q.y*.5);let col=fract(q.x);let loopShape=sin(col*PI)*sin(row*PI);h=pow(max(0.,loopShape),.55)*.88+ridge(q.y*.5)*.12;fiber=abs(noise2(q*7.)-.5)*.18;}
else if(kind<5.5){h=noise2(q*2.)*.18+noise2(q*7.)*.08;fiber=pow(max(0.,noise2(q*12.)-.35),2.);}
else if(kind<6.5){let a=ridge(q.x*1.2);let b=ridge(q.y*1.2);h=mix(a,b,select(.35,.65,fract(cell.x+cell.y)>.5))*.5;fiber=abs(noise2(q*5.)-.5)*.12;ink=select(0.,1.,sin(q.x*1.2)*sin(q.y*1.2)>.72);}
else{let x=q.x+q.y*.12;h=ridge(x)*.44+ridge(q.y*.42)*.14;fiber=abs(noise2(q*9.)-.5)*.18;}
return vec4<f32>(h+fiber,fiber,ink,n);}
@vertex fn vs(i:In)->Out{var o:Out;o.clip=u.mvp*vec4<f32>(i.position,1.);o.uv=i.uv;o.normal=i.normal;o.world=i.position;return o;}
@fragment fn fs(i:Out)->@location(0) vec4<f32>{let p=pattern(i.uv,u.material.w);let e=1./max(32.,u.material.x*64.);let dx=pattern(i.uv+vec2<f32>(e,0.),u.material.w).x-pattern(i.uv-vec2<f32>(e,0.),u.material.w).x;let dy=pattern(i.uv+vec2<f32>(0.,e),u.material.w).x-pattern(i.uv-vec2<f32>(0.,e),u.material.w).x;let N=normalize(i.normal+vec3<f32>(-dx*u.material.y*1.8,-dy*u.material.y*1.8,0.));let L=normalize(vec3<f32>(-.45,.7,.9));let V=normalize(vec3<f32>(0.,0.,2.2)-i.world);let H=normalize(L+V);let rough=clamp(u.material.z+p.y*.14,.06,1.);let diffuse=max(.0,dot(N,L));let spec=pow(max(0.,dot(N,H)),mix(100.,5.,rough))*(1.-rough)*.38;let dye=clamp(p.z*.65+select(0.,.22,noise2(i.uv*u.material.x)>.88),0.,.55);let base=mix(u.colorA.rgb,u.colorB.rgb,dye+p.w*.09);let fuzz=pow(1.-max(.05,dot(N,V)),3.)*(1.-rough)*.18;return vec4<f32>(base*(.24+diffuse*.82)+vec3<f32>(spec+fuzz),1.);}