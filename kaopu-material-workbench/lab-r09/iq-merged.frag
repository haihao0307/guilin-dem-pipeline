#version 300 es
precision highp float;precision highp int;uniform vec3 iResolution;uniform float iTime;uniform int iFrame;uniform float uIQK,uDisp,uYaw,uPitch,uTone;uniform int uPlanes,uChannel,uMethod;out vec4 fragColor;

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
        int oct = int(max(6.0,floor(log2(iResolution.x)-2.0)));
        dis = doDisp*fbm(4.0*q,oct);
        if(uNoiseSeed!=0)dis=doDisp*fbm(4.0*q+vec3(float(uNoiseSeed)*.317,float(uNoiseSeed)*.713,float(uNoiseSeed)*.113),oct);
        d += 0.06*uDisp*dis;
    }
    
    return vec2(d*min(uShapeScale.x,min(uShapeScale.y,uShapeScale.z)),dis);
}

// https://iquilezles.org/articles/rmshadows
float shadow( in vec3 ro, in vec3 rd, float k, float time )
{
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

vec2 intersect( in vec3 ro, in vec3 rd, float dis, float time )
{
    vec2 res = vec2(-1.0);
    vec2 bs = iSphere( ro, rd, activeBound() ); // bounding volume
    if( bs.y>0.0 )
    {
        float t = max(bs.x,0.0);
        for( int i=ZERO; i<512; i++ )
        {
            vec2 h = map( ro+rd*t, dis, time );
            if( abs(h.x)<0.0001 )
            {
                res = vec2( t, h.y );
                break;
            }
            t += 0.5*h.x;
            if( t>bs.y ) break;
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
        n += e*map(pos+0.0003*e,dis,time).x;
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
float studyMica(vec3 p){
 if(uLayerOn.z<0.5)return 0.0;
 if(uLayerScale.z==32.0&&uLayerCover.z==0.5&&uLayerSeed.z==0.0&&uLayerStrength.z==1.0)
  return smoothstep(-0.15,0.15,fbm(32.0*p,4)-0.15);
 return smoothstep(-.15,.15,fbm(uLayerScale.z*p+layerOffset(uLayerSeed.z),4)-(.15+(.5-uLayerCover.z)*.7))*uLayerStrength.z;
}
vec3 layeredBase(vec3 p,vec3 onor,out vec4 masks){
 vec3 albedo=pow(constant_gray_vec(uBaseRaw,onor),vec3(3.0,3.2,3.0));
 masks=vec4(0.0);
 if(uLayerOn.x>0.5){
  float mineral=clamp(.5+.6*fbm(p*uLayerScale.x+layerOffset(uLayerSeed.x),4),0.,1.);
  if(uLayerCover.x!=.5)mineral=clamp(mineral+(uLayerCover.x-.5),0.,1.);
  masks.x=mineral;
  albedo=mix(albedo,mix(uMineralLow,uMineralHigh,mineral),uLayerStrength.x);
 }
 if(uLayerOn.y>0.5){
  float patina=smoothstep(0.,.5,fbm(p*uLayerScale.y+8.0+layerOffset(uLayerSeed.y),4)+ (uLayerCover.y-.5)*.8);
  masks.y=patina*uLayerStrength.y;
  albedo=mix(albedo,uPatinaColor,masks.y);
 }
 if(uLayerOn.w>0.5){
  float gr=smoothstep(-.12,.12,fbm(p*uLayerScale.w+layerOffset(uLayerSeed.w),3)+ (uLayerCover.w-.5)*.8);
  masks.w=gr*uLayerStrength.w;
  albedo=mix(albedo,uGrainColor,masks.w);
 }
 masks.z=studyMica(p);
 return albedo;
}


mat4x4 get_camera_to_world( void )
{
    // camera position and target
    vec3 po = vec3(0.0,0.3,1.5);po.yz=mat2(cos(uPitch),-sin(uPitch),sin(uPitch),cos(uPitch))*po.yz;po.xz=mat2(cos(uYaw),-sin(uYaw),sin(uYaw),cos(uYaw))*po.xz;
    const vec3 ta = vec3(0.0,0.0,0.0);

    // camera to world matrix
    vec3 ww = normalize( ta-po );
    vec3 uu = normalize( cross(ww,vec3(0.0,1.0,0.0) ) );
    vec3 vv = normalize( cross(uu,ww));
    return mat4x4(uu,0.0,vv,0.0,ww,0.0,po,1.0);
}

vec3 render( in vec2 p, in float time, in float dof_dis )
{
    // background
	vec3 col = uSharedRig==1?uBackground:vec3(0.0,0.0,0.0);

    // two lights
    vec3 kLigPos[2] = vec3[2](4.0*normalize(vec3(1.0,0.6,0.1)),4.0*normalize(vec3(-1.0,0.3,-0.3)));
    vec3 kLigCol[2] = vec3[2](2.5*vec3(16.0,12.0,8.0),0.7*vec3(8.0,12.0,18.0));
    if(uSharedRig==0&&uLook==1){
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
    vec3 rd = normalize( (c2w*vec4(p,1.7,0.0)).xyz );

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
        vec3 mate_alb = layeredBase(opos,onor,layerMasks)*uTone;
        float is_mica = layerMasks.z;
        if(uSurfaceView==1)return pow(clamp(mate_alb,0.,1.),vec3(.4545));
        if(uSurfaceView>=2&&uSurfaceView<=5)return vec3(layerMasks[uSurfaceView-2]);
    
        mate_alb *= 1.0-0.9*is_mica;
        mate_alb *= mix(vec3(1.0),uMicaTint,is_mica);

        float mate_ks = 0.4 + 1.1*is_mica;

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
            float spe = pow(clamp(dot(nor,hal),0.0,1.0),64.0*mate_ks);
            spe *= 0.04 + 0.96*pow( clamp(1.0-max(dot(hal,rd),0.0), 0.0, 1.0), 5.0 );
            col += spe*dif*mate_ks*uSpecularScale;
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
        vec3 rd = normalize( (c2w*vec4(p,1.7,0.0)).xyz );
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

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    // init random seed
    ivec2 q = ivec2(fragCoord);
    srand(hash1i1i(q.x+hash1i1i(q.y+hash1i1i(iFrame))));
 
    // compute automatic focus distance
    float dof_dis = get_dof_distance( iTime + 0.5 * 0.5/60.0 );
    
    // supersample pixel
    vec3 col = vec3(0.0);
    for( int m=ZERO; m<AA; m++ )
    for( int n=ZERO; n<AA; n++ )
    {
        vec2 fc = fragCoord + vec2(float(m),float(n))/float(AA);
        #if AA>1
        float time = iTime + frand()*0.5/60.0; // motion blur
        #else
        float time = iTime;
        #endif
        vec2 p = (2.0*fc-iResolution.xy)/iResolution.y;
    	col += render( p, time, dof_dis );
        if( col.x>1000.0 ) break;
    }
    col /= float(AA*AA);

    // remove color banding through dithering
    col += (1.0/255.0)*frand();

    fragColor = vec4( col, 1.0 );
}
void main(){mainImage(fragColor,gl_FragCoord.xy);}