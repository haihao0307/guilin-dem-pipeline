// Pelagic Passage — independently authored procedural manta study, 2026-10-05.
// Inputs: iResolution (vec3), iTime (float). No samplers, imported data or audio.
// This is an artistic geometric animation, not a biological or physical simulation.

const float FAR_WATER = 62.0;
float sat(float x) { return clamp(x,0.0,1.0); }
// Independently arranged 32-bit coordinate mixing; unsigned wrap is intentional.
// Visual noise only. This is not a cryptographic hash or imported hash source.
float hash31(vec3 p) {
    ivec3 cell=ivec3(floor(p*vec3(1.0,1.0,29.0)));
    uint h=uint(cell.x)*10007u+uint(cell.y)*30011u+uint(cell.z)*70117u+389u;
    h=(h^(h<<9)^(h>>17))*7477u;
    h=(h^(h<<13)^(h>>7))*104729u;
    h=h^(h>>16);
    return float(h&0x00ffffffu)*(1.0/16777216.0);
}
float grain(vec3 p) {
    vec3 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
    return mix(mix(mix(hash31(i),hash31(i+vec3(1,0,0)),f.x),
                   mix(hash31(i+vec3(0,1,0)),hash31(i+vec3(1,1,0)),f.x),f.y),
               mix(mix(hash31(i+vec3(0,0,1)),hash31(i+vec3(1,0,1)),f.x),
                   mix(hash31(i+vec3(0,1,1)),hash31(i+vec3(1,1,1)),f.x),f.y),f.z);
}
mat2 turn(float a) { float c=cos(a),s=sin(a);return mat2(c,-s,s,c); }
float roundedUnion(float a,float b,float r) {
    float h=sat(0.5+0.5*(b-a)/r);return mix(b,a,h)-r*h*(1.0-h);
}
float oval(vec3 p,vec3 r) {
    float a=length(p/r), b=length(p/(r*r));
    return a*(a-1.0)/max(b,0.00001);
}
float segment(vec3 p,vec3 a,vec3 b,float ra,float rb) {
    vec3 v=b-a;float f=sat(dot(p-a,v)/dot(v,v));
    return length(p-a-v*f)-mix(ra,rb,f);
}
float finHeight(float x,float z,float phase) {
    float u=min(abs(x)/2.6,1.1);
    return pow(u,1.65)*(0.71*sin(phase-1.48*u+0.67*z)+0.055)
        +0.04*sin(phase+z*1.4)*(1.0-sat(u));
}
float manta(vec3 p,float phase) {
    float u=sat(abs(p.x)/2.6);
    float leading=-0.95+1.27*pow(u,1.27);
    float trailing=1.12-0.80*pow(u,0.63);
    float mid=0.5*(leading+trailing), chord=max(0.5*(trailing-leading),0.008);
    float along=(p.z-mid)/chord;
    float thick=0.030+0.225*pow(1.0-u,1.10);
    thick*=1.0-0.24*clamp(along,-1.0,1.0);
    vec2 fin=vec2(p.z-mid,p.y-finHeight(p.x,p.z,phase));
    vec2 radii=vec2(chord,thick);
    float k0=length(fin/radii),k1=length(fin/(radii*radii));
    float d=max(k0*(k0-1.0)/max(k1,0.00001),abs(p.x)-2.6)*0.43;
    vec3 body=p-vec3(0,0.025,-0.08);
    body.y-=0.035*sin(phase+body.z);
    d=roundedUnion(d,oval(body,vec3(0.59,0.32,0.99)),0.16);
    d=roundedUnion(d,oval(p-vec3(0.0,0.025,-0.71),vec3(0.52,0.23,0.40)),0.105);
    // Short, smoothly curved paired feeding lobes, attached to a broad head.
    vec3 q=p; q.x=abs(q.x);
    float lobe=segment(q,vec3(0.39,0.015,-0.72),vec3(0.49,0.04,-1.00),0.135,0.10);
    lobe=min(lobe,segment(q,vec3(0.49,0.04,-1.00),vec3(0.46,0.07,-1.20),0.10,0.069));
    lobe=min(lobe,segment(q,vec3(0.46,0.07,-1.20),vec3(0.36,0.08,-1.28),0.069,0.039));
    d=roundedUnion(d,lobe,0.085);
    d=roundedUnion(d,oval(p-vec3(0,0.13,0.74),vec3(0.065,0.15,0.21)),0.06);
    vec3 rear=q-vec3(0.33,-0.015,0.88);
    rear.xz=turn(-0.43)*rear.xz;
    d=roundedUnion(d,oval(rear,vec3(0.20,0.055,0.36)),0.04);
    // A whip-like tail, independent of the pectoral wave.
    if(p.z>0.65) {
        vec3 a=vec3(0,0.02,0.82);
        for(int j=1;j<=5;j++) {
            float f=float(j)/5.0;
            vec3 b=vec3(0.16*f*f*sin(phase*0.8-f*3.4),0.02+0.085*f*sin(phase-f*2.0),0.82+2.36*f);
            d=min(d,segment(p,a,b,mix(0.043,0.009,float(j-1)/5.0),mix(0.043,0.009,f)));
            a=b;
        }
    }
    // Eyes stand just proud of the head, rather than being painted dots.
    d=min(d,oval(q-vec3(0.465,0.105,-0.765),vec3(0.066,0.05,0.072)));
    return d;
}
vec3 mantaNormal(vec3 p,float phase,float eps) {
    vec2 e=vec2(eps,-eps);
    return normalize(e.xyy*manta(p+e.xyy,phase)+e.yyx*manta(p+e.yyx,phase)
                   +e.yxy*manta(p+e.yxy,phase)+e.xxx*manta(p+e.xxx,phase));
}
vec2 rayBox(vec3 ro,vec3 rd,vec3 a,vec3 b) {
    vec3 inv=sign(rd)/max(abs(rd),vec3(0.00001));
    vec3 x=(a-ro)*inv,y=(b-ro)*inv;
    vec3 mn=min(x,y),mx=max(x,y);
    return vec2(max(max(mn.x,mn.y),mn.z),min(min(mx.x,mx.y),mx.z));
}
void animal(int id,out vec3 center,out float scale,out vec3 angles,out float phase) {
    float t=iTime;
    if(id==0) {center=vec3(-0.1,0.65,0.0);scale=1.0;angles=vec3(0.035,-0.12,0.045*sin(t*0.35));phase=t*1.23+0.7;}
    else if(id==1) {center=vec3(-3.5,0.85,7.5);scale=0.88;angles=vec3(-0.06,0.42,-0.12);phase=t*1.18+2.6;}
    else if(id==2) {center=vec3(4.25,1.7,10.0);scale=0.85;angles=vec3(0.11,-0.42,0.19);phase=t*1.12+4.3;}
    else if(id==3) {center=vec3(-0.5,1.6,16.5);scale=0.9;angles=vec3(0.03,0.2,0.08);phase=t*1.3+1.7;}
    else {center=vec3(6.3,0.1,20.0);scale=0.8;angles=vec3(0.08,-0.3,-0.15);phase=t*1.19+3.4;}
    center.y+=0.1*sin(phase-0.6); center.x+=0.13*sin(t*0.26+float(id));
}
vec3 objectPoint(vec3 p,vec3 a) {p.xz=turn(a.y)*p.xz;p.yz=turn(a.x)*p.yz;p.xy=turn(a.z)*p.xy;return p;}
vec3 worldVector(vec3 p,vec3 a) {p.xy=turn(-a.z)*p.xy;p.yz=turn(-a.x)*p.yz;p.xz=turn(-a.y)*p.xz;return p;}
float caustic(vec2 p) {
    p+=vec2(0.09,-0.06)*iTime;
    p+=0.25*vec2(sin(p.y*1.7+iTime*0.16),sin(p.x*1.6-iTime*0.19));
    float veins=sin(p.x*2.1+p.y*0.8)+sin(p.y*2.6-p.x*0.7)+0.7*sin((p.x+p.y)*3.4);
    return exp(-8.0*abs(veins))*(0.75+0.25*sin(p.x+p.y));
}
vec3 water(vec3 rd) {
    float up=sat(rd.y*1.4+0.18);
    vec3 c=mix(vec3(0.009,0.075,0.20),vec3(0.055,0.38,0.59),up);
    vec3 sun=normalize(vec3(-0.50,0.92,-0.22));
    float glow=pow(max(dot(rd,sun),0.0),7.0);
    c+=vec3(0.15,0.38,0.47)*glow;
    float shaft=pow(0.5+0.5*sin(13.0*rd.x+7.0*rd.y+0.08*iTime),14.0);
    c+=vec3(0.018,0.045,0.075)*shaft*smoothstep(-0.35,0.6,rd.y);
    return c;
}
vec3 absorb(vec3 c,vec3 rd,float distance) {
    float opticalLength=max(0.0,distance-4.5);
    vec3 trans=exp(-opticalLength*vec3(0.105,0.053,0.029));
    return c*trans+water(rd)*(1.0-trans);
}
vec3 animalColor(vec3 p,vec3 n,vec3 wn,vec3 rd,float phase) {
    float height=p.y-finHeight(p.x,p.z,phase);
    float underside=1.0-smoothstep(-0.035,0.06,height);
    float texture=grain(p*8.0)*0.7+grain(p*17.0)*0.3;
    vec3 top=mix(vec3(0.014,0.044,0.055),vec3(0.043,0.095,0.115),texture);
    float shoulder=exp(-pow((abs(p.x)-0.43)*7.0,2.0)-pow((p.z+0.53)*5.0,2.0));
    top+=vec3(0.095,0.12,0.115)*shoulder;
    float spot=smoothstep(0.72,0.84,grain(p*10.0))*smoothstep(0.2,0.3,abs(p.x))*(1.0-smoothstep(0.5,0.75,abs(p.x)));
    vec3 belly=vec3(0.73,0.79,0.76)*(1.0-spot*0.25);
    // Five curved gill bands on either side of the pale belly.
    float gills=0.0;
    for(int j=0;j<5;j++) {
        float z=-0.52+0.19*float(j)+0.23*pow(abs(p.x)*1.8,2.0);
        gills=max(gills,(1.0-smoothstep(0.011,0.028,abs(p.z-z)))*smoothstep(0.15,0.25,abs(p.x))*(1.0-smoothstep(0.52,0.68,abs(p.x))));
    }
    belly*=1.0-0.64*gills;
    vec3 albedo=mix(top,belly,underside);
    float mouth=(1.0-smoothstep(0.018,0.05,abs(p.y+0.045)))*(1.0-smoothstep(0.0,0.025,abs(p.z+1.035)))*(1.0-smoothstep(0.29,0.36,abs(p.x)));
    albedo=mix(albedo,vec3(0.009,0.018,0.023),mouth);
    float eye=1.0-smoothstep(0.052,0.075,length((vec3(abs(p.x),p.y,p.z)-vec3(0.465,0.105,-0.765))*vec3(1,1.0,0.9)));
    albedo=mix(albedo,vec3(0.003,0.010,0.014),eye);
    vec3 light=normalize(vec3(-0.6,0.95,-0.4));
    float diffuse=max(dot(wn,light),0.0);
    // Directional seabed / water-column fill reveals underside curvature.
    // It is deliberately an artistic two-lobe light model, not a transport claim.
    vec3 fillDirection=normalize(vec3(-0.52,-0.68,-0.57));
    float bounce=max(dot(wn,fillDirection),0.0);
    float side=max(dot(wn,normalize(vec3(0.85,-0.24,0.35))),0.0);
    float hemi=0.5+0.5*wn.y;
    vec3 illumination=mix(vec3(0.12,0.17,0.20),vec3(0.22,0.35,0.41),hemi)
                     +vec3(0.75,0.80,0.75)*bounce+vec3(0.10,0.15,0.18)*side
                     +vec3(0.65,0.88,0.79)*diffuse;
    vec3 c=albedo*illumination;
    float fresnel=pow(1.0-sat(dot(wn,-rd)),3.0);
    c+=vec3(0.10,0.27,0.28)*fresnel*0.6;
    float gloss=pow(max(dot(reflect(-light,wn),-rd),0.0),38.0);
    c+=vec3(0.13,0.18,0.17)*pow(max(dot(reflect(-fillDirection,wn),-rd),0.0),16.0)*(0.25+0.75*underside);
    c+=vec3(0.38,0.67,0.61)*gloss*(0.25+0.65*eye);
    c+=vec3(0.14,0.29,0.26)*caustic(p.xz*2.7)*max(wn.y,0.0);
    return c;
}
void mainImage(out vec4 fragColor,in vec2 fragCoord) {
    vec2 uv=(fragCoord-0.5*iResolution.xy)/iResolution.y;
    vec3 ro=vec3(1.6,-1.25,-6.8);
    vec3 target=vec3(0.1,0.15,2.0);
    vec3 forward=normalize(target-ro),right=normalize(cross(forward,vec3(0,1,0))),up=cross(right,forward);
    vec3 rd=normalize(right*uv.x+up*uv.y+forward*(1.52*min(1.0,(iResolution.x/iResolution.y)/1.50)));
    vec3 color=water(rd);
    float best=FAR_WATER;
    // Bounded plane seabed, with original analytic ripple shading.
    if(rd.y<-0.006) {
        float floorT=(-3.6-ro.y)/rd.y;
        if(floorT>0.0 && floorT<FAR_WATER) {
            vec3 p=ro+rd*floorT;
            float ripple=sin(p.z*5.0+0.7*sin(p.x*0.8));
            vec3 n=normalize(vec3(-0.035*cos(p.x*0.8)*cos(p.z*5.0+0.7*sin(p.x*0.8)),1.0,-0.18*cos(p.z*5.0+0.7*sin(p.x*0.8))));
            float tex=grain(p*vec3(1.7,1.0,1.7));
            vec3 sand=mix(vec3(0.20,0.32,0.27),vec3(0.43,0.47,0.32),tex);
            sand*=0.72+0.23*dot(n,normalize(vec3(-0.6,1,-0.4)))+0.045*ripple;
            sand+=vec3(0.07,0.09,0.055)*caustic(p.xz*0.9);
            // Soft stylized contact-region shadow under the lead animal.
            sand*=1.0-0.38*exp(-pow((p.x+0.1)/2.1,2.0)-pow((p.z-0.7)/1.2,2.0));
            color=absorb(sand,rd,floorT);best=floorT;
        }
    }
    for(int id=0;id<5;id++) {
        vec3 center,angles;float scale,phase;animal(id,center,scale,angles,phase);
        vec3 localRo=objectPoint((ro-center)/scale,angles),localRd=objectPoint(rd,angles);
        vec2 interval=rayBox(localRo,localRd,vec3(-2.67,-0.90,-1.49),vec3(2.67,1.0,3.25));
        float t=max(0.0,interval.x),endT=min(interval.y,best/scale);
        bool hit=false;
        if(endT>t) {
            for(int step=0;step<106;step++) {
                vec3 p=localRo+localRd*t;
                float d=manta(p,phase);
                float epsilon=max(0.0014,t*0.00023);
                if(d<epsilon) {hit=true;break;}
                t+=max(d*0.92,epsilon*0.35);
                if(t>endT)break;
            }
        }
        if(hit && t*scale<best) {
            vec3 p=localRo+localRd*t;
            vec3 n=mantaNormal(p,phase,max(0.002,t*0.0002));
            vec3 wn=worldVector(n,angles);
            color=absorb(animalColor(p,n,wn,rd,phase),rd,t*scale);
            best=t*scale;
        }
    }
    // A restrained layer of drifting suspended particles (procedural only).
    vec2 dust=uv*vec2(71,71)+vec2(iTime*0.07,-iTime*0.055);
    vec2 cell=floor(dust), f=fract(dust)-0.5;
    float seed=hash31(vec3(cell,9.7));
    float speck=(1.0-smoothstep(0.017,0.050,length(f)))*step(0.975,seed);
    color+=vec3(0.11,0.21,0.19)*speck;
    color*=1.0-0.17*dot(uv,uv);
    color=pow(max(color,vec3(0)),vec3(0.86));
    fragColor=vec4(clamp(color,0.0,1.0),1.0);
}
