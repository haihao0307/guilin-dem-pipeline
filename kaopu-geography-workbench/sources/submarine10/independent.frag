// Case 10: Pelagic Survey / independently authored for the user's project.
// No teacher shader, textures, sampled media, or third-party scene assets.
// General mathematical primitives: ellipsoid distance estimates, capsule distance,
// smooth interpolation, integer recurrence hashing and numerical ray integration.
// The arrangement and scene are original; numerical methods are not claimed novel.
#define FAR 36.0
const vec3 SKY = vec3(0.023,0.18,0.218);
vec3 craftPos; mat2 craftYaw; vec3 lampPos, lampDir;
mat2 rot(float a){float s=sin(a),c=cos(a);return mat2(c,-s,s,c);}
uint spinBits(uint v,uint k){return (v<<k)|(v>>(32u-k));}
float cellValue(ivec3 p){
    uint a=uint(p.x)*65537u;
    a+=spinBits(uint(p.y)*16777619u,9u);
    a^=spinBits(uint(p.z)*104729u,21u);
    a=(a^(a>>11u))*1664525u+1013904223u;
    a=(a^(a>>17u))*22695477u+1u;
    a^=spinBits(a,7u)^(a>>13u);
    return float(a>>8u)*(1.0/16777216.0);
}
float field(vec3 p){
    ivec3 c=ivec3(floor(p)); vec3 f=fract(p); f=f*f*(3.0-2.0*f);
    float a=mix(cellValue(c),cellValue(c+ivec3(1,0,0)),f.x);
    float b=mix(cellValue(c+ivec3(0,1,0)),cellValue(c+ivec3(1,1,0)),f.x);
    float d=mix(cellValue(c+ivec3(0,0,1)),cellValue(c+ivec3(1,0,1)),f.x);
    float e=mix(cellValue(c+ivec3(0,1,1)),cellValue(c+ivec3(1,1,1)),f.x);
    return mix(mix(a,b,f.y),mix(d,e,f.y),f.z);
}
float oval(vec3 p,vec3 r){float a=length(p/r),b=length(p/(r*r));return a<.0001?-min(r.x,min(r.y,r.z)):a*(a-1.0)/max(b,0.0001);}
float box(vec3 p,vec3 b,float r){vec3 q=abs(p)-b;return length(max(q,0.0))+min(max(q.x,max(q.y,q.z)),0.0)-r;}
float rod(vec3 p,vec3 a,vec3 b,float r){vec3 d=b-a;return length(p-a-d*clamp(dot(p-a,d)/dot(d,d),0.0,1.0))-r;}
vec2 choose(vec2 a,vec2 b){return a.x<b.x?a:b;}
float blend(float a,float b,float k){float h=max(k-abs(a-b),0.0)/k;return min(a,b)-h*h*k*.25;}
vec3 localCraft(vec3 p){vec3 q=p-craftPos;q.xz=craftYaw*q.xz;return q;}
vec3 worldCraft(vec3 p){p.xz=transpose(craftYaw)*p.xz;return p+craftPos;}
float rock(vec3 p){
    // Broad connected masses: an undulating floor and two offset buttress
    // chains, sharing the same small-scale relief.
    float floorY=-2.13+.20*sin(p.z*.31)+.11*sin(p.x*.83+p.z*.18);
    float d=(p.y-floorY)*.82;
    for(int side=0;side<2;side++){
        float s=side==0?-1.0:1.0;
        float shift=side==0?0.0:4.3;
        float cell=floor((p.z+shift)/9.2);
        for(int neighbor=-1;neighbor<=1;neighbor++){
            float z=(cell+float(neighbor)+.5)*9.2-shift;
            float bend=.65*sin(z*.17);
            vec3 q=p-vec3(s*(8.4+bend),1.15,z);
            q.xy=rot(s*.18)*q.xy;
            d=blend(d,oval(q,vec3(2.95,4.3,5.5)),.64);
            vec3 q2=p-vec3(s*(7.05+bend),-.55,z+3.0);
            q2.xy=rot(-s*.2)*q2.xy;
            d=blend(d,oval(q2,vec3(1.80,2.55,3.45)),.4);
        }
    }
    float relief=(field(p*vec3(.8,1.5,.75))-.5)*.43;
    relief+=(field(p*vec3(1.8,3.6,1.7))-.5)*.16;
    relief+=(field(p*vec3(3.5,4.5,3.3))-.5)*.060;
    return (d+relief)*.74;
}
vec2 vehicle(vec3 q){
    float hull=max(oval(q-vec3(0,0,-.06),vec3(.71,.60,1.66)),q.z-1.18);
    vec2 h=vec2(hull,2.0);
    // Continuous smoked glass nose and its machined oval pressure collar.
    h=choose(h,vec2(oval(q-vec3(0,.025,1.17),vec3(.50,.405,.47)),4.0));
    vec3 a=q-vec3(0,.02,1.16);
    float ring=length(vec2(length(vec2(a.x,a.y/0.81))-.506,a.z))-.048;
    h=choose(h,vec2(ring*.81,3.0));
    // Tapered, swept, genuinely thick dive planes.
    float span=clamp((abs(q.x)-.48)/1.06,0.0,1.0);
    a=vec3(abs(q.x)-.95,q.y+.04,q.z+.48+.22*span);
    h=choose(h,vec2(box(a,vec3(.60,.045,.32-.14*span),.035),2.0));
    a=q-vec3(0,.68,-1.10); a.yz=rot(.30)*a.yz;
    h=choose(h,vec2(box(a,vec3(.047,.37,.23),.040),2.0));
    // Shrouded aft propulsor with hub and rotating crossed blades.
    a=q-vec3(0,0,-1.80);
    h=choose(h,vec2(length(vec2(length(a.xy)-.34,a.z))-.085,3.0));
    h=choose(h,vec2(oval(q-vec3(0,0,-1.64),vec3(.20,.20,.32)),3.0));
    a=q-vec3(0,0,-1.84); a.xy=rot(iTime*9.0)*a.xy;
    h=choose(h,vec2(min(box(a,vec3(.31,.040,.033),.014),box(a,vec3(.040,.31,.033),.014)),3.0));
    // Bottom instrument rails and load-bearing braces.
    a=vec3(abs(q.x),q.y,q.z);
    h=choose(h,vec2(rod(a,vec3(.40,-.70,-.84),vec3(.40,-.70,.64),.044),3.0));
    h=choose(h,vec2(rod(a,vec3(.40,-.43,-.58),vec3(.40,-.69,-.58),.037),3.0));
    h=choose(h,vec2(rod(a,vec3(.40,-.42,.45),vec3(.40,-.69,.45),.037),3.0));
    // Navigation mast, sensor pod, and a recessed optical port on each cheek.
    h=choose(h,vec2(rod(q,vec3(0,.51,-.35),vec3(0,.85,-.38),.044),3.0));
    h=choose(h,vec2(box(q-vec3(0,.87,-.40),vec3(.17,.065,.17),.035),3.0));
    h=choose(h,vec2(oval(q-vec3(0,-.425,1.26),vec3(.19,.16,.20)),3.0));
    h=choose(h,vec2(oval(q-vec3(0,-.43,1.425),vec3(.126,.103,.045)),5.0));
    h=choose(h,vec2(oval(vec3(abs(q.x)-.565,q.y-.17,q.z-.59),vec3(.064,.092,.16)),4.0));
    h=choose(h,vec2(length(q-vec3(-1.43,.008,-.79))-.042,7.0));
    h=choose(h,vec2(length(q-vec3(1.43,.008,-.79))-.042,6.0));
    return h;
}
vec2 scene(vec3 p){
    vec2 h=vec2(rock(p),1.0);vec3 q=localCraft(p);
    float bound=length(q)-2.28;
    if(bound<h.x) h=choose(h,vehicle(q));
    return h;
}
vec3 normalAt(vec3 p){
    vec2 e=vec2(.0035,0);
    return normalize(vec3(scene(p+e.xyy).x-scene(p-e.xyy).x,scene(p+e.yxy).x-scene(p-e.yxy).x,scene(p+e.yyx).x-scene(p-e.yyx).x));
}
float softShade(vec3 p,vec3 l){
    float t=.07,s=1.0;
    for(int j=0;j<14;j++){
        float d=rock(p+l*t);s=min(s,6.0*d/t);t+=clamp(d,.12,.55);
        if(s<.03)break;
    }
    return clamp(s,.06,1.0);
}
float beamAt(vec3 p){
    vec3 d=p-lampPos;float l=max(length(d),.0001);float c=dot(d/l,lampDir);
    return smoothstep(.940,.982,c)*smoothstep(0.05,.38,l)*exp(-l*.085)/(1.0+.055*l*l);
}
vec3 surface(vec3 p,vec3 n,vec3 rd,float material){
    vec3 q=localCraft(p),base;float rough=.65;
    if(material<1.5){
        float patches=field(p*vec3(.45,.8,.37));
        float layers=.5+.5*sin(p.y*10.0+1.9*sin(p.z*.57)+field(p*.85)*3.0);
        base=mix(vec3(.026,.052,.058),vec3(.17,.195,.165),patches);
        base*=.78+.22*layers;
        float fractures=smoothstep(.63,.80,field(p*vec3(4.1,6.4,4.4)));
        base*=1.0-fractures*.25;
    }else if(material<2.5){
        base=vec3(.98,.47,.036);
        float seams=1.0-smoothstep(.012,.024,min(abs(q.z+.52),abs(q.z-.70)));
        seams*=1.0-smoothstep(.73,.85,abs(q.x));base=mix(base,vec3(.12,.14,.105),seams*.7);
        // A small white survey stripe follows the nose, rather than flat decals.
        float stripe=(1.0-smoothstep(.052,.070,abs(q.z-.96)))*smoothstep(.02,.18,q.y);
        base=mix(base,vec3(.7,.79,.68),stripe*.9);rough=.31;
    }else if(material<3.5){base=vec3(.10,.16,.175);rough=.26;}
    else if(material<4.5){base=vec3(.018,.10,.13);rough=.105;}
    else if(material<5.5){return vec3(2.5,2.9,2.32);}
    else if(material<6.5){return vec3(1.1,.045,.017);}
    else{return vec3(.025,.8,.33);}
    vec3 sun=normalize(vec3(-.45,.84,.25));
    float sunN=max(dot(n,sun),0.0);
    float sh=softShade(p+n*.04,sun);
    float occ=1.0;
    for(int k=1;k<=3;k++){float s=float(k)*.18;occ-=max(s-scene(p+n*s).x,0.0)*(.21/float(k));}
    occ=clamp(occ,.35,1.0);
    vec3 illumination=vec3(.032,.077,.096)*(0.52+.48*n.y);
    illumination+=vec3(1.05,.98,.78)*sunN*(material>1.5?(.30+.70*sh):sh);
    // Directional seabed bounce models volume on the underside, with weaker far side.
    illumination+=vec3(.18,.15,.085)*max(dot(n,normalize(vec3(-.35,-.88,.3))),0.0);
    vec3 toLamp=lampPos-p;float dl=length(toLamp);vec3 ll=toLamp/max(dl,.001);
    float spot=beamAt(p)*max(dot(n,ll),0.0);
    illumination+=vec3(2.5,2.8,1.85)*spot;
    if(material>1.5) illumination+=vec3(.065,.065,.055)*max(dot(n,normalize(vec3(-.8,.1,.4))),0.0);
    // Caustics have their own broad wave bands and only touch upward rock faces.
    float wave=sin(p.x*2.25+p.z*.83+iTime*.49)+sin(p.z*2.31-p.x*.56-iTime*.37);
    float caustic=pow(max(0.0,1.0-abs(wave)*1.2),7.0);
    if(material<1.5)illumination+=vec3(.12,.24,.17)*caustic*max(n.y,0.0)*sh;
    vec3 color=base*illumination*occ;
    vec3 halfSun=normalize(sun-rd);float spec=pow(max(dot(n,halfSun),0.0),mix(16.,145.,1.0-rough));
    color+=vec3(.5,.9,.85)*spec*sh*(material<1.5?.1:.55);
    vec3 halfLamp=normalize(ll-rd);
    color+=vec3(1.,1.,.73)*pow(max(dot(n,halfLamp),0.0),52.)*spot*.6;
    if(material>3.5&&material<4.5){
        float facing=max(dot(n,-rd),0.0);
        float fres=pow(1.0-facing,3.6);
        vec3 reflection=reflect(rd,n);
        // Tinted optical depth with a recessed inner rim; the broad surface
        // reflection lives on the grazing edge instead of filling the dome.
        float radial=length((q.xy-vec2(0,.025))/vec2(.50,.405));
        float innerRing=1.0-smoothstep(.023,.065,abs(radial-.54));
        float interior=(.26+.74*smoothstep(-.28,.36,q.y))*facing;
        color=vec3(.002,.010,.015)+vec3(.004,.027,.035)*interior;
        color+=vec3(.012,.054,.061)*innerRing*facing*.65;
        color+=vec3(.14,.39,.44)*fres*(.38+.62*smoothstep(-.05,.72,reflection.y));
        float skyStripe=pow(max(dot(reflection,normalize(vec3(-.5,.78,.29))),0.0),110.);
        color+=vec3(.58,.83,.8)*skyStripe*.68;
        color+=vec3(.038,.12,.13)*pow(1.0-facing,1.2)*smoothstep(.45,.86,radial);
    }
    return color;
}
void mainImage(out vec4 fragColor,in vec2 fragCoord){
    float t=iTime;
    float travelPhase=t*.52-.15;
    craftPos=vec3(1.5*cos(travelPhase),.08+.13*sin(t*.37),2.0+t*.40);
    // Heading follows the derivative of this independently arranged survey path.
    craftYaw=rot(atan(.78*sin(travelPhase),.40));
    lampPos=worldCraft(vec3(0,-.43,1.49));
    vec3 aim=normalize(vec3(.30*sin(t*.43),-.22+.11*sin(t*.29),1.));
    aim.xz=transpose(craftYaw)*aim.xz;lampDir=aim;
    vec3 ro=vec3(-4.3,craftPos.y+1.60,craftPos.z-4.2);
    vec3 target=craftPos+vec3(0.,-.12,3.8);
    vec3 f=normalize(target-ro),r=normalize(cross(f,vec3(0,1,0))),u=cross(r,f);
    vec2 uv=(fragCoord-.5*iResolution.xy)/iResolution.y;
    float aspect=iResolution.x/iResolution.y;
    float lens=1.20*min(1.,aspect/1.58);
    vec3 rd=normalize(f*lens+r*uv.x+u*uv.y);
    float distance=0.;vec2 hit=vec2(0);bool found=false;
    for(int j=0;j<144;j++){
        hit=scene(ro+rd*distance);
        if(hit.x<.002+.00038*distance){found=true;break;}
        if(distance>FAR)break;
        distance+=max(.004,hit.x*.81);
    }
    distance=found?min(distance,FAR):FAR;
    vec3 p=ro+rd*distance;
    float opening=pow(max(dot(rd,normalize(vec3(.0,.32,1.))),0.0),3.0);
    vec3 water=mix(vec3(.005,.022,.032),SKY,clamp(rd.y*.85+.27+opening*.85,0.,1.));
    vec3 color=water;
    if(distance<FAR-.01){
        vec3 n=normalAt(p);color=surface(p,n,rd,hit.y);
        vec3 absorption=hit.y>1.5?vec3(.026,.025,.023):vec3(.083,.048,.034);
        vec3 transmission=exp(-distance*absorption);
        color=color*transmission+water*(1.0-transmission);
    }
    // Single scattering, integrated along the eye ray, terminates at the surface.
    float integral=0.;
    for(int j=0;j<22;j++){
        float s=(float(j)+.5)/22.0*distance;
        vec3 samplePoint=ro+rd*s;
        integral+=beamAt(samplePoint)*exp(-s*.045)*distance/22.;
    }
    color+=vec3(.42,.56,.38)*integral*.43;
    // Sparse motes are evaluated in different world cells from the rock relief.
    float dust=0.;
    for(int j=0;j<13;j++){
        float s=(float(j)+.35)/13.*min(distance,18.0);
        vec3 w=ro+rd*s+vec3(t*.018,t*.012,0);
        ivec3 cell=ivec3(floor(w*1.6));vec3 fcell=fract(w*1.6)-.5;
        float seed=cellValue(cell+ivec3(127,41,-89));
        vec3 offset=vec3(seed-.5,cellValue(cell+ivec3(11,25,6))-.5,cellValue(cell+ivec3(12,26,8))-.5)*.65;
        float mote=exp(-dot(fcell-offset,fcell-offset)*1600.);
        dust+=mote*step(.66,seed)*(.20+beamAt(w))*exp(-s*.07);
    }
    color+=vec3(.39,.6,.51)*dust*.35;
    vec3 ll=lampPos-ro;float along=dot(ll,rd);float closest=length(ll-rd*along);
    if(along>0.&&along<distance+.2)color+=vec3(.55,.73,.44)*exp(-closest*closest*32.)*.35;
    float vignette=1.0-.19*dot(uv,uv);
    color=max(color*vignette,0.);
    color=1.-exp(-color*1.45);
    color=pow(color,vec3(.4545));
    fragColor=vec4(color,1.);
}
