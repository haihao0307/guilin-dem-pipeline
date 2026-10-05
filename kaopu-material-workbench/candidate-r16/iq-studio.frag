#version 300 es
precision highp float;precision highp int;uniform vec3 iResolution;uniform float iTime;uniform int iFrame;uniform float uIQK,uDisp,uYaw,uPitch,uTone;uniform int uPlanes,uChannel,uMethod;out vec4 fragColor;
uniform vec3 uCameraOrigin,uCameraTarget;uniform float uCameraLens;uniform float uInspectZoom;uniform vec2 uInspectPan;uniform float uFilterStrength;
vec3 studioRay(vec2 pixel){vec3 fw=normalize(uCameraTarget-uCameraOrigin);vec3 rt=normalize(cross(fw,vec3(0.,1.,0.)));vec3 up=normalize(cross(rt,fw));vec2 uv=(2.*pixel-iResolution.xy)/iResolution.y;uv+=uInspectPan;return normalize(rt*uv.x+up*uv.y+fw*uCameraLens*uInspectZoom);}
float studioFootprint(vec3 p){return max(.0001,length(p-uCameraOrigin)/(iResolution.y*uCameraLens*max(uInspectZoom,.35)));}


uniform int uSharedRig;
uniform vec3 uKeyTint,uFillTint;
uniform vec2 uKeyAngles,uFillAngles;
uniform float uKeyPower,uFillPower;
uniform vec3 uBackground;
vec3 rotateLight(vec3 p,vec2 a){if(a.x==0.0&&a.y==0.0)return p;float c=cos(a.x),s=sin(a.x);p.xz=mat2(c,-s,s,c)*p.xz;c=cos(a.y);s=sin(a.y);p.yz=mat2(c,-s,s,c)*p.yz;return p;}

uniform int uShapeSeed,uNoiseSeed;
uniform vec3 uShapeScale;
uniform float uCutStrength;
uniform vec3 uBaseRaw,uMineralLow,uMineralHigh,uPatinaColor,uMicaTint,uGrainColor;
uniform vec4 uLayerOn,uLayerStrength,uLayerScale,uLayerCover,uLayerSeed;
uniform int uSurfaceView,uLook;
uniform float uSpecularScale;

// Created by inigo quilez - iq/2026
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.

// Made for https://youtu.be/6Qb6QtC6QMs

// set to 2 or 3 on powerful computers
#define AA 1


int hash1i1i( int n ) // by Hugo Elias
{
    n = (n<<13)^n;
    return n*(n*n*15731+789221)+1376312589;
}

float hash3i1f( ivec3 p )
{
    int n = hash1i1i( p.x*3 + p.y*113 + p.z*311 );
    return float( n & ivec3(0x0fffffff))/float(0x0fffffff);
}

// https://iquilezles.org/articles/morenoise/
float noise( in vec3 x )
{
    ivec3 i = ivec3(floor(x));
    vec3  f = fract(x);
    f = f*f*(3.0-2.0*f);
    return mix(mix(mix(hash3i1f(i+ivec3(0,0,0)), 
                       hash3i1f(i+ivec3(1,0,0)),f.x),
                   mix(hash3i1f(i+ivec3(0,1,0)), 
                       hash3i1f(i+ivec3(1,1,0)),f.x),f.y),
               mix(mix(hash3i1f(i+ivec3(0,0,1)), 
                       hash3i1f(i+ivec3(1,0,1)),f.x),
                   mix(hash3i1f(i+ivec3(0,1,1)), 
                       hash3i1f(i+ivec3(1,1,1)),f.x),f.y),f.z);
}

// https://iquilezles.org/articles/fbm/
float fbm( in vec3 p, int oct )
{
    const mat3 m = mat3( 0.00,  0.80,  0.60,
                        -0.80,  0.36, -0.48,
                        -0.60, -0.48,  0.64 );
    float f = 0.0;
    float a = 0.5;
    for( int i=0; i<oct; i++ )
    {
        f += a*(2.0*noise(p)-1.0);
        p = m*p*2.01;
        a *= 0.52;
    }
    return f;
}


// Inspection quality is independent from object identity. Extra octave amplitudes do not rewrite the first seven octaves.
uniform int uHD,uAASamples,uRigLook,uInteractive;
uniform float uMicro,uDetailZoom,uSurfaceRough,uSurfaceWet,uMicaDark,uMicaReflect;
float microTail(vec3 p){
 const mat3 m=mat3(0.,.80,.60,-.80,.36,-.48,-.60,-.48,.64);
 float a=.5;for(int j=0;j<7;j++){p=m*p*2.01;a*=.52;}
 float f=0.;for(int j=0;j<3;j++){f+=a*(2.*noise(p)-1.);p=m*p*2.01;a*=.52;}return f;
}

