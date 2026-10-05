#version 300 es
/* KAOPU R16 unified studio layer: inherited KAOPU R04 GGX material functions, CC BY-NC-SA 3.0; TDM Wet stone (Alexander Alekseev, 2014) attribution retained. Teacher geometry below remains MIT as noted in its header. */
precision highp float;precision highp int;uniform vec3 iResolution;uniform float iTime;uniform int iFrame;out vec4 outputColor;
#define HW_PERFORMANCE 0

uniform vec3 uCameraOrigin,uCameraTarget;uniform float uCameraLens;uniform float uInspectZoom;uniform vec2 uInspectPan;uniform float uFilterStrength;
vec3 studioRay(vec2 pixel){vec3 fw=normalize(uCameraTarget-uCameraOrigin);vec3 rt=normalize(cross(fw,vec3(0.,1.,0.)));vec3 up=normalize(cross(rt,fw));vec2 uv=(2.*pixel-iResolution.xy)/iResolution.y;uv+=uInspectPan;return normalize(rt*uv.x+up*uv.y+fw*uCameraLens*uInspectZoom);}
float studioFootprint(vec3 p){return max(.0001,length(p-uCameraOrigin)/(iResolution.y*uCameraLens*max(uInspectZoom,.35)));}
// The MIT License
// Copyright © 2016 Inigo Quilez
// Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions: The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software. THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.


// Computing normals analytically has the benefit of being faster if you need them often, 
// while numerical normals are easier to filter for antialiasing. See line 200.
//
// More info: https://iquilezles.org/articles/morenoise
//
// See this too: https://www.shadertoy.com/view/XsXfRH
//
// Proper noise code isolated here: https://www.shadertoy.com/view/XsXfRH
//
//#define SHOW_NUMERICAL_NORMALS  // for comparison purposes


float hash( float n ) { return fract(sin(n)*753.5453123); }


//---------------------------------------------------------------
// value noise, and its analytical derivatives
//---------------------------------------------------------------

vec4 noised( in vec3 x )
{
    vec3 p = floor(x);
    vec3 w = fract(x);
	vec3 u = w*w*(3.0-2.0*w);
    vec3 du = 6.0*w*(1.0-w);
    
    float n = p.x + p.y*157.0 + 113.0*p.z;
    
    float a = hash(n+  0.0);
    float b = hash(n+  1.0);
    float c = hash(n+157.0);
    float d = hash(n+158.0);
    float e = hash(n+113.0);
	float f = hash(n+114.0);
    float g = hash(n+270.0);
    float h = hash(n+271.0);
	
    float k0 =   a;
    float k1 =   b - a;
    float k2 =   c - a;
    float k3 =   e - a;
    float k4 =   a - b - c + d;
    float k5 =   a - c - e + g;
    float k6 =   a - b - e + f;
    float k7 = - a + b + c - d + e - f - g + h;

    return vec4( k0 + k1*u.x + k2*u.y + k3*u.z + k4*u.x*u.y + k5*u.y*u.z + k6*u.z*u.x + k7*u.x*u.y*u.z, 
                 du * (vec3(k1,k2,k3) + u.yzx*vec3(k4,k5,k6) + u.zxy*vec3(k6,k4,k5) + k7*u.yzx*u.zxy ));
}

//---------------------------------------------------------------

vec4 sdBox( vec3 p, vec3 b ) // distance and normal
{
    vec3 d = abs(p) - b;
    float x = min(max(d.x,max(d.y,d.z)),0.0) + length(max(d,0.0));
    vec3  n = step(d.yzx,d.xyz)*step(d.zxy,d.xyz)*sign(p);
    return vec4( x, n );
}

vec4 fbmd( in vec3 x )
{
    const float scale  = 1.5;

    float a = 0.0;
    float b = 0.5;
	float f = 1.0;
    vec3  d = vec3(0.0);
    for( int i=0; i<8; i++ )
    {
        vec4 n = noised(f*x*scale);
        a += b*n.x;           // accumulate values		
        d += b*n.yzw*f*scale; // accumulate derivatives
        b *= 0.5;             // amplitude decrease
        f *= 1.8;             // frequency increase
    }

	return vec4( a, d );
}

vec4 map( in vec3 p )
{
	vec4 d1 = fbmd( p );
    d1.x -= 0.37;
	d1.x *= 0.7;
    d1.yzw = normalize(d1.yzw);

    // clip to box
    vec4 d2 = sdBox( p, vec3(1.5) );
    return (d1.x>d2.x) ? d1 : d2;
}

// ray-box intersection in box space
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

// raymarch
vec4 interesect( in vec3 ro, in vec3 rd )
{
	vec4 res = vec4(-1.0);

    // bounding volume    
    vec2 dis = iBox( ro, rd, vec3(1.5) ) ;
    if( dis.y<0.0 ) return res;

    // raymarch
    float tmax = dis.y;
    float t = dis.x;
	for( int i=0; i<128; i++ )
	{
        vec3 pos = ro + t*rd;
		vec4 hnor = map( pos );
        res = vec4(t,hnor.yzw);
        
		if( hnor.x<0.001 ) break;
		t += hnor.x;
        if( t>tmax ) break;
	}

	if( t>tmax ) res = vec4(-1.0);
	return res;
}

// compute normal numerically
#ifdef SHOW_NUMERICAL_NORMALS
vec3 calcNormal( in vec3 pos )
{
	vec2 eps = vec2( 0.0001, 0.0 );
	vec3 nor = vec3( map(pos+eps.xyy).x - map(pos-eps.xyy).x,
	                 map(pos+eps.yxy).x - map(pos-eps.yxy).x,
	                 map(pos+eps.yyx).x - map(pos-eps.yyx).x );
	return normalize(nor);
}
#endif

// fibonazzi points in s aphsre, more info:
// http://lgdv.cs.fau.de/uploads/publications/spherical_fibonacci_mapping_opt.pdf
vec3 forwardSF( float i, float n) 
{
    const float PI  = 3.141592653589793238;
    const float PHI = 1.618033988749894848;
    float phi = 2.0*PI*fract(i/PHI);
    float zi = 1.0 - (2.0*i+1.0)/n;
    float sinTheta = sqrt( 1.0 - zi*zi);
    return vec3( cos(phi)*sinTheta, sin(phi)*sinTheta, zi);
}

float calcAO( in vec3 pos, in vec3 nor )
{
	float ao = 0.0;
    for( int i=0; i<32; i++ )
    {
        vec3 ap = forwardSF( float(i), 32.0 );
        float h = hash(float(i));
		ap *= sign( dot(ap,nor) ) * h*0.25;
        ao += clamp( map( pos + nor*0.001 + ap ).x*3.0, 0.0, 1.0 );
    }
	ao /= 32.0;
	
    return clamp( ao*5.0, 0.0, 1.0 );
}


vec2 studioHit(vec3 ro,vec3 rd){vec4 h=interesect(ro,rd);return vec2(h.x,h.x>0.?calcAO(ro+h.x*rd,h.yzw):1.);}
vec3 studioNormal(vec3 p){return normalize(map(p).yzw);}
float studioShadow(vec3 p,vec3 n,vec3 l,float distanceToLight){float t=.004,s=1.;for(int i=0;i<36;i++){float h=map(p+n*.003+l*t).x;s=min(s,clamp(12.*h/t,0.,1.));t+=clamp(h,.02,.12);if(s<.02||t>distanceToLight)break;}return s;}

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
