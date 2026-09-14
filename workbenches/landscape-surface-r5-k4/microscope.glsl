// Same coordinate map and unchanged 2^-j prefix as microscope-field.js.
uniform float uMMTarget,uMMStrength;uniform int uMMMode;
const vec3 mmCenter=vec3(-8.,25.8012142181,11.3012142181);
float mmPatch(vec3 x){vec3 d=x-mmCenter;float a=max(0.,1.-dot(d,d)/49.);return a*a*a;}
vec3 mmDomain(vec3 x){vec3 d=(x-mmCenter)/2.;float a=.24*sin(dot(d,vec3(.47,.29,-.33))),c=cos(a),s=sin(a);vec3 v=vec3(c*d.x+s*d.z,d.y,-s*d.x+c*d.z)+vec3(3.7,4.1,5.3);float r=length(v);return vec3(log2(r)-2.,-v.z/r-1.,atan(v.x,v.y));}
vec3 mmSpectrum(vec3 x){vec3 q=mmDomain(x);float footprint=max(length(dFdx(q)),length(dFdy(q))),low=0.,tail=0.,fine=0.,f=1.;for(int j=0;j<17;j++){float gate=1.-smoothstep(.75,2.4,footprint*f);if(gate>0.){vec3 c=cos(q*f);float v=cos(c.z*c.x+c.y*c.y+c.y*c.x)/f*gate;if(j>=2&&j<6)low+=v;if(j>=6)tail+=v;if(j>=8)fine+=abs(v);}f*=2.;}return vec3(.45*tanh(8.*(low-.1171875)),tail,fine);}