// https://iquilezles.org/articles/intersectors/
vec2 iSphere( in vec3 ro, in vec3 rd, in float rad )
{
	float b = dot( rd, ro );
	float c = dot( ro, ro ) - rad*rad;
	float h = b*b - c;
	if( h<0.0 ) return vec2(-1.0);
	h = sqrt(h);
    return vec2(-b-h,-b+h);
}

//===================================================
// randoms
int   seed = 1;
void  srand(int s) { seed = s; }
int   rand(void) { seed = seed*0x343fd+0x269ec3; return (seed>>16)&32767; } // oldschool rand() from Visual Studio
float frand(void) { return float(rand())/32767.0; }
//===================================================
#define ZERO (min(iFrame,0))

// https://iquilezles.org/articles/smin/
float smax( float a, float b )
{
    float h = uIQK;
    if(h<=0.0||uMethod==0)return max(a,b);
    if(uMethod==1){float w=clamp(.5+.5*(b-a)/h,0.,1.);return mix(a,b,w)+h*w*(1.-w);}
    return (a+b+sqrt((a-b)*(a-b)+h*h))/2.0;
}

vec3 world_to_object( in vec3 p, float time )
{
    float an = 0.04*time-3.2;
    p.xz *= mat2(cos(an),-sin(an),sin(an),cos(an));
    return p;
}

const float kBound = 1.0;
float activeBound(){return (uShapeSeed==0&&uNoiseSeed==0&&all(equal(uShapeScale,vec3(1.0)))&&uCutStrength==1.0)?kBound:1.15*max(uShapeScale.x,max(uShapeScale.y,uShapeScale.z));}

vec2 map( vec3 p, float doDisp, float t )
{
    vec3 q = world_to_object(p,t);
    if(any(notEqual(uShapeScale,vec3(1.0))))q/=uShapeScale;

    // sphere smoohly clipped by planes
    float d = length(q)-kBound;
    const int num = 29;
    for( int i=1; i<num; i++ )
    {
        // random plane
        vec3 rp = vec3(1.4,-1.5,1.3)*sin( float(i)*vec3(63,103,4)+2.0 );
        if(uShapeSeed!=0)rp=vec3(1.4,-1.5,1.3)*sin(float(i)*vec3(63,103,4)+2.0+float(uShapeSeed)*vec3(.71,1.13,.39));
        // distance to plane
        if(i>uPlanes)break;float dp = (dot(q,rp)-1.0)/length(rp);
        if(uCutStrength!=1.0)dp=(dot(q,rp)-uCutStrength)/length(rp);
        d = smax( d, dp );
    }
    
    // displacement
    float dis = 0.0;
    if( doDisp>0.0001 )
    {
        int oct = 7; // fixed geometry spectrum, independent from pixel size
        dis = doDisp*fbm(4.0*q,oct);
        if(uNoiseSeed!=0)dis=doDisp*fbm(4.0*q+vec3(float(uNoiseSeed)*.317,float(uNoiseSeed)*.713,float(uNoiseSeed)*.113),oct);
        if(uHD==1&&uMicro>0.0){vec3 off=uNoiseSeed==0?vec3(0.):vec3(float(uNoiseSeed)*.317,float(uNoiseSeed)*.713,float(uNoiseSeed)*.113);dis+=doDisp*uMicro*microTail(4.*q+off);}
        d += 0.06*uDisp*dis;
    }
    
    return vec2(d*min(uShapeScale.x,min(uShapeScale.y,uShapeScale.z)),dis);
}

// https://iquilezles.org/articles/rmshadows
float shadow( in vec3 ro, in vec3 rd, float k, float time )
{
    // R16: same shadows in every motion state.

    vec2 bb = iSphere( ro, rd, activeBound() );
    float tmax = bb.y;
    float t = 0.001;
    float sh = 1.0;
    for( int i=ZERO; i<256; i++ )
    {
        vec3 pos = ro + rd*t;
        float d = map(pos,1.0,time).x;
        sh = min( sh, clamp(k*d/t,0.0,1.0) );
        if( sh<0.001 ) break;
        t += clamp(d,0.01,0.02);
        if( t>tmax ) break;
    }
    return sh*sh;
}

