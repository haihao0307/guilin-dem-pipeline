#version 300 es
/* KAOPU R16 unified studio layer: inherited KAOPU R04 GGX material functions, CC BY-NC-SA 3.0; TDM Wet stone (Alexander Alekseev, 2014) attribution retained. Teacher geometry below remains MIT as noted in its header. */
precision highp float;precision highp int;uniform vec3 iResolution;uniform float iTime;uniform int iFrame;out vec4 outputColor;
#define HW_PERFORMANCE 0

uniform vec3 uCameraOrigin,uCameraTarget;uniform float uCameraLens;uniform float uInspectZoom;uniform vec2 uInspectPan;uniform float uFilterStrength;
vec3 studioRay(vec2 pixel){vec3 fw=normalize(uCameraTarget-uCameraOrigin);vec3 rt=normalize(cross(fw,vec3(0.,1.,0.)));vec3 up=normalize(cross(rt,fw));vec2 uv=(2.*pixel-iResolution.xy)/iResolution.y;uv+=uInspectPan;return normalize(rt*uv.x+up*uv.y+fw*uCameraLens*uInspectZoom);}
float studioFootprint(vec3 p){return max(.0001,length(p-uCameraOrigin)/(iResolution.y*uCameraLens*max(uInspectZoom,.35)));}
// The MIT License
// Copyright © 2019 Inigo Quilez
// Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions: The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software. THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.


// This shader uses a a grid of spheres to carve out fractal detail from
// a solid block. Unlike naive SDF disaplcemente by a traditional fBM,
// this shader produces a field that is a valid SDF, so there's no need
// to reduce the raymarcher's step size to get artifact free visuals.
//
// The article that explains this technique can be found here:
//
//     https://iquilezles.org/articles/fbmsdf
//
// A additive synthesis example of this technique, here: 
//
//     https://www.shadertoy.com/view/3dGSWR






// 0 = lattice
// 1 = simplex
#define NOISE 0


// please, do not use in real projects - replace this by something better
float hash(vec3 p)  
{
    p  = 17.0*fract( p*0.3183099+vec3(.11,.17,.13) );
    return fract( p.x*p.y*p.z*(p.x+p.y+p.z) );
}

// https://iquilezles.org/articles/distfunctions
float sdBox( vec3 p, vec3 b )
{
    vec3 d = abs(p) - b;
    return min(max(d.x,max(d.y,d.z)),0.0) + length(max(d,0.0));
}

// https://iquilezles.org/articles/smin
float smax( float a, float b, float k )
{
    float h = max(k-abs(a-b),0.0);
    return max(a, b) + h*h*0.25/k;
}

// https://iquilezles.org/articles/boxfunctions
vec2 iBox( in vec3 ro, in vec3 rd, in vec3 rad ) 
{
    vec3 m = 1.0/rd;
    vec3 n = m*ro;
    vec3 k = abs(m)*rad;
    vec3 t1 = -n - k;
    vec3 t2 = -n + k;
	float tN = max( max( t1.x, t1.y ), t1.z );
	float tF = min( min( t2.x, t2.y ), t2.z );
	if( tN > tF || tF < 0.0) return vec2(-1.0);
	return vec2( tN, tF );
}

//---------------------------------------------------------------
// A random SDF - it places spheres of random sizes in a grid
//---------------------------------------------------------------

