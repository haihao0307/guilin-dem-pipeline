// R3.12 original macro/micro/observed field algebra. Explicit coordinates and
// derivative-free physical footprint are receiver bridges. No patch silhouette.
struct KpPlasterParams {
 vec2 centerM; vec2 halfM; float thicknessM; float reliefM;
 float geometryMicroM; float minThicknessM; float maxThicknessM; float microM;
 vec3 paletteDark; vec3 paletteLight;
 float grainWavelengthM; float grainHeightM; float grainColor;
};
struct KpPlasterField {float macroTone;float micro;float thicknessM;KpSurface surface;};
vec3 pl_rotate(vec3 v,vec3 axis,float a){float c=cos(a);float s=sin(a);return v*c+cross(axis,v)*s+axis*dot(axis,v)*(1.0-c);}
vec3 pl_warp(vec3 p,vec3 phase){vec3 c1=vec3(0.12,1.42,0.04)+0.035*phase;vec3 a1=normalize(vec3(0.38,0.82,0.42));vec3 v1=p-c1;float t1=0.65*exp(-dot(v1,v1)/(2.4*2.4))*sin(1.45*dot(a1,v1)+0.7+phase.x);vec3 q=c1+pl_rotate(v1,a1,t1);vec3 c2=vec3(-0.16,1.63,-0.06)+0.025*phase;vec3 a2=normalize(vec3(-0.67,0.15,0.73));vec3 v2=q-c2;float t2=0.20*exp(-dot(v2,v2)/(2.1*2.1))*sin(4.1*dot(a2,v2)+2.0+phase.y);return c2+pl_rotate(v2,a2,t2);}
vec3 pl_xi(vec3 p,vec3 phase){vec3 q=pl_warp(p,phase)+vec3(2.73,0.91,1.37);float r=max(length(q),1e-4);return vec3(log2(r)-2.0,-q.z/r,atan(q.x,q.y));}
float pl_cell(vec3 xi,float sc){float a=cos(sc*xi.z)*cos(sc*xi.x)+cos(sc*xi.y)*cos(sc*xi.y)+cos(sc*xi.y)*cos(sc*xi.x);return cos(a)-0.6556965458313674;}
float pl_macroFast(vec3 p){vec3 xi=pl_xi(p,vec3(0.7,-1.3,2.1));float s=pl_cell(xi,1.0)+pl_cell(xi,2.0)*0.5+pl_cell(xi,4.0)*0.25+pl_cell(xi,8.0)*0.125+pl_cell(xi,16.0)*0.0625;return tanh(0.78*s);}
float pl_microFast(vec3 p){vec3 xi=pl_xi(p,vec3(0.7,-1.3,2.1));float s=pl_cell(xi,16.0)*0.0625+pl_cell(xi,32.0)*0.03125+pl_cell(xi,64.0)*0.015625;return tanh(10.5*s);}
vec3 pl_q(vec3 p,KpPlasterParams a){return vec3((p.xy-a.centerM)/max(a.halfM,vec2(0.08)),p.z*2.0);}
float kpPlasterMacro(vec3 p,KpPlasterParams a){float low=pl_macroFast(pl_q(p,a)+vec3(-0.17,0.31,0.09));float coarse=sin(p.x*2.7+p.y*0.9)*sin(p.y*3.2-p.x*0.7);return clamp(0.48*low+0.52*coarse,-1.0,1.0);}
float kpPlasterMicro(vec3 p,KpPlasterParams a){float m=pl_microFast(pl_q(p,a)*vec3(2.65,2.52,3.55)+vec3(-0.27,0.44,-0.19));float r=sin(p.x*47.0-p.y*39.0+p.z*58.0)*sin(p.x*31.0+p.y*37.0-p.z*43.0);return clamp(0.78*m+0.22*r,-1.0,1.0);}
float pl_observed(vec3 p,KpPlasterParams a,float physicalFootprintM){
 vec3 q=pl_q(p,a);vec3 phase=vec3(-1.3,4.7,2.2);vec3 xi=pl_xi(q,phase);
 float e=max(physicalFootprintM,1e-7);vec3 dq=vec3(e/max(a.halfM.x,0.08),e/max(a.halfM.y,0.08),e*2.0);
 float fp=max(length(pl_xi(q+vec3(dq.x,0,0),phase)-xi),max(length(pl_xi(q+vec3(0,dq.y,0),phase)-xi),length(pl_xi(q+vec3(0,0,dq.z),phase)-xi)));
 float sum=0.0;float sc=1.0;for(int i=0;i<17;i++){float gate=1.0-smoothstep(0.44,1.12,fp*sc);sum+=gate*pl_cell(xi,sc)/sc;sc*=2.0;}return tanh(0.86*sum);
}
KpPlasterField kpPlasterOriginalField(vec3 pLocalM,KpPlasterParams a,float physicalFootprintM){
 float pm=kpPlasterMacro(pLocalM,a);float pu=kpPlasterMicro(pLocalM,a);float obs=pl_observed(pLocalM,a,physicalFootprintM);
 // Existing metric-grain correction: same direction, explicit metre period.
 float wave=max(a.grainWavelengthM,0.0003);float phase=dot(pLocalM,normalize(vec3(83.0,-61.0,97.0)))*(6.283185307179586/wave);
 float grain=sin(phase)*(1.0-smoothstep(0.35,0.90,physicalFootprintM/wave));
 float microGate=1.0-smoothstep(0.008,0.020,physicalFootprintM);
 float h=microGate*a.microM*(0.26*obs+0.18*pu)+a.grainHeightM*grain;
 vec3 base=mix(a.paletteDark,a.paletteLight,0.58+0.08*obs+0.22*pm)*(0.94+a.grainColor*grain);
 float rough=clamp(0.95+0.032*(-obs),0.86,0.997);
 float thickness=clamp(a.thicknessM+a.reliefM*pm+a.geometryMicroM*pu,a.minThicknessM,a.maxThicknessM);
 return KpPlasterField(pm,pu,thickness,KpSurface(h,base,rough));
}