float map_coarse( vec3 p, float time )
{
    vec3 q = world_to_object(p,time);
    if(any(notEqual(uShapeScale,vec3(1.0))))q/=uShapeScale;
    float d = length(q)-kBound;
    const int num = 29;
    for(int i=1;i<num;i++){
        vec3 rp=vec3(1.4,-1.5,1.3)*sin(float(i)*vec3(63,103,4)+2.0);
        if(uShapeSeed!=0)rp=vec3(1.4,-1.5,1.3)*sin(float(i)*vec3(63,103,4)+2.0+float(uShapeSeed)*vec3(.71,1.13,.39));
        if(i>uPlanes)break;
        float dp=(dot(q,rp)-1.0)/length(rp);
        if(uCutStrength!=1.0)dp=(dot(q,rp)-uCutStrength)/length(rp);
        d=smax(d,dp);
    }
    return d*min(uShapeScale.x,min(uShapeScale.y,uShapeScale.z));
}

vec2 intersect( in vec3 ro, in vec3 rd, float dis, float time )
{
    vec2 res = vec2(-1.0);
    vec2 bs = iSphere( ro, rd, activeBound() ); // bounding volume
    if( bs.y>0.0 )
    {
        float t = max(bs.x,0.0);
        for(int i=ZERO;i<512;i++){
            vec2 h=map(ro+rd*t,dis,time);
            if(abs(h.x)<0.000035){res=vec2(t,h.y);break;}
            t+=0.5*h.x;if(t>bs.y)break;
        }
        if( t>bs.y ) res=vec2(-1.0);
    }
    return res;
}

// https://iquilezles.org/articles/normalsSDF/
vec3 calc_normal( in vec3 pos, float dis, float time )
{
    // do it in a loop to prevet code expansion
    // (inspired by tdhooper and klems)
    vec3 n = vec3(0.0);
    for( int i=ZERO; i<4; i++ )
    {
        vec3 e = 0.5773*(2.0*vec3((((i+3)>>1)&1),((i>>1)&1),(i&1))-1.0);
        n += e*map(pos+max(.0003,studioFootprint(pos)*.22*uFilterStrength)*e,dis,time).x;
    }
    return normalize(n);
}

// https://iquilezles.org/articles/biplanar/


// Constant-color equivalent of the old 1x1 input; retains weighted arithmetic, no sampler.
vec3 constant_gray(float value,vec3 n){
    n=n*n;
    vec3 c=vec3(value);
    return (c*n.x+c*n.y+c*n.z)/(n.x+n.y+n.z);
}
vec3 constant_gray_vec(vec3 value,vec3 n){n=n*n;return (value*n.x+value*n.y+value*n.z)/(n.x+n.y+n.z);}float signedSeedOffset(float seed){return seed==0.0?0.0:seed*2.173;}
vec3 layerOffset(float seed){return vec3(signedSeedOffset(seed),seed*.731,seed*1.217);}

float materialFootprint=0.;
float filteredFbm(vec3 p,int oct,float footprint){const mat3 m=mat3(0.,.8,.6,-.8,.36,-.48,-.6,-.48,.64);float f=0.,a=.5;for(int i=0;i<4;i++){if(i>=oct)break;float attenuation=1.-smoothstep(.24,.7,footprint*uFilterStrength);f+=a*(2.*noise(p)-1.)*attenuation;p=m*p*2.01;footprint*=2.01;a*=.52;}return f;}
float studyMica(vec3 p){
 if(uLayerOn.z<0.5)return 0.0;
 if(uLayerScale.z==32.0&&uLayerCover.z==0.5&&uLayerSeed.z==0.0&&uLayerStrength.z==1.0)
  return smoothstep(-0.15,0.15,filteredFbm(32.0*p,4,32.*materialFootprint)-0.15);
 return smoothstep(-.15,.15,filteredFbm(uLayerScale.z*p+layerOffset(uLayerSeed.z),4,uLayerScale.z*materialFootprint)-(.15+(.5-uLayerCover.z)*.7))*uLayerStrength.z;
}
vec3 layeredBase(vec3 p,vec3 onor,out vec4 masks){
 vec3 albedo=pow(constant_gray_vec(uBaseRaw,onor),vec3(3.0,3.2,3.0));
 masks=vec4(0.0);
 if(uLayerOn.x>0.5){
  float mineral=clamp(.5+.6*filteredFbm(p*uLayerScale.x+layerOffset(uLayerSeed.x),4,uLayerScale.x*materialFootprint),0.,1.);
  if(uLayerCover.x!=.5)mineral=clamp(mineral+(uLayerCover.x-.5),0.,1.);
  masks.x=mineral;
  albedo=mix(albedo,mix(uMineralLow,uMineralHigh,mineral),uLayerStrength.x);
 }
 if(uLayerOn.y>0.5){
  float patina=smoothstep(0.,.5,filteredFbm(p*uLayerScale.y+8.0+layerOffset(uLayerSeed.y),4,uLayerScale.y*materialFootprint)+ (uLayerCover.y-.5)*.8);
  masks.y=patina*uLayerStrength.y;
  albedo=mix(albedo,uPatinaColor,masks.y);
 }
 if(uLayerOn.w>0.5){
  float gr=smoothstep(-.12,.12,filteredFbm(p*uLayerScale.w+layerOffset(uLayerSeed.w),3,uLayerScale.w*materialFootprint)+ (uLayerCover.w-.5)*.8);
  masks.w=gr*uLayerStrength.w;
  albedo=mix(albedo,uGrainColor,masks.w);
 }
 masks.z=studyMica(p);
 return albedo;
}