float sdBase( in vec3 p )
{
#if NOISE==0
    vec3 i = floor(p);
    vec3 f = fract(p);

	#define RAD(r) ((r)*(r)*0.7)
    #define SPH(i,f,c) length(f-c)-RAD(hash(i+c))
    
    return min(min(min(SPH(i,f,vec3(0,0,0)),
                       SPH(i,f,vec3(0,0,1))),
                   min(SPH(i,f,vec3(0,1,0)),
                       SPH(i,f,vec3(0,1,1)))),
               min(min(SPH(i,f,vec3(1,0,0)),
                       SPH(i,f,vec3(1,0,1))),
                   min(SPH(i,f,vec3(1,1,0)),
                       SPH(i,f,vec3(1,1,1)))));
#else
    const float K1 = 0.333333333;
    const float K2 = 0.166666667;
    
    vec3 i = floor(p + (p.x + p.y + p.z) * K1);
    vec3 d0 = p - (i - (i.x + i.y + i.z) * K2);
    
    vec3 e = step(d0.yzx, d0);
	vec3 i1 = e*(1.0-e.zxy);
	vec3 i2 = 1.0-e.zxy*(1.0-e);
    
    vec3 d1 = d0 - (i1  - 1.0*K2);
    vec3 d2 = d0 - (i2  - 2.0*K2);
    vec3 d3 = d0 - (1.0 - 3.0*K2);
    
    float r0 = hash( i+0.0 );
    float r1 = hash( i+i1 );
    float r2 = hash( i+i2 );
    float r3 = hash( i+1.0 );

    #define SPH(d,r) length(d)-r*r*0.55

    return min( min(SPH(d0,r0),
                    SPH(d1,r1)),
                min(SPH(d2,r2),
                    SPH(d3,r3)));
#endif
}

//---------------------------------------------------------------
// subtractive fbm
//---------------------------------------------------------------
vec2 sdFbm( in vec3 p, float d )
{
    const mat3 m = mat3( 0.00,  0.80,  0.60, 
                        -0.80,  0.36, -0.48,
                        -0.60, -0.48,  0.64 );
    float t = 0.0;
	float s = 1.0;
    for( int i=0; i<7; i++ )
    {
        float n = s*sdBase(p);
    	d = smax( d, -n, 0.15*s );
        t += d;
        p = 2.0*m*p;
        s = 0.55*s;
    }
    
    return vec2(d,t);
}

vec2 map( in vec3 p )
{
    // box
    float d = sdBox( p, vec3(1.0) );

    // fbm
    vec2 dt = sdFbm( p+0.5, d );

    dt.y = 1.0+dt.y*2.0; dt.y = dt.y*dt.y;
    
    return dt;
}

const float precis = 0.0005;

vec2 raycast( in vec3 ro, in vec3 rd )
{
	vec2 res = vec2(-1.0);

    // bounding volume    
    vec2 dis = iBox( ro, rd, vec3(1.0) ) ;
    if( dis.y<0.0 ) return res;

    // raymarch
    float t = dis.x;
	for( int i=0; i<256; i++ )
	{
        vec3 pos = ro + t*rd;
		vec2 h = map( pos );
        res.x = t;
        res.y = h.y;
        
		if( h.x<precis || t>dis.y ) break;
		t += h.x;
	}

	if( t>dis.y ) res = vec2(-1.0);
	return res;
}

// https://iquilezles.org/articles/normalsSDF
vec3 calcNormal( in vec3 pos )
{
    vec2 e = vec2(1.0,-1.0)*0.5773*precis;
    return normalize( e.xyy*map( pos + e.xyy ).x + 
					  e.yyx*map( pos + e.yyx ).x + 
					  e.yxy*map( pos + e.yxy ).x + 
					  e.xxx*map( pos + e.xxx ).x );
}

// https://iquilezles.org/articles/rmshadows
float calcSoftShadow(vec3 ro, vec3 rd, float tmin, float tmax, float w)
{
    // bounding volume    
    vec2 dis = iBox( ro, rd, vec3(1.0) ) ;
    if( dis.y<0.0 ) return 1.0;
    
    tmin = max(tmin,dis.x);
	tmax = min(tmax,dis.y);
    
    float t = tmin;
    float res = 1.0;
    for( int i=0; i<128; i++ )
    {
     	float h = map(ro + t*rd).x;
        res = min( res, h/(w*t) );
    	t += clamp(h, 0.005, 0.50);
        if( res<-1.0 || t>tmax ) break;
    }
    res = max(res,-1.0); // clamp to [-1,1]

    return 0.25*(1.0+res)*(1.0+res)*(2.0-res); // smoothstep
}

