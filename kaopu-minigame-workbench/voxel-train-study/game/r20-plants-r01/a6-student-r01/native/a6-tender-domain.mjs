const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t)};
export function a6TenderHalfWidth(x,z){const upper=smooth((z-2.80)/.91),end=smooth((Math.abs(x)-2.6)/1.05);return 1.30-.073*upper-.035*upper*end}
export function a6TenderMap(x,y,z){return[x,y*a6TenderHalfWidth(x,z)/1.30,z]}
export const A6_TENDER_GLSL='float a6TenderWidth(float x,float z){float u=smoothstep(2.80,3.71,z);float e=smoothstep(2.6,3.65,abs(x));return 1.30-.073*u-.035*u*e;}';