mat4x4 get_camera_to_world( void )
{
    // camera position and target
    vec3 po = uCameraOrigin;
    vec3 ta = uCameraTarget;

    // camera to world matrix
    vec3 ww = normalize( ta-po );
    vec3 uu = normalize( cross(ww,vec3(0.0,1.0,0.0) ) );
    vec3 vv = normalize( cross(uu,ww));
    return mat4x4(uu,0.0,vv,0.0,ww,0.0,po,1.0);
}

vec3 render( in vec2 p, in float time, in float dof_dis )
{
    // background
	vec2 studioUV=(gl_FragCoord.xy/iResolution.xy-.5);
    float backdropGain=.78+.36*exp(-dot(studioUV*vec2(1.,1.3),studioUV*vec2(1.,1.3))*3.);
    vec3 col=uSharedRig==1?uBackground*backdropGain:vec3(0.);

    // two lights
    vec3 kLigPos[2] = vec3[2](4.0*normalize(vec3(1.0,0.6,0.1)),4.0*normalize(vec3(-1.0,0.3,-0.3)));
    vec3 kLigCol[2] = vec3[2](2.5*vec3(16.0,12.0,8.0),0.7*vec3(8.0,12.0,18.0));
    if((uSharedRig==0&&uLook==1)||(uSharedRig==1&&uRigLook==1)){
       kLigPos[0]=4.0*normalize(vec3(1.0,.8,-.3));kLigPos[1]=4.0*normalize(vec3(-1.0,.5,.45));
       kLigCol[0]=.65*vec3(16.0,12.0,8.0);kLigCol[1]=1.0*vec3(8.0,12.0,18.0);
    }
    if(uSharedRig==1){
       kLigPos[0]=rotateLight(kLigPos[0],uKeyAngles);kLigPos[1]=rotateLight(kLigPos[1],uFillAngles);
       kLigCol[0]*=uKeyTint*uKeyPower;kLigCol[1]*=uFillTint*uFillPower;
    }
    // camera to world transform
    mat4x4 c2w = get_camera_to_world();
    
	// world space ray
    vec3 ro = (c2w*vec4(0.0,0.0,0.0,1.0)).xyz;
    vec3 rd = normalize( (c2w*vec4(p+uInspectPan,uCameraLens*uInspectZoom,0.0)).xyz );

    // depth of field
    #if AA>1
    vec3  fp = ro + dof_dis*rd/dot(c2w[2].xyz,rd);
    float ra = 6.283185*frand();
    ro += 0.01*sqrt(frand())*(c2w[0].xyz*cos(ra)+c2w[1].xyz*sin(ra));
    rd = normalize( fp - ro );
    #endif
    
	// raymarch
    vec2 res = intersect(ro,rd,1.0,time);
    float t = res.x;
    float o = res.y;

    if( t>0.0 )
    {
        // intersection position and normal in world space
        vec3 pos = ro + t*rd;
        vec3 nor = calc_normal(pos,1.0,time);if(uChannel==2)return nor*.5+.5;if(uChannel==1)return pow(vec3(.62)*(.2+.8*max(dot(nor,normalize(vec3(-.6,1.,1.))),0.0)),vec3(.4545));

        // in object space
        vec3 opos = world_to_object(pos,time);
        if(any(notEqual(uShapeScale,vec3(1.0))))opos/=uShapeScale;
        vec3 onor = world_to_object(nor,time);

        // base material color
    vec4 layerMasks;
        materialFootprint=studioFootprint(pos);
        vec3 mate_alb = layeredBase(opos,onor,layerMasks)*uTone;
        float is_mica = layerMasks.z;
        if(uSurfaceView==1)return pow(clamp(mate_alb,0.,1.),vec3(.4545));
        if(uSurfaceView>=2&&uSurfaceView<=5)return vec3(layerMasks[uSurfaceView-2]);
    
        mate_alb *= 1.0-uMicaDark*is_mica;
        if(uSurfaceWet>0.)mate_alb*=mix(1.,.66,uSurfaceWet);
        mate_alb *= mix(vec3(1.0),uMicaTint,is_mica);

        float mate_ks = 0.4 + uMicaReflect*is_mica;

        // illuminate with two spot lights
        col = vec3(0.0);
        for( int i=ZERO; i<2; i++ )
        {
            vec3 lig_pos = kLigPos[i];
            vec3 lig_dir = normalize(lig_pos-pos);

            float dif = dot(nor,lig_dir);
            if( dif<0.0 ) continue;

            // diffuse
            dif *= pow( max(dot(lig_dir,normalize(lig_pos)),0.0 ), 12.0 );
            dif *= 5.0/dot(lig_pos-pos,lig_pos-pos);
            dif *= shadow(pos+nor*0.001, lig_dir, 32.0, time);
            col += mate_alb*dif*kLigCol[i];

            // specular
            vec3  hal = normalize(lig_dir-rd);
            float spe = pow(clamp(dot(nor,hal),0.0,1.0),64.0*mate_ks/uSurfaceRough*(1.+uSurfaceWet));
            spe *= 0.04 + 0.96*pow( clamp(1.0-max(dot(hal,rd),0.0), 0.0, 1.0), 5.0 );
            vec3 rigSpecular = uSharedRig==1 ? (i==0 ? uKeyTint*uKeyPower : uFillTint*uFillPower) : vec3(1.0);
            col += spe*dif*mate_ks*uSpecularScale*rigSpecular;
        }

        // fill shadows with a bounce light
        col += 0.01*mate_alb*(1.0-o)*(0.5-0.5*nor.y);
    }

    // light glare
    if( t<0.0 ) t=5.0;
    for( int i=ZERO; i<2; i++ )
    {
        vec3 lig_pos = kLigPos[i];
        vec3 lig_dir = normalize(lig_pos-ro);
        float dif = pow(max(0.0,dot(rd,lig_dir)),10.0);
        dif *= exp2(t)/dot(lig_pos-ro,lig_pos-ro);
        col += kLigCol[i]*dif*0.0003;
    }

    // gain
    col = col*1.2/(1.0+col);
    // linear to gamma space (proxy for SRGB)
    return pow( col, vec3(0.4545) );
}