#if HW_PERFORMANCE==0
#define AA 1
#else
#define AA 1   // make this 2 or 3 for antialiasing
#endif

#define ZERO min(iFrame,0)


vec2 studioHit(vec3 ro,vec3 rd){vec2 h=raycast(ro,rd);return vec2(h.x,clamp(h.y*h.y,0.,1.));}
vec3 studioNormal(vec3 p){float e=max(precis,studioFootprint(p)*.3*uFilterStrength);vec2 v=vec2(1.,-1.)*.5773*e;return normalize(v.xyy*map(p+v.xyy).x+v.yyx*map(p+v.yyx).x+v.yxy*map(p+v.yxy).x+v.xxx*map(p+v.xxx).x);}
float studioShadow(vec3 p,vec3 n,vec3 l,float distanceToLight){return calcSoftShadow(p+n*.002,l,.002,distanceToLight,.012);}

uniform int uAASamples,uView;uniform vec3 uBase,uGrain;uniform float uRoughness,uWet,uMoss,uLichen,uCrack,uCrackScale,uSeed,uExposure,uSpecular,uCavity;
uniform vec3 uKeyTint,uFillTint,uBackground;uniform vec2 uKeyAngles,uFillAngles;uniform float uKeyPower,uFillPower;
const float KP_PI=3.14159265359;
struct SurfaceSample{vec3 baseColor;float roughness;float metallic;float occlusion;float coat;float coatRoughness;float crack;float moss;float lichen;float height;};
float sat(float x){return clamp(x,0.,1.);}
vec3 rotateLight(vec3 p,vec2 a){float c=cos(a.x),s=sin(a.x);p.xz=mat2(c,-s,s,c)*p.xz;c=cos(a.y);s=sin(a.y);p.yz=mat2(c,-s,s,c)*p.yz;return p;}
float studioNoise(vec3 p){vec3 q=floor(p),f=fract(p);f=f*f*(3.-2.*f);float result=0.;for(int z=0;z<2;z++)for(int y=0;y<2;y++)for(int x=0;x<2;x++){vec3 a=vec3(x,y,z);uvec3 cell=uvec3(ivec3(q+a));uint h=(cell.x*1597334677u)^(cell.y*3812015801u)^(cell.z*2798796415u);h^=h>>16;h*=2246822519u;h^=h>>13;float v=float(h&65535u)/65535.;vec3 w=mix(1.-f,f,a);result+=v*w.x*w.y*w.z;}return result;}
SurfaceSample studioMaterial(vec3 p,vec3 n,float cavity){SurfaceSample m;float v=studioNoise(p*5.+uSeed),grain=studioNoise(p*16.+uSeed*2.);float moss=uMoss*smoothstep(.35,.75,v)*smoothstep(-.3,.7,n.y);float lichen=uLichen*smoothstep(.4,.67,studioNoise(p*9.-uSeed));float crack=uCrack*(1.-smoothstep(.04,.12,abs(studioNoise(p*uCrackScale*8.+uSeed)-.5)));m.baseColor=mix(uBase,uGrain,.2+.3*grain);m.baseColor*=mix(1.,.55,uWet);m.baseColor*=1.-.5*crack;m.baseColor=mix(m.baseColor,vec3(.05,.10,.025),moss);m.baseColor=mix(m.baseColor,vec3(.35,.39,.22),lichen);m.roughness=mix(clamp(uRoughness,.16,.98),max(.16,uRoughness*.55),uWet);m.metallic=0.;m.occlusion=mix(1.,clamp(cavity,.08,1.),uCavity);m.coat=uWet*(1.-moss);m.coatRoughness=.22;m.crack=crack;m.moss=moss;m.lichen=lichen;m.height=0.;return m;}
vec3 fresnelSchlick(float hv,vec3 f0){return f0+(1.0-f0)*pow(1.0-hv,5.0);}
float Dggx(float nh,float alpha){float a2=alpha*alpha;float d=nh*nh*(a2-1.0)+1.0;return a2/max(KP_PI*d*d,1e-6);}
float Vsmith(float nv,float nl,float alpha){float a2=alpha*alpha;return .5/max(nl*sqrt(nv*nv*(1.0-a2)+a2)+nv*sqrt(nl*nl*(1.0-a2)+a2),1e-5);}
vec3 lightBRDF(SurfaceSample m,vec3 n,vec3 v,vec3 l,vec3 radiance){
 float nv=max(dot(n,v),.001),nl=max(dot(n,l),0.0);vec3 h=normalize(v+l);float nh=max(dot(n,h),0.0),hv=max(dot(h,v),0.0);
 vec3 F=fresnelSchlick(hv,mix(vec3(.04),m.baseColor,m.metallic));float a=m.roughness*m.roughness;
 vec3 spec=Dggx(nh,a)*Vsmith(nv,nl,a)*F*uSpecular;
 vec3 diff=(1.0-F)*(1.0-m.metallic)*m.baseColor/KP_PI;
 // Water-like thin coat, IOR 1.333 gives F0 about 0.0204; attenuate underlying layer.
 float Fc=.0204+.9796*pow(1.0-hv,5.0);
 float coat=Dggx(nh,m.coatRoughness*m.coatRoughness)*Vsmith(nv,nl,m.coatRoughness*m.coatRoughness)*Fc;
 return ((diff+spec)*(1.0-m.coat*Fc)+vec3(coat*m.coat))*radiance*nl;
}

