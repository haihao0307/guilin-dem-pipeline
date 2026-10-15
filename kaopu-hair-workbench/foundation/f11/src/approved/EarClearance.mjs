/** F02.1: local native-ear attachment exclusion, metres. No root moves.
 * The superior edge stays within 0.1 mm of the accepted native ear-top level.
 * This monotone continuation avoids a second hump where the cut rejoins F02.
 * These are authored model dimensions, not photo-derived measurements.
 */
export const EAR_GUARD=Object.freeze({minAbsX:.0735,minZ:.013,maxZ:.037});
const PROFILE=[[.013,.3056],[.022,.3056],[.027,.3055],[.031,.3040],[.034,.3010],[.0355,.2940],[.037,.2820]];
function height(z){
 let j=0;while(j<PROFILE.length-2&&z>PROFILE[j+1][0])j++;
 const slope=i=>{if(i===0||i===PROFILE.length-1)return 0;const a=(PROFILE[i][1]-PROFILE[i-1][1])/(PROFILE[i][0]-PROFILE[i-1][0]),b=(PROFILE[i+1][1]-PROFILE[i][1])/(PROFILE[i+1][0]-PROFILE[i][0]);return a*b<=0?0:2*a*b/(a+b);};
 const[a,u]=PROFILE[j],[b,v]=PROFILE[j+1],t=Math.max(0,Math.min(1,(z-a)/(b-a))),t2=t*t,t3=t2*t;
 return(2*t3-3*t2+1)*u+(t3-2*t2+t)*(b-a)*slope(j)+(-2*t3+3*t2)*v+(t3-t2)*(b-a)*slope(j+1);
}
export function earClearance(p){
 const g=EAR_GUARD;
 return Math.max(p[1]-height(p[2]),g.minAbsX-Math.abs(p[0]),g.minZ-p[2],p[2]-g.maxZ);
}
export function subtractEar(p,oldValue){
 if(Math.abs(p[0])<.065||p[1]<.26||p[1]>.32||p[2]<EAR_GUARD.minZ||p[2]>EAR_GUARD.maxZ)return oldValue;
 return Math.min(oldValue,earClearance(p));
}
