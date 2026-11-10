// TEST_FIXTURE_ONLY. This analytic garment carrier is NOT a measured Yongji Chen replica.
// Do not promote its silhouette or substitute it for the accepted garment.
// Own implementation; no FabriceNeyret2 source copied (the gallery entry has no license).
const float PI = 3.14159265359;
const float TAU = 6.28318530718;
struct Chart { vec3 q; float d; float end; float pitch; float id; };
struct Sample { float d; vec3 q; float pitch; float id; };
float mod1(float a,float b) { return a-b*floor(a/b); }
float hash1(float x) { return fract(sin(x*127.1+31.7)*43758.5453); }
float hash3(vec3 p) { return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453); }
float noise3(vec3 p) {
    vec3 i=floor(p); vec3 f=fract(p); f=f*f*(3.0-2.0*f);
    float a=mix(hash3(i),hash3(i+vec3(1.0,0.0,0.0)),f.x);
    float b=mix(hash3(i+vec3(0.0,1.0,0.0)),hash3(i+vec3(1.0,1.0,0.0)),f.x);
    float c=mix(hash3(i+vec3(0.0,0.0,1.0)),hash3(i+vec3(1.0,0.0,1.0)),f.x);
    float d=mix(hash3(i+vec3(0.0,1.0,1.0)),hash3(i+vec3(1.0,1.0,1.0)),f.x);
    return mix(mix(a,b,f.y),mix(c,d,f.y),f.z);
}
vec2 profile(float y) {
    float shoulder=smoothstep(0.30,0.67,y);
    float hem=1.0-smoothstep(-0.64,-0.48,y);
    float rx=mix(0.469+0.011*sin(y*7.0),0.200,shoulder)-hem*0.018;
    float rz=mix(0.218+0.009*sin(y*8.0+0.7),0.167,shoulder)-hem*0.006;
    float collar=smoothstep(0.65,0.69,y);
    rx=rx+collar*(0.010*sin((y-0.66)*13.0)+0.004*sin((y-0.66)*47.0));
    rz=rz+collar*0.009*sin((y-0.66)*13.0);
    return vec2(rx,rz);
}
Chart bodyChart(vec3 p) {
    float y=clamp(p.y,-0.64,0.93);
    vec2 r=profile(y);
    float ang=atan(p.x/r.x,p.z/r.y);
    float folds=0.0028*sin(ang*11.0+y*10.0)+0.0017*sin(ang*23.0-y*7.0);
    folds=folds*(1.0-smoothstep(0.25,0.7,y));
    r=r+vec2(folds,folds);
    float rho=max(length(vec2(p.x/r.x,p.z/r.y)),0.001);
    vec2 dr=(profile(y+0.001)-profile(y-0.001))/0.002;
    vec3 grad=vec3(p.x/(r.x*r.x),-p.x*p.x*dr.x/(r.x*r.x*r.x)-p.z*p.z*dr.y/(r.y*r.y*r.y),p.z/(r.y*r.y));
    float radial=(rho-1.0)*rho/max(length(grad),0.001);
    float pitch=U.v[5].x;
    float u=ang*10.0+32.0;
    float v=(y+0.65)/pitch;
    float rib=0.0;
    if (y>0.665) { u=ang*4.2+14.0; v=(y-0.665)/pitch*0.38+47.0; rib=1.0; }
    if (y< -0.48) { rib=1.0; }
    float z=radial/pitch;
    if (rib>0.5) {
        float lane=mod1(floor(u),4.0);
        if (lane>=2.0) { z=z+0.12; }
    }
    u=u+0.016*sin(v*0.91+sin(u*1.1));
    v=v+0.014*sin(u*2.3+v*0.47);
    float end=max(-0.64-p.y,p.y-0.93);
    return Chart(vec3(u,v,z),max(radial,end),end,pitch,0.0);
}
Chart sleeveChart(vec3 p,float side) {
    vec3 a=vec3(side*0.30,0.50,0.0);
    vec3 b=vec3(side*0.91,-0.58,0.025);
    vec3 axis=normalize(b-a);
    vec3 across=normalize(vec3(-axis.y,axis.x,0.0));
    vec3 forward=normalize(cross(across,axis));
    vec3 w=p-a;
    float axial=dot(w,axis);
    float len=length(b-a);
    float t=clamp(axial/len,0.0,1.0);
    float radius=mix(0.156,0.102,t)+0.006*sin(t*PI);
    radius=radius-0.008*smoothstep(0.82,0.88,t);
    radius=max(0.002,radius*smoothstep(0.0,0.22,t));
    vec2 xy=vec2(dot(w,across),dot(w,forward));
    float ang=atan(xy.x,xy.y);
    float radial=(length(xy)-radius)*0.998;
    float pitch=U.v[5].x;
    float u=ang*5.8+19.0;
    float v=axial/pitch+6.0;
    float z=radial/pitch;
    if (t>0.83 && mod1(floor(u),4.0)>=2.0) { z=z+0.12; }
    u=u+0.014*sin(v+u*0.5);
    v=v+0.013*sin(u*1.7);
    float end=max(-axial-0.08,axial-len);
    return Chart(vec3(u,v,z),max(radial,end),end,pitch,1.0+side*0.25);
}
Chart chart(vec3 p) {
    Chart c=bodyChart(p);
    Chart a=sleeveChart(p,1.0);
    Chart b=sleeveChart(p,-1.0);
    if(a.d<c.d) { c=a; }
    if(b.d<c.d) { c=b; }
    return c;
}
float macroDistance(vec3 p) { return chart(p).d; }
vec4 cell(vec3 q) {
    vec3 uv=vec3(fract(q.x),fract(q.y/0.65),clamp(q.z+0.5,0.008,0.992));
    return sampleField(uv);
}
Sample query(vec3 p) {
    Chart c=chart(p);
    float margin=abs(c.q.z)-0.46;
    if(margin>0.0) { return Sample(max(margin*c.pitch,c.end),c.q,c.pitch,-1.0); }
    vec4 f=cell(c.q);
    float yarn=f.x-(U.v[5].y-1.0)*0.020;
    float hair=sampleHair(vec3(fract(c.q.x),fract(c.q.y/0.65),clamp(c.q.z+0.5,0.008,0.992))).x;
    if(U.v[5].z>0.5 && hair<yarn) { yarn=hair; c.id=c.id+4.0; }
    float d=max(yarn*c.pitch,c.end);
    return Sample(d,c.q,c.pitch,c.id);
}
float sdf(vec3 p) {
    Chart c=chart(p);
    float margin=abs(c.q.z)-0.46;
    if(margin>0.0) { return max(margin*c.pitch,c.end); }
    return max((cell(c.q).x-(U.v[5].y-1.0)*0.020)*c.pitch,c.end);
}
vec3 surfaceNormal(vec3 p,float e) {
    vec3 x=vec3(e,0.0,0.0); vec3 y=vec3(0.0,e,0.0); vec3 z=vec3(0.0,0.0,e);
    vec3 n=vec3(sdf(p+x)-sdf(p-x),sdf(p+y)-sdf(p-y),sdf(p+z)-sdf(p-z));
    return normalize(n+vec3(0.00000001));
}
float occlusion(vec3 p,vec3 n,float pitch) {
    float o=0.0; float w=1.0;
    for(int i=1;i<=4;i=i+1) {
        float h=pitch*(0.09+float(i)*0.16);
        o=o+(h-sdf(p+n*h))/h*w; w=w*0.57;
    }
    return clamp(1.0-o*0.23,0.28,1.0);
}
float shadow(vec3 p,vec3 n,vec3 l,float pitch) {
    float t=pitch*0.08; float s=1.0;
    vec3 ro=p+n*pitch*0.06;
    for(int i=0;i<22;i=i+1) {
        float h=sdf(ro+l*t);
        if(h<0.00008) { return 0.10; }
        s=min(s,7.0*h/max(t,0.001));
        t=t+clamp(h*0.85,pitch*0.12,0.065);
        if(t>0.75) { break; }
    }
    return clamp(s,0.10,1.0);
}
float macroShadow(vec3 p,vec3 l) {
    float t=0.035; float s=1.0;
    for(int i=0;i<28;i=i+1) {
        float h=macroDistance(p+l*t);
        if(h<0.001) { return 0.16; }
        s=min(s,4.0*h/t);t=t+clamp(h,0.015,0.15);
        if(t>2.5) { break; }
    }
    return clamp(s,0.16,1.0);
}
vec3 pigment(vec3 q) {
    vec3 c=U.v[6].xyz;
    float row=floor(q.y*2.0); float col=floor(q.x);
    float melange=0.92+0.12*hash1(col*13.1+row*91.7);
    float fine=noise3(q*vec3(18.0,18.0,25.0));
    return c*melange*(0.95+fine*0.08);
}
vec3 shade(vec3 p,vec3 n,vec3 eye,Sample s,float footprint) {
    vec3 c=pigment(s.q);
    vec3 l1=normalize(vec3(-1.8,2.5,2.0));
    vec3 l2=normalize(vec3(2.0,1.2,1.5));
    vec3 v=normalize(eye-p);
    float ao=occlusion(p,n,s.pitch);
    float sh1=shadow(p,n,l1,s.pitch);
    float sh2=shadow(p,n,l2,s.pitch);
    float d1=max(dot(n,l1),0.0);float d2=max(dot(n,l2),0.0);
    float micro=0.5+0.5*sin(s.q.x*303.0+s.q.y*147.0+s.q.z*221.0+4.0*noise3(s.q*22.0));
    float detailWeight=1.0-smoothstep(0.018,0.07,footprint);
    float fibre=1.0-0.055*micro*detailWeight;
    vec3 key=vec3(1.08,0.98,0.84)*d1*sh1*1.30;
    vec3 fill=vec3(0.66,0.79,1.0)*d2*sh2*0.65;
    vec3 light=vec3(0.23,0.25,0.28)*ao+key+fill;
    vec3 h1=normalize(l1+v);vec3 h2=normalize(l2+v);
    float sheen1=pow(max(dot(n,h1),0.0),4.0)*0.11*sh1;
    float sheen2=pow(max(dot(n,h2),0.0),3.0)*0.09*sh2;
    float rim=pow(1.0-max(dot(n,v),0.0),3.0)*U.v[5].z;
    if(s.id>3.0) { ao=mix(ao,1.0,0.6); light=light+vec3(0.25); }
    vec3 wool=c*light*fibre*sqrt(ao);
    wool=wool+sqrt(c)*vec3(1.0,0.91,0.79)*(sheen1+sheen2+rim*0.045)*ao;
    return wool;
}
float fuzzDensity(Sample s,float footprint) {
    float h=s.d/max(s.pitch,0.001);
    if(h<=0.0 || h>0.13 || s.id<0.0) { return 0.0; }
    vec3 q=s.q;
    float a=sin(q.x*187.0+q.y*93.0+3.0*sin(q.z*41.0+q.y*27.0));
    float b=sin(q.x*41.0-q.y*167.0+q.z*219.0+sin(q.x*83.0));
    float striation=pow(max(a*b,0.0),9.0);
    float filtered=mix(striation,0.035,smoothstep(0.012,0.08,footprint));
    return filtered*exp(-h*27.0)*U.v[5].z;
}
vec2 hitBox(vec3 ro,vec3 rd) {
    vec3 lo=vec3(-1.10,-0.76,-0.36);vec3 hi=vec3(1.10,1.02,0.36);
    vec3 inv=1.0/(rd+vec3(0.00000001));
    vec3 a=(lo-ro)*inv;vec3 b=(hi-ro)*inv;
    vec3 mn=min(a,b);vec3 mx=max(a,b);
    return vec2(max(max(mn.x,mn.y),mn.z),min(min(mx.x,mx.y),mx.z));
}
vec3 background(vec3 ro,vec3 rd) {
    float g=0.5+0.5*rd.y;
    vec3 bg=mix(vec3(0.023,0.026,0.030),vec3(0.049,0.054,0.060),g);
    if(rd.y< -0.001) {
        float t=(-0.76-ro.y)/rd.y;
        if(t>0.0 && t<20.0) {
            vec3 p=ro+rd*t;
            float shadow1=macroShadow(p,normalize(vec3(-1.8,2.5,2.0)));
            float contact=1.0-0.21*exp(-dot(p.xz/vec2(0.94,0.33),p.xz/vec2(0.94,0.33)));
            float plane=exp(-t*0.09);
            bg=mix(bg,vec3(0.057,0.062,0.070)*shadow1*contact,plane);
        }
    }
    return bg;
}
vec3 trace(vec3 ro,vec3 rd,float pixel) {
    vec2 interval=hitBox(ro,rd);
    float t=max(interval.x,0.0);
    float maxT=min(interval.y,6.5);
    vec3 col=background(ro,rd);
    vec3 fur=vec3(0.0);float trans=1.0;
    if(interval.x>interval.y || interval.y<0.0) { return col; }
    for(int step=0;step<240;step=step+1) {
        vec3 p=ro+rd*t;
        Sample s=query(p);
        float foot=pixel*t/max(s.pitch,0.001);
        float eps=clamp(pixel*t*0.18,0.000035,0.00016);
        if(s.d<eps && s.id>3.0) {
            float alpha=clamp(0.004*s.pitch/max(pixel*t,0.00001),0.015,0.72);
            fur=fur+trans*alpha*sqrt(pigment(s.q))*0.50;
            trans=trans*(1.0-alpha);
            t=t+max(s.pitch*0.016,eps*2.0);
            if(t>maxT || trans<0.04){break;}
            continue;
        }
        if(s.d<eps && s.id>=0.0) {
            vec3 n=surfaceNormal(p,0.00026);
            col=shade(p,n,ro,s,foot);
            if(U.v[5].w>0.5) { col=n*0.5+0.5; }
            break;
        }
        float delta=max(s.d*0.58,0.00008);
        if(s.d<s.pitch*0.13 && U.v[5].z>0.0) {
            delta=min(delta,s.pitch*0.035);
            float rho=fuzzDensity(s,foot);
            float alpha=1.0-exp(-rho*delta/s.pitch*1.8);
            fur=fur+trans*alpha*sqrt(pigment(s.q))*0.72;
            trans=trans*(1.0-alpha);
        }
        t=t+delta;
        if(t>maxT) { break; }
    }
    return fur+trans*col;
}
vec3 tonemap(vec3 c) {
    c=c*U.v[4].w;
    c=(c*(2.51*c+0.03))/(c*(2.43*c+0.59)+0.14);
    return pow(clamp(c,vec3(0.0),vec3(1.0)),vec3(1.0/2.2));
}
vec4 renderPixel(vec2 xy) {
    vec2 res=U.v[0].xy;
    vec2 q=(xy-res*0.5)/res.y;
    vec3 ro=U.v[1].xyz;
    vec3 viewTarget=U.v[2].xyz;
    vec3 f=normalize(viewTarget-ro);
    vec3 r=normalize(cross(f,vec3(0.0,1.0,0.0)));
    vec3 up=cross(r,f);
    float lens=U.v[4].x;
    float pixel=lens/res.y;
    vec3 c=vec3(0.0);
    for(int aa=0;aa<2;aa=aa+1){
        float a=float(aa)-0.5;
        vec3 ray=normalize(f+(q.x+a*0.48/res.y)*r*lens-(q.y+a*0.72/res.y)*up*lens);
        c=c+trace(ro,ray,pixel)*0.5;
    }
    return vec4(tonemap(c),1.0);
}
