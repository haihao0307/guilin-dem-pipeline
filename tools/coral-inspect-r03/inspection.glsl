// Inspect original scalar field with independent view uniforms. No new fractal.
uniform mat3 uInspectRotation;
uniform vec2 uInspectPan;
uniform float uInspectZoom;
uniform float uInspectDepth;
uniform int uLightMode;
uniform float uWarmPower;
uniform float uCoolPower;
uniform float uLightBlend;

vec3 originalVector(vec3 a) {
    vec3 A=vec3(0,9,-3)/9.5;
    a=A*dot(a+a,A)-a-.14*cross(a,A);
    a.xz*=mat2(cos(iTime*.3-vec4(0,11,33,0)));
    return a;
}
// Positive folded scalar, not a proven signed distance or a measured tissue surface.
float inspectField(vec3 q) {
    float ss=6.0;
    for(int k=0;k<12;k++) {
        float ee=16.0/max(dot(q,q),1e-15);
        ss*=ee;
        q=vec3(0,4.03,-1)-abs(abs(q)*ee-vec3(3,4,3));
    }
    return .3*q.y*q.y/max(ss,1e-20);
}
vec3 studioLight(vec3 col,vec3 at) {
    if(uLightMode==0||uLightBlend<=0.)return col;
    float ep=clamp(.004/uInspectZoom,.00003,.004);
    vec3 grad=vec3(inspectField(at+vec3(ep,0,0))-inspectField(at-vec3(ep,0,0)),
                   inspectField(at+vec3(0,ep,0))-inspectField(at-vec3(0,ep,0)),
                   inspectField(at+vec3(0,0,ep))-inspectField(at-vec3(0,0,ep)));
    vec3 eye=normalize(originalVector(uInspectRotation*vec3(0,0,-1)));
    float nlen=length(grad);
    vec3 normal=nlen>1e-15?grad/nlen:eye;
    if(dot(normal,eye)<0.)normal=-normal;
    vec3 left=normalize(originalVector(uInspectRotation*normalize(vec3(-1,.65,-.8))));
    vec3 right=normalize(originalVector(uInspectRotation*normalize(vec3(1,.40,-.65))));
    vec3 warmDir=uLightMode==2?right:left,coolDir=uLightMode==2?left:right;
    vec3 warm=vec3(1.22,1.0,.75),cool=vec3(.66,.87,1.22);
    float dw=max(dot(normal,warmDir),0.),dc=max(dot(normal,coolDir),0.);
    vec3 light=vec3(.42)+.64*uWarmPower*warm*(.12+.88*dw)+.45*uCoolPower*cool*(.12+.88*dc);
    float sw=pow(max(dot(normal,normalize(warmDir+eye)),0.),24.);
    float sc=pow(max(dot(normal,normalize(coolDir+eye)),0.),24.);
    // Gentle two-sided directional sculpting, not full PBR/SSS or shadow transport.
    vec3 lit=col*light+.025*max(col.r,max(col.g,col.b))*(sw*uWarmPower*warm+sc*uCoolPower*cool);
    return mix(col,lit,uLightBlend);
}
