// Provider derivative experiment. Authority position and final residual remain
// the original yarn() function. Analytic Jacobians may change finite Newton
// paths and therefore require position/depth/visibility validation separately.
export function yarnDerivativeSource(source){
 const helper=`
vec3 centreDerivative(float t){float v=fract(t)*10.;int i=min(9,int(floor(v)));float x=v-float(i);return (3.*uCoefficients[i*4+3]*x*x+2.*uCoefficients[i*4+2]*x+uCoefficients[i*4+1])*10.*uPitch;}
void yarnJacobian(float t,float theta,float lane,out vec3 du,out vec3 dv){
 vec3 v=centre(t+.0005,lane)-centre(t-.0005,lane),D=centreDerivative(t+.0005)-centreDerivative(t-.0005),T=normalize(v),dT=(D-T*dot(T,D))/length(v);
 vec3 rawB=cross(T,vec3(0.,0.,1.))+vec3(1.e-12),B=normalize(rawB),db=cross(dT,vec3(0.,0.,1.)),dB=(db-B*dot(B,db))/length(rawB),rawW=cross(B,T),W=normalize(rawW),dw=cross(dB,T)+cross(B,dT),dW=(dw-W*dot(W,dw))/length(rawW);
 float ft=fract(t),phi=p02Phase(t,lane),r=uRadius*(1.+.038*sin(ft*21.+phi)+.022*sin(ft*49.+phi*3.)),dr=uRadius*(.038*21.*cos(ft*21.+phi)+.022*49.*cos(ft*49.+phi*3.));
 float A=3.*(theta+ft*TAU*2.8*.55),C=5.*theta+phi+ft*11.,envelope=1.+.055*cos(A)+.022*sin(C),deT=-.055*sin(A)*3.*TAU*2.8*.55+.022*cos(C)*11.,deV=-.165*sin(A)+.11*cos(C);
 vec3 Q=B*cos(theta)+W*sin(theta);du=centreDerivative(t)+(dB*cos(theta)+dW*sin(theta))*r*envelope+Q*(dr*envelope+r*deT);dv=(-B*sin(theta)+W*cos(theta))*r*envelope+Q*r*deV;
}
`;
 const anchor='bool solveYarn(',du='vec3 du=(yarn(t+.00002,theta,lane)-yarn(t-.00002,theta,lane))/.00004;',dv='vec3 dv=(yarn(t,theta+.0002,lane)-yarn(t,theta-.0002,lane))/.0004;';
 for(const a of [anchor,du,dv])if(source.split(a).length!==2)throw Error('Yarn derivative source anchor changed');
 return source.replace(anchor,helper+'\n'+anchor).replace(du,'vec3 du,dv;yarnJacobian(t,theta,lane,du,dv);').replace(dv,'');
}
