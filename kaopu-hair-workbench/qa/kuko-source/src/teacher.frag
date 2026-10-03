// User supplied KuKo Day 114. AA practice credits fabrice:
// https://www.shadertoy.com/view/tlSfzV
#define T iTime
vec3 palette(float t, vec3 a, vec3 b, vec3 c, vec3 d) {
    return a + b * cos(6.28318 * (c * t + d));
}
float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
vec2 sincos(float x) { return vec2(sin(x), cos(x)); }
float sdfCapsule(vec3 p, float id) {
    vec3 wp = p;
    wp.x += sin(p.y * 3. - T * 2.) * 0.06;
    float s = mix(0.2,2.5,id);
    vec3 a = vec3(0.0,-10.0,0.0);
    vec3 b = vec3(0.0,1.0,0.0);
    vec3 pa = wp-a, ab=b-a;
    float h = clamp(dot(pa,ab)/dot(ab,ab),0.0,1.0);
    return length(pa-ab*h)-0.1;
}
float map(vec3 p) {
    vec2 cell=vec2(2.0);
    p.z -= T*0.93;
    p.x += 0.5;
    vec2 id=floor((p.xz+1.0)/2.0);
    p.xz=mod(p.xz+0.0,cell)-0.5*cell;
    return sdfCapsule(p,hash(id));
}
float rayMarch(vec3 ro,vec3 rd) {
    float dt=0.0;
    for(int i=0;i<80;i++) {
        vec3 p=ro+rd*dt;
        float d=map(p);
        dt+=d*0.9;
        if(d<0.01 || dt>20.0) break;
    }
    return dt;
}
vec3 calcNormal(vec3 p) {
    float e=0.001;
    return normalize(vec3(map(p+vec3(e,0,0))-map(p-vec3(e,0,0)),map(p+vec3(0,e,0))-map(p-vec3(0,e,0)),map(p+vec3(0,0,e))-map(p-vec3(0,0,e))));
}
void mainImage(out vec4 O,in vec2 I) {
    vec2 uv=(2.0*I-iResolution.xy)/iResolution.y;
    vec3 col=vec3(0.0);
    vec3 ro=vec3(0.0,0.0,3.0);
    vec3 rd=normalize(vec3(uv,-1.0));
    float dt=rayMarch(ro,rd);
    if(dt<10.0) {
        vec3 p=ro+rd*dt;
        vec3 norm=calcNormal(p);
        vec3 lDir=normalize(vec3(0.6,0.6,0.5));
        float diff=max(dot(norm,lDir),0.0);
        float amb=0.08;
        float vdn=dot(norm,-rd);
        float wRim=max(fwidth(vdn),0.9);
        float rim=pow(smoothstep(0.0,wRim,1.0-vdn),2.0);
        float t=p.y*0.9+0.2;
        vec3 albedo=palette(t,vec3(0.5),vec3(0.5),vec3(0.30),vec3(.347,0.1714,0.1212));
        float focusDist=0.8;
        float aperture=0.0539;
        float coc=clamp(aperture*abs(dt-focusDist)/max(focusDist,1e-3),0.0,1.0);
        float sharp=exp(-10.0*coc);
        vec3 gray=vec3(dot(albedo,vec3(0)));
        vec3 albedoSoft=mix(gray,albedo,sharp);
        float softAmb=amb+7.15*coc;
        float d0=map(p);
        float wCov=max(fwidth(d0),1e-1);
        float alpha=1.0-smoothstep(0.0,wCov,d0);
        float light=softAmb+(diff+9.6*rim)*sharp;
        vec3 litColor=albedoSoft*light*alpha;
        float facing=max(0.0,dot(norm,-rd));
        float edgeMask=pow(1.0-facing,0.2);
        col=mix(litColor,col,edgeMask);
    }
    col=pow(col*2.1,vec3(1.1/2.2));
    O=vec4(col,1.0);
}
