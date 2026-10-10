/** Optics reference in millimetres. Not yet wired to native geometry.
 * Separates front and back corneal boundaries, unlike ET08's one-interface approximation.
 * Spherical caps are central-zone approximations, not measured or aspherical corneas.
 */
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0),add=(a,b)=>a.map((x,i)=>x+b[i]),scale=(a,s)=>a.map(x=>x*s),unit=a=>scale(a,1/Math.hypot(...a));
export function refract(I,N,n1,n2){I=unit(I);N=unit(N);const eta=n1/n2,c=-dot(I,N),k=1-eta*eta*(1-c*c);return k<0?null:add(scale(I,eta),scale(N,eta*c-Math.sqrt(k)));}
export function fresnelNormal(n1,n2){return ((n1-n2)/(n1+n2))**2;}
function intersectSphere(P,D,C,R){const v=P.map((x,i)=>x-C[i]),b=dot(v,D),d=b*b-dot(v,v)+R*R;if(d<0)return null;const roots=[-b-Math.sqrt(d),-b+Math.sqrt(d)].filter(t=>t>1e-7).sort((a,b)=>a-b);if(!roots.length)return null;return add(P,scale(D,roots[0]));}
export function traceTwoInterface({surfaceXY=[0,0],viewDirection=[0,0,1],corneaRadiusMM=7.8,corneaThicknessMM=.55,aqueousDepthMM=3,corneaIOR=1.376,aqueousIOR=1.336}={}){
 const R=corneaRadiusMM,rho2=dot(surfaceXY,surfaceXY);if(rho2>=R*R)throw RangeError('Outside corneal cap');
 const center=[0,0,-R],P=[...surfaceXY,-R+Math.sqrt(R*R-rho2)],N=unit(P.map((x,i)=>x-center[i]));
 const airRay=scale(unit(viewDirection),-1);if(dot(airRay,N)>=0)return{valid:false,reason:'back-facing'};
 const corneaRay=refract(airRay,N,1,corneaIOR);if(!corneaRay)return{valid:false,reason:'front TIR'};
 // Concentric back surface is a deliberately documented geometric approximation.
 const back=intersectSphere(add(P,scale(corneaRay,1e-6)),corneaRay,center,R-corneaThicknessMM);if(!back)return{valid:false,reason:'missed back surface'};
 const backNormal=unit(back.map((x,i)=>x-center[i]));
 const aqueousRay=refract(corneaRay,backNormal,corneaIOR,aqueousIOR);if(!aqueousRay||aqueousRay[2]>=-1e-6)return{valid:false,reason:'back TIR or grazing'};
 const irisZ=-corneaThicknessMM-aqueousDepthMM,t=(irisZ-back[2])/aqueousRay[2];if(t<0)return{valid:false,reason:'iris behind ray'};
 const hit=add(back,scale(aqueousRay,t));return{valid:true,hitMM:hit,frontMM:P,backMM:back,corneaRay,aqueousRay,frontF0:fresnelNormal(1,corneaIOR),backF0:fresnelNormal(corneaIOR,aqueousIOR),approximation:'two concentric spherical boundaries; no dispersion, iris relief or tear layer intersection'};
}
