// GGX and height-correlated Smith adapted from three.js r170 (MIT; license included in HTML).
// Fresnel uses the standard Schlick fifth-power form. Material colors and value-noise field are original.
float pbrD(float alpha,float NoH){float a2=alpha*alpha;float d=NoH*NoH*(a2-1.)+1.;return .31830988618*a2/max(d*d,.0000001);}
float pbrV(float alpha,float NoL,float NoV){float a2=alpha*alpha;float gv=NoL*sqrt(a2+(1.-a2)*NoV*NoV);float gl=NoV*sqrt(a2+(1.-a2)*NoL*NoL);return .5/max(gv+gl,.000001);}
vec3 pbrF(vec3 f0,float VoH){float f=pow(1.-clamp(VoH,0.,1.),5.);return f0+(1.-f0)*f;}
vec3 pbrBRDF(vec3 n,vec3 v,vec3 l,vec3 base,float rough,float metal){vec3 h=normalize(v+l);float NoL=max(0.,dot(n,l)),NoV=max(.001,dot(n,v)),NoH=max(0.,dot(n,h)),VoH=max(0.,dot(v,h));float alpha=max(.045,rough*rough);vec3 f=pbrF(mix(vec3(.04),base,metal),VoH);vec3 diffuse=(1.-f)*(1.-metal)*base*.31830988618;vec3 specular=f*pbrD(alpha,NoH)*pbrV(alpha,NoL,NoV);return (diffuse+specular)*NoL;}
float materialHash(vec2 p){return fract(sin(dot(p,vec2(91.73,263.31)))*49732.1128);}
float materialNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(materialHash(i),materialHash(i+vec2(1.,0.)),f.x),mix(materialHash(i+vec2(0.,1.)),materialHash(i+vec2(1.,1.)),f.x),f.y);}
vec2 materialUV(vec3 p,float y,float mat){vec2 st=stoneCoordinates(p);if(mat>2.5&&mat<4.5){float circumference=uK>.0?sh(uK*7.4)/uK:7.4;return vec2(atan(p.y,p.x)*circumference,y);}return st;}
float materialHeight(vec3 p,float y,float mat){vec2 uv=materialUV(p,y,mat);return (materialNoise(uv*9.7)-.5)*.003+(materialNoise(uv*31.3)-.5)*.0011;}
vec3 materialNormal(vec3 p,float y,float mat,vec3 n,vec3 a,vec3 b){if(mat>4.5||mat>1.5&&mat<2.5)return n;float e=.006;vec3 g=vec3(materialHeight(stepH(p,a,e),y,mat)-materialHeight(stepH(p,a,-e),y,mat),materialHeight(p,y+e,mat)-materialHeight(p,y-e,mat),materialHeight(stepH(p,b,e),y,mat)-materialHeight(stepH(p,b,-e),y,mat))/(2.*e);g-=n*dot(n,g);return normalize(n-g);}
vec3 shadePBR(vec3 p,float y,float mat,float distanceToEye){vec3 a,b;frameH(p,a,b);vec3 geometricNormal=normalH(p,y,mat,a,b);vec3 n=materialNormal(p,y,mat,geometricNormal,a,b);vec3 view=lightVector(p,a,b,uP,1.25-y);float occ=ambientOcclusion(p,y,geometricNormal,a,b);vec2 uv=materialUV(p,y,mat);float broad=materialNoise(uv*1.7),middle=materialNoise(uv*9.7),grain=materialNoise(uv*31.3);vec3 base=mix(vec3(.035,.037,.037),vec3(.077,.069,.056),broad);float rough=clamp(.44+middle*.23+grain*.06,.32,.83),metal=0.;
if(mat>1.5&&mat<2.5){base=vec3(.024,.034,.042);rough=.85;}
if(mat>2.5&&mat<4.5){base=mix(vec3(.105,.092,.075),vec3(.17,.15,.119),broad);rough=.58+middle*.18;}
if(mat>4.5){base=vec3(.50,.30,.102)*(.9+.1*broad);rough=.25+.085*middle;metal=1.;}
if(uDebug==6.)rough=.84;if(uDebug==7.)rough=.23;
vec3 f0=mix(vec3(.04),base,metal);float NoV=max(.001,dot(n,view));vec3 envF=pbrF(f0,NoV);vec3 reflected=reflect(-view,n);vec3 env=mix(vec3(.04,.035,.025),vec3(.26,.34,.39),clamp(reflected.y*.5+.5,0.,1.));vec3 color=base*(1.-metal)*vec3(.20,.235,.255)*occ+env*envF*(.9-.35*rough)*occ;
vec3 key=lightVector(p,a,b,vec3(0.,0.,1.),3.86-y);float horizontalN=length(geometricNormal.xz);vec3 offsetTangent=(a*geometricNormal.x+b*geometricNormal.z)/max(horizontalN,.00001);float keyShadow=uDebug==1.?1.:shadow(stepH(p,offsetTangent,.02*horizontalN),y+.02*geometricNormal.y,vec3(0.,0.,1.),3.86);float keyAtt=1./(1.+.018*radial(p)*radial(p));color+=pbrBRDF(n,view,key,base,rough,metal)*vec3(3.8,4.55,5.2)*keyAtt*keyShadow;
for(int i=0;i<3;i++){float d=distH(p,uBeacons[i]);vec3 l=lightVector(p,a,b,uBeacons[i],1.17-y);float att=7.2/(1.+.85*d*d+(y-1.17)*(y-1.17));vec3 lc=mix(vec3(1.,.55,.25),vec3(.48,.77,.69),uLit[i]*.65);color+=pbrBRDF(n,view,l,base,rough,metal)*lc*att*occ;}
if(mat<1.5){float pathD=min(segmentDist(p,uBeacons[0],uBeacons[1]),min(segmentDist(p,uBeacons[1],uBeacons[2]),segmentDist(p,uBeacons[2],uBeacons[0])));color+=vec3(.20,.115,.035)*exp(-pathD*pathD*7000.);float guideD=segmentDist(p,uP,uTarget);color+=vec3(.13,.35,.36)*(exp(-guideD*guideD*10000.)*.55+exp(-guideD*guideD*300.)*.025);float centerD=(radial(p)-.45)*85.;color+=vec3(.045,.08,.09)*exp(-centerD*centerD);}
if(mat>2.5&&mat<3.5){float ledY=(y-3.54)*75.;color+=vec3(.19,.34,.38)*exp(-ledY*ledY)*.32;}
if(mat>5.5){float lit=mat<6.5?uLit.x:mat<7.5?uLit.y:uLit.z;color=mix(vec3(2.8,1.10,.29),vec3(.75,1.65,1.2),lit*.6)*(.62+.5*pow(max(0.,dot(n,view)),2.));}
return mix(color,vec3(.033,.047,.053),1.-exp(-distanceToEye*.018));}
