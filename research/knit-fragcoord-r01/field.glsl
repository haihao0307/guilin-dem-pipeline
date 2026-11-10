// Source: KAOPU P02 C2 curve controls, three procedural plies, deterministic short fibres.
// Original cache kernel. This is disposable acceleration data, not source geometry.
// Research only: cache interpolation is approximate, not an exact SDF proof.
float wrap1(float x, float period) { return x - floor(x / period + 0.5) * period; }
vec4 fieldAt(vec3 p) {
    float best = 1000.0;
    vec3 tangent = vec3(1.0,0.0,0.0);
    for (int i=0; i<288; i=i+1) {
        vec3 a = segments.data[i*2].xyz;
        vec3 b = segments.data[i*2+1].xyz;
        vec3 mid = (a+b)*0.5;
        vec3 q = p-mid;
        q.x = wrap1(q.x,1.0);
        q.y = wrap1(q.y,0.65);
        vec3 v = b-a;
        vec3 w = q+v*0.5;
        float t = clamp(dot(w,v)/max(dot(v,v),0.0000001),0.0,1.0);
        float d = length(w-v*t)-0.060;
        if (d<best) { best=d; tangent=normalize(v); }
    }
    return vec4(best,tangent);
}
vec4 hairAt(vec3 p) {
    float best=1000.0;
    vec3 tangent=vec3(1.0,0.0,0.0);
    for(int i=288;i<384;i=i+1){
        vec3 a=segments.data[i*2].xyz;
        vec3 b=segments.data[i*2+1].xyz;
        vec3 mid=(a+b)*0.5;
        vec3 q=p-mid;
        q.x=wrap1(q.x,1.0);
        q.y=wrap1(q.y,0.65);
        vec3 v=b-a;
        vec3 w=q+v*0.5;
        float t=clamp(dot(w,v)/max(dot(v,v),0.0000001),0.0,1.0);
        float d=length(w-v*t)-0.005;
        if(d<best){best=d;tangent=normalize(v);}
    }
    return vec4(best,tangent);
}
