precision highp float;
uniform sampler2D envA,envB;uniform float envMix,encodedEnv,aspect,tanFov,exposure;
uniform vec2 resolution;uniform vec3 fw,right,up;out vec4 O;
vec4 env(vec3 d){vec2 uv=vec2(atan(d.x,-d.z)/6.28318530718+.5,sqrt(clamp(asin(clamp(d.y,0.,1.))/1.57079632679,0.,1.)));vec4 a=texture(envA,uv),b=texture(envB,uv);if(encodedEnv>.5){a.rgb/=max(1.-a.rgb,vec3(.001));b.rgb/=max(1.-b.rgb,vec3(.001));}return mix(a,b,envMix);}
void main(){vec2 xy=(2.*gl_FragCoord.xy/resolution-1.)*vec2(aspect,1.);vec3 d=normalize(fw+(xy.x*right+xy.y*up)*tanFov);vec4 c=env(d);vec3 col=c.rgb+c.a*sky(d);col=max(col*exposure,0.);col=col*(2.51*col+.03)/(col*(2.43*col+.59)+.14);O=vec4(pow(clamp(col,0.,1.),vec3(1./2.2)),1.);}
