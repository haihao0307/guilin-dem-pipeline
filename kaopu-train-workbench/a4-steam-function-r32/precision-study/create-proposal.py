from pathlib import Path
import difflib
root=Path(__file__).parent
src=(root/'steam-path.original.js').read_text()
original=src
old='vec3 spCylinderPoint(int side,float station,float x,float radial){float b=side==1?middleInclination:0.;return vec3((side==0?-.82:(side==2?.82:0.))+x,1.016+station*sin(b)+radial*cos(b),station*cos(b)-radial*sin(b));}'
new='''// Only beta in [.11,.16] or outside-cylinder zero enters this helper.
// Taylor remainders at |beta| <= .16: sin < 1.90e-13, cos < 1.07e-11.
// Explicit multiply/add avoids implementation-dependent builtin trig accuracy.
vec2 spBoundedBetaSinCos(float b){float b2=b*b;return vec2(b*(1.+b2*(-1./6.+b2*(1./120.-b2/5040.))),1.+b2*(-.5+b2*(1./24.-b2/720.)));}
vec3 spCylinderPoint(int side,float station,float x,float radial){float b=side==1?middleInclination:0.;vec2 sc=spBoundedBetaSinCos(b);return vec3((side==0?-.82:(side==2?.82:0.))+x,1.016+station*sc.x+radial*sc.y,station*sc.y-radial*sc.x);}'''
assert src.count(old)==1;src=src.replace(old,new)
old='''struct SPFillet{vec3 start;vec3 end;vec3 center;vec3 e;vec3 f;float r;float angle;};
SPFillet spFillet(vec3 a,vec3 b,vec3 c,float bend){vec3 u=normalize(a-b),v=normalize(c-b);float co=clamp(dot(u,v),-.999999,.999999),halfAngle=acos(co)*.5,t=min(bend/tan(halfAngle),.35*min(length(a-b),length(c-b)));SPFillet f;f.r=t*tan(halfAngle);f.center=b+normalize(u+v)*(t/cos(halfAngle));f.start=b+u*t;f.end=b+v*t;f.e=normalize(f.start-f.center);f.f=normalize(f.end-f.center-f.e*dot(f.end-f.center,f.e));f.angle=acos(clamp(dot(normalize(f.end-f.center),f.e),-1.,1.));return f;}
float spArcDistance(vec3 p,SPFillet f){vec3 q=p-f.center;float a=atan(dot(q,f.f),dot(q,f.e));float d=min(length(q-f.r*f.e),length(q-f.r*(f.e*cos(f.angle)+f.f*sin(f.angle))));if(a>=0.&&a<=f.angle)d=min(d,length(q-f.r*(f.e*cos(a)+f.f*sin(a))));return d;}'''
new='''struct SPFillet{vec3 start;vec3 end;vec3 center;vec3 e;vec3 f;float r;vec2 endDirection;};
// Same tangent circle as CPU: cos(h)=sqrt((1+co)/2), tan(h)=sqrt((1-co)/(1+co)).
SPFillet spFillet(vec3 a,vec3 b,vec3 c,float bend){vec3 u=normalize(a-b),v=normalize(c-b);float co=clamp(dot(u,v),-.999999,.999999),cosHalf=sqrt(.5*(1.+co)),tanHalf=sqrt(.5*(1.-co))/cosHalf,t=min(bend/tanHalf,.35*min(length(a-b),length(c-b)));SPFillet f;f.r=t*tanHalf;f.center=b+normalize(u+v)*(t/cosHalf);f.start=b+u*t;f.end=b+v*t;f.e=normalize(f.start-f.center);f.f=normalize(f.end-f.center-f.e*dot(f.end-f.center,f.e));vec3 en=normalize(f.end-f.center);f.endDirection=vec2(dot(en,f.e),dot(en,f.f));return f;}
// A circular minor arc is a planar radial projection restricted to its endpoint wedge.
// This is equivalent to 0 <= atan2(y,x) <= acos(endDirection.x), without trig.
float spArcDistance(vec3 p,SPFillet f){vec3 q=p-f.center;vec2 w=vec2(dot(q,f.e),dot(q,f.f));float rho=length(w);float d=min(length(q-f.r*f.e),length(q-f.r*(f.e*f.endDirection.x+f.f*f.endDirection.y)));if(w.y>=0.&&w.x*f.endDirection.y-w.y*f.endDirection.x>=0.&&rho>0.)d=min(d,length(q-(f.r/rho)*(f.e*w.x+f.f*w.y)));return d;}'''
assert src.count(old)==1;src=src.replace(old,new)
(root/'steam-path.precision-proposal.js').write_text(src)
(root/'steam-path-precision.patch').write_text(''.join(difflib.unified_diff(original.splitlines(True),src.splitlines(True),fromfile='a/steam-path.js',tofile='b/steam-path.js')))
print('Wrote standalone proposal and patch; original core remains untouched.')