// automatically put focal plane at the 
// distance of the closest surface
float get_dof_distance( float time )
{
    // camera to world transform
    mat4x4 c2w = get_camera_to_world();
    
	// ray origin (in world space)
    vec3 ro = (c2w*vec4(0.0,0.0,0.0,1.0)).xyz;

    // automatic focal point
    float dis = 3.0; // max focal length
    const float band = 0.01;
    const int num = 8;
    for( int j=ZERO; j<num; j++ )
    for( int i=ZERO; i<num; i++ )
    {
        // screen space sample
        vec2 p = -1.0+2.0*vec2(i,j)/float(num-1);
        // skip borders
        p *= 0.8; 
        // ray direction
        vec3 rd = normalize( (c2w*vec4(p+uInspectPan,uCameraLens*uInspectZoom,0.0)).xyz );
        // march
        float t = 0.5;
        for( int k=0; k<64 && t<dis; k++ )
        {
            float h = map( ro+rd*t, 0.0, time ).x;
            if( h<band ) // thick ray/capsule
                break;
            t += h;
        }
        dis = min(dis,t);
        if( dis<-10000000.0 ) break;
    }
        
    return dis+band;
}

void mainImage(out vec4 fragColor,in vec2 fragCoord){
 ivec2 q=ivec2(fragCoord);srand(hash1i1i(q.x+hash1i1i(q.y))); // pixel-stable dither
 vec3 col=vec3(0.);int samples=uHD==1?clamp(uAASamples,1,2):1;
 for(int m=0;m<2;m++){if(m>=samples)break;for(int n=0;n<2;n++){if(n>=samples)break;
 vec2 offset=samples==1?vec2(0.):((vec2(float(m),float(n))+.5)/float(samples)-.5);
 vec2 fc=fragCoord+offset;vec2 p=(2.*fc-iResolution.xy)/iResolution.y;
 col+=render(p,iTime,1.0);
 }}col/=float(samples*samples);col+=(1./255.)*frand();fragColor=vec4(col,1.);
}
void main(){mainImage(fragColor,gl_FragCoord.xy);}