vec3 studioShade(SurfaceSample m,vec3 pos,vec3 nor,vec3 view){vec3 lpos[2]=vec3[2](4.*normalize(vec3(1.,.6,.1)),4.*normalize(vec3(-1.,.3,-.3)));vec3 rad[2]=vec3[2](2.5*vec3(16.,12.,8.),.7*vec3(8.,12.,18.));lpos[0]=rotateLight(lpos[0],uKeyAngles);lpos[1]=rotateLight(lpos[1],uFillAngles);rad[0]*=uKeyTint*uKeyPower;rad[1]*=uFillTint*uFillPower;vec3 col=vec3(0.);for(int i=0;i<2;i++){vec3 ld=lpos[i]-pos,l=normalize(ld);float spot=pow(max(dot(l,normalize(lpos[i])),0.),12.)*5./dot(ld,ld);col+=lightBRDF(m,nor,view,l,rad[i]*spot)*studioShadow(pos,nor,l,length(ld));}col+=.05*m.baseColor*m.occlusion*(.35+.65*max(nor.y,0.));return col*m.occlusion*uExposure;}
vec3 studioPixel(vec2 px){vec3 ro=uCameraOrigin,rd=studioRay(px);vec3 color=uBackground*(.78+.36*exp(-dot((px/iResolution.xy-.5)*vec2(1.,1.3),(px/iResolution.xy-.5)*vec2(1.,1.3))*3.));vec2 hit=studioHit(ro,rd);if(hit.x>0.){vec3 pos=ro+hit.x*rd;vec3 nor=studioNormal(pos);SurfaceSample m=studioMaterial(pos,nor,hit.y);if(uView==1)return pow(m.baseColor,vec3(.4545));if(uView==2)return nor*.5+.5;if(uView==3)return vec3(m.roughness);if(uView==4)return vec3(m.occlusion);color=studioShade(m,pos,nor,-rd);}return pow(max(color*1.2/(1.+color),vec3(0.)),vec3(.4545));}
void main(){vec3 col=vec3(0.);int samples=clamp(uAASamples,1,4);for(int y=0;y<4;y++){if(y>=samples)break;for(int x=0;x<4;x++){if(x>=samples)break;vec2 offset=samples==1?vec2(0.):((vec2(x,y)+.5)/float(samples)-.5);col+=studioPixel(gl_FragCoord.xy+offset);}}outputColor=vec4(col/float(samples*samples),1.);}
